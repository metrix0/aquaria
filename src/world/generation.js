import { EAST_SHIFT, WEST_GROWTH, MERMAIDS, CORAL_RUINS, CORAL_DIALS, WEST_EXTRA } from "./ocean-layout.js";
import { COPPER_SNORKEL, MATERIAL, SNORKEL_CHEST_ID } from '../content.js';
import { ISLAND_BOTTOM, ISLAND_CAVE, ISLAND_DEEPSTONE_ROW, carveIslandCave, caveStructures, islandCaches, islandMobs, islandMushrooms, firstCaveWildChestSpots, inRootGrove, isDryIslandCave, isDungeonMasonry, isIslandWaterway, mineDecks, protectsIslandCave } from './island-cave.js';
import { HELMET_WRECK_COLUMN, placeShipwreck, shipwreckCaches, shipwreckGhosts, shipwreckOrigin, shipwreckVentColumn } from './shipwreck.js';
import { placeWaterTemple, protectsWaterTemple, waterTempleFloor } from './water-temple.js';
import { JUNGLE_ISLAND, jungleIslandSurface, jungleMobs, jungleTreeSpecs, jungleVillageCache } from './jungle-village.js';
import { JUNGLE_CAVE, JUNGLE_DEEPSTONE_ROW, carveJungleCave, jungleCaveCaches, jungleCaveMobs, protectsJungleCave } from './jungle-cave.js';
import { createWildChest } from './wild-chest.js';
import { oceanLandmarks, oceanVentColumns } from './ocean-landmarks.js';

export { ISLAND_CAVE, JUNGLE_CAVE, JUNGLE_ISLAND };

export const TILE = 16;
export const WORLD_VERSION = 2;
export const ORIGINAL_COLS = 224;
export const ORIGINAL_WEST_EXTENSION = 44;
export const WEST_EXTENSION = ORIGINAL_WEST_EXTENSION + 64 + WEST_GROWTH;
export const EAST_EXTENSION = 208 + EAST_SHIFT;
export const COLS = ORIGINAL_COLS + WEST_EXTENSION + EAST_EXTENSION;
export const KRAKEN_COLUMN = (150 + ORIGINAL_COLS + EAST_SHIFT) / 2;
export const JUNGLE_FADE_START_COLUMN = ORIGINAL_COLS + EAST_SHIFT;
export const JUNGLE_FADE_END_COLUMN = ORIGINAL_COLS + EAST_SHIFT + 48;
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
  mermaid: 5,
  jellyfish: 2,
  squid: 4,
  shark: 7,
  lionfish: 5,
  pufferfish: 4,
  kraken: 80,
  ghost: 5,
  spider: 3, archer: 4, miner: 5, scorpion: 6, hammer: 9, greatsword: 10, 'armored-skeleton': 12, mimic: 8, 'blood-bat': 4,
  'cannibal-spear': 5, 'cannibal-bow': 4,
  shaman: 5,
  'cave-frog': 7,
  frog: 7,
  worm: 9,
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
  if (x < -108) {
    const distance = -108 - x;
    const natural = Math.round(63 + 52 * Math.min(1, distance / (WEST_GROWTH * 110 / 128)) + Math.sin(distance * .12) * 3 * Math.min(1, distance / 12));
    return waterTempleFloor(x, natural);
  }
  if (x >= 150 && x < ORIGINAL_COLS + EAST_SHIFT) {
    const t = (x - 150) / (ORIGINAL_COLS + EAST_SHIFT - 150);
    const depth = 46 + 56 * Math.sin(Math.PI * t) + 3 * Math.sin(x * .15) * Math.sin(Math.PI * t);
    const blend = Math.min(1, (x - 150) / 16);
    const old = 46 + 6 * Math.sin(x * .098) + 3 * Math.sin(x * .27);
    return Math.round(old * (1 - blend) + depth * blend);
  }
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
  if (x >= ORIGINAL_COLS + EAST_SHIFT) {
    const distance = x - ORIGINAL_COLS - EAST_SHIFT;
    const blend = Math.min(1, distance / 18);
    const baseDepth = 46 + 6 * Math.sin((x - EAST_SHIFT) * 0.098) + 3 * Math.sin((x - EAST_SHIFT) * 0.27);
    const jungleDepth = 52 + 7 * Math.sin(distance * 0.085 + 0.6) + 3 * Math.sin(distance * 0.23);
    const seabed = Math.round(baseDepth + (jungleDepth - baseDepth) * blend + noise(x, 7) * 2);
    return Math.min(jungleIslandSurface(x), seabed);
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
  if (protectsJungleCave(x, row)) return JUNGLE_DEEPSTONE_ROW;
  return 84 + Math.round(4 * Math.sin((x + ORIGINAL_WEST_EXTENSION) * 0.12));
}

