import { makeCaveEnemySpec, stepCaveDasherActive, stepCaveEnemyBase } from './cave-shared.js';

export const caveSpiderSpec = makeCaveEnemySpec('spider', 'cave spider', 13, 8, 34, 13, 86);

export function stepCaveSpider(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, caveSpiderSpec, dt, effects, {
    jumpSpeed: 215,
    stepActive: stepCaveDasherActive,
    onWindupComplete() {
      mob.dash = .55;
      mob.venomIn = 0;
    },
  });
}
