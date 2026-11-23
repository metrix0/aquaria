import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ITEMS, EQUIPMENT_ITEMS } from '../src/inventory.js';
import { MATERIAL } from '../src/content.js';
import { ITEM_ICON_IDS } from '../src/art/items/manifest.js';

test('every non-block, non-pickaxe item and equipment piece has a unique transparent 24px PNG sprite', () => {
  const all = { ...ITEMS, ...EQUIPMENT_ITEMS };
  const required = Object.entries(all)
    .filter(([, item]) => !item.pickaxe && (!item.block || item.block === MATERIAL.workbench || item.block === MATERIAL.fireplace))
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


test('placeable terrain cubes keep the original block icons instead of PNG sprites', () => {
  for (const id of ['sand', 'stone', 'wood']) {
    assert.ok(ITEMS[id].block, id + ' must be placeable');
    assert.ok(!ITEM_ICON_IDS.has(id), id + ' must not use a PNG item sprite');
  }
  assert.ok(ITEM_ICON_IDS.has('workbench'), 'placeable workbench is not a cube');
  assert.ok(ITEM_ICON_IDS.has('copper'), 'ores are resources, not placeable cubes');
});

test('off-hand E action renders the same grappling-hook sprite as inventory', () => {
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="use-hook" class="slot hook-skill"'));
  assert.ok(ui.includes("import { createInventoryUi, setItemIcon } from './inventory-ui.js';"));
  assert.ok(ui.includes("setItemIcon(hookSlot.querySelector('span'), GRAPPLING_HOOK.id);"));
  assert.ok(ITEM_ICON_IDS.has('grappling-hook'));
});
