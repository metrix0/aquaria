import { MATERIAL, SWIMMING_HELMET } from '../content.js';

export const TILE = 16;
export const WORLD_VERSION = 2;
export const WEST_EXTENSION = 44;
export const COLS = 224 + WEST_EXTENSION;
export const ROWS = 176;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;
export const SPAWN = { x: (63 + WEST_EXTENSION) * TILE + 8, y: 12 * TILE - 23 };
export const ISLAND_CAVE = { center: 56, camp: 40, campFloor: 42 };

const islandCaveProfile = [
  // Column from the original west edge, ceiling, floor.
  [38, 36, 42],
  [ISLAND_CAVE.camp, 32, ISLAND_CAVE.campFloor],
  [44, 30, 38],
  [49, 27, 33],
  [54, 23, 28],
  [ISLAND_CAVE.center, 22, 28],
  [59, 24, 30],
  [64, 28, 35],
  [69, 30, 40],
  [72, 31, 42],
  [74, 36, 42],
];
const islandCaveColumns = new Map();
for (let i = 1; i < islandCaveProfile.length; i++) {
  const [left, leftRoof, leftFloor] = islandCaveProfile[i - 1];
  const [right, rightRoof, rightFloor] = islandCaveProfile[i];
  for (let x = left; x <= right; x++) {
    const t = (x - left) / (right - left);
    islandCaveColumns.set(WEST_EXTENSION + x, {
      roof: Math.round(leftRoof + (rightRoof - leftRoof) * t),
      floor: Math.round(leftFloor + (rightFloor - leftFloor) * t),
    });
  }
}

const islandCaveRockBuffer = 2;
const islandCaveShell = new Map();
for (const [x, { roof, floor }] of islandCaveColumns) {
  for (let tx = x - islandCaveRockBuffer; tx <= x + islandCaveRockBuffer; tx++) {
    const shell = islandCaveShell.get(tx);
    islandCaveShell.set(tx, {
      roof: Math.min(shell?.roof ?? Infinity, roof - islandCaveRockBuffer),
      floor: Math.max(shell?.floor ?? 0, floor + islandCaveRockBuffer),
    });
  }
}

function protectsIslandCave(tx, ty) {
  const shell = islandCaveShell.get(tx);
  return shell && ty >= shell.roof && ty < shell.floor;
}
export const MOB_HEALTH = Object.freeze({
  crab: 2,
  fish: 2,
  jellyfish: 2,
  squid: 4,
  shark: 7,
});

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

export function deepstoneStartAt(tx) {
  return 84 + Math.round(4 * Math.sin(tx * 0.12));
}

function valueNoise(x, y, scale, seed) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const n00 = noise(x0, y0, seed);
  const n10 = noise(x0 + 1, y0, seed);
  const n01 = noise(x0, y0 + 1, seed);
  const n11 = noise(x0 + 1, y0 + 1, seed);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

export function caveField(tx, ty, seed = 61) {
  const x = tx - WEST_EXTENSION;
  return valueNoise(x, ty * 1.15, 13, seed + 17) * 0.64 + valueNoise(x, ty * 1.15, 6, seed + 29) * 0.36;
}

export function generateTile(tx, y, ground = groundAt(tx)) {
  const x = tx - WEST_EXTENSION;
  if (y < ground) return MATERIAL.air;
  const depth = y - ground;
  if (y >= ROWS - 2) return MATERIAL.bedrock;
  if (depth < 2) return ground < WATER_ROW || noise(x, 2) > 0.3 ? MATERIAL.sand : MATERIAL.reef;
  if (ground < WATER_ROW && y < WATER_ROW + 1) return MATERIAL.soil;
  return MATERIAL.stone;
}

