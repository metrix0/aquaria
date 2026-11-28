import { MATERIAL } from '../../content.js';
import { MOB_HEALTH, clamp } from '../../world/generation.js';
import { stepSeaEnemy } from './sea-shared.js';

export const sharkSpec = {
  name: 'shark',
  width: 39,
  height: 18,
  radius: 19.5,
  centerY: 0,
  damage: 5,
  healthDamage: 34,
  message: 'Bitten by a shark!',
  material: MATERIAL.stone,
  maxHealth: MOB_HEALTH.shark,
};

export function stepShark(world, player, mob, dt, time, effects, ctx) {
  stepSeaEnemy(world, player, mob, sharkSpec, dt, effects, ctx, ({ px, dist, playerInWater, toPlayerX, toPlayerY }) => {
    let targetDx = 0;
    let targetDy = 0;
    let accel = 5;

    if ((mob.dash ?? 0) > 0) {
      mob.dash = Math.max(0, mob.dash - dt);
      targetDx = mob.dashDx;
      targetDy = mob.dashDy;
      accel = 15;
      if (Math.random() < 0.4) {
        effects.push({
          x: mob.x - mob.facing * 18,
          y: mob.y,
          color: '#a1d9cb',
          count: 1,
          spread: 18,
        });
      }
    } else if (mob.windup > 0) {
      mob.windup = Math.max(0, mob.windup - dt);
      if (Math.abs(toPlayerX) > 2) mob.facing = toPlayerX < 0 ? -1 : 1;
      targetDx = -mob.facing * 26;
      targetDy = clamp(toPlayerY * 0.4, -18, 18);
      accel = 9;
      if (mob.windup === 0) {
        mob.dashDx = (toPlayerX / dist) * 210;
        mob.dashDy = (toPlayerY / dist) * 165;
        mob.dash = 0.6;
        mob.attackTimer = 3.2 + (mob.phase % 1.2);
        effects.push({
          x: mob.x - mob.facing * 16,
          y: mob.y,
          color: '#a1d9cb',
          count: 6,
          spread: 44,
        });
      }
    } else if (
      playerInWater &&
      dist < 170 &&
      Math.abs(px - mob.homeX) < mob.span + 105 &&
      mob.cooldown === 0
    ) {
      targetDx = (toPlayerX / dist) * mob.speed * 0.85;
      targetDy = (toPlayerY / dist) * mob.speed * 0.68;
      mob.attackTimer -= dt;
      if (mob.attackTimer <= 0 && dist < 145) mob.windup = 0.45;
    } else {
      if (mob.x > mob.homeX + mob.span) mob.facing = -1;
      else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
      targetDx = mob.facing * mob.speed;
      const targetY = mob.homeY + Math.sin(time * 1.2 + mob.phase) * 9;
      targetDy = clamp((targetY - mob.y) * 1.8, -26, 26);
    }

    return {
      targetDx,
      targetDy,
      accel,
      dashingShark: (mob.dash ?? 0) > 0,
    };
  });
}
