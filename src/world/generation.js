import { COPPER_SNORKEL, MATERIAL, SNORKEL_CHEST_ID } from '../content.js';
import { ISLAND_BOTTOM, ISLAND_CAVE, ISLAND_DEEPSTONE_ROW, carveIslandCave, islandCaches, islandMobs, islandMushrooms, isIslandWaterway, protectsIslandCave } from './island-cave.js';
import { HELMET_WRECK_COLUMN, placeShipwreck, shipwreckCaches, shipwreckGhosts, shipwreckVentColumn } from './shipwreck.js';

export { ISLAND_CAVE };

export const TILE = 16;
export const WORLD_VERSION = 2;
export const ORIGINAL_COLS = 224;
export const ORIGINAL_WEST_EXTENSION = 44;
export const WEST_EXTENSION = ORIGINAL_WEST_EXTENSION + 64;
export const EAST_EXTENSION = 128;
export const COLS = ORIGINAL_COLS + WEST_EXTENSION + EAST_EXTENSION;
export const KRAKEN_COLUMN = ORIGINAL_COLS - 1.5;
export const JUNGLE_FADE_START_COLUMN = ORIGINAL_COLS;
export const JUNGLE_FADE_END_COLUMN = ORIGINAL_COLS + 48;
const OCEAN_ROWS = 176;
export const ROWS = ISLAND_BOTTOM;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;

