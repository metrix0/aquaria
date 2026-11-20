import { MATERIAL } from '../../content.js';
import { solidAt } from '../../world.js';
import { COLS, MOB_HEALTH, ROWS, TILE, WEST_EXTENSION, clamp } from '../../world/generation.js';
import { JUNGLE_CAVE } from '../../world/jungle-cave.js';
import { hurtPlayer } from './cave-shared.js';

const WORM_SEGMENTS = 12;
const HEAD_RADIUS = 8;
const BODY_RADIUS = 7;
const TAIL_RADIUS = 6;
const MIN_WORLD_Y = 23 * TILE;

export const jungleWormSpec = {
  name: 'jungle worm',
  width: 16,
  height: 16,
  radius: HEAD_RADIUS,
  centerY: 0,
  damage: 16,
  reach: 16,
  maxHealth: MOB_HEALTH.worm,
  material: MATERIAL.deepstone,
  color: '#9c7b59',
};

export function createWormSegments(x, y) {
  const segments = [];
  for (let i = 0; i < WORM_SEGMENTS; i++) {
    const gap = i === 0 ? 0 : i === 1 ? 11 : 10;
    const prevY = segments[i - 1]?.y ?? y;
    const radius = i === 0 ? HEAD_RADIUS : i === WORM_SEGMENTS - 1 ? TAIL_RADIUS : BODY_RADIUS;
    segments.push({
      x: x - Math.sin(i * 0.45) * 4,
      y: prevY + gap,
      angle: -Math.PI / 2,
      radius,
    });
  }
  return segments;
}

