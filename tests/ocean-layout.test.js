import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL } from '../src/content.js';
import { createWorld, tileAt, waterTileAt } from '../src/world.js';
import { createGame } from '../src/gameplay/simulation.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { WEST_EXTENSION, groundAt, KRAKEN_COLUMN, JUNGLE_FADE_START_COLUMN, TILE } from '../src/world/generation.js';
import { MERMAIDS, MERMAID_SONG, CORAL_COLUMN, CORAL_OPEN_ID, EAST_SHIFT, WEST_GROWTH, singWithMermaid } from '../src/world/ocean-layout.js';

test('western expansion has three reachable mermaids and an impassable coral wall that opens permanently', () => {
  const game = createGame();
  const { world } = game;
  const wall = CORAL_COLUMN + WEST_EXTENSION;
  for (const m of MERMAIDS) assert.equal(waterTileAt(world, m.column + WEST_EXTENSION, m.row), true);
  for (const y of [0, 16, 40, 80, 200, 500]) assert.equal(tileAt(world, wall, y), MATERIAL.bedrock);
  singWithMermaid(world, MERMAID_SONG[1]);
  assert.equal(world.coralSongProgress, 0);
  for (const id of MERMAID_SONG) singWithMermaid(world, id);
  assert.ok(world.harvested.has(CORAL_OPEN_ID));
  assert.equal(waterTileAt(world, wall, 40), true);
  const loaded = createGame(decodeSave(encodeSave(game)));
  assert.equal(waterTileAt(loaded.world, wall, 40), true);
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
