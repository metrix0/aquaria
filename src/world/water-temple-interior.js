import { MATERIAL } from '../content.js';
import { TILE, WEST_EXTENSION } from './generation.js';
import { waterTempleDoorBounds } from './water-temple.js';

export const OVERWORLD_ZONE = 'overworld';
export const WATER_TEMPLE_ZONE = 'water-temple';

export const WATER_TEMPLE_INTERIOR = Object.freeze({
  cols: 72,
  rows: 56,
  waterRow: 45,
  lowerFloorRow: 51,
  sanctumFloorRow: 15,
  exitColumn: 10,
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

/** Create the standalone enclosed Water Temple interior world. */
export function createWaterTempleWorld() {
  const { cols, rows, waterRow, lowerFloorRow, sanctumFloorRow, exitColumn } = WATER_TEMPLE_INTERIOR;
  const grid = new Uint8Array(cols * rows);
  const flooded = new Uint8Array(cols * rows);

  // Solid stone enclosure: roof, floor, and side walls.
  fillRect(grid, cols, 0, 0, cols - 1, 4, MATERIAL.stone);
  fillRect(grid, cols, 0, lowerFloorRow, cols - 1, rows - 1, MATERIAL.stone);
  fillRect(grid, cols, 0, 0, 4, rows - 1, MATERIAL.stone);
  fillRect(grid, cols, cols - 5, 0, cols - 1, rows - 1, MATERIAL.stone);

  // Stepped ceiling vaulting inside the hall.
  fillRect(grid, cols, 5, 5, 11, 7, MATERIAL.stone);
  fillRect(grid, cols, cols - 12, 5, cols - 6, 7, MATERIAL.stone);
  fillRect(grid, cols, 12, 5, 16, 5, MATERIAL.stone);
  fillRect(grid, cols, cols - 17, 5, cols - 13, 5, MATERIAL.stone);

  // Lower flooded hall: central sunken pillar and stepped approaches to both wings.
  fillRect(grid, cols, 33, lowerFloorRow - 4, 38, lowerFloorRow - 1, MATERIAL.stone);
  for (let step = 0; step < 4; step++) {
    const row = waterRow + 1 - step * 2;
    fillRect(grid, cols, 17 + step * 2, row, 20 + step * 2, row, MATERIAL.stone);
    fillRect(grid, cols, 51 - step * 2, row, 54 - step * 2, row, MATERIAL.stone);
  }

  // Mid-tier central bridge & side chambers (branching paths).
  fillRect(grid, cols, 25, 35, 46, 36, MATERIAL.stone);
  fillRect(grid, cols, 14, 38, 22, 39, MATERIAL.stone);
  fillRect(grid, cols, 49, 38, 57, 39, MATERIAL.stone);

  // West Wing ascent (left path climbing up to the upper sanctum).
  fillRect(grid, cols, 6, 33, 12, 34, MATERIAL.stone);
  fillRect(grid, cols, 14, 28, 21, 29, MATERIAL.stone);
  fillRect(grid, cols, 7, 23, 13, 24, MATERIAL.stone);
  fillRect(grid, cols, 15, 18, 23, 19, MATERIAL.stone);

  // East Wing ascent (right path climbing up to the upper sanctum).
  fillRect(grid, cols, 59, 33, 65, 34, MATERIAL.stone);
  fillRect(grid, cols, 50, 28, 57, 29, MATERIAL.stone);
  fillRect(grid, cols, 58, 23, 64, 24, MATERIAL.stone);
  fillRect(grid, cols, 48, 18, 56, 19, MATERIAL.stone);

  // Central shaft platforms (direct middle path from mid-tier bridge up to sanctum).
  fillRect(grid, cols, 31, 29, 40, 30, MATERIAL.stone);
  fillRect(grid, cols, 26, 23, 32, 24, MATERIAL.stone);
  fillRect(grid, cols, 39, 23, 45, 24, MATERIAL.stone);

  // Center Sanctum Room at the top: enclosed chamber with side doorways and central door.
  fillRect(grid, cols, 25, sanctumFloorRow, 46, sanctumFloorRow + 1, MATERIAL.stone);
  fillRect(grid, cols, 25, 6, 46, 7, MATERIAL.stone);
  fillRect(grid, cols, 25, 8, 26, sanctumFloorRow - 4, MATERIAL.stone);
  fillRect(grid, cols, 45, 8, 46, sanctumFloorRow - 4, MATERIAL.stone);

  // Flood the lower chamber up to waterRow while keeping the upper sanctuary airy.
  for (let ty = waterRow; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (grid[ty * cols + tx] === MATERIAL.air) {
        flooded[ty * cols + tx] = 1;
      }
    }
  }

  const exitDoorWidth = WATER_TEMPLE_INTERIOR.exitDoorWidthTiles * TILE;
  const exitDoorHeight = WATER_TEMPLE_INTERIOR.exitDoorHeightTiles * TILE;
  const exitCenterX = (exitColumn + 0.5) * TILE;
  const exitBounds = {
    tx: exitColumn,
    floor: lowerFloorRow,
    x: exitCenterX - exitDoorWidth / 2,
    y: lowerFloorRow * TILE - exitDoorHeight,
    width: exitDoorWidth,
    height: exitDoorHeight,
  };

  const sanctumChest = {
    id: 'water-temple-sanctum-chest',
    name: 'Sanctum Chest',
    kind: 'chest',
    loot: { id: 'pearl', count: 5 },
    x: 31 * TILE,
    y: (sanctumFloorRow - 1) * TILE,
  };

  const sanctumDoorWidth = WATER_TEMPLE_INTERIOR.exitDoorWidthTiles * TILE;
  const sanctumDoorHeight = WATER_TEMPLE_INTERIOR.exitDoorHeightTiles * TILE;
  const sanctumDoorCenterX = (36 + 0.5) * TILE;
  const sanctumDoorBounds = {
    tx: 36,
    floor: sanctumFloorRow,
    x: sanctumDoorCenterX - sanctumDoorWidth / 2,
    y: sanctumFloorRow * TILE - sanctumDoorHeight,
    width: sanctumDoorWidth,
    height: sanctumDoorHeight,
  };

  return {
    zone: WATER_TEMPLE_ZONE,
    cols,
    rows,
    waterRow,
    immutableTerrain: true,
    grid,
    flooded,
    items: [sanctumChest],
    templeDoors: [
      {
        id: 'water-temple-exit-door',
        kind: 'temple-door',
        targetZone: OVERWORLD_ZONE,
        name: 'Water Temple Exit',
        prompt: 'Exit Water Temple',
        tx: exitColumn,
        floor: lowerFloorRow,
        x: exitCenterX,
        y: lowerFloorRow * TILE - 16,
        bounds: exitBounds,
      },
      {
        id: 'water-temple-sanctum-door',
        kind: 'temple-door',
        targetZone: OVERWORLD_ZONE,
        name: 'Sanctum Door',
        prompt: 'Enter Sanctum Door',
        tx: sanctumDoorBounds.tx,
        floor: sanctumDoorBounds.floor,
        x: sanctumDoorCenterX,
        y: sanctumDoorBounds.floor * TILE - 16,
        bounds: sanctumDoorBounds,
      },
    ],
    braziers: [
      { tx: exitColumn - 4, floor: lowerFloorRow, main: true },
      { tx: exitColumn + 4, floor: lowerFloorRow, main: true },
      { tx: 25, floor: sanctumFloorRow, main: true },
      { tx: 36, floor: sanctumFloorRow, main: false },
      { tx: 47, floor: sanctumFloorRow, main: true },
      { tx: 60, floor: lowerFloorRow, main: false },
    ],
    trees: [],
    caveMushrooms: [],
    doors: new Map(),
    tent: null,
    mobs: [],
    caveTraps: [],
    caveClimbs: [],
    caveStructures: [],
    mineDecks: [],
    projectiles: [],
    vents: [],
    fixtureIds: new Set([sanctumChest.id]),
    harvested: new Set(),
    pendingWreckLoot: new Map(),
    chunks: new Map(),
    edits: new Map(),
    recentChunk: null,
    spawnPoint: {
      x: (exitColumn + 4) * TILE,
      floorY: lowerFloorRow * TILE,
      facing: 1,
    },
  };
}
