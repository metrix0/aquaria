import { clamp, noise } from './world/generation.js';

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

/**
 * Capture the bolt's location when it first appears, in world coordinates.
 * Camera movement and zoom change only its screen projection, not its location.
 * Keep one anchor for both flashes in a strike.
 */
export function lightningAnchor(strike, seed, camera, existing = null) {
  if (existing?.event === strike.event) return existing;
  const top = -20 + noise(strike.event, 862, seed) * 55;
  return {
    event: strike.event,
    worldX: camera.x + camera.width * (.16 + noise(strike.event, 861, seed) * .68),
    worldTop: top,
    worldBottom: Math.min(230, top + 85 + noise(strike.event, 863, seed) * 105),
  };
}
