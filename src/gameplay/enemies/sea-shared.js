import { takeDamage } from '../player.js';
import { fishCollides } from '../friends/fish.js';
import { COLS, TILE, WATER, clamp } from '../../world/generation.js';

export function stepSeaEnemy(world, player, mob, spec, dt, effects, ctx, behavior) {
  const { px, py, dist, playerInWater } = ctx;
  mob.cooldown = Math.max(0, (mob.cooldown ?? 0) - dt);
  mob.attackTimer = mob.attackTimer ?? 1.8;
  mob.windup = mob.windup ?? 0;
  const toPlayerX = px - mob.x;
  const toPlayerY = py - mob.y;

  let targetDx = 0;
  let targetDy = 0;
  let accel = 5;
  let dashingShark = false;

  if (mob.flee > 0) {
    mob.windup = 0;
    mob.dash = 0;
    mob.shock = 0;
    targetDx = -(toPlayerX / dist) * (mob.speed * 1.6 + 24);
    targetDy = -(toPlayerY / dist) * (mob.speed * 1.2 + 16);
  } else {
    ({ targetDx, targetDy, accel = 5, dashingShark = false } = behavior({
      ...ctx,
      toPlayerX,
      toPlayerY,
    }));
  }

  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * accel);
  mob.dy += (targetDy - mob.dy) * Math.min(1, dt * accel);
  if (Math.abs(mob.dx) > 1.5 && mob.kind !== 'jellyfish' && mob.windup <= 0) {
    mob.facing = mob.dx < 0 ? -1 : 1;
  }

  const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
  if (!fishCollides(world, player, nextX, mob.y, spec.width, spec.height)) {
    mob.x = nextX;
  } else {
    mob.dx *= -0.75;
    mob.facing = -mob.facing;
    mob.dash = 0;
  }

  const nextY = Math.max(WATER + 12, mob.y + mob.dy * dt);
  if (!fishCollides(world, player, mob.x, nextY, spec.width, spec.height)) {
    mob.y = nextY;
  } else {
    mob.dy *= -0.75;
    mob.dash = 0;
  }

  const hitRadius = dashingShark ? spec.radius + 9 : spec.radius + 7;
  if (
    !player.flightOrigin &&
    playerInWater &&
    (player.hurt ?? 0) <= 0 &&
    mob.flee <= 0 &&
    mob.cooldown <= 0 &&
    dist < hitRadius
  ) {
    player.hurt = 1.15;
    mob.cooldown = dashingShark ? 2.0 : 1.6;
    if (mob.kind === 'squid') mob.flee = 1.8;
    const dmg = dashingShark ? 42 : spec.healthDamage;
    const air = dashingShark ? 6 : spec.damage;
    const knock = dashingShark ? 175 : 135;
    mob.dash = 0;
    player.dx = (toPlayerX / dist) * knock;
    player.dy = (toPlayerY / dist) * 105 - 18;
    const loss = takeDamage(player, dmg);
    player.oxygen = Math.max(0, player.oxygen - air);
    effects.push({
      x: mob.x,
      y: mob.y,
      material: spec.material,
      count: mob.kind === 'squid' ? 14 : 9,
      spread: 68,
      message: (dashingShark ? 'Shark dash bite!' : spec.message) + ' −' + loss + ' health',
    });
  }
}
