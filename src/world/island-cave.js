export const ISLAND_CAVE = { center: 56, camp: 55, campFloor: 33 };
export const ISLAND_DEEPSTONE_ROW = 330;
export const ISLAND_BOTTOM = 676;
export const ROOT_GROVE = Object.freeze({ column: -36, floor: 196, bank: 190, approach: 40, riverWest: -41, riverEast: -39,
  radius: 32, mossReach: 202, wallMossReach: 108 });

export function groveDistance(column, row) {
  return Math.hypot(column - ROOT_GROVE.column, (row - ROOT_GROVE.floor + 9) * 1.12);
}

export function inRootGrove(column, row) {
  return groveDistance(column, row) <= ROOT_GROVE.radius;
}

export function groveGroundGrowth(column, row) {
  const distance = groveDistance(column, row);
  const { radius, mossReach } = ROOT_GROVE;
  const remaining = Math.max(0, 1 - distance / mossReach);
  const beyondGrove = Math.max(0, (distance - radius) / (mossReach - radius));
  return remaining * Math.max(0, 1 - beyondGrove) ** 1.5;
}

export const mineDecks = {
  headframe: [{ rise: 23, halfWidth: 26 }, { rise: 47, halfWidth: 66 }, { rise: 83, halfWidth: 66 }, { rise: 116, halfWidth: 66 }],
  shaft: [{ rise: 49, halfWidth: 34 }],
  trestle: [{ rise: 6, halfWidth: 33 }],
};

// Cross-sections are [column, walking floor, headroom] in island coordinates.
// Each chamber has its own silhouette. Broad galleries feed the next level
// from several sides, with thick rock separating the stacked floors.
const surveyRoom = [[48, 33, 4], [51, 33, 6], [55, 33, 7], [56, 33, 6], [59, 33, 8], [62, 33, 6], [65, 33, 4]];

const westCaves = [
  [[48, 33, 4], [44, 39, 10], [38, 47, 13], [32, 55, 12], [27, 59, 10]],
  [[18, 63, 8], [23, 59, 12], [29, 59, 17], [36, 59, 20], [43, 60, 16], [49, 62, 10]],
  [[-7, 84, 9], [1, 83, 17], [10, 83, 19], [17, 81, 13], [23, 72, 11], [29, 59, 12]],
  [[-30, 112, 13], [-25, 106, 11], [-15, 97, 13], [-7, 93, 14], [1, 83, 10]],
  [[-37, 112, 7], [-34, 112, 16], [-29, 112, 21], [-22, 112, 24], [-14, 111, 17], [-7, 111, 10]],
  [[-28, 120, 10], [-22, 128, 11], [-17, 135, 11], [-11, 142, 12], [1, 143, 9]],
  [[-20, 142, 9], [-15, 142, 13], [-7, 142, 15], [1, 143, 15], [7, 148, 13],
    [14, 157, 12], [20, 161, 11], [29, 161, 17], [36, 163, 21], [46, 164, 13]],
  [[10, 192, 11], [20, 192, 16], [30, 190, 15], [40, 179, 10], [46, 169, 11], [48, 164, 11]],
  [[-23, 219, 13], [-16, 219, 19], [-7, 215, 16], [3, 204, 13], [10, 192, 11]],
  [[-33, 219, 9], [-26, 219, 15], [-19, 219, 15], [-13, 223, 10], [-8, 229, 12],
    [-1, 235, 15], [11, 240, 17], [21, 241, 12]],
  [[-9, 247, 10], [4, 245, 12], [14, 249, 13], [23, 258, 16], [31, 269, 13], [39, 274, 10]],
  [[8, 276, 9], [14, 274, 16], [24, 272, 18], [34, 272, 15], [44, 274, 10]],
  [[9, 276, 10], [13, 284, 12], [22, 295, 15], [31, 296, 12], [40, 306, 12], [49, 318, 11]],
  [[29, 321, 8], [33, 321, 12], [42, 318, 16], [49, 318, 15], [60, 320, 10]],
];

