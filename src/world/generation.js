import { MATERIAL, WRECK_CACHE } from '../content.js';

export const TILE = 16;
export const WORLD_VERSION = 2;
export const WEST_EXTENSION = 44;
export const COLS = 224 + WEST_EXTENSION;
export const ROWS = 176;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;
export const SPAWN = { x: (63 + WEST_EXTENSION) * TILE + 8, y: 12 * TILE - 23 };

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
  if (x < 0) {
    const shelf = 46 + 19 * Math.sin(-x / WEST_EXTENSION * Math.PI * 0.83);
    return Math.round(shelf + 2 * Math.sin(x * 0.35) + noise(x, 7) * 2);
  }
  const depth = 30 + 16 * Math.min(1, Math.abs(x - 56) / 85) + 6 * Math.sin(x * 0.098) + 3 * Math.sin(x * 0.27);
  return Math.min(islandSurface(x), Math.round(depth + noise(x, 7) * 2));
}

export function groundAt(tx) {
  return oceanFloor(tx - WEST_EXTENSION);
}

export function generateTile(tx, y, ground = groundAt(tx)) {
  const x = tx - WEST_EXTENSION;
  if (y < ground) return MATERIAL.air;
  const depth = y - ground;
  if (y >= ROWS - 2) return MATERIAL.bedrock;
  if (y > 34 && depth > 3 && x > 75 && x < 198 && (
    Math.pow((x - 99) / 26, 2) + Math.pow((y - 56) / 10, 2) < 1 ||
    Math.pow((x - 153) / 26, 2) + Math.pow((y - 69) / 13, 2) < 1 ||
    (x > 124 && x < 139 && Math.abs(y - (57 + (x - 124) * 0.6)) < 3)
  )) return MATERIAL.air;
  if (depth < 2) return ground < WATER_ROW || noise(x, 2) > 0.3 ? MATERIAL.sand : MATERIAL.reef;
  if (ground < WATER_ROW && y < WATER_ROW + 1) return MATERIAL.soil;
  return MATERIAL.stone;
}

const caverns = [
  [-7, 93, 25, 14],
  [46, 117, 29, 14],
  [91, 145, 29, 19],
  [139, 153, 26, 15],
  [190, 124, 28, 17],
  [202, 156, 16, 11],
];

const passages = [
  [[-10, 48, 3], [-14, 73, 3], [-7, 93, 4], [14, 94, 3], [26, 113, 4], [46, 117, 5]],
  [[46, 117, 4], [60, 130, 4], [72, 127, 4], [91, 145, 5], [115, 148, 4], [139, 153, 5]],
  [[120, 39, 3], [122, 55, 4], [110, 64, 4], [124, 85, 4], [133, 97, 3], [128, 119, 4], [139, 153, 5]],
  [[124, 85, 3], [147, 89, 4], [167, 104, 3], [190, 124, 5], [200, 141, 4], [202, 156, 4]],
  [[139, 153, 5], [156, 153, 4], [172, 139, 4], [190, 124, 5]],
];

const oreLayers = [
  { material: MATERIAL.copper, top: 27, bottom: 58, step: 11, seed: 71 },
  { material: MATERIAL.iron, top: 62, bottom: 108, step: 13, seed: 72 },
  { material: MATERIAL.cobalt, top: 115, bottom: ROWS - 2, step: 16, seed: 73 },
];

function stamp(cx, cy, rx, ry, seed, visit, bounds) {
  const left = Math.max(bounds.left, Math.ceil(cx - rx));
  const right = Math.min(bounds.right, Math.floor(cx + rx));
  const top = Math.max(bounds.top, Math.ceil(cy - ry));
  const bottom = Math.min(bounds.bottom, Math.floor(cy + ry));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (distance < 0.82 + noise(x - WEST_EXTENSION, y, seed) * 0.24) visit(x, y);
    }
  }
}

function trace(points, seed, visit, bounds) {
  for (let i = 1; i < points.length; i++) {
    const [fromX, fromY, fromR] = points[i - 1];
    const [toX, toY, toR] = points[i];
    const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const radius = fromR + (toR - fromR) * t;
      stamp(WEST_EXTENSION + fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, radius, radius, seed, visit, bounds);
    }
  }
}

