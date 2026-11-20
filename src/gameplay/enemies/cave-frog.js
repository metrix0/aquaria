import { collides } from '../player.js';
import { clamp } from '../../world/generation.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

const TONGUE_SPEED = 430;
const TONGUE_PULL_SPEED = 245;
const TONGUE_MAX_LENGTH = 136;
const FROG_LEAP_SPEED = 138;
const FROG_LEAP_DY = 192;
const BITE_DAMAGE = 18;

export const caveFrogSpec = {
  ...makeCaveEnemySpec('cave-frog', 'giant cave frog', 20, 18, 86, BITE_DAMAGE, 128),
  color: '#74ab72',
};

function pullPlayerToward(world, player, targetX, targetY, speed, dt) {
  const centerY = player.y + player.height / 2;
  const dx = targetX - player.x;
  const dy = targetY - centerY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return dist;
  const step = Math.min(dist, speed * dt);
  const mx = (dx / dist) * step;
  const my = (dy / dist) * step;
  if (!collides(world, player.x + mx, player.y, player.height)) player.x += mx;
  if (!collides(world, player.x, player.y + my, player.height)) player.y += my;
  player.dx = 0;
  player.dy = 0;
  return Math.hypot(targetX - player.x, targetY - (player.y + player.height / 2));
}

export function stepCaveFrog(world, player, mob, dt, effects) {
  if (mob.leapCooldown == null) {
    mob.leapCooldown = 0;
    mob.biteTimer = 0;
    mob.tongue = null;
  }
  mob.leapCooldown = Math.max(0, mob.leapCooldown - dt);
  mob.biteTimer = Math.max(0, (mob.biteTimer ?? 0) - dt);

  if (mob.hurt > 0 || mob.flee > 0 || mob.health <= 0 || player.flightOrigin) {
    mob.tongue = null;
  }

  const mouthX = mob.x + mob.facing * 7;
  const mouthY = mob.y - 10;
  const leashRange = 225;

  stepCaveEnemyBase(world, player, mob, caveFrogSpec, dt, effects, {
    sightRange: 230,
    leashRange,
    chaseDistance: 16,
    windupDuration: 0.26,
    attackCooldown: 1.55,
    jumpSpeed: 215,
    stepActive({ active, distance, deltaX }) {
      if (mob.tongue) {
        const tongue = mob.tongue;
        if (tongue.state === 'shoot') {
          const oldX = tongue.tipX;
          const oldY = tongue.tipY;
          tongue.tipX += tongue.dirX * TONGUE_SPEED * dt;
          tongue.tipY += tongue.dirY * TONGUE_SPEED * dt;
          const length = Math.hypot(tongue.tipX - mouthX, tongue.tipY - mouthY);
          if (!clearPath(world, oldX, oldY, tongue.tipX, tongue.tipY) || length >= TONGUE_MAX_LENGTH) {
            tongue.state = 'retract';
          } else if (
            !player.flightOrigin &&
            Math.abs(player.x - tongue.tipX) <= player.width / 2 + 5 &&
            tongue.tipY + 5 >= player.y &&
            tongue.tipY - 5 <= player.y + player.height
          ) {
            tongue.state = 'pull';
            tongue.grabbed = true;
            tongue.timer = 0.75;
            effects.push({ x: player.x, y: player.y + player.height / 2, color: '#e06e85', count: 5, spread: 36, message: 'Snared by a frog tongue!' });
          }
        } else if (tongue.state === 'pull') {
          tongue.timer -= dt;
          if (player.flightOrigin || tongue.timer <= 0) {
            mob.tongue = null;
          } else {
            const remaining = pullPlayerToward(world, player, mouthX, mouthY, TONGUE_PULL_SPEED, dt);
            tongue.tipX = player.x;
            tongue.tipY = player.y + player.height * 0.55;
            if (remaining <= 20) {
              mob.tongue = null;
              mob.biteTimer = 0.26;
              mob.attackTimer = 1.6;
              hurtPlayer(player, BITE_DAMAGE, mob.facing, 'Bitten by a giant cave frog!', '#d96b78', effects);
            }
          }
        } else {
          // Retract missed tongue back into the mouth
          const dx = mouthX - tongue.tipX;
          const dy = mouthY - tongue.tipY;
          const d = Math.hypot(dx, dy);
          const back = TONGUE_SPEED * 1.15 * dt;
          if (d <= back) mob.tongue = null;
          else {
            tongue.tipX += (dx / d) * back;
            tongue.tipY += (dy / d) * back;
          }
        }
        return 0;
      }

      if (mob.windup > 0) {
        mob.facing = deltaX >= 0 ? 1 : -1;
        return undefined;
      }

      if (!active || (distance <= caveFrogSpec.reach && mob.attackTimer === 0)) {
        return undefined;
      }

      mob.facing = deltaX >= 0 ? 1 : -1;
      if (!mob.grounded) {
        return distance > 16 ? mob.facing * FROG_LEAP_SPEED : 0;
      }
      if (distance > 28 && Math.abs(mob.x - mob.homeX) < leashRange) {
        if (mob.leapCooldown > 0) return 0;
        mob.dy = -FROG_LEAP_DY;
        mob.grounded = false;
        mob.leapCooldown = 0.28 + (mob.phase % 0.14);
        mob.jumpCooldown = 0.45;
        return mob.facing * FROG_LEAP_SPEED;
      }
      return undefined;
    },
    startAttack({ distance }) {
      if (distance <= 28) {
        mob.biteTimer = 0.26;
        mob.attackTimer = 1.25;
        hurtPlayer(player, BITE_DAMAGE, mob.facing, 'Bitten by a giant cave frog!', '#d96b78', effects);
      } else {
        mob.windup = 0.26;
      }
    },
    onWindupComplete({ active, distance }) {
      if (!active || distance > caveFrogSpec.reach + 16) return;
      const aimMouthX = mob.x + mob.facing * 7;
      const aimMouthY = mob.y - 10;
      const dx = player.x - aimMouthX;
      const dy = (player.y + player.height / 2) - aimMouthY;
      const len = Math.hypot(dx, dy) || 1;
      mob.tongue = {
        state: 'shoot',
        tipX: aimMouthX,
        tipY: aimMouthY,
        dirX: clamp(dx / len, -1, 1),
        dirY: clamp(dy / len, -0.85, 0.85),
        grabbed: false,
        timer: 0,
      };
      mob.attackTimer = 1.6;
    },
  });
}
