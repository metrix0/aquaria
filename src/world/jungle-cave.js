import { placeLedgeClimbs } from './climb-placement.js';
export const JUNGLE_CAVE = Object.freeze({
  center: 364,
  entry: 364,
  entryFloor: 31,
  deepstoneRow: 230,
  sanctuaryCenter: 368,
  sanctuaryFloor: 452,
  idolColumn: 368,
  mossStartRow: 74,
  scriptureStartRow: 96,
});

export const JUNGLE_DEEPSTONE_ROW = JUNGLE_CAVE.deepstoneRow;

const entryRoom = [
  [354, 31, 6], [360, 31, 8], [364, 31, 8], [369, 31, 8], [375, 31, 6],
];

// Tier 1: Forking native descent into a tall central bone vault with an upper ledge & alcove.
const upperTiers = [
  [[356, 31, 6], [349, 43, 10], [342, 57, 12], [334, 72, 11]],
  [[373, 31, 6], [380, 41, 10], [387, 53, 11], [394, 66, 10]],
  [[334, 72, 10], [346, 70, 14], [358, 68, 16], [370, 68, 15], [382, 66, 13], [395, 66, 10]],
];

// Tier 2 & 3: Twin western/eastern shafts linked by cross-galleries and a false-floor trap chamber.
const midBranches = [
  // Western mossy shaft & side alcove
  [[335, 72, 10], [338, 92, 14], [342, 114, 15], [348, 136, 15], [356, 140, 12]],
  [[328, 112, 8], [334, 112, 11], [340, 114, 10]],
  // Eastern canyon descent
  [[390, 66, 10], [394, 84, 13], [396, 106, 14], [390, 124, 14], [378, 134, 13]],
  // Mid cross-gallery bridged over the pit trap
  [[346, 138, 11], [356, 138, 13], [365, 138, 14], [376, 138, 13], [386, 134, 11]],
  // False-ground pit below columns 364..365 opening into a lower grotto
  [[354, 164, 12], [362, 164, 28], [368, 164, 28], [376, 164, 14], [384, 178, 14], [394, 198, 15]],
  // West & East Tier 3 descents converging on Crossroads Vault
  [[344, 138, 11], [335, 156, 14], [332, 178, 14], [340, 198, 15], [352, 206, 15]],
  [[390, 134, 11], [398, 154, 13], [402, 176, 14], [394, 198, 15], [380, 206, 15]],
  [[344, 206, 14], [358, 206, 20], [372, 208, 21], [386, 206, 18], [396, 204, 13]],
];

// Tier 4 & 5: Ancient statue colonnades, trap shaft, dual wings & pre-sanctum vestibule.
const templeBranches = [
  // Upper West & East Statue Galleries
  [[346, 206, 12], [338, 228, 15], [334, 250, 16], [342, 264, 17], [362, 264, 22]],
  [[388, 205, 12], [396, 226, 15], [400, 248, 16], [392, 260, 17], [372, 264, 21]],
  // Bridge across upper statue tier above the deep false-ground shaft
  [[356, 264, 19], [366, 264, 22], [378, 264, 19]],
  // Central trap shaft (columns 364..370) + Lower Statue Colonnade (floor = 326)
  [[362, 326, 22], [367, 326, 66], [372, 326, 22]],
  [[340, 264, 13], [334, 286, 15], [332, 308, 16], [344, 324, 18], [364, 326, 22]],
  [[394, 260, 13], [400, 284, 15], [402, 306, 16], [390, 322, 18], [370, 326, 22]],
  // Twin Pre-Sanctum approaches meeting at Altar Hall (floor = 396)
  [[342, 324, 14], [334, 348, 16], [332, 372, 16], [344, 392, 17], [360, 396, 16]],
  [[390, 322, 14], [398, 346, 16], [400, 370, 16], [388, 392, 17], [372, 396, 16]],
  [[346, 394, 14], [360, 396, 22], [374, 396, 22], [388, 394, 14]],
];

const cultSanctuaryTier = [
  // Symmetric twin drops into the Grand Frog Cult Sanctuary (floor = 452)
  [[348, 394, 14], [339, 412, 15], [334, 430, 16], [338, 446, 17], [346, 452, 18]],
  [[388, 394, 14], [396, 412, 15], [401, 430, 16], [397, 446, 17], [390, 452, 18]],
  [[334, 452, 16], [344, 452, 24], [356, 452, 29], [368, 452, 31], [380, 452, 29], [392, 452, 24], [402, 452, 16]],
];

// Solid rock shelves inside tall galleries for multi-level platforming.
const rockLedges = [
  [[354, 60, 1], [358, 60, 2], [364, 60, 1]],
  [[362, 196, 1], [368, 195, 2], [374, 196, 1]],
  [[350, 314, 1], [354, 314, 2], [358, 314, 1]],
];

