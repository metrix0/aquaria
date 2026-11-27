import { harmful } from '../effect-potency.js';
import { MATERIAL } from '../../content.js';
import { takeDamage } from '../player.js';
import { MOB_HEALTH, clamp } from '../../world/generation.js';
import { stepSeaEnemy } from './sea-shared.js';

const JELLYFISH_SHOCK_DURATION = 0.85;

export const jellyfishSpec = {
  name: 'jellyfish',
  width: 12,
  height: 18,
  radius: 11,
  centerY: 0,
  damage: 3,
  healthDamage: 16,
  message: 'Stung by a jellyfish.',
  material: MATERIAL.reef,
  maxHealth: MOB_HEALTH.jellyfish,
};

export function jellyfishShockRadius(shock) {
  if (!(shock > 0)) return 0;
  const expand = Math.min(1, (JELLYFISH_SHOCK_DURATION - shock) / 0.18);
  return 18 + expand * 44;
}

export function stepJellyfish(world, player, mob, dt, time, effects, ctx) {
  stepSeaEnemy(world, player, mob, jellyfishSpec, dt, effects, ctx, ({ px, py, dist, playerInWater, toPlayerX, toPlayerY }) => {
    const targetX = mob.homeX + Math.sin(time * 0.55 + mob.phase) * mob.span;
    const targetY = mob.homeY + Math.sin(time * 1.5 + mob.phase * 1.7) * 16;
    let targetDx = clamp((targetX - mob.x) * 1.4, -mob.speed, mob.speed);
    let targetDy = clamp((targetY - mob.y) * 2.1, -mob.speed * 1.3, mob.speed * 1.3);

    if ((mob.shock ?? 0) > 0) {
      mob.shock = Math.max(0, mob.shock - dt);
      const shockRadius = jellyfishShockRadius(mob.shock);
      if (
        !player.flightOrigin &&
        playerInWater &&
        !mob.shockHit &&
        (player.hurt ?? 0) >= 0 &&
        dist <= shockRadius
      ) {
        mob.shockHit = true;
        player.hurt = 1.2;
        player.stun = harmful(player,2.5);
        mob.cooldown = 1.8;
        player.dx = (toPlayerX / dist) * 115;
        player.dy = (toPlayerY / dist) * 95 - 12;
        takeDamage(player, 20);
        player.oxygen = Math.max(0, player.oxygen - 3);
        effects.push({
          x: px,
          y: py,
          color: '#ffe44d',
          count: 12,
          spread: 75,
          message: 'Shocked by a jellyfish! Stunned!',
          shake: { intensity: 11, duration: 0.75, frequency: 46 },
        });
      }
    } else if (mob.windup > 0) {
      mob.windup = Math.max(0, mob.windup - dt);
      targetDx *= 0.25;
      targetDy *= 0.25;
      if (mob.windup === 0) {
        mob.shock = JELLYFISH_SHOCK_DURATION;
        mob.shockHit = false;
        mob.attackTimer = 4.4 + (mob.phase % 1.4);
        effects.push({
          x: mob.x,
          y: mob.y,
          color: '#38bdf8',
          count: 10,
          spread: 80,
        });
      }
    } else if (playerInWater && mob.cooldown === 0 && dist < 96) {
      mob.attackTimer -= dt;
      if (mob.attackTimer <= 0) mob.windup = 0.72;
    }

    return { targetDx, targetDy };
  });
}