function wormTunnel([x0, y0, r0], [x1, y1, r1], seed, minY = WATER_ROW + 5) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const segments = Math.max(3, Math.ceil(length / 11));
  const points = [[x0, y0, r0]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const envelope = Math.sin(t * Math.PI);
    const sway = (noise(i, seed, 81) - 0.5) * Math.min(13, length * 0.26) * envelope;
    const wx = clamp(x0 + dx * t + nx * sway, -WEST_EXTENSION + 6, COLS - WEST_EXTENSION - 6);
    const floorClearance = groundAt(Math.round(wx) + WEST_EXTENSION) + 5;
    const wy = clamp(y0 + dy * t + ny * sway * 0.55, Math.max(minY, floorClearance), ROWS - 7);
    const radius = r0 + (r1 - r0) * t + (noise(i, seed, 82) - 0.45) * 0.85 * envelope;
    points.push([wx, wy, Math.max(3.0, radius)]);
  }
  points.push([x1, y1, r1]);
  return points;
}

function withBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y, r] of points) {
    const tx = x + WEST_EXTENSION;
    minX = Math.min(minX, Math.floor(tx - r - 1));
    maxX = Math.max(maxX, Math.ceil(tx + r + 1));
    minY = Math.min(minY, Math.floor(y - r - 1));
    maxY = Math.max(maxY, Math.ceil(y + r + 1));
  }
  return { points, minX, maxX, minY, maxY };
}

function makeChamber(tier, x, y, rx, ry) {
  const tx = x + WEST_EXTENSION;
  return {
    tier, x, y, rx, ry, tx,
    minX: Math.floor(tx - rx - 1),
    maxX: Math.ceil(tx + rx + 1),
    minY: Math.floor(y - ry - 1),
    maxY: Math.ceil(y + ry + 1),
  };
}

