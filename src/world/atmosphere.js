import { tileAt, TILE_NEIGHBORS } from '../world.js';
import { COLS, ROWS, clamp } from './generation.js';

// Weather has a local influence: open sky is fully exposed, entrances gradually
// fade out, and sealed underground chambers never inherit surface weather.
const reach = 14;
const margin = reach + 2;
const smooth = (t) => t * t * (3 - 2 * t);

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
        if (tileAt(world, tx, ty)) break;
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
        if (next <= values[neighbor] || tileAt(world, left + nx, top + ny)) continue;
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
        if (!tileAt(world, left + x, top + y)) continue;
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
