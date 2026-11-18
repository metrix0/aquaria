// Coordinates use the original island columns. Each profile describes a roof and
// a solid floor, with stepped slopes between the hand-placed control points.
export const ISLAND_CAVE = { center: 56, camp: 55, campFloor: 33 };
export const ISLAND_DEEPSTONE_ROW = 330;
export const ISLAND_BOTTOM = 676;

// Sloping passages switch back into broad, tiered rooms on either side.
const dryProfiles = [
  [[49, 28, 33], [52, 23, 33], [56, 22, 33], [60, 23, 33], [64, 27, 35]],
  [[-30, 113, 122], [-14, 106, 122], [8, 83, 99], [28, 64, 78], [49, 31, 42], [53, 29, 38]],
  [[59, 29, 35], [80, 48, 56], [102, 67, 79], [130, 92, 107], [148, 95, 107]],
  [[-35, 112, 122], [-10, 107, 122], [9, 117, 132], [31, 139, 154], [59, 168, 182]],
  [[113, 121, 138], [128, 116, 129], [140, 112, 118], [144, 109, 115], [148, 101, 113]],
  [[74, 165, 182], [92, 147, 162], [117, 124, 137], [128, 117, 129]],
  [[55, 168, 182], [79, 168, 182]],
  [[-31, 246, 252], [-15, 229, 244], [8, 207, 221], [44, 171, 185], [65, 168, 182]],
  [[70, 169, 182], [91, 171, 185], [115, 192, 209], [139, 217, 234], [151, 222, 234]],
  [[-34, 235, 252], [-8, 238, 252], [9, 252, 266], [32, 275, 289], [58, 301, 315]],
  [[77, 293, 307], [102, 269, 282], [128, 241, 256], [151, 222, 234]],
  [[46, 300, 315], [65, 300, 315], [81, 291, 307], [96, 291, 306]],
  [[81, 297, 307], [88, 299, 307], [96, 300, 310], [107, 312, 323], [124, 329, 342]],

  // Underground is arranged around long horizontal galleries and masonry rooms.
  [[-23, 329, 342], [4, 326, 342], [35, 333, 342], [65, 326, 342], [101, 330, 342], [145, 326, 342], [157, 332, 342]],
  [[-23, 333, 342], [7, 360, 372], [37, 385, 401], [45, 388, 401]],
  [[106, 383, 398], [129, 359, 375], [155, 330, 349]],
  [[-26, 386, 401], [6, 390, 401], [40, 385, 401], [73, 392, 401], [100, 384, 401], [136, 390, 401], [151, 389, 401]],
  [[-25, 389, 401], [-3, 410, 424], [32, 442, 459], [60, 444, 459]],
  [[85, 448, 459], [111, 425, 436], [148, 389, 401]],
  [[-25, 445, 459], [1, 441, 459], [36, 446, 459], [72, 440, 459], [103, 449, 459], [138, 443, 459], [152, 448, 459]],
  [[105, 493, 508], [124, 473, 489], [148, 447, 465]],
  [[-24, 445, 459], [-2, 467, 481], [25, 492, 508], [46, 494, 508]],
  [[-28, 494, 508], [5, 492, 508], [40, 497, 508], [70, 490, 508], [104, 497, 508], [143, 492, 508], [155, 499, 508]],
  [[96, 548, 562], [122, 522, 536], [150, 494, 508]],
  [[-25, 496, 508], [2, 519, 534], [30, 547, 562], [51, 548, 562]],
  [[-23, 549, 562], [9, 545, 562], [45, 551, 562], [85, 547, 562], [122, 551, 562], [150, 546, 562]],
  [[-21, 550, 562], [5, 575, 587], [30, 597, 612], [54, 601, 612]],
  [[93, 597, 612], [110, 596, 612], [122, 574, 588], [148, 549, 562]],
];

const wetProfiles = [
  [[47, 612, 623], [51, 612, 625], [59, 624, 637], [72, 633, 650], [87, 639, 658]],
  [[84, 638, 657], [97, 627, 644], [108, 612, 628], [115, 612, 623]],
  [[19, 642, 655], [36, 632, 659], [58, 636, 661], [83, 644, 661], [101, 635, 661], [123, 630, 658], [145, 641, 651]],
];

function makeBands(profiles) {
  const columns = new Map();
  for (const profile of profiles) {
    for (let i = 1; i < profile.length; i++) {
      const [left, leftRoof, leftFloor] = profile[i - 1];
      const [right, rightRoof, rightFloor] = profile[i];
      for (let x = Math.ceil(left); x <= right; x++) {
        const t = (x - left) / (right - left);
        const roof = Math.round(leftRoof + (rightRoof - leftRoof) * t);
        const floor = Math.round(leftFloor + (rightFloor - leftFloor) * t);
        const rows = columns.get(x) ?? new Set();
        for (let y = roof; y < floor; y++) rows.add(y);
        columns.set(x, rows);
      }
    }
  }
  return columns;
}

