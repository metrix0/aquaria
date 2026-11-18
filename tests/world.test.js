import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { COPPER_PICKAXE, MATERIAL } from '../src/content.js';
import { movePlayer, PLAYER_SIZE } from '../src/gameplay/player.js';
import { Inventory } from '../src/inventory.js';
import { advanceMining, applyTerrain, commitTileAction, createGame, craftItem, craftTank, stepGame, targetTile } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { CHUNK_SIZE, createWorld, editTile, inWater, tileAt, waterTileAt } from '../src/world.js';
import { COLS, ROWS, SPAWN, TILE, WATER, WATER_ROW, WEST_EXTENSION } from '../src/world/generation.js';

test('the deep rock layer preserves the existing cave and ore layout', () => {
  const world = createWorld();
  assert.equal(world.chunks.size, 0);
  const tiles = new Uint8Array(COLS * ROWS);
  let deepstone = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const material = tileAt(world, x, y);
      if (material === MATERIAL.deepstone) {
        assert.ok(y >= 80 && y < ROWS - 2);
        deepstone++;
      }
      tiles[y * COLS + x] = material === MATERIAL.deepstone ? MATERIAL.stone : material;
    }
  }
  assert.ok(deepstone > 0);
  assert.equal(createHash('sha256').update(tiles).digest('hex'), 'f83f2e0d24474c9d7bcaf3ad54241458c10846905409a635f58bc9b75a2ba772');
});

test('the selected pickaxe controls mining speed and unlocks deeper rock', () => {
  const game = createGame();
  const target = targetTile(game, SPAWN.x, SPAWN.y + TILE * 2);
  const { tx, ty } = target;
  editTile(game.world, tx, ty, MATERIAL.sand);
  assert.ok(advanceMining(game, target, null, 0.45, 2).progress >= 1);

  editTile(game.world, tx, ty, MATERIAL.stone);
  const byHand = advanceMining(game, target, null, 0.7, 2);
  assert.ok(byHand.progress < 0.25);
  assert.equal(advanceMining(game, target, byHand, 0.35, 0).progress, 0.5);

  for (const material of [MATERIAL.deepstone, MATERIAL.cobalt]) {
    editTile(game.world, tx, ty, material);
    assert.match(advanceMining(game, target, null, 10, 0).blocked, /requires a Copper pickaxe/);
    assert.equal(tileAt(game.world, tx, ty), material);
  }
  editTile(game.world, tx, ty, MATERIAL.copper);
  assert.match(advanceMining(game, target, null, 10, 2).blocked, /requires a pickaxe/);
  assert.ok(advanceMining(game, target, null, 0.85, 0).progress >= 1);

  assert.equal(craftItem(game, COPPER_PICKAXE), false);
  game.inventory.add('copper', 3);
  assert.equal(craftItem(game, COPPER_PICKAXE), true);
  assert.equal(game.inventory.count('copper'), 0);
  assert.equal(game.inventory.count('wood'), 1);
  assert.ok(game.inventory.move({ group: 'backpack', index: 0 }, { group: 'hotbar', index: 2 }));
  editTile(game.world, tx, ty, MATERIAL.deepstone);
  const mining = advanceMining(game, target, null, 1.7, 2);
  assert.ok(mining.progress >= 1);
  commitTileAction(game, mining.action);
  assert.equal(game.inventory.count('stone'), 1);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(tileAt(restored.world, tx, ty), MATERIAL.air);
  assert.equal(restored.inventory.hotbar[2].id, COPPER_PICKAXE.id);
});

