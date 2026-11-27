import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ITEMS, EQUIPMENT_ITEMS, HOOKS } from '../src/inventory.js';
import { createGame } from '../src/gameplay/simulation.js';
import { createRenderer } from '../src/render.js';
import { TILE } from '../src/world/generation.js';
import { MATERIAL } from '../src/content.js';
import { ITEM_ICON_IDS } from '../src/art/items/manifest.js';

test('every non-block, non-pickaxe item and equipment piece has a unique transparent 24px PNG sprite', () => {
  const all = { ...ITEMS, ...EQUIPMENT_ITEMS };
  const required = Object.entries(all)
    .filter(([, item]) => !item.pickaxe && !item.spawnKind && (!item.block || item.block === MATERIAL.workbench || item.block === MATERIAL.fireplace || item.block === MATERIAL.cauldron))
    .map(([id, item]) => item.icon ?? id);
  assert.equal(ITEM_ICON_IDS.size, new Set(required).size);
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

test('each grappling hook tier has its own material PNG texture and distinct in-world colors', () => {
  const hookIds = Object.keys(HOOKS);
  const pngBytes = new Set();
  const colorSignatures = new Set();
  for (const id of hookIds) {
    assert.equal(HOOKS[id].icon, undefined, id + ' should resolve its own sprite texture');
    assert.ok(ITEM_ICON_IDS.has(id), 'missing manifest entry for ' + id);
    const png = readFileSync(new URL('../src/art/items/' + id + '.png', import.meta.url));
    pngBytes.add(png.toString('hex'));
    colorSignatures.add(HOOKS[id].colors.join(','));
  }
  assert.equal(pngBytes.size, hookIds.length, 'each hook tier must have distinct PNG pixel art');
  assert.equal(colorSignatures.size, hookIds.length, 'each hook tier must have distinct material colors');

  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} addPath() {} };
  try {
    const noop = () => {};
    const fills = [];
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill: noop, stroke: noop, translate: noop,
      fillStyle: '#000',
      fillRect(x, y, w, h) { fills.push(this.fillStyle); },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    });
    const canvas = {
      width: 320,
      height: 180,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    const game = createGame();
    for (const id of hookIds) {
      fills.length = 0;
      const hook = {
        state: 'latched',
        x: game.player.x + 3 * TILE,
        y: game.player.y - TILE,
        angle: 0,
        colors: HOOKS[id].colors,
      };
      renderer.draw({
        world: game.world,
        player: game.player,
        snorkel: null,
        camera: { x: game.player.x - 120, y: game.player.y - 90, width: 320, height: 180 },
        time: 0,
        elapsed: 0,
        aim: null,
        mining: null,
        miningSwing: null,
        held: null,
        attack: null,
        hasArrow: false,
        playerArrows: [],
        hook,
        targetMob: null,
        particles: [],
        reducedMotion: false,
        conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0.25,
        weatherSeed: 0,
        caveShadowsHidden: true,
        openChestId: null,
      });
      assert.ok(fills.includes(HOOKS[id].colors[0]), `${id} renders primary material claw color`);
      assert.ok(fills.includes(HOOKS[id].colors[2]), `${id} renders material chain/line color`);
    }
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});
