import { tileAt, TILE_NEIGHBORS } from '../world.js';
import { COLS, ROWS, WATER_ROW, groundAt, clamp } from './generation.js';

// Weather has a local influence: open sky is fully exposed, entrances gradually
// fade out, and sealed underground chambers never inherit surface weather.
const reach = 14;
const margin = reach + 2;
const smooth = (t) => t * t * (3 - 2 * t);

// Match the actual back-wall drawn by render.caveWall: below this boundary,
// there is a rock background even when the foreground has been mined away.
export function hasBackgroundWall(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0) return false;
  const ground = groundAt(tx);
  return ty >= ground + (ground < WATER_ROW ? 1 : 0);
}

// A single climate grade for time-of-day, weather and biome, before local
// exposure masks it out on background-backed cells. Dawn/rose tint slowly
// shifts between pink and amber rather than recoloring only the sky.
export function atmosphereTint(conditions, swampBlend = 0, time = 0) {
  const darkness = clamp(conditions.darkness ?? 0, 0, 1);
  const rain = clamp(conditions.rain ?? 0, 0, 1);
  const mood = conditions.dayAtmosphere ?? conditions.atmosphere ?? 'clear';
  const daylight = (1 - darkness) * (1 - rain * .75);
  const warmth = daylight * (
    mood === 'sunny' ? .34 :
    mood === 'rose' ? .36 :
    mood === 'clear' ? .16 :
    mood === 'cloudy' ? .025 : .09
  );
  const dark = darkness * .48 + rain * .21;
  const swamp = clamp(swampBlend, 0, 1) * (.075 + rain * .065);
  const total = dark + warmth + swamp;
  if (total <= 0) return { r: 0, g: 0, b: 0, alpha: 0 };

  const roseMix = (.5 + .5 * Math.sin(time * .16 + (conditions.skyProgress ?? .5) * 2));
  const pink = mood === 'rose';
  const warmR = pink ? 251 + roseMix * 4 : 255;
  const warmG = pink ? 120 + roseMix * 68 : mood === 'sunny' ? 211 : 193;
  const warmB = pink ? 167 - roseMix * 78 : mood === 'sunny' ? 111 : 134;
  return {
    r: Math.round((dark * (17 - 2 * swampBlend) + warmth * warmR + swamp * 15) / total),
    g: Math.round((dark * (25 + 24 * swampBlend) + warmth * warmG + swamp * 49) / total),
    b: Math.round((dark * (51 - 23 * swampBlend) + warmth * warmB + swamp * 28) / total),
    alpha: clamp(total, 0, .75),
  };
}


export function createOutdoorExposure() {
  let values = new Uint8Array();
  let queue = new Int32Array();
  let left = 0;
  let top = 0;
  let width = 0;
  let height = 0;

  function update(world, bounds) {
    left = Math.max(0, bounds.left - margin);
    top = Math.max(0, bounds.top - margin);
    width = Math.max(0, Math.min(COLS, bounds.right + margin) - left);
    height = Math.max(0, Math.min(ROWS, bounds.bottom + margin) - top);
    const size = width * height;
    if (values.length < size) {
      values = new Uint8Array(size);
      queue = new Int32Array(size);
    } else {
      values.fill(0, 0, size);
    }

    let end = 0;
    // Find the actual open-to-sky cells in each column, accounting for player
    // construction and mining, even when the top of the camera is underground.
    for (let x = 0; x < width; x++) {
      const tx = left + x;
      for (let ty = 0; ty < top + height; ty++) {
        if (tileAt(world, tx, ty) || hasBackgroundWall(tx, ty)) break;
        if (ty < top) continue;
        const index = (ty - top) * width + x;
        values[index] = reach;
        queue[end++] = index;
      }
    }

    // Light follows open tunnels for a limited distance; it cannot pass through
    // walls or jump into a sealed pocket.
    for (let start = 0; start < end; start++) {
      const index = queue[start];
      const next = values[index] - 1;
      if (next <= 0) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (next <= values[neighbor] || hasBackgroundWall(left + nx, top + ny) || tileAt(world, left + nx, top + ny)) continue;
        values[neighbor] = next;
        queue[end++] = neighbor;
      }
    }

    // Give exposed stone faces the same atmosphere as the adjacent open air.
    // Never propagate weather from these wall faces into further rock.
    const openValues = values.slice(0, size);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!tileAt(world, left + x, top + y) || hasBackgroundWall(left + x, top + y)) continue;
        let exposed = 0;
        for (const [dx, dy] of TILE_NEIGHBORS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          exposed = Math.max(exposed, openValues[ny * width + nx]);
        }
        values[index] = exposed;
      }
    }
  }

  function at(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return smooth(clamp(values[y * width + x] / reach, 0, 1));
  }

  return { update, at };
}
