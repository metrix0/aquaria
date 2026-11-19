import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const skeletonArcherSpec = makeCaveEnemySpec('archer', 'skeleton archer', 12, 23, 25, 12, 135);

export function stepSkeletonArcher(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, skeletonArcherSpec, dt, effects, {
    chaseDistance: 90,
    onWindupComplete({ active, distance, deltaX, deltaY }) {
      if (active && distance <= skeletonArcherSpec.reach) {
        world.projectiles.push({
          kind: 'cave-arrow',
          x: mob.x,
          y: mob.y + skeletonArcherSpec.centerY,
          dx: deltaX / (distance || 1) * 205,
          dy: deltaY / (distance || 1) * 205,
          life: 1.15,
        });
      }
    },
  });
}

export function stepCaveArrow(world, player, hazard, dt, effects) {
  const oldX = hazard.x;
  const oldY = hazard.y;
  hazard.life -= dt;
  if (hazard.life <= 0) return false;
  hazard.x += hazard.dx * dt;
  hazard.y += hazard.dy * dt;
  if (!clearPath(world, oldX, oldY, hazard.x, hazard.y)) return false;
  if (
    !player.flightOrigin &&
    Math.abs(player.x - hazard.x) < player.width / 2 + 2 &&
    hazard.y >= player.y &&
    hazard.y < player.y + player.height
  ) {
    hurtPlayer(player, 12, Math.sign(hazard.dx), 'Hit by a skeleton arrow!', '#e6ceaa', effects);
    return false;
  }
  return true;
}
