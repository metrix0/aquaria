import { MATERIAL } from '../content.js';
import { CORAL_COLUMN, WEST_EXTRA } from './ocean-layout.js';

const TILE_SIZE = 16;

// Located on the deep ocean seabed west of the coral wall (CORAL_COLUMN),
// with an eastern causeway crossing the coral wall to a smaller puzzle sanctuary on the right side.
export const WATER_TEMPLE = Object.freeze({
  center: -412 - WEST_EXTRA,
  left: -449 - WEST_EXTRA,
  right: -292 - WEST_EXTRA,
  seabedRow: 113,
  deckRow: 109,
  topRow: 24,
  approachRow: 76,
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

/** Flatten the western abyss seabed smoothly to support the Water Temple base without altering the east approach vent. */
export function waterTempleFloor(column, naturalFloor) {
  if (column >= WATER_TEMPLE.left && column <= WATER_TEMPLE.right) {
    return column >= -381 - WEST_EXTRA ? waterTempleFoundationTop(column) : WATER_TEMPLE.seabedRow;
  }
  const distance = column < WATER_TEMPLE.left
    ? WATER_TEMPLE.left - column
    : column - WATER_TEMPLE.right;
  if (distance >= WATER_TEMPLE.blendMargin) return naturalFloor;
  const t = distance / WATER_TEMPLE.blendMargin;
  const smooth = t * t * (3 - 2 * t);
  const edge = column < WATER_TEMPLE.left ? WATER_TEMPLE.seabedRow : waterTempleFoundationTop(WATER_TEMPLE.right);
  return Math.round(edge * (1 - smooth) + naturalFloor * smooth);
}

/** Top solid row of the stepped temple stone foundation at a world-relative column, or null outside the plinth. */
export function waterTempleFoundationTop(column) {
  if (column < WATER_TEMPLE.left || column > WATER_TEMPLE.right) return null;
  const { center, deckRow, approachRow, approachWest, approachEast } = WATER_TEMPLE;
  // The elevated coral-gate terrace is continuous on both sides of the barrier.
  if (column >= approachWest && column <= approachEast) return approachRow;
  // Long processional steps climb from the eastern seabed into the temple's gatehouse.
  if (column > approachEast) return approachRow + 2 * Math.ceil((column - approachEast) / 3);
  // The western processional steps lead down from the gate to the main portico.
  if (column >= -381 - WEST_EXTRA) return Math.min(deckRow, approachRow + 3 * Math.ceil((approachWest - column) / 2));
  const distance = Math.abs(column - center);
  return deckRow + (distance <= 30 ? 0 : distance <= 34 ? 1 : 2);
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
