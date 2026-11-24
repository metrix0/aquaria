import { MATERIAL } from '../../content.js';
import { COLS, MOB_HEALTH, TILE, WATER, clamp } from '../../world/generation.js';
import { fishCollides } from '../friends/fish.js';
import { takeDamage } from '../player.js';

export const PUFFERFISH_TRIGGER_RADIUS = 56;
export const PUFFERFISH_WINDUP = 0.7;
export const PUFFERFISH_INFLATE_DURATION = 3.5;
export const PUFFERFISH_INFLATE_SCALE = 2.8;
export const PUFFERFISH_DEFLATE_DURATION = 0.65;
export const PUFFERFISH_EXHAUSTION = 1.6;
export const PUFFERFISH_POISON_DURATION = 5;

export const pufferfishSpec = {
  name: 'pufferfish',
  width: 14,
  height: 12,
  radius: 7,
  centerY: 0,
  damage: 1,
  healthDamage: 6,
  message: 'Bumped a pufferfish!',
  material: MATERIAL.reef,
  maxHealth: MOB_HEALTH.pufferfish,
};

/** Begin the inhale telegraph before the pufferfish expands. */
export function triggerPufferfishWindup(mob) {
  mob.pufferState = 'windup';
  mob.pufferTimer = PUFFERFISH_WINDUP;
  mob.dx *= 0.2;
  mob.dy *= 0.2;
}

export function stepPufferfish(world, player, mob, dt, time, effects, ctx) {
  const { px, py, dist, playerInWater } = ctx;
  mob.pufferState = mob.pufferState ?? 'idle';
  mob.inflateScale = mob.inflateScale ?? 1;
  mob.cooldown = Math.max(0, (mob.cooldown ?? 0) - dt);
  mob.exhausted = Math.max(0, (mob.exhausted ?? 0) - dt);

  const toPlayerX = px - mob.x;
  const toPlayerY = py - mob.y;
  let targetDx = 0;
  let targetDy = 0;
  let accel = 5;

  if (mob.pufferState === 'windup') {
    if (Math.abs(toPlayerX) > 1) mob.facing = toPlayerX >= 0 ? 1 : -1;
    mob.inflateScale = Math.min(1.25, mob.inflateScale + dt * 0.45);
    mob.pufferTimer = Math.max(0, (mob.pufferTimer ?? 0) - dt);
    accel = 10;
    if (mob.pufferTimer <= 0) {
      mob.pufferState = 'inflated';
      mob.pufferTimer = PUFFERFISH_INFLATE_DURATION;
      effects?.push({ x: mob.x, y: mob.y, color: '#f5e8ba', count: 8, spread: 52 });
    }
  } else if (mob.pufferState === 'inflated') {
    mob.inflateScale = Math.min(PUFFERFISH_INFLATE_SCALE, mob.inflateScale + dt * 10);
    // Buoyant lift while inflated floats the pufferfish slowly upward.
    targetDy = -16;
    accel = 3;
    mob.pufferTimer = Math.max(0, (mob.pufferTimer ?? 0) - dt);
    if (mob.pufferTimer <= 0) {
      mob.pufferState = 'deflating';
      mob.pufferTimer = PUFFERFISH_DEFLATE_DURATION;
      const nozzleDir = mob.facing || 1;
      mob.jetDir = -nozzleDir;
      mob.dx = mob.jetDir * 145;
      mob.dy = -8;
      effects?.push({ x: mob.x + nozzleDir * 8, y: mob.y, color: '#a8e6ff', count: 10, spread: 48 });
    }
  } else if (mob.pufferState === 'deflating') {
    const shrinkRate = (PUFFERFISH_INFLATE_SCALE - 1) / PUFFERFISH_DEFLATE_DURATION;
    mob.inflateScale = Math.max(1, mob.inflateScale - dt * shrinkRate);
    targetDx = (mob.jetDir ?? -(mob.facing || 1)) * 55;
    accel = 2.5;
    mob.pufferTimer = Math.max(0, (mob.pufferTimer ?? 0) - dt);
    if (mob.pufferTimer <= 0) {
      mob.pufferState = 'idle';
      mob.inflateScale = 1;
      mob.exhausted = PUFFERFISH_EXHAUSTION;
    }
  } else {
    mob.inflateScale = Math.max(1, mob.inflateScale - dt * 4);
    const phase = mob.phase ?? 0;
    const span = mob.span ?? 28;
    const speed = mob.speed ?? 18;
    const patrolX = mob.homeX + Math.sin(time * 0.55 + phase) * span;
    const patrolY = mob.homeY + Math.sin(time * 1.1 + phase * 1.4) * 7;
    const dxTo = patrolX - mob.x;
    const dyTo = patrolY - mob.y;
    const dTo = Math.hypot(dxTo, dyTo) || 1;
    targetDx = clamp((dxTo / dTo) * speed, -speed, speed);
    targetDy = clamp((dyTo / dTo) * speed * 0.7, -speed * 0.7, speed * 0.7);
    if (!player.flightOrigin && playerInWater && mob.exhausted <= 0 && dist <= PUFFERFISH_TRIGGER_RADIUS) {
      triggerPufferfishWindup(mob);
      targetDx = 0;
      targetDy = 0;
    }
  }

  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * accel);
  mob.dy += (targetDy - mob.dy) * Math.min(1, dt * accel);
  if (mob.pufferState === 'idle' && Math.abs(mob.dx) > 1.5) {
    mob.facing = mob.dx < 0 ? -1 : 1;
  }

  const boxW = pufferfishSpec.width * mob.inflateScale;
  const boxH = pufferfishSpec.height * mob.inflateScale;
  const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
  if (!fishCollides(world, player, nextX, mob.y, boxW, boxH)) {
    mob.x = nextX;
  } else {
    mob.dx *= -0.7;
    if (mob.pufferState === 'idle') mob.facing = -mob.facing;
  }

  const nextY = Math.max(WATER + 12, mob.y + mob.dy * dt);
  if (!fishCollides(world, player, mob.x, nextY, boxW, boxH)) {
    mob.y = nextY;
  } else {
    mob.dy *= -0.5;
  }

  const hitRadius = pufferfishSpec.radius * mob.inflateScale + 7;
  if (!player.flightOrigin && playerInWater && (player.hurt ?? 0) <= 0 && mob.cooldown <= 0 && dist < hitRadius) {
    if (mob.pufferState === 'inflated') {
      player.hurt = 1.15;
      mob.cooldown = 1.0;
      player.dx = (toPlayerX / dist) * 225;
      player.dy = (toPlayerY / dist) * 140 - 26;
      const loss = takeDamage(player, 14);
      player.oxygen = Math.max(0, player.oxygen - 2);
      player.poison = Math.max(player.poison ?? 0, PUFFERFISH_POISON_DURATION);
      effects?.push({
        x: mob.x,
        y: mob.y,
        material: MATERIAL.reef,
        count: 10,
        spread: 72,
        message: 'Spined by a pufferfish! −' + loss + ' health',
      });
    } else if (mob.pufferState === 'idle') {
      player.hurt = 0.85;
      mob.cooldown = 1.4;
      player.dx = (toPlayerX / dist) * 95;
      player.dy = (toPlayerY / dist) * 70 - 12;
      const loss = takeDamage(player, pufferfishSpec.healthDamage);
      effects?.push({
        x: mob.x,
        y: mob.y,
        material: MATERIAL.reef,
        count: 5,
        spread: 42,
        message: pufferfishSpec.message + ' −' + loss + ' health',
      });
    }
  }
}