// Blend the first cave's stone into Underground Deepstone over sixty tiles.
// Return null outside the island cave so the ocean and jungle geology stay unchanged.
export function undergroundRockBlendAt(tx, row) {
  const x = tx - WEST_EXTENSION;
  if (x < -51 || x > 177 || (row < OCEAN_ROWS && !protectsIslandCave(x, row))) return null;
  const progress = clamp((row - (ISLAND_DEEPSTONE_ROW - 30)) / 60, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function isDeepstoneAt(tx, row) {
  const blend = undergroundRockBlendAt(tx, row);
  if (blend === null) return row >= deepstoneStartAt(tx, row);
  if (blend <= 0) return false;
  if (blend >= 1) return true;

  // Broad rock patches plus fine grain: avoid a ruler-straight boundary.
  const coarse = noise(Math.floor((tx - WEST_EXTENSION) / 3), Math.floor(row / 3), 411);
  const fine = noise(tx - WEST_EXTENSION, row, 413);
  return coarse * 0.72 + fine * 0.28 < blend;
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

// Deterministic geological clusters in the first dry cave; visual-only stone variants.
export function firstCaveRockVariant(tx, row) {
  const column = tx - WEST_EXTENSION;
  if (column < -51 || column > 177 || row < 30 || row >= ISLAND_DEEPSTONE_ROW - 30) return null;
  if (!protectsIslandCave(column, row) &&
      !isDryIslandCave(column, row) &&
      !isDryIslandCave(column, row - 2) &&
      !isDryIslandCave(column, row + 2)) return null;
  const grain = valueNoise(column, row * 1.08, 8, 723) * 0.73 +
    valueNoise(column, row * 1.08, 3, 731) * 0.27;
  if (grain > 0.77) return 'earth';
  if (grain < 0.31) return 'slate';
  if (grain > 0.65) return 'gravel';
  return 'stone';
}

// Broad, restrained deep-rock bands; only visual, and never in the transition.
export function undergroundRockVariant(tx, row) {
  const column = tx - WEST_EXTENSION;
  if (column < -51 || column > 177 ||
      row < ISLAND_DEEPSTONE_ROW + 30 || row >= ROWS - 2) return null;
  const grain = valueNoise(column, row * 0.9, 11, 819) * 0.78 +
    valueNoise(column, row * 0.9, 4, 821) * 0.22;
  if (grain < 0.28) return 'shale';
  if (grain > 0.72) return 'strata';
  return null;
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
  const onJunglePlateau = Math.abs(x - JUNGLE_ISLAND.center) <= JUNGLE_ISLAND.halfWidth - 6 && ground < WATER_ROW - 1;
  if (depth < 2) return onJunglePlateau ? MATERIAL.soil : (ground < WATER_ROW || noise(x, 2) > 0.3 ? MATERIAL.sand : MATERIAL.reef);
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
  const eastUpper = [258, 308].map(x => x + EAST_SHIFT).map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 1, seed) - 0.5) * 8), ORIGINAL_COLS + EAST_SHIFT + 22, eastMaxX);
    const rx = 18 + Math.round(noise(i + 10, 3, seed) * 7);
    const ry = 9 + Math.round(noise(i + 10, 4, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(62 + noise(i + 10, 2, seed) * 16), Math.max(WATER_ROW + ry + 6, floorClearance), 84);
    return makeChamber(0, x, y, rx, ry);
  });
  const eastMid = [260, 310].map(x => x + EAST_SHIFT).map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 11, seed) - 0.5) * 8), ORIGINAL_COLS + EAST_SHIFT + 22, eastMaxX);
    const rx = 20 + Math.round(noise(i + 10, 13, seed) * 7);
    const ry = 11 + Math.round(noise(i + 10, 14, seed) * 4);
    const floorClearance = groundAt(x + WEST_EXTENSION) + ry + 6;
    const y = clamp(Math.round(98 + noise(i + 10, 12, seed) * 20), floorClearance, 124);
    return makeChamber(1, x, y, rx, ry);
  });
  const eastAbyss = [257, 309].map(x => x + EAST_SHIFT).map((anchorX, i) => {
    const x = clamp(anchorX + Math.round((noise(i + 10, 21, seed) - 0.5) * 8), ORIGINAL_COLS + EAST_SHIFT + 22, eastMaxX);
    const rx = 19 + Math.round(noise(i + 10, 23, seed) * 8);
    const ry = 11 + Math.round(noise(i + 10, 24, seed) * 4);
    const y = clamp(Math.round(140 + noise(i + 10, 22, seed) * 14), 134, OCEAN_ROWS - ry - 6);
    return makeChamber(2, x, y, rx, ry);
  });
  chambers.push(...eastUpper, ...eastMid, ...eastAbyss);

  const eastEntranceZones = [
    { min: 252 + EAST_SHIFT, max: 262 + EAST_SHIFT, target: eastUpper[0] },
    { min: 304 + EAST_SHIFT, max: 314 + EAST_SHIFT, target: eastUpper[1] },
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
    entrances: entrances.filter(e => e.x >= JUNGLE_FADE_START_COLUMN),
    chambers: chambers.filter(c => c.x >= JUNGLE_FADE_START_COLUMN),
    passages: rawPassages.filter(points => points.every(([x]) => x >= JUNGLE_FADE_START_COLUMN)).map(withBounds),
    pillars: pillars.filter(p => p.x >= JUNGLE_FADE_START_COLUMN),
    ventCandidates: ventCandidates.filter(([x]) => x >= JUNGLE_FADE_START_COLUMN),
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

function isProtectedCave(x, y) {
  return protectsIslandCave(x, y) || protectsJungleCave(x, y) || protectsWaterTemple(x, y);
}

function isCarvedAt(tx, ty) {
  if (tx - WEST_EXTENSION < JUNGLE_FADE_START_COLUMN) return false;
  if (ty < WATER_ROW + 4 || ty >= OCEAN_ROWS - 2 || isProtectedCave(tx - WEST_EXTENSION, ty)) return false;
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
    if (x - WEST_EXTENSION < JUNGLE_FADE_START_COLUMN) return;
    if (y < WATER_ROW + 4 || isProtectedCave(x - WEST_EXTENSION, y)) return;
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
      if (x - WEST_EXTENSION < JUNGLE_FADE_START_COLUMN || y <= groundAt(x) + 8 || isProtectedCave(x - WEST_EXTENSION, y)) continue;
      if (caveField(x, y, CAVE_SYSTEM.seed) > 0.76) set(x, y, MATERIAL.air);
    }
  }

  // Stone columns break up the larger chambers and leave swimming room on both sides.
  for (const pillar of CAVE_SYSTEM.pillars) {
    if (!overlaps(pillar, bounds)) continue;
    stamp(pillar.tx, pillar.y, pillar.rx, pillar.ry, 63, (tx, ty) => {
      if (ty > groundAt(tx) + 5 && !isProtectedCave(tx - WEST_EXTENSION, ty)) set(tx, ty, MATERIAL.stone);
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
  for (const x of [...new Set([-151, 229, -210, -275, -315, -330 - WEST_EXTRA, -452 - WEST_EXTRA, -468 - WEST_EXTRA, 300, 365, 420, 490, 560, 625, 690, ...oceanVentColumns])]) {
    const tx = x + WEST_EXTENSION;
    vents.push({ x: (tx + .5) * TILE, y: groundAt(tx) * TILE });
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

// Bring existing Underground deposits to the exposed floor without building obstacles.
// Ore remains flush with the walking surface and continues downward into the rock.
const undergroundFloorShape = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [-1, 1], [1, 2]];
export const exposedUndergroundVeins = (() => {
  const occupied = new Set();
  return islandOreVeins.map(([column, row, count]) => {
    if (row < ISLAND_DEEPSTONE_ROW || row >= 612) return null;
    for (let distance = 0; distance <= 12; distance++) {
      for (const side of distance ? [1, -1] : [1]) {
        const x = column + distance * side;
        for (const dy of [-1, 0, -2, 1, -3, 2, -4, 3, -5, 4, -6, 5, -7, 6]) {
          const y = row + dy;
          const cells = undergroundFloorShape.slice(0, count).map(([dx, depth]) => [x + dx, y + depth]);
          if (![x, x + 1].every((tx) => isDryIslandCave(tx, y - 1) && isDryIslandCave(tx, y - 2))) continue;
          if (!cells.every(([tx, ty]) => !isDryIslandCave(tx, ty) &&
              !isIslandWaterway(tx, ty) && !isDungeonMasonry(tx, ty) && !inRootGrove(tx, ty) &&
              [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => !occupied.has(`${tx + dx},${ty + dz}`)))) continue;
          for (const [tx, ty] of cells) occupied.add(`${tx},${ty}`);
          return cells;
        }
      }
    }
    // Deposits with no safe floor nearby keep their original buried position.
    return null;
  });
})();

// The frame relocations leave these three original deposit sizes intact.
const movedMineVeinSizes = { '-34,112': 6, '29,242': 5, '70,272': 4 };

// Follow the exposed floor out from the frame, then bring part of the seam above ground.
const mineVeins = caveStructures.flatMap(([kind, column, floor], index) => {
  if (!Object.hasOwn(mineDecks, kind) || floor >= ISLAND_DEEPSTONE_ROW || inRootGrove(column, floor)) return [];
  let originalSize = movedMineVeinSizes[`${column},${floor}`];
  const firstOffset = kind === 'trestle' || originalSize === 6 ? 2 : 5;
  let originalFloor;
  const direction = index % 2 ? -1 : 1;
  for (const side of [direction, -direction]) {
    for (let offset = firstOffset; offset <= 10; offset++) {
      const x = column + offset * side;
      for (const rise of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]) {
        const y = floor + rise;
        const cells = [[x, y], [x, y + 1], [x + side, y + 1], [x + side, y], [x + 2 * side, y], [x + 2 * side, y - 1]]
          .filter(([tx, ty]) => !isDryIslandCave(tx, ty) && !inRootGrove(tx, ty));
        const count = originalSize ?? cells.length;
        if (isDryIslandCave(x, y - 1) && cells[0]?.[0] === x && cells[0][1] === y && count >= 4 && cells.length >= count) {
          const height = 1 + index % 2;
          const raised = Array.from({ length: height }, (_, i) => [x, y - 1 - i]);
          if (!raised.every(([tx, ty]) => isDryIslandCave(tx, ty))) continue;
          originalSize ??= count;
          originalFloor ??= y;
          if (y !== originalFloor) continue;
          const crest = y - height - 1;
          // Leave room to jump across the taller deposits, even under a ledge.
          if ([-1, 0, 1].some((dx) => !isDryIslandCave(x + dx, crest - 1) || !isDryIslandCave(x + dx, crest - 2))) continue;
          const steps = height === 2 ? [-1, 1].flatMap((dx) => [[x + dx, y - 1], [x + dx, y]]
            .filter(([tx, ty]) => isDryIslandCave(tx, ty))) : [];
          return [{ cells: [...cells.slice(0, count - height), ...raised].map(([tx, ty]) => [tx, ty - 1]), steps,
            material: floor >= 83 && index % 3 === 0 ? MATERIAL.iron : MATERIAL.copper }];
        }
      }
    }
  }
  return [];
});

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
        if (isProtectedCave(x - WEST_EXTENSION, y)) continue;
        const count = 3 + Math.floor(noise(column, row, seed + 2) * 5);
        writeVein(get, set, bounds, x, y, count, material, column % 2 ? 1 : -1);
      }
    }
  }
  for (const [index, [x, y, count, material = MATERIAL.iron]] of islandOreVeins.entries()) {
    if (exposedUndergroundVeins[index]) continue;
    if (!inRootGrove(x, y) && y + 1 >= bounds.top && y - 1 <= bounds.bottom) writeVein(get, set, bounds, x + WEST_EXTENSION, y, count, material);
  }
  for (const [index, cells] of exposedUndergroundVeins.entries()) {
    if (!cells) continue;
    const material = islandOreVeins[index][3] ?? MATERIAL.iron;
    for (const [column, y] of cells) {
      const x = column + WEST_EXTENSION;
      if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom &&
          get(x, y) === MATERIAL.stone) set(x, y, material);
    }
  }
  for (const { steps } of mineVeins) {
    for (const [column, y] of steps) {
      const x = column + WEST_EXTENSION;
      if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom && get(x, y) === MATERIAL.air) {
        set(x, y, MATERIAL.stone);
      }
    }
  }
  for (const { cells, material } of mineVeins) {
    for (const [column, y] of cells) {
      const x = column + WEST_EXTENSION;
      if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom && (get(x, y) === MATERIAL.stone || get(x, y) === MATERIAL.air)) {
        set(x, y, material);
      }
    }
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
  carveJungleCave((x, y, wet) => {
    set(x, y, MATERIAL.air);
    flooded[index(x, y)] = Number(wet);
  }, geology, WEST_EXTENSION);
  placeShipwreck(set, geology, WEST_EXTENSION);
  applyOres(get, set, bounds);
  for (let x = bounds.left; x <= bounds.right; x++) {
    for (let y = Math.max(bounds.top, 80); y <= bounds.bottom; y++) {
      if (isDeepstoneAt(x, y) && get(x, y) === MATERIAL.stone) set(x, y, MATERIAL.deepstone);
    }
  }
  placeWaterTemple(set, bounds, WEST_EXTENSION);

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
    ...shipwreckCaches.map(cache => ({ ...cache, lootArea: 'Western shipwreck' })),
    { id: 'wreck-cache', name: 'Reef cache', lootArea: 'Reef', column: 154, floor: groundAt(154 + WEST_EXTENSION), resource: 'wood', amount: 8 },
    ...islandCaches.map(([id, name, column, floor, resource, amount, bonusLoot]) => ({ id, name, column, floor, resource, amount, bonusLoot, lootArea: 'Island cave' })),
    { id: 'western-grotto-cache', name: 'Grotto cache', lootArea: 'Western grotto', column: -151, floor: groundAt(-151 + WEST_EXTENSION), resource: 'kelp', amount: 2 },
    { id: 'deep-cave-cache', name: 'Deep cave cache', lootArea: 'Deep cave', column: 229, floor: groundAt(229 + WEST_EXTENSION), resource: 'iron', amount: 3 },
    { id: 'jungle-trench-cache', name: 'Jungle trench cache', lootArea: 'Jungle trench', column: 288 + EAST_SHIFT, floor: groundAt(288 + EAST_SHIFT + WEST_EXTENSION), resource: 'cobalt', amount: 3 },
    { ...jungleVillageCache, lootArea: 'Jungle village' },
    ...jungleCaveCaches.map(cache => ({ ...cache, lootArea: 'Jungle cave' })),
  ].map(({ id, name, column, floor, resource, amount, bonusLoot, lootArea }) => ({
    id, name, kind: 'chest', lootArea, loot: { id: resource, count: amount }, bonusLoot,
    x: (column + WEST_EXTENSION + .5) * TILE, y: floor * TILE - 8,
  }));
  items.push(...firstCaveWildChestSpots.map(([id, column, floor]) => createWildChest({
    id, x: (column + WEST_EXTENSION + .5) * TILE, y: floor * TILE - 8,
    lootTable: 'first-cave',
  })));
  items.push({
    id: SNORKEL_CHEST_ID, name: 'Wreck chest', kind: 'chest', lootArea: 'Reef wreck',
    loot: { id: COPPER_SNORKEL.id, count: 1 },
    x: wreckChestColumn * TILE + 8, y: groundAt(wreckChestColumn) * TILE - 8,
  });
  // Preserve saved kelp IDs where the seabed has shifted near cave openings.
  const kelpLocations = [[-105], [-100], [-57, -59], [-50], [-46], [34], [41], [76], [79], [84], [91, 89], [96], [104], [114], [127, 123], [132, 133], [144], [236], [248], [264], [282], [300], [320], [406], [418]];
  for (const [id, column = id] of kelpLocations) {
    const tx = column + (column >= ORIGINAL_COLS ? EAST_SHIFT : 0) + WEST_EXTENSION;
    const ty = groundAt(tx);
    items.push({ id: 'kelp-' + id, kind: 'kelp', amount: 1, tx, ty, x: (tx + .5) * TILE, y: ty * TILE - 12 });
  }

  for (const [index, ruin] of CORAL_RUINS.entries()) {
    const tx = ruin.column + WEST_EXTENSION;
    const floorY = groundAt(tx) * TILE;
    items.push({ ...ruin, id: 'coral-ruin-' + index, kind: 'coral-ruin', variant: index % 3,
      x: (tx + .5) * TILE, y: floorY - 32, floorY,
      leftFloorY: groundAt(tx - 2) * TILE, rightFloorY: groundAt(tx + 2) * TILE });
  }
  items.push(...oceanLandmarks({ groundAt, westExtension: WEST_EXTENSION, tile: TILE }));
  for (const dial of CORAL_DIALS) {
    const tx = dial.column + WEST_EXTENSION;
    items.push({ ...dial, kind: 'coral-dial', x: (tx + .5) * TILE,
      y: (dial.row + .5) * TILE, floorY: groundAt(tx) * TILE });
  }
  return items;
}

