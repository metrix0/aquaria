import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, useWeapon } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { ITEMS } from '../src/inventory.js';
import { SPELLS, SPELL_ITEMS, spellCooldown } from '../src/spells.js';
import { WILD_CHEST_LOOT_TABLES } from '../src/world/wild-chest.js';

test('all spell items are chest drops with scrolls more common', () => {
  const entries = WILD_CHEST_LOOT_TABLES['first-cave'].entries;
  assert.equal(entries.reduce((sum, e) => sum + e.weight, 0), 100);
  for (const id of Object.keys(SPELLS)) {
    const all = Object.values(WILD_CHEST_LOOT_TABLES).flatMap(table=>table.entries);
    const tome = all.find(e => e.id === id + '-tome');
    const scroll = all.find(e => e.id === id + '-scroll');
    assert.ok(scroll.weight > tome.weight);
    assert.ok(ITEMS[tome.id] && ITEMS[scroll.id]);
  }
});

test('all tomes share the cooldown of the spell used, including across saves', () => {
  const game = createGame();
  game.inventory.hotbar[0] = { id: 'firebolt-tome', count: 1 };
  game.inventory.hotbar[1] = { id: 'frost-lance-tome', count: 1 };
  const cast = slot => useWeapon(game, slot, game.player.x + 100, game.player.y + 8);
  assert.equal(cast(0).handled, true);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.inventory.hotbar[0].count, 1);
  assert.equal(spellCooldown(game, SPELL_ITEMS['firebolt-tome']), 8);
  assert.equal(spellCooldown(game, SPELL_ITEMS['frost-lance-tome']), 8);
  assert.equal(spellCooldown(game, SPELL_ITEMS['mend-tome']), 8);
  assert.match(cast(1).message, /recharging/);
  assert.equal(game.projectiles.length, 1);
  game.elapsed += 3;
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(spellCooldown(restored, SPELL_ITEMS['firebolt-tome']), 5);
  assert.equal(spellCooldown(restored, SPELL_ITEMS['mend-tome']), 5);
  game.elapsed += 5;
  cast(1);
  assert.equal(game.projectiles.length, 2);
  assert.equal(spellCooldown(game, SPELL_ITEMS['firebolt-tome']), 10);
  assert.equal(spellCooldown(game, SPELL_ITEMS['mend-scroll']), 0);
});

test('scrolls consume one per cast and bypass tome cooldown; Mend does not waste at full health', () => {
  const game = createGame();
  game.inventory.hotbar[0] = { id: 'frost-lance-scroll', count: 2 };
  game.spellReadyAt['frost-lance'] = 99;
  const cast = slot => useWeapon(game, slot, game.player.x + 100, game.player.y + 8);
  cast(0);
  assert.equal(game.inventory.hotbar[0].count, 1);
  assert.equal(game.projectiles[0].root, 3);
  assert.equal(game.projectiles[0].pierce, 2);
  cast(0);
  assert.equal(game.inventory.hotbar[0], null);
  game.inventory.hotbar[1] = { id: 'mend-scroll', count: 1 };
  game.player.health = 100;
  cast(1);
  assert.equal(game.inventory.hotbar[1].count, 1);
  game.player.health = 60;
  cast(1);
  assert.equal(game.player.health, 80);
  assert.equal(game.inventory.hotbar[1], null);
});


test('Mend targets a wounded ally and each recipient pulse applies only once', async () => {
  const { receiveMends } = await import('../src/gameplay/spell-combat.js');
  const g=createGame(), p=g.player;
  g.inventory.hotbar[0]={id:'mend-tome',count:1};
  const ally={id:'ally',x:p.x,y:p.y,height:p.height,health:40};
  g.wayfarerPeers=[ally];p.health=60;
  useWeapon(g,0,ally.x,ally.y+ally.height/2);
  assert.equal(p.health,60);
  assert.equal(p.mendPulses[0].target,'ally');
  const receiver=createGame();
  Object.assign(receiver.player,{x:p.x,y:p.y,health:40});
  receiver.localPeerId='ally';receiver.wayfarerPeers=[{mendPulses:p.mendPulses}];
  receiveMends(receiver);receiveMends(receiver);
  assert.equal(receiver.player.health,60);
});
test('Tidal Pulse has an expanding shockwave and consumes its scroll', () => {
  const g=createGame();g.inventory.hotbar[0]={id:'tidal-pulse-scroll',count:1};
  useWeapon(g,0,g.player.x+10,g.player.y);
  assert.equal(g.inventory.hotbar[0],null);
  assert.ok(g.projectiles.some(p=>p.spellFx==='tidal-pulse'&&p.radius===56));
});