// One-tile thin brittle slabs covering trap pits; deleted from dryBands so they generate solid.
const falseGroundBridges = [
  [364, 138], [365, 138],
  [366, 264], [367, 264],
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
  [341, 66, 135, 'rope'],
  [388, 62, 131, 'rope'],
  [336, 133, 197, 'ladder'],
  [396, 131, 197, 'ladder'],
  [338, 200, 263, 'rope'],
  [398, 200, 259, 'rope'],
  [336, 258, 323, 'ladder'],
  [398, 254, 321, 'rope'],
  [337, 318, 391, 'rope'],
  [396, 316, 391, 'ladder'],
  [338, 390, 451, 'rope'],
  [396, 390, 451, 'rope'],
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
  ['spike', 351, 137],
  ['spike', 379, 136],
  ['spike', 355, 205],
  ['spike', 381, 205],
  ['spike', 358, 263],
  ['spike', 376, 263],
  ['spike', 358, 324],
  ['spike', 378, 324],
  ['spike', 354, 394],
  ['spike', 382, 394],
  // False-ground bridges over deep shafts (tx, solid tile row ty)
  ...falseGroundBridges.map(([column, ty]) => ['false-ground', column, ty]),
];

export const jungleCaveStructures = [
  // Tier 1 (entry & upper normal cave)
  ['native-torch', 359, 31], ['bones', 362, 31], ['native-torch', 370, 31],
  ['bones', 339, 72], ['native-torch', 347, 70], ['bones', 365, 68], ['native-torch', 374, 68], ['bones', 388, 66],
  // Tier 2 (branching crypts: moss begins & rare cryptic wall scriptures)
  ['native-torch', 332, 112], ['bones', 336, 112], ['scripture', 354, 138], ['native-torch', 371, 138], ['bones', 383, 134],
  // Tier 3 (pit trap gallery & mossy crossroads)
  ['bones', 360, 164], ['native-torch', 370, 164],
  ['native-torch', 349, 206], ['scripture', 360, 206], ['bones', 369, 208], ['scripture', 376, 206], ['native-torch', 389, 206],
  // Tier 4 (dual statue halls & central abyss shaft)
  ['temple-column', 346, 264], ['tentacle-statue', 353, 264], ['native-torch', 362, 264],
  ['tentacle-statue', 381, 264], ['temple-column', 389, 261], ['native-torch', 392, 260],
  ['temple-column', 348, 324], ['scripture', 354, 325], ['tentacle-statue', 364, 326],
  ['native-torch', 371, 326], ['tentacle-statue', 382, 324], ['temple-column', 388, 322],
  // Tier 5 (pre-sanctum vestibule)
  ['temple-column', 350, 394], ['tentacle-statue', 359, 396], ['native-torch', 364, 396],
  ['native-torch', 372, 396], ['tentacle-statue', 377, 396], ['temple-column', 385, 394],
  // Grand Frog Cult Sanctuary (centered idol at 368, floor = 452)
  ['native-torch', 340, 452], ['temple-column', 342, 452], ['tentacle-statue', 348, 452],
  ['scripture', 353, 452], ['temple-column', 358, 452], ['native-torch', 364, 452],
  ['cult-idol', 368, 452],
  ['native-torch', 372, 452], ['temple-column', 378, 452], ['scripture', 383, 452],
  ['tentacle-statue', 388, 452], ['temple-column', 394, 452], ['native-torch', 396, 452],
];

export const jungleCaveCaches = [
  { id: 'jungle-cave-upper-cache', name: 'Native bone stash', column: 358, floor: 58, resource: 'arrow', amount: 14 },
  { id: 'jungle-cave-scripture-cache', name: 'Overgrown relic chest', column: 398, floor: 204, resource: 'iron', amount: 6 },
  { id: 'jungle-cave-temple-cache', name: 'Sunken temple chest', column: 368, floor: 396, resource: 'cobalt', amount: 5 },
];

// [id, kind, column, floor, respawnDelay]
export const jungleCaveMobs = [
  ['jungle-shaman-1', 'shaman', 347, 70, 52],
  ['jungle-shaman-2', 'shaman', 372, 138, 52],
  ['jungle-shaman-3', 'shaman', 352, 206, 52],
  ['jungle-cave-frog-1', 'cave-frog', 350, 264, 55],
  ['jungle-cave-frog-2', 'cave-frog', 372, 326, 55],
  ['jungle-cave-frog-3', 'cave-frog', 366, 396, 55],
  ['jungle-worm-mid', 'worm', 368, 218, 55],
  ['jungle-worm-deep', 'worm', 368, 336, 55],
  ['jungle-frog-cultist-1', 'frog', 350, 452, 60],
  ['jungle-frog-cultist-2', 'frog', 356, 452, 60],
  ['jungle-frog-cultist-3', 'frog', 362, 452, 60],
  ['jungle-frog-cultist-4', 'frog', 374, 452, 60],
  ['jungle-frog-cultist-5', 'frog', 380, 452, 60],
  ['jungle-frog-cultist-6', 'frog', 386, 452, 60],
];