function applyCaves(set, bounds) {
  const carve = (x, y) => set(x, y, MATERIAL.air);
  for (const [x, y, rx, ry] of caverns) stamp(x + WEST_EXTENSION, y, rx, ry, 61, carve, bounds);
  for (const passage of passages) trace(passage, 62, carve, bounds);

  // Stone columns break up the larger chambers and leave swimming room on both sides.
  for (const [x, y, rx, ry] of [[-15, 97, 3, 9], [40, 122, 3, 9], [98, 154, 4, 12], [147, 161, 3, 8], [194, 132, 4, 10]]) {
    stamp(x + WEST_EXTENSION, y, rx, ry, 63, (tx, ty) => {
      set(tx, ty, MATERIAL.stone);
    }, bounds);
  }

}

export function generateVents(get) {
  const vents = [];
  for (const [x, y] of [[-1, 88], [50, 109], [111, 59], [129, 107], [91, 143], [138, 150], [185, 118], [202, 151]]) {
    const column = x + WEST_EXTENSION;
    let floor = y;
    while (floor < ROWS - 2 && get(column, floor) === MATERIAL.air) floor++;
    if (floor >= y + 3 && floor > groundAt(column)) {
      vents.push({ x: column * TILE + TILE / 2, y: floor * TILE });
    }
  }
  return vents;
}

function applyOres(get, set, bounds) {
  for (const { material, top, bottom, step, seed } of oreLayers) {
    for (let row = top; row < bottom; row += step) {
      if (row + step + 5 < bounds.top || row - 5 > bounds.bottom) continue;
      for (let column = 0; column < COLS; column += step) {
        if (column + step + 5 < bounds.left || column - 5 > bounds.right) continue;
        if (noise(column, row, seed + 4) < 0.33) continue;
        const x = column + noise(column, row, seed) * step;
        const y = row + noise(column, row, seed + 1) * step;
        const width = 1.25 + noise(column, row, seed + 2) * 1.85;
        const height = 1 + noise(column, row, seed + 3) * 1.25;
        stamp(x, y, width, height, seed, (tx, ty) => {
          if (ty >= top && ty < bottom && get(tx, ty) === MATERIAL.stone) set(tx, ty, material);
        }, bounds);
      }
    }
  }

  // The exposed western vein is the one place shallow swimmers can find iron.
  const mineralize = (x, y) => {
    const mineral = noise(x, y, 79);
    const seam = Math.sin(x * 0.86 + y * 0.32) + Math.cos(y * 0.51) * 0.65;
    if (seam > 0.05 && mineral > 0.48) {
      set(x, y, MATERIAL.copper);
    } else if (seam <= 0.05 && mineral > 0.87) {
      set(x, y, MATERIAL.iron);
    } else if (get(x, y) === MATERIAL.air) {
      set(x, y, MATERIAL.stone);
    }
  };
  trace([[-25, 65, 2.7], [-27, 58, 2.3], [-31, 51, 1.7], [-32, 47, 1]], 77, mineralize, bounds);
  trace([[-29, 54, 1.6], [-33, 52, 1.35], [-34, 49, 1]], 77, mineralize, bounds);
}

export function generateChunk(left, top, size) {
  const tiles = new Uint8Array(size * size);
  const index = (x, y) => (y - top) * size + x - left;
  const get = (x, y) => tiles[index(x, y)];
  const set = (x, y, material) => { tiles[index(x, y)] = material; };
  for (let x = left; x < left + size; x++) {
    const ground = groundAt(x);
    for (let y = top; y < top + size; y++) set(x, y, generateTile(x, y, ground));
  }
  const bounds = { left, top, right: Math.min(COLS - 1, left + size - 1), bottom: Math.min(ROWS - 3, top + size - 1) };
  applyCaves(set, bounds);

  // Only the original ocean and generated caverns supply water.
  const flooded = new Uint8Array(tiles.length);
  for (let i = Math.max(0, WATER_ROW - top) * size; i < tiles.length; i++) {
    flooded[i] = Number(tiles[i] === MATERIAL.air);
  }

  applyOres(get, set, bounds);
  for (let x = bounds.left; x <= bounds.right; x++) {
    const deepstoneStart = 84 + Math.round(4 * Math.sin(x * 0.12));
    for (let y = Math.max(bounds.top, deepstoneStart); y <= bounds.bottom; y++) {
      if (get(x, y) === MATERIAL.stone) set(x, y, MATERIAL.deepstone);
    }
  }
  return { tiles, flooded };
}

export function generateFixtures() {
  const items = [
    { id: WRECK_CACHE.id, kind: 'cache', x: (111 + WEST_EXTENSION) * TILE + 8, y: groundAt(111 + WEST_EXTENSION) * TILE - 9 },
  ];
  for (const x of [34, 41, 76, 79, 84, 91, 96, 104, 114, 127, 132, 144]) {
    items.push({ id: 'kelp-' + x, kind: 'kelp', amount: 1, x: (x + WEST_EXTENSION) * TILE + 8, y: groundAt(x + WEST_EXTENSION) * TILE - 12 });
  }

  return items;
}

