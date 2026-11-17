export const TILE = 16;
export const COLS = 224;
export const ROWS = 100;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;
export const SPAWN = { x: 63 * TILE + 8, y: 12 * TILE - 23 };
export const SLOT_NAMES = ['Salvage tool', 'Sand', 'Stone', 'Wood'];
// Tile ID 4 was used for scrap. Keep it reserved for older saves.
export const MATERIAL = Object.freeze({ air: 0, sand: 1, stone: 2, reef: 3, wood: 5, bedrock: 6, soil: 7 });
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
      }
      tiles[y * COLS + x] = material;
    }
  }

  const items = [
    { id: 'wreck-cache', kind: 'cache', x: 111 * TILE + 8, y: ground[111] * TILE - 9 },
  ];
  for (const x of [34, 41, 76, 79, 84, 91, 96, 104, 114, 127, 132, 144]) {
    items.push({ id: 'kelp-' + x, kind: 'kelp', amount: 1, x: x * TILE + 8, y: ground[x] * TILE - 12 });
  }

  const trees = [[49, 61, -1], [52, 46, 1], [58, 69, 1], [62, 48, -1]].map(([tx, height, direction]) => {
    const ty = ground[tx];
    const x = tx * TILE + 7;
    const y = ty * TILE;
    const trunk = [];
    for (let rise = 0; rise < height; rise += 2) {
      const lean = Math.floor(Math.pow(rise / height, 1.7) * 14) * direction;
      trunk.push({ x: x + lean - 3, y: y - rise - 2, width: rise > height * .68 ? 4 : 6 });
    }
    return { id: 'palm-' + tx, tx, ty, x, y, height, direction, trunk };
  });

  return { tiles, ground, items, trees, edits: new Map(), harvested: new Set() };
}

export function tileAt(world, tx, ty) {
  if (tx < 0 || tx >= COLS || ty >= ROWS) return MATERIAL.bedrock;
  return ty < 0 ? MATERIAL.air : world.tiles[ty * COLS + tx];
}

export function isTreeStanding(world, tree) {
  const { tx, ty, id } = tree;
  return !world.harvested.has(id) && tileAt(world, tx, ty) && !tileAt(world, tx, ty - 1);
}

export function treeAt(world, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  return world.trees.find((tree) => isTreeStanding(world, tree) && tree.trunk.some((strip) =>
    strip.x < x + TILE && strip.x + strip.width > x && strip.y < y + TILE && strip.y + 2 > y
  ));
}

export function editTile(world, tx, ty, material) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  const index = ty * COLS + tx;
  world.tiles[index] = material;
  world.edits.set(index, material);
}
