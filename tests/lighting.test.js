import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { advanceMining, createGame, targetTile } from '../src/gameplay/simulation.js';
import { createWorld, editTile, hasOpenFace, waterTileAt } from '../src/world.js';
import { TILE, WATER_ROW } from '../src/world/generation.js';
import { createCaveLight } from '../src/world/lighting.js';

test('cave light follows open passages and reacts to terrain edits', () => {
  const world = createWorld();
  const light = createCaveLight();
  const column = 95;
  const row = 21;
  const player = { x: (column + .5) * TILE, y: row * TILE, height: TILE };
  for (let x = column - 2; x <= column + 5; x++) {
    for (let y = row - 2; y <= row + 2; y++) editTile(world, x, y, MATERIAL.stone);
  }
  for (const x of [column, column + 2, column + 3]) editTile(world, x, row, MATERIAL.air);
  editTile(world, column + 4, row, MATERIAL.iron);

  light.update(world, player);
  assert.equal(light.at(column, row), 1);
  assert.ok(light.at(column + 1, row) > 0);
  assert.equal(light.at(column + 2, row), 0);
  assert.equal(light.at(column + 4, row), 0);

  editTile(world, column + 1, row, MATERIAL.air);
  light.update(world, player);
  assert.ok(light.at(column + 2, row) > light.at(column + 4, row));
  assert.ok(light.at(column + 4, row) > 0);
  assert.ok(light.at(column + 4, row) > light.at(column + 5, row));
  assert.ok(light.at(column + 5, row) > 0);

  editTile(world, column + 1, row, MATERIAL.wood);
  light.update(world, player);
  assert.equal(light.at(column + 4, row), 0);
  assert.equal(light.at(column + 18, row), 0);
});

test('light fades over several rock tiles and follows the player within a tile', () => {
  const world = createWorld();
  const light = createCaveLight();
  const column = 100;
  const row = 24;
  const player = { x: (column + .5) * TILE, y: row * TILE, height: TILE };
  for (let x = column - 1; x <= column + 6; x++) {
    for (let y = row - 1; y <= row + 1; y++) editTile(world, x, y, MATERIAL.stone);
  }
  editTile(world, column, row, MATERIAL.air);
  light.update(world, player);
  for (let dx = 1; dx <= 4; dx++) {
    const brightness = light.at(column + dx, row);
    assert.ok(brightness > 0 && brightness < light.at(column + dx - 1, row));
  }
  assert.equal(light.at(column + 5, row), 0);

  for (let dx = 1; dx <= 13; dx++) editTile(world, column + dx, row, MATERIAL.air);
  light.update(world, player);
  const before = light.at(column + 7, row);
  player.x += TILE / 4;
  light.update(world, player);
  assert.ok(light.at(column + 7, row) > before);
  assert.ok(light.at(column + 13, row) > 0);
});

test('ore mining requires an open face, including naturally flooded space', () => {
  const game = createGame();
  const column = 230;
  const row = WATER_ROW + 2;
  const x = (column + .5) * TILE;
  const y = row * TILE;
  Object.assign(game.player, { x: x - 3 * TILE, y });
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    editTile(game.world, column + dx, row + dy, MATERIAL.stone);
  }
  editTile(game.world, column, row, MATERIAL.copper);
  const target = targetTile(game, x, y + TILE / 2);
  assert.equal(target.reachable, true);
  assert.equal(hasOpenFace(game.world, column, row, game.player), false);
  assert.equal(advanceMining(game, target, null, 1), null);

  editTile(game.world, column - 1, row, MATERIAL.air);
  assert.equal(waterTileAt(game.world, column - 1, row), true);
  assert.equal(hasOpenFace(game.world, column, row, game.player), true);
  assert.ok(advanceMining(game, target, null, 1).progress >= 1);
});