const eastCaves = [
  [[64, 33, 5], [70, 40, 10], [77, 47, 13], [84, 56, 14], [93, 56, 12]],
  [[77, 56, 11], [85, 56, 19], [94, 56, 14], [101, 59, 12], [104, 61, 15], [113, 71, 13], [119, 79, 11]],
  [[102, 82, 9], [108, 80, 14], [116, 79, 20], [125, 81, 16], [135, 90, 13], [143, 103, 12]],
  [[120, 105, 10], [126, 105, 20], [134, 105, 26], [143, 103, 20], [152, 105, 12], [156, 109, 8]],
  [[114, 135, 13], [126, 132, 20], [136, 132, 18], [144, 128, 12], [151, 117, 12], [156, 109, 10]],
  [[78, 159, 9], [86, 159, 15], [96, 159, 19], [105, 155, 16], [114, 145, 12], [121, 132, 13]],
  [[88, 170, 10], [94, 179, 11], [101, 185, 18], [109, 182, 23], [119, 183, 15], [130, 188, 10]],
  [[126, 185, 12], [132, 195, 13], [140, 201, 12], [149, 216, 15], [155, 216, 12]],
  [[119, 219, 9], [129, 219, 16], [138, 216, 21], [148, 216, 18], [156, 217, 9]],
  [[110, 244, 13], [119, 242, 19], [128, 241, 15], [138, 232, 10], [146, 219, 11]],
  [[82, 265, 9], [90, 264, 17], [99, 265, 19], [108, 257, 13], [116, 243, 14], [124, 242, 11]],
  [[88, 291, 12], [96, 289, 18], [106, 290, 17], [116, 296, 11], [127, 308, 13], [133, 315, 12]],
  [[106, 316, 9], [113, 316, 13], [122, 315, 18], [132, 315, 20], [142, 316, 11]],
];

const groveGallery = [
  [-56, 190, 10], [-50, 190, 19], [-43, 190, 24], [-36, 190, 24], [-27, 190, 20],
  [-17, 190, 13], [-4, 190, 11], [13, 190, 12], [30, 190, 15], [48, 190, 17],
];

export function groveFloor(column) {
  const { column: tree, floor, bank, riverEast } = ROOT_GROVE;
  if (column === riverEast + 1) return floor - 1;
  const depth = Math.min(floor - bank, Math.max(0, Math.ceil((16 - Math.abs(column - tree)) / 2)));
  return bank + depth;
}

export function isGrovePool(column, row) {
  const { floor, riverWest, riverEast } = ROOT_GROVE;
  return row === floor - 1 && column >= riverWest && column <= riverEast;
}

const centralCaves = [
  // Tall survey gallery with a second shelf below the timber deck.
  [[36, 59, 12], [44, 60, 16], [51, 64, 19], [61, 65, 22], [72, 62, 18], [83, 56, 16]],
  [[45, 62, 11], [52, 73, 13], [61, 82, 16], [71, 85, 20], [81, 88, 15],
    [92, 100, 12], [102, 111, 14]],
  [[31, 119, 12], [42, 119, 21], [54, 117, 23], [66, 117, 17], [79, 116, 19],
    [91, 114, 19], [102, 111, 14], [111, 105, 12], [123, 105, 16]],
  [[-19, 112, 10], [-7, 113, 12], [6, 118, 13], [19, 119, 12], [31, 119, 13]],
  // The central mine links three different elevations and has a real descent around the supports.
  [[33, 119, 12], [39, 130, 14], [48, 144, 16], [60, 152, 20], [71, 152, 23], [83, 157, 19], [93, 159, 13]],
  [[31, 161, 13], [42, 163, 20], [51, 162, 21], [61, 161, 17], [72, 157, 15], [84, 158, 13]],
  [[82, 162, 13], [79, 174, 15], [70, 183, 18], [60, 187, 20], [50, 190, 19], [40, 190, 16], [31, 190, 13]],
  [[25, 191, 12], [38, 191, 17], [48, 190, 21], [59, 188, 22], [72, 189, 16], [84, 187, 17],
    [99, 185, 14], [108, 182, 12]],
  [[52, 190, 15], [61, 204, 16], [73, 219, 21], [86, 228, 24], [99, 233, 19], [112, 241, 16], [124, 242, 13]],
  [[6, 240, 12], [19, 241, 17], [31, 242, 23], [44, 240, 19], [55, 241, 16], [69, 237, 16], [84, 229, 16]],
  [[97, 233, 13], [88, 246, 15], [76, 254, 18], [64, 262, 20], [51, 267, 19], [37, 272, 14]],
  [[28, 273, 15], [41, 274, 19], [53, 273, 24], [66, 272, 22], [78, 271, 15], [91, 264, 13]],
  [[76, 271, 13], [82, 283, 16], [90, 291, 13], [101, 290, 13]],
  [[94, 290, 15], [83, 300, 17], [72, 307, 20], [60, 317, 20], [49, 318, 15]],
  [[43, 318, 12], [57, 319, 16], [70, 318, 17], [82, 317, 12], [94, 316, 13], [109, 316, 14], [122, 315, 13]],
];