export function generateCaveSystem(seed = 61) {
  const upperAnchors = [-14, 24, 68, 108, 154];
  const upper = upperAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 1, seed) - 0.5) * 8), -WEST_EXTENSION + 20, COLS - WEST_EXTENSION - 24);
    const rx = 17 + Math.round(noise(i, 3, seed) * 8);
    const ry = 8 + Math.round(noise(i, 4, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(48 + noise(i, 2, seed) * 20), Math.max(WATER_ROW + ry + 6, floorClearance), 74);
    return makeChamber(0, x, y, rx, ry);
  });

  const midAnchors = [-8, 44, 94, 142, 190];
  const mid = midAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 11, seed) - 0.5) * 10), -WEST_EXTENSION + 22, COLS - WEST_EXTENSION - 24);
    const rx = 20 + Math.round(noise(i, 13, seed) * 8);
    const ry = 11 + Math.round(noise(i, 14, seed) * 5);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(92 + noise(i, 12, seed) * 26), floorClearance, 122);
    return makeChamber(1, x, y, rx, ry);
  });

  const abyssAnchors = [8, 52, 96, 144, 196];
  const abyss = abyssAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 21, seed) - 0.5) * 10), -WEST_EXTENSION + 22, COLS - WEST_EXTENSION - 22);
    const rx = 18 + Math.round(noise(i, 23, seed) * 10);
    const ry = 11 + Math.round(noise(i, 24, seed) * 5);
    const y = clamp(Math.round(138 + noise(i, 22, seed) * 16), 134, ROWS - ry - 6);
    return makeChamber(2, x, y, rx, ry);
  });

  const chambers = [...upper, ...mid, ...abyss];

  // Carve underwater seafloor entrances in distinct reef/shelf zones, away from the island and wreck.
  const entranceZones = [
    { min: -18, max: -4, target: upper[0] },
    { min: 18, max: 34, target: upper[1] },
    { min: 76, max: 98, target: upper[2] },
    { min: 122, max: 168, target: upper[3] },
  ];

  const entrances = [];
  const rawPassages = [];

  for (const [i, zone] of entranceZones.entries()) {
    let ex = Math.round(zone.min + noise(i, 31, seed) * (zone.max - zone.min));
    if (groundAt(ex + WEST_EXTENSION) < WATER_ROW + 6) ex = zone.min;
    const ey = groundAt(ex + WEST_EXTENSION) - 1;
    const radius = 3.4 + noise(i, 32, seed) * 0.4;
    entrances.push({ x: ex, y: ey, tx: ex + WEST_EXTENSION, ty: ey, radius });
    rawPassages.push(wormTunnel([ex, ey, radius], [zone.target.x, zone.target.y, 4.1], seed + 100 + i * 7, ey));
  }

  for (let i = 0; i < 4; i++) {
    rawPassages.push(wormTunnel([upper[i].x, upper[i].y, 3.6], [upper[i + 1].x, upper[i + 1].y, 3.8], seed + 200 + i * 5));
    rawPassages.push(wormTunnel([mid[i].x, mid[i].y, 4.1], [mid[i + 1].x, mid[i + 1].y, 4.1], seed + 240 + i * 5));
    rawPassages.push(wormTunnel([abyss[i].x, abyss[i].y, 4.3], [abyss[i + 1].x, abyss[i + 1].y, 4.3], seed + 280 + i * 5));
  }

  for (let i = 0; i < 5; i++) {
    rawPassages.push(wormTunnel([upper[i].x, upper[i].y, 3.7], [mid[i].x, mid[i].y, 4.3], seed + 320 + i * 9));
    rawPassages.push(wormTunnel([mid[i].x, mid[i].y, 4.2], [abyss[i].x, abyss[i].y, 4.6], seed + 370 + i * 9));
  }

  // Add branching side alcoves off selected chambers for exploration variety.
  for (let i = 0; i < 4; i++) {
    const host = chambers[Math.floor(noise(i, 35, seed) * chambers.length)];
    const dir = noise(i, 36, seed) < 0.5 ? -1 : 1;
    const endX = clamp(host.x + dir * Math.round(host.rx + 8 + noise(i, 37, seed) * 10), -WEST_EXTENSION + 10, COLS - WEST_EXTENSION - 10);
    const endY = clamp(host.y + Math.round((noise(i, 38, seed) - 0.45) * 14), Math.max(WATER_ROW + 8, groundAt(endX + WEST_EXTENSION) + 6), ROWS - 8);
    rawPassages.push(wormTunnel([host.x, host.y, 3.2], [endX, endY, 3.6], seed + 430 + i * 11));
  }

  const pillars = [];
  for (const [i, chamber] of chambers.entries()) {
    if (chamber.rx < 20) continue;
    const px = chamber.x + Math.round((noise(i, 41, seed) - 0.5) * chamber.rx * 0.48);
    const py = chamber.y + 2;
    const rx = 2.6 + noise(i, 42, seed) * 1.1;
    const ry = Math.max(5, Math.round(chamber.ry * 0.62));
    const tx = px + WEST_EXTENSION;
    pillars.push({
      x: px, y: py, rx, ry, tx,
      minX: Math.floor(tx - rx - 1),
      maxX: Math.ceil(tx + rx + 1),
      minY: Math.floor(py - ry - 1),
      maxY: Math.ceil(py + ry + 1),
    });
  }

  // Select hydrothermal air vent candidates across all three depth tiers.
  const ventIndices = [1, 3, 5, 6, 8, 10, 12, 14];
  const ventCandidates = ventIndices.map((idx, i) => {
    const chamber = chambers[idx];
    return [
      chamber.x + Math.round((noise(i, 51, seed) - 0.5) * 6),
      chamber.y - Math.max(2, Math.floor(chamber.ry * 0.35)),
    ];
  });

  return {
    seed,
    entrances,
    chambers,
    passages: rawPassages.map(withBounds),
    pillars,
    ventCandidates,
  };
}

export const CAVE_SYSTEM = generateCaveSystem();

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

function overlaps(feature, bounds) {
  return feature.maxX >= bounds.left && feature.minX <= bounds.right &&
    feature.maxY >= bounds.top && feature.minY <= bounds.bottom;
}

function isEntranceZone(tx, ty) {
  return CAVE_SYSTEM.entrances.some((e) => Math.abs(tx - e.tx) <= e.radius + 2 && Math.abs(ty - e.ty) <= e.radius + 5);
}