export function generateTrees() {
  return [[49, 61, -1], [52, 46, 1], [58, 69, 1], [62, 48, -1]].map(([column, height, direction]) => {
    const tx = column + WEST_EXTENSION;
    const ty = groundAt(tx);
    const x = tx * TILE + 7;
    const y = ty * TILE;
    const trunk = [];
    for (let rise = 0; rise < height; rise += 2) {
      const lean = Math.floor(Math.pow(rise / height, 1.7) * 14) * direction;
      trunk.push({ x: x + lean - 3, y: y - rise - 2, width: rise > height * .68 ? 4 : 6 });
    }
    return { id: 'palm-' + column, tx, ty, x, y, height, direction, trunk };
  });
}

export function generateMobs() {
  return [
    { id: 'crab-island-west', kind: 'crab', x: 50 * TILE + 8, span: 48, speed: 22, variant: 0, phase: 0.4 },
    { id: 'crab-west-floor', kind: 'crab', x: 34 * TILE + 8, span: 52, speed: 21, variant: 1, phase: 0.9 },
    { id: 'crab-reef-east', kind: 'crab', x: 84 * TILE + 8, span: 60, speed: 24, variant: 2, phase: 2.1 },
    { id: 'crab-wreck', kind: 'crab', x: 116 * TILE + 8, span: 58, speed: 25, variant: 0, phase: 3.8 },
    { id: 'crab-deep', kind: 'crab', x: 135 * TILE + 8, span: 64, speed: 23, variant: 1, phase: 1.2 },
    { id: 'fish-west-shallows', kind: 'fish', x: 34 * TILE, y: 19 * TILE, span: 46, speed: 34, variant: 0, phase: 0.3 },
    { id: 'fish-west-deep', kind: 'fish', x: 22 * TILE, y: 27 * TILE, span: 64, speed: 32, variant: 2, phase: 3.1 },
    { id: 'fish-reef-shallows', kind: 'fish', x: 79 * TILE, y: 19 * TILE, span: 48, speed: 36, variant: 0, phase: 0.7 },
    { id: 'fish-reef-kelp', kind: 'fish', x: 94 * TILE, y: 23 * TILE, span: 54, speed: 40, variant: 3, phase: 4.9 },
    { id: 'fish-wreck', kind: 'fish', x: 115 * TILE, y: 26 * TILE, span: 60, speed: 38, variant: 1, phase: 2.9 },
    { id: 'fish-deep-slope', kind: 'fish', x: 134 * TILE, y: 31 * TILE, span: 70, speed: 37, variant: 2, phase: 5.5 },
    { id: 'fish-cave', kind: 'fish', x: 101 * TILE, y: 56 * TILE, span: 48, speed: 32, variant: 3, phase: 1.9 },
    { id: 'jelly-west', kind: 'jellyfish', x: 32 * TILE, y: (groundAt(32 + WEST_EXTENSION) - 4) * TILE, span: 22, speed: 14, phase: 0.4 },
    { id: 'jelly-reef', kind: 'jellyfish', x: 86 * TILE, y: (groundAt(86 + WEST_EXTENSION) - 4) * TILE, span: 24, speed: 13, phase: 1.7 },
    { id: 'jelly-wreck', kind: 'jellyfish', x: 118 * TILE, y: 30 * TILE, span: 32, speed: 14, phase: 4.5 },
    { id: 'squid-channel', kind: 'squid', x: 102 * TILE, y: 25 * TILE, span: 58, speed: 48, phase: 2.2 },
    { id: 'squid-deep', kind: 'squid', x: 149 * TILE, y: 66 * TILE, span: 68, speed: 54, phase: 5.1 },
    { id: 'shark-west', kind: 'shark', x: 19 * TILE, y: 23 * TILE, span: 84, speed: 58, phase: 0.2 },
    { id: 'shark-deep', kind: 'shark', x: 146 * TILE, y: 33 * TILE, span: 104, speed: 66, phase: 2.9 },
  ].map((mob, index) => {
    const x = mob.x + WEST_EXTENSION * TILE;
    const y = mob.kind === 'crab' ? groundAt(Math.floor(x / TILE)) * TILE : mob.y;
    return {
      ...mob,
      x,
      y,
      homeX: x,
      homeY: y,
      dx: 0,
      dy: 0,
      facing: index % 2 ? -1 : 1,
      grounded: mob.kind === 'crab',
      flee: 0,
      cooldown: 0,
    };
  });
}