// Join the existing Underground entrance rooms at their upper edges.
const dungeonApproaches = [
  [[29, 321, 8], [24, 328, 9], [21, 334, 5], [17, 341, 5], [20, 345, 4]],
  [[94, 333, 10], [98, 334, 12], [105, 339, 13], [111, 346, 10], [117, 346, 9]],
  [[97, 340, 10], [104, 335, 12], [109, 326, 11], [113, 316, 9]],
];

// The dungeon wings cross in two offset galleries. Short dead ends and
// interlocking levels break up the horizontal routes.
const westUnderground = [
  [[10, 345, 4], [17, 345, 6], [25, 345, 8], [40, 345, 8], [47, 345, 4]],
  [[10, 345, 4], [5, 352, 5], [-2, 354, 4], [-10, 364, 5], [-15, 372, 5]],
  [[-31, 374, 4], [-26, 373, 10], [-20, 373, 13], [-12, 372, 8], [3, 372, 8], [9, 372, 4]],
  [[9, 372, 4], [14, 378, 5], [21, 381, 4], [28, 388, 5], [30, 393, 5], [37, 399, 4]],
  [[17, 399, 4], [22, 399, 7], [30, 399, 8], [49, 399, 8], [57, 399, 4]],
  [[17, 399, 4], [11, 406, 5], [6, 415, 5], [-1, 421, 5], [-9, 423, 4], [-16, 431, 5]],
  [[-31, 433, 4], [-25, 433, 8], [-15, 431, 10], [-8, 431, 6], [1, 433, 9], [13, 433, 9], [19, 433, 4]],
  [[19, 433, 4], [25, 440, 5], [30, 442, 4], [37, 451, 5], [42, 459, 5]],
  [[23, 462, 4], [31, 459, 9], [43, 459, 10], [56, 459, 10], [62, 459, 4]],
  [[23, 462, 4], [17, 467, 5], [13, 473, 5], [5, 478, 4], [-1, 485, 5], [-6, 493, 5]],
  [[-29, 494, 4], [-23, 493, 8], [-16, 493, 8], [-7, 493, 11], [10, 493, 7], [16, 493, 4]],
  [[16, 493, 4], [20, 500, 5], [26, 502, 4], [30, 509, 5], [34, 512, 4], [39, 520, 5]],
  [[14, 520, 4], [20, 520, 9], [34, 520, 11], [49, 520, 11], [56, 520, 4]],
  [[14, 520, 4], [8, 526, 5], [4, 531, 5], [-4, 535, 4], [-10, 542, 5], [-14, 550, 5]],
  [[-27, 550, 4], [-20, 550, 9], [-10, 550, 9], [-3, 547, 6], [5, 550, 10], [17, 550, 9], [24, 550, 4]],
  [[24, 550, 4], [28, 557, 5], [34, 561, 4], [37, 567, 5], [42, 574, 5]],
  [[28, 576, 4], [34, 574, 7], [43, 574, 11], [54, 574, 11], [61, 574, 4]],
  [[28, 576, 4], [33, 583, 5], [38, 586, 4], [44, 594, 5], [45, 598, 6], [51, 602, 5]],
  [[43, 606, 4], [46, 604, 8], [51, 602, 10], [57, 605, 8], [59, 612, 10], [62, 612, 7]],
];
const eastUnderground = [
  [[98, 346, 4], [105, 346, 9], [114, 346, 9], [126, 346, 11], [137, 346, 4]],
  [[137, 346, 4], [143, 352, 5], [146, 357, 5], [151, 361, 4], [154, 368, 5]],
  [[118, 368, 4], [124, 368, 8], [136, 368, 10], [149, 368, 10], [156, 368, 5]],
  [[118, 368, 4], [113, 375, 5], [106, 378, 4], [101, 384, 5], [98, 390, 5], [92, 396, 5]],
  [[76, 396, 4], [81, 396, 9], [90, 396, 11], [100, 396, 11], [111, 396, 4]],
  [[111, 396, 4], [117, 403, 5], [122, 405, 4], [129, 414, 5], [133, 422, 5]],
  [[119, 424, 4], [124, 422, 9], [134, 422, 12], [149, 422, 9], [157, 422, 4]],
  [[119, 424, 4], [114, 431, 5], [107, 434, 4], [102, 443, 5], [96, 451, 5]],
  [[76, 451, 4], [82, 451, 8], [91, 451, 9], [104, 451, 9], [111, 452, 4]],
  [[111, 452, 4], [118, 459, 5], [123, 461, 4], [127, 468, 5], [131, 474, 5]],
  [[116, 476, 4], [122, 474, 9], [133, 474, 12], [148, 474, 11], [154, 474, 4]],
  [[116, 476, 4], [109, 483, 5], [105, 485, 4], [99, 493, 5], [96, 499, 5], [89, 505, 5]],
  [[74, 505, 4], [82, 505, 10], [95, 505, 11], [107, 505, 7], [113, 505, 4]],
  [[113, 505, 4], [119, 512, 5], [126, 516, 4], [131, 524, 5], [135, 529, 5]],
  [[114, 529, 4], [121, 529, 9], [131, 529, 11], [146, 529, 9], [154, 529, 4]],
  [[114, 529, 4], [108, 535, 5], [102, 539, 4], [98, 547, 5], [94, 555, 5], [88, 560, 5]],
  [[76, 562, 4], [83, 560, 10], [97, 560, 13], [111, 560, 10], [123, 560, 9], [134, 562, 4]],
  [[134, 562, 4], [137, 567, 5], [132, 575, 5], [127, 578, 4], [122, 586, 5], [117, 594, 5]],
  [[98, 612, 7], [101, 612, 8], [104, 605, 8], [109, 601, 9], [117, 594, 8], [122, 594, 4]],
];
const crossGalleries = [
  [[47, 345, 4], [53, 347, 4], [59, 352, 5], [65, 357, 5], [80, 357, 8],
    [86, 355, 5], [91, 350, 5], [98, 346, 5]],
  [[62, 459, 4], [67, 455, 5], [72, 451, 5], [76, 451, 4]],
  [[-31, 374, 4], [-34, 369, 5], [-30, 364, 6], [-23, 363, 5], [-16, 362, 4]],
  [[-25, 433, 4], [-22, 440, 5], [-16, 444, 6], [-10, 450, 8], [3, 450, 11],
    [13, 452, 9], [19, 457, 5], [24, 462, 5]],
  [[127, 422, 4], [132, 429, 5], [139, 432, 4], [142, 440, 5], [134, 441, 10],
    [123, 442, 8], [116, 447, 5], [111, 452, 4]],
  [[148, 474, 5], [152, 466, 5], [157, 466, 7], [163, 466, 4]],
  [[49, 520, 4], [55, 514, 5], [60, 513, 8], [68, 513, 7], [74, 505, 6]],
];

