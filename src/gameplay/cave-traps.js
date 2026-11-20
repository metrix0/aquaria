import { applyConfusion, takeDamage } from './player.js';
import { MATERIAL } from '../content.js';
import { editTile, hasTileEdit, tileAt } from '../world.js';
import { TILE } from '../world/generation.js';

const TRAP_IMMUNE_MOBS = new Set(['worm', 'shaman', 'cave-frog', 'frog']);
export const BLEED_DURATION = 10;
export const SWING_CONFUSED_DURATION = 2.4;

function mobOnTrap(world, x, y) {
  return world.mobs.find((mob) => mob.respawnDelay && !TRAP_IMMUNE_MOBS.has(mob.kind) && mob.health > 0 &&
    Math.abs(mob.x - x) < 10 && Math.abs(mob.y - y) < 5);
}

export function isTrapIntact(world, { tx, ty, kind }) {
  if (kind === 'false-ground') {
    return Boolean(tileAt(world, tx, ty)) && tileAt(world, tx, ty - 1) === MATERIAL.air;
  }
  return !hasTileEdit(world, tx, ty) && tileAt(world, tx, ty) === MATERIAL.air &&
    (kind === 'swing' || Boolean(tileAt(world, tx, ty + 1)));
}

export function caveTrapAt(world, tx, ty) {
  return world.caveTraps.find((trap) => trap.tx === tx && trap.ty === ty && isTrapIntact(world, trap));
}

export function swingHead(trap, time) {
  const anchorX = (trap.tx + .5) * TILE;
  const anchorY = trap.ty * TILE + 4;
  const angle = Math.sin(time * 2 + trap.phase) * 1.04;
  return { anchorX, anchorY, x: anchorX + Math.sin(angle) * 44, y: anchorY + Math.cos(angle) * 44 };
}

function hitPlayer(player, effects, damage, x, y, message, status = {}) {
  if (player.flightOrigin || player.hurt > 0) return;
  if (status.confused && ((player.confusedGrace ?? 0) > 0 ||
      ((player.confused ?? 0) > 0 && player.confusedStyle === 'stars'))) {
    return;
  }
  takeDamage(player, damage);
  player.hurt = 1;
  if (status.bleed) {
    player.bleed = Math.max(player.bleed ?? 0, status.bleed);
    if (!(player.bleedTick > 0)) player.bleedTick = 1;
  }
  if (status.confused) {
    applyConfusion(player, status.confused, 'stars');
  }
  effects.push({ x, y, color: status.bleed ? '#c4313d' : '#ca8770', count: 9, spread: 56, message });
}

function crackSiblingFalseGround(world, trap) {
  for (const neighbor of world.caveTraps) {
    if (neighbor === trap || neighbor.kind !== 'false-ground' || neighbor.ty !== trap.ty) continue;
    if (neighbor.state === 'armed' && Math.abs(neighbor.tx - trap.tx) === 1 && isTrapIntact(world, neighbor)) {
      neighbor.state = 'cracking';
      neighbor.timer = trap.timer;
      crackSiblingFalseGround(world, neighbor);
    }
  }
}

export function stepCaveTraps(world, player, elapsed, dt, effects, hurtMob) {
  const feet = player.y + player.height;
  const middle = player.y + player.height / 2;
  for (const trap of world.caveTraps) {
    const x = (trap.tx + .5) * TILE;
    const y = (trap.ty + 1) * TILE;
    if (Math.abs(x - player.x) > 220 || Math.abs(y - middle) > 104 || !isTrapIntact(world, trap)) continue;

    if (trap.kind === 'swing') {
      const head = swingHead(trap, elapsed);
      if (Math.abs(player.x - head.x) <= player.width / 2 + 6 && head.y + 7 >= player.y && head.y - 7 <= feet) {
        hitPlayer(player, effects, 24, head.x, head.y, 'Hit by a spiked pendulum! Confused!', { confused: SWING_CONFUSED_DURATION });
      }
      continue;
    }

    if (trap.kind === 'false-ground') {
      const topY = trap.ty * TILE;
      const steppedOn = !player.flightOrigin && player.grounded &&
        Math.abs(player.x - x) < 10 && Math.abs(feet - topY) < 4;
      if (trap.state === 'armed') {
        if (steppedOn) {
          trap.state = 'cracking';
          trap.timer = .14;
          crackSiblingFalseGround(world, trap);
        }
        continue;
      }
      if (trap.state === 'cracking') {
        trap.timer -= dt;
        if (trap.timer <= 0) {
          const mat = tileAt(world, trap.tx, trap.ty) || MATERIAL.stone;
          editTile(world, trap.tx, trap.ty, MATERIAL.air);
          trap.state = 'broken';
          effects.push({
            x, y: topY + 8, material: mat, count: 8, spread: 58,
            message: steppedOn ? 'The false floor gave way!' : undefined,
          });
        }
      }
      continue;
    }

    if (trap.kind === 'spike') {
      const playerAtTrap = !player.flightOrigin && Math.abs(player.x - x) < 11 && Math.abs(feet - y) < 6;
      const playerOnSpikes = !player.flightOrigin && Math.abs(player.x - x) < 10 && feet >= y - 14 && player.y <= y;
      const mobAtTrap = mobOnTrap(world, x, y);
      if (trap.state === 'armed') {
        if (playerAtTrap || mobAtTrap) {
          trap.state = 'springing';
          trap.timer = .12;
        }
        continue;
      }
      trap.timer -= dt;
      if (trap.state === 'extended' && playerOnSpikes) {
        hitPlayer(player, effects, 20, x, y - 6, 'Impaled by floor spikes! Bleeding!', { bleed: BLEED_DURATION });
      }
      if (trap.timer > 0) continue;
      if (trap.state === 'springing') {
        if (mobAtTrap) hurtMob(mobAtTrap, x);
        if (playerOnSpikes) {
          hitPlayer(player, effects, 20, x, y - 6, 'Impaled by floor spikes! Bleeding!', { bleed: BLEED_DURATION });
          if (!player.flightOrigin) player.dy = Math.min(player.dy, -85);
        }
        trap.state = 'extended';
        trap.timer = 1.0;
      } else if (trap.state === 'extended') {
        trap.state = 'spent';
        trap.timer = 2.6;
      } else {
        trap.state = 'armed';
      }
      continue;
    }

    const playerAtTrap = !player.flightOrigin && Math.abs(player.x - x) < 9 && Math.abs(feet - y) < 5;
    const mobAtTrap = mobOnTrap(world, x, y);
    if (trap.state === 'armed') {
      if (playerAtTrap || mobAtTrap) {
        trap.state = 'springing';
        trap.timer = .23;
      }
      continue;
    }
    trap.timer -= dt;
    if (trap.timer > 0) continue;
    if (trap.state === 'springing') {
      if (mobAtTrap) hurtMob(mobAtTrap, x);
      if (playerAtTrap) hitPlayer(player, effects, 18, x, y, 'Caught in a bear trap! Bleeding!', { bleed: BLEED_DURATION });
      trap.state = 'spent';
      trap.timer = 4;
    } else {
      trap.state = 'armed';
    }
  }
}