export function waterwayAt(tx, ty) {
  return isIslandWaterway(tx - WEST_EXTENSION, ty);
}
export const SPAWN = { x: (63 + WEST_EXTENSION) * TILE + 8, y: 12 * TILE - 23 };
export const MOB_HEALTH = Object.freeze({
  crab: 2,
  fish: 2,
  jellyfish: 2,
  squid: 4,
  shark: 7,
  kraken: 80,
  ghost: 5,
  spider: 3, archer: 4, miner: 5, scorpion: 6, hammer: 9,
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
  if (x < -ORIGINAL_WEST_EXTENSION) {
    const distance = -x - ORIGINAL_WEST_EXTENSION;
    const blend = Math.min(1, distance / 12);
    const shelf = 56 + 7 * blend + Math.sin(distance * .22) * 1.5 * blend;
    const depth = Math.round(shelf + noise(x, 7) * 1.5);
    return Math.min(depth, 63 + Math.max(0, Math.abs(x + 81) - 4));
  }
  if (x < 0) {
    const shelf = 46 + 19 * Math.sin(-x / ORIGINAL_WEST_EXTENSION * Math.PI * 0.83);
    return Math.round(shelf + 2 * Math.sin(x * 0.35) + noise(x, 7) * 2);
  }
  if (x > ORIGINAL_COLS) {
    const distance = x - ORIGINAL_COLS;
    const blend = Math.min(1, distance / 18);
    const baseDepth = 46 + 6 * Math.sin(x * 0.098) + 3 * Math.sin(x * 0.27);
    const jungleDepth = 52 + 7 * Math.sin(distance * 0.085 + 0.6) + 3 * Math.sin(distance * 0.23);
    return Math.round(baseDepth + (jungleDepth - baseDepth) * blend + noise(x, 7) * 2);
  }
  const depth = 30 + 16 * Math.min(1, Math.abs(x - 56) / 85) + 6 * Math.sin(x * 0.098) + 3 * Math.sin(x * 0.27);
  return Math.min(islandSurface(x), Math.round(depth + noise(x, 7) * 2));
}

export function groundAt(tx) {
  return oceanFloor(tx - WEST_EXTENSION);
}

export function deepstoneStartAt(tx, row) {
  const x = tx - WEST_EXTENSION;
  if ((x >= -51 && x <= 177) && (row >= OCEAN_ROWS || protectsIslandCave(x, row))) return ISLAND_DEEPSTONE_ROW;
  return 84 + Math.round(4 * Math.sin((x + ORIGINAL_WEST_EXTENSION) * 0.12));
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
  if (ground < WATER_ROW) {
    const soilBottom = 16 + Math.round(1.9 * Math.sin(x * .51) + 1.1 * Math.sin(x * .94));
    if (y <= Math.max(ground + 2, soilBottom)) return MATERIAL.soil;
  }
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
    const wy = clamp(y0 + dy * t + ny * sway * 0.55, Math.max(minY, floorClearance), OCEAN_ROWS - 7);
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
  const coreMaxX = ORIGINAL_COLS - 24;
  const coreMaxAbyssX = ORIGINAL_COLS - 22;
  const upperAnchors = [-78, -54, 172, 190, 203];
  const upper = upperAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 1, seed) - 0.5) * 8), -WEST_EXTENSION + 20, coreMaxX);
    const rx = 17 + Math.round(noise(i, 3, seed) * 8);
    const ry = 8 + Math.round(noise(i, 4, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(48 + noise(i, 2, seed) * 20), Math.max(WATER_ROW + ry + 6, floorClearance), 74);
    return makeChamber(0, x, y, rx, ry);
  });

  const midAnchors = [-78, -58, 175, 193, 206];
  const mid = midAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 11, seed) - 0.5) * 10), -WEST_EXTENSION + 22, coreMaxX);
    const rx = 20 + Math.round(noise(i, 13, seed) * 8);
    const ry = 11 + Math.round(noise(i, 14, seed) * 5);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(92 + noise(i, 12, seed) * 26), floorClearance, 122);
    return makeChamber(1, x, y, rx, ry);
  });

  const abyssAnchors = [-80, -61, 170, 193, 204];
  const abyss = abyssAnchors.map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i, 21, seed) - 0.5) * 10), -WEST_EXTENSION + 22, coreMaxAbyssX);
    const rx = 18 + Math.round(noise(i, 23, seed) * 10);
    const ry = 11 + Math.round(noise(i, 24, seed) * 5);
    const y = clamp(Math.round(138 + noise(i, 22, seed) * 16), 134, OCEAN_ROWS - ry - 6);
    return makeChamber(2, x, y, rx, ry);
  });

  const chambers = [...upper, ...mid, ...abyss];

  // Carve underwater seafloor entrances in distinct reef/shelf zones, away from the island and wreck.
  const entranceZones = [
    { min: -98, max: -91, target: upper[0] },
    { min: -61, max: -54, target: upper[1] },
    { min: 171, max: 183, target: upper[2] },
    { min: 192, max: 210, target: upper[3] },
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
    const endX = clamp(host.x + dir * Math.round(host.rx + 8 + noise(i, 37, seed) * 10), -WEST_EXTENSION + 10, coreMaxX);
    const endY = clamp(host.y + Math.round((noise(i, 38, seed) - 0.45) * 14), Math.max(WATER_ROW + 8, groundAt(endX + WEST_EXTENSION) + 6), OCEAN_ROWS - 8);
    rawPassages.push(wormTunnel([host.x, host.y, 3.2], [endX, endY, 3.6], seed + 430 + i * 11));
  }

  // Eastern jungle ocean grotto chambers beyond the Kraken.
  const eastMaxX = COLS - WEST_EXTENSION - 24;
  const eastUpper = [258, 308].map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 1, seed) - 0.5) * 8), ORIGINAL_COLS + 22, eastMaxX);
    const rx = 18 + Math.round(noise(i + 10, 3, seed) * 7);
    const ry = 9 + Math.round(noise(i + 10, 4, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(62 + noise(i + 10, 2, seed) * 16), Math.max(WATER_ROW + ry + 6, floorClearance), 84);
    return makeChamber(0, x, y, rx, ry);
  });
  const eastMid = [260, 310].map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 11, seed) - 0.5) * 8), ORIGINAL_COLS + 22, eastMaxX);
    const rx = 20 + Math.round(noise(i + 10, 13, seed) * 7);
    const ry = 11 + Math.round(noise(i + 10, 14, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(98 + noise(i + 10, 12, seed) * 20), floorClearance, 124);
    return makeChamber(1, x, y, rx, ry);
  });
  const eastAbyss = [257, 309].map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 21, seed) - 0.5) * 8), ORIGINAL_COLS + 22, eastMaxX);
    const rx = 19 + Math.round(noise(i + 10, 23, seed) * 8);
    const ry = 11 + Math.round(noise(i + 10, 24, seed) * 4);
    const y = clamp(Math.round(140 + noise(i + 10, 22, seed) * 14), 134, OCEAN_ROWS - ry - 6);
    return makeChamber(2, x, y, rx, ry);
  });
  chambers.push(...eastUpper, ...eastMid, ...eastAbyss);

  const eastEntranceZones = [
    { min: 252, max: 262, target: eastUpper[0] },
    { min: 304, max: 314, target: eastUpper[1] },
  ];
  for (const [i, zone] of eastEntranceZones.entries()) {
    const ex = Math.round(zone.min + noise(i + 10, 31, seed) * (zone.max - zone.min));
    const ey = groundAt(ex + WEST_EXTENSION) - 1;
    const radius = 3.5 + noise(i + 10, 32, seed) * 0.4;
    entrances.push({ x: ex, y: ey, tx: ex + WEST_EXTENSION, ty: ey, radius });
    rawPassages.push(wormTunnel([ex, ey, radius], [zone.target.x, zone.target.y, 4.1], seed + 500 + i * 7, ey));
  }
  rawPassages.push(wormTunnel([eastUpper[0].x, eastUpper[0].y, 3.7], [eastUpper[1].x, eastUpper[1].y, 3.7], seed + 540));
  rawPassages.push(wormTunnel([eastMid[0].x, eastMid[0].y, 4.1], [eastMid[1].x, eastMid[1].y, 4.1], seed + 560));
  rawPassages.push(wormTunnel([eastAbyss[0].x, eastAbyss[0].y, 4.3], [eastAbyss[1].x, eastAbyss[1].y, 4.3], seed + 580));
  for (let i = 0; i < 2; i++) {
    rawPassages.push(wormTunnel([eastUpper[i].x, eastUpper[i].y, 3.8], [eastMid[i].x, eastMid[i].y, 4.3], seed + 600 + i * 9));
    rawPassages.push(wormTunnel([eastMid[i].x, eastMid[i].y, 4.2], [eastAbyss[i].x, eastAbyss[i].y, 4.6], seed + 640 + i * 9));
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
  const ventIndices = [1, 3, 5, 6, 8, 10, 12, 14, 16, 19];
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
  { material: MATERIAL.cobalt, top: 115, bottom: OCEAN_ROWS - 2, step: 16, seed: 73 },
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
  if (ty < WATER_ROW + 4 || ty >= OCEAN_ROWS - 2 || protectsIslandCave(tx - WEST_EXTENSION, ty)) return false;
  if (ty <= groundAt(tx) + 3 && !isEntranceZone(tx, ty)) return false;
  for (const chamber of CAVE_SYSTEM.chambers) {
    if (tx >= chamber.minX && tx <= chamber.maxX && ty >= chamber.minY && ty <= chamber.maxY) {
      if (((tx - chamber.tx) / chamber.rx) ** 2 + ((ty - chamber.y) / chamber.ry) ** 2 < 0.82 + noise(tx - WEST_EXTENSION, ty, 61) * 0.24) {
        return true;
      }
    }
  }
  return ty >= WATER_ROW + 14 && ty <= OCEAN_ROWS - 7 && ty > groundAt(tx) + 8 && caveField(tx, ty, CAVE_SYSTEM.seed) > 0.76;
}

