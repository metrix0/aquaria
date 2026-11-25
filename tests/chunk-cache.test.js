import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, createWorld, editTile, tileAt } from '../src/world.js';
import { MATERIAL } from '../src/content.js';
import { COLS, ROWS } from '../src/world/generation.js';

test('terrain chunks survive distant enemy and camera lookups without regeneration', () => {
  const world = createWorld();
  tileAt(world, 0, 0);
  const first = world.chunks.get('0,0');
  editTile(world, 0, 0, MATERIAL.wood);
  for (let y = 0; y < ROWS; y += CHUNK_SIZE)
    for (let x = 0; x < COLS; x += CHUNK_SIZE)
      tileAt(world, x, y);
  assert.equal(world.chunks.size, Math.ceil(COLS / CHUNK_SIZE) * Math.ceil(ROWS / CHUNK_SIZE));
  assert.equal(tileAt(world, 0, 0), MATERIAL.wood);
  assert.equal(world.chunks.get('0,0'), first);
  assert.notEqual(tileAt(createWorld(), 0, 0), MATERIAL.wood);
});
