import { CORAL_OPEN_ID, coralWallColumn } from "./world/ocean-layout.js";
import { shipwreckSkeletons } from './world/shipwreck.js';
import { caveClimbs, caveStructures, islandTraps, mineDecks } from './world/island-cave.js';
import { jungleCaveClimbs, jungleCaveStructures, jungleCaveTraps } from './world/jungle-cave.js';
import { MATERIAL, MATERIAL_IDS } from './content.js';
import { DAY_CYCLE_SECONDS } from './environment.js';
import { COLS, ROWS, TILE, WATER_ROW, WEST_EXTENSION, buildTree, generateCaveMushrooms, generateChunk, generateFixtures, generateMobs, generateTrees, generateVents, groundAt } from './world/generation.js';
import { OVERWORLD_ZONE, createOverworldTempleDoors } from './world/water-temple-interior.js';

export const ISLAND_TENT_ID = 'island-tent';
export const CHUNK_SIZE = 32;
export const TILE_NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function worldCols(world) {
  return world?.cols ?? COLS;
}

export function worldRows(world) {
  return world?.rows ?? ROWS;
}

export function worldWaterRow(world) {
  return world?.waterRow ?? WATER_ROW;
}
// The finite world contains at most ceil(COLS / 32) * ceil(ROWS / 32) chunks.
// Keep generated chunks: distant enemy simulation otherwise continuously evicts
// terrain needed by the next update. Tiles and flood masks together use ~0.75 MiB.
let vents;

function baseVents() {
  if (!vents) {
    const baseline = { chunks: new Map(), edits: new Map() };
    vents = generateVents((x, y) => tileAt(baseline, x, y));
  }
  return vents;
}

function chunkKey(cx, cy) {
  return cx + ',' + cy;
}

function offset(tx, ty) {
  return (ty % CHUNK_SIZE) * CHUNK_SIZE + tx % CHUNK_SIZE;
}

export function createWorld() {
  const items = generateFixtures();
  const trees = generateTrees();
  const structures = [...caveStructures, ...jungleCaveStructures, ...shipwreckSkeletons].map(([kind, column, floor]) => ({ kind, tx: column + WEST_EXTENSION, floor }));
  return {
    zone: OVERWORLD_ZONE,
    items, trees, saplings: [], plantedTrees: [], caveMushrooms: generateCaveMushrooms(), doors: new Map(), tent: null,
    templeDoors: createOverworldTempleDoors(),
    mobs: generateMobs(),
    krakenDefeated: false,
    jungleCultAggro: false,
    caveTraps: [...islandTraps, ...jungleCaveTraps].map(([kind, column, ty], index) => ({
      kind, tx: column + WEST_EXTENSION, ty, phase: index * .76, timer: 0, state: 'armed',
    })),
    caveClimbs: [...caveClimbs, ...jungleCaveClimbs].map(([column, top, bottom, kind]) => ({ tx: column + WEST_EXTENSION, top, bottom, kind })),
    caveStructures: structures,
    mineDecks: structures.filter(({ kind }) => Object.hasOwn(mineDecks, kind)),
    projectiles: [],
    get vents() { return baseVents(); },
    fixtureIds: new Set([CORAL_OPEN_ID, ISLAND_TENT_ID, ...[...items, ...trees].map(({ id }) => id)]),
    harvested: new Set(),
    pendingWreckLoot: new Map(),
    chunks: new Map(),
    edits: new Map(),
    recentChunk: null,
  };
}

function getChunk(world, cx, cy) {
  if (world.recentChunk?.cx === cx && world.recentChunk.cy === cy) return world.recentChunk;
  const key = chunkKey(cx, cy);
  let chunk = world.chunks.get(key);
  if (!chunk) {
    const { tiles, flooded } = generateChunk(cx * CHUNK_SIZE, cy * CHUNK_SIZE, CHUNK_SIZE);
    for (const [index, material] of world.edits.get(key) ?? []) tiles[index] = material;
    chunk = { cx, cy, tiles, flooded };
    world.chunks.set(key, chunk);
  }
  world.recentChunk = chunk;
  return chunk;
}

