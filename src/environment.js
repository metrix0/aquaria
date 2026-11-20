import { clamp, noise } from './world/generation.js';

const cycleSeconds = 20 * 60;
const daySeconds = 12 * 60;
// New games and Start Over begin halfway through the daylight period.
export const START_WORLD_TIME = daySeconds / 2;
const twilightSeconds = 60;
const weatherWindow = 5 * 60;
const rainChance = .75;

function smoothStep(progress) {
  const t = clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}

// Seeded world weather: each day and night can have a different atmosphere.
const DAY_MOODS = ['clear', 'clear', 'sunny', 'sunny', 'cloudy', 'cloudy', 'rose'];
const NIGHT_MOODS = ['moonlit', 'moonlit', 'moonlit', 'moonlit', 'starry', 'starry', 'starry', 'deep', 'deep', 'deep', 'aurora', 'meteors'];

function daylightStrength(mood, variation = 1) {
  return ({ clear: 1, sunny: 1.25, cloudy: .57, rose: .97 }[mood] ?? 1) * variation;
}

export const WEATHER_MODES = Object.freeze([
  { id: 'auto', label: 'Auto' },
  { id: 'day', label: 'Clear Day', night: false, skyProgress: .5, darkness: 0, rain: 0, rainSlope: 0, atmosphere: 'clear' },
  { id: 'sunny', label: 'Super Sunny', night: false, skyProgress: .5, darkness: 0, rain: 0, rainSlope: 0, atmosphere: 'sunny' },
  { id: 'cloudy', label: 'Cloudy Day', night: false, skyProgress: .5, darkness: 0, rain: 0, rainSlope: 0, atmosphere: 'cloudy' },
  { id: 'rose', label: 'Pink / Orange Day', night: false, skyProgress: .5, darkness: 0, rain: 0, rainSlope: 0, atmosphere: 'rose' },
  { id: 'dusk', label: 'Dusk', night: false, skyProgress: .95, darkness: .35, rain: 0, rainSlope: 0, atmosphere: 'rose' },
  { id: 'night', label: 'Moonlit Night', night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0, atmosphere: 'moonlit' },
  { id: 'starry', label: 'Starry Night', night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0, atmosphere: 'starry' },
  { id: 'deep-night', label: 'Deep Night', night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0, atmosphere: 'deep' },
  { id: 'aurora', label: 'Aurora Borealis', night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0, atmosphere: 'aurora' },
  { id: 'meteors', label: 'Meteor Shower', night: true, skyProgress: .5, darkness: 1, rain: 0, rainSlope: 0, atmosphere: 'meteors' },
  { id: 'dawn', label: 'Dawn', night: false, skyProgress: .05, darkness: 0, rain: 0, rainSlope: 0, atmosphere: 'rose' },
  { id: 'rain', label: 'Rain', night: false, skyProgress: .5, darkness: 0, rain: 1, rainSlope: .28, atmosphere: 'cloudy' },
  { id: 'storm', label: 'Storm', night: true, skyProgress: .5, darkness: 1, rain: 1, rainSlope: -.38, atmosphere: 'deep' },
]);

export function worldConditions(seconds, weatherSeed, mode = 'auto') {
  if (mode && mode !== 'auto') {
    const preset = WEATHER_MODES.find((entry) => entry.id === mode);
    if (preset) {
      return {
        night: preset.night,
        skyProgress: preset.skyProgress,
        darkness: preset.darkness,
        rain: preset.rain,
        rainSlope: preset.rainSlope,
        atmosphere: preset.atmosphere,
        dayAtmosphere: preset.night ? 'clear' : preset.atmosphere,
        sunIntensity: daylightStrength(preset.atmosphere),
      };
    }
  }
  const phase = ((seconds % cycleSeconds) + cycleSeconds) % cycleSeconds;
  const dayIndex = Math.floor(seconds / cycleSeconds);
  const night = phase >= daySeconds;
  const dusk = (phase - daySeconds + twilightSeconds) / twilightSeconds;
  const dawn = (cycleSeconds - phase) / twilightSeconds;
  // The upcoming morning's palette is already underneath the fading night sky.
  const morningIndex = night ? dayIndex + 1 : dayIndex;
  const dayMood = DAY_MOODS[Math.floor(noise(morningIndex, 37, weatherSeed) * DAY_MOODS.length)];
  const nightMood = NIGHT_MOODS[Math.floor(noise(dayIndex, 73, weatherSeed) * NIGHT_MOODS.length)];
  const variation = .9 + noise(morningIndex, 19, weatherSeed) * .2;

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
    atmosphere: night ? nightMood : dayMood,
    dayAtmosphere: dayMood,
    sunIntensity: daylightStrength(dayMood, variation),
  };
}
