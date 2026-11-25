import { clamp, noise, TILE, WATER, groundAt } from './world/generation.js';

// Variable but deterministic storm bursts, synced across reloads and players.
const BURST_SECONDS = 25;
const FLASH_SECONDS = .46;

export function stormBurstAt(window, seed) {
  if (noise(window, 916, seed) < .17) return []; // Occasional silent period.
  const roll = noise(window, 917, seed);
  const count = roll < .36 ? 1 : roll < .68 ? 2 : roll < .89 ? 3 : 4;
  let next = window * BURST_SECONDS + 1.3 + noise(window, 918, seed) * 11.5;
  const strikes = [];
  for (let i = 0; i < count; i++) {
    if (i) next += .85 + noise(window * 7 + i, 919, seed) * 1.25;
    strikes.push(next);
  }
  return strikes;
}

export function lightningAt(seconds, seed, conditions, reducedMotion = false) {
  if ((conditions?.rain ?? 0) < .82 || (conditions?.darkness ?? 0) < .72) return null;
  const window = Math.floor(seconds / BURST_SECONDS);
  for (const [index, strike] of stormBurstAt(window, seed).entries()) {
    const age = seconds - strike;
    if (age < 0 || age >= FLASH_SECONDS) continue;
    const event = window * 4 + index;
    const echo = noise(event, 920, seed) < .68;
    const flash = age < .07 ? 1
      : age < .13 ? .13
      : age < .23 ? (echo ? .87 : .20)
      : .47 * Math.exp(-(age - .23) * 13);
    const bolt = age < .07 ? 1 : echo && age >= .13 && age < .23 ? .82 : 0;
    const intensity = .72 + noise(event, 921, seed) * .28;
    return {
      event,
      flash: clamp(flash * intensity * (reducedMotion ? .36 : 1), 0, 1),
      bolt: bolt * (reducedMotion ? .4 : 1),
      distance: .55 + noise(event, 922, seed) * .35,
    };
  }
  return null;
}

// Horizontal distance in world pixels, independent of viewport size or zoom.
export const LIGHTNING_NEAR_RADIUS = 10 * TILE;
const LIGHTNING_MIN_OFFSET = 4 * TILE;

/**
 * Anchor each event near an on-screen character, rather than at the edge of
 * the camera. Keep its world coordinates frozen through the final echo.
 */
export function lightningAnchor(strike, seed, camera, existing = null, characters = []) {
  if (existing?.event === strike.event) return existing;
  const margin = Math.min(TILE, camera.width * .1);
  const left = camera.x + margin;
  const right = camera.x + camera.width - margin;
  const nearby = characters.filter(character =>
    Number.isFinite(character?.x) &&
    character.x >= left - LIGHTNING_NEAR_RADIUS &&
    character.x <= right + LIGHTNING_NEAR_RADIUS &&
    (character.y == null || (character.y >= camera.y - 25 &&
      character.y <= camera.y + camera.height + 25)));
  if (!nearby.length) return null;
  const target = nearby[Math.min(nearby.length - 1,
    Math.floor(noise(strike.event, 859, seed) * nearby.length))];
  const low = Math.max(left, target.x - LIGHTNING_NEAR_RADIUS);
  const high = Math.min(right, target.x + LIGHTNING_NEAR_RADIUS);
  const offset = LIGHTNING_MIN_OFFSET + noise(strike.event, 861, seed) *
    (LIGHTNING_NEAR_RADIUS - LIGHTNING_MIN_OFFSET);
  const direction = noise(strike.event, 860, seed) < .5 ? -1 : 1;
  const preferred = clamp(target.x + direction * offset, low, high);
  const opposite = clamp(target.x - direction * offset, low, high);
  // At the screen edge prefer the other side rather than striking at the player.
  const worldX = Math.abs(preferred - target.x) >= Math.min(LIGHTNING_MIN_OFFSET, camera.width * .25)
    ? preferred : opposite;
  const horizon = Math.min(WATER, groundAt(Math.floor(worldX / TILE)) * TILE);
  const visibleSky = Math.max(0, Math.min(camera.height, horizon - camera.y));
  return {
    event: strike.event,
    worldX,
    worldTop: camera.y + 12 + noise(strike.event, 862, seed) * 16,
    worldBottom: camera.y + Math.max(56, visibleSky * (.65 + noise(strike.event, 863, seed) * .12)),
  };
}

// Distant sheet lightning is a separate random process: no visible bolt.
export function distantThunderAt(seconds, seed, conditions, reducedMotion = false) {
  if ((conditions?.rain ?? 0) < .82 || (conditions?.darkness ?? 0) < .72) return null;
  const window = Math.floor(seconds / 19);
  const roll = noise(window, 1130, seed);
  const count = roll < .16 ? 0 : roll < .73 ? 1 : 2;
  let start = window * 19 + 1 + noise(window, 1131, seed) * 10;
  for (let i = 0; i < count; i++) {
    if (i) start += 1.05 + noise(window * 3 + i, 1132, seed) * 1.75;
    const age = seconds - start;
    if (age < 0 || age >= .78) continue;
    const event = window * 2 + i;
    const pulse = age < .16 ? .88 : age < .30 ? .30
      : age < .49 ? .63 : .63 * Math.exp(-(age - .49) * 7);
    const strength = .24 + noise(event, 1133, seed) * .20;
    return { event, flash: pulse * strength * (reducedMotion ? .45 : 1) };
  }
  return null;
}
