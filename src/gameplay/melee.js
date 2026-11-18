import { CHARACTER_BODIES } from '../content.js';
import { clamp } from '../world/generation.js';
import { CRAWL_HEIGHT } from './player.js';

export function frontShoulder(player, appearance) {
  if (player.height === CRAWL_HEIGHT) return { x: 1, y: 10 };
  return { x: (CHARACTER_BODIES[appearance.body].shoulder - 5) / 2, y: 11 };
}

export function characterTilt(player, swimming, facing) {
  return swimming && player.height !== CRAWL_HEIGHT ? clamp(player.dy * 0.0022, -0.3, 0.3) * facing : 0;
}

// Pose is in front-arm coordinates, with positive x toward the weapon tip.
export function meleePose(attack) {
  const phase = clamp(1 - attack.timer / attack.duration, 0, 1);
  const aim = Math.atan2(Math.sin(attack.angle), Math.abs(Math.cos(attack.angle)));
  if (attack.tier) {
    const windup = 0.22;
    const followThrough = 0.68;
    const swing = phase < windup ? -phase / windup
      : phase <= followThrough ? -1 + 1.3 * (phase - windup) / (followThrough - windup)
        : 0.3 * (1 - phase) / (1 - followThrough);
    const active = phase >= windup && phase <= followThrough;
    return { angle: aim + swing, bounds: active ? [12, -4, 3, 8] : null };
  }

  const spear = attack.kind !== 'melee';
  const thrust = Math.round(Math.sin(phase * Math.PI) * (spear ? 9 : 5));
  const active = phase >= 0.18 && phase <= 0.66;
  const x = thrust + (spear ? 7 : 5);
  const bounds = active ? [x, -2, spear ? 14 : 2, 4] : null;
  return { angle: aim, thrust, bounds };
}

export function meleeHitbox(player, attack, swimming) {
  const { angle, bounds } = meleePose(attack);
  if (!bounds) return null;
  const { facing } = attack;
  const tilt = characterTilt(player, swimming, facing);
  const shoulder = frontShoulder(player, player.appearance);
  const shoulderX = Math.cos(tilt) * shoulder.x - Math.sin(tilt) * shoulder.y;
  const shoulderY = Math.sin(tilt) * shoulder.x + Math.cos(tilt) * shoulder.y;
  const [left, top, width, height] = bounds;
  const localX = left + width / 2;
  const localY = top + height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: Math.round(player.x) + facing * (shoulderX + cos * localX - sin * localY),
    y: Math.round(player.y) + shoulderY + sin * localX + cos * localY,
    ux: facing * cos, uy: sin, halfWidth: width / 2, halfHeight: height / 2,
  };
}

export function overlapsMob(hitbox, mob, spec) {
  const { x, y, ux, uy, halfWidth, halfHeight } = hitbox;
  const dx = mob.x - x;
  const dy = mob.y + spec.centerY - y;
  const mx = spec.width / 2;
  const my = spec.height / 2;
  const cos = Math.abs(ux);
  const sin = Math.abs(uy);
  // Check the two world axes and the two rotated weapon axes.
  return Math.abs(dx) <= mx + halfWidth * cos + halfHeight * sin &&
    Math.abs(dy) <= my + halfWidth * sin + halfHeight * cos &&
    Math.abs(dx * ux + dy * uy) <= halfWidth + mx * cos + my * sin &&
    Math.abs(-dx * uy + dy * ux) <= halfHeight + mx * sin + my * cos;
}
