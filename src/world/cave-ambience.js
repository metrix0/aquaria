import { MATERIAL } from '../content.js';
import { tileAt, waterTileAt } from '../world.js';
import { COLS, ROWS, TILE, WEST_EXTENSION, noise } from './generation.js';
import { groveDistance, isDryIslandCave } from './island-cave.js';
import { isDryJungleCave } from './jungle-cave.js';

// Much sparser than the original decorative grid: candidate placement is seeded
// per cave cell, while the actual creatures live, move and die in world.mobs.
export const AMBIENT_CELL_WIDTH = 26;
export const AMBIENT_CELL_HEIGHT = 14;
const GROVE_EXCLUSION_RADIUS = 65;

function caveAt(tx, ty) {
  const column = tx - WEST_EXTENSION;
  return (isDryIslandCave(column, ty) && groveDistance(column, ty) > GROVE_EXCLUSION_RADIUS)
    || isDryJungleCave(column, ty);
}

function openCaveAt(world, tx, ty) {
  return tx >= 0 && tx < COLS && ty >= 2 && ty < ROWS - 2
    && caveAt(tx, ty)
    && tileAt(world, tx, ty) === MATERIAL.air
    && !waterTileAt(world, tx, ty);
}

export function bugHasFloor(world, x, y) {
  const tx = Math.floor(x / TILE);
  const floor = Math.floor((y + 2) / TILE);
  return openCaveAt(world, tx, floor - 1)
    && openCaveAt(world, tx, floor - 2)
    && tileAt(world, tx, floor) !== MATERIAL.air;
}

export function batHasAir(world, x, y) {
  return openCaveAt(world, Math.floor(x / TILE), Math.floor(y / TILE))
    && openCaveAt(world, Math.floor((x - 4) / TILE), Math.floor(y / TILE))
    && openCaveAt(world, Math.floor((x + 4) / TILE), Math.floor(y / TILE))
    && openCaveAt(world, Math.floor(x / TILE), Math.floor((y - 4) / TILE))
    && openCaveAt(world, Math.floor(x / TILE), Math.floor((y + 4) / TILE));
}

function seedCreature(world, cellX, cellY) {
  const tx = cellX * AMBIENT_CELL_WIDTH + 4
    + Math.floor(noise(cellX, cellY, 701) * (AMBIENT_CELL_WIDTH - 8));
  const start = cellY * AMBIENT_CELL_HEIGHT;
  if (tx < 0 || tx >= COLS) return [];
  const phase = noise(cellX, cellY, 702) * Math.PI * 2;
  const facing = noise(cellX, cellY, 703) < 0.5 ? -1 : 1;
  const result = [];
  if (noise(cellX, cellY, 704) < 0.4) {
    for (let i = 2; i < AMBIENT_CELL_HEIGHT; i++) {
      const floor = start + i;
      const x = (tx + .5) * TILE;
      const y = floor * TILE - 2;
      if (!bugHasFloor(world, x, y)) continue;
      result.push({
        id: `ambient-${cellX}-${cellY}-ground`,
        kind: noise(cellX, cellY, 705) < .55 ? 'ambient-ant' : 'ambient-spider',
        x, y, phase, facing,
        jungle: isDryJungleCave(tx - WEST_EXTENSION, floor - 1),
      });
      break;
    }
  }
  if (noise(cellX, cellY, 706) < .22) {
    const row = start + 2 + Math.floor(noise(cellX, cellY, 707) * (AMBIENT_CELL_HEIGHT - 4));
    const x = (tx + .5) * TILE;
    const y = (row + .5) * TILE;
    if (batHasAir(world, x, y)
      && batHasAir(world, x - TILE, y)
      && batHasAir(world, x + TILE, y)) {
      result.push({
        id: `ambient-${cellX}-${cellY}-bat`,
        kind: 'ambient-bat',
        x, y, phase: phase + 1.7, facing,
        jungle: isDryJungleCave(tx - WEST_EXTENSION, row),
      });
    }
  }
  return result;
}

// Useful for tests and inspection, not the rendering pipeline.
export function caveFaunaInView(world, camera) {
  const minX = Math.max(0, Math.floor(camera.x / (TILE * AMBIENT_CELL_WIDTH)));
  const maxX = Math.min(Math.floor((COLS - 1) / AMBIENT_CELL_WIDTH),
    Math.floor((camera.x + camera.width) / (TILE * AMBIENT_CELL_WIDTH)));
  const minY = Math.max(0, Math.floor(camera.y / (TILE * AMBIENT_CELL_HEIGHT)));
  const maxY = Math.min(Math.floor((ROWS - 1) / AMBIENT_CELL_HEIGHT),
    Math.floor((camera.y + camera.height) / (TILE * AMBIENT_CELL_HEIGHT)));
  const fauna = [];
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) fauna.push(...seedCreature(world, cx, cy));
  }
  return fauna;
}

// Lazy, one-time cell seeding prevents massive offscreen mob arrays and makes
// visited areas stable even when the player leaves and returns.
export function spawnCaveFaunaNear(world, player) {
  const column = Math.floor(player.x / TILE) - WEST_EXTENSION;
  const row = Math.floor(player.y / TILE);
  if (!isDryIslandCave(column, row) && !isDryJungleCave(column, row)) return;
  world.ambientCells ??= new Set();
  const cx = Math.floor(player.x / (TILE * AMBIENT_CELL_WIDTH));
  const cy = Math.floor(player.y / (TILE * AMBIENT_CELL_HEIGHT));
  for (let y = Math.max(0, cy - 3); y <= Math.min(Math.floor((ROWS - 1) / AMBIENT_CELL_HEIGHT), cy + 3); y++) {
    for (let x = Math.max(0, cx - 2); x <= Math.min(Math.floor((COLS - 1) / AMBIENT_CELL_WIDTH), cx + 2); x++) {
      const key = x + ':' + y;
      if (world.ambientCells.has(key)) continue;
      world.ambientCells.add(key);
      for (const creature of seedCreature(world, x, y)) {
        world.mobs.push({
          ...creature,
          homeX: creature.x, homeY: creature.y,
          maxHealth: 1, health: 1, respawn: 0, respawnDelay: 150,
          dx: 0, dy: 0, flee: 0, hurt: 0, rooted: 0,
          wanderTime: .6 + noise(x, y, 708) * 2,
          wanderStep: 0, cooldown: 0,
        });
      }
    }
  }
}
