import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL } from '../src/content.js';
import { ROOT_RING } from '../src/inventory.js';
import { ambientMobSpecs } from '../src/gameplay/ambient-fauna.js';
import { crabSpec } from '../src/gameplay/friends/crab.js';
import { fishSpec } from '../src/gameplay/friends/fish.js';
import { krakenSpec } from '../src/gameplay/enemies/kraken.js';
import { ROOT_BIND_DURATION, stepRootWave, useRootRing } from '../src/gameplay/root-ring.js';

function aimAt(kind, spec, overrides = {}) {
  const mob = {
    kind, x: 142, y: 122 - spec.centerY, health: spec.maxHealth, maxHealth: spec.maxHealth,
    rooted: 0, rootLift: 0, respawn: 0, dx: 0, dy: 0, facing: 1, grounded: false,
    ...overrides,
  };
  const world = {
    mobs: [mob], edits: new Map(), doors: new Map(),
    chunks: new Map([['0,0', {
      cx: 0, cy: 0, tiles: new Uint8Array(32 * 32).fill(MATERIAL.air),
    }]]),
  };
  const game = {
    player: { x: 80, y: 100, height: 32, facing: 1 },
    progress: { ring: ROOT_RING.id },
    elapsed: 0, rootReadyAt: 0, rootWave: null, world, effects: [],
  };
  assert.equal(useRootRing(game, mob.x, 122), true);
  for (let i = 0; i < 120 && !game.rootWave.finished; i++) stepRootWave(game, .016);
  return { mob, game };
}

for (const [kind, spec] of [
  ['fish', fishSpec], ['crab', crabSpec], ...Object.entries(ambientMobSpecs),
  ['kraken', krakenSpec],
]) {
  test('Root Ring affects living ' + kind + ' regardless of hostility or species', () => {
    const { mob, game } = aimAt(kind, spec);
    assert.equal(game.rootWave.target, mob);
    assert.equal(mob.rooted, ROOT_BIND_DURATION);
    assert.ok(mob.rootLift > 0);
    assert.equal(mob.health, spec.maxHealth, 'damage is delayed until after lift');

    // The normal mob physics update consumes rootLift.
    mob.rootLift = 0;
    for (let i = 0; i < 120 && game.rootWave; i++) stepRootWave(game, .016);
    assert.equal(mob.health, Math.max(0, spec.maxHealth - 3));
    assert.ok(game.effects.some((effect) => effect.message?.toLowerCase().includes(spec.name.toLowerCase())));
  });
}

test('Root Ring ignores dead and respawning mobs', () => {
  for (const state of [{ health: 0 }, { respawn: 2 }]) {
    const { mob, game } = aimAt('fish', fishSpec, state);
    assert.equal(game.rootWave.target, undefined);
    assert.equal(mob.rooted, 0);
  }
});
