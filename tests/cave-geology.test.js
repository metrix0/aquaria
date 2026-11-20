import assert from 'node:assert/strict';
import test from 'node:test';
import { firstCaveRockVariant, WEST_EXTENSION } from '../src/world/generation.js';
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
