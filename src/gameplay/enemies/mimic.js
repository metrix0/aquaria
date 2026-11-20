import { MATERIAL } from '../../content.js';
import { clamp } from '../../world/generation.js';
import { overlapsMob, toolHitbox } from '../melee.js';
import { hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

const MIMIC_LEAP_SPEED = 128;
const MIMIC_LEAP_DY = 194;
const MIMIC_BITE_DURATION = 0.34;
const MIMIC_BITE_COOLDOWN = 0.72;
const MIMIC_BITE_DAMAGE = 15;

export const mimicSpec = {
  ...makeCaveEnemySpec('mimic', 'mimic', 20, 16, 76, MIMIC_BITE_DAMAGE, 30),
  color: '#d0a06a',
  material: MATERIAL.wood,
};

/**
 * Wakes a dormant dungeon mimic into active pursuit with a startled hop and warning burst.
 */
export function wakeMimic(world, mob, player, effects) {
  if (!mob || mob.kind !== 'mimic' || mob.awakened || mob.health <= 0 || mob.respawn > 0) return false;
  mob.awakened = true;
  if (player) mob.facing = player.x < mob.x ? -1 : 1;
  mob.dy = -125;
  mob.grounded = false;
  mob.leapCooldown = 0.22;
  mob.biteTimer = 0.28;
  mob.biteHit = false;
  mob.attackTimer = 0.25;
  effects?.push({
    x: mob.x,
    y: mob.y - 8,
    material: MATERIAL.wood,
    color: '#edd09a',
    count: 10,
    spread: 72,
    message: 'The chest is a mimic!',
  });
  return true;
}

export function stepMimic(world, player, mob, dt, effects) {
  if (!mob.awakened) {
    mob.x = mob.homeX;
    mob.y = mob.homeY;
    mob.dx = 0;
    mob.dy = 0;
    mob.grounded = true;
    mob.biteTimer = 0;
    mob.biteHit = false;
    mob.windup = 0;
    mob.leapCooldown = 0;
    return;
  }

  mob.leapCooldown = Math.max(0, (mob.leapCooldown ?? 0) - dt);
  if (mob.flee > 0) {
    mob.biteTimer = 0;
    mob.biteHit = false;
    mob.leapCooldown = 0;
  }

  stepCaveEnemyBase(world, player, mob, mimicSpec, dt, effects, {
    sightRange: 280,
    leashRange: 280,
    chaseDistance: 14,
    jumpSpeed: 215,
    stepActive({ active, distance, deltaX, deltaY }) {
      if ((mob.biteTimer ?? 0) > 0) {
        mob.biteTimer = Math.max(0, mob.biteTimer - dt);
        const progress = 1 - clamp(mob.biteTimer / MIMIC_BITE_DURATION, 0, 1);
        if (active && !mob.biteHit && progress >= 0.2 && progress <= 0.8) {
          const reach = Math.round(4 + progress * 8);
          const hitbox = toolHitbox(Math.round(mob.x), Math.round(mob.y) - 9, mob.facing, 0, [reach - 10, -10, 22, 18]);
          if (overlapsMob(hitbox, player, { width: player.width, height: player.height, centerY: player.height / 2 })) {
            mob.biteHit = true;
            hurtPlayer(player, MIMIC_BITE_DAMAGE, mob.facing, 'Bitten by a mimic!', '#d88e6d', effects);
          }
        }
        if (mob.biteTimer === 0) mob.biteHit = false;
        return mob.grounded ? 0 : mob.facing * MIMIC_LEAP_SPEED;
      }

      if (!active) return undefined;

      mob.facing = deltaX >= 0 ? 1 : -1;
      // Mid-air pounce bite when colliding tightly onto the player.
      if (!mob.grounded && mob.attackTimer === 0 && Math.abs(deltaX) <= 18 && Math.abs(deltaY) <= 18) {
        mob.biteTimer = MIMIC_BITE_DURATION;
        mob.biteHit = false;
        mob.attackTimer = MIMIC_BITE_COOLDOWN;
        return mob.facing * MIMIC_LEAP_SPEED;
      }

      if (distance <= mimicSpec.reach && mob.attackTimer === 0) {
        return undefined;
      }

      if (!mob.grounded) {
        return distance > 12 ? mob.facing * MIMIC_LEAP_SPEED : 0;
      }

      if (distance > 18 && Math.abs(mob.x - mob.homeX) < 280) {
        if (mob.leapCooldown > 0) return 0;
        mob.dy = -MIMIC_LEAP_DY;
        mob.grounded = false;
        mob.leapCooldown = 0.26 + (mob.phase % 0.14);
        mob.jumpCooldown = 0.4;
        return mob.facing * MIMIC_LEAP_SPEED;
      }
      return undefined;
    },
    startAttack() {
      mob.biteTimer = MIMIC_BITE_DURATION;
      mob.biteHit = false;
      mob.attackTimer = MIMIC_BITE_COOLDOWN;
      if (mob.grounded) {
        mob.dy = -135;
        mob.grounded = false;
      }
    },
  });
}
