import { COLS, WATER_ROW, groundAt, clamp } from './generation.js';

// Cave lighting still distinguishes actual background walls; the full-screen
// atmospheric grade ignores them completely.
export function hasBackgroundWall(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0) return false;
  const ground = groundAt(tx);
  return ty >= ground + (ground < WATER_ROW ? 1 : 0);
}

// Subtle colors used with canvas overlay blending, never opaque source-over.
export function atmosphereTint(conditions, swampBlend = 0, time = 0) {
  const darkness = clamp(conditions.darkness ?? 0, 0, 1);
  const rain = clamp(conditions.rain ?? 0, 0, 1);
  const mood = conditions.dayAtmosphere ?? conditions.atmosphere ?? 'clear';
  const daylight = (1 - darkness) * (1 - rain * .75);
  const warmth = daylight * (
    mood === 'sunny' ? .21 :
    mood === 'rose' ? .20 :
    mood === 'clear' ? .10 :
    mood === 'cloudy' ? .025 : .08
  );
  const dark = darkness * .34 + rain * .10;
  const swamp = clamp(swampBlend, 0, 1) * (.045 + rain * .02);
  const total = dark + warmth + swamp;
  if (total <= 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  const roseMix = .5 + .5 * Math.sin(time * .16 + (conditions.skyProgress ?? .5) * 2);
  const pink = mood === 'rose';
  const warmR = pink ? 251 + roseMix * 4 : 255;
  const warmG = pink ? 120 + roseMix * 68 : mood === 'sunny' ? 211 : 193;
  const warmB = pink ? 167 - roseMix * 78 : mood === 'sunny' ? 111 : 134;
  return {
    r: Math.round((dark * (17 - 2 * swampBlend) + warmth * warmR + swamp * 15) / total),
    g: Math.round((dark * (25 + 24 * swampBlend) + warmth * warmG + swamp * 49) / total),
    b: Math.round((dark * (51 - 23 * swampBlend) + warmth * warmB + swamp * 28) / total),
    alpha: clamp(total, 0, .50),
  };
}
