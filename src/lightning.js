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

// Move the original strike horizontally only. Its vertical geometry and
// timing are calculated exactly as before, independently of nearby terrain.
export const LIGHTNING_NEAR_RADIUS = 10 * TILE;

export function lightningAnchor(strike, seed, camera, existing = null, characters = []) {
  if (existing?.event === strike.event) return existing;
  const side = noise(strike.event, 860, seed) < .5;
  const portion = side
    ? .12 + noise(strike.event, 861, seed) * .16
    : .72 + noise(strike.event, 861, seed) * .16;
  const originalX = camera.x + camera.width * portion;
  const skyAt = x => Math.min(WATER, groundAt(Math.floor(x / TILE)) * TILE);
  const visibleSky = Math.max(0, Math.min(camera.height, skyAt(originalX) - camera.y));
  const worldTop = camera.y + 12 + noise(strike.event, 862, seed) * 16;
  const worldBottom = camera.y + Math.max(56, visibleSky * (.65 + noise(strike.event, 863, seed) * .12));

  // Relocate only to open sky: a bolt next to a tall island can otherwise
  // be clipped or disappear. Never discard a scheduled strike.
  const left = camera.x + 16;
  const right = camera.x + camera.width - 16;
  const clearance = x => Math.min(skyAt(x - TILE), skyAt(x), skyAt(x + TILE));
  const originalClearance = clearance(originalX);
  const requiredSky = Math.min(worldBottom, originalClearance);
  let worldX = originalX;
  let bestDistance = Infinity;
  for (const character of characters) {
    if (!Number.isFinite(character?.x) || character.x < camera.x ||
        character.x > camera.x + camera.width ||
        (Number.isFinite(character.y) && (character.y < camera.y - 25 ||
          character.y > camera.y + camera.height + 25))) continue;
    const low = Math.max(left, character.x - LIGHTNING_NEAR_RADIUS);
    const high = Math.min(right, character.x + LIGHTNING_NEAR_RADIUS);
    if (low > high) continue;
    const preferred = clamp(originalX, low, high);
    const candidates = [preferred, low, high];
    for (let x = Math.ceil(low / TILE) * TILE + TILE / 2; x <= high; x += TILE) {
      candidates.push(x);
    }
    for (const x of candidates) {
      if (clearance(x) < requiredSky) continue;
      const distance = Math.abs(x - originalX);
      if (distance < bestDistance) {
        bestDistance = distance;
        worldX = x;
      }
    }
  }
  return {
    event: strike.event,
    worldX,
    worldTop,
    worldBottom,
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
