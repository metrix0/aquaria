import assert from 'node:assert/strict';
import test from 'node:test';
import { stepKraken } from '../src/gameplay/enemies/kraken.js';
import { stepSquid } from '../src/gameplay/enemies/squid.js';
import { createGame } from '../src/gameplay/simulation.js';
import { createRenderer } from '../src/render.js';
import { TILE, WATER } from '../src/world/generation.js';

test('kraken-summoned squids render red, track the player while kraken engages, and attack 1.5x faster', () => {
  const game = createGame();
  const { world, player } = game;
  const kraken = world.mobs.find((m) => m.kind === 'kraken');
  assert.ok(kraken, 'expected kraken mob');

  const barrierX = kraken.x - 38;
  Object.assign(player, {
    x: barrierX - 90,
    y: WATER + 10 * TILE,
    dx: 0,
    dy: 0,
    hurt: 0,
    health: 100,
    flightOrigin: null,
  });

  // Trigger Kraken summon attack.
  world.mobs = [kraken];
  kraken.attackMode = 'idle';
  kraken.windup = 0;
  kraken.actionTime = 0;
  kraken.attackTimer = 0;
  kraken.attackIndex = 1;
  for (let i = 0; i < 45; i++) stepKraken(world, player, kraken, 1 / 60, i / 60, game.effects);

  const redSquids = world.mobs.filter((m) => m.krakenMinion && m.kind === 'squid');
  assert.equal(redSquids.length, 3, 'kraken summons three red squids');

  // 1. Constant tracking beyond normal squid range (dist > 175) while Kraken acknowledges player.
  const red = redSquids[0];
  red.x = kraken.x - 380;
  red.y = WATER + 10 * TILE;
  red.homeX = red.x;
  red.homeY = red.y;
  red.dx = 0;
  red.dy = 0;
  red.cooldown = 0;
  red.windup = 0;
  player.x = kraken.x - 120;
  player.y = WATER + 10 * TILE;
  stepKraken(world, player, kraken, 1 / 60, 1, game.effects);
  assert.equal(kraken.engaged, true, 'kraken acknowledges player presence within 420px');

  const ctx = { px: player.x, py: player.y + 11, dist: Math.hypot(player.x - red.x, player.y + 11 - red.y), playerInWater: true };
  assert.ok(ctx.dist > 175, 'distance exceeds normal squid aggro range');
  stepSquid(world, player, red, 0.1, 1.1, game.effects, ctx);
  assert.ok(red.dx > 0 && red.facing === 1, 'red squid keeps tracking distant player while boss is engaged');

  // 2. Compare attack cadence: red squid attacks 1.5x faster than normal squid.
  const normal = { ...red, id: 'normal-squid', krakenMinion: false, bossId: undefined, phase: 0, attackTimer: 0, windup: 0, cooldown: 0 };
  const minion = { ...red, id: 'minion-squid', krakenMinion: true, phase: 0, attackTimer: 0, windup: 0, cooldown: 0 };
  const closeCtx = { px: red.x + 80, py: red.y, dist: 80, playerInWater: true };

  // Enter windup on both.
  stepSquid(world, player, normal, 0.01, 2, game.effects, closeCtx);
  stepSquid(world, player, minion, 0.01, 2, game.effects, closeCtx);
  assert.ok(Math.abs(normal.windup - 0.42) < 1e-6);
  assert.ok(Math.abs(minion.windup - 0.42 / 1.5) < 1e-6, 'red squid windup is 1.5x faster');

  // Finish windup to fire and verify post-attack cooldown is 1.5x shorter.
  world.projectiles = [];
  stepSquid(world, player, normal, 0.45, 2.5, game.effects, closeCtx);
  stepSquid(world, player, minion, 0.45, 2.5, game.effects, closeCtx);
  assert.ok(Math.abs(normal.attackTimer - 2.8) < 1e-6);
  assert.ok(Math.abs(minion.attackTimer - 2.8 / 1.5) < 1e-6, 'red squid cooldown is 1.5x faster');

  // 3. Renderer paints kraken-summoned squids red (#c4343c / #87232c) vs normal purple (#b0667d / #7e4268).
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} addPath() {} };
  try {
    const fills = [];
    const noop = () => {};
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, translate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      putImageData: noop, stroke: noop,
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      fill() { fills.push(this.fillStyle); },
      fillRect() { fills.push(this.fillStyle); },
      clearRect: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    });
    const canvas = {
      width: 240,
      height: 160,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    const drawMob = (mob) => {
      fills.length = 0;
      world.mobs = [mob];
      renderer.draw({
        world,
        player,
        snorkel: null,
        camera: { x: mob.x - 120, y: mob.y - 80, width: 240, height: 160 },
        time: 1,
        elapsed: 1,
        aim: null,
        mining: null,
        miningSwing: null,
        held: null,
        attack: null,
        hasArrow: false,
        playerArrows: [],
        targetMob: null,
        particles: [],
        reducedMotion: false,
        conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0.25,
        weatherSeed: 0,
        caveShadowsHidden: true,
        openChestId: null,
      });
    };

    drawMob(minion);
    assert.ok(fills.includes('#c4343c') && fills.includes('#87232c'), 'kraken squid renders crimson red');
    assert.ok(!fills.includes('#b0667d'), 'kraken squid does not render purple');

    drawMob(normal);
    assert.ok(fills.includes('#b0667d') && fills.includes('#7e4268'), 'normal squid keeps purple palette');
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});
