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
test('automatic additions skip an empty sixth slot but manual moves still work', () => {
  const inventory = new Inventory({
    hotbar: ['sand', 'stone', 'wood', 'copper', 'iron'].map(id => ({ id, count: 1 })),
    backpack: [],
  });
  assert.equal(inventory.add('kelp', 2, { preferHotbar: true }), true);
  assert.equal(inventory.hotbar[5], null);
  assert.deepEqual(inventory.backpack[0], { id: 'kelp', count: 2 });
  assert.equal(inventory.move({ group: 'backpack', index: 0 }, { group: 'hotbar', index: 5 }), true);
  assert.deepEqual(inventory.hotbar[5], { id: 'kelp', count: 2 });
  assert.equal(new Inventory(inventory).hotbar[5].id, 'kelp');
  assert.equal(inventory.add('kelp', 1), true);
  assert.equal(inventory.hotbar[5].count, 3);
});

test('a full backpack does not cause automatic placement into slot six', () => {
  const inventory = new Inventory({
    hotbar: ['sand', 'stone', 'wood', 'copper', 'iron'].map(id => ({ id, count: 1 })),
    backpack: Array.from({ length: 24 }, () => ({ id: 'wood', count: 1 })),
  });
  assert.equal(inventory.canAdd('kelp', 1), false);
  assert.equal(inventory.add('kelp', 1), false);
  assert.equal(inventory.add('kelp', 1, { preferHotbar: true }), false);
  assert.equal(inventory.hotbar[5], null);
});
