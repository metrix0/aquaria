import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL } from '../src/content.js';
import { createWorld, tileAt, waterTileAt } from '../src/world.js';
import { createGame, nearestItem } from '../src/gameplay/simulation.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { WEST_EXTENSION, groundAt, KRAKEN_COLUMN, JUNGLE_FADE_START_COLUMN, TILE } from '../src/world/generation.js';
import { MERMAIDS, CORAL_RUINS, CORAL_DIALS, CORAL_SOLUTION, CORAL_COLUMN, coralWallBounds, coralWallColumn, CORAL_OPEN_ID, EAST_SHIFT, WEST_GROWTH, cycleCoralMark, coralMarksFor } from '../src/world/ocean-layout.js';

test('western ruins and reachable dials replace the mermaid puzzle and unlock the coral permanently', () => {
  const game = createGame();
  const { world } = game;
  const wall = CORAL_COLUMN + WEST_EXTENSION;
  for (const m of MERMAIDS) assert.equal(waterTileAt(world, m.column + WEST_EXTENSION, m.row), true);
  for (const y of [0, 16, 40, 80, 200, 500]) assert.equal(tileAt(world, wall, y), MATERIAL.bedrock);
  const widths = [];
  for (let row = 0; row <= 110; row++) {
    const [west, east] = coralWallBounds(row);
    widths.push(east - west + 1);
    assert.ok(coralWallColumn(CORAL_COLUMN, row));
    assert.ok(east < CORAL_DIALS[0].column);
    for (const column of [west, east]) {
      assert.equal(tileAt(world, column + WEST_EXTENSION, row), MATERIAL.bedrock);
      assert.equal(waterTileAt(world, column + WEST_EXTENSION, row), false);
    }
  }
  assert.ok(Math.min(...widths) >= 17 && Math.max(...widths) <= 30);
  assert.ok(Math.max(...widths) - Math.min(...widths) >= 4);
  const ruins = world.items.filter(item => item.kind === 'coral-ruin');
  const dials = world.items.filter(item => item.kind === 'coral-dial');
  assert.equal(ruins.length, CORAL_RUINS.length);
  assert.equal(dials.length, CORAL_DIALS.length);
  assert.deepEqual(ruins.filter(item => item.mark).map(item => item.mark), CORAL_SOLUTION);
  assert.equal(CORAL_SOLUTION.length, 4);
  for (const item of [...ruins, ...dials]) {
    assert.equal(waterTileAt(world, Math.floor(item.x / TILE), Math.floor(item.y / TILE)), true, item.id);
    if (item.kind === 'coral-dial') {
      game.player.x = item.x;
      game.player.y = item.y - Math.ceil(game.player.height / 2);
      assert.equal(nearestItem(game)?.id, item.id);
    }
  }
  cycleCoralMark(world, 0);
  assert.equal(world.harvested.has(CORAL_OPEN_ID), false);
  const partial = createGame(decodeSave(encodeSave(game)));
  assert.deepEqual(coralMarksFor(partial.world), [1, 0, 0, 0]);
  for (let slot = 0; slot < CORAL_SOLUTION.length; slot++) {
    while (coralMarksFor(world)[slot] !== CORAL_SOLUTION[slot]) cycleCoralMark(world, slot);
  }
  assert.ok(world.harvested.has(CORAL_OPEN_ID));
  assert.equal(waterTileAt(world, wall, 40), true);
  for (const column of coralWallBounds(40)) assert.equal(waterTileAt(world, column + WEST_EXTENSION, 40), true);
  const loaded = createGame(decodeSave(encodeSave(game)));
  assert.equal(waterTileAt(loaded.world, wall, 40), true);
  assert.deepEqual(coralMarksFor(loaded.world), CORAL_SOLUTION);
  assert.equal(cycleCoralMark(loaded.world, 0), false);
});

test('seabed is solid in the removed cave belts and the Kraken occupies deep water before the jungle', () => {
  const world = createWorld();
  for (const x of [-95, -80, -65, 185, 195, 205, 220]) {
    const tx = x + WEST_EXTENSION;
    for (let y = groundAt(tx) + 1; y < 175; y++) assert.notEqual(tileAt(world, tx, y), MATERIAL.air, `${x},${y}`);
  }
  assert.ok(WEST_GROWTH >= 3 * 128);
  assert.ok(JUNGLE_FADE_START_COLUMN - 150 >= 3 * (224 + 128 - 150));
  assert.equal(KRAKEN_COLUMN, (150 + JUNGLE_FADE_START_COLUMN) / 2);
  assert.ok(EAST_SHIFT >= 3 * 128);
  const kraken = world.mobs.find(m => m.kind === 'kraken');
  assert.equal(kraken.x, (KRAKEN_COLUMN + WEST_EXTENSION) * TILE);
  assert.ok(groundAt(Math.floor(kraken.x / TILE)) > 85);
  assert.ok(kraken.x < (JUNGLE_FADE_START_COLUMN + WEST_EXTENSION) * TILE);
});
