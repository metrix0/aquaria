import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equipmentSlotForItem } from '../src/inventory-ui.js';
import { GRAPPLING_HOOK, ROOT_RING } from '../src/inventory.js';
import { equippedHook, hasHook } from '../src/gameplay/hook.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('one hands accessory, with the grappling hook off-hand in equipment', () => {
  const equipment = html.split('<h3 id="backpack-gear-label">Equipment</h3>')[1].split('</section>')[0];
  const accessories = html.split('<h3 id="backpack-accessories-label">Accessories</h3>')[1].split('</section>')[0];
  assert.match(equipment, /id="backpack-offhand-slot" data-group="offhand"/);
  assert.doesNotMatch(accessories, /id="backpack-offhand-slot"/);
  assert.equal((accessories.match(/data-group="addon-hands"/g) ?? []).length, 1);
  assert.equal((html.match(/data-group="hands"/g) ?? []).length, 0);
});

test('each item illuminates its compatible equipment slot', () => {
  assert.equal(equipmentSlotForItem('copper-snorkel'), 'head');
  assert.equal(equipmentSlotForItem('diving-fin'), 'feet');
  assert.equal(equipmentSlotForItem(ROOT_RING.id), 'ring');
  assert.equal(equipmentSlotForItem(GRAPPLING_HOOK.id), 'offhand');
  assert.equal(equipmentSlotForItem('scrappers-gloves'), 'addon-hands');
  assert.equal(equipmentSlotForItem('parrot-pet'), 'addon-head');
  assert.equal(equipmentSlotForItem('padded-leg-wraps'), 'addon-legs');
  assert.equal(equipmentSlotForItem('stone'), null);
  assert.match(css, /#backpack-panel button\.slot\[data-compatible\]/);
});

test('grappling hook is used from off-hand, including legacy save progress', () => {
  const equipped = { progress: { offhand: GRAPPLING_HOOK.id } };
  const stored = { progress: { offhand: null }, inventory: { count: () => 1 } };
  assert.equal(equippedHook(equipped)?.id, GRAPPLING_HOOK.id);
  assert.equal(hasHook(equipped)?.id, GRAPPLING_HOOK.id);
  assert.equal(hasHook(stored), null);
  assert.equal(equippedHook({ progress: { hands: GRAPPLING_HOOK.id } })?.id, GRAPPLING_HOOK.id);
});