function isCarvedAt(tx, ty) {
  if (ty < WATER_ROW + 4 || ty >= ROWS - 2 || protectsIslandCave(tx, ty)) return false;
  if (ty <= groundAt(tx) + 3 && !isEntranceZone(tx, ty)) return false;
  for (const chamber of CAVE_SYSTEM.chambers) {
    if (tx >= chamber.minX && tx <= chamber.maxX && ty >= chamber.minY && ty <= chamber.maxY) {
      if (((tx - chamber.tx) / chamber.rx) ** 2 + ((ty - chamber.y) / chamber.ry) ** 2 < 0.82 + noise(tx - WEST_EXTENSION, ty, 61) * 0.24) {
        return true;
      }
    }
  }
  return ty >= WATER_ROW + 14 && ty <= ROWS - 7 && ty > groundAt(tx) + 8 && caveField(tx, ty, CAVE_SYSTEM.seed) > 0.76;
}

function applyCaves(get, set, bounds) {
  const carve = (x, y) => {
    if (y < WATER_ROW + 4 || protectsIslandCave(x, y)) return;
    if (y <= groundAt(x) + 3 && !isEntranceZone(x, y)) return;
    set(x, y, MATERIAL.air);
  };
  for (const chamber of CAVE_SYSTEM.chambers) {
    if (overlaps(chamber, bounds)) stamp(chamber.tx, chamber.y, chamber.rx, chamber.ry, 61, carve, bounds);
  }
  for (const passage of CAVE_SYSTEM.passages) {
    if (overlaps(passage, bounds)) trace(passage.points, 62, carve, bounds);
  }

  for (let y = Math.max(bounds.top, WATER_ROW + 14); y <= Math.min(bounds.bottom, ROWS - 7); y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (y <= groundAt(x) + 8 || protectsIslandCave(x, y)) continue;
      if (caveField(x, y, CAVE_SYSTEM.seed) > 0.76) set(x, y, MATERIAL.air);
    }
  }

  // Stone columns break up the larger chambers and leave swimming room on both sides.
  for (const pillar of CAVE_SYSTEM.pillars) {
    if (!overlaps(pillar, bounds)) continue;
    stamp(pillar.tx, pillar.y, pillar.rx, pillar.ry, 63, (tx, ty) => {
      if (ty > groundAt(tx) + 5) set(tx, ty, MATERIAL.stone);
    }, bounds);
  }

  // Line shallow grotto floors with natural sand and reef sediment.
  for (let y = Math.max(bounds.top, WATER_ROW + 6); y <= Math.min(bounds.bottom, 78); y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const aboveAir = y > bounds.top ? get(x, y - 1) === MATERIAL.air : isCarvedAt(x, y - 1);
      if (y <= groundAt(x) + 3 || get(x, y) !== MATERIAL.stone || !aboveAir) continue;
      if (noise(x - WEST_EXTENSION, y, 67) > 0.52) {
        set(x, y, noise(x - WEST_EXTENSION, y, 68) > 0.45 ? MATERIAL.reef : MATERIAL.sand);
      }
    }
  }
}

function carveIslandCave(set, bounds) {
  for (const [tx, { roof, floor }] of islandCaveColumns) {
    if (tx < bounds.left || tx > bounds.right) continue;
    for (let ty = Math.max(roof, bounds.top); ty < floor && ty <= bounds.bottom; ty++) {
      set(tx, ty, MATERIAL.air);
    }
  }
}

