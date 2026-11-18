import { SPAWN, TILE, WATER, WATER_ROW, groundAt, noise } from './generation.js';

const passInterval = 45;

function shoreAt(direction) {
  let column = Math.floor(SPAWN.x / TILE);
  while (groundAt(column) < WATER_ROW) column += direction;
  return column * TILE;
}

const westShore = shoreAt(-1);
const eastShore = shoreAt(1);

export function birdFlightAt(worldTime, seed) {
  const pass = Math.floor(worldTime / passInterval);
  const age = worldTime - pass * passInterval - (7 + noise(pass, 1, seed) * 7);
  const seagull = pass % 2 === 1;
  const duration = seagull ? 11 : 9;
  if (age <= 0 || age >= duration) return null;

  const eastCoast = pass % 4 === 1;
  const coast = eastCoast ? eastShore : westShore;
  const offshore = eastCoast ? 1 : -1;
  const start = seagull ? coast + offshore * 14 * TILE : westShore;
  const end = seagull ? coast - offshore * 6 * TILE : eastShore;
  const reverse = noise(pass, 2, seed) < .5;
  const progress = age / duration;
  const altitude = noise(pass, 3, seed) * 20;

  return {
    seagull,
    age,
    x: start + (end - start) * (reverse ? 1 - progress : progress),
    y: (seagull ? WATER - 84 : WATER - 154) + altitude + Math.sin(age * 1.5) * (seagull ? 5 : 8),
    facing: Math.sign(end - start) * (reverse ? -1 : 1),
    opacity: Math.min(1, age / .8, (duration - age) / .8),
  };
}