const dryBands = makeBands(dryProfiles);
const wetBands = makeBands(wetProfiles);
const rockShell = new Map();
const wallThickness = 16;
for (const [x, rows] of dryBands) {
  const shallowRows = [...rows].filter((y) => y < 193);
  if (!shallowRows.length) continue;
  const roof = Math.min(...shallowRows) - wallThickness;
  const floor = Math.max(...shallowRows) + wallThickness;
  for (let tx = x - wallThickness; tx <= x + wallThickness; tx++) {
    const shell = rockShell.get(tx);
    rockShell.set(tx, [Math.min(shell?.[0] ?? roof, roof), Math.max(shell?.[1] ?? floor, floor)]);
  }
}

export function protectsIslandCave(x, y) {
  const shell = rockShell.get(x);
  return Boolean(shell && y >= shell[0] && y <= shell[1]);
}

export function isDryIslandCave(x, y) {
  return dryBands.get(x)?.has(y) ?? false;
}

export function isIslandWaterway(x, y) {
  return wetBands.get(x)?.has(y) && !isDryIslandCave(x, y);
}

export function carveIslandCave(set, { left, right, top, bottom }, westExtension) {
  for (let tx = left; tx <= right; tx++) {
    const x = tx - westExtension;
    for (const y of wetBands.get(x) ?? []) {
      if (y >= top && y <= bottom && isIslandWaterway(x, y)) set(tx, y, true);
    }
    for (const y of dryBands.get(x) ?? []) {
      if (y >= top && y <= bottom) set(tx, y, false);
    }
  }
}

export const islandCaches = [
  ['island-cave-cache', 'Survey cache', 54, 33, 'copper', 2],
  ['island-west-cache', 'West chamber cache', -22, 122, 'copper', 3],
  ['island-east-cache', 'East chamber cache', 140, 107, 'wood', 5],
  ['underground-cache', 'Gatehouse cache', 48, 401, 'iron', 3],
  ['underground-vault', 'Underground vault', 131, 562, 'iron', 4],
];

export const islandMushrooms = [[-19, 122], [86, 401]];

export const caveStructures = [
  ['skeleton', 58, 33], ['lamp', 55, 33], ['lamp', -20, 122], ['lamp', 143, 107],
  ['shaft', 57, 183], ['lamp', 81, 184], ['worksite', -18, 252], ['shaft', 145, 240],
  ['lamp', 56, 315], ['arch', 47, 342], ['arch', 86, 342], ['pillar', 119, 342], ['lamp', 74, 342],
  ['arch', 25, 401], ['pillar', 87, 401], ['worksite', 51, 401], ['arch', 64, 459],
  ['pillar', 29, 459], ['arch', 119, 459], ['lamp', 70, 459],
  ['pillar', 29, 508], ['arch', 75, 508], ['arch', 97, 562], ['pillar', 127, 562],
  ['lamp', 121, 562], ['lamp', 45, 612], ['lamp', 95, 612],
];

export const islandTraps = [
  ['jaws', 29, 341], ['swing', 106, 339], ['swing', 63, 398], ['jaws', 117, 400],
  ['jaws', 50, 458], ['swing', 87, 456], ['jaws', 47, 507], ['swing', 94, 505],
  ['swing', 112, 559], ['jaws', 72, 561],
];

export const islandMobs = [
  ['west-spider', 'spider', -12, 122, 42],
  ['west-archer', 'archer', -26, 122, 50],
  ['west-miner', 'miner', 59, 183, 52],
  ['east-spider', 'spider', 142, 107, 42],
  ['east-archer', 'archer', 146, 114, 50],
  ['east-miner', 'miner', 80, 183, 52],
  ['west-shaft-miner', 'miner', -15, 252, 53],
  ['east-shaft-spider', 'spider', 147, 238, 46],
  ['caves-exit-archer', 'archer', 55, 315, 52],
  ['gallery-scorpion', 'scorpion', 15, 342, 53],
  ['gallery-spider', 'spider', 55, 342, 84],
  ['gallery-hammer', 'hammer', 130, 342, 68],
  ['gatehouse-hammer', 'hammer', 98, 401, 68],
  ['gatehouse-archer', 'archer', 39, 401, 93],
  ['lower-scorpion', 'scorpion', 25, 459, 53],
  ['lower-miner', 'miner', 79, 459, 104],
  ['lower-hammer', 'hammer', 64, 508, 68],
  ['vault-hammer', 'hammer', 124, 562, 80],
  ['waterway-scorpion', 'scorpion', 43, 612, 58],
];
