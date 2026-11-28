import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalSpawnHidden, updateEnemySpawns } from '../src/gameplay/enemies/enemy-fish.js';
import { WATER, TILE } from '../src/world/generation.js';
import { createGame } from '../src/gameplay/simulation.js';
import { stepMobs } from '../src/gameplay/mobs.js';
import { spawnEnemyNear } from '../src/gameplay/enemy-spawner.js';

test('natural fish spawn beyond the camera at different zoom levels', () => {
  const player = { x: 3000, y: WATER + 24 * TILE };
  for (const width of [300, 800, 2000]) {
    const camera = { x: player.x - width * .42, y: player.y - 200, width, height: 400 };
    const mobs = [];
    updateEnemySpawns({ spawnIn: 0 }, mobs, player, false, 1, () => false, camera);
    assert.equal(mobs.length, 1);
    assert.ok(naturalSpawnHidden(player, mobs[0].x, mobs[0].y, camera));
    assert.ok(Math.abs(mobs[0].x - player.x) >= 320);
  }
});

test('natural fish do not pop out on screen, and debug fish bypass spawn visibility', () => {
  const player = { x: 1000, y: WATER + 40 };
  const camera = { x: 600, y: WATER, width: 800, height: 400 };
  const visible = { enemyType: {name: 'Reef snapper'}, x: 1100, y: WATER + 40, remainingLife: .1 };
  const manual = { enemyType: {name: 'Lanternfish'}, testSpawn: true, x: 1010, y: WATER + 40, remainingLife: 600 };
  const mobs = [visible, manual];
  updateEnemySpawns({ spawnIn: 100 }, mobs, player, false, 1, () => true, camera);
  assert.deepEqual(mobs, [visible, manual]);
  const game = createGame();
  const result = spawnEnemyNear(game.world, game.player, 'fish');
  assert.ok(result.mob, result.error);
  assert.ok(result.mob.testSpawn);
  assert.ok(game.world.mobs.includes(result.mob));
});

test('resident mob respawn waits until its home is out of sight', () => {
  const game = createGame();
  const fish = game.world.mobs.find(m => m.kind === 'fish' && !m.schoolId);
  game.world.mobs = [fish];
  Object.assign(fish, { health: 0, respawn: .01 });
  Object.assign(game.player, { x: fish.homeX, y: fish.homeY, godMode: true });
  const camera = { x: fish.homeX - 200, y: fish.homeY - 200, width: 400, height: 400 };
  stepMobs(game.world, game.player, .1, 0, false, false, game.enemies, [], camera);
  assert.equal(fish.health, 0);
  assert.ok(fish.respawn > 0);
  game.player.x += 1000;
  camera.x += 1000;
  stepMobs(game.world, game.player, .2, 1, false, false, game.enemies, [], camera);
  assert.equal(fish.health, fish.maxHealth);
  assert.equal(fish.respawn, 0);
});
