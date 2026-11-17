export const TILE = 16;
export const COLS = 224;
export const ROWS = 100;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;
export const SPAWN = { x: 63 * TILE + 8, y: 12 * TILE - 23 };
export const SLOT_NAMES = ['Salvage tool', 'Sand', 'Stone', 'Driftwood'];
export const MATERIAL = Object.freeze({ air: 0, sand: 1, stone: 2, reef: 3, scrap: 4, wood: 5, bedrock: 6, soil: 7 });
export const SLOT_MATERIAL = [MATERIAL.air, MATERIAL.sand, MATERIAL.stone, MATERIAL.wood];

export function noise(x, y = 0, seed = 0) {
  let value = Math.imul(x + 171, 1597334677) ^ Math.imul(y + 313, 3812015801) ^ Math.imul(seed, 122949829);
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function islandSurface(x) {
  const distance = Math.abs(x - 56);
  if (distance < 7) return 11;
  if (distance < 10) return 12;
  if (distance < 12) return 13;
  return 14 + Math.floor((distance - 12) * 0.85);
}

function oceanFloor(x) {
  const depth = 30 + 16 * Math.min(1, Math.abs(x - 56) / 85) + 6 * Math.sin(x * 0.098) + 3 * Math.sin(x * 0.27);
  return Math.min(islandSurface(x), Math.round(depth + noise(x, 7) * 2));
}

export function createWorld() {
  const tiles = new Uint8Array(COLS * ROWS);
  const ground = Array.from({ length: COLS }, (_, x) => oceanFloor(x));

  for (let x = 0; x < COLS; x++) {
    for (let y = ground[x]; y < ROWS; y++) {
      let material = MATERIAL.stone;
      const depth = y - ground[x];
      if (y >= ROWS - 2) {
        material = MATERIAL.bedrock;
      } else if (y > 34 && depth > 3 && x > 75 && x < 198 && (
        Math.pow((x - 99) / 26, 2) + Math.pow((y - 56) / 10, 2) < 1 ||
        Math.pow((x - 153) / 26, 2) + Math.pow((y - 69) / 13, 2) < 1 ||
        (x > 124 && x < 139 && Math.abs(y - (57 + (x - 124) * 0.6)) < 3)
      )) {
        material = MATERIAL.air;
      } else if (depth < 2) {
        material = ground[x] < WATER_ROW || noise(x, 2) > 0.3 ? MATERIAL.sand : MATERIAL.reef;
      } else if (ground[x] < WATER_ROW && y < WATER_ROW + 1) {
        material = MATERIAL.soil;
      } else if (y > 24 && depth < 11 && noise(x, y, 5) > 0.965) {
        material = MATERIAL.scrap;
      }
      tiles[y * COLS + x] = material;
    }
  }

  const items = [
    { id: 'washed-crate', kind: 'scrap', amount: 1, x: 65 * TILE + 8, y: ground[65] * TILE - 4 },
    { id: 'reef-plank', kind: 'scrap', amount: 1, x: 74 * TILE + 8, y: ground[74] * TILE - 8 },
    { id: 'reef-lantern', kind: 'scrap', amount: 1, x: 82 * TILE + 8, y: ground[82] * TILE - 8 },
    { id: 'reef-keel', kind: 'scrap', amount: 2, x: 89 * TILE + 8, y: ground[89] * TILE - 9 },
    { id: 'left-crate', kind: 'scrap', amount: 1, x: 38 * TILE + 8, y: ground[38] * TILE - 7 },
    { id: 'wreck-cache', kind: 'cache', x: 111 * TILE + 8, y: ground[111] * TILE - 9 },
  ];
  for (const x of [34, 41, 76, 79, 84, 91, 96, 104, 114, 127, 132, 144]) {
    items.push({ id: 'kelp-' + x, kind: 'kelp', amount: 1, x: x * TILE + 8, y: ground[x] * TILE - 12 });
  }

  return { tiles, ground, items, edits: new Map(), harvested: new Set() };
}

export function tileAt(world, tx, ty) {
  if (tx < 0 || tx >= COLS || ty >= ROWS) return MATERIAL.bedrock;
  return ty < 0 ? MATERIAL.air : world.tiles[ty * COLS + tx];
}

export function editTile(world, tx, ty, material) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  const index = ty * COLS + tx;
  world.tiles[index] = material;
  world.edits.set(index, material);
}
