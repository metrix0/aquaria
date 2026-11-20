import assert from 'node:assert/strict';
import test from 'node:test';
import { firstCaveRockVariant, undergroundRockVariant, WEST_EXTENSION } from '../src/world/generation.js';
import { ISLAND_DEEPSTONE_ROW } from '../src/world/island-cave.js';

test('first cave geology is stable, localized, and mostly stone', () => {
  const counts = { stone: 0, slate: 0, gravel: 0, earth: 0 };
  for (let column = -51; column <= 177; column += 1) {
    for (let row = 30; row < ISLAND_DEEPSTONE_ROW - 30; row += 1) {
      const x = column + WEST_EXTENSION;
      const variant = firstCaveRockVariant(x, row);
      assert.equal(firstCaveRockVariant(x, row), variant);
      if (variant !== null) counts[variant]++;
    }
  }
  assert.ok(counts.stone > counts.slate + counts.earth);
  assert.ok(counts.gravel > 200);
  assert.ok(counts.slate > 200);
  assert.ok(counts.earth > 20 && counts.earth < counts.stone * 0.12, 'earth should be sporadic');
  assert.equal(firstCaveRockVariant(WEST_EXTENSION + 400, 80), null);
  assert.equal(firstCaveRockVariant(WEST_EXTENSION + 56, ISLAND_DEEPSTONE_ROW), null);
  assert.equal(firstCaveRockVariant(WEST_EXTENSION + 56, 12), null);
});

test('underground textures stay deep, subtle and deterministic', () => {
  const counts = { stone: 0, shale: 0, strata: 0 };
  for (let column = -51; column <= 177; column++) {
    for (let row = ISLAND_DEEPSTONE_ROW + 30; row < ISLAND_DEEPSTONE_ROW + 215; row++) {
      const x = column + WEST_EXTENSION;
      const variant = undergroundRockVariant(x, row);
      assert.equal(undergroundRockVariant(x, row), variant);
      counts[variant ?? 'stone']++;
    }
  }
  assert.ok(counts.stone > counts.shale + counts.strata,
    'original deepstone should remain the most common texture');
  assert.ok(counts.shale > 100);
  assert.ok(counts.strata > 100);
  assert.equal(undergroundRockVariant(WEST_EXTENSION + 56, ISLAND_DEEPSTONE_ROW + 29), null);
  assert.equal(undergroundRockVariant(WEST_EXTENSION + 400, ISLAND_DEEPSTONE_ROW + 80), null);
  assert.equal(undergroundRockVariant(WEST_EXTENSION + 56, 40), null);
});
