import { overlapsMob, pickaxePose, toolHitbox } from '../melee.js';
import { hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const skeletalMinerSpec = makeCaveEnemySpec('miner', 'skeletal miner', 14, 23, 34, 18, 22);

export function stepSkeletalMiner(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, skeletalMinerSpec, dt, effects, {
    jumpSpeed: 210,
    stepActive({ active }) {
      if (mob.minerSwing == null) return undefined;
      mob.minerSwing += dt;
      const { angle, bounds } = pickaxePose(Math.min(1, mob.minerSwing / .44));
      if (active && bounds) {
        const hitbox = toolHitbox(Math.round(mob.x) + mob.facing * 2, Math.round(mob.y) - 12, mob.facing, angle, bounds);
        if (overlapsMob(hitbox, player, { width: player.width, height: player.height, centerY: player.height / 2 })) {
          hurtPlayer(player, skeletalMinerSpec.damage, mob.facing, 'Struck by a ' + skeletalMinerSpec.name + '!', '#d88e6d', effects);
        }
      }
      if (mob.minerSwing >= .44) mob.minerSwing = null;
      return 0;
    },
    startAttack() {
      mob.minerSwing = 0;
      mob.attackTimer = 1.45;
    },
  });
}
