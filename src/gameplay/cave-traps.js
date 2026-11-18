import { takeDamage } from './player.js';
import { MATERIAL } from '../content.js';
import { hasTileEdit, tileAt } from '../world.js';
import { TILE } from '../world/generation.js';

export function isTrapIntact(world, { tx, ty, kind }) {
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

function hitPlayer(player, effects, damage, x, y, message) {
  if (player.flightOrigin || player.hurt > 0) return;
  takeDamage(player, damage);
  player.hurt = 1;
  player.stun = .35;
  effects.push({ x, y, color: '#ca8770', count: 9, spread: 56, message });
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
        hitPlayer(player, effects, 24, head.x, head.y, 'Hit by a spiked pendulum!');
      }
      continue;
    }

    const playerAtTrap = !player.flightOrigin && Math.abs(player.x - x) < 9 && Math.abs(feet - y) < 5;
    const mobAtTrap = world.mobs.find((mob) => mob.respawnDelay && mob.health > 0 &&
      Math.abs(mob.x - x) < 10 && Math.abs(mob.y - y) < 5);
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
      if (playerAtTrap) hitPlayer(player, effects, 18, x, y, 'Caught in a bear trap!');
      trap.state = 'spent';
      trap.timer = 4;
    } else {
      trap.state = 'armed';
    }
  }
}
