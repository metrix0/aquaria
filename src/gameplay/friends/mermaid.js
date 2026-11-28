import { MATERIAL } from '../../content.js';
import { MOB_HEALTH } from '../../world/generation.js';
import { fishCollides } from './fish.js';

export const mermaidSpec = {
  name: 'mermaid', width: 22, height: 30, radius: 16, centerY: 1,
  material: MATERIAL.sand, maxHealth: MOB_HEALTH.mermaid,
};

// Normal swimming is 102 horizontally / 94 vertically. A mermaid is about 15% faster.
const HORIZONTAL_SPEED = 118;
const VERTICAL_SPEED = 108;
const FLEE_RANGE = 112;
const angles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];

export function mermaidCollides(world, player, x, y) {
  return fishCollides(world, player, x, y + mermaidSpec.centerY, mermaidSpec.width, mermaidSpec.height);
}

export function stepMermaid(world, player, mob, dt) {
  const px = player.x;
  const py = player.y + player.height / 2;
  const dx = mob.x - px;
  const dy = mob.y - py;
  const distance = Math.hypot(dx, dy);
  if (distance < FLEE_RANGE) mob.flee = 0.75;
  if (!(mob.flee > 0)) {
    mob.dx = mob.dy = 0;
    return;
  }

  const direction = distance > 0.01 ? Math.atan2(dy, dx) : (mob.facing < 0 ? Math.PI : 0);
  // Try the direct escape, then steer along obstacles. Never swim toward the player.
  let best = null;
  for (const angle of angles) {
    const x = Math.cos(direction + angle);
    const y = Math.sin(direction + angle);
    const axis = Math.max(Math.abs(x), Math.abs(y));
    const vx = x / axis * HORIZONTAL_SPEED;
    const vy = y / axis * VERTICAL_SPEED;
    const nextX = mob.x + vx * dt;
    const nextY = mob.y + vy * dt;
    if (mermaidCollides(world, player, nextX, nextY)) continue;
    const nextDistance = Math.hypot(nextX - px, nextY - py);
    if (nextDistance <= distance) continue;
    best = { vx, vy, nextX, nextY };
    break;
  }
  if (!best) {
    mob.dx = mob.dy = 0;
    return;
  }
  mob.dx = best.vx;
  mob.dy = best.vy;
  mob.x = best.nextX;
  mob.y = best.nextY;
  if (Math.abs(mob.dx) > 1) mob.facing = Math.sign(mob.dx);
}
