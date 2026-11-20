import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/gameplay/simulation.js';
import { createRenderer } from '../src/render.js';
import { SPAWN_CATEGORIES, spawnEnemyNear } from '../src/gameplay/enemy-spawner.js';
import { damageMob, mobSpec } from '../src/gameplay/mobs.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';

const options = SPAWN_CATEGORIES.flatMap(group => group.entries.map(([id]) => id));

test('Spawn menu lists every hostile kind plus ambient wildlife', () => {
  const all = new Set(options);
  assert.equal(all.size, options.length, 'no duplicate entries');
  for (const kind of [
    'jellyfish', 'squid', 'shark', 'lionfish', 'reef-snapper', 'lanternfish', 'kraken',
    'spider', 'archer', 'miner', 'scorpion', 'hammer', 'mimic',
    'cannibal-spear', 'cannibal-bow', 'shaman', 'cave-frog', 'frog', 'worm',
    'ghost', 'ambient-ant', 'ambient-spider', 'ambient-bat',
  ]) assert.ok(all.has(kind), kind);
});

test('Can spawn every enemy near the player with real health and valid targets', () => {
  const game = createGame();
  const { world, player } = game;
  player.facing = 1;
  for (const kind of options) {
    const result = spawnEnemyNear(world, player, kind);
    assert.ok(result.mob, kind + ': ' + (result.error ?? 'missing mob'));
    const mob = result.mob;
    assert.ok(world.mobs.includes(mob));
    assert.ok(mobSpec(mob).maxHealth > 0);
    assert.equal(mob.health, mob.maxHealth);
    assert.equal(mob.respawn, 0);
    assert.equal(mob.homeX, mob.x);
    assert.equal(mob.homeY, mob.y);
    assert.equal(mob.testSpawn, true);
  }
  assert.equal(spawnEnemyNear(world, player, 'nonexistent').error, 'Unknown enemy.');
});

test('Spawns work in a cave, and killing a test enemy removes it without respawning', () => {
  const game = createGame();
  const { world, player } = game;
  player.x = (40 + WEST_EXTENSION) * TILE;
  player.y = 106 * TILE;
  const result = spawnEnemyNear(world, player, 'spider');
  assert.ok(result.mob, result.error);
  const mob = result.mob;
  const events = [];
  damageMob(world, mob, mob.health, 0, 20, events);
  assert.equal(mob.health, 0);
  assert.equal(world.mobs.includes(mob), false);
  assert.ok(events.length);
});

test('all spawned types can enter the normal gameplay update without errors', () => {
  const game = createGame();
  for (const kind of options) {
    const result = spawnEnemyNear(game.world, game.player, kind);
    assert.ok(result.mob, kind + ': ' + (result.error ?? 'missing'));
    for (let frame = 0; frame < 15; frame++) {
      assert.doesNotThrow(() => stepGame(game, { night: false }, 1 / 60), kind);
      game.effects.length = 0;
    }
    game.world.mobs = game.world.mobs.filter(mob => !mob.testSpawn);
  }
});

test('Spawned enemies actually paint sprites, not just exist in the world', () => {
  const oldPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const noop = () => {};
    const grad = { addColorStop: noop };
    for (const kind of options) {
      const game = createGame();
      const result = spawnEnemyNear(game.world, game.player, kind);
      assert.ok(result.mob, kind + ': ' + result.error);
      const mob = result.mob;
      game.world.mobs = [mob];
      let marks = 0;
      let active = false;
      const stack = [];
      const makeCtx = (track) => ({
        save() { if (track) stack.push(active); },
        restore() { if (track) active = stack.pop() ?? false; },
        translate(x, y) {
          if (track && x === Math.round(mob.x) && y === Math.round(mob.y)) active = true;
        },
        fillRect() { if (track && active) marks++; },
        fill() { if (track && active) marks++; },
        stroke() { if (track && active) marks++; },
        scale: noop, rotate: noop, setTransform: noop, beginPath: noop,
        closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        quadraticCurveTo: noop, rect: noop, strokeRect: noop,
        clip: noop, drawImage: noop,
        createLinearGradient: () => grad, createRadialGradient: () => grad,
      });
      const canvas = {
        width: 640, height: 360,
        ownerDocument: { createElement: () => ({
          width: 0, height: 0, getContext: () => makeCtx(false),
        }) },
        getContext: () => makeCtx(true),
      };
      createRenderer(canvas).draw({
        world: game.world, player: game.player, snorkel: null,
        camera: { x: mob.x - 160, y: mob.y - 90, width: 320, height: 180 },
        time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
        held: null, attack: null, hasArrow: false, playerArrows: [],
        targetMob: null, particles: [], reducedMotion: false,
        conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0, weatherSeed: 0, caveShadowsHidden: true,
        openChestId: null,
      });
      assert.ok(marks > 0, kind + ' had no visible sprite draw calls');
    }
  } finally {
    if (oldPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = oldPath2D;
  }
});
