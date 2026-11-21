import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL } from '../src/content.js';
import { ROOT_RING } from '../src/inventory.js';
import { crabSpec } from '../src/gameplay/friends/crab.js';
import { ROOT_BIND_DURATION, stepRootWave, useRootRing } from '../src/gameplay/root-ring.js';

// Keep the beam's path clear without generating the full game world.
function clearWorld(crab) {
  const tiles = new Uint8Array(32 * 32).fill(MATERIAL.air);
  return {
    mobs: [crab],
    chunks: new Map([['0,0', { cx: 0, cy: 0, tiles }]]),
    edits: new Map(),
    doors: new Map(),
  };
}

test('Root Ring catches a crab and damages it only after the lifting squeeze', () => {
  const crab = {
    kind: 'crab', x: 142, y: 126,
    health: crabSpec.maxHealth, maxHealth: crabSpec.maxHealth,
    respawn: 0, rooted: 0, rootLift: 0,
    grounded: true, dx: 0, dy: 0, facing: 1,
  };
  const game = {
    player: { x: 80, y: 100, height: 32, facing: 1 },
    progress: { ring: ROOT_RING.id },
    elapsed: 0, rootReadyAt: 0, rootWave: null,
    world: clearWorld(crab), effects: [],
  };

  assert.equal(useRootRing(game, crab.x, crab.y + crabSpec.centerY), true);
  for (let step = 0; step < 120 && !game.rootWave.finished; step++) {
    stepRootWave(game, .016);
  }

  assert.equal(game.rootWave.target, crab, 'roots should collide with the crab');
  assert.equal(crab.rooted, ROOT_BIND_DURATION);
  assert.ok(crab.rootLift > 0, 'crab should be lifted by the roots');
  assert.equal(crab.health, crabSpec.maxHealth, 'no damage before the squeeze');

  // Physics resolves the lift in stepMobs; simulate that resolution here.
  crab.rootLift = 0;
  for (let step = 0; step < 120 && game.rootWave; step++) {
    stepRootWave(game, .016);
  }
  assert.equal(crab.health, Math.max(0, crabSpec.maxHealth - 3), 'squeeze should damage crab exactly once');
  assert.ok(game.effects.some((effect) => effect.message?.includes('crab')));
});
