import { CHARACTER_BODIES, COBALT_SPEAR, IRON_SWORD } from '../content.js';
import { clamp } from '../world/generation.js';
import { CRAWL_HEIGHT } from './player.js';

export function frontShoulder(player, appearance) {
  if (player.height === CRAWL_HEIGHT) return { x: 1, y: 10 };
  return { x: (CHARACTER_BODIES[appearance.body].shoulder - 5) / 2, y: 11 };
}

export function characterTilt(player, swimming, facing) {
  return swimming && player.height !== CRAWL_HEIGHT ? clamp(player.dy * 0.0022, -0.3, 0.3) * facing : 0;
}

export function pickaxePose(phase, aim = 0, tier = 1) {
  const head = tier === 1 ? [11, -5, 5, 9] : [11, -5, 7, 11];
  return swingPose(phase, aim, head);
}

function swingPose(phase, aim, bounds) {
  const raised = .22;
  const impact = .68;
  const swing = phase < raised ? -phase / raised
    : phase <= impact ? -1 + 1.3 * (phase - raised) / (impact - raised)
      : .3 * (1 - phase) / (1 - impact);
  return { angle: aim + swing, bounds: phase >= raised && phase <= impact ? bounds : null };
}

// Pose is in front-arm coordinates, with positive x toward the weapon tip.
export function meleePose(attack) {
  const phase = clamp(1 - attack.timer / attack.duration, 0, 1);
  const aim = Math.atan2(Math.sin(attack.angle), Math.abs(Math.cos(attack.angle)));
  if (attack.tier) return pickaxePose(phase, aim, attack.tier);
  if (attack.kind === IRON_SWORD.id) return swingPose(phase, aim, IRON_SWORD.blade);

  const spear = attack.kind !== 'melee';
  const thrust = Math.round(Math.sin(phase * Math.PI) * (spear ? 9 : 5));
  const active = phase >= 0.18 && phase <= 0.66;
  const x = thrust + (spear ? 7 : 5);
  const reach = attack.kind === COBALT_SPEAR.id ? COBALT_SPEAR.reach : 0;
  const bounds = active ? [x, -2, spear ? 14 + reach : 2, 4] : null;
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
  return toolHitbox(Math.round(player.x) + facing * shoulderX, Math.round(player.y) + shoulderY,
    facing, angle, bounds);
}

export function toolHitbox(x, y, facing, angle, bounds) {
  const [left, top, width, height] = bounds;
  const localX = left + width / 2;
  const localY = top + height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x + facing * (cos * localX - sin * localY),
    y: y + sin * localX + cos * localY,
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
