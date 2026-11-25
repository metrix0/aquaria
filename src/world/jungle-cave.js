import { EAST_SHIFT } from "./ocean-layout.js";
import { placeLedgeClimbs } from './climb-placement.js';
export const JUNGLE_CAVE = Object.freeze({
  center: 364 + EAST_SHIFT,
  entry: 364 + EAST_SHIFT,
  entryFloor: 31,
  deepstoneRow: 230,
  sanctuaryCenter: 368 + EAST_SHIFT,
  sanctuaryFloor: 452,
  idolColumn: 368 + EAST_SHIFT,
  mossStartRow: 74,
  scriptureStartRow: 96,
});

export const JUNGLE_DEEPSTONE_ROW = JUNGLE_CAVE.deepstoneRow;

const entryRoom = [
  [354 + EAST_SHIFT, 31, 6], [360 + EAST_SHIFT, 31, 8], [364 + EAST_SHIFT, 31, 8], [369 + EAST_SHIFT, 31, 8], [375 + EAST_SHIFT, 31, 6],
];

// Tier 1: Forking native descent into a tall central bone vault with an upper ledge & alcove.
const upperTiers = [
  [[356 + EAST_SHIFT, 31, 6], [349 + EAST_SHIFT, 43, 10], [342 + EAST_SHIFT, 57, 12], [334 + EAST_SHIFT, 72, 11]],
  [[373 + EAST_SHIFT, 31, 6], [380 + EAST_SHIFT, 41, 10], [387 + EAST_SHIFT, 53, 11], [394 + EAST_SHIFT, 66, 10]],
  [[334 + EAST_SHIFT, 72, 10], [346 + EAST_SHIFT, 70, 14], [358 + EAST_SHIFT, 68, 16], [370 + EAST_SHIFT, 68, 15], [382 + EAST_SHIFT, 66, 13], [395 + EAST_SHIFT, 66, 10]],
];

// Tier 2 & 3: Twin western/eastern shafts linked by cross-galleries and a false-floor trap chamber.
const midBranches = [
  // Western mossy shaft & side alcove
  [[335 + EAST_SHIFT, 72, 10], [338 + EAST_SHIFT, 92, 14], [342 + EAST_SHIFT, 114, 15], [348 + EAST_SHIFT, 136, 15], [356 + EAST_SHIFT, 140, 12]],
  [[328 + EAST_SHIFT, 112, 8], [334 + EAST_SHIFT, 112, 11], [340 + EAST_SHIFT, 114, 10]],
  // Eastern canyon descent
  [[390 + EAST_SHIFT, 66, 10], [394 + EAST_SHIFT, 84, 13], [396 + EAST_SHIFT, 106, 14], [390 + EAST_SHIFT, 124, 14], [378 + EAST_SHIFT, 134, 13]],
  // Mid cross-gallery bridged over the pit trap
  [[346 + EAST_SHIFT, 138, 11], [356 + EAST_SHIFT, 138, 13], [365 + EAST_SHIFT, 138, 14], [376 + EAST_SHIFT, 138, 13], [386 + EAST_SHIFT, 134, 11]],
  // False-ground pit below columns 364..365 opening into a lower grotto
  [[354 + EAST_SHIFT, 164, 12], [362 + EAST_SHIFT, 164, 28], [368 + EAST_SHIFT, 164, 28], [376 + EAST_SHIFT, 164, 14], [384 + EAST_SHIFT, 178, 14], [394 + EAST_SHIFT, 198, 15]],
  // West & East Tier 3 descents converging on Crossroads Vault
  [[344 + EAST_SHIFT, 138, 11], [335 + EAST_SHIFT, 156, 14], [332 + EAST_SHIFT, 178, 14], [340 + EAST_SHIFT, 198, 15], [352 + EAST_SHIFT, 206, 15]],
  [[390 + EAST_SHIFT, 134, 11], [398 + EAST_SHIFT, 154, 13], [402 + EAST_SHIFT, 176, 14], [394 + EAST_SHIFT, 198, 15], [380 + EAST_SHIFT, 206, 15]],
  [[344 + EAST_SHIFT, 206, 14], [358 + EAST_SHIFT, 206, 20], [372 + EAST_SHIFT, 208, 21], [386 + EAST_SHIFT, 206, 18], [396 + EAST_SHIFT, 204, 13]],
];

