import { makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const hammerSkeletonSpec = makeCaveEnemySpec('hammer', 'hammer skeleton', 29, 41, 26, 26, 35);

export function stepHammerSkeleton(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, hammerSkeletonSpec, dt, effects, {
    jumpSpeed: 215,
    windupDuration: .65,
    attackCooldown: 2,
  });
}
