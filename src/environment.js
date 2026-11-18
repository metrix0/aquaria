import { clamp, noise } from './world/generation.js';

const cycleSeconds = 20 * 60;
const daySeconds = 12 * 60;
const twilightSeconds = 60;
const weatherWindow = 5 * 60;
const rainChance = .75;

function smoothStep(progress) {
  const t = clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}

export function worldConditions(seconds, weatherSeed) {
  const phase = seconds % cycleSeconds;
  const night = phase >= daySeconds;
  const dusk = (phase - daySeconds + twilightSeconds) / twilightSeconds;
  const dawn = (cycleSeconds - phase) / twilightSeconds;

  const window = Math.floor(seconds / weatherWindow);
  const start = 90 + noise(window, 1, weatherSeed) * 125;
  const duration = 30 + noise(window, 2, weatherSeed) * 25;
  const rainTime = seconds % weatherWindow - start;
  const rain = noise(window, 3, weatherSeed) < rainChance
    ? smoothStep(Math.min(rainTime, duration - rainTime) / 4)
    : 0;
  const direction = noise(window, 4, weatherSeed) < .5 ? -1 : 1;
  const slope = .12 + noise(window, 5, weatherSeed) * .48;

  return {
    night,
    skyProgress: night ? (phase - daySeconds) / (cycleSeconds - daySeconds) : phase / daySeconds,
    darkness: smoothStep(Math.min(dusk, dawn)),
    rain,
    rainSlope: rain > 0 ? direction * slope : 0,
  };
}
