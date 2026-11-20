import assert from 'node:assert/strict';
import test from 'node:test';
import { WEATHER_MODES, worldConditions } from '../src/environment.js';
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

test('weather mode presets override natural cycle cleanly while auto preserves dynamic conditions', () => {
  assert.deepEqual(worldConditions(150, 7, 'auto'), worldConditions(150, 7));

  const day = worldConditions(900, 7, 'day');
  assert.deepEqual(day, { night: false, skyProgress: .5, darkness: 0, rain: 0, rainSlope: 0 });

  const dusk = worldConditions(100, 7, 'dusk');
  assert.equal(dusk.night, false);
  assert.ok(dusk.darkness > 0 && dusk.darkness < 1 && dusk.skyProgress > .9);

  const night = worldConditions(100, 7, 'night');
  assert.deepEqual(night, { night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0 });

  const dawn = worldConditions(900, 7, 'dawn');
  assert.equal(dawn.night, false);
  assert.ok(dawn.skyProgress < .1 && dawn.rain === 0);

  const rain = worldConditions(900, 7, 'rain');
  assert.equal(rain.night, false);
  assert.equal(rain.rain, 1);
  assert.ok(rain.rainSlope !== 0);

  const storm = worldConditions(100, 7, 'storm');
  assert.equal(storm.night, true);
  assert.equal(storm.darkness, 1);
  assert.equal(storm.rain, 1);
  assert.ok(storm.rainSlope !== 0);

  assert.equal(WEATHER_MODES[0].id, 'auto');
  assert.ok(WEATHER_MODES.length >= 6);
});
