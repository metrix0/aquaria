
import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { beginBowDraw, releaseBowDraw, createGame, stepGame, useDressing, useUtilityItem, useWeapon } from '../src/gameplay/simulation.js';
import { damageMob } from '../src/gameplay/mobs.js';
import { takeDamage, MAX_HEALTH } from '../src/gameplay/player.js';
import { skillAttackDamage, strikeMob, stepClassEffects } from '../src/gameplay/class-effects.js';
import { KELP_DRESSING } from '../src/content.js';
import { STARTER_CLASS_IDS } from '../src/starter-classes.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { absorbSouls, activateClass, CLASS_DEFS, createClassProgress, grantDebugSouls, skillBonuses, skillBudget, unlockSkill, equipSkill, equippedSkill, unlockedActiveSkills } from '../src/classes.js';

function game() {
  return { inventory: new Inventory(), classes: createClassProgress(), player: { skillBonuses: {} }, dirty: false };
}
test('all six independent classes contain three paths and boss-gated major stars', () => {
  assert.equal(Object.keys(CLASS_DEFS).length, 6);
  assert.deepEqual(STARTER_CLASS_IDS, ['warden', 'wayfarer', 'scholar']);
  for (const def of Object.values(CLASS_DEFS)) {
    assert.equal(def.paths.length, 3);
    for (const path of def.paths) {
      assert.equal(path.nodes.length, 3);
      assert.equal(path.nodes.filter((node) => node.major).length, 1);
      assert.equal(path.nodes[2].major, true);
    }
  }
});
test('souls cannot be used without a class; attunement consumes physical items', () => {
  const state = game();
  state.inventory.add('lesser-soul', 5);
  state.inventory.add('greater-soul', 1);
  assert.match(absorbSouls(state, 'lesser'), /class/i);
  assert.equal(state.inventory.count('lesser-soul'), 5);
  assert.equal(activateClass(state, 'stormborn'), null);
  assert.equal(absorbSouls(state, 'lesser', 5), null);
  assert.equal(absorbSouls(state, 'greater'), null);
  assert.equal(state.inventory.count('lesser-soul'), 0);
  assert.deepEqual(state.classes.total, { lesser: 5, greater: 1 });
});
test('debug soul grant refills both shared balances and survives restoration', () => {
  const state = game();
  grantDebugSouls(state);
  assert.deepEqual(state.classes.total, { lesser: 100000, greater: 100000 });
  assert.equal(state.dirty, true);
  activateClass(state, 'warden');
  for (const path of CLASS_DEFS.warden.paths) for (const skill of path.nodes) {
    assert.equal(unlockSkill(state, skill.id), null);
  }
  grantDebugSouls(state);
  assert.deepEqual(createClassProgress(state.classes), state.classes);
  assert.equal(state.classes.builds.warden.length, 9);
});
test('progression requires previous lesser stars and both soul types for milestones', () => {
  const state = game();
  activateClass(state, 'stormborn');
  state.inventory.add('lesser-soul', 4);
  absorbSouls(state, 'lesser', 4);
  assert.match(unlockSkill(state, 'stormheart'), /previous/i);
  assert.equal(unlockSkill(state, 'sparkbite'), null);
  assert.equal(unlockSkill(state, 'voltaic-rhythm'), null);
  assert.match(unlockSkill(state, 'stormheart'), /souls/i);
  state.inventory.add('greater-soul', 1);
  absorbSouls(state, 'greater');
  assert.equal(unlockSkill(state, 'stormheart'), null);
  assert.deepEqual(skillBudget(state.classes), { lesser: 0, greater: 0 });
  assert.equal(skillBonuses(state.classes).attack, 8);
  assert.match(unlockSkill(state, 'stormheart'), /already/i);
});
test('class swapping remembers individual builds without duplicating total soul budget', () => {
  const state = game();
  activateClass(state, 'stonebound');
  state.inventory.add('lesser-soul', 2);
  absorbSouls(state, 'lesser', 2);
  unlockSkill(state, 'granite-hide');
  assert.equal(skillBonuses(state.classes).resist, .08);
  activateClass(state, 'tideweaver');
  assert.equal(skillBudget(state.classes).lesser, 2);
  assert.equal(skillBonuses(state.classes).resist, 0);
  unlockSkill(state, 'springwater');
  assert.equal(skillBonuses(state.classes).regen, .3);
  activateClass(state, 'stonebound');
  assert.equal(skillBonuses(state.classes).resist, .08);
  assert.equal(skillBudget(state.classes).lesser, 1);
});
test('saved builds validate node ids, prerequisites and their soul budget', () => {
  const progress = createClassProgress({ active: 'stonebound', total: { lesser: 1, greater: 1 },
    builds: { stonebound: ['granite-hide', 'anchored-heart', 'living-bastion', 'nonsense'] } });
  assert.deepEqual(progress.builds.stonebound, ['granite-hide']);
  assert.equal(skillBudget(progress).lesser, 0);
});

