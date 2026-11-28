import { ARROW, BOW, CAPTAINS_CUTLASS, KELP_DRESSING, MATERIAL } from '../content.js';

const left = -210;
const top = 32;
const depthShift = top - 27;
export const HELMET_WRECK_COLUMN = 107;
export const shipwreckOrigin = { column: left, row: top };

// Side view of the wreck. Gaps in the decks and hull let swimmers enter the holds.
const timber = [
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

export const shipwreckCaches = [
  { id: 'western-wreck-captain', name: "Captain's chest", column: left + 9, floor: 53 + depthShift, resource: 'wood', amount: 24,
    bonusLoot: [] },
  { id: 'western-wreck-deck', name: 'Foredeck chest', column: left + 35, floor: 49 + depthShift, resource: 'wood', amount: 20,
    bonusLoot: [{ id: BOW.id, count: 1 }, { id: ARROW.id, count: 8 }] },
  { id: 'western-wreck-hold', name: 'Cargo hold chest', column: left + 24, floor: 57 + depthShift, resource: 'wood', amount: 32,
    bonusLoot: [{ id: 'copper', count: 4 }, { id: KELP_DRESSING.id, count: 2 }] },
];

export const shipwreckSkeletons = [['skeleton', left + 12, 53 + depthShift], ['skeleton', left + 20, 57 + depthShift]];
export const shipwreckGhosts = [
  { id: 'captains-ghost', column: left + 12, row: 50 + depthShift, phase: 0, resident: true },
  { id: 'sailors-ghost', column: left + 20, row: 55 + depthShift, phase: Math.PI },
  { id: 'deckhands-ghost', column: left + 28, row: 50 + depthShift, phase: 1.5 },
  { id: 'lookouts-ghost', column: left + 35, row: 47 + depthShift, phase: 4.2 },
];

export const shipwreckVentColumn = left + 49;
export const WRECK_CUTLASS_CHANCE = 0.05;
// Stable independent roll for each chest; reopening or reloading cannot reroll it.
export function wreckChestRareLoot(id, seed = 0) {
  if (!shipwreckCaches.some(cache => cache.id === id)) return [];
  let hash = (Number.isInteger(seed) ? seed : 0) >>> 0;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296 < WRECK_CUTLASS_CHANCE
    ? [{ id: CAPTAINS_CUTLASS.id, count: 1 }] : [];
}
// The back wall and trim share the same outer edges as the mineable hull.
export const shipwreckHullRows = timber.slice(16).map((row, index) => ({
  row: index + 16,
  stern: row.indexOf('#'),
  bow: row.lastIndexOf('#'),
}));

export function isInsideShipwreck(column, row) {
  const edge = shipwreckHullRows[row - top - 16];
  const offset = column - left;
  return Boolean(edge && offset > edge.stern && offset < edge.bow);
}

export function shipwreckTimberAt(column, row) {
  return timber[row - top]?.[column - left] === '#';
}

export function placeShipwreck(set, bounds, westExtension) {
  const start = left + westExtension;
  for (let y = Math.max(bounds.top, top); y <= Math.min(bounds.bottom, top + timber.length - 1); y++) {
    const row = timber[y - top];
    for (let x = Math.max(bounds.left, start); x <= Math.min(bounds.right, start + row.length - 1); x++) {
      if (row[x - start] === '#') set(x, y, MATERIAL.wood);
    }
  }
}
