import { isCaveRefuge } from '../../world/island-cave.js';
import { TILE, WEST_EXTENSION } from '../../world/generation.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const MORNINGSTAR_WINDUP = 0.55;
export const MORNINGSTAR_FLAIL_DURATION = 0.48;
export const MORNINGSTAR_MAX_RANGE = 72;
export const MORNINGSTAR_COOLDOWN = 1.9;

export const armoredSkeletonSpec = {
  ...makeCaveEnemySpec('armored-skeleton', 'armoured skeleton', 29, 41, 24, 28, MORNINGSTAR_MAX_RANGE),
  noKnockback: true,
};

/** Advance the dungeon armored skeleton: unknockable tank that swings and throws a chained spiked morningstar. */
export function stepArmoredSkeleton(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, armoredSkeletonSpec, dt, effects, {
    jumpSpeed: 215,
    windupDuration: MORNINGSTAR_WINDUP,
    attackCooldown: MORNINGSTAR_COOLDOWN,
    stepActive({ deltaX, deltaY, distance, active }) {
      if (mob.flail) {
        mob.flail.progress += dt / MORNINGSTAR_FLAIL_DURATION;
        mob.facing = mob.flail.facing;
        const t = Math.min(1, mob.flail.progress);
        const reach = Math.sin(t * Math.PI) * MORNINGSTAR_MAX_RANGE;
        const flailX = mob.x + Math.cos(mob.flail.angle) * mob.facing * reach;
        const flailY = mob.y + armoredSkeletonSpec.centerY + Math.sin(mob.flail.angle) * reach;

        if (!mob.flail.hit && t >= 0.25 && t <= 0.85) {
          const playerMidX = player.x;
          const playerMidY = player.y + player.height / 2;
          const hitDist = Math.hypot(playerMidX - flailX, playerMidY - flailY);
          if (hitDist <= 22 && !player.flightOrigin &&
              !isCaveRefuge(Math.floor(player.x / TILE) - WEST_EXTENSION, Math.floor(playerMidY / TILE))) {
            hurtPlayer(player, armoredSkeletonSpec.damage, mob.facing, 'Crushed by an ' + armoredSkeletonSpec.name + ' flail!', '#d88e6d', effects);
            mob.flail.hit = true;
          }
        }

        if (mob.flail.progress >= 1) {
          mob.flail = null;
          mob.attackTimer = MORNINGSTAR_COOLDOWN;
        }
        return 0;
      }

      if (mob.morningstarWindup != null) {
        mob.morningstarWindup += dt;
        mob.windup = Math.max(0, MORNINGSTAR_WINDUP - mob.morningstarWindup);
        if (mob.morningstarWindup >= MORNINGSTAR_WINDUP) {
          const aimAngle = Math.atan2(deltaY, Math.abs(deltaX) || 1);
          mob.morningstarWindup = null;
          mob.windup = 0;
          mob.flail = {
            progress: 0,
            angle: Math.max(-0.65, Math.min(0.65, aimAngle)),
            facing: mob.facing,
            hit: false,
          };
        }
        return 0;
      }

      if (active && distance <= MORNINGSTAR_MAX_RANGE && mob.attackTimer === 0) {
        mob.facing = deltaX >= 0 ? 1 : -1;
        mob.morningstarWindup = 0;
        mob.windup = MORNINGSTAR_WINDUP;
        return 0;
      }

      return undefined;
    },
  });
}
