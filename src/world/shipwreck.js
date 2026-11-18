import { MATERIAL } from '../content.js';

const left = -98;
const top = 27;
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
  { id: 'western-wreck-captain', name: "Captain's chest", column: left + 9, floor: 53, resource: 'wood', amount: 24 },
  { id: 'western-wreck-deck', name: 'Foredeck chest', column: left + 35, floor: 49, resource: 'wood', amount: 20 },
  { id: 'western-wreck-hold', name: 'Cargo hold chest', column: left + 24, floor: 57, resource: 'wood', amount: 32 },
];

export const shipwreckVentColumn = -49;
// The back wall and trim share the same outer edges as the mineable hull.
export const shipwreckHullRows = timber.slice(16).map((row, index) => ({
  row: index + 16,
  stern: row.indexOf('#'),
  bow: row.lastIndexOf('#'),
}));

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
