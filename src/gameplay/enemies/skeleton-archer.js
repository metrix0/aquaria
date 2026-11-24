import { MATERIAL } from '../../content.js';
import { inWater, solidAt, tileAt } from '../../world.js';
import { COLS, ROWS, TILE } from '../../world/generation.js';
import { hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

const ARROW_GRAVITY = 140;

export const skeletonArcherSpec = makeCaveEnemySpec('archer', 'skeleton archer', 12, 23, 25, 12, 135);

export function parabolicArrowVelocity(deltaX, deltaY, speed) {
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const flightTime = distance / speed;
  const aimY = deltaY - 0.5 * ARROW_GRAVITY * flightTime * flightTime;
  const aimLen = Math.hypot(deltaX, aimY) || 1;
  return {
    dx: (deltaX / aimLen) * speed,
    dy: (aimY / aimLen) * speed,
  };
}

export function stepSkeletonArcher(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, skeletonArcherSpec, dt, effects, {
    chaseDistance: 90,
    jumpSpeed: 210,
    onWindupComplete({ active, distance, deltaX, deltaY }) {
      if (active && distance <= skeletonArcherSpec.reach) {
        const { dx, dy } = parabolicArrowVelocity(deltaX, deltaY, 230);
        world.projectiles.push({
          kind: 'cave-arrow',
          x: mob.x,
          y: mob.y + skeletonArcherSpec.centerY,
          dx,
          dy,
          life: 1.8,
        });
      }
    },
  });
}

export function stepCaveArrow(world, player, hazard, dt, effects) {
  hazard.life -= dt;
  if (hazard.life <= 0) return false;
  if (inWater(world, hazard.x, hazard.y)) {
    const drag = Math.exp(-1.1 * dt);
    hazard.dx *= drag;
    hazard.dy = hazard.dy * drag + 45 * dt;
  } else {
    hazard.dy += ARROW_GRAVITY * dt;
  }
  const travel = Math.hypot(hazard.dx * dt, hazard.dy * dt);
  const steps = Math.max(1, Math.ceil(travel / 6));
  for (let step = 0; step < steps; step++) {
    hazard.x += (hazard.dx * dt) / steps;
    hazard.y += (hazard.dy * dt) / steps;
    const tx = Math.floor(hazard.x / TILE);
    const ty = Math.floor(hazard.y / TILE);
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS || solidAt(world, tx, ty)) {
      effects?.push({ x: hazard.x, y: hazard.y, material: tileAt(world, tx, ty) || MATERIAL.wood, count: 4, spread: 42 });
      return false;
    }
    if (
      !player.flightOrigin &&
      Math.abs(player.x - hazard.x) < player.width / 2 + 2 &&
      hazard.y >= player.y &&
      hazard.y < player.y + player.height
    ) {
      hurtPlayer(
        player,
        hazard.damage ?? 12,
        Math.sign(hazard.dx),
        hazard.message ?? 'Hit by a skeleton arrow!',
        hazard.color ?? '#e6ceaa',
        effects,
      );
      return false;
    }
  }
  return true;
}
