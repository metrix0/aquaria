// Coordinates use the original island columns. Each profile describes a roof and
// a solid floor, with stepped slopes between the hand-placed control points.
export const ISLAND_CAVE = { center: 56, camp: 55, campFloor: 33 };
export const ISLAND_DEEPSTONE_ROW = 84;

const dryProfiles = [
  // Buried survey camp and the two descending branches.
  [[49, 28, 33], [52, 23, 33], [56, 22, 33], [60, 23, 33], [64, 27, 35]],
  [[34, 56, 64], [39, 51, 60], [44, 46, 55], [50, 39, 49], [53, 30, 43]],
  [[59, 29, 35], [64, 32, 40], [68, 38, 45], [73, 43, 50], [78, 50, 56], [83, 54, 63]],
  // Terraced chambers with offshoots on their outer walls.
  [[28, 60, 68], [31, 55, 70], [37, 54, 73], [43, 57, 73], [48, 61, 76], [51, 66, 76]],
  [[27, 65, 68], [30, 64, 69], [35, 64, 73]],
  [[70, 62, 72], [74, 56, 72], [78, 53, 69], [83, 54, 67], [87, 56, 69], [91, 61, 72]],
  [[47, 66, 76], [50, 71, 79], [54, 77, 86], [58, 80, 89]],
  [[66, 73, 81], [70, 67, 77], [74, 63, 72], [78, 63, 69]],
  // Deepstone galleries. The upper and lower routes loop around solid shelves.
  [[34, 91, 96], [38, 87, 95], [45, 86, 94], [51, 85, 91], [57, 82, 89], [62, 80, 87], [67, 76, 84]],
  [[64, 79, 87], [70, 82, 89], [76, 85, 93], [81, 90, 98], [87, 95, 104]],
  [[30, 102, 109], [33, 96, 105], [37, 92, 101], [41, 93, 99]],
  [[35, 112, 120], [39, 109, 118], [44, 104, 113], [52, 102, 109], [57, 97, 104], [62, 89, 97], [66, 86, 92]],
  [[55, 105, 110], [60, 104, 111], [65, 103, 110], [70, 102, 111], [75, 99, 107], [80, 95, 100], [84, 95, 102]],
  [[70, 107, 113], [76, 111, 118], [80, 115, 124], [84, 119, 126], [87, 121, 126]],
  [[35, 117, 123], [39, 119, 125], [44, 122, 130], [49, 125, 132], [55, 125, 132], [61, 122, 128], [67, 118, 125], [73, 117, 123], [80, 118, 124]],
];

const wetProfiles = [
  [[43, 130, 138], [46, 130, 140], [49, 133, 144], [54, 137, 149], [59, 143, 152]],
  [[58, 143, 152], [63, 137, 149], [69, 132, 143], [74, 128, 138], [79, 124, 133], [84, 126, 132]],
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
for (const [x, rows] of dryBands) {
  for (let tx = x - 2; tx <= x + 2; tx++) {
    const shell = rockShell.get(tx) ?? new Set();
    for (const y of rows) {
      for (let ty = y - 2; ty <= y + 2; ty++) shell.add(ty);
    }
    rockShell.set(tx, shell);
  }
}

// Rock shelves break up the chamber walls and provide footholds back to the ramps.
for (const [left, right, row] of [
  [34, 36, 71], [37, 39, 69], [34, 36, 67], [37, 39, 65],
  [34, 36, 63], [37, 39, 61], [40, 42, 59],
  [85, 87, 65], [82, 84, 63], [85, 87, 61], [82, 84, 59], [79, 81, 57],
]) {
  for (let x = left; x <= right; x++) dryBands.get(x)?.delete(row);
}

export function protectsIslandCave(x, y) {
  return rockShell.get(x)?.has(y) || (x >= 40 && x <= 76 && y >= 20 && y < 60);
}

export function isIslandWaterway(x, y) {
  return wetBands.get(x)?.has(y) && !dryBands.get(x)?.has(y);
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
  ['island-west-cache', 'West chamber cache', 40, 73, 'copper', 3],
  ['island-east-cache', 'East chamber cache', 83, 67, 'wood', 5],
];

export const islandMushrooms = [[56, 33], [37, 73], [46, 75], [80, 68], [87, 69], [43, 94], [52, 109], [67, 125]];

// The mixed-in upper species have fewer spawn points and longer respawns deeper down.
export const islandMobs = [
  ['survey-archer', 'archer', 58, 33, 48],
  ['west-spider', 'spider', 35, 73, 42],
  ['west-archer', 'archer', 43, 73, 50],
  ['west-miner', 'miner', 49, 78, 52],
  ['east-spider', 'spider', 79, 69, 42],
  ['east-miner', 'miner', 86, 69, 52],
  ['east-archer', 'archer', 74, 72, 50],
  ['gallery-scorpion', 'scorpion', 38, 101, 53],
  ['gallery-spider', 'spider', 69, 89, 84],
  ['gallery-hammer', 'hammer', 83, 102, 68],
  ['lower-scorpion', 'scorpion', 52, 109, 53],
  ['lower-miner', 'miner', 58, 111, 104],
  ['lower-hammer', 'hammer', 76, 123, 68],
  ['waterway-scorpion', 'scorpion', 54, 132, 58],
];
