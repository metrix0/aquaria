import { MATERIAL } from '../content.js';
import { CORAL_COLUMN, WEST_EXTRA } from './ocean-layout.js';

const TILE_SIZE = 16;
const TEMPLE_PLATEAU_ROW = 76;

// One raised temple plateau spans the coral wall. The eastern staircase
// climbs directly to this level, from the gatehouse to the main sanctuary.
export const WATER_TEMPLE = Object.freeze({
  center: -412 - WEST_EXTRA,
  left: -449 - WEST_EXTRA,
  right: -292 - WEST_EXTRA,
  seabedRow: 113,
  deckRow: TEMPLE_PLATEAU_ROW,
  topRow: 0,
  approachRow: TEMPLE_PLATEAU_ROW,
  approachWest: -359 - WEST_EXTRA,
  approachEast: -339 - WEST_EXTRA,
  blendMargin: 8,
});

export const WATER_TEMPLE_DOOR = Object.freeze({
  column: WATER_TEMPLE.center,
  floor: WATER_TEMPLE.deckRow,
  widthTiles: 6,
  heightTiles: 9,
  prompt: 'Sealed Water Temple door',
});

export const WATER_TEMPLE_PUZZLE_DOOR = Object.freeze({
  column: -346 - WEST_EXTRA,
  floor: WATER_TEMPLE.approachRow,
  widthTiles: 3,
  heightTiles: 4,
  prompt: 'Sealed Coral Sanctum door',
});

// Glowing braziers flank the main sanctuary doorway, outer colonnade, and east puzzle doorway.
export const waterTempleBraziers = Object.freeze([
  Object.freeze({ column: WATER_TEMPLE.center - 8, floor: WATER_TEMPLE.deckRow, main: true }),
  Object.freeze({ column: WATER_TEMPLE.center + 8, floor: WATER_TEMPLE.deckRow, main: true }),
  Object.freeze({ column: WATER_TEMPLE.center - 23, floor: waterTempleFoundationTop(WATER_TEMPLE.center - 23), main: false }),
  Object.freeze({ column: WATER_TEMPLE.center + 23, floor: waterTempleFoundationTop(WATER_TEMPLE.center + 23), main: false }),
  Object.freeze({ column: WATER_TEMPLE_PUZZLE_DOOR.column - 4, floor: WATER_TEMPLE_PUZZLE_DOOR.floor, main: false }),
  Object.freeze({ column: WATER_TEMPLE_PUZZLE_DOOR.column + 4, floor: WATER_TEMPLE_PUZZLE_DOOR.floor, main: false }),
]);

function doorBounds(doorSpec, westExtension) {
  const centerX = (doorSpec.column + westExtension + 0.5) * TILE_SIZE;
  const width = doorSpec.widthTiles * TILE_SIZE;
  const height = doorSpec.heightTiles * TILE_SIZE;
  return {
    tx: doorSpec.column + westExtension,
    floor: doorSpec.floor,
    x: centerX - width / 2,
    y: doorSpec.floor * TILE_SIZE - height,
    width,
    height,
  };
}

/** Return the world-space bounds of the temple's central main doorway for rendering and future entry interaction. */
export function waterTempleDoorBounds(westExtension) {
  return doorBounds(WATER_TEMPLE_DOOR, westExtension);
}

/** Return the world-space bounds of the smaller puzzle doorway on the east side of the coral wall. */
export function waterTemplePuzzleDoorBounds(westExtension) {
  return doorBounds(WATER_TEMPLE_PUZZLE_DOOR, westExtension);
}

/** Match the terrain surface to the raised temple foundation and blend its edges into the seabed. */
export function waterTempleFloor(column, naturalFloor) {
  if (column >= WATER_TEMPLE.left && column <= WATER_TEMPLE.right) {
    return waterTempleFoundationTop(column);
  }
  const distance = column < WATER_TEMPLE.left
    ? WATER_TEMPLE.left - column
    : column - WATER_TEMPLE.right;
  if (distance >= WATER_TEMPLE.blendMargin) return naturalFloor;
  const t = distance / WATER_TEMPLE.blendMargin;
  const smooth = t * t * (3 - 2 * t);
  const edge = waterTempleFoundationTop(column < WATER_TEMPLE.left ? WATER_TEMPLE.left : WATER_TEMPLE.right);
  return Math.round(edge * (1 - smooth) + naturalFloor * smooth);
}

/** Top solid row of the stepped temple stone foundation at a world-relative column, or null outside the plinth. */
export function waterTempleFoundationTop(column) {
  if (column < WATER_TEMPLE.left || column > WATER_TEMPLE.right) return null;
  const { deckRow, approachRow, approachEast } = WATER_TEMPLE;
  // After climbing the eastern staircase, the player never descends again:
  // the gatehouse, coral crossing, grand hall and main door share one floor.
  if (column <= approachEast) return deckRow;
  return approachRow + 2 * Math.ceil((column - approachEast) / 3);
}

/** True when (column, row) is part of the carved solid stone Water Temple plinth and foundation anchor. */
export function waterTempleStoneAt(column, row) {
  const top = waterTempleFoundationTop(column);
  return top !== null && row >= top && row <= WATER_TEMPLE.seabedRow + 4;
}

/** Prevent underground caves and random veins from punching holes through the Water Temple sanctuary or terrace. */
export function protectsWaterTemple(column, row) {
  return column >= WATER_TEMPLE.left - 2 &&
    column <= WATER_TEMPLE.right + 2 &&
    row >= WATER_TEMPLE.topRow - 4 &&
    row <= WATER_TEMPLE.seabedRow + 6;
}

/** Paint solid carved foundation steps for the Water Temple during chunk generation. */
export function placeWaterTemple(set, bounds, westExtension) {
  const minTx = Math.max(bounds.left, WATER_TEMPLE.left + westExtension);
  const maxTx = Math.min(bounds.right, WATER_TEMPLE.right + westExtension);
  const minTy = Math.max(bounds.top, WATER_TEMPLE.approachRow);
  const maxTy = Math.min(bounds.bottom, WATER_TEMPLE.seabedRow + 4);
  if (minTx > maxTx || minTy > maxTy) return;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (waterTempleStoneAt(tx - westExtension, ty)) {
        set(tx, ty, MATERIAL.stone);
      }
    }
  }
}

/** Deterministic stone block tone helper shared by water temple art rendering. */
export function waterTempleTone(column, row) {
  let value = Math.imul(column + 171, 1597334677) ^ Math.imul(row + 313, 3812015801) ^ 0x4b93a21;
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}
