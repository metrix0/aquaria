import { MATERIAL } from '../content.js';
import { tileAt, waterTileAt } from '../world.js';
import { COLS, ROWS, TILE, WEST_EXTENSION, noise } from './generation.js';
import { isDryIslandCave } from './island-cave.js';
import { isDryJungleCave } from './jungle-cave.js';

// Decorative wildlife is intentionally not in world.mobs: no health, hitbox,
// targeting, drops, collision, or saved/multiplayer state.
const CELL_WIDTH = 10;
const CELL_HEIGHT = 7;
const MAX_VISIBLE_WIDTH = 120 * TILE;

function caveAt(tx, ty) {
  const column = tx - WEST_EXTENSION;
  return isDryIslandCave(column, ty) || isDryJungleCave(column, ty);
}

function openCaveAt(world, tx, ty) {
  return tx >= 0 && tx < COLS && ty >= 2 && ty < ROWS - 2
    && caveAt(tx, ty)
    && tileAt(world, tx, ty) === MATERIAL.air
    && !waterTileAt(world, tx, ty);
}

function seedCreature(world, cellX, cellY, out) {
  const tx = cellX * CELL_WIDTH + 2 + Math.floor(noise(cellX, cellY, 701) * 6);
  const start = cellY * CELL_HEIGHT;
  if (tx >= COLS) return;
  const jungle = isDryJungleCave(tx - WEST_EXTENSION, start + 3);
  const phase = noise(cellX, cellY, 702) * Math.PI * 2;
  const direction = noise(cellX, cellY, 703) < 0.5 ? -1 : 1;

  if (noise(cellX, cellY, 704) < 0.8) {
    // Pick a real exposed floor, rather than letting insects float inside rock.
    for (let i = 0; i < CELL_HEIGHT; i++) {
      const floor = start + i;
      if (!openCaveAt(world, tx, floor - 1)
        || !openCaveAt(world, tx, floor - 2)
        || tileAt(world, tx, floor) === MATERIAL.air) continue;
      out.push({
        kind: noise(cellX, cellY, 705) < 0.62 ? 'ant' : 'tiny-spider',
        x: (tx + 0.5) * TILE,
        y: floor * TILE - 2,
        phase, direction, jungle,
      });
      break;
    }
  }

  if (noise(cellX, cellY, 706) < 0.45) {
    const row = start + 1 + Math.floor(noise(cellX, cellY, 707) * 5);
    if (openCaveAt(world, tx, row)
      && openCaveAt(world, tx - 1, row)
      && openCaveAt(world, tx + 1, row)
      && openCaveAt(world, tx, row - 1)
      && openCaveAt(world, tx, row + 1)) {
      out.push({
        kind: 'bat',
        x: (tx + 0.5) * TILE,
        y: (row + 0.5) * TILE,
        phase: phase + 1.7, direction, jungle,
      });
    }
  }
}

export function caveFaunaInView(world, camera) {
  // Tiny one-pixel creatures cannot be seen at map overview zoom levels.
  if (camera.width > MAX_VISIBLE_WIDTH) return [];
  const minX = Math.max(0, Math.floor(camera.x / (TILE * CELL_WIDTH)) - 1);
  const maxX = Math.min(Math.floor((COLS - 1) / CELL_WIDTH),
    Math.floor((camera.x + camera.width) / (TILE * CELL_WIDTH)) + 1);
  const minY = Math.max(0, Math.floor(camera.y / (TILE * CELL_HEIGHT)) - 1);
  const maxY = Math.min(Math.floor((ROWS - 1) / CELL_HEIGHT),
    Math.floor((camera.y + camera.height) / (TILE * CELL_HEIGHT)) + 1);
  const fauna = [];
  for (let cellY = minY; cellY <= maxY; cellY++) {
    for (let cellX = minX; cellX <= maxX; cellX++) {
      seedCreature(world, cellX, cellY, fauna);
    }
  }
  return fauna;
}

export function bugHasFloor(world, x, y) {
  const tx = Math.floor(x / TILE);
  const floor = Math.floor((y + 2) / TILE);
  return openCaveAt(world, tx, floor - 1)
    && tileAt(world, tx, floor) !== MATERIAL.air;
}

export function batHasAir(world, x, y) {
  return openCaveAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
}
