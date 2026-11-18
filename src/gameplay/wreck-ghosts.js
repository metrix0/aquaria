import { MATERIAL } from '../content.js';
import { inWater, tileAt } from '../world.js';
import { MOB_HEALTH, TILE, WEST_EXTENSION, clamp } from '../world/generation.js';
import { isInsideShipwreck } from '../world/shipwreck.js';
import { takeDamage } from './player.js';

const CHECK_INTERVAL = 150;
const SPAWN_CHANCE = .06;
const LIFETIME = 42;

export const wreckGhostSpec = {
  name: 'wreck ghost', width: 14, height: 22, radius: 10, centerY: 0,
  maxHealth: MOB_HEALTH.ghost, color: '#91e5d8',
};

function inHull(x, y) {
  return isInsideShipwreck(Math.floor(x / TILE) - WEST_EXTENSION, Math.floor(y / TILE));
}

function canGlide(world, x, y) {
  if (!inHull(x, y)) return false;
  const tile = tileAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
  return tile === MATERIAL.air || tile === MATERIAL.wood;
}

export function stepWreckGhost(world, player, ghost, dt, time, effects) {
  const px = player.x;
  const py = player.y + player.height / 2;
  const playerInWreck = inHull(px, py) && inWater(world, px, py);
  ghost.spawnCheckIn = Math.max(0, ghost.spawnCheckIn - dt);

  if (ghost.health <= 0) {
    if (ghost.resident || !playerInWreck || ghost.spawnCheckIn > 0) return;
    ghost.spawnCheckIn = CHECK_INTERVAL;
    if (!inWater(world, ghost.homeX, ghost.homeY) || Math.random() >= SPAWN_CHANCE) return;
    Object.assign(ghost, {
      x: ghost.homeX, y: ghost.homeY, dx: 0, dy: 0, cooldown: 1.2, flee: 0, hurt: 0,
      health: ghost.maxHealth, remainingLife: LIFETIME,
    });
    effects.push({ x: ghost.x, y: ghost.y, color: wreckGhostSpec.color, count: 10, spread: 35 });
    return;
  }

  if (!ghost.resident) {
    ghost.remainingLife -= dt;
    if (ghost.remainingLife <= 0) {
      ghost.health = 0;
      return;
    }
  }
  ghost.cooldown = Math.max(0, ghost.cooldown - dt);
  ghost.flee = Math.max(0, ghost.flee - dt);
  const patrolX = ghost.homeX + Math.sin(time * .78 + ghost.phase) * 23;
  const patrolY = ghost.homeY + Math.cos(time * 1.3 + ghost.phase) * 8;
  const chasing = playerInWreck && Math.hypot(px - ghost.homeX, py - ghost.homeY) < 6 * TILE;
  const targetX = chasing ? px : patrolX;
  const targetY = chasing ? py : patrolY;
  const speed = chasing ? 46 : 20;

  if (ghost.flee === 0) {
    const ease = Math.min(1, dt * 5);
    ghost.dx += (clamp((targetX - ghost.x) * 2, -speed, speed) - ghost.dx) * ease;
    ghost.dy += (clamp((targetY - ghost.y) * 2, -speed, speed) - ghost.dy) * ease;
  } else {
    ghost.dx *= Math.exp(-5 * dt);
    ghost.dy *= Math.exp(-5 * dt);
  }
  if (Math.abs(ghost.dx) > 3) ghost.facing = Math.sign(ghost.dx);
  const nextX = ghost.x + ghost.dx * dt;
  const nextY = ghost.y + ghost.dy * dt;
  if (canGlide(world, nextX, ghost.y)) ghost.x = nextX;
  if (canGlide(world, ghost.x, nextY)) ghost.y = nextY;

  const dx = px - ghost.x;
  const dy = py - ghost.y;
  const distance = Math.hypot(dx, dy);
  if (!playerInWreck || player.flightOrigin || player.hurt > 0 || ghost.cooldown > 0 || ghost.flee > 0 ||
      distance >= 14 || !inWater(world, ghost.x, ghost.y)) return;
  ghost.cooldown = 2.3;
  player.hurt = 1.15;
  player.dx = dx / Math.max(1, distance) * 95;
  player.dy = dy / Math.max(1, distance) * 85 - 12;
  player.oxygen = Math.max(0, player.oxygen - 3);
  const loss = takeDamage(player, 18);
  effects.push({
    x: ghost.x, y: ghost.y, color: wreckGhostSpec.color, count: 9, spread: 56,
    message: 'The ghost stole your breath. −' + loss + ' health',
  });
}
