import { ARROW, BOW, KELP_DRESSING, MATERIAL } from '../content.js';
import { WRECK_RARE_DROP } from '../loot.js';

const left = -190;
// Stretch the blueprint, not the render alone: terrain, collision and fixtures
// all use the same mapping. The deepest keel now meets the natural seabed.
const top = 26;
export const WRECK_SCALE_X = 1.3;
export const WRECK_SCALE_Y = 1.25;
export const WRECK_WIDTH = Math.round(46 * WRECK_SCALE_X);
export const WRECK_HEIGHT = Math.round(36 * WRECK_SCALE_Y);
const xEdge = x => Math.round(x * WRECK_SCALE_X);
const yEdge = y => Math.round(y * WRECK_SCALE_Y);
export const wreckColumn = x => left + xEdge(x);
export const wreckRow = y => top + yEdge(y);
export const HELMET_WRECK_COLUMN = 107;
export const shipwreckOrigin = { column: left, row: top };
// A broken trail from the bow to just offshore of the island's western beach.
// Sizes taper toward shore; forms alternate between hull, mast, planks and cargo.
export const WRECK_DEBRIS_SITES = Object.freeze([
  [-121, 'hull', 1.4], [-110, 'mast', .9], [-100, 'planks', 1.1],
  [-90, 'hull', .95], [-80, 'cargo', .85], [-70, 'mast', .8],
  [-60, 'planks', .8], [-50, 'hull', .72], [-40, 'cargo', .7],
  [-30, 'mast', .6], [-20, 'planks', .65], [-10, 'hull', .5],
  [0, 'cargo', .48], [10, 'planks', .45], [19, 'planks', .32],
]);

export function shipwreckDebris({ groundAt, westExtension, tile }) {
  return WRECK_DEBRIS_SITES.map(([column, variant, scale], index) => {
    const tx = column + westExtension;
    const radius = Math.ceil(85 * scale);
    const extent = Math.ceil(radius / tile) + 2;
    const floorStart = tx - extent;
    const floorProfile = Array.from({ length: extent * 2 + 1 }, (_, i) => groundAt(floorStart + i) * tile);
    const y = groundAt(tx) * tile;
    const topY = Math.min(...floorProfile) - 105 * scale;
    return { id: 'wreck-debris-' + index, kind: 'ocean-landmark', style: 'wreck-debris',
      variant, seed: index, scale, radius, x: (tx + .5) * tile, y,
      height: y - topY, topY, bottomY: Math.max(...floorProfile), floorStart, floorProfile, tile };
  });
}

// Side view of the wreck. Gaps in the decks and hull let swimmers enter the holds.
const blueprint = [
  '..............#...............................',
  '..............#...............................',
  '..............#...............................',
  '..........#########...........................',
  '..............#...............................',
  '..............#...............................',
  '..............#...............................',
  '..............#................#..............',
  '..............#................#..............',
  '...............#...............#..............',
  '...............#............#######...........',
  '...............#...............#..............',
  '...............#...............#..............',
  '...............#...............#..............',
  '...............#...............#.............#',
  '...............#...............#............##',
  '#...............#..............#...........##.',
  '#...##..........#..............#..........##..',
  '######..........#..............#.........##...',
  '##...#..........#..............#........###...',
  '##...#..........#..............#.......###....',
  '##...########...#..............#....#####.....',
  '##...........#######.....###############......',
  '.##..............#.............#.....##.......',
  '.##..............#.............#....##........',
  '..##.............#.............#...##.........',
  '..#################............#####..........',
  '...##..........................####...........',
  '....##........................####............',
  '.....##......................###..............',
  '.......####....###############................',
  '........##................##..................',
  '.........##.............###...................',
  '..........#####........###....................',
  '............############......................',
  '..............#######.........................',
];

