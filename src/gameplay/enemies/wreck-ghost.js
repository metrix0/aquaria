import { MATERIAL } from '../../content.js';
import { inWater, tileAt } from '../../world.js';
import { MOB_HEALTH, TILE, WEST_EXTENSION } from '../../world/generation.js';
import { isInsideShipwreck } from '../../world/shipwreck.js';
import { takeDamage } from '../player.js';

export const wreckGhostSpec = {
  name: 'wreck spirit', width: 14, height: 22, radius: 10, centerY: 0,
  maxHealth: MOB_HEALTH.ghost, color: '#91e5d8',
};
export const captainGhostSpec = {
  ...wreckGhostSpec, name: 'captain’s spirit', width: 21, height: 33, radius: 15,
  maxHealth: 12, color: '#b6efea',
};
export { CREW_CUTLASS_CHANCE } from '../../loot.js';
export const GHOST_SUMMON_COOLDOWN = 40;
export const GHOST_MINION_LIMIT = 2;
export const GHOST_HAND_DURATION = .7;
export function ghostHandReach(timer) {
  const elapsed = Math.max(0, Math.min(GHOST_HAND_DURATION, GHOST_HAND_DURATION - timer));
  return 13 + 57 * (elapsed < .42 ? elapsed / .42 : (GHOST_HAND_DURATION - elapsed) / .28);
}
export function removeGhostMinions(world, parentId) {
  for (let i = world.mobs.length - 1; i >= 0; i--) {
    const mob = world.mobs[i];
    if (mob.ghostMinion && (parentId == null || mob.ghostParent === parentId)) world.mobs.splice(i, 1);
  }
}
function summonCrew(world, ghost, effects) {
  const active = world.mobs.filter(m => m.ghostMinion && m.ghostParent === ghost.id && m.health > 0).length;
  if (active >= GHOST_MINION_LIMIT) return;
  ghost.ghostSummonCooldown = GHOST_SUMMON_COOLDOWN;
  const spots = [];
  for (const side of [-1, 1]) {
    if (spots.length >= GHOST_MINION_LIMIT - active) break;
    for (const [ox, oy] of [[32, -16], [48, 0], [16, -32], [32, 16], [16, 0], [0, -32]]) {
      const x = ghost.x + side * ox, y = ghost.y + oy;
      if (!canGlide(world, ghost, x, y) || (!ghost.testSpawn && !inWater(world, x, y))) continue;
      if (tileAt(world, Math.floor(x / TILE), Math.floor(y / TILE)) !== MATERIAL.air) continue;
      if (world.mobs.some(m => m.kind === 'ghost' && m.health > 0 && Math.hypot(m.x - x, m.y - y) < 18)) continue;
      spots.push({ x, y });
      world.mobs.push({
        id: ghost.id + ':summon:' + (ghost.ghostSummonSerial = (ghost.ghostSummonSerial || 0) + 1),
        kind: 'ghost', ghostMinion: true, ghostParent: ghost.id, resident: false,
        testSpawn: ghost.testSpawn === true, remainingLife: 30,
        x, y, homeX: ghost.homeX, homeY: ghost.homeY, dx: 0, dy: 0, phase: side * 2,
        facing: -side, health: wreckGhostSpec.maxHealth, maxHealth: wreckGhostSpec.maxHealth,
        cooldown: .9, flee: 0, hurt: 0, respawn: 0,
      });
      effects.push({ x, y, color: '#b6efea', count: 12, spread: 35 });
      break;
    }
  }
}

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
  effects.push({ x: ghost.x, y: ghost.y, color: '#a4e6db', count: 12, spread: 68,
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
  if (boss) {
    ghost.ghostSummonCooldown = Math.max(0, (ghost.ghostSummonCooldown || 0) - dt);
    if (chasing && ghost.health <= ghost.maxHealth * .5 && !ghost.ghostSummonCooldown) summonCrew(world, ghost, effects);
  }
  if (!chasing || ghost.flee > 0) {
    ghost.ghostAttack = null;
    ghost.ghostTimer = 0;
  }
  if (ghost.ghostAttack) {
    const previousTimer = ghost.ghostTimer;
    ghost.ghostTimer -= dt;
    if (ghost.ghostAttack === 'hand') {
      ghost.dx = ghost.dy = 0;
      const reach = ghostHandReach(ghost.ghostTimer);
      const previousReach = ghostHandReach(previousTimer);
      const peakCrossed = previousTimer > GHOST_HAND_DURATION - .42 && ghost.ghostTimer <= GHOST_HAND_DURATION - .42;
      const along = dx * ghost.ghostAimX + dy * ghost.ghostAimY;
      const across = Math.abs(dx * ghost.ghostAimY - dy * ghost.ghostAimX);
      const nearest = Math.max(Math.min(reach, previousReach), Math.min(peakCrossed ? 70 : Math.max(reach, previousReach), along));
      if (!ghost.ghostHit && chasing && Math.hypot(along - nearest, across) <= 14) {
        ghost.ghostHit = true;
        strike(player, ghost, dx, dy, 25, 4, effects);
      }
      if (ghost.ghostTimer <= 0) {
        ghost.ghostAttack = 'recover'; ghost.ghostTimer = .45; ghost.cooldown = 2.3;
      }
      return;
    }
    if (ghost.ghostAttack === 'dash') {
      ghost.dx = ghost.ghostAimX * 150;
      ghost.dy = ghost.ghostAimY * 150;
      const oldX = ghost.x, oldY = ghost.y;
      move(world, ghost, Math.min(dt, previousTimer));
      const sx = ghost.x - oldX, sy = ghost.y - oldY;
      const t = Math.max(0, Math.min(1, ((px - oldX) * sx + (py - oldY) * sy) / (sx * sx + sy * sy || 1)));
      if (!ghost.ghostHit && chasing && Math.hypot(px - oldX - sx * t, py - oldY - sy * t) < 17) {
        ghost.ghostHit = true;
        strike(player, ghost, px - ghost.x, py - ghost.y, 16, 3, effects);
      }
      if (ghost.ghostTimer <= 0) {
        ghost.ghostAttack = 'recover'; ghost.ghostTimer = .3; ghost.cooldown = 1.7;
      }
      return;
    }
    if (ghost.ghostTimer > 0) { ghost.dx = ghost.dy = 0; return; }
    ghost.ghostAttack = null;
  }
  if (chasing && !ghost.flee && !ghost.cooldown && distance < (boss ? 77 : 65)) {
    ghost.ghostAttack = boss ? 'hand' : 'dash';
    ghost.ghostTimer = boss ? GHOST_HAND_DURATION : .48;
    ghost.ghostAimX = distance > .01 ? dx / distance : (ghost.facing || 1);
    ghost.ghostAimY = distance > .01 ? dy / distance : 0;
    ghost.ghostHit = false;
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
