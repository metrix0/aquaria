import assert from 'node:assert/strict';
import test from 'node:test';
import { MORNINGSTAR } from '../src/content.js';
import { drawCaveEnemy } from '../src/cave-enemy-art.js';
import { SPAWN_CATEGORIES, spawnEnemyNear } from '../src/gameplay/enemy-spawner.js';
import {
  MORNINGSTAR_COOLDOWN,
  MORNINGSTAR_FLAIL_DURATION,
  MORNINGSTAR_MAX_RANGE,
  MORNINGSTAR_WINDUP,
  armoredSkeletonSpec,
  stepArmoredSkeleton,
} from '../src/gameplay/enemies/armored-skeleton.js';
import { damageMob } from '../src/gameplay/mobs.js';
import { createGame, grantItem, stepGame, useWeapon } from '../src/gameplay/simulation.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { isDungeonMasonry } from '../src/world/island-cave.js';

test('morningstar armored skeleton spawns in deep dungeon and in Spawn menu', () => {
  const spawnIds = SPAWN_CATEGORIES.flatMap((c) => c.entries.map(([id]) => id));
  assert.ok(spawnIds.includes('armored-skeleton'), 'Spawn menu should include armored skeleton');

  const game = createGame();
  const placed = game.world.mobs.filter((m) => m.kind === 'armored-skeleton');
  assert.ok(placed.length >= 2, 'deep dungeon hosts armored skeletons');
  assert.ok(placed.some((m) => m.id === 'lower-armored'));
  assert.ok(placed.some((m) => m.id === 'vault-armored'));

  for (const mob of placed) {
    const col = Math.floor(mob.x / TILE) - WEST_EXTENSION;
    const row = Math.floor(mob.y / TILE);
    assert.ok(row >= 500, `${mob.id} must spawn in deep dungeon tiers`);
  }

  const spawned = spawnEnemyNear(game.world, game.player, 'armored-skeleton');
  assert.ok(spawned.mob, spawned.error);
  assert.equal(spawned.mob.health, armoredSkeletonSpec.maxHealth);
  assert.equal(spawned.mob.health, 12);
});

test('armored skeleton takes zero knockback and cannot be interrupted while swinging or flailing', () => {
  const game = createGame();
  const { world, player } = game;
  const mob = {
    kind: 'armored-skeleton',
    id: 'test-armored',
    x: 100,
    y: 200,
    homeX: 100,
    homeY: 200,
    dx: 0,
    dy: 0,
    facing: 1,
    grounded: true,
    health: 12,
    maxHealth: 12,
    attackTimer: 0,
    windup: 0,
    morningstarWindup: 0.2,
    flail: null,
  };
  world.mobs = [mob];

  // Hit with 250 knockback
  damageMob(world, mob, 3, 0, 250, game.effects);
  assert.equal(mob.dx, 0, 'zero horizontal knockback');
  assert.equal(mob.dy, 0, 'zero vertical knockback');
  assert.equal(mob.flee, 0, 'no fleeing');
  assert.equal(mob.morningstarWindup, 0.2, 'morningstar windup uninterrupted');

  mob.morningstarWindup = null;
  mob.flail = { progress: 0.4, angle: 0, facing: 1, hit: false };
  damageMob(world, mob, 2, Math.PI, 300, game.effects);
  assert.equal(mob.dx, 0);
  assert.equal(mob.dy, 0);
  assert.ok(mob.flail != null, 'flail throw uninterrupted by damage');
});

