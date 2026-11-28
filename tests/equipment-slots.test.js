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

// Exercise the actual slot registration and hover handlers without a browser.
test('all equipped slots and their labels expose the shared item tooltip', async () => {
  const { createInventoryUi } = await import('../src/inventory-ui.js');
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const rect = { left: 100, right: 135, top: 100, bottom: 135, height: 35 };
  function node(id = '') {
    const children = new Map();
    const listeners = new Map();
    const n = {
      id, dataset: {}, style: {}, hidden: true, open: true, offsetWidth: 100, offsetHeight: 50,
      addEventListener(type, fn) { listeners.set(type, fn); },
      emit(type, event) { listeners.get(type)?.(event); },
      querySelector(selector) { if (!children.has(selector)) children.set(selector, node(selector)); return children.get(selector); },
      append(...nodes) { for (const child of nodes) child.parentElement = n; },
      getBoundingClientRect: () => rect,
      matches: () => false, contains: () => true,
      toggleAttribute() {}, setAttribute() {}, removeAttribute() {},
      closest(selector) { return selector === '.gear-slots li' ? n.row ?? null : null; },
    };
    return n;
  }
  const panel = node('panel');
  panel.parentElement = node('game');
  const armor = panel.querySelector('#backpack-armor');
  armor.parentElement = node('armor-slot');
  armor.parentElement.row = node('armor-row');
  const equipped = {
    head: 'copper-snorkel', feet: 'diving-fin', ring: ROOT_RING.id, offhand: GRAPPLING_HOOK.id,
    'addon-head': 'parrot-pet', 'addon-hands': 'scrappers-gloves', 'addon-legs': 'padded-leg-wraps',
  };
  const groups = ['head', 'feet', 'ring', 'offhand', 'addon-head', 'addon-chest', 'addon-legs', 'addon-feet', 'addon-hands'];
  for (const group of groups) {
    const slot = panel.querySelector('#backpack-' + group + '-slot');
    slot.dataset.group = group;
    slot.dataset.index = '0';
    slot.row = node(group + '-row');
  }
  globalThis.document = { createElement: () => node(), getElementById: () => node(), documentElement: { clientWidth: 800, clientHeight: 600 } };
  globalThis.window = { addEventListener() {} };
  try {
    const get = group => equipped[group] ? { id: equipped[group] } : null;
    createInventoryUi(panel, {
      getInventory: () => ({ hotbar: [], backpack: [] }), getSnorkel: () => get('head'), getFeet: () => get('feet'),
      getRing: () => get('ring'), getOffhand: () => get('offhand'), getAddon: slot => get('addon-' + slot),
    });
    const tooltip = panel.querySelector('#inventory-tooltip');
    for (const group of groups) {
      const slot = panel.querySelector('#backpack-' + group + '-slot');
      slot.row.emit('pointerenter', { pointerType: 'mouse' });
      assert.equal(tooltip.hidden, !equipped[group], group);
      if (equipped[group]) assert.ok(tooltip.querySelector('strong').textContent, group);
      slot.row.emit('pointerleave', { pointerType: 'mouse' });
      assert.equal(tooltip.hidden, true, group);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