export function tileAt(world, tx, ty) {
  if (world?.grid) {
    if (tx < 0 || tx >= world.cols || ty < 0 || ty >= world.rows) return MATERIAL.bedrock;
    return world.grid[ty * world.cols + tx];
  }
  if (coralWallColumn(tx - WEST_EXTENSION) && !world.harvested?.has(CORAL_OPEN_ID)) return MATERIAL.bedrock;
  if (tx < 0 || tx >= COLS || ty >= ROWS) return MATERIAL.bedrock;
  if (ty < 0) return MATERIAL.air;
  const chunk = getChunk(world, Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE));
  return chunk.tiles[offset(tx, ty)];
}

export function waterTileAt(world, tx, ty) {
  if (world?.grid) {
    if (tx < 0 || tx >= world.cols || ty < 0 || ty >= world.rows) return false;
    const index = ty * world.cols + tx;
    return world.flooded[index] === 1 && world.grid[index] === MATERIAL.air;
  }
  if (coralWallColumn(tx - WEST_EXTENSION) && !world.harvested?.has(CORAL_OPEN_ID)) return false;
  if (tx < 0 || tx >= COLS || ty < WATER_ROW || ty >= ROWS) return false;
  const { tiles, flooded } = getChunk(world, Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE));
  const index = offset(tx, ty);
  return flooded[index] === 1 && tiles[index] === MATERIAL.air;
}

export function hasExposedCaveFloor(world, { tx, floor }) {
  return !tileAt(world, tx, floor - 1) && tileAt(world, tx, floor) !== MATERIAL.air;
}

export function inWater(world, x, y) {
  return waterTileAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function doorAt(world, tx, ty) {
  if (tx < 0 || tx >= worldCols(world) || ty < 0 || ty >= worldRows(world) - 2) return;
  return world.doors.get(chunkKey(tx, ty)) ?? world.doors.get(chunkKey(tx, ty + 1));
}

export function isDoorOpen(door, x, y, height) {
  const center = (door.tx + .5) * TILE;
  const top = (door.ty - 1) * TILE;
  return Math.abs(x - center) <= 1.5 * TILE && y + height > top && y < top + 2 * TILE;
}

export function activeTent(world) {
  if (world.tent && tileAt(world, world.tent.tx, world.tent.ty + 1)) {
    return { tx: world.tent.tx, ty: world.tent.ty, placed: true, id: 'placed-tent' };
  }
  if (!world.harvested?.has(ISLAND_TENT_ID)) {
    const tx = 53 + WEST_EXTENSION;
    const floor = groundAt(tx);
    if (tileAt(world, tx, floor)) return { tx, ty: floor - 1, placed: false, id: ISLAND_TENT_ID };
  }
  return null;
}

export function tentAt(world, tx, ty) {
  const tent = activeTent(world);
  if (!tent) return null;
  return (tx === tent.tx || tx === tent.tx + 1) && (ty === tent.ty || ty === tent.ty - 1) ? tent : null;
}

export function buildCellFree(world, tx, ty) {
  return tx >= 0 && tx < worldCols(world) && ty >= 0 && ty < worldRows(world) - 2
    && !tileAt(world, tx, ty) && !doorAt(world, tx, ty) && !tentAt(world, tx, ty) && !treeAt(world, tx, ty) && !saplingAt(world, tx, ty)
    && !world.items.some((item) => (item.kind === 'chest' || !world.harvested.has(item.id))
      && Math.floor(item.x / TILE) === tx && Math.floor(item.y / TILE) === ty);
}

export function placeDoor(world, tx, ty) {
  if (!buildCellFree(world, tx, ty) || !buildCellFree(world, tx, ty - 1) || !tileAt(world, tx, ty + 1)) return false;
  setDoor(world, tx, ty, true);
  return true;
}


export function setDoor(world, tx, ty, exists) {
  const key = chunkKey(tx, ty);
  if (exists) world.doors.set(key, { tx, ty });
  else world.doors.delete(key);
}

export function solidAt(world, tx, ty, viewer) {
  if (tileAt(world, tx, ty)) return true;
  const door = doorAt(world, tx, ty);
  return Boolean(door && (!viewer || !isDoorOpen(door, viewer.x, viewer.y, viewer.height)));
}

export function hasOpenFace(world, tx, ty, viewer) {
  return TILE_NEIGHBORS.some(([dx, dy]) => !solidAt(world, tx + dx, ty + dy, viewer));
}

export function isTreeStanding(world, tree) {
  return !world.harvested.has(tree.id);
}

export function treeAt(world, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  return world.trees.find((tree) => isTreeStanding(world, tree) && tree.trunk.some((strip) =>
    strip.x < x + TILE && strip.x + strip.width > x && strip.y < y + TILE && strip.y + 2 > y
  ));
}

export function rootedTreeAt(world, tx, ty) {
  return world.trees.find((tree) => tree.tx === tx && tree.ty === ty && isTreeStanding(world, tree));
}

export function saplingAt(world, tx, ty) {
  return world.saplings?.find((sapling) => sapling.tx === tx && sapling.ty === ty) ?? null;
}

export function plantSapling(world, tx, ty, kind, plantedAt) {
  const sapling = { id: `sapling-${tx}-${ty}-${Math.round(plantedAt * 100)}`, tx, ty, kind, plantedAt };
  (world.saplings ??= []).push(sapling);
  return sapling;
}

export function canGrowSapling(world, sapling, worldTime) {
  if (!sapling || worldTime - sapling.plantedAt < 2 * DAY_CYCLE_SECONDS) return false;
  if (sapling.ty > WATER_ROW || waterTileAt(world, sapling.tx, sapling.ty)) return false;
  const ground = tileAt(world, sapling.tx, sapling.ty + 1);
  if (ground !== MATERIAL.sand && ground !== MATERIAL.soil) return false;
  for (let y = 0; y < sapling.ty; y++) {
    if (tileAt(world, sapling.tx, y)) return false;
  }
  return true;
}

export function stepSaplings(world, worldTime) {
  if (!world.saplings?.length) return false;
  let changed = false;
  const remaining = [];
  for (const sapling of world.saplings) {
    const ground = tileAt(world, sapling.tx, sapling.ty + 1);
    if (ground !== MATERIAL.sand && ground !== MATERIAL.soil || tileAt(world, sapling.tx, sapling.ty)) {
      changed = true;
      continue;
    }
    if (canGrowSapling(world, sapling, worldTime)) {
      const direction = (sapling.tx % 2 === 0 ? 1 : -1);
      const height = sapling.kind === 'jungle' ? 68 + (sapling.tx % 3) * 8 : 48 + (sapling.tx % 3) * 8;
      const tree = buildTree(`planted-${sapling.id}`, sapling.kind, sapling.tx, sapling.ty, height, direction);
      world.trees.push(tree);
      (world.plantedTrees ??= []).push(tree);
      world.fixtureIds.add(tree.id);
      changed = true;
      continue;
    }
    remaining.push(sapling);
  }
  if (changed) world.saplings = remaining;
  return changed;
}

export function rootedKelpAt(world, tx, ty) {
  return world.items.find((item) => item.kind === 'kelp' && item.tx === tx && item.ty === ty && !world.harvested.has(item.id));
}

export function kelpAt(world, x, ty) {
  return world.items.find((item) => item.kind === 'kelp' && !world.harvested.has(item.id) && (
    (ty === item.ty - 1 && Math.abs(x - item.x) < TILE / 2) ||
    (ty === item.ty - 2 && Math.abs(x - item.x) < TILE)
  ));
}

export function isEditableTile(tx, ty) {
  return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS - 2;
}

export function hasTileEdit(world, tx, ty) {
  return world.edits.get(chunkKey(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE)))?.has(offset(tx, ty)) ?? false;
}

