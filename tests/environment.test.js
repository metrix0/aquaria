import assert from 'node:assert/strict';
import test from 'node:test';
import { worldConditions } from '../src/environment.js';
import { noise } from '../src/world/generation.js';

test('rain is less frequent and each storm keeps its seeded direction and angle', () => {
  const weatherWindow = 5 * 60;
  const seedCount = 24;
  const windowCount = 32;
  let storms = 0;
  const angles = new Set();

  for (let seed = 0; seed < seedCount; seed++) {
    for (let window = 0; window < windowCount; window++) {
      const start = window * weatherWindow + 90 + noise(window, 1, seed) * 125;
      const duration = 30 + noise(window, 2, seed) * 25;
      const early = worldConditions(start + 5, seed);
      const late = worldConditions(start + duration - 5, seed);
      assert.equal(late.rain, early.rain);
      assert.equal(late.rainSlope, early.rainSlope);
      assert.equal(worldConditions(start - 1, seed).rain, 0);
      assert.equal(worldConditions(start + duration + 1, seed).rain, 0);
      if (early.rain > 0) {
        assert.equal(early.rain, 1);
        assert.ok(Math.abs(early.rainSlope) >= .12 && Math.abs(early.rainSlope) <= .60);
        angles.add(early.rainSlope);
        storms++;
      } else {
        assert.equal(early.rainSlope, 0);
      }
    }
  }

  const fraction = storms / (seedCount * windowCount);
  assert.ok(fraction > .7 && fraction < .8);
  assert.ok([...angles].some((slope) => slope < 0));
  assert.ok([...angles].some((slope) => slope > 0));
  assert.ok(angles.size > 2);
});
