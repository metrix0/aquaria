import { AIR_TANK, ARMOR, MATERIAL, MATERIAL_IDS, REINFORCED_HELMET, SWIMMING_HELMET } from './content.js';
import { CRAWL_HEIGHT } from './gameplay/player.js';
import { editedTiles, isEditableTile } from './world.js';
import { TILE, WEST_EXTENSION, WORLD_VERSION } from './world/generation.js';

export const SAVE_FORMAT = 3;
const LEGACY_WIDTH = 224;
const LEGACY_EDIT_ROWS = 98;
const LEGACY_MATERIAL_IDS = ['air', 'sand', 'stone', 'reef', null, 'wood', 'bedrock', 'soil', 'copper', 'iron', 'cobalt'];

function decodedEdit(entry, format) {
  if (!Array.isArray(entry)) return;
  let [x, y, id] = entry;
  if (format === 1) {
    if (!Number.isInteger(x) || x < 0 || x >= LEGACY_WIDTH * LEGACY_EDIT_ROWS) return;
    id = LEGACY_MATERIAL_IDS[y];
    y = Math.floor(x / LEGACY_WIDTH);
    x %= LEGACY_WIDTH;
  }
  if (format === 2) id = LEGACY_MATERIAL_IDS[id];
  if (!Number.isInteger(x)) return;
  x += WEST_EXTENSION;
  if (!isEditableTile(x, y) || typeof id !== 'string' || !Object.hasOwn(MATERIAL, id) || (id === 'bedrock' || id === 'door')) return;
  return [x, y, MATERIAL[id]];
}

export function decodeSave(data) {
  const legacy = data?.format === 1 || (data?.format === 2 && !data.world);
  if (!legacy && (data?.format !== SAVE_FORMAT || data.world?.generator !== WORLD_VERSION)) return null;
  const world = legacy ? data : data.world;
  const edits = Array.isArray(world.edits) ? world.edits.map((entry) => decodedEdit(entry, data.format)).filter(Boolean) : [];
  const doors = Array.isArray(world.doors) ? world.doors.filter((entry) => Array.isArray(entry) &&
    Number.isInteger(entry[0]) && isEditableTile(entry[0] + WEST_EXTENSION, entry[1]))
    .map(([x, y]) => [x + WEST_EXTENSION, y]) : [];
  const player = legacy ? data : data.player;
  const harvested = Array.isArray(world.harvested) ? world.harvested : [];
  return {
    inventory: data.inventory,
    appearance: data.appearance,
    armor: Object.hasOwn(ARMOR, player?.armor) ? player.armor : null,
    worldTime: Number.isFinite(data.worldTime) && data.worldTime >= 0 ? data.worldTime : 0,
    weatherSeed: Number.isInteger(data.weatherSeed) && data.weatherSeed >= 0 && data.weatherSeed < 0x80000000 ? data.weatherSeed : undefined,
    player: {
      x: player?.x + WEST_EXTENSION * TILE, y: player?.y,
      health: player?.health, oxygen: player?.oxygen, crawling: player?.crawling === true,
    },
    progress: {
      reinforcedHelmet: data.progress?.[REINFORCED_HELMET.id] === true,
      airTank: (legacy ? data.tank : data.progress?.[AIR_TANK.id]) === true,
      swimmingHelmet: (legacy ? data.helmet : data.progress?.[SWIMMING_HELMET.id]) === true ||
        harvested.includes(SWIMMING_HELMET.chestId) || harvested.includes('shore-chest'),
    },
    world: { edits, doors, harvested, chests: world.chests },
  };
}

export function encodeSave(game, saveTerrain = true) {
  const { player, inventory, progress, world } = game;
  const edits = saveTerrain ? Array.from(editedTiles(world), ([x, y, material]) => [x - WEST_EXTENSION, y, MATERIAL_IDS[material]]) : [];
  const doors = saveTerrain ? Array.from(world.doors.values(), ({ tx, ty }) => [tx - WEST_EXTENSION, ty]) : [];
  const { x, y, height } = player.flightOrigin ?? player;
  const position = { x: x - WEST_EXTENSION * TILE, y, health: player.health, oxygen: player.oxygen };
  if (player.armor) position.armor = player.armor;
  if (height === CRAWL_HEIGHT) position.crawling = true;
  return {
    format: SAVE_FORMAT,
    worldTime: game.worldTime,
    weatherSeed: game.weatherSeed,
    appearance: { ...player.appearance },
    player: position,
    inventory: Object.fromEntries(['hotbar', 'backpack'].map((group) => [group, inventory[group].map((stack) => stack && { ...stack })])),
    progress: {
      [AIR_TANK.id]: progress.airTank,
      ...(progress.reinforcedHelmet ? { [REINFORCED_HELMET.id]: true } : {}),
      ...(progress.swimmingHelmet ? { [SWIMMING_HELMET.id]: true } : {}),
    },
    world: {
      generator: WORLD_VERSION, edits, doors, harvested: Array.from(world.harvested),
      chests: Object.fromEntries(Array.from(game.chests, ([id, slots]) => [id, slots.map((stack) => stack && { ...stack })])),
    },
  };
}

export function createBrowserSave(key = 'aquaria.save', { saveTerrain = true } = {}) {
  let preserveUnsupported = false;
  return {
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const snapshot = decodeSave(data);
        preserveUnsupported = data !== null && !snapshot;
        return { snapshot, migrated: Boolean(snapshot && data.format < SAVE_FORMAT) };
      } catch {
        return { snapshot: null, migrated: false };
      }
    },
    write(game) {
      if (!game.dirty || preserveUnsupported) return;
      try {
        localStorage.setItem(key, JSON.stringify(encodeSave(game, saveTerrain)));
        game.dirty = false;
      } catch {
        // Keep the session playable if browser storage is unavailable.
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
        preserveUnsupported = false;
      } catch {
        // Resetting in memory is still possible if browser storage is unavailable.
      }
    },
  };
}