test('boss souls survive a full backpack and remain one-time rewards after saving', () => {
  const state = createGame();
  const boss = state.world.mobs.find((mob) => mob.kind === 'kraken');
  assert.ok(boss);
  for (const group of ['hotbar', 'backpack']) {
    state.inventory[group] = state.inventory[group].map(() => ({ id: 'wood', count: 1 }));
  }
  damageMob(state.world, boss, boss.maxHealth, 0, 0, state.effects);
  stepGame(state, {}, 1 / 60);
  assert.equal(state.inventory.count('greater-soul'), 0);
  assert.equal(state.world.soulRewards.length, 1);
  const restored = createGame(decodeSave(encodeSave(state)));
  assert.equal(restored.world.soulRewards.length, 1);
  restored.inventory.backpack[0] = null;
  stepGame(restored, {}, 1 / 60);
  assert.equal(restored.inventory.count('greater-soul'), 1);
  assert.equal(restored.world.soulRewards.length, 0);
  assert.ok(restored.classes.claimed.includes(boss.id));
  const savedAgain = createGame(decodeSave(encodeSave(restored)));
  assert.equal(savedAgain.inventory.count('greater-soul'), 1);
  assert.ok(savedAgain.classes.claimed.includes(boss.id));
});

test('starter trees save and switch independently without weakening the original three', () => {
  const state = createGame();
  state.classes.total.lesser = 18;
  state.classes.total.greater = 3;
  activateClass(state, 'warden');
  assert.equal(unlockSkill(state, 'shield-discipline'), null);
  activateClass(state, 'wayfarer');
  assert.equal(unlockSkill(state, 'sharpened-eye'), null);
  activateClass(state, 'scholar');
  assert.equal(unlockSkill(state, 'field-dressing'), null);
  activateClass(state, 'stormborn');
  assert.equal(unlockSkill(state, 'tailwind'), null);
  const loaded = createGame(decodeSave(encodeSave(state)));
  for (const id of ['warden','wayfarer','scholar','stormborn']) {
    assert.equal(loaded.classes.builds[id].length, 1, id);
  }
  activateClass(loaded, 'warden');
  assert.equal(loaded.player.skillBonuses.resist, .10);
  activateClass(loaded, 'wayfarer');
  assert.equal(loaded.player.skillBonuses.arrowSpeed, .25);
  activateClass(loaded, 'scholar');
  assert.equal(loaded.player.skillBonuses.foodDouble, .5);
  activateClass(loaded, 'stormborn');
  assert.equal(loaded.player.skillBonuses.move, .10);
});

test('Wayfarer keeps new branch bonuses and does not carry removed traps or exploration bonuses', () => {
  const state = createGame();
  state.classes.total = { lesser: 30, greater: 5 };
  activateClass(state, 'wayfarer');
  for (const node of ['sharpened-eye','quickdraw','splitting-arrow','snareshot',
    'barbed-trail','master-snare','trailrunner','safe-footing','far-sight']) assert.equal(unlockSkill(state,node),null,node);
  const b=state.player.skillBonuses;
  assert.equal(b.arrowSpeed,.25); assert.equal(b.bowCooldown,.15); assert.equal(b.extraDraw,1);
  assert.equal(b.meleePower,.1); assert.equal(b.heat,1); assert.equal(b.fall,.85);
  assert.equal(b.perfectWeapon,.1); assert.equal(b.huntersMark,1);
  assert.equal(b.snare,0); assert.equal(b.ore,0);
  activateClass(state,'scholar');
  assert.equal(state.player.skillBonuses.heat,0);
});