// Tier 4 & 5: Ancient statue colonnades, trap shaft, dual wings & pre-sanctum vestibule.
const templeBranches = [
  // Upper West & East Statue Galleries
  [[346 + EAST_SHIFT, 206, 12], [338 + EAST_SHIFT, 228, 15], [334 + EAST_SHIFT, 250, 16], [342 + EAST_SHIFT, 264, 17], [362 + EAST_SHIFT, 264, 22]],
  [[388 + EAST_SHIFT, 205, 12], [396 + EAST_SHIFT, 226, 15], [400 + EAST_SHIFT, 248, 16], [392 + EAST_SHIFT, 260, 17], [372 + EAST_SHIFT, 264, 21]],
  // Bridge across upper statue tier above the deep false-ground shaft
  [[356 + EAST_SHIFT, 264, 19], [366 + EAST_SHIFT, 264, 22], [378 + EAST_SHIFT, 264, 19]],
  // Central trap shaft (columns 364..370) + Lower Statue Colonnade (floor = 326)
  [[362 + EAST_SHIFT, 326, 22], [367 + EAST_SHIFT, 326, 66], [372 + EAST_SHIFT, 326, 22]],
  [[340 + EAST_SHIFT, 264, 13], [334 + EAST_SHIFT, 286, 15], [332 + EAST_SHIFT, 308, 16], [344 + EAST_SHIFT, 324, 18], [364 + EAST_SHIFT, 326, 22]],
  [[394 + EAST_SHIFT, 260, 13], [400 + EAST_SHIFT, 284, 15], [402 + EAST_SHIFT, 306, 16], [390 + EAST_SHIFT, 322, 18], [370 + EAST_SHIFT, 326, 22]],
  // Twin Pre-Sanctum approaches meeting at Altar Hall (floor = 396)
  [[342 + EAST_SHIFT, 324, 14], [334 + EAST_SHIFT, 348, 16], [332 + EAST_SHIFT, 372, 16], [344 + EAST_SHIFT, 392, 17], [360 + EAST_SHIFT, 396, 16]],
  [[390 + EAST_SHIFT, 322, 14], [398 + EAST_SHIFT, 346, 16], [400 + EAST_SHIFT, 370, 16], [388 + EAST_SHIFT, 392, 17], [372 + EAST_SHIFT, 396, 16]],
  [[346 + EAST_SHIFT, 394, 14], [360 + EAST_SHIFT, 396, 22], [374 + EAST_SHIFT, 396, 22], [388 + EAST_SHIFT, 394, 14]],
];

const cultSanctuaryTier = [
  // Symmetric twin drops into the Grand Frog Cult Sanctuary (floor = 452)
  [[348 + EAST_SHIFT, 394, 14], [339 + EAST_SHIFT, 412, 15], [334 + EAST_SHIFT, 430, 16], [338 + EAST_SHIFT, 446, 17], [346 + EAST_SHIFT, 452, 18]],
  [[388 + EAST_SHIFT, 394, 14], [396 + EAST_SHIFT, 412, 15], [401 + EAST_SHIFT, 430, 16], [397 + EAST_SHIFT, 446, 17], [390 + EAST_SHIFT, 452, 18]],
  [[334 + EAST_SHIFT, 452, 16], [344 + EAST_SHIFT, 452, 24], [356 + EAST_SHIFT, 452, 29], [368 + EAST_SHIFT, 452, 31], [380 + EAST_SHIFT, 452, 29], [392 + EAST_SHIFT, 452, 24], [402 + EAST_SHIFT, 452, 16]],
];

// Solid rock shelves inside tall galleries for multi-level platforming.
const rockLedges = [
  [[354 + EAST_SHIFT, 60, 1], [358 + EAST_SHIFT, 60, 2], [364 + EAST_SHIFT, 60, 1]],
  [[362 + EAST_SHIFT, 196, 1], [368 + EAST_SHIFT, 195, 2], [374 + EAST_SHIFT, 196, 1]],
  [[350 + EAST_SHIFT, 314, 1], [354 + EAST_SHIFT, 314, 2], [358 + EAST_SHIFT, 314, 1]],
];

// One-tile thin brittle slabs covering trap pits; deleted from dryBands so they generate solid.
const falseGroundBridges = [
  [364 + EAST_SHIFT, 138], [365 + EAST_SHIFT, 138],
  [366 + EAST_SHIFT, 264], [367 + EAST_SHIFT, 264],
];

function makeBands(profiles) {
  const columns = new Map();
  for (const profile of profiles) {
    for (let i = 1; i < profile.length; i++) {
      const [from, fromFloor, fromHeight] = profile[i - 1];
      const [to, toFloor, toHeight] = profile[i];
      const minX = Math.min(from, to);
      const maxX = Math.max(from, to);
      for (let x = minX; x <= maxX; x++) {
        const t = to === from ? 0 : (x - from) / (to - from);
        const floor = Math.round(fromFloor + (toFloor - fromFloor) * t);
        const roof = Math.round(fromFloor - fromHeight + (toFloor - toHeight - fromFloor + fromHeight) * t);
        const rows = columns.get(x) ?? new Set();
        for (let y = roof; y < floor; y++) rows.add(y);
        columns.set(x, rows);
      }
    }
  }
  return columns;
}