export function editTile(world, tx, ty, material) {
  if (world?.immutableTerrain) return false;
  if (!isEditableTile(tx, ty) || (!Number.isInteger(material) || !MATERIAL_IDS[material]) || (material === MATERIAL.bedrock || material === MATERIAL.door)) return false;
  const cx = Math.floor(tx / CHUNK_SIZE);
  const cy = Math.floor(ty / CHUNK_SIZE);
  const index = offset(tx, ty);
  const key = chunkKey(cx, cy);
  const edits = world.edits.get(key) ?? new Map();
  edits.set(index, material);
  world.edits.set(key, edits);
  const cached = world.chunks.get(key);
  if (cached) cached.tiles[index] = material;
  const uprooted = material === MATERIAL.air && rootedKelpAt(world, tx, ty);
  if (uprooted) world.harvested.add(uprooted.id);
  const felledTree = material === MATERIAL.air && rootedTreeAt(world, tx, ty);
  if (felledTree) world.harvested.add(felledTree.id);
  return true;
}

export function* editedTiles(world) {
  for (const [key, edits] of world.edits) {
    const [cx, cy] = key.split(',').map(Number);
    for (const [index, material] of edits) {
      yield [cx * CHUNK_SIZE + index % CHUNK_SIZE, cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE), material];
    }
  }
}
