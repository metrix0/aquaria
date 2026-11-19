import { MATERIAL } from '../../content.js';
import { solidAt, waterTileAt } from '../../world.js';
import { COLS, MOB_HEALTH, TILE, WATER, clamp, waterwayAt } from '../../world/generation.js';

export const fishSpec = {
  name: 'fish',
  width: 12,
  height: 8,
  radius: 10,
  centerY: 0,
  material: MATERIAL.sand,
  maxHealth: MOB_HEALTH.fish,
};

export function fishCollides(world, player, x, y, width = 12, height = 8) {
  if (y - height / 2 < WATER + 8) return true;
  const left = Math.floor((x - width / 2) / TILE);
  const right = Math.floor((x + width / 2 - 0.01) / TILE);
  const top = Math.floor((y - height / 2) / TILE);
  const bottom = Math.floor((y + height / 2 - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!waterTileAt(world, tx, ty) || waterwayAt(tx, ty) || solidAt(world, tx, ty, player)) {
        return true;
      }
    }
  }
  return false;
}

export function stepFish(
  world,
  player,
  mob,
  dt,
  time,
  enemies,
  { dist, diffX, diffY, playerInWater, playerMoving },
) {
  let hit;
  if (!mob.enemyType && playerInWater && dist < 44 && playerMoving) {
    mob.flee = 1.1;
    if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
  }

  let targetDx;
  let targetDy;
  if (mob.enemyType && playerInWater && dist < 108 && mob.remainingLife > 2) {
    targetDx = (-diffX / dist) * mob.speed;
    targetDy = (-diffY / dist) * mob.speed;
    if (
      !player.flightOrigin &&
      enemies.hitCooldown === 0 &&
      Math.abs(diffX) < 12 &&
      Math.abs(diffY) < 16
    ) {
      enemies.hitCooldown = 3;
      hit = mob.enemyType;
    }
  } else if (mob.flee > 0) {
    targetDx = mob.facing * mob.speed * 1.75;
    targetDy = clamp((diffY / dist) * mob.speed * 1.1, -mob.speed, mob.speed);
  } else {
    if (mob.x > mob.homeX + mob.span) mob.facing = -1;
    else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
    if (fishCollides(world, player, mob.x + mob.facing * 12, mob.y)) {
      mob.facing = -mob.facing;
    }
    targetDx = mob.facing * mob.speed * (0.85 + 0.25 * Math.sin(time * 2.1 + mob.phase));
    const targetY = Math.max(WATER + 14, mob.homeY + Math.sin(time * 1.5 + mob.phase) * 10);
    targetDy = clamp((targetY - mob.y) * 1.8, -mob.speed * 0.65, mob.speed * 0.65);
  }

  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
  mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
  if (Math.abs(mob.dx) > 1.5) mob.facing = mob.dx < 0 ? -1 : 1;

  const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
  if (!fishCollides(world, player, nextX, mob.y)) {
    mob.x = nextX;
  } else {
    mob.facing = -mob.facing;
    mob.dx *= -0.6;
  }

  const nextY = Math.max(WATER + 10, mob.y + mob.dy * dt);
  if (!fishCollides(world, player, mob.x, nextY)) {
    mob.y = nextY;
  } else {
    mob.dy *= -0.6;
  }

  return hit;
}
