import { solidAt, TILE_NEIGHBORS } from "../world.js";
import { COLS, ROWS, groundAt } from "./generation.js";

export {
  caveAmbientAt,
  caveStructureLight,
  createUndergroundLight,
  createUndergroundLight as createCaveLight,
  undergroundAmbientAt,
} from "./underground-lighting.js";

const surfaceLevels = [0, 0.1, 0.22, 0.39, 0.59, 0.8, 1];
const surfaceReach = surfaceLevels.length - 1;

function hasDaylight(world, player, x, y, ground, westGround, eastGround) {
  return (
    y < ground ||
    (y === ground && !solidAt(world, x, y - 1, player)) ||
    (y < westGround && !solidAt(world, x - 1, y, player)) ||
    (y < eastGround && !solidAt(world, x + 1, y, player))
  );
}

/** Surface daylight propagation system across open sky, islands, and ocean water. */
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
        if (
          !hasDaylight(
            world,
            player,
            tx,
            top + y,
            ground,
            westGround,
            eastGround,
          )
        )
          continue;
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
        if (levels[neighbor] || !solidAt(world, left + nx, top + ny, player))
          continue;
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
