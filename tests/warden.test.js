import test from 'node:test';
import assert from 'node:assert/strict';
import { activateClass, unlockSkill } from '../src/classes.js';
import { ARMOR, WORKBENCH } from '../src/content.js';
import { WOODEN_SHIELD } from '../src/inventory.js';
import { createGame, craftItem, moveInventoryStack, stepGame, useWeapon } from '../src/gameplay/simulation.js';
import { takeDamage, MAX_HEALTH, PLAYER_SIZE } from '../src/gameplay/player.js';
import { classHit, skillAttackDamage } from '../src/gameplay/class-effects.js';
import { useWardenSkill, updateWardenAllies, behindAegis } from '../src/gameplay/warden.js';
import { decodeSave, encodeSave } from '../src/save.js';

function warden(...skills) {
  const g = createGame();
  g.classes.total = { lesser: 100, greater: 10 };
  activateClass(g, 'warden');
  for (const skill of skills) assert.equal(unlockSkill(g, skill), null, skill);
  g.world.mobs = [];
  stepGame(g, {}, 1 / 60);
  return g;
}

test('Defender: resist, timed stationary brace, no attacks or crouching, release to recover', () => {
  const g = warden('shield-discipline', 'ironwall');
  assert.equal(takeDamage(g.player, 20), 18);
  g.player.health = MAX_HEALTH;
  const x = g.player.x;
  for (let i = 0; i < 89; i++) stepGame(g, { down: true, right: true }, 1 / 60);
  assert.equal(g.player.bracing, true);
  assert.equal(g.player.x, x);
  assert.equal(g.player.height, PLAYER_SIZE.height);
  assert.equal(takeDamage(g.player, 20), 18);
  useWeapon(g, 0, x + 10, g.player.y);
  assert.equal(g.attack, null);
  stepGame(g, { down: true }, 1 / 60);
  assert.equal(takeDamage(g.player, 20), 9);
  stepGame(g, {}, 1 / 60);
  assert.equal(g.player.bracing, false);
  assert.equal(takeDamage(g.player, 20), 18);
});

test('Shield Rush requires equipped shield and is invulnerable with forward movement and cooldown', () => {
  const g = warden('shield-discipline','ironwall','unyielding');
  assert.match(useWardenSkill(g, 'shieldRush'), /Equip a shield/);
  g.inventory.add('wood', 4); g.inventory.add('copper', 2);
  assert.equal(craftItem(g, WOODEN_SHIELD, WORKBENCH.id), true);
  const index = g.inventory.hotbar.findIndex(s => s?.id === WOODEN_SHIELD.id);
  const group = index >= 0 ? 'hotbar' : 'backpack';
  const slot = index >= 0 ? index : g.inventory.backpack.findIndex(s => s?.id === WOODEN_SHIELD.id);
  assert.equal(moveInventoryStack(g, undefined, { group, index:slot }, { group:'offhand', index:0 }), true);
  assert.equal(g.progress.offhand, WOODEN_SHIELD.id);
  assert.equal(createGame(decodeSave(encodeSave(g))).progress.offhand, WOODEN_SHIELD.id);
  const x = g.player.x;
  g.player.facing = 1;
  const crab = createGame().world.mobs.find(m => m.kind === 'crab');
  Object.assign(crab, { x: x + 12, y:g.player.y + g.player.height/2 + 4, health:2, respawn:0 });
  g.world.mobs.push(crab);
  assert.equal(useWardenSkill(g, 'shieldRush'), null);
  assert.equal(takeDamage(g.player, 100), 0);
  stepGame(g, {}, 1 / 60);
  assert.ok(g.player.x > x);
  assert.ok(g.player.rushHits.has(crab));
  assert.ok(crab.flee > 0);
  for (let i = 0; i < 45; i++) stepGame(g, {}, 1 / 60);
  assert.equal(g.player.rushTime, 0);
  assert.match(useWardenSkill(g, 'shieldRush'), /recharging/);
});

test('Berserker: resistance threshold, scaling attack and active-only lifesteal', () => {
  const g = warden('battle-temper','bloodrush','reavers-oath');
  g.player.health = 50;
  assert.equal(takeDamage(g.player, 10), 10);
  g.player.health = 49;
  assert.equal(takeDamage(g.player, 10), 8);
  g.player.health = MAX_HEALTH;
  assert.equal(skillAttackDamage(g.player, 10), 10);
  g.player.health = 20;
  assert.equal(skillAttackDamage(g.player, 10), 18);
  classHit(g, {}, 10); assert.equal(g.player.health, 20);
  assert.equal(useWardenSkill(g, 'rage'), null);
  classHit(g, {}, 10); assert.equal(g.player.health, 23);
  stepGame(g, {}, 8.1);
  const hp = g.player.health;
  classHit(g, {}, 10); assert.equal(g.player.health, hp);
});

test('Perfect armor is rolled only at crafting and persists in saves', () => {
  const g = warden('watchers-ward');
  const copper = ARMOR['copper-breastplate'];
  for (const [id,count] of Object.entries(copper.cost)) g.inventory.add(id,count);
  assert.equal(craftItem(g, copper, WORKBENCH.id, () => .099), true);
  assert.equal(g.player.perfectArmor, true);
  assert.equal(takeDamage(g.player, 100), 80);
  const saved = createGame(decodeSave(encodeSave(g)));
  assert.equal(saved.player.perfectArmor, true);
  const iron = ARMOR['iron-breastplate'];
  for (const [id,count] of Object.entries(iron.cost)) g.inventory.add(id,count);
  assert.equal(craftItem(g, iron, WORKBENCH.id, () => .1), true);
  assert.equal(g.player.perfectArmor, false);
});

test('Protector cry tracks ally hit sequence, cooldown and nearby mobs; aura is directional', () => {
  const g = warden('watchers-ward','sanctuary-guard','aegis-oath');
  const p = g.player;
  const mob = { kind:'spider', x:p.x+20, y:p.y, health:3, flee:4, respawn:0 };
  g.world.mobs.push(mob);
  const ally = { id:'ally', x:p.x-30, y:p.y, damageSequence:0 };
  updateWardenAllies(g,[ally]);
  assert.equal(p.wardenCooldowns, undefined);
  ally.damageSequence++;
  updateWardenAllies(g,[ally]);
  assert.equal(p.wardenCooldowns.guardianCry,20);
  assert.equal(mob.wardenTaunt,6);
  assert.equal(mob.flee,0);
  mob.wardenTaunt=2; ally.damageSequence++;
  updateWardenAllies(g,[ally]);
  assert.equal(mob.wardenTaunt,2);
  p.facing=1;
  assert.equal(useWardenSkill(g,'aegisAura'),null);
  assert.equal(behindAegis(ally,p),true);
  assert.equal(behindAegis({...ally,x:p.x+50},p),false);
  const other=warden();
  other.player.x=p.x-30;other.player.y=p.y;
  updateWardenAllies(other,[{...p,id:'protector'}]);
  assert.equal(takeDamage(other.player,20),14);
  updateWardenAllies(other,[]);
  assert.equal(takeDamage(other.player,20),20);
});
