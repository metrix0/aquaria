import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { batHasAir, bugHasFloor, caveFaunaInView } from '../src/world/cave-ambience.js';
import { isDryIslandCave } from '../src/world/island-cave.js';
import { isDryJungleCave } from '../src/world/jungle-cave.js';

function cameraAt(column, row, width, height) {
  return { x: (column + WEST_EXTENSION) * TILE, y: row * TILE,
    width: width * TILE, height: height * TILE };
}

test('tiny cave wildlife is deterministic, passive and in dry, open caves', () => {
  const world = createWorld();
  const before = world.mobs.length;
  const islandView = cameraAt(-50, 40, 115, 200);
  const jungleView = cameraAt(323, 30, 90, 425);
  const island = caveFaunaInView(world, islandView);
  const jungle = caveFaunaInView(world, jungleView);
  const fauna = [...island, ...jungle];
  assert.ok(island.length > 0, 'island cave has passive wildlife');
  assert.ok(jungle.length > 0, 'jungle cave has passive wildlife');
  for (const kind of ['ant', 'tiny-spider', 'bat']) {
    assert.ok(fauna.some(creature => creature.kind === kind), `spawns ${kind}`);
  }
  for (const creature of fauna) {
    const tx = Math.floor(creature.x / TILE);
    const ty = Math.floor(creature.y / TILE);
    assert.ok(isDryIslandCave(tx - WEST_EXTENSION, ty) ||
      isDryJungleCave(tx - WEST_EXTENSION, ty), 'stays inside dry cave geometry');
    assert.ok(creature.kind === 'bat'
      ? batHasAir(world, creature.x, creature.y)
      : bugHasFloor(world, creature.x, creature.y), 'only stands/flies in accessible tiles');
  }
  assert.deepEqual(caveFaunaInView(world, islandView), island);
  assert.equal(world.mobs.length, before, 'decorations do not join hostile mob simulation');
  assert.deepEqual(caveFaunaInView(world, cameraAt(-50, 40, 200, 250)), [],
    'skip invisible wildlife at overview zoom');
});
