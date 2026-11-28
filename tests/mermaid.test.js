import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL } from '../src/content.js';
import { createWorld } from '../src/world.js';
import { TILE } from '../src/world/generation.js';
import { mermaidCollides, mermaidSpec, stepMermaid } from '../src/gameplay/friends/mermaid.js';
import { mobSpec, syncMobs } from '../src/gameplay/mobs.js';

function pool() {
  const cols = 40, rows = 40;
  return { cols, rows, grid: new Uint8Array(cols * rows).fill(MATERIAL.air),
    flooded: new Uint8Array(cols * rows).fill(1) };
}
const makeMob = (x = 400, y = 400) => ({ kind: 'mermaid', x, y, facing: 1, flee: 0, dx: 0, dy: 0 });
const player = (x, y) => ({ x, y: y - 11.5, height: 23, width: 12 });

test('mermaids are passive mobs at their former fixture locations', () => {
  const world = createWorld();
  const mermaids = world.mobs.filter(mob => mob.kind === 'mermaid');
  assert.equal(mermaids.length, 3);
  assert.ok(!world.items.some(item => item.kind === 'mermaid'));
  syncMobs(world, player(0, 0));
  for (const mob of mermaids) {
    assert.equal(mobSpec(mob), mermaidSpec);
    assert.equal(mermaidCollides(world, null, mob.x, mob.y), false, mob.id);
  }
});

test('mermaids flee approaching players slightly faster than normal swimming', () => {
  for (const [x, y] of [[350, 400], [450, 400], [400, 350], [400, 450], [350, 350]]) {
    const mob = makeMob();
    const p = player(x, y);
    const oldDistance = Math.hypot(mob.x - x, mob.y - y);
    stepMermaid(pool(), p, mob, 1 / 60);
    assert.ok(Math.hypot(mob.x - x, mob.y - y) > oldDistance);
    assert.ok(Math.abs(mob.dx) > 102 || Math.abs(mob.dy) > 94);
  }
});

test('mermaids avoid solid or dry tiles and stay calm when no player is nearby', () => {
  const world = pool();
  const mob = makeMob();
  stepMermaid(world, player(100, 400), mob, 1 / 60);
  assert.equal(mob.x, 400);
  assert.equal(mob.y, 400);
  const wall = Math.floor((mob.x + 12) / TILE) + 1;
  for (let y = 0; y < world.rows; y++) world.grid[y * world.cols + wall] = MATERIAL.stone;
  for (let i = 0; i < 100; i++) {
    stepMermaid(world, player(mob.x - 40, mob.y), mob, 1 / 60);
    assert.equal(mermaidCollides(world, null, mob.x, mob.y), false);
    assert.ok(mob.x + 11 <= wall * TILE);
  }
});
