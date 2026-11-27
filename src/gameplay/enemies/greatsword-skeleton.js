import { isCaveRefuge } from '../../world/island-cave.js';
import { TILE, WEST_EXTENSION } from '../../world/generation.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const GREATSWORD_WINDUP = 0.45;
export const GREATSWORD_SWING_DURATION = 0.24;
export const GREATSWORD_SWING_COUNT = 4;
export const GREATSWORD_COOLDOWN = 2;

export const greatswordSkeletonSpec = makeCaveEnemySpec('greatsword', 'greatsword skeleton', 29, 41, 24, 24, 42);

/** Advance the dungeon greatsword skeleton: unknockable tank that alternates front and back slashes twice per combo. */
export function stepGreatswordSkeleton(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, greatswordSkeletonSpec, dt, effects, {
    jumpSpeed: 215,
    windupDuration: GREATSWORD_WINDUP,
    attackCooldown: GREATSWORD_COOLDOWN,
    stepActive({ deltaX, deltaY, distance, active }) {
      const swing = mob.greatswordSwing;
      if (swing) {
        mob.facing = swing.facing;
        if (swing.windup > 0) {
          swing.windup = Math.max(0, swing.windup - dt);
          mob.windup = swing.windup;
          return 0;
        }
        mob.windup = 0;
        swing.elapsed += dt;
        const side = swing.phase % 2 === 0 ? swing.facing : -swing.facing;
        swing.side = side;
        if (swing.elapsed / GREATSWORD_SWING_DURATION >= 0.3 && !swing.hit) {
          const playerY = player.y + player.height / 2;
          const onSide = (player.x - mob.x) * side >= -6;
          const inArc = Math.abs(player.x - mob.x) <= greatswordSkeletonSpec.reach && Math.abs(deltaY) <= 28;
          if (!player.flightOrigin &&
              !isCaveRefuge(Math.floor(player.x / TILE) - WEST_EXTENSION, Math.floor(playerY / TILE)) &&
              onSide && inArc &&
              clearPath(world, mob.x, mob.y + greatswordSkeletonSpec.centerY, player.x, playerY)) {
            hurtPlayer(player, greatswordSkeletonSpec.damage, side, 'Cleaved by a ' + greatswordSkeletonSpec.name + '!', '#d88e6d', effects);
          }
          swing.hit = true;
        }
        if (swing.elapsed >= GREATSWORD_SWING_DURATION) {
          swing.phase += 1;
          swing.elapsed = 0;
          swing.hit = false;
          if (swing.phase >= GREATSWORD_SWING_COUNT) {
            mob.greatswordSwing = null;
            mob.attackTimer = GREATSWORD_COOLDOWN;
          } else {
            swing.side = swing.phase % 2 === 0 ? swing.facing : -swing.facing;
          }
        }
        return 0;
      }

      if (active && distance <= greatswordSkeletonSpec.reach && mob.attackTimer === 0) {
        mob.facing = deltaX >= 0 ? 1 : -1;
        mob.greatswordSwing = {
          facing: mob.facing,
          windup: GREATSWORD_WINDUP,
          phase: 0,
          elapsed: 0,
          side: mob.facing,
          hit: false,
        };
        mob.windup = GREATSWORD_WINDUP;
        return 0;
      }
      return undefined;
    },
  });
}