// Solid ledges give tall rooms a second playable level. The narrow ends
// leave space to jump around them or drop back to the lower floor.
const rockLedges = [
  [[-33, 108, 1], [-30, 107, 2], [-25, 106, 2], [-20, 105, 1]],
  [[124, 99, 1], [129, 98, 2], [135, 97, 2], [140, 98, 1]],
  [[49, 62, 1], [54, 61, 2], [64, 61, 2], [68, 62, 1]],
  [[45, 112, 1], [51, 110, 2], [58, 109, 2], [62, 110, 1]],
  [[49, 157, 1], [56, 156, 2], [63, 155, 2], [70, 156, 1]],
  [[57, 185, 1], [64, 183, 2], [70, 183, 2], [74, 184, 1]],
  [[30, 236, 1], [36, 234, 2], [46, 233, 2], [51, 234, 1]],
  [[49, 270, 1], [54, 268, 2], [63, 267, 2], [68, 269, 1]],
  [[57, 315, 1], [63, 313, 2], [69, 313, 2], [73, 314, 1]],
  [[26, 342, 1], [30, 341, 2], [36, 341, 2], [39, 342, 1]],
  [[125, 343, 1], [130, 342, 2], [134, 343, 2]],
  [[-24, 370, 2], [-20, 369, 2], [-16, 370, 1]],
  [[6, 429, 1], [9, 429, 2], [13, 430, 1]],
  [[136, 418, 1], [139, 418, 2], [146, 418, 2]],
  [[-11, 490, 1], [-7, 489, 2], [-3, 489, 2], [2, 489, 1]],
  [[32, 517, 1], [36, 516, 2], [43, 516, 2], [47, 516, 1]],
  [[89, 556, 1], [94, 555, 2], [101, 555, 2], [106, 556, 1]],
];

