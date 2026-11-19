import { ROOT_GROVE } from './island-cave.js';
import { hasOpenFace, hasExposedCaveFloor, solidAt, TILE_NEIGHBORS } from '../world.js';
import { COLS, ROWS, TILE, WEST_EXTENSION, groundAt } from './generation.js';

const source = 72;
const mushroomLight = 46;
const openFalloff = 3;
const rockFalloff = 10;
const reach = Math.ceil(source / openFalloff);
const size = reach * 2 + 1;

export function caveAmbientAt(world, player, tx, ty) {
  if (!solidAt(world, tx, ty, player)) return .34;
  return hasOpenFace(world, tx, ty, player) ? .19 : 0;
}

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

    for (const mushroom of world.caveMushrooms) {
      const x = mushroom.tx - left;
      const y = mushroom.floor - 1 - top;
      if (x < 0 || y < 0 || x >= size || y >= size || !hasExposedCaveFloor(world, mushroom)) continue;
      lightCell(y * size + x, mushroomLight);
    }

    for (const lamp of world.caveStructures ?? []) {
      const level = lamp.kind === 'cult-idol' ? 68 : lamp.kind === 'native-torch' ? 55 : lamp.kind === 'lamp' ? 53 : 0;
      if (!level) continue;
      const x = lamp.tx - left;
      const y = lamp.floor - 2 - top;
      if (x < 0 || y < 0 || x >= size || y >= size || !hasExposedCaveFloor(world, lamp)) continue;
      if (!isSolid(world, player, y * size + x)) lightCell(y * size + x, level);
    }

    for (const [dx, rise] of [[-11, 6], [-7, 13], [-3, 4], [0, 19], [4, 10], [9, 15], [12, 4]]) {
      const x = ROOT_GROVE.column + WEST_EXTENSION + dx - left;
      const y = ROOT_GROVE.floor - rise - top;
      if (x < 0 || y < 0 || x >= size || y >= size || isSolid(world, player, y * size + x)) continue;
      lightCell(y * size + x, source);
    }

    for (let start = 0; start < queue.length; start++) {
      const index = queue[start];
      queued[index] = 0;
      const level = levels[index];
      if (level <= openFalloff) continue;
      const fromRock = isSolid(world, player, index);
      const x = index % size;
      const y = Math.floor(index / size);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        if (x + dx < 0 || x + dx >= size || y + dy < 0 || y + dy >= size) continue;
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

const surfaceLevels = [0, .1, .22, .39, .59, .8, 1];
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
