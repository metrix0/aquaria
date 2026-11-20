export const JUNGLE_CAVE = Object.freeze({
  center: 364,
  entry: 364,
  entryFloor: 31,
  deepstoneRow: 195,
  sanctuaryCenter: 368,
  sanctuaryFloor: 282,
  idolColumn: 385,
  mossStartRow: 62,
  scriptureStartRow: 82,
});

export const JUNGLE_DEEPSTONE_ROW = JUNGLE_CAVE.deepstoneRow;

const entryRoom = [
  [355, 31, 6], [360, 31, 8], [364, 31, 8], [369, 31, 8], [374, 31, 6],
];

const upperTiers = [
  // Normal cave with native torches and bones
  [[357, 31, 6], [352, 40, 10], [347, 50, 11], [342, 60, 10]],
  [[341, 60, 9], [352, 60, 14], [364, 62, 16], [374, 61, 14], [382, 60, 9]],
];

const midTiers = [
  // Moss thickens and cryptic wall scriptures start to show
  [[376, 60, 9], [382, 74, 12], [388, 90, 12], [391, 104, 11]],
  [[345, 100, 10], [356, 102, 15], [368, 104, 16], [380, 105, 15], [392, 104, 10]],
  [[351, 101, 10], [345, 118, 13], [341, 138, 13], [346, 156, 14], [355, 158, 14]],
  [[342, 156, 12], [354, 158, 18], [368, 160, 19], [382, 160, 16], [392, 158, 11]],
];

const statueTier = [
  // Old columns and Lovecraftian tentacle statues appear before opening into the cult chamber
  [[385, 159, 12], [392, 176, 14], [396, 194, 15], [390, 212, 15], [378, 218, 16]],
  [[340, 214, 14], [352, 214, 22], [366, 216, 24], [380, 218, 23], [394, 218, 14]],
];

const cultSanctuaryTier = [
  // Direct descent from the first statue hall straight into the frog cult chamber
  [[346, 214, 13], [339, 232, 15], [334, 252, 16], [336, 270, 17], [344, 282, 18]],
  [[334, 282, 16], [346, 282, 24], [360, 282, 29], [374, 282, 30], [386, 282, 30], [396, 282, 24], [402, 282, 14]],
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
  ...midTiers,
  ...statueTier,
  ...cultSanctuaryTier,
]);

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

export const jungleCaveClimbs = [
  [384, 57, 103, 'rope'],
  [345, 96, 155, 'rope'],
  [392, 154, 211, 'ladder'],
  [338, 210, 281, 'ladder'],
];

// Progressive cave dressings:
// - Upper normal cave: native torches & bones
// - Mid tiers: deepening moss + cryptic wall scriptures (+ torches/bones)
// - Statue hall: first ancient columns & Lovecraftian tentacle statues appear
// - Immediately next (bottom chamber): columns, tentacle statues, scriptures, and the cult idol on pedestal
export const jungleCaveStructures = [
  // Tier 1 (entry & upper normal cave)
  ['native-torch', 359, 31], ['bones', 362, 31], ['native-torch', 370, 31],
  ['bones', 345, 60], ['native-torch', 354, 60], ['bones', 364, 62], ['native-torch', 370, 61], ['bones', 378, 60],
  // Tier 2 (moss begins, first cryptic wall scriptures appear beside torches & bones)
  ['native-torch', 387, 104], ['bones', 381, 105], ['scripture', 373, 104], ['native-torch', 362, 103], ['bones', 352, 101],
  // Tier 3 (denser moss and wall scriptures)
  ['native-torch', 351, 158], ['scripture', 358, 158], ['bones', 365, 160], ['scripture', 373, 160], ['native-torch', 384, 159],
  // Tier 4 (first columns & Lovecraftian tentacle statues appear)
  ['temple-column', 348, 214], ['scripture', 355, 214], ['tentacle-statue', 364, 216],
  ['native-torch', 371, 217], ['temple-column', 377, 218], ['tentacle-statue', 384, 218], ['native-torch', 391, 218],
  // Final Cult Sanctuary immediately below the statue hall (floor = 282)
  ['temple-column', 346, 282], ['native-torch', 350, 282], ['scripture', 355, 282],
  ['tentacle-statue', 363, 282], ['temple-column', 370, 282], ['scripture', 375, 282],
  ['native-torch', 380, 282], ['cult-idol', 385, 282], ['native-torch', 390, 282],
  ['temple-column', 395, 282],
];

export const jungleCaveCaches = [
  { id: 'jungle-cave-upper-cache', name: 'Native bone stash', column: 366, floor: 62, resource: 'arrow', amount: 14 },
  { id: 'jungle-cave-temple-cache', name: 'Sunken temple chest', column: 351, floor: 214, resource: 'cobalt', amount: 5 },
];

// [id, kind, column, floor, respawnDelay]
export const jungleCaveMobs = [
  ['jungle-worm-mid', 'worm', 370, 114, 55],
  ['jungle-worm-deep', 'worm', 368, 226, 55],
  ['jungle-frog-cultist-1', 'frog', 352, 282, 60],
  ['jungle-frog-cultist-2', 'frog', 358, 282, 60],
  ['jungle-frog-cultist-3', 'frog', 365, 282, 60],
  ['jungle-frog-cultist-4', 'frog', 372, 282, 60],
  ['jungle-frog-cultist-5', 'frog', 378, 282, 60],
  ['jungle-frog-cultist-6', 'frog', 392, 282, 60],
];
