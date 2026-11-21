import { COLS, TILE, WEST_EXTENSION, WATER_ROW, groundAt, clamp } from './generation.js';

// World-based aurora projections. Camera movement shifts the visible sky
// instead of dragging the light along with the character.
export function auroraWorldX(screenX, cameraX) {
  return screenX + cameraX - WEST_EXTENSION * TILE;
}

export function auroraBloomWorldX(index, time) {
  return index * 420 + Math.sin(time * .05 + index * 1.8) * 24;
}


// Cave lighting still distinguishes actual background walls; the full-screen
// atmospheric grade ignores them completely.
export function hasBackgroundWall(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0) return false;
  const ground = groundAt(tx);
  return ty >= ground + (ground < WATER_ROW ? 1 : 0);
}

// Daytime and biome hues use overlay blending. Night uses a separate, stronger
// source-over darkness pass so even bright terrain and characters darken.
export function atmosphereTint(conditions, swampBlend = 0, time = 0) {
  const darkness = clamp(conditions.darkness ?? 0, 0, 1);
  const rain = clamp(conditions.rain ?? 0, 0, 1);
  const mood = conditions.dayAtmosphere ?? conditions.atmosphere ?? 'clear';
  const daylight = (1 - darkness) * (1 - rain * .4);
  const warmth = daylight * (
    mood === 'sunny' ? .50 :
    mood === 'rose' ? .52 :
    mood === 'clear' ? .32 :
    mood === 'cloudy' ? .30 : .30
  );
  const cool = rain * (.34 - darkness * .15);
  const swamp = clamp(swampBlend, 0, 1) * (.10 + rain * .035);
  const total = warmth + cool + swamp;
  if (total <= 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  const roseMix = .5 + .5 * Math.sin(time * .16 + (conditions.skyProgress ?? .5) * 2);
  const pink = mood === 'rose';
  const overcast = mood === 'cloudy';
  const warmR = overcast ? 110 : pink ? 251 + roseMix * 4 : 255;
  const warmG = overcast ? 152 : pink ? 120 + roseMix * 68 : mood === 'sunny' ? 211 : 193;
  const warmB = overcast ? 174 : pink ? 167 - roseMix * 78 : mood === 'sunny' ? 111 : 134;
  return {
    r: Math.round((warmth * warmR + cool * 58 + swamp * 15) / total),
    g: Math.round((warmth * warmG + cool * 91 + swamp * 70) / total),
    b: Math.round((warmth * warmB + cool * 151 + swamp * 39) / total),
    alpha: clamp(total, 0, .70),
  };
}

// Raw nocturnal darkness intentionally does not use the daytime overlay blend.
export function nightShadeAlpha(conditions) {
  const darkness = clamp(conditions.darkness ?? 0, 0, 1);
  const rain = clamp(conditions.rain ?? 0, 0, 1);
  const mode = conditions.atmosphere;
  const strength = mode === 'moonlit' ? .47
    : mode === 'starry' ? .56
    : mode === 'deep' ? .70
    : mode === 'aurora' ? .52
    : mode === 'meteors' ? .59 : .52;
  return clamp(darkness ** 1.8 * (strength + rain * .04), 0, .76);
}