export function buildTree(id, kind, tx, ty, height, direction) {
  const isJungle = kind === 'jungle';
  const x = tx * TILE + (isJungle ? 8 : 7);
  const y = ty * TILE;
  const trunk = [];
  for (let rise = 0; rise < height; rise += 2) {
    const lean = isJungle
      ? Math.round(Math.sin((rise / height) * Math.PI) * 3) * direction
      : Math.floor(Math.pow(rise / height, 1.7) * 14) * direction;
    trunk.push({ x: x + lean - (isJungle ? 4 : 3), y: y - rise - 2, width: isJungle ? (rise > height * 0.72 ? 6 : 8) : (rise > height * .68 ? 4 : 6) });
  }
  return isJungle ? { id, kind: 'jungle', tx, ty, x, y, height, direction, trunk } : { id, tx, ty, x, y, height, direction, trunk };
}

export function generateTrees() {
  const palms = [[49, 61, -1], [52, 46, 1], [58, 69, 1], [62, 48, -1]].map(([column, height, direction]) => {
    const tx = column + WEST_EXTENSION;
    return buildTree('palm-' + column, 'palm', tx, groundAt(tx), height, direction);
  });
  const jungle = jungleTreeSpecs.map(([column, height, direction]) => {
    const tx = column + WEST_EXTENSION;
    return buildTree('jungle-' + column, 'jungle', tx, groundAt(tx), height, direction);
  });
  return [...palms, ...jungle];
}

