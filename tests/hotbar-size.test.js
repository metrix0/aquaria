import test from 'node:test';
import assert from 'node:assert/strict';
import { HOTBAR_SIZE, Inventory } from '../src/inventory.js';

test('the hotbar has six selectable slots, including migrated four-slot saves', () => {
  assert.equal(HOTBAR_SIZE, 6);
  const saved = {
    hotbar: [null, { id: 'sand', count: 2 }, { id: 'stone', count: 3 }, { id: 'wood', count: 4 }],
    backpack: Array.from({ length: 24 }, () => null),
  };
  const inventory = new Inventory(saved);
  assert.equal(inventory.hotbar.length, 6);
  assert.deepEqual(inventory.hotbar.slice(0, 4), saved.hotbar);
  assert.deepEqual(inventory.hotbar.slice(4), [null, null]);
  assert.equal(inventory.add('kelp', 1, { preferHotbar: true }), true);
  assert.equal(inventory.hotbar[0].id, 'kelp');
});

test('new inventories have six slots', () => {
  const inventory = new Inventory();
  assert.equal(inventory.hotbar.length, HOTBAR_SIZE);
  assert.equal(inventory.hotbar[5], null);
});