test('Wayfarer overdraw pierces two separate real mobs without repeat hits', () => {
  const state = createGame();
  state.classes.total = { lesser: 4, greater: 1 };
  activateClass(state, 'wayfarer');
  for (const id of ['sharpened-eye', 'quickdraw', 'splitting-arrow']) {
    assert.equal(unlockSkill(state, id), null);
  }
  const enemies = state.world.mobs.filter((mob) => mob.kind === 'crab').slice(0, 2);
  assert.equal(enemies.length, 2);
  state.world.mobs = enemies;
  for (const [index, mob] of enemies.entries()) {
    mob.x = state.player.x + 48 + index * 24;
    mob.y = state.player.y + 14;
    mob.health = 40;
    mob.maxHealth = 40;
    mob.rooted = 30; // Prevent AI wandering during this projectile test.
    mob.rootLift = 0;
  }
  state.inventory.hotbar[0] = { id: 'bow', count: 1 };
  state.inventory.add('arrow', 1);
  beginBowDraw(state, 0, state.player.x + 90, state.player.y + 11);
  for (let i = 0; i < 100; i++) stepGame(state, {}, 1 / 60);
  releaseBowDraw(state);
  for (let i = 0; i < 80; i++) stepGame(state, {}, 1 / 60);
  assert.ok(enemies.every((mob) => mob.health < 40),
    'a single greater-star arrow must damage both targets');
  assert.ok(enemies.every((mob) => mob.health >= 30),
    'each target must take damage at most once from a piercing projectile');
});

test('only two unlocked active skills can be equipped per class and reassignment swaps without duplicates', () => {
  const g = game();
  grantDebugSouls(g);
  activateClass(g, 'warden');
  assert.match(equipSkill(g, 0, 'unyielding'), /unlock/i);
  for (const path of CLASS_DEFS.warden.paths) for (const node of path.nodes) assert.equal(unlockSkill(g, node.id), null);
  assert.equal(unlockedActiveSkills(g.classes).length, 3);
  assert.deepEqual(g.classes.skillSlots.warden, ['unyielding', 'reavers-oath']);
  assert.match(equipSkill(g, 2, 'aegis-oath'), /slot/i);
  assert.match(equipSkill(g, 0, 'ironwall'), /active/i);
  assert.equal(equipSkill(g, 0, 'aegis-oath'), null);
  assert.equal(equipSkill(g, 1, 'aegis-oath'), null);
  assert.deepEqual(g.classes.skillSlots.warden, ['reavers-oath', 'aegis-oath']);
  assert.equal(equippedSkill(g.classes, 1).ability, 'aegisAura');
  assert.equal(g.player.skillBonuses.brace, 1);
  assert.equal(equipSkill(g, 0, null), null);
  activateClass(g, 'wayfarer');
  assert.equal(equippedSkill(g.classes, 1), null);
  for (const path of CLASS_DEFS.wayfarer.paths) for (const node of path.nodes) assert.equal(unlockSkill(g, node.id), null);
  assert.equal(equipSkill(g, 1, 'far-sight'), null);
  assert.equal(equippedSkill(g.classes, 1).ability, 'huntersMark');
  activateClass(g, 'warden');
  assert.deepEqual(g.classes.skillSlots.warden, [null, 'aegis-oath']);
  assert.deepEqual(createClassProgress(JSON.parse(JSON.stringify(g.classes))), g.classes);
});

test('legacy and malformed skill slot saves are normalized without losing purchased skills', () => {
  const g = game();
  grantDebugSouls(g); activateClass(g, 'warden');
  for (const path of CLASS_DEFS.warden.paths) for (const node of path.nodes) unlockSkill(g, node.id);
  const { skillSlots, ...legacy } = g.classes;
  assert.deepEqual(createClassProgress(legacy).skillSlots.warden, ['unyielding', 'reavers-oath']);
  assert.deepEqual(createClassProgress({ ...legacy, skillSlots: { warden: ['aegis-oath', 'aegis-oath', 'reavers-oath'] } }).skillSlots.warden, ['aegis-oath', null]);
  assert.deepEqual(createClassProgress({ ...legacy, skillSlots: { warden: ['ironwall', 'far-sight'] } }).skillSlots.warden, [null, null]);
});

test('soul items remain usable from hotbar without a skill tree absorb button', () => {
  const state = game();
  activateClass(state, 'warden');
  for (const type of ['lesser', 'greater']) {
    const id = type + '-soul';
    state.inventory.add(id, 1, { preferHotbar: true });
    const slot = state.inventory.hotbar.findIndex(stack => stack?.id === id);
    assert.notEqual(slot, -1);
    assert.equal(useUtilityItem(state, slot).inventoryChanged, true);
    assert.equal(state.inventory.count(id), 0);
    assert.equal(state.classes.total[type], 1);
  }
});