const dryBands = makeBands([
  entryRoom,
  ...upperTiers,
  ...midBranches,
  ...templeBranches,
  ...cultSanctuaryTier,
]);
for (const [x, ledges] of makeBands(rockLedges)) {
  for (const row of ledges) dryBands.get(x)?.delete(row);
}
for (const [x, row] of falseGroundBridges) {
  dryBands.get(x)?.delete(row);
}

// Follow naturally exposed cliff edges without digging vertical holes.
export const jungleCaveClimbs = placeLedgeClimbs([
  [341 + EAST_SHIFT, 66, 135, 'rope'],
  [388 + EAST_SHIFT, 62, 131, 'rope'],
  [336 + EAST_SHIFT, 133, 197, 'ladder'],
  [396 + EAST_SHIFT, 131, 197, 'ladder'],
  [338 + EAST_SHIFT, 200, 263, 'rope'],
  [398 + EAST_SHIFT, 200, 259, 'rope'],
  [336 + EAST_SHIFT, 258, 323, 'ladder'],
  [398 + EAST_SHIFT, 254, 321, 'rope'],
  [337 + EAST_SHIFT, 318, 391, 'rope'],
  [396 + EAST_SHIFT, 316, 391, 'ladder'],
  [338 + EAST_SHIFT, 390, 451, 'rope'],
  [396 + EAST_SHIFT, 390, 451, 'rope'],
], dryBands);
const rockShell = new Map();
const wallThickness = 14;
for (const [x, rows] of dryBands) {
  const roof = Math.min(...rows) - wallThickness;
  const floor = Math.max(...rows) + wallThickness;
  for (let tx = x - wallThickness; tx <= x + wallThickness; tx++) {
    const shell = rockShell.get(tx);
    rockShell.set(tx, [Math.min(shell?.[0] ?? roof, roof), Math.max(shell?.[1] ?? floor, floor)]);
  }
}

export function protectsJungleCave(x, y) {
  const shell = rockShell.get(x);
  return Boolean(shell && y >= shell[0] && y <= shell[1]);
}

export function isDryJungleCave(x, y) {
  return dryBands.get(x)?.has(y) ?? false;
}

export function jungleMossProgress(y) {
  if (y < JUNGLE_CAVE.mossStartRow) return 0;
  return Math.min(1, (y - JUNGLE_CAVE.mossStartRow) / (JUNGLE_CAVE.sanctuaryFloor - JUNGLE_CAVE.mossStartRow));
}

export function jungleScriptureProgress(y) {
  if (y < JUNGLE_CAVE.scriptureStartRow) return 0;
  return Math.min(1, (y - JUNGLE_CAVE.scriptureStartRow) / (JUNGLE_CAVE.sanctuaryFloor - JUNGLE_CAVE.scriptureStartRow));
}

export function carveJungleCave(set, { left, right, top, bottom }, westExtension) {
  for (let tx = left; tx <= right; tx++) {
    const x = tx - westExtension;
    for (const y of dryBands.get(x) ?? []) {
      if (y >= top && y <= bottom) set(tx, y, false);
    }
  }
}

export const jungleCaveTraps = [
  // Rising floor spike traps along ruined crossings & pit landings
  ['spike', 351 + EAST_SHIFT, 137],
  ['spike', 379 + EAST_SHIFT, 136],
  ['spike', 355 + EAST_SHIFT, 205],
  ['spike', 381 + EAST_SHIFT, 205],
  ['spike', 358 + EAST_SHIFT, 263],
  ['spike', 376 + EAST_SHIFT, 263],
  ['spike', 358 + EAST_SHIFT, 324],
  ['spike', 378 + EAST_SHIFT, 324],
  ['spike', 354 + EAST_SHIFT, 394],
  ['spike', 382 + EAST_SHIFT, 394],
  // False-ground bridges over deep shafts (tx, solid tile row ty)
  ...falseGroundBridges.map(([column, ty]) => ['false-ground', column, ty]),
];

