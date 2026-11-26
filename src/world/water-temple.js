import { MATERIAL } from '../content.js';
import { CORAL_COLUMN } from './ocean-layout.js';

const TILE_SIZE = 16;

// Located on the deep ocean seabed west ("after") of the coral wall (CORAL_COLUMN = -357).
export const WATER_TEMPLE = Object.freeze({
  center: -420,
  left: -442,
  right: -398,
  seabedRow: 113,
  deckRow: 110,
  topRow: 91,
  blendMargin: 8,
});

export const WATER_TEMPLE_DOOR = Object.freeze({
  column: WATER_TEMPLE.center,
  floor: WATER_TEMPLE.deckRow,
  widthTiles: 4,
  heightTiles: 6,
  prompt: 'Sealed Water Temple door',
});

// Two glowing braziers flank the main sanctuary doorway and two mark the outer colonnade terrace.
export const waterTempleBraziers = Object.freeze([
  Object.freeze({ column: WATER_TEMPLE.center - 6, floor: WATER_TEMPLE.deckRow, main: true }),
  Object.freeze({ column: WATER_TEMPLE.center + 6, floor: WATER_TEMPLE.deckRow, main: true }),
  Object.freeze({ column: WATER_TEMPLE.center - 17, floor: WATER_TEMPLE.deckRow + 1, main: false }),
  Object.freeze({ column: WATER_TEMPLE.center + 17, floor: WATER_TEMPLE.deckRow + 1, main: false }),
]);

/** Return the world-space bounds of the temple's central main doorway for rendering and future entry interaction. */
export function waterTempleDoorBounds(westExtension) {
  const centerX = (WATER_TEMPLE_DOOR.column + westExtension + 0.5) * TILE_SIZE;
  const width = WATER_TEMPLE_DOOR.widthTiles * TILE_SIZE;
  const height = WATER_TEMPLE_DOOR.heightTiles * TILE_SIZE;
  return {
    tx: WATER_TEMPLE_DOOR.column + westExtension,
    floor: WATER_TEMPLE_DOOR.floor,
    x: centerX - width / 2,
    y: WATER_TEMPLE_DOOR.floor * TILE_SIZE - height,
    width,
    height,
  };
}

/** Flatten the western abyss seabed smoothly to support the Water Temple base without altering the east approach vent. */
export function waterTempleFloor(column, naturalFloor) {
  if (column >= WATER_TEMPLE.left && column <= WATER_TEMPLE.right) {
    return WATER_TEMPLE.seabedRow;
  }
  const distance = column < WATER_TEMPLE.left
    ? WATER_TEMPLE.left - column
    : column - WATER_TEMPLE.right;
  if (distance >= WATER_TEMPLE.blendMargin) return naturalFloor;
  const t = distance / WATER_TEMPLE.blendMargin;
  const smooth = t * t * (3 - 2 * t);
  return Math.round(WATER_TEMPLE.seabedRow * (1 - smooth) + naturalFloor * smooth);
}

/** Top solid row of the stepped temple stone foundation at a world-relative column, or null outside the plinth. */
export function waterTempleFoundationTop(column) {
  const distance = Math.abs(column - WATER_TEMPLE.center);
  if (distance <= 15) return WATER_TEMPLE.deckRow;
  if (distance <= 19) return WATER_TEMPLE.deckRow + 1;
  if (distance <= 22) return WATER_TEMPLE.deckRow + 2;
  return null;
}

/** True when (column, row) is part of the carved solid stone Water Temple plinth and foundation anchor. */
export function waterTempleStoneAt(column, row) {
  if (CORAL_COLUMN <= column) return false;
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
  const minTy = Math.max(bounds.top, WATER_TEMPLE.deckRow);
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
