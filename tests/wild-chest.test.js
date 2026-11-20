import assert from 'node:assert/strict';
import test from 'node:test';
import { CHEST_SIZE, MATERIAL } from '../src/content.js';
import { collectChest, createGame, moveInventoryStack } from '../src/gameplay/simulation.js';
import { ITEMS } from '../src/inventory.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { createWorld, tileAt, waterTileAt } from '../src/world.js';
import { isDryIslandCave, firstCaveWildChestSpots } from '../src/world/island-cave.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { createWildChest, rollWildChestLoot, WILD_CHEST_LOOT_TABLES } from '../src/world/wild-chest.js';

test('replaced and new wild chests occupy exposed ground in the first cave biome', () => {
  const world = createWorld();
  const wild = world.items.filter((item) => item.chestType === 'wild');
  assert.equal(wild.length, firstCaveWildChestSpots.length);
  assert.equal(wild.length, 12);
  assert.ok(world.items.some((item) => item.id === 'island-cave-cache'));
  assert.ok(world.items.some((item) => item.id === 'island-grove-relics'));
  for (const oldId of ['island-lift-lockbox', 'island-west-cache', 'island-east-cache',
    'island-east-provisions', 'island-west-provisions', 'island-deep-provisions', 'central-mine-cache']) {
    assert.equal(world.items.some((item) => item.id === oldId), false, oldId + ' should be replaced');
  }
  const ids = new Set();
  for (const chest of wild) {
    assert.equal(chest.kind, 'chest');
    assert.equal(chest.lootTable, 'first-cave');
    assert.equal(ids.has(chest.id), false);
    ids.add(chest.id);
    const tx = Math.floor(chest.x / TILE);
    const floor = Math.round((chest.y + 8) / TILE);
    assert.equal(isDryIslandCave(tx - WEST_EXTENSION, floor - 1), true, chest.id);
    for (const row of [floor - 1, floor - 2]) {
      assert.equal(tileAt(world, tx, row), MATERIAL.air, chest.id + ' has clear headroom');
      assert.equal(waterTileAt(world, tx, row), false, chest.id + ' is dry');
    }
    assert.notEqual(tileAt(world, tx, floor), MATERIAL.air, chest.id + ' rests on ground');
    for (const other of world.items) {
      if (other.id === chest.id || other.kind !== 'chest') continue;
      assert.ok(Math.hypot(other.x - chest.x, other.y - chest.y) >= 8 * TILE,
        chest.id + ' should not overlap another chest');
    }
  }
});

test('wild loot rolls weighted, nonduplicated item stacks and supports another loot table', () => {
  const chest = createWildChest({ id: 'test-wild', x: 80, y: 80 });
  assert.equal(chest.chestType, 'wild');
  const loot = rollWildChestLoot(chest, 2026);
  assert.deepEqual(loot, rollWildChestLoot(chest, 2026));
  assert.ok(loot.length >= WILD_CHEST_LOOT_TABLES['first-cave'].minDrops);
  assert.ok(loot.length <= WILD_CHEST_LOOT_TABLES['first-cave'].maxDrops);
  assert.equal(new Set(loot.map((stack) => stack.id)).size, loot.length);
  assert.ok(loot.every((stack) => Object.hasOwn(ITEMS, stack.id) && stack.count > 0));

  const custom = createWildChest({ id: 'future-biome', x: 100, y: 100, lootTable: 'future' });
  assert.deepEqual(rollWildChestLoot(custom, 21, {
    future: { minDrops: 1, maxDrops: 1, entries: [{ id: 'iron', weight: 1, min: 3, max: 3 }] },
  }), [{ id: 'iron', count: 3 }]);
  assert.throws(() => rollWildChestLoot(custom, 21), /Unknown wild chest loot table/);
});

test('wild chest contents survive saves, transfers and collection without rerolling', () => {
  const seededSnapshot = encodeSave(createGame());
  seededSnapshot.weatherSeed = 7421;
  delete seededSnapshot.world.chests;
  const game = createGame(decodeSave(seededSnapshot));
  const ids = game.world.items.filter((item) => item.chestType === 'wild').map((item) => item.id);
  const original = Object.fromEntries(ids.map((id) => [id, structuredClone(game.chests.get(id))]));
  for (const id of ids) {
    const slots = game.chests.get(id);
    assert.equal(slots.length, CHEST_SIZE);
    assert.ok(slots.filter(Boolean).length >= 2);
  }

  const sameWorld = createGame(decodeSave(seededSnapshot));
  for (const id of ids) assert.deepEqual(sameWorld.chests.get(id), original[id]);

  // Existing saves missing these new fixture IDs should acquire their initial loot.
  const oldSave = encodeSave(game);
  delete oldSave.world.chests[ids[0]];
  const upgraded = createGame(decodeSave(oldSave));
  assert.deepEqual(upgraded.chests.get(ids[0]), original[ids[0]]);

  const first = ids[0];
  assert.equal(moveInventoryStack(game, first, { group: 'chest', index: 0 }, { group: 'backpack', index: 5 }), true);
  const moved = structuredClone(game.chests.get(first));
  assert.equal(moved[0], null);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.deepEqual(restored.chests.get(first), moved);
  assert.deepEqual(restored.inventory.backpack[5], original[first][0]);
  assert.equal(collectChest(restored, first), true);
  assert.ok(restored.chests.get(first).every((stack) => stack === null));
  const collectedReload = createGame(decodeSave(encodeSave(restored)));
  assert.deepEqual(collectedReload.chests.get(first), Array(CHEST_SIZE).fill(null));
});