export const jungleCaveStructures = [
  // Tier 1 (entry & upper normal cave)
  ['native-torch', 359 + EAST_SHIFT, 31], ['bones', 362 + EAST_SHIFT, 31], ['native-torch', 370 + EAST_SHIFT, 31],
  ['bones', 339 + EAST_SHIFT, 72], ['native-torch', 347 + EAST_SHIFT, 70], ['bones', 365 + EAST_SHIFT, 68], ['native-torch', 374 + EAST_SHIFT, 68], ['bones', 388 + EAST_SHIFT, 66],
  // Tier 2 (branching crypts: moss begins & rare cryptic wall scriptures)
  ['native-torch', 332 + EAST_SHIFT, 112], ['bones', 336 + EAST_SHIFT, 112], ['scripture', 354 + EAST_SHIFT, 138], ['native-torch', 371 + EAST_SHIFT, 138], ['bones', 383 + EAST_SHIFT, 134],
  // Tier 3 (pit trap gallery & mossy crossroads)
  ['bones', 360 + EAST_SHIFT, 164], ['native-torch', 370 + EAST_SHIFT, 164],
  ['native-torch', 349 + EAST_SHIFT, 206], ['scripture', 360 + EAST_SHIFT, 206], ['bones', 369 + EAST_SHIFT, 208], ['scripture', 376 + EAST_SHIFT, 206], ['native-torch', 389 + EAST_SHIFT, 206],
  // Tier 4 (dual statue halls & central abyss shaft)
  ['temple-column', 346 + EAST_SHIFT, 264], ['tentacle-statue', 353 + EAST_SHIFT, 264], ['native-torch', 362 + EAST_SHIFT, 264],
  ['tentacle-statue', 381 + EAST_SHIFT, 264], ['temple-column', 389 + EAST_SHIFT, 261], ['native-torch', 392 + EAST_SHIFT, 260],
  ['temple-column', 348 + EAST_SHIFT, 324], ['scripture', 354 + EAST_SHIFT, 325], ['tentacle-statue', 364 + EAST_SHIFT, 326],
  ['native-torch', 371 + EAST_SHIFT, 326], ['tentacle-statue', 382 + EAST_SHIFT, 324], ['temple-column', 388 + EAST_SHIFT, 322],
  // Tier 5 (pre-sanctum vestibule)
  ['temple-column', 350 + EAST_SHIFT, 394], ['tentacle-statue', 359 + EAST_SHIFT, 396], ['native-torch', 364 + EAST_SHIFT, 396],
  ['native-torch', 372 + EAST_SHIFT, 396], ['tentacle-statue', 377 + EAST_SHIFT, 396], ['temple-column', 385 + EAST_SHIFT, 394],
  // Grand Frog Cult Sanctuary (centered idol at 368, floor = 452)
  ['native-torch', 340 + EAST_SHIFT, 452], ['temple-column', 342 + EAST_SHIFT, 452], ['tentacle-statue', 348 + EAST_SHIFT, 452],
  ['scripture', 353 + EAST_SHIFT, 452], ['temple-column', 358 + EAST_SHIFT, 452], ['native-torch', 364 + EAST_SHIFT, 452],
  ['cult-idol', 368 + EAST_SHIFT, 452],
  ['native-torch', 372 + EAST_SHIFT, 452], ['temple-column', 378 + EAST_SHIFT, 452], ['scripture', 383 + EAST_SHIFT, 452],
  ['tentacle-statue', 388 + EAST_SHIFT, 452], ['temple-column', 394 + EAST_SHIFT, 452], ['native-torch', 396 + EAST_SHIFT, 452],
];

export const jungleCaveCaches = [
  { id: 'jungle-cave-upper-cache', name: 'Native bone stash', column: 358 + EAST_SHIFT, floor: 58, resource: 'arrow', amount: 14 },
  { id: 'jungle-cave-scripture-cache', name: 'Overgrown relic chest', column: 398 + EAST_SHIFT, floor: 204, resource: 'iron', amount: 6 },
  { id: 'jungle-cave-temple-cache', name: 'Sunken temple chest', column: 368 + EAST_SHIFT, floor: 396, resource: 'cobalt', amount: 5 },
];

// [id, kind, column, floor, respawnDelay]
export const jungleCaveMobs = [
  ['jungle-shaman-1', 'shaman', 347 + EAST_SHIFT, 70, 52],
  ['jungle-shaman-2', 'shaman', 372 + EAST_SHIFT, 138, 52],
  ['jungle-shaman-3', 'shaman', 352 + EAST_SHIFT, 206, 52],
  ['jungle-cave-frog-1', 'cave-frog', 350 + EAST_SHIFT, 264, 55],
  ['jungle-cave-frog-2', 'cave-frog', 372 + EAST_SHIFT, 326, 55],
  ['jungle-cave-frog-3', 'cave-frog', 366 + EAST_SHIFT, 396, 55],
  ['jungle-worm-mid', 'worm', 368 + EAST_SHIFT, 218, 55],
  ['jungle-worm-deep', 'worm', 368 + EAST_SHIFT, 336, 55],
  ['jungle-frog-cultist-1', 'frog', 350 + EAST_SHIFT, 452, 60],
  ['jungle-frog-cultist-2', 'frog', 356 + EAST_SHIFT, 452, 60],
  ['jungle-frog-cultist-3', 'frog', 362 + EAST_SHIFT, 452, 60],
  ['jungle-frog-cultist-4', 'frog', 374 + EAST_SHIFT, 452, 60],
  ['jungle-frog-cultist-5', 'frog', 380 + EAST_SHIFT, 452, 60],
  ['jungle-frog-cultist-6', 'frog', 386 + EAST_SHIFT, 452, 60],
];