test('legacy progress and edits on both sides of a chunk boundary migrate', () => {
  const legacy = {
    format: 1, x: SPAWN.x - WEST_EXTENSION * TILE, y: SPAWN.y, oxygen: 28, tank: true, completed: true,
    inventory: { wood: 11, sand: 3 },
    edits: [[32 * 224 + 2 * CHUNK_SIZE - WEST_EXTENSION - 1, 5], [32 * 224 + 2 * CHUNK_SIZE - WEST_EXTENSION, 0], null, [4, 6]],
    harvested: ['wreck-cache', 'missing-id'],
  };
  const game = createGame(decodeSave(legacy));
  const saved = encodeSave(game);
  assert.equal(saved.format, 3);
  assert.deepEqual(saved.world.edits, [[19, 32, 'wood'], [20, 32, 'air']]);
  assert.deepEqual(saved.world.harvested, ['wreck-cache']);
  assert.deepEqual(saved.progress, { 'air-tank': true });
  assert.equal(saved.player.oxygen, 28);
  assert.equal(new Inventory(saved.inventory).count('wood'), 11);
  assert.deepEqual(encodeSave(createGame(decodeSave(saved))), saved);
  assert.deepEqual(encodeSave(game, false).world.edits, []);
  assert.equal(decodeSave({ ...saved, world: { ...saved.world, generator: 999 } }), null);
});

test('edits applied before a chunk is loaded survive a later cache load', () => {
  const world = createWorld();
  assert.equal(editTile(world, 63, 11, MATERIAL.wood), true);
  assert.equal(world.chunks.size, 0);
  assert.equal(tileAt(world, 63, 11), MATERIAL.wood);
  assert.equal(tileAt(world, 64, 11), MATERIAL.air);
});

test('fixed-step simulation supports mining, jumping and crafting without a browser', () => {
  const game = createGame();
  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  stepGame(game, neutral, 1 / 60);
  assert.equal(game.player.grounded, true);
  stepGame(game, { ...neutral, jump: true }, 1 / 60);
  assert.ok(game.player.y < SPAWN.y);
  const target = targetTile(game, (61 + WEST_EXTENSION) * 16 + 8, 11 * 16 + 8);
  let mining = advanceMining(game, target, null, 0.1);
  assert.ok(mining.progress < 1);
  assert.equal(game.inventory.count('sand'), 0);
  mining = advanceMining(game, target, mining, 0.3);
  assert.ok(mining.progress >= 1);
  commitTileAction(game, mining.action);
  assert.equal(tileAt(game.world, target.tx, target.ty), MATERIAL.air);
  assert.equal(game.inventory.count('sand'), 1);
  game.inventory.add('stone', 3);
  game.inventory.add('kelp', 2);
  assert.equal(craftTank(game), true);
  assert.equal(game.player.oxygen, 42);
  assert.equal(craftTank(game), false);
});

test('harvested palms migrate from the previous save and stay removed on reload', () => {
  const migrated = createGame(decodeSave({ format: 1, harvested: ['palm-62'] }));
  assert.equal(migrated.world.harvested.has('palm-62'), true);

  const game = createGame();
  const target = targetTile(game, (62 + WEST_EXTENSION) * 16 + 8, 9 * 16 + 8);
  const mining = advanceMining(game, target, null, 0.5);
  assert.equal(mining.action.treeId, 'palm-62');
  assert.equal(mining.progress, 1);
  commitTileAction(game, mining.action);
  assert.equal(game.inventory.count('wood'), 6);
  assert.equal(advanceMining(game, target, null, 0.5), null);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.world.harvested.has('palm-62'), true);
  assert.equal(restored.inventory.count('wood'), 6);
});

test('the expanded-map save migrates western edits and ore inventory', () => {
  const saved = encodeSave(createGame(decodeSave({
    format: 2,
    x: 1016, y: 169, tank: true,
    inventory: { copper: 4, iron: 2 },
    edits: [[-10, 107, MATERIAL.air], [-9, 107, MATERIAL.iron]],
  })));
  assert.equal(saved.player.x, 1016);
  assert.equal(saved.world.generator, 2);
  assert.deepEqual(saved.world.edits, [[-10, 107, 'air'], [-9, 107, 'iron']]);
  assert.equal(new Inventory(saved.inventory).count('copper'), 4);
  assert.equal(new Inventory(saved.inventory).count('iron'), 2);
});