const wetProfiles = [
  [[57, 622, 10], [62, 631, 19], [71, 643, 17], [85, 653, 17]],
  [[82, 653, 17], [91, 647, 17], [100, 630, 18], [103, 622, 10]],
  [[19, 655, 13], [36, 659, 27], [58, 661, 25], [83, 661, 17], [101, 661, 26], [123, 658, 28], [145, 651, 10]],
];

function makeBands(profiles) {
  const columns = new Map();
  for (const profile of profiles) {
    for (let i = 1; i < profile.length; i++) {
      const [from, fromFloor, fromHeight] = profile[i - 1];
      const [to, toFloor, toHeight] = profile[i];
      for (let x = Math.min(from, to); x <= Math.max(from, to); x++) {
        const t = (x - from) / (to - from);
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

const dryBands = makeBands([surveyRoom, ...westCaves, ...eastCaves, ...centralCaves, ...dungeonApproaches,
  ...westUnderground, ...eastUnderground, ...crossGalleries, groveGallery]);
for (const [x, ledges] of makeBands(rockLedges)) {
  for (const row of ledges) dryBands.get(x)?.delete(row);
}

// Open the stepped banks and keep a stone bed under the river.
for (let column = groveGallery[0][0]; column <= groveGallery.at(-1)[0]; column++) {
  const rows = dryBands.get(column);
  const floor = groveFloor(column);
  for (let row = ROOT_GROVE.bank; row < floor; row++) {
    if (isGrovePool(column, row)) rows.delete(row);
    else rows.add(row);
  }
  for (let row = floor; row < floor + 3; row++) rows.delete(row);
}

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
    const river = ROOT_GROVE.floor - 1;
    if (river >= top && river <= bottom && isGrovePool(x, river)) set(tx, river, true);
    for (const y of dryBands.get(x) ?? []) {
      if (y >= top && y <= bottom) set(tx, y, false);
    }
  }
}

export const islandCaches = [
  ['island-cave-cache', 'Survey cache', 54, 33, 'copper', 2],
  ['island-west-cache', 'West chamber cache', -31, 112, 'copper', 3],
  ['island-east-cache', 'East chamber cache', 140, 104, 'wood', 5],
  ['island-lift-lockbox', 'Lift keeper’s lockbox', 37, 59, 'copper', 4, [{ id: 'kelp-dressing', count: 2 }, { id: 'arrow', count: 12 }]],
  ['island-east-provisions', 'Expedition supplies', 126, 132, 'wood', 12, [{ id: 'copper', count: 3 }]],
  ['island-west-provisions', 'Prospector’s chest', -15, 142, 'iron', 3, [{ id: 'kelp-dressing', count: 2 }]],
  ['island-grove-relics', 'Explorer’s satchel', ROOT_GROVE.riverWest - 1, groveFloor(ROOT_GROVE.riverWest - 1), 'root-ring', 1, [{ id: 'explorers-map', count: 1 }]],
  ['island-deep-provisions', 'Lower mine provisions', 57, 273, 'iron', 4, [{ id: 'arrow', count: 18 }, { id: 'kelp-dressing', count: 3 }]],
  ['central-mine-cache', 'Mine supply chest', 76, 318, 'wood', 4],
  ['underground-cache', 'Gatehouse cache', 48, 399, 'grappling-hook', 1, [{ id: 'iron', count: 3 }]],
  ['underground-vault', 'Underground vault', 122, 560, 'iron', 4],
];

export const islandMushrooms = [[-15, 142], [95, 451]];

export const caveStructures = [
  ['headframe', 36, 59], ['headframe', 94, 56], ['headframe', 123, 105],
  ['headframe', 29, 273],
  ['skeleton', 58, 33], ['lamp', 55, 33],
  ['worksite', 29, 59], ['lamp', 33, 59], ['worksite', 5, 83], ['lamp', 8, 83],
  ['trestle', -27, 104], ['headframe', -34, 112], ['lamp', -25, 112], ['cart', -30, 112], ['lamp', -17, 142],
  ['lamp', 27, 161], ['lamp', 22, 192], ['cart', -20, 219], ['lamp', -10, 227], ['lamp', -9, 247],
  ['worksite', 33, 273], ['lamp', 29, 273], ['lamp', 19, 291], ['lamp', 45, 318],
  ['lamp', 84, 56], ['shaft', 111, 80], ['lamp', 114, 79],
  ['trestle', 138, 96], ['headframe', 143, 103], ['worksite', 133, 105], ['lamp', 141, 103], ['lamp', 126, 132],
  ['cart', 90, 159], ['lamp', 94, 159], ['headframe', 109, 182], ['lamp', 114, 183],
  ['worksite', 148, 216], ['lamp', 144, 222], ['lamp', 119, 243],
  ['cart', 95, 265], ['lamp', 99, 265], ['lamp', 91, 293], ['lamp', 125, 315],
  ['cart', 58, 79], ['lamp', 64, 64], ['lamp', 77, 59],
  ['headframe', 63, 117], ['lamp', 49, 118], ['worksite', 63, 117], ['lamp', 70, 117],

  ['headframe', 29, 242], ['lamp', 24, 241], ['cart', 39, 241], ['lamp', 47, 240],
  ['lamp', 57, 273], ['headframe', 70, 272], ['worksite', 80, 279], ['lamp', 83, 249],
  ['lamp', 59, 320], ['cart', 81, 317], ['lamp', 91, 316], ['headframe', 113, 316],
  ['arch', 20, 345], ['gate', 42, 345], ['lamp', 37, 345], ['arch', 69, 357],
  ['arch', 112, 346], ['lamp', 117, 346], ['gate', 124, 346],
  ['pillar', -11, 372], ['lamp', -6, 372], ['lamp', 134, 368],
  ['arch', 35, 399], ['lamp', 45, 399], ['gate', 93, 396], ['lamp', 103, 396],
  ['arch', -13, 431], ['lamp', 2, 433], ['lamp', 0, 450], ['arch', 132, 422], ['lamp', 148, 422], ['lamp', 131, 441],
  ['pillar', 46, 459], ['lamp', 54, 459], ['arch', 84, 451], ['lamp', 90, 451],
  ['gate', 137, 474], ['lamp', 145, 474], ['pillar', -22, 493], ['lamp', 6, 493],
  ['lamp', 86, 505], ['arch', 25, 520], ['lamp', 48, 520], ['arch', 143, 529], ['lamp', 149, 529],
  ['lamp', -16, 550], ['gate', 116, 560], ['pillar', 123, 560], ['lamp', 118, 560],
  ['arch', 46, 574], ['lamp', 54, 574], ['lamp', 50, 602], ['lamp', 110, 600],
];

export const islandTraps = [
  ['jaws', 29, 344], ['swing', 121, 343], ['swing', 40, 396], ['jaws', 105, 395],
  ['jaws', 11, 432], ['swing', 151, 419], ['swing', 48, 456], ['jaws', 85, 450],
  ['jaws', 8, 492], ['swing', 146, 471], ['swing', 22, 517], ['jaws', 104, 504],
  ['swing', 110, 557], ['jaws', 47, 573],
];

export const islandMobs = [
  ['upper-west-scout', 'spider', 33, 59, 49],
  ['upper-east-scout', 'spider', 85, 56, 48],
  ['east-landing-miner', 'miner', 91, 56, 16],
  ['west-landing-miner', 'miner', 30, 59, 16],
  ['survey-gallery-miner', 'miner', 64, 64, 16],
  ['east-haul-spider', 'spider', 108, 80, 16],
  ['upper-mine-scout', 'archer', 8, 83, 42],
  ['deep-miner-overlook', 'spider', 83, 249, 23],
  ['deep-supply-guard', 'miner', 68, 318, 22],
  ['deep-west-hunter', 'miner', 39, 241, 26],
  ['deep-east-hunter', 'spider', 99, 265, 25],
  ['deep-crossing-hunter', 'archer', 76, 318, 21],
  ['west-spider', 'spider', -24, 112, 42],
  ['west-archer', 'archer', -30, 112, 50],
  ['west-miner', 'miner', 28, 161, 52],
  ['east-spider', 'spider', 136, 105, 42],
  ['east-archer', 'archer', 143, 103, 50],
  ['east-miner', 'miner', 110, 182, 52],
  ['west-shaft-miner', 'miner', -22, 219, 53],
  ['east-shaft-spider', 'spider', 149, 216, 46],
  ['caves-exit-archer', 'archer', 48, 318, 52],
  ['central-mine-spider', 'spider', 79, 116, 50],
  ['central-mine-archer', 'archer', 86, 228, 55],
  ['gallery-scorpion', 'scorpion', 34, 345, 53],
  ['gallery-spider', 'spider', 77, 357, 84],
  ['gallery-hammer', 'hammer', 128, 346, 68],
  ['gatehouse-hammer', 'hammer', 98, 396, 68],
  ['gatehouse-archer', 'archer', 38, 399, 93],
  ['lower-scorpion', 'scorpion', 49, 459, 53],
  ['lower-miner', 'miner', 144, 474, 104],
  ['lower-hammer', 'hammer', 51, 520, 68],
  ['vault-hammer', 'hammer', 114, 560, 80],
  ['waterway-scorpion', 'scorpion', 51, 574, 58],
  ['mimic-east-gallery', 'mimic', 115, 346, 60],
  ['mimic-gatehouse', 'mimic', 89, 396, 60],
  ['mimic-mid-hall', 'mimic', 98, 451, 60],
  ['mimic-lower-hall', 'mimic', 36, 520, 60],
];

const masonryRooms = [
  [17, 43, 337, 345], [65, 84, 350, 357], [105, 131, 337, 346],
  [-13, 4, 364, 372], [23, 53, 391, 399], [81, 106, 387, 396],
  [-17, -4, 422, 431], [124, 150, 412, 422], [32, 57, 450, 459],
  [80, 101, 443, 451], [129, 149, 464, 474], [19, 48, 510, 520],
  [112, 130, 550, 562], [37, 55, 565, 574],
];

export function isDungeonMasonry(x, y) {
  return masonryRooms.some(([left, right, top, bottom]) => x >= left && x <= right && y >= top && y < bottom);
}

// Column and the first/last open rows of each climb.
export const caveClimbs = [
  [-19, 88, 111, 'rope'], [40, 100, 131, 'rope'], [96, 92, 112, 'rope'],
  [50, 129, 155, 'ladder'], [84, 203, 228, 'rope'], [82, 254, 300, 'rope'],
  [27, 249, 271, 'ladder'],
];


export function isCaveRefuge(column, row) {
  return isGrovePool(column, row) || ((inRootGrove(column, row) ||
    (column >= 48 && column <= 65 && row <= ISLAND_CAVE.campFloor)) && isDryIslandCave(column, row));
}
