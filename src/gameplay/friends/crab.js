import { MATERIAL } from '../../content.js';
import { solidAt } from '../../world.js';
import { COLS, MOB_HEALTH, TILE, clamp } from '../../world/generation.js';

export const crabSpec = {
  name: 'crab',
  width: 12,
  height: 8,
  radius: 10,
  centerY: -4,
  material: MATERIAL.sand,
  maxHealth: MOB_HEALTH.crab,
};

export function crabCollides(world, player, x, y) {
  const left = Math.floor((x - 6) / TILE);
  const right = Math.floor((x + 6 - 0.01) / TILE);
  const top = Math.floor((y - 8) / TILE);
  const bottom = Math.floor((y - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(world, tx, ty, player)) return true;
    }
  }
  return false;
}

function crabHasFloor(world, player, x, y) {
  const tx = Math.floor(x / TILE);
  const baseTy = Math.floor((y + 1) / TILE);
  return solidAt(world, tx, baseTy, player) || solidAt(world, tx, baseTy + 1, player);
}

export function stepCrab(world, player, mob, dt, time, { dist, diffX, playerMoving }, inWater) {
  if (dist < 36 && playerMoving) {
    mob.flee = 1;
    if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
  }

  if (mob.x > mob.homeX + mob.span) mob.facing = -1;
  else if (mob.x < mob.homeX - mob.span) mob.facing = 1;

  const scuttling = mob.flee > 0 || Math.sin(time * 1.15 + mob.phase * 2.1) > -0.55;
  const targetDx = scuttling ? mob.facing * mob.speed * (mob.flee > 0 ? 1.65 : 1) : 0;
  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 10);

  if (Math.abs(mob.dx) > 0.5) {
    const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
    if (!crabCollides(world, player, nextX, mob.y)) {
      if (!mob.grounded || crabHasFloor(world, player, nextX, mob.y)) {
        mob.x = nextX;
      } else {
        mob.facing = -mob.facing;
        mob.dx = 0;
      }
    } else {
      const stepY = Math.floor((mob.y - 1) / TILE) * TILE;
      if (
        mob.grounded &&
        mob.y - stepY <= TILE &&
        !crabCollides(world, player, mob.x, stepY) &&
        !crabCollides(world, player, nextX, stepY)
      ) {
        mob.x = nextX;
        mob.y = stepY;
      } else {
        mob.facing = -mob.facing;
        mob.dx = 0;
      }
    }
  }

  const submerged = inWater(world, mob.x, mob.y - 1);
  mob.dy = Math.min(mob.dy + (submerged ? 260 : 480) * dt, submerged ? 120 : 210);
  const nextY = mob.y + mob.dy * dt;
  if (!crabCollides(world, player, mob.x, nextY)) {
    mob.y = nextY;
    mob.grounded = false;
  } else {
    mob.y = Math.floor((nextY - 0.01) / TILE) * TILE;
    mob.dy = 0;
    mob.grounded = true;
  }
}