test('only the generated ocean and caverns supply water', () => {
  const world = createWorld();
  const shore = WEST_EXTENSION + 90;
  const shaft = WEST_EXTENSION + 63;
  const vent = world.vents.at(-1);
  assert.equal(waterTileAt(world, shore, WATER_ROW - 1), false);
  assert.equal(waterTileAt(world, shore, WATER_ROW), true);
  assert.equal(inWater(world, vent.x, vent.y - 18), true);

  editTile(world, shaft, WATER_ROW + 1, MATERIAL.air);
  assert.equal(tileAt(world, shaft, WATER_ROW + 1), MATERIAL.air);
  assert.equal(waterTileAt(world, shaft, WATER_ROW + 1), false);

  editTile(world, shore, WATER_ROW, MATERIAL.wood);
  assert.equal(waterTileAt(world, shore, WATER_ROW), false);
  editTile(world, shore, WATER_ROW, MATERIAL.air);
  assert.equal(waterTileAt(world, shore, WATER_ROW), true);
});

test('a saved shaft dug from the island remains breathable below sea level', () => {
  const x = 63;
  const edits = Array.from({ length: 19 }, (_, index) => [x, 11 + index, MATERIAL.air]);
  const snapshot = decodeSave({ format: 2, x: x * TILE + 8, y: 17 * TILE, oxygen: 9, edits });
  const game = createGame(snapshot);
  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  for (let i = 0; i < 120; i++) stepGame(game, neutral, 1 / 60);

  assert.ok(game.player.y > 28 * TILE);
  assert.equal(game.player.grounded, true);
  assert.equal(game.player.oxygen, 18);
  stepGame(game, { ...neutral, down: true }, 1 / 60);
  assert.equal(game.player.height, TILE);
});

test('crawling clears a one-block tunnel, survives a reload, and stands when there is room', () => {
  const game = createGame();
  const { world, player } = game;
  const start = Math.floor(player.x / TILE);
  const ground = (SPAWN.y + PLAYER_SIZE.height) / TILE;
  for (let x = start - 1; x <= start + 6; x++) {
    editTile(world, x, ground, MATERIAL.stone);
    editTile(world, x, ground - 1, MATERIAL.air);
    editTile(world, x, ground - 2, x > start && x <= start + 3 ? MATERIAL.stone : MATERIAL.air);
  }
  const right = { left: false, right: true, up: false, down: false, jump: false };
  for (let frame = 0; frame < 20; frame++) movePlayer(world, player, right, 1 / 60);
  assert.ok(player.x < (start + 1) * TILE);
  assert.equal(player.grounded, true);
  const feet = player.y + player.height;

  for (let frame = 0; frame < 30; frame++) movePlayer(world, player, { ...right, down: true }, 1 / 60);
  assert.equal(player.height, TILE);
  assert.ok(Math.abs(player.y + player.height - feet) < 0.01);
  assert.ok(player.x > (start + 1) * TILE);
  const tunnelTile = Math.floor(player.x / TILE);
  applyTerrain(game, tunnelTile, ground - 2, MATERIAL.wood);
  assert.equal(game.player, player);
  movePlayer(world, player, { ...right, right: false }, 1 / 60);
  assert.equal(player.height, TILE);

  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.player.height, TILE);
  assert.equal(restored.player.x, player.x);
  assert.equal(restored.player.y, player.y);
  for (let frame = 0; frame < 60; frame++) movePlayer(restored.world, restored.player, right, 1 / 60);
  assert.ok(restored.player.x > (start + 4) * TILE);
  assert.equal(restored.player.height, PLAYER_SIZE.height);
});

test('down still dives in water and exits the crawl posture when there is room', () => {
  const { world, player } = createGame();
  Object.assign(player, { x: (COLS - 4.5) * TILE, y: WATER + TILE, height: TILE, grounded: true });
  const depth = player.y + player.height;
  movePlayer(world, player, { left: false, right: false, up: false, down: true, jump: false }, 1 / 60);
  assert.equal(player.height, PLAYER_SIZE.height);
  assert.ok(player.y + player.height > depth);
  assert.ok(player.dy > 0);
});
