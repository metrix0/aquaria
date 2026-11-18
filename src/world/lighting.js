import { solidAt, TILE_NEIGHBORS } from '../world.js';
import { COLS, ROWS, TILE, groundAt } from './generation.js';

const source = 72;
const openFalloff = 4;
const rockFalloff = 16;
const reach = Math.ceil(source / openFalloff);
const size = reach * 2 + 1;

export function createCaveLight() {
  const levels = new Uint8Array(size * size);
  const cells = new Uint8Array(levels.length);
  const queued = new Uint8Array(levels.length);
  const queue = [];
  let left = 0;
  let top = 0;

  function isSolid(world, player, index) {
    if (!cells[index]) {
      const tx = left + index % size;
      const ty = top + Math.floor(index / size);
      cells[index] = solidAt(world, tx, ty, player) ? 2 : 1;
    }
    return cells[index] === 2;
  }

  function lightCell(index, level) {
    if (level <= levels[index]) return;
    levels[index] = level;
    if (!queued[index]) {
      queue.push(index);
      queued[index] = 1;
    }
  }

  function update(world, player) {
    const px = player.x / TILE;
    const py = (player.y + player.height / 2) / TILE;
    left = Math.floor(px) - reach;
    top = Math.floor(py) - reach;
    const center = reach * size + reach;
    levels.fill(0);
    cells.fill(0);
    queue.length = 0;
    const offsetX = px - Math.floor(px) - .5;
    const offsetY = py - Math.floor(py) - .5;
    const dx = offsetX < 0 ? -1 : 1;
    const dy = offsetY < 0 ? -1 : 1;
    const seed = (x, y) => {
      lightCell(center + x + y * size, source - Math.round(openFalloff * (Math.abs(offsetX - x) + Math.abs(offsetY - y))));
    };
    seed(0, 0);
    const openX = !isSolid(world, player, center + dx);
    const openY = !isSolid(world, player, center + dy * size);
    if (openX) seed(dx, 0);
    if (openY) seed(0, dy);
    if ((openX || openY) && !isSolid(world, player, center + dx + dy * size)) seed(dx, dy);

    for (let start = 0; start < queue.length; start++) {
      const index = queue[start];
      queued[index] = 0;
      const level = levels[index];
      if (level <= openFalloff) continue;
      const fromRock = isSolid(world, player, index);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        const neighbor = index + dy * size + dx;
        const intoRock = isSolid(world, player, neighbor);
        // Rock carries a soft glow without lighting a disconnected chamber on its far side.
        if (!fromRock || intoRock) lightCell(neighbor, level - (intoRock ? rockFalloff : openFalloff));
      }
    }
  }

  function at(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || x >= size || y < 0 || y >= size) return 0;
    const level = levels[y * size + x] / source;
    return level * level * (3 - 2 * level);
  }

  return { update, at };
}

const surfaceLevels = [0, .12, .38, .7, 1];
const surfaceReach = surfaceLevels.length - 1;

function hasDaylight(world, player, x, y, ground, westGround, eastGround) {
  return y < ground ||
    (y === ground && !solidAt(world, x, y - 1, player)) ||
    (y < westGround && !solidAt(world, x - 1, y, player)) ||
    (y < eastGround && !solidAt(world, x + 1, y, player));
}

export function createSurfaceLight() {
  let levels = new Uint8Array();
  let queue = new Int32Array();
  let left, top, width, height;

  function update(world, player, bounds) {
    // Include sources outside the viewport so the gradient stays fixed as the camera pans.
    left = Math.max(0, bounds.left - surfaceReach);
    top = Math.max(0, bounds.top - surfaceReach);
    width = Math.min(COLS, bounds.right + surfaceReach) - left;
    height = Math.min(ROWS, bounds.bottom + surfaceReach) - top;
    const size = width * height;
    if (levels.length < size) {
      levels = new Uint8Array(size);
      queue = new Int32Array(size);
    } else {
      levels.fill(0, 0, size);
    }

    let end = 0;
    for (let x = 0; x < width; x++) {
      const tx = left + x;
      const ground = groundAt(tx);
      const westGround = groundAt(tx - 1);
      const eastGround = groundAt(tx + 1);
      for (let y = 0; y < height; y++) {
        if (!hasDaylight(world, player, tx, top + y, ground, westGround, eastGround)) continue;
        const index = y * width + x;
        levels[index] = surfaceReach;
        queue[end++] = index;
      }
    }

    for (let start = 0; start < end; start++) {
      const index = queue[start];
      const level = levels[index] - 1;
      if (!level) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (levels[neighbor] || !solidAt(world, left + nx, top + ny, player)) continue;
        levels[neighbor] = level;
        queue[end++] = neighbor;
      }
    }
  }

  function at(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return surfaceLevels[levels[y * width + x]];
  }

  return { update, at };
}
