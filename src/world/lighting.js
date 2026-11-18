import { solidAt, TILE_NEIGHBORS } from '../world.js';
import { TILE } from './generation.js';

const reach = 12;
const size = reach * 2 + 1;

export function createCaveLight() {
  const levels = new Uint8Array(size * size);
  const queue = new Uint16Array(levels.length);
  let left = 0;
  let top = 0;

  function update(world, player) {
    left = Math.floor(player.x / TILE) - reach;
    top = Math.floor((player.y + player.height / 2) / TILE) - reach;
    const center = reach * size + reach;
    levels.fill(0);
    levels[center] = reach + 1;
    queue[0] = center;
    let end = 1;
    for (let start = 0; start < end; start++) {
      const index = queue[start];
      const next = levels[index] - 1;
      if (next === 0) continue;
      const x = index % size;
      const y = Math.floor(index / size);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        const neighbor = index + dy * size + dx;
        if (levels[neighbor]) continue;
        levels[neighbor] = next;
        // Light reaches the face of a solid tile but only travels onward through open space.
        if (!solidAt(world, left + x + dx, top + y + dy, player)) queue[end++] = neighbor;
      }
    }
  }

  function at(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || x >= size || y < 0 || y >= size) return 0;
    const level = levels[y * size + x] / (reach + 1);
    return level * level * (3 - 2 * level);
  }

  return { update, at };
}
