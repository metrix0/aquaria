import { clamp, noise } from './world/generation.js';

// Seeded world-time strikes survive pause, save/reload and multiplayer sync.
export function lightningAt(seconds, seed, conditions, reducedMotion = false) {
  if ((conditions?.rain ?? 0) < .82 || (conditions?.darkness ?? 0) < .72) return null;
  const event = Math.floor(seconds / 10);
  const strikeTime = event * 10 + 1.2 + noise(event, 817, seed) * 5.6;
  const age = seconds - strikeTime;
  if (age < 0 || age >= .92) return null;

  // Crack, dark beat, second forked strike, then a glowing fade.
  const flash = age < .09 ? 1
    : age < .17 ? .16
    : age < .30 ? .98
    : age < .36 ? .36
    : age < .55 ? .86 - (age - .36) * 1.55
    : .56 * Math.exp(-(age - .55) * 9);
  const bolt = age < .09 ? 1
    : age >= .17 && age < .30 ? .92
    : age >= .36 && age < .45 ? .45 : 0;
  return {
    event,
    flash: clamp(reducedMotion ? Math.min(flash, .35) : flash, 0, 1),
    bolt: reducedMotion ? Math.min(bolt, .4) : bolt,
  };
}
