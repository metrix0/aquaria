import { shipwreckSkeletons } from './world/shipwreck.js';
import { caveClimbs, caveStructures, islandTraps, mineDecks } from './world/island-cave.js';
import { jungleCaveClimbs, jungleCaveStructures, jungleCaveTraps } from './world/jungle-cave.js';
import { MATERIAL, MATERIAL_IDS } from './content.js';
import { COLS, ROWS, TILE, WATER_ROW, WEST_EXTENSION, generateCaveMushrooms, generateChunk, generateFixtures, generateMobs, generateTrees, generateVents } from './world/generation.js';

export const CHUNK_SIZE = 32;
export const TILE_NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const CACHE_LIMIT = 64;
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
    items, trees, caveMushrooms: generateCaveMushrooms(), doors: new Map(),
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
    fixtureIds: new Set([...items, ...trees].map(({ id }) => id)),
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
    if (world.chunks.size >= CACHE_LIMIT) world.chunks.delete(world.chunks.keys().next().value);
    world.chunks.set(key, chunk);
  }
  world.recentChunk = chunk;
  return chunk;
}

export function tileAt(world, tx, ty) {
  if (tx < 0 || tx >= COLS || ty >= ROWS) return MATERIAL.bedrock;
  if (ty < 0) return MATERIAL.air;
  const chunk = getChunk(world, Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE));
  return chunk.tiles[offset(tx, ty)];
}

export function waterTileAt(world, tx, ty) {
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
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  return world.doors.get(chunkKey(tx, ty)) ?? world.doors.get(chunkKey(tx, ty + 1));
}

export function isDoorOpen(door, x, y, height) {
  const center = (door.tx + .5) * TILE;
  const top = (door.ty - 1) * TILE;
  return Math.abs(x - center) <= 1.5 * TILE && y + height > top && y < top + 2 * TILE;
}

export function buildCellFree(world, tx, ty) {
  return tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS - 2
    && !tileAt(world, tx, ty) && !doorAt(world, tx, ty) && !treeAt(world, tx, ty)
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
