import { MATERIAL } from '../../content.js';
import { inWater, tileAt } from '../../world.js';
import { MOB_HEALTH, TILE, WEST_EXTENSION } from '../../world/generation.js';
import { isInsideShipwreck } from '../../world/shipwreck.js';
import { takeDamage } from '../player.js';

export const wreckGhostSpec = {
  name: 'wreck spirit', width: 14, height: 22, radius: 10, centerY: 0,
  maxHealth: MOB_HEALTH.ghost, color: '#e79bba',
};
export const captainGhostSpec = {
  ...wreckGhostSpec, name: 'captain’s spirit', width: 21, height: 33, radius: 15,
  maxHealth: 12, color: '#ffb2b3',
};
export const CREW_CUTLASS_CHANCE = .05;

function inHull(x, y) {
  return isInsideShipwreck(Math.floor(x / TILE) - WEST_EXTENSION, Math.floor(y / TILE));
}
function canGlide(world, ghost, x, y) {
  if (!ghost.testSpawn && !inHull(x, y)) return false;
  const tile = tileAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
  return tile === MATERIAL.air || tile === MATERIAL.wood;
}
function move(world, ghost, dt) {
  const nx = ghost.x + ghost.dx * dt, ny = ghost.y + ghost.dy * dt;
  if (canGlide(world, ghost, nx, ghost.y)) ghost.x = nx;
  if (canGlide(world, ghost, ghost.x, ny)) ghost.y = ny;
}
function strike(player, ghost, dx, dy, damage, oxygen, effects) {
  if (player.flightOrigin || player.hurt > 0 || player.health <= 0) return;
  const distance = Math.hypot(dx, dy) || 1;
  player.hurt = 1.15;
  player.dx = dx / distance * 95;
  player.dy = dy / distance * 85 - 12;
  player.oxygen = Math.max(0, player.oxygen - oxygen);
  const loss = takeDamage(player, damage);
  effects.push({ x: ghost.x, y: ghost.y, color: '#f58a9c', count: 12, spread: 68,
    message: 'Spectral assault. −' + loss + ' health' });
}

export function stepWreckGhost(world, player, ghost, dt, time, effects) {
  if (ghost.health <= 0) return;
  const boss = ghost.resident;
  const px = player.x, py = player.y + player.height / 2;
  const dx = px - ghost.x, dy = py - ghost.y, distance = Math.hypot(dx, dy);
  const chasing = (ghost.testSpawn || (inHull(px, py) && inWater(world, px, py))) &&
    Math.hypot(px - ghost.homeX, py - ghost.homeY) < (boss ? 14 : 10) * TILE;
  ghost.cooldown = Math.max(0, (ghost.cooldown || 0) - dt);
  ghost.flee = Math.max(0, (ghost.flee || 0) - dt);
  if (!chasing || ghost.flee > 0) {
    ghost.ghostAttack = null;
    ghost.ghostTimer = 0;
  }
  if (ghost.ghostAttack) {
    ghost.ghostTimer -= dt;
    if (ghost.ghostAttack === 'windup') {
      ghost.dx = ghost.dy = 0;
      if (ghost.ghostTimer <= 0) {
        if (ghost.ghostPattern === 'pulse') {
          ghost.ghostAttack = 'recover';
          ghost.ghostTimer = .55;
          ghost.cooldown = 1.65;
          if (chasing && distance <= 48) strike(player, ghost, dx, dy, 26, 5, effects);
          effects.push({x: ghost.x, y: ghost.y, color: '#fa779f', count: 30, spread: 105});
        } else {
          ghost.ghostAttack = 'dash';
          ghost.ghostTimer = .48;
          ghost.ghostHit = false;
        }
      }
      return;
    }
    if (ghost.ghostAttack === 'dash') {
      ghost.dx = ghost.ghostAimX * (boss ? 158 : 132);
      ghost.dy = ghost.ghostAimY * (boss ? 158 : 132);
      move(world, ghost, dt);
      if (!ghost.ghostHit && chasing && Math.hypot(px - ghost.x, py - ghost.y) < (boss ? 23 : 17)) {
        ghost.ghostHit = true;
        strike(player, ghost, px - ghost.x, py - ghost.y, boss ? 23 : 16, boss ? 4 : 3, effects);
      }
      if (ghost.ghostTimer <= 0) {
        ghost.ghostAttack = 'recover'; ghost.ghostTimer = .48; ghost.cooldown = boss ? 1.5 : 2;
      }
      return;
    }
    if (ghost.ghostTimer > 0) { ghost.dx = ghost.dy = 0; return; }
    ghost.ghostAttack = null;
  }
  if (chasing && !ghost.flee && !ghost.cooldown && distance < (boss ? 70 : 48)) {
    ghost.ghostPattern = boss && (ghost.ghostSequence || 0) % 2 === 0 ? 'pulse' : 'dash';
    ghost.ghostSequence = (ghost.ghostSequence || 0) + 1;
    ghost.ghostAttack = 'windup'; ghost.ghostTimer = boss ? .85 : .5;
    ghost.ghostAimX = dx / (distance || 1); ghost.ghostAimY = dy / (distance || 1);
    ghost.facing = Math.sign(dx) || ghost.facing;
    ghost.dx = ghost.dy = 0;
    return;
  }
  const targetX = chasing ? px : ghost.homeX + Math.sin(time * .78 + ghost.phase) * 20;
  const targetY = chasing ? py : ghost.homeY + Math.cos(time * 1.3 + ghost.phase) * 8;
  const tx = targetX - ghost.x, ty = targetY - ghost.y, d = Math.hypot(tx, ty) || 1;
  const speed = Math.min(d * 2, chasing ? (boss ? 62 : 55) : 20);
  const ease = Math.min(1, dt * 5);
  ghost.dx += ((ghost.flee ? 0 : tx / d * speed) - ghost.dx) * ease;
  ghost.dy += ((ghost.flee ? 0 : ty / d * speed) - ghost.dy) * ease;
  if (Math.abs(ghost.dx) > 3) ghost.facing = Math.sign(ghost.dx);
  move(world, ghost, dt);
}