export function generateVents(get) {
  const vents = [];
  for (const [x, y] of [...CAVE_SYSTEM.ventCandidates, [22, 51], [92, 102]]) {
    const column = x + WEST_EXTENSION;
    let floor = y;
    while (floor < ROWS - 2 && get(column, floor) === MATERIAL.air) floor++;
    if (floor >= y + 3 && floor < ROWS - 2 && floor > groundAt(column) + 3) {
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
  applyCaves(get, set, bounds);

  // Only the original ocean and generated caverns supply water.
  const flooded = new Uint8Array(tiles.length);
  for (let i = Math.max(0, WATER_ROW - top) * size; i < tiles.length; i++) {
    flooded[i] = Number(tiles[i] === MATERIAL.air);
  }

  // The island passage is carved after the flooded caverns so it stays dry below sea level.
  carveIslandCave(set, bounds);
  applyOres(get, set, bounds);
  for (let x = bounds.left; x <= bounds.right; x++) {
    for (let y = Math.max(bounds.top, deepstoneStartAt(x)); y <= bounds.bottom; y++) {
      if (get(x, y) === MATERIAL.stone) set(x, y, MATERIAL.deepstone);
    }
  }
  return { tiles, flooded };
}

export function generateFixtures() {
  const wreckChestColumn = 107 + WEST_EXTENSION;
  const items = [
    { id: 'wreck-cache', name: 'Wreck cache', column: 111, floor: groundAt(111 + WEST_EXTENSION), resource: 'wood', amount: 8 },
    { id: 'island-cave-cache', name: 'Survey cache', column: ISLAND_CAVE.camp - 1, floor: ISLAND_CAVE.campFloor, resource: 'copper', amount: 2 },
    { id: 'western-grotto-cache', name: 'Grotto cache', column: 20, floor: 62, resource: 'kelp', amount: 2 },
    { id: 'deep-cave-cache', name: 'Deep cave cache', column: 90, floor: 118, resource: 'iron', amount: 3 },
  ].map(({ column, floor, ...cache }) => ({ kind: 'cache', ...cache, x: (column + WEST_EXTENSION + .5) * TILE, y: floor * TILE - 9 }));
  items.push({ id: SWIMMING_HELMET.chestId, kind: 'helmet', x: wreckChestColumn * TILE + 8, y: groundAt(wreckChestColumn) * TILE - 5 });
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

function chamberMobSpot(chamber) {
  const pillar = CAVE_SYSTEM.pillars.find((p) => Math.abs(p.x - chamber.x) <= chamber.rx && Math.abs(p.y - chamber.y) <= chamber.ry);
  const offset = pillar ? (pillar.x >= chamber.x ? -Math.min(7, chamber.rx - 5) : Math.min(7, chamber.rx - 5)) : 0;
  return { x: (chamber.x + offset) * TILE, y: (chamber.y - 1) * TILE };
}

export function generateMobs() {
  const caveFish = chamberMobSpot(CAVE_SYSTEM.chambers[3]);
  const caveSquid = chamberMobSpot(CAVE_SYSTEM.chambers[8]);
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
    { id: 'fish-cave', kind: 'fish', x: caveFish.x, y: caveFish.y, span: 48, speed: 32, variant: 3, phase: 1.9 },
    { id: 'jelly-west', kind: 'jellyfish', x: 32 * TILE, y: (groundAt(32 + WEST_EXTENSION) - 4) * TILE, span: 22, speed: 14, phase: 0.4 },
    { id: 'jelly-reef', kind: 'jellyfish', x: 86 * TILE, y: (groundAt(86 + WEST_EXTENSION) - 4) * TILE, span: 24, speed: 13, phase: 1.7 },
    { id: 'jelly-wreck', kind: 'jellyfish', x: 118 * TILE, y: 30 * TILE, span: 32, speed: 14, phase: 4.5 },
    { id: 'squid-channel', kind: 'squid', x: 102 * TILE, y: 25 * TILE, span: 58, speed: 48, phase: 2.2 },
    { id: 'squid-deep', kind: 'squid', x: caveSquid.x, y: caveSquid.y, span: 68, speed: 54, phase: 5.1 },
    { id: 'shark-west', kind: 'shark', x: 19 * TILE, y: 23 * TILE, span: 84, speed: 58, phase: 0.2 },
    { id: 'shark-deep', kind: 'shark', x: 146 * TILE, y: 33 * TILE, span: 104, speed: 66, phase: 2.9 },
  ].map((mob, index) => {
    const x = mob.x + WEST_EXTENSION * TILE;
    const y = mob.kind === 'crab' ? groundAt(Math.floor(x / TILE)) * TILE : mob.y;
    const maxHealth = MOB_HEALTH[mob.kind] ?? 2;
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
      maxHealth,
      health: maxHealth,
      hurt: 0,
      respawn: 0,
      attackTimer: 1.4 + (mob.phase % 1.5),
      windup: 0,
      dash: 0,
      dashDx: 0,
      dashDy: 0,
      shock: 0,
      shockHit: false,
    };
  });
}
