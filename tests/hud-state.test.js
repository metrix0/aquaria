import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_DEPTH_METERS, hudVisibility } from '../src/hud-state.js';

test('full oxygen stays hidden while health remains independent', () => {
  assert.deepEqual(hudVisibility(100, 100, 0), { oxygenPercent: 100, showOxygen: false, showDepth: false });
  assert.equal(hudVisibility(120, 120, 40).showOxygen, false);
});

test('any oxygen consumption reveals the meter, including fractional consumption', () => {
  assert.deepEqual(hudVisibility(99.99, 100, 0), { oxygenPercent: 99, showOxygen: true, showDepth: false });
  assert.deepEqual(hudVisibility(0, 100, 0), { oxygenPercent: 0, showOxygen: true, showDepth: false });
  assert.equal(hudVisibility(119, 120, 0).showOxygen, true);
});

test('depth only appears after descending sufficiently', () => {
  assert.equal(hudVisibility(100, 100, MIN_DEPTH_METERS - 1).showDepth, false);
  assert.equal(hudVisibility(100, 100, MIN_DEPTH_METERS).showDepth, true);
  assert.equal(hudVisibility(100, 100, MIN_DEPTH_METERS + 50).showDepth, true);
});