test('armored skeleton drops morningstar with 10% chance upon defeat', () => {
  const game = createGame();
  const { world } = game;

  // 1. Defeat with roll < 0.10 -> drops morningstar
  const mobA = {
    kind: 'armored-skeleton',
    id: 'test-drop-win',
    x: 150,
    y: 250,
    homeX: 150,
    homeY: 250,
    health: 2,
    maxHealth: 12,
  };
  world.mobs = [mobA];
  const winEffects = [];
  damageMob(world, mobA, 5, 0, 0, winEffects, { random: () => 0.05 });
  assert.equal(mobA.health, 0);
  const winDrop = winEffects.find((e) => e.drop);
  assert.ok(winDrop, 'should have dropped an item');
  assert.equal(winDrop.drop.id, MORNINGSTAR.id);
  assert.equal(winDrop.drop.count, 1);

  // 2. Defeat with roll >= 0.10 (e.g. 0.10, 0.50, 0.99) -> does NOT drop morningstar
  const mobB = {
    kind: 'armored-skeleton',
    id: 'test-drop-lose',
    x: 150,
    y: 250,
    homeX: 150,
    homeY: 250,
    health: 2,
    maxHealth: 12,
  };
  world.mobs = [mobB];
  const loseEffects = [];
  damageMob(world, mobB, 5, 0, 0, loseEffects, { random: () => 0.10 });
  assert.equal(mobB.health, 0);
  const loseDrop = loseEffects.find((e) => e.drop);
  assert.equal(loseDrop, undefined, 'must not drop morningstar at 0.10 or higher');

  // Edge check at 0.0999 -> drops
  const mobC = {
    kind: 'armored-skeleton',
    id: 'test-drop-edge',
    x: 150,
    y: 250,
    homeX: 150,
    homeY: 250,
    health: 2,
    maxHealth: 12,
  };
  world.mobs = [mobC];
  const edgeEffects = [];
  damageMob(world, mobC, 5, 0, 0, edgeEffects, { random: () => 0.099 });
  assert.equal(edgeEffects.find((e) => e.drop)?.drop.id, MORNINGSTAR.id);
});

test('morningstar weapon can be equipped in hotbar, swung by player, and hits enemies', () => {
  const game = createGame();
  const { world, player } = game;

  grantItem(game, MORNINGSTAR.id, 1);
  const slot = game.inventory.hotbar.findIndex((s) => s?.id === MORNINGSTAR.id);
  assert.ok(slot >= 0, 'morningstar added to hotbar');

  // Spawn enemy in front of player
  const target = {
    kind: 'spider',
    id: 'test-spider',
    x: player.x + 20,
    y: player.y + player.height / 2,
    homeX: player.x + 20,
    homeY: player.y + player.height / 2,
    health: 6,
    maxHealth: 6,
    dx: 0,
    dy: 0,
    grounded: true,
  };
  world.mobs = [target];

  const beforeHp = target.health;
  useWeapon(game, slot, target.x, target.y);
  assert.ok(game.attack != null, 'swing attack initiated');
  assert.equal(game.attack.kind, MORNINGSTAR.id);

  // Advance game simulation to register attack hit (swing reaches impact phase around frame 24)
  for (let i = 0; i < 30; i++) {
    stepGame(game, {}, 1 / 60);
    if (target.health < beforeHp) break;
  }
  assert.ok(target.health < beforeHp, 'target took damage from morningstar');
});

test('armored skeleton renders horned steel helm, chestplate, and morningstar flail/windup', () => {
  const fills = [];
  const rect = (x, y, w, h, color) => {
    fills.push({ x, y, w, h, color });
  };
  const polygon = (_pts, color) => {
    fills.push({ color, poly: true });
  };
  const ctx = {
    save() {},
    restore() {},
    scale() {},
    translate() {},
    rotate() {},
  };

  // Idle state
  const mob = {
    kind: 'armored-skeleton',
    facing: 1,
    dx: 0,
    dy: 0,
    phase: 0,
    flail: null,
    morningstarWindup: null,
  };
  drawCaveEnemy(ctx, rect, polygon, mob, 0);

  // Horns & iron armor
  assert.ok(fills.some((f) => f.color === '#d8cfb8'), 'renders bone horn');
  assert.ok(fills.some((f) => f.color === '#4f5866'), 'renders steel armor');
  assert.ok(fills.some((f) => f.color === '#ff7357'), 'renders glowing eyes');

  // Windup spin state
  fills.length = 0;
  mob.morningstarWindup = 0.3;
  drawCaveEnemy(ctx, rect, polygon, mob, 0);
  assert.ok(fills.some((f) => f.color === '#7a5438'), 'renders wooden morningstar haft');
  assert.ok(fills.some((f) => f.color === '#8f9cab' || f.color === '#5e6875'), 'renders spinning morningstar chain');

  // Flail throw state
  fills.length = 0;
  mob.morningstarWindup = null;
  mob.flail = { progress: 0.5, angle: 0, hit: false };
  drawCaveEnemy(ctx, rect, polygon, mob, 0);
  assert.ok(fills.some((f) => f.color === '#d8e0eb'), 'renders spiked ball highlights');
});
