import { MATERIAL } from '../content.js';
import { TEMPLE_SANCTUM_LOOT } from '../loot.js';
import { STARTER_CLASS_IDS, STARTER_CLASSES } from '../starter-classes.js';
import { TILE, WEST_EXTENSION } from './generation.js';
import { waterTempleDoorBounds } from './water-temple.js';

export const OVERWORLD_ZONE = 'overworld';
export const WATER_TEMPLE_ZONE = 'water-temple';

export const WATER_TEMPLE_INTERIOR = Object.freeze({
  cols: 46,
  rows: 26,
  waterRow: 26,
  lowerFloorRow: 20,
  exitColumn: 7,
  exitDoorWidthTiles: 4,
  exitDoorHeightTiles: 6,
});

function fillRect(grid, cols, left, top, right, bottom, material) {
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      grid[ty * cols + tx] = material;
    }
  }
}

/** Return the overworld main door entry descriptor for the Water Temple. */
export function createOverworldTempleDoors(westExtension = WEST_EXTENSION) {
  const bounds = waterTempleDoorBounds(westExtension);
  return [
    {
      id: 'water-temple-main-door',
      kind: 'temple-door',
      targetZone: WATER_TEMPLE_ZONE,
      name: 'Water Temple',
      prompt: 'Enter Water Temple',
      tx: bounds.tx,
      floor: bounds.floor,
      x: bounds.x + bounds.width / 2,
      y: bounds.floor * TILE - 16,
      bounds,
    },
  ];
}

export const STATUE_AWAKEN_SECONDS = 1.65;
// Statue including pedestal: 68 px, versus 23 px for a standing player.
export const CLASS_STATUE_HEIGHT = 68;
export const CLASS_STATUE_HALF_WIDTH = 26;
export const CLASS_STATUES = Object.freeze(STARTER_CLASS_IDS.map((classId, index) => {
  const column = [17, 24, 31][index];
  const floor = WATER_TEMPLE_INTERIOR.lowerFloorRow;
  const def = STARTER_CLASSES[classId];
  return Object.freeze({
    id: 'class-statue-' + classId, kind: 'class-statue', classId,
    name: def.name, accent: def.accent, column, floor,
    x: (column + .5) * TILE, y: floor * TILE - 16,
    bounds: Object.freeze({ x: (column + .5) * TILE - CLASS_STATUE_HALF_WIDTH, y: floor * TILE - CLASS_STATUE_HEIGHT, width: CLASS_STATUE_HALF_WIDTH * 2, height: CLASS_STATUE_HEIGHT }),
  });
}));

/** One dry, unobstructed chamber with a single entrance/exit. */
export function createWaterTempleWorld() {
  const { cols, rows, waterRow, lowerFloorRow, exitColumn } = WATER_TEMPLE_INTERIOR;
  const grid = new Uint8Array(cols * rows);
  const flooded = new Uint8Array(cols * rows);
  fillRect(grid, cols, 0, 0, cols - 1, 2, MATERIAL.stone);
  fillRect(grid, cols, 0, lowerFloorRow, cols - 1, rows - 1, MATERIAL.stone);
  fillRect(grid, cols, 0, 0, 3, rows - 1, MATERIAL.stone);
  fillRect(grid, cols, cols - 4, 0, cols - 1, rows - 1, MATERIAL.stone);
  // Vaulted shoulders are solid, but the entire floor remains open and level.
  for (let i = 0; i < 5; i++) {
    fillRect(grid, cols, 4 + i * 2, 3, 5 + i * 2, 7 - i, MATERIAL.stone);
    fillRect(grid, cols, cols - 6 - i * 2, 3, cols - 5 - i * 2, 7 - i, MATERIAL.stone);
  }

  const width = WATER_TEMPLE_INTERIOR.exitDoorWidthTiles * TILE;
  const height = WATER_TEMPLE_INTERIOR.exitDoorHeightTiles * TILE;
  const exitX = (exitColumn + .5) * TILE;
  const exitBounds = { tx: exitColumn, floor: lowerFloorRow,
    x: exitX - width / 2, y: lowerFloorRow * TILE - height, width, height };
  // Preserve the existing sanctum reward and chest ID so saved loot is not reset.
  const chest = { id: 'water-temple-sanctum-chest', name: 'Sanctum Chest', kind: 'chest',
    loot: { ...TEMPLE_SANCTUM_LOOT }, x: 40 * TILE, y: lowerFloorRow * TILE - 8 };
  return {
    zone: WATER_TEMPLE_ZONE, cols, rows, waterRow, immutableTerrain: true, grid, flooded,
    items: [...CLASS_STATUES, chest],
    templeDoors: [{ id: 'water-temple-exit-door', kind: 'temple-door', targetZone: OVERWORLD_ZONE,
      name: 'Water Temple Exit', prompt: 'Exit Water Temple', tx: exitColumn, floor: lowerFloorRow,
      x: exitX, y: lowerFloorRow * TILE - 16, bounds: exitBounds }],
    braziers: [5, 11, 13, 21, 28, 35, 38].map(tx => ({ tx, floor: lowerFloorRow, main: true })),
    statueAwakening: null,
    trees: [], caveMushrooms: [], doors: new Map(), tent: null, mobs: [],
    caveTraps: [], caveClimbs: [], caveStructures: [], mineDecks: [], projectiles: [], vents: [],
    fixtureIds: new Set([chest.id, ...CLASS_STATUES.map(s => s.id)]),
    harvested: new Set(), pendingWreckLoot: new Map(), chunks: new Map(), edits: new Map(), recentChunk: null,
    spawnPoint: { x: (exitColumn + 4) * TILE, floorY: lowerFloorRow * TILE, facing: 1 },
  };
}