export function stepJungleWorm(world, player, mob, dt, effects) {
  if (!mob.segments) {
    mob.segments = createWormSegments(mob.x, mob.y);
    mob.wormClock = mob.phase ?? 0;
    mob.dx = 48;
    mob.dy = -56;
    mob.angle = Math.atan2(mob.dy, mob.dx);
    mob.wasInSolid = true;
    mob.burrowFxTimer = 0;
    mob.aggroTimer = 0;
  }

  mob.wormClock = (mob.wormClock ?? 0) + dt;
  mob.burrowFxTimer = Math.max(0, (mob.burrowFxTimer ?? 0) - dt);

  const px = player.x;
  const py = player.y + player.height / 2;
  const distToPlayer = Math.hypot(px - mob.x, py - mob.y);
  const inJungleCaveSpan = Math.abs(px - (JUNGLE_CAVE.center + WEST_EXTENSION) * TILE) <= 52 * TILE && py >= MIN_WORLD_Y;
  const alerted = !player.flightOrigin && inJungleCaveSpan && (distToPlayer <= 210 || mob.hurt > 0 || mob.health < mob.maxHealth);

  if (alerted && distToPlayer <= 320) {
    mob.aggroTimer = 4.5;
  } else {
    mob.aggroTimer = Math.max(0, (mob.aggroTimer ?? 0) - dt);
  }
  const chasing = !player.flightOrigin && mob.aggroTimer > 0 && inJungleCaveSpan;

  const targetX = chasing
    ? px
    : mob.homeX + Math.sin(mob.wormClock * 0.68) * 68;
  const targetY = chasing
    ? py
    : mob.homeY + Math.cos(mob.wormClock * 1.12) * 38;

  const headTx = Math.floor(mob.x / TILE);
  const headTy = Math.floor(mob.y / TILE);
  const inSolid = solidAt(world, headTx, headTy);

  if (inSolid !== mob.wasInSolid && distToPlayer <= 260) {
    effects.push({
      x: mob.x,
      y: mob.y,
      material: headTy >= JUNGLE_CAVE.deepstoneRow ? MATERIAL.deepstone : MATERIAL.stone,
      count: 5,
      spread: 52,
    });
  } else if (inSolid && chasing && mob.burrowFxTimer === 0 && distToPlayer <= 190) {
    mob.burrowFxTimer = 0.2;
    effects.push({
      x: mob.x,
      y: mob.y,
      material: headTy >= JUNGLE_CAVE.deepstoneRow ? MATERIAL.deepstone : MATERIAL.stone,
      count: 2,
      spread: 34,
    });
  }
  mob.wasInSolid = inSolid;

  const toX = targetX - mob.x;
  const toY = targetY - mob.y;
  const toLen = Math.hypot(toX, toY) || 1;
  const maxSpeed = chasing ? 134 : 74;
  const desiredDx = (toX / toLen) * maxSpeed;
  const desiredDy = (toY / toLen) * maxSpeed;

  if (inSolid) {
    // Terraria Giant Worm / Digger solid-block steering: wide sweeping turns & axis alignment
    const accel = chasing ? 170 : 95;
    const stepAxis = (vel, desired) => {
      const opposing = (vel > 0 && desired < 0) || (vel < 0 && desired > 0);
      const rate = (opposing ? accel * 1.45 : accel) * dt;
      if (vel < desired) return Math.min(desired, vel + rate);
      if (vel > desired) return Math.max(desired, vel - rate);
      return vel;
    };
    mob.dx = stepAxis(mob.dx, desiredDx);
    mob.dy = stepAxis(mob.dy, desiredDy);
  } else {
    // Open cave background walls: arc gracefully through the cavern under lighter gravity
    const gravity = 92;
    const airSteerX = chasing ? 76 : 42;
    const airGripY = chasing ? 44 : 24;
    if (mob.dx < desiredDx) mob.dx = Math.min(desiredDx, mob.dx + airSteerX * dt);
    else if (mob.dx > desiredDx) mob.dx = Math.max(desiredDx, mob.dx - airSteerX * dt);
    mob.dy += (gravity + Math.sign(desiredDy) * airGripY) * dt;
  }

  const speed = Math.hypot(mob.dx, mob.dy);
  const speedCap = maxSpeed * (inSolid ? 1 : 1.15);
  if (speed > speedCap) {
    mob.dx = (mob.dx / speed) * speedCap;
    mob.dy = (mob.dy / speed) * speedCap;
  } else if (speed < maxSpeed * 0.45 && inSolid) {
    const boost = speed > 0.01 ? (maxSpeed * 0.45) / speed : 1;
    mob.dx = speed > 0.01 ? mob.dx * boost : desiredDx * 0.5;
    mob.dy = speed > 0.01 ? mob.dy * boost : desiredDy * 0.5;
  }

  mob.x = clamp(mob.x + mob.dx * dt, TILE * 2, (COLS - 2) * TILE);
  mob.y = clamp(mob.y + mob.dy * dt, MIN_WORLD_Y, (ROWS - 4) * TILE);
  if (mob.y <= MIN_WORLD_Y && mob.dy < 0) mob.dy = Math.abs(mob.dy) * 0.5 + 24;
  mob.angle = Math.atan2(mob.dy, mob.dx);
  mob.facing = mob.dx < 0 ? -1 : 1;

  // Update articulated body & tail segments trailing smoothly behind the head
  mob.segments[0].x = mob.x;
  mob.segments[0].y = mob.y;
  mob.segments[0].angle = mob.angle;
  for (let i = 1; i < mob.segments.length; i++) {
    const prev = mob.segments[i - 1];
    const seg = mob.segments[i];
    const dx = prev.x - seg.x;
    const dy = prev.y - seg.y;
    const dist = Math.hypot(dx, dy) || 1;
    const gap = i === 1 ? 11 : 10;
    seg.angle = Math.atan2(dy, dx);
    seg.x = prev.x - (dx / dist) * gap;
    seg.y = prev.y - (dy / dist) * gap;
  }

  if (!player.flightOrigin && player.hurt <= 0) {
    for (let i = 0; i < mob.segments.length; i++) {
      const seg = mob.segments[i];
      const hitDist = Math.hypot(px - seg.x, py - seg.y);
      if (hitDist <= seg.radius + 7) {
        const pushDir = px >= seg.x ? 1 : -1;
        hurtPlayer(
          player,
          i === 0 ? jungleWormSpec.damage : 11,
          pushDir,
          i === 0 ? 'Bitten by a jungle worm!' : 'Struck by a jungle worm!',
          '#c7a772',
          effects,
        );
        break;
      }
    }
  }
}
