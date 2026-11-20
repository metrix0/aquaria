import { MATERIAL } from '../content.js';
import { TILE, noise } from '../world/generation.js';
import { batHasAir, bugHasFloor } from '../world/cave-ambience.js';

const base = { maxHealth: 1, material: MATERIAL.stone };
export const ambientMobSpecs = Object.freeze({
  'ambient-ant': { ...base, name: 'ant', width: 7, height: 5, centerY: -2, radius: 8 },
  'ambient-spider': { ...base, name: 'tiny spider', width: 10, height: 6, centerY: -3, radius: 9 },
  'ambient-bat': { ...base, name: 'bat', width: 13, height: 8, centerY: 0, radius: 10 },
});

function chooseWander(mob) {
  const seed = Math.floor(mob.phase * 10000);
  const turn = noise(seed, mob.wanderStep++, 911);
  mob.wanderTime = 0.8 + noise(seed, mob.wanderStep, 912) * 2.7;
  mob.wanderDirection = turn < .2 ? 0 : turn < .6 ? -1 : 1;
  if (mob.kind === 'ambient-bat') {
    mob.wanderVertical = noise(seed, mob.wanderStep, 913) * 2 - 1;
  }
}

export function stepAmbientMob(world, mob, dt) {
  if (!(mob.kind in ambientMobSpecs)) return;
  // No player checks, attacks, aggro or collision with the player.
  mob.wanderTime = (mob.wanderTime ?? 0) - dt;
  if (mob.wanderTime <= 0 && !(mob.flee > 0)) chooseWander(mob);
  const escaping = mob.flee > 0;
  const direction = escaping ? mob.facing : (mob.wanderDirection ?? mob.facing);
  const speed = mob.kind === 'ambient-ant' ? 10 : mob.kind === 'ambient-spider' ? 14 : 19;
  const targetDx = direction * speed * (escaping ? 1.75 : 1);
  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
  if (mob.kind === 'ambient-bat') {
    const targetDy = escaping ? mob.dy * .5 : (mob.wanderVertical ?? 0) * 13;
    mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 3);
    const nextX = mob.x + mob.dx * dt;
    const nextY = mob.y + mob.dy * dt;
    if (batHasAir(world, nextX, nextY)) {
      mob.x = nextX;
      mob.y = nextY;
    } else {
      mob.facing *= -1;
      mob.wanderDirection = mob.facing;
      mob.wanderVertical = -(mob.wanderVertical ?? 0);
      mob.dx = 0;
      mob.dy = 0;
      mob.wanderTime = 0.4;
    }
  } else {
    const nextX = mob.x + mob.dx * dt;
    // Ground insects turn at cliffs, walls and water rather than walking through them.
    if (bugHasFloor(world, nextX - 3, mob.y) && bugHasFloor(world, nextX + 3, mob.y)) {
      mob.x = nextX;
    } else {
      mob.facing *= -1;
      mob.wanderDirection = mob.facing;
      mob.dx = 0;
      mob.wanderTime = 0.4;
    }
  }
  if (Math.abs(mob.dx) > .25) mob.facing = Math.sign(mob.dx);
}