function chamberMobSpot(chamber) {
  const pillar = CAVE_SYSTEM.pillars.find((p) => Math.abs(p.x - chamber.x) <= chamber.rx && Math.abs(p.y - chamber.y) <= chamber.ry);
  const offset = pillar ? (pillar.x >= chamber.x ? -Math.min(7, chamber.rx - 5) : Math.min(7, chamber.rx - 5)) : 0;
  return { x: (chamber.x + offset) * TILE, y: (chamber.y - 1) * TILE };
}

function lionfishChamberSpot(chamber) {
  const spot = chamberMobSpot(chamber);
  const minY = (WATER_ROW + 20) * TILE;
  const maxY = (WATER_ROW + 80) * TILE;
  // Hover slightly toward chamber ceiling while staying safely inside 20m..80m depth.
  return { x: spot.x, y: clamp(spot.y - Math.max(2, chamber.ry - 5) * TILE, minY, maxY) };
}

export function generateMobs() {
  const caveFish = chamberMobSpot(CAVE_SYSTEM.chambers[0]);
  const caveSquid = chamberMobSpot(CAVE_SYSTEM.chambers[2]);
  const greenWestX = JUNGLE_FADE_START_COLUMN + 18;
  const greenMidX = JUNGLE_FADE_START_COLUMN + 46;
  const greenDeepX = JUNGLE_FADE_START_COLUMN + 82;
  const greenEastX = JUNGLE_ISLAND.center + JUNGLE_ISLAND.halfWidth + 16;
  const greenFarEastX = JUNGLE_ISLAND.center + JUNGLE_ISLAND.halfWidth + 26;
  const lionGreenWest = { x: greenWestX * TILE, y: Math.max((WATER_ROW + 22) * TILE, (groundAt(greenWestX + WEST_EXTENSION) - 6) * TILE) };
  const lionGreenMid = { x: greenMidX * TILE, y: Math.max((WATER_ROW + 22) * TILE, (groundAt(greenMidX + WEST_EXTENSION) - 6) * TILE) };
  const lionGreenDeep = { x: greenDeepX * TILE, y: Math.max((WATER_ROW + 24) * TILE, (groundAt(greenDeepX + WEST_EXTENSION) - 7) * TILE) };
  const lionGreenGrottoWest = lionfishChamberSpot(CAVE_SYSTEM.chambers[0]);
  const lionGreenGrottoEast = lionfishChamberSpot(CAVE_SYSTEM.chambers[1]);
  const lionGreenEast = { x: greenEastX * TILE, y: Math.max((WATER_ROW + 22) * TILE, (groundAt(greenEastX + WEST_EXTENSION) - 6) * TILE) };
  const lionGreenFarEast = { x: greenFarEastX * TILE, y: Math.max((WATER_ROW + 22) * TILE, (groundAt(greenFarEastX + WEST_EXTENSION) - 6) * TILE) };
  // Schools occupy open water on both sides of the island.
  const schoolSites = [-310, -266, -223, -179, -134, -91, -46, 25, 87, 150,
    ...[.20, .43, .66, .87].map(f => Math.round(150 + (KRAKEN_COLUMN - 150) * f)),
    JUNGLE_FADE_START_COLUMN + 32, JUNGLE_FADE_START_COLUMN + 66];
  const schools = schoolSites.flatMap((column, school) => {
    const floor = Math.min(...[-5, -3, 0, 3, 5].map(dx => groundAt(column + dx + WEST_EXTENSION)));
    const row = Math.min(floor - 4, WATER_ROW + 5 + Math.floor(noise(school, 0, 711) * 17));
    if (row < WATER_ROW + 4) return [];
    const count = 5 + Math.floor(noise(school, 0, 712) * 4);
    const phase = noise(school, 0, 713) * Math.PI * 2;
    const speed = 27 + noise(school, 0, 714) * 12;
    return Array.from({ length: count }, (_, member) => {
      const offsetX = (member % 4 - 1.5) * 16 + (member >= 4 ? 7 : 0);
      const offsetY = (member >= 4 ? 10 : -8) + (noise(school, member, 715) - .5) * 8;
      return {
        id: 'fish-school-' + school + '-' + member, kind: 'fish',
        schoolId: 'school-' + school, schoolPhase: phase,
        schoolX: (column + WEST_EXTENSION) * TILE, schoolY: row * TILE,
        schoolOffsetX: offsetX, schoolOffsetY: offsetY,
        x: column * TILE + offsetX, y: row * TILE + offsetY,
        span: 85 + noise(school, 0, 716) * 40, speed,
        variant: (school + (member % 4 === 3 ? 1 : 0)) % 8,
        fishPattern: (school + member % 3) % 4,
        fishScale: .75 + noise(school, member, 717) * .55,
        phase: phase + member * .71,
      };
    });
  });
  return [
    ...MERMAIDS.map(({ id, column, row }, index) => ({
      id, kind: 'mermaid', x: (column + .5) * TILE, y: row * TILE,
      phase: index * 1.8, respawnDelay: 45,
    })),
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
    { id: 'puffer-west', kind: 'pufferfish', x: 28 * TILE, y: 21 * TILE, span: 28, speed: 18, phase: 0.9, respawnDelay: 40 },
    { id: 'puffer-reef', kind: 'pufferfish', x: 89 * TILE, y: 22 * TILE, span: 30, speed: 18, phase: 2.6, respawnDelay: 40 },
    { id: 'puffer-east', kind: 'pufferfish', x: 126 * TILE, y: 27 * TILE, span: 32, speed: 18, phase: 4.1, respawnDelay: 40 },
    { id: 'squid-channel', kind: 'squid', x: 102 * TILE, y: 25 * TILE, span: 58, speed: 48, phase: 2.2 },
    { id: 'squid-deep', kind: 'squid', x: caveSquid.x, y: caveSquid.y - 4 * TILE, span: 68, speed: 54, phase: 5.1 },
    { id: 'shark-west', kind: 'shark', x: 19 * TILE, y: 23 * TILE, span: 84, speed: 58, phase: 0.2 },
    { id: 'shark-deep', kind: 'shark', x: 146 * TILE, y: 33 * TILE, span: 104, speed: 66, phase: 2.9 },
    { id: 'lionfish-green-west', kind: 'lionfish', x: lionGreenWest.x, y: lionGreenWest.y, span: 28, speed: 22, phase: 0.5, respawnDelay: 45 },
    { id: 'lionfish-green-mid', kind: 'lionfish', x: lionGreenMid.x, y: lionGreenMid.y, span: 30, speed: 22, phase: 1.4, respawnDelay: 45 },
    { id: 'lionfish-green-deep', kind: 'lionfish', x: lionGreenDeep.x, y: lionGreenDeep.y, span: 34, speed: 22, phase: 2.3, respawnDelay: 45 },
    { id: 'lionfish-green-grotto-west', kind: 'lionfish', x: lionGreenGrottoWest.x, y: lionGreenGrottoWest.y, span: 32, speed: 20, phase: 3.1, respawnDelay: 45 },
    { id: 'lionfish-green-grotto-east', kind: 'lionfish', x: lionGreenGrottoEast.x, y: lionGreenGrottoEast.y, span: 32, speed: 22, phase: 4.0, respawnDelay: 45 },
    { id: 'lionfish-green-east', kind: 'lionfish', x: lionGreenEast.x, y: lionGreenEast.y, span: 30, speed: 22, phase: 4.9, respawnDelay: 45 },
    { id: 'lionfish-green-far-east', kind: 'lionfish', x: lionGreenFarEast.x, y: lionGreenFarEast.y, span: 28, speed: 20, phase: 5.7, respawnDelay: 45 },
    ...islandMobs.filter(([, , column, floor]) => !inRootGrove(column, floor - 1)).map(([id, kind, column, floor, respawnDelay], index) => ({
      id, kind, x: (column + .5) * TILE, y: floor * TILE, respawnDelay: floor <= ISLAND_DEEPSTONE_ROW ? Math.round(15 + 28 * clamp((WATER_ROW + 40 - floor) / (WATER_ROW + 40 - ISLAND_CAVE.campFloor), 0, 1)) : respawnDelay, phase: index * .7,
    })),
    ...jungleMobs.map(([id, kind, column, floor, respawnDelay], index) => ({
      id, kind, dayKind: kind, x: (column + .5) * TILE, y: floor * TILE, respawnDelay, phase: index * .9,
    })),
    ...jungleCaveMobs.map(([id, kind, column, floor, respawnDelay], index) => ({
      id, kind, x: (column + .5) * TILE, y: floor * TILE, respawnDelay, phase: index * .7,
      praying: true,
    })),
    ...shipwreckGhosts.map(({ id, column, row, phase, resident = false }) => ({
      id, kind: 'ghost', x: (column + .5) * TILE, y: (row + .5) * TILE, phase, resident, spawnCheckIn: 0,
    })),
    { id: 'fish-western-wreck', kind: 'fish', x: (shipwreckOrigin.column + 23) * TILE, y: (shipwreckOrigin.row + 12) * TILE, span: 72, speed: 28, variant: 1, phase: 3.5 },
    ...schools,
    { id: 'kraken-east', kind: 'kraken', x: KRAKEN_COLUMN * TILE, y: 40 * TILE, span: 0, speed: 0, phase: 0, respawnDelay: 120 },
  ].map((mob, index) => {
    const x = mob.x + WEST_EXTENSION * TILE;
    const y = mob.kind === 'crab' ? groundAt(Math.floor(x / TILE)) * TILE : mob.y;
    const maxHealth = mob.kind === 'ghost' && mob.resident ? 12 : MOB_HEALTH[mob.kind] ?? 2;
    return {
      ...mob,
      x,
      y,
      homeX: x,
      homeY: y,
      dx: 0,
      dy: 0,
      facing: mob.schoolId ? (Math.cos(mob.schoolPhase) >= 0 ? 1 : -1) : mob.kind === 'kraken' ? -1 : mob.kind === 'mimic' ? 1 : mob.kind === 'frog' ? (x <= (JUNGLE_CAVE.idolColumn + WEST_EXTENSION + 0.5) * TILE ? 1 : -1) : index % 2 ? -1 : 1,
      grounded: mob.kind === 'crab' || mob.kind === 'mimic',
      awakened: false,
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