function applyCaves(get, set, bounds) {
  const carve = (x, y) => {
    if (y < WATER_ROW + 4 || protectsIslandCave(x - WEST_EXTENSION, y)) return;
    if (y <= groundAt(x) + 3 && !isEntranceZone(x, y)) return;
    set(x, y, MATERIAL.air);
  };
  for (const chamber of CAVE_SYSTEM.chambers) {
    if (overlaps(chamber, bounds)) stamp(chamber.tx, chamber.y, chamber.rx, chamber.ry, 61, carve, bounds);
  }
  for (const passage of CAVE_SYSTEM.passages) {
    if (overlaps(passage, bounds)) trace(passage.points, 62, carve, bounds);
  }

  for (let y = Math.max(bounds.top, WATER_ROW + 14); y <= Math.min(bounds.bottom, OCEAN_ROWS - 7); y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (y <= groundAt(x) + 8 || protectsIslandCave(x - WEST_EXTENSION, y)) continue;
      if (caveField(x, y, CAVE_SYSTEM.seed) > 0.76) set(x, y, MATERIAL.air);
    }
  }

  // Stone columns break up the larger chambers and leave swimming room on both sides.
  for (const pillar of CAVE_SYSTEM.pillars) {
    if (!overlaps(pillar, bounds)) continue;
    stamp(pillar.tx, pillar.y, pillar.rx, pillar.ry, 63, (tx, ty) => {
      if (ty > groundAt(tx) + 5 && !protectsIslandCave(tx - WEST_EXTENSION, ty)) set(tx, ty, MATERIAL.stone);
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

export function generateVents(get) {
  const vents = [];
  for (const [x, y] of CAVE_SYSTEM.ventCandidates) {
    const column = x + WEST_EXTENSION;
    let floor = y;
    while (floor < OCEAN_ROWS - 2 && get(column, floor) === MATERIAL.air) floor++;
    if (floor >= y + 3 && floor < OCEAN_ROWS - 2 && floor > groundAt(column) + 3) {
      vents.push({ x: column * TILE + TILE / 2, y: floor * TILE });
    }
  }
  const wreckVentX = shipwreckVentColumn + WEST_EXTENSION;
  vents.push({ x: (wreckVentX + .5) * TILE, y: groundAt(wreckVentX) * TILE });
  return vents;
}

// Start at the center, then grow a compact, connected vein out from it.
const veinOffsets = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [0, -1], [1, -1]];
const islandOreVeins = [
  [51, 21, 5, MATERIAL.copper], [64, 23, 5, MATERIAL.iron],
  [5, 84, 5, MATERIAL.copper], [-28, 113, 5, MATERIAL.copper], [137, 106, 4, MATERIAL.copper],
  [27, 162, 4, MATERIAL.copper], [113, 183, 5, MATERIAL.copper], [-18, 220, 3, MATERIAL.iron],
  [96, 266, 5, MATERIAL.copper], [45, 319, 5, MATERIAL.copper],
  [53, 118, 5, MATERIAL.copper], [64, 157, 4, MATERIAL.copper], [46, 192, 5, MATERIAL.copper],
  [40, 242, 3, MATERIAL.iron], [56, 274, 4, MATERIAL.copper], [73, 320, 4, MATERIAL.copper],
  [25, 346, 5], [43, 346, 4], [72, 358, 6], [120, 347, 4],
  [-17, 374, 7], [5, 373, 5], [138, 369, 4], [149, 369, 5],
  [26, 400, 4], [48, 400, 6], [96, 397, 5], [140, 423, 6],
  [-10, 432, 4], [4, 434, 3], [9, 451, 5], [48, 460, 6], [55, 460, 4], [87, 452, 4],
  [131, 475, 4], [147, 475, 5], [-16, 494, 6], [3, 494, 5], [98, 506, 4],
  [29, 521, 5], [49, 521, 4], [60, 514, 5], [143, 530, 6], [16, 551, 4],
  [119, 561, 5], [48, 575, 5], [51, 603, 4], [110, 602, 4],
  [18, 416, 5, MATERIAL.cobalt], [79, 507, 5, MATERIAL.cobalt], [123, 561, 4, MATERIAL.cobalt],
  [-31, 50, 5, MATERIAL.copper], [-28, 60, 5, MATERIAL.iron],
];

function writeVein(get, set, bounds, x, y, count, material, flip = 1) {
  if (x < bounds.left - 1 || x > bounds.right + 1 ||
      y < bounds.top - 1 || y > bounds.bottom + 1) return;
  const cells = veinOffsets.slice(0, count).map(([dx, dy]) => [x + dx * flip, y + dy]);
  const clipped = cells.findIndex(([tx, ty]) => tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2 ||
    get(tx, ty) !== MATERIAL.stone);
  const length = clipped < 0 ? count : clipped;
  if (length < 3) return;
  for (let i = 0; i < length; i++) {
    const [tx, ty] = cells[i];
    if (tx >= bounds.left && tx <= bounds.right && ty >= bounds.top && ty <= bounds.bottom) set(tx, ty, material);
  }
}

function applyOres(get, set, bounds) {
  const shift = WEST_EXTENSION - ORIGINAL_WEST_EXTENSION;
  for (const { material, top, bottom, step, seed } of oreLayers) {
    for (let row = top; row < bottom; row += step) {
      if (row + step < bounds.top || row > bounds.bottom) continue;
      for (let column = -Math.ceil(shift / step) * step; column < COLS - shift; column += step) {
        const tx = column + shift;
        if (tx + step < bounds.left || tx > bounds.right || noise(column, row, seed + 4) < .33) continue;
        const x = tx + 3 + Math.floor(noise(column, row, seed) * (step - 6));
        const y = row + 1 + Math.floor(noise(column, row, seed + 1) * Math.max(1, Math.min(step - 3, bottom - row - 2)));
        if (protectsIslandCave(x - WEST_EXTENSION, y)) continue;
        const count = 3 + Math.floor(noise(column, row, seed + 2) * 5);
        writeVein(get, set, bounds, x, y, count, material, column % 2 ? 1 : -1);
      }
    }
  }
  for (const [x, y, count, material = MATERIAL.iron] of islandOreVeins) {
    if (y + 1 >= bounds.top && y - 1 <= bounds.bottom) writeVein(get, set, bounds, x + WEST_EXTENSION, y, count, material);
  }
}

export function generateChunk(left, top, size) {
  // Veins are selected against a two-cell halo so a chunk edge never clips a deposit.
  const halo = 2;
  const stride = size + halo * 2;
  const tiles = new Uint8Array(stride * stride);
  const flooded = new Uint8Array(tiles.length);
  const index = (x, y) => (y - top + halo) * stride + x - left + halo;
  const get = (x, y) => tiles[index(x, y)];
  const set = (x, y, material) => { tiles[index(x, y)] = material; };
  for (let x = left - halo; x < left + size + halo; x++) {
    const ground = groundAt(x);
    for (let y = top - halo; y < top + size + halo; y++) set(x, y, generateTile(x, y, ground));
  }
  const bounds = { left, top, right: Math.min(COLS - 1, left + size - 1), bottom: Math.min(ROWS - 3, top + size - 1) };
  const geology = {
    left: Math.max(0, left - halo), top: Math.max(0, top - halo),
    right: Math.min(COLS - 1, left + size + halo - 1), bottom: Math.min(ROWS - 3, top + size + halo - 1),
  };
  applyCaves(get, set, geology);

  for (let y = Math.max(top, WATER_ROW); y < top + size; y++) {
    for (let x = left; x < left + size; x++) flooded[index(x, y)] = Number(get(x, y) === MATERIAL.air);
  }

  carveIslandCave((x, y, wet) => {
    set(x, y, MATERIAL.air);
    flooded[index(x, y)] = Number(wet);
  }, geology, WEST_EXTENSION);
  placeShipwreck(set, geology, WEST_EXTENSION);
  applyOres(get, set, bounds);
  for (let x = bounds.left; x <= bounds.right; x++) {
    for (let y = Math.max(bounds.top, 80); y <= bounds.bottom; y++) {
      if (y >= deepstoneStartAt(x, y) && get(x, y) === MATERIAL.stone) set(x, y, MATERIAL.deepstone);
    }
  }

  const chunk = new Uint8Array(size * size);
  const water = new Uint8Array(chunk.length);
  for (let row = 0; row < size; row++) {
    const start = index(left, top + row);
    chunk.set(tiles.subarray(start, start + size), row * size);
    water.set(flooded.subarray(start, start + size), row * size);
  }
  return { tiles: chunk, flooded: water };
}

export function generateCaveMushrooms() {
  return islandMushrooms.map(([x, floor]) => ({ tx: x + WEST_EXTENSION, floor }));
}

export function generateFixtures() {
  const wreckChestColumn = HELMET_WRECK_COLUMN + WEST_EXTENSION;
  const items = [
    ...shipwreckCaches,
    { id: 'wreck-cache', name: 'Reef cache', column: 154, floor: groundAt(154 + WEST_EXTENSION), resource: 'wood', amount: 8 },
    ...islandCaches.map(([id, name, column, floor, resource, amount, bonusLoot]) => ({ id, name, column, floor, resource, amount, bonusLoot })),
    { id: 'western-grotto-cache', name: 'Grotto cache', column: -62, floor: 106, resource: 'kelp', amount: 2 },
    { id: 'deep-cave-cache', name: 'Deep cave cache', column: 196, floor: 113, resource: 'iron', amount: 3 },
    { id: 'jungle-trench-cache', name: 'Jungle trench cache', column: 288, floor: groundAt(288 + WEST_EXTENSION), resource: 'cobalt', amount: 3 },
  ].map(({ id, name, column, floor, resource, amount, bonusLoot }) => ({
    id, name, kind: 'chest', loot: { id: resource, count: amount }, bonusLoot,
    x: (column + WEST_EXTENSION + .5) * TILE, y: floor * TILE - 8,
  }));
  items.push({
    id: SNORKEL_CHEST_ID, name: 'Wreck chest', kind: 'chest',
    loot: { id: COPPER_SNORKEL.id, count: 1 },
    x: wreckChestColumn * TILE + 8, y: groundAt(wreckChestColumn) * TILE - 8,
  });
  // Preserve saved kelp IDs where the seabed has shifted near cave openings.
  const kelpLocations = [[-105], [-100], [-57, -59], [-50], [-46], [34], [41], [76], [79], [84], [91, 89], [96], [104], [114], [127, 123], [132, 133], [144], [236], [248], [264], [282], [300], [320], [338]];
  for (const [id, column = id] of kelpLocations) {
    const tx = column + WEST_EXTENSION;
    const ty = groundAt(tx);
    items.push({ id: 'kelp-' + id, kind: 'kelp', amount: 1, tx, ty, x: (tx + .5) * TILE, y: ty * TILE - 12 });
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
    { id: 'squid-deep', kind: 'squid', x: caveSquid.x, y: caveSquid.y - 4 * TILE, span: 68, speed: 54, phase: 5.1 },
    { id: 'shark-west', kind: 'shark', x: 19 * TILE, y: 23 * TILE, span: 84, speed: 58, phase: 0.2 },
    { id: 'shark-deep', kind: 'shark', x: 146 * TILE, y: 33 * TILE, span: 104, speed: 66, phase: 2.9 },
    ...islandMobs.map(([id, kind, column, floor, respawnDelay], index) => ({
      id, kind, x: (column + .5) * TILE, y: floor * TILE, respawnDelay: floor < 330 ? Math.round(52 - floor * .095) : respawnDelay, phase: index * .7,
    })),
    ...shipwreckGhosts.map(({ id, column, row, phase, resident = false }) => ({
      id, kind: 'ghost', x: (column + .5) * TILE, y: (row + .5) * TILE, phase, resident, spawnCheckIn: 0,
    })),
    { id: 'fish-western-wreck', kind: 'fish', x: -75 * TILE, y: 39 * TILE, span: 72, speed: 28, variant: 1, phase: 3.5 },
    { id: 'kraken-east', kind: 'kraken', x: KRAKEN_COLUMN * TILE, y: 32 * TILE, span: 0, speed: 0, phase: 0, respawnDelay: 120 },
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
      facing: mob.kind === 'kraken' ? -1 : index % 2 ? -1 : 1,
      grounded: mob.kind === 'crab',
      flee: 0,
      cooldown: 0,
      maxHealth,
      health: mob.kind === 'ghost' && !mob.resident ? 0 : maxHealth,
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
