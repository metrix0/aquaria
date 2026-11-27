import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { drawCaveEnemy } from '../src/cave-enemy-art.js';
import { SPAWN_CATEGORIES, spawnEnemyNear } from '../src/gameplay/enemy-spawner.js';
import {
  GREATSWORD_SWING_COUNT,
  GREATSWORD_SWING_DURATION,
  GREATSWORD_WINDUP,
  greatswordSkeletonSpec,
  stepGreatswordSkeleton,
} from '../src/gameplay/enemies/greatsword-skeleton.js';
import { damageMob } from '../src/gameplay/mobs.js';
import { createGame } from '../src/gameplay/simulation.js';
import { editTile } from '../src/world.js';
import { SPAWN, TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { isDungeonMasonry } from '../src/world/island-cave.js';

function makeDryLane(world, col, floorRow) {
  for (let x = col - 8; x <= col + 8; x++) {
    for (let y = floorRow - 6; y <= floorRow + 2; y++) {
      editTile(world, x, y, y >= floorRow ? MATERIAL.deepstone : MATERIAL.air);
    }
  }
}

test('greatsword skeleton variant spawns inside dungeon masonry and in Spawn menu', () => {
  const spawnIds = SPAWN_CATEGORIES.flatMap((c) => c.entries.map(([id]) => id));
  assert.ok(spawnIds.includes('greatsword'), 'Spawn menu should include greatsword skeleton');

  const game = createGame();
  const placed = game.world.mobs.filter((m) => m.kind === 'greatsword');
  assert.ok(placed.length >= 1, 'at least one greatsword skeleton spawns in dungeon');
  for (const mob of placed) {
    const col = Math.floor(mob.x / TILE) - WEST_EXTENSION;
    const row = Math.floor(mob.y / TILE) - 1;
    assert.equal(isDungeonMasonry(col, row), true, `${mob.id} must spawn inside dungeon masonry`);
  }

  const spawned = spawnEnemyNear(game.world, game.player, 'greatsword');
  assert.ok(spawned.mob, spawned.error);
  assert.equal(spawned.mob.health, greatswordSkeletonSpec.maxHealth);
});

test('greatsword skeleton receives zero knockback and does not flee when hit', () => {
  const game = createGame();
  const { world, player } = game;
  const col = Math.floor(SPAWN.x / TILE);
  const floorRow = 12;
  makeDryLane(world, col, floorRow);

  const mob = {
    id: 'test-greatsword-kb',
    kind: 'greatsword',
    x: (col + 0.5) * TILE,
    y: floorRow * TILE,
    homeX: (col + 0.5) * TILE,
    homeY: floorRow * TILE,
    dx: 0,
    dy: 0,
    facing: 1,
    grounded: true,
    health: greatswordSkeletonSpec.maxHealth,
    maxHealth: greatswordSkeletonSpec.maxHealth,
    attackTimer: 0,
    windup: 0,
    hurt: 0,
    flee: 0,
    phase: 0,
  };
  world.mobs = [mob];
  mob.greatswordSwing = { facing: 1, windup: 0.2, phase: 0, elapsed: 0, side: 1, hit: false };
  const startX = mob.x;

  const res = damageMob(world, mob, 3, 0, 140, game.effects);
  assert.ok(res.message.startsWith('Hit '), 'returns hit feedback effect');
  assert.equal(mob.health, greatswordSkeletonSpec.maxHealth - 3);
  assert.equal(mob.dx, 0, 'no horizontal knockback velocity applied');
  assert.equal(mob.dy, 0, 'no vertical knockback velocity applied');
  assert.equal(mob.flee, 0, 'does not enter flee state');
  assert.ok(mob.greatswordSwing, 'active combo is not interrupted by hits');

  stepGreatswordSkeleton(world, player, mob, 1 / 60, game.effects);
  assert.equal(mob.x, startX, 'does not get pushed backward after hit step');
});

test('greatsword skeleton attack swings on front and back two times each (4 alternating cleaves)', () => {
  const game = createGame();
  const { world, player } = game;
  const col = Math.floor(SPAWN.x / TILE);
  const floorRow = 12;
  makeDryLane(world, col, floorRow);

  const mob = {
    id: 'test-greatsword-combo',
    kind: 'greatsword',
    x: col * TILE,
    y: floorRow * TILE,
    homeX: col * TILE,
    homeY: floorRow * TILE,
    dx: 0,
    dy: 0,
    facing: 1,
    grounded: true,
    health: greatswordSkeletonSpec.maxHealth,
    maxHealth: greatswordSkeletonSpec.maxHealth,
    attackTimer: 0,
    windup: 0,
    hurt: 0,
    flee: 0,
    phase: 0,
  };
  world.mobs = [mob];
  Object.assign(player, {
    x: col * TILE + 24,
    y: floorRow * TILE - player.height,
    dx: 0,
    dy: 0,
    grounded: true,
    health: 200,
    hurt: 0,
    flightOrigin: null,
  });

  // 1. Trigger attack windup
  stepGreatswordSkeleton(world, player, mob, 1 / 60, game.effects);
  assert.ok(mob.greatswordSwing);
  assert.equal(mob.greatswordSwing.facing, 1);

  // Advance through windup into swing 0 (front)
  const dt = 0.02;
  const windupSteps = Math.ceil(GREATSWORD_WINDUP / dt) + 1;
  for (let i = 0; i < windupSteps; i++) {
    stepGreatswordSkeleton(world, player, mob, dt, game.effects);
  }

  const sides = [];
  let prevPhase = -1;
  let frontHits = 0;
  let backHits = 0;
  const maxSteps = Math.ceil((GREATSWORD_SWING_DURATION * GREATSWORD_SWING_COUNT) / dt) + 15;
  for (let i = 0; i < maxSteps && mob.greatswordSwing; i++) {
    const s = mob.greatswordSwing;
    if (s.phase !== prevPhase) {
      prevPhase = s.phase;
      sides.push(s.side);
      // Place unhurt player on the expected active side to verify both front AND back cleaves deal real damage
      player.hurt = 0;
      player.x = mob.x + s.side * 24;
      player.y = floorRow * TILE - player.height;
    }
    const beforeHp = player.health;
    stepGreatswordSkeleton(world, player, mob, dt, game.effects);
    if (player.health < beforeHp) {
      if (sides.at(-1) === 1) frontHits++;
      else backHits++;
    }
  }

  assert.deepEqual(sides, [1, -1, 1, -1], 'must swing front, back, front, back');
  assert.equal(frontHits, 2, 'must strike twice on front');
  assert.equal(backHits, 2, 'must strike twice on back');
  assert.equal(mob.greatswordSwing, null, 'combo ends cleanly after 4 swings');
  assert.ok(mob.attackTimer > 0, 'cooldown starts after combo finishes');
});

test('greatsword skeleton renders bare unarmored bone, one red eye, and blade dragging on ground while idle/moving', () => {
  const fills = [];
  const rotations = [];
  const arcs = [];
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
    rotate(a) { rotations.push(a); },
    beginPath() {},
    arc(x, y, r, s, e) { arcs.push({ x, y, r, s, e }); },
    stroke() {},
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
  };

  // Idle pose: bare bone, one red eye, no armor/helmet, sword trailing downward on ground
  const mob = { kind: 'greatsword', facing: 1, dx: 0, dy: 0, phase: 0, windup: 0, greatswordSwing: null };
  drawCaveEnemy(ctx, rect, polygon, mob, 0.5);
  assert.ok(!fills.some((f) => f.color === '#454151' || f.color === '#656476' || f.color === '#777789'), 'no armor cloth or iron helmet');
  const redPixels = fills.filter((f) => f.color === '#d62229' || f.color === '#ff3a3a' || f.color === '#ff8b82');
  assert.equal(redPixels.length, 2, 'renders single crimson glowing eye with highlight on one socket');
  assert.ok(rotations.some((a) => a > 2.3 && a < 2.8), 'idle greatsword points down-back dragging on floor');

  // Moving pose: blade still drags with drag spark pixels
  fills.length = 0;
  rotations.length = 0;
  mob.dx = 24;
  drawCaveEnemy(ctx, rect, polygon, mob, 0.5);
  assert.ok(rotations.some((a) => a > 2.3 && a < 2.8), 'moving greatsword trails dragging on floor');
  assert.ok(fills.some((f) => f.color === '#e6bf86'), 'moving sword shows drag scrape sparks');

  // Active swing pose: renders crescent slash arc
  mob.greatswordSwing = { facing: 1, windup: 0, phase: 1, elapsed: 0.12, side: -1, hit: false };
  drawCaveEnemy(ctx, rect, polygon, mob, 0.8);
  assert.ok(arcs.length >= 1, 'swing renders greatsword cleave arc');
});
