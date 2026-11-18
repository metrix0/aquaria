// Coordinates use the original island columns. Each profile describes a roof and
// a solid floor, with stepped slopes between the hand-placed control points.
export const ISLAND_CAVE = { center: 56, camp: 55, campFloor: 33 };
export const ISLAND_DEEPSTONE_ROW = 330;
export const ISLAND_BOTTOM = 676;

// Each cross-section is [column, ceiling, floor]. Short passages connect rooms
// with different shapes. Keep rock between the routes, including at switchbacks.
const surveyAndFork = [
  [[49, 30, 33], [51, 28, 33], [55, 26, 33], [57, 27, 33], [60, 26, 33], [62, 28, 33], [63, 29, 33]],
  [[61, 29, 33], [66, 31, 37], [70, 36, 42], [76, 39, 45], [80, 45, 51]],
  [[71, 49, 54], [75, 45, 54], [80, 43, 54], [84, 46, 54], [88, 45, 54], [92, 49, 54]],
];

const westCaves = [
  [[-25, 114, 122], [-15, 105, 114], [-8, 97, 103], [2, 91, 102], [9, 90, 99], [15, 89, 96],
    [22, 80, 86], [28, 73, 79], [41, 71, 79], [47, 69, 75], [56, 62, 68], [66, 52, 58], [74, 48, 54]],
  [[-36, 118, 124], [-34, 113, 124], [-29, 110, 122], [-23, 111, 122], [-17, 113, 122], [-11, 116, 122]],
  [[-34, 117, 124], [-27, 122, 129], [-16, 130, 137], [-7, 135, 140], [6, 136, 141], [12, 143, 149],
    [23, 153, 159], [33, 152, 161], [41, 160, 166], [53, 172, 179], [59, 175, 183]],
  [[-35, 245, 252], [-28, 242, 252], [-20, 239, 246], [-15, 228, 235], [-6, 219, 225], [2, 217, 224],
    [10, 215, 220], [20, 203, 209], [30, 191, 197], [39, 186, 193], [45, 185, 191], [53, 176, 183]],
  [[-33, 247, 253], [-22, 246, 253], [-13, 251, 256], [-1, 260, 266], [8, 265, 271], [18, 267, 273],
    [28, 278, 284], [38, 289, 296], [48, 301, 307], [56, 303, 315]],
];

const eastCaves = [
  [[88, 48, 54], [95, 48, 54], [103, 55, 61], [111, 57, 64], [119, 61, 68], [127, 66, 72],
    [133, 71, 77], [140, 75, 83], [150, 81, 88], [156, 87, 94]],
  [[137, 99, 107], [141, 95, 107], [146, 95, 107], [151, 96, 107], [155, 92, 103], [156, 88, 98]],
  [[72, 176, 183], [82, 175, 183], [91, 167, 173], [102, 154, 160], [108, 147, 154], [120, 145, 152],
    [126, 137, 144], [135, 125, 132], [145, 114, 121], [151, 105, 114], [153, 101, 110]],
  [[78, 177, 183], [89, 176, 184], [97, 180, 186], [104, 184, 190], [114, 195, 201],
    [123, 198, 205], [131, 202, 209], [141, 214, 221], [151, 227, 234]],
  [[77, 302, 308], [87, 299, 307], [98, 289, 296], [109, 276, 282], [118, 271, 278],
    [128, 265, 271], [138, 252, 259], [146, 239, 245], [152, 230, 237]],
];

const joins = [
  [[48, 176, 183], [53, 171, 183], [59, 174, 183], [64, 178, 183], [69, 179, 183],
    [74, 176, 183], [80, 173, 183], [87, 178, 183]],
  [[48, 308, 315], [53, 303, 315], [60, 303, 315], [65, 307, 315]],
  [[64, 308, 315], [72, 312, 317], [78, 315, 320], [87, 318, 324], [96, 325, 331], [110, 333, 342]],
  [[80, 302, 308], [88, 303, 308], [96, 304, 310], [104, 309, 315], [115, 320, 326], [127, 333, 342]],
];

