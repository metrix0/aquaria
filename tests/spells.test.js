import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, useWeapon } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { ITEMS } from '../src/inventory.js';
import { SPELLS, SPELL_ITEMS, spellCooldown } from '../src/spells.js';
import { WILD_CHEST_LOOT_TABLES } from '../src/world/wild-chest.js';

test('all six spell items are chest drops with scrolls more common', () => {
  const entries = WILD_CHEST_LOOT_TABLES['first-cave'].entries;
  assert.equal(entries.reduce((sum, e) => sum + e.weight, 0), 100);
  for (const id of Object.keys(SPELLS)) {
    const tome = entries.find(e => e.id === id + '-tome');
    const scroll = entries.find(e => e.id === id + '-scroll');
    assert.ok(scroll.weight > tome.weight);
    assert.ok(ITEMS[tome.id] && ITEMS[scroll.id]);
  }
});

test('tomes retain their stack and share a cooldown across copies and saves', () => {
  const game = createGame();
  game.inventory.hotbar[0] = { id: 'firebolt-tome', count: 2 };
  game.inventory.hotbar[1] = { id: 'firebolt-tome', count: 1 };
  const cast = slot => useWeapon(game, slot, game.player.x + 100, game.player.y + 8);
  assert.equal(cast(0).handled, true);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.inventory.hotbar[0].count, 2);
  assert.equal(spellCooldown(game, SPELL_ITEMS['firebolt-tome']), 8);
  assert.match(cast(1).message, /recharging/);
  assert.equal(game.projectiles.length, 1);
  game.elapsed += 3;
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(spellCooldown(restored, SPELL_ITEMS['firebolt-tome']), 5);
  game.elapsed += 5;
  cast(1);
  assert.equal(game.projectiles.length, 2);
});

test('scrolls consume one per cast and bypass tome cooldown; Mend does not waste at full health', () => {
  const game = createGame();
  game.inventory.hotbar[0] = { id: 'frost-lance-scroll', count: 2 };
  game.spellReadyAt['frost-lance'] = 99;
  const cast = slot => useWeapon(game, slot, game.player.x + 100, game.player.y + 8);
  cast(0);
  assert.equal(game.inventory.hotbar[0].count, 1);
  assert.equal(game.projectiles[0].root, 2);
  cast(0);
  assert.equal(game.inventory.hotbar[0], null);
  game.inventory.hotbar[1] = { id: 'mend-scroll', count: 1 };
  game.player.health = 100;
  cast(1);
  assert.equal(game.inventory.hotbar[1].count, 1);
  game.player.health = 60;
  cast(1);
  assert.equal(game.player.health, 75);
  assert.equal(game.inventory.hotbar[1], null);
});
