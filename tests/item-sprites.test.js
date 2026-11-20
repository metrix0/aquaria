import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ITEMS, EQUIPMENT_ITEMS } from '../src/inventory.js';
import { ITEM_ICON_IDS } from '../src/art/items/manifest.js';

test('every non-pickaxe inventory item and equipment piece has a unique transparent 24px PNG sprite', () => {
  const all = { ...ITEMS, ...EQUIPMENT_ITEMS };
  const required = Object.entries(all)
    .filter(([, item]) => !item.pickaxe)
    .map(([id, item]) => item.icon ?? id);
  assert.equal(ITEM_ICON_IDS.size, required.length);
  for (const id of required) {
    assert.ok(ITEM_ICON_IDS.has(id), 'missing sprite manifest entry: ' + id);
    const file = new URL('../src/art/items/' + id + '.png', import.meta.url);
    const png = readFileSync(file);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', id + ' should be a PNG');
    assert.equal(png.readUInt32BE(16), 24, id + ' should be 24px wide');
    assert.equal(png.readUInt32BE(20), 24, id + ' should be 24px tall');
    assert.equal(png[25], 6, id + ' should use RGBA transparency');
  }
});