// Sterncastle: raised roof with a broken entrance and exposed beams.
for (const [row, cols] of [[12,[1,2,3,4,5,6,7,8,9]],[13,[1,9]],[14,[1,5,9]],[15,[1,5]],[16,[1,9]],[17,[1,9]]]) {
  const cells = blueprint[row].padEnd(46,'.').split('');
  for (const col of cols) cells[col] = '#';
  blueprint[row] = cells.join('');
}
const timber = Array.from({length: WRECK_HEIGHT}, () => Array(WRECK_WIDTH).fill('.'));
for (let y = 0; y < blueprint.length; y++) {
  for (let x = 0; x < blueprint[y].length; x++) {
    if (blueprint[y][x] !== '#') continue;
    for (let ty = yEdge(y); ty < yEdge(y + 1); ty++) {
      for (let tx = xEdge(x); tx < xEdge(x + 1); tx++) timber[ty][tx] = '#';
    }
  }
}
const mappedFloor = row => wreckRow(row - 27);
export const shipwreckCaches = [
  { id: 'western-wreck-captain', name: "Captain's chest", column: wreckColumn(9), floor: mappedFloor(53), resource: 'wood', amount: 24,
    bonusLoot: [] },
  { id: 'western-wreck-deck', name: 'Foredeck chest', column: wreckColumn(35), floor: mappedFloor(49), resource: 'wood', amount: 20,
    bonusLoot: [{ id: BOW.id, count: 1 }, { id: ARROW.id, count: 8 }] },
  { id: 'western-wreck-hold', name: 'Cargo hold chest', column: wreckColumn(24), floor: mappedFloor(57), resource: 'wood', amount: 32,
    bonusLoot: [{ id: 'copper', count: 4 }, { id: KELP_DRESSING.id, count: 2 }] },
];

export const shipwreckSkeletons = [['skeleton', wreckColumn(12), mappedFloor(53)], ['skeleton', wreckColumn(20), mappedFloor(57)]];
export const shipwreckGhosts = [
  { id: 'captains-ghost', column: wreckColumn(12), row: mappedFloor(50), phase: 0, resident: true },
  { id: 'sailors-ghost', column: wreckColumn(20), row: mappedFloor(55), phase: Math.PI },
  { id: 'deckhands-ghost', column: wreckColumn(28), row: mappedFloor(50), phase: 1.5 },
  { id: 'lookouts-ghost', column: wreckColumn(35), row: mappedFloor(47), phase: 4.2 },
];

export const shipwreckVentColumn = left + WRECK_WIDTH + 3;
export { WRECK_CUTLASS_CHANCE } from '../loot.js';
// Stable independent roll for each chest; reopening or reloading cannot reroll it.
export function wreckChestRareLoot(id, seed = 0) {
  if (!shipwreckCaches.some(cache => cache.id === id)) return [];
  let hash = (Number.isInteger(seed) ? seed : 0) >>> 0;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296 < WRECK_RARE_DROP.chance
    ? [{ id: WRECK_RARE_DROP.id, count: WRECK_RARE_DROP.min }] : [];
}
// The back wall and trim share the same outer edges as the mineable hull.
export const shipwreckBlueprintHullRows = blueprint.slice(16).map((row, index) => ({
  row: index + 16, stern: row.indexOf('#'), bow: row.lastIndexOf('#'),
}));
const hullStart = yEdge(16);
export const shipwreckHullRows = timber.slice(hullStart).map((row, index) => ({
  row: index + hullStart, stern: row.indexOf('#'), bow: row.lastIndexOf('#'),
}));

export function isInsideShipwreck(column, row) {
  const edge = shipwreckHullRows[row - top - hullStart];
  const offset = column - left;
  return Boolean(edge && offset > edge.stern && offset < edge.bow);
}

export function shipwreckTimberAt(column, row) {
  return timber[row - top]?.[column - left] === '#';
}

export function placeShipwreck(set, bounds, westExtension, groundAt) {
  const start = left + westExtension;
  for (let y = Math.max(bounds.top, top); y <= Math.min(bounds.bottom, top + timber.length - 1); y++) {
    const row = timber[y - top];
    for (let x = Math.max(bounds.left, start); x <= Math.min(bounds.right, start + row.length - 1); x++) {
      if (row[x - start] === '#' && (!groundAt || y < groundAt(x))) set(x, y, MATERIAL.wood);
    }
  }
}