// Each Underground gallery has choke points between its gatehouse, trap rooms,
// and side rooms. The alternating stairs lie behind the far ends of the halls.
const underground = [
  [[-23, 337, 342], [-14, 333, 342], [1, 333, 342], [7, 338, 342], [18, 338, 342],
    [25, 334, 342], [39, 334, 342], [46, 338, 342], [60, 337, 342], [73, 331, 342],
    [91, 332, 342], [98, 338, 342], [106, 337, 342], [119, 331, 342], [136, 332, 342],
    [144, 336, 342], [152, 334, 342], [156, 336, 342]],
  [[-23, 337, 342], [-14, 344, 350], [-3, 356, 362], [9, 363, 369], [20, 373, 379],
    [31, 386, 392], [42, 395, 401]],
  [[106, 390, 401], [115, 384, 390], [128, 371, 377], [139, 356, 362], [149, 346, 352], [156, 337, 344]],
  [[-26, 395, 401], [-18, 391, 401], [-4, 393, 401], [2, 397, 401], [16, 397, 401],
    [24, 393, 401], [39, 391, 401], [49, 392, 401], [61, 397, 401], [71, 397, 401],
    [82, 393, 401], [100, 392, 401], [107, 396, 401], [119, 396, 401], [130, 390, 401], [145, 392, 401], [151, 397, 401]],
  [[-26, 396, 401], [-16, 404, 409], [-4, 416, 422], [9, 419, 424], [18, 427, 433],
    [31, 440, 447], [41, 450, 457], [54, 453, 459]],
  [[85, 453, 459], [96, 444, 450], [105, 439, 444], [118, 426, 432], [134, 410, 416], [151, 395, 401]],
  [[-25, 452, 459], [-8, 453, 459], [0, 455, 459], [12, 455, 459], [23, 450, 459],
    [36, 450, 459], [44, 455, 459], [55, 454, 459], [66, 450, 459], [78, 451, 459],
    [85, 455, 459], [95, 455, 459], [109, 448, 459], [123, 448, 459], [134, 455, 459], [151, 454, 459]],
  [[105, 502, 508], [119, 494, 500], [133, 480, 486], [142, 469, 475], [151, 453, 460]],
  [[-25, 452, 459], [-14, 466, 472], [-1, 474, 480], [10, 483, 489], [22, 496, 502], [33, 502, 508]],
  [[-28, 503, 508], [-14, 500, 508], [-2, 500, 508], [11, 504, 508], [23, 504, 508],
    [35, 499, 508], [49, 497, 508], [60, 503, 508], [72, 501, 508], [84, 504, 508],
    [96, 503, 508], [106, 499, 508], [121, 499, 508], [132, 504, 508], [144, 504, 508], [153, 501, 508]],
  [[96, 556, 562], [109, 546, 551], [117, 538, 544], [128, 533, 539], [140, 520, 526], [153, 501, 509]],
  [[-28, 502, 508], [-17, 513, 519], [-7, 526, 532], [4, 530, 536], [17, 542, 548], [31, 555, 561], [41, 556, 562]],
  [[-23, 555, 562], [-11, 556, 562], [1, 552, 562], [17, 552, 562], [28, 558, 562], [46, 558, 562],
    [58, 553, 562], [74, 553, 562], [85, 558, 562], [93, 557, 562], [106, 552, 562], [123, 550, 562],
    [135, 554, 562], [143, 557, 562], [150, 556, 562]],
  [[-23, 555, 562], [-12, 566, 572], [0, 571, 577], [13, 583, 589], [25, 594, 600], [37, 606, 612], [54, 605, 612]],
  [[93, 606, 612], [109, 606, 612], [120, 593, 599], [131, 582, 587], [142, 568, 574], [150, 556, 562]],
];

const dryProfiles = [...surveyAndFork, ...westCaves, ...eastCaves, ...joins, ...underground];

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
// Short, solid ledges break up the taller side chambers above the walking route.
for (const [left, right, row] of [[-36, -32, 118], [137, 140, 102], [48, 51, 311]]) {
  for (let x = left; x <= right; x++) dryBands.get(x)?.delete(row);
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
  ['skeleton', 58, 33], ['lamp', 55, 33], ['cart', 79, 54], ['lamp', 83, 54], ['shaft', 111, 64], ['lamp', -20, 122], ['lamp', 143, 107],
  ['shaft', 57, 183], ['lamp', 81, 183], ['worksite', -22, 253], ['shaft', 125, 206],
  ['lamp', 56, 315], ['lamp', 149, 107], ['worksite', 33, 161], ['lamp', 118, 152], ['arch', 47, 342], ['arch', 86, 342], ['pillar', 119, 342], ['lamp', 74, 342],
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
  ['east-archer', 'archer', 147, 107, 50],
  ['east-miner', 'miner', 80, 183, 52],
  ['west-shaft-miner', 'miner', -17, 255, 53],
  ['east-shaft-spider', 'spider', 146, 245, 46],
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
