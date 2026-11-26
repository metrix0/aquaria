import { ADDONS, ARMOR, COPPER_SNORKEL, FEET_GEAR, KRAKEN_CHEST_ID, MATERIAL, MATERIAL_IDS, SNORKEL_CHEST_ID, normalizeSnorkel } from './content.js';
import { HOOKS, WOODEN_SHIELD, ROOT_RING } from './inventory.js';
import { CRAWL_HEIGHT, PLAYER_SIZE, respawnPoint } from './gameplay/player.js';
import { editedTiles, isEditableTile } from './world.js';
import { SPAWN, TILE, WEST_EXTENSION, WORLD_VERSION } from './world/generation.js';

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
  const tent = Array.isArray(world.tent) && Number.isInteger(world.tent[0]) && isEditableTile(world.tent[0] + WEST_EXTENSION, world.tent[1])
    ? { tx: world.tent[0] + WEST_EXTENSION, ty: world.tent[1] }
    : null;
  const player = legacy ? data : data.player;
  const harvested = Array.isArray(world.harvested) ? [...world.harvested] : [];
  const gear = data.progress ?? {};
  const legacyHelmet = gear['reinforced-helmet'] === true ? 'reinforced-helmet'
    : (legacy ? data.helmet : gear['swimming-helmet']) === true ? 'swimming-helmet' : null;
  const oldWreckClaim = legacyHelmet || gear.snorkel === 'snorkel' || harvested.includes('shore-chest');
  if (oldWreckClaim && !harvested.includes(SNORKEL_CHEST_ID)) harvested.push(SNORKEL_CHEST_ID);
  const snorkel = Object.hasOwn(gear, 'snorkel') ? normalizeSnorkel(gear.snorkel)
    : normalizeSnorkel(legacyHelmet) ?? (harvested.includes(SNORKEL_CHEST_ID) ? COPPER_SNORKEL.id : null);
  const wreckSlots = world.chests?.[SNORKEL_CHEST_ID];
  const chests = harvested.includes(SNORKEL_CHEST_ID) && Array.isArray(wreckSlots)
    ? { ...world.chests, [SNORKEL_CHEST_ID]: wreckSlots.map((stack) =>
      stack?.id === 'snorkel' || stack?.id === 'swimming-helmet' ? null : stack) }
    : world.chests;
  const krakenChest = Number.isFinite(world.krakenChest?.x) && Number.isFinite(world.krakenChest?.y)
    ? { x: world.krakenChest.x + WEST_EXTENSION * TILE, y: world.krakenChest.y }
    : null;
  const krakenDefeated = world.krakenDefeated === true || Boolean(krakenChest);
  return {
    inventory: data.inventory,
    appearance: data.appearance,
    armor: Object.hasOwn(ARMOR, player?.armor) ? player.armor : null,
    perfectArmor: player?.perfectArmor === true,
    feet: Object.hasOwn(FEET_GEAR, player?.feet) ? player.feet : null,
    worldTime: Number.isFinite(data.worldTime) && data.worldTime >= 0 ? data.worldTime : 0,
    weatherSeed: Number.isInteger(data.weatherSeed) && data.weatherSeed >= 0 && data.weatherSeed < 0x80000000 ? data.weatherSeed : undefined,
    player: {
      x: player?.x + WEST_EXTENSION * TILE, y: player?.y,
      health: player?.health, oxygen: player?.oxygen, crawling: player?.crawling === true,
    },
    progress: { snorkel,
      classes: gear.classes,
      ...(Object.values(gear.addons ?? {}).some((id) => Object.hasOwn(ADDONS, id)) ? {
        addons: Object.fromEntries(['head', 'chest', 'legs', 'feet', 'hands'].map((slot) => {
          const id = gear.addons?.[slot];
          return [slot, ADDONS[id]?.addonSlot === slot ? id : null];
        })),
      } : {}),
      ...(Number.isFinite(gear.glowSeconds) && gear.glowSeconds > 0
        ? { glowSeconds: Math.min(90, gear.glowSeconds) } : {}),
      ring: gear.ring === ROOT_RING.id ? gear.ring : null,
      offhand: (Object.hasOwn(HOOKS, gear.offhand ?? gear.hands) || (gear.offhand ?? gear.hands) === WOODEN_SHIELD.id) ? (gear.offhand ?? gear.hands) : null,
      ringCooldown: Number.isFinite(gear.ringCooldown) ? Math.max(0, Math.min(ROOT_RING.cooldown, gear.ringCooldown)) : 0 },
    world: { edits, doors, tent, harvested, chests, pendingWreckLoot: world.pendingWreckLoot,
      placedRopes: Array.isArray(world.placedRopes) ? world.placedRopes : [],
      soulRewards: Array.isArray(world.soulRewards) ? world.soulRewards.filter((reward) =>
        typeof reward?.id === 'string' && reward.id.length <= 120 &&
        (reward.type === 'lesser' || reward.type === 'greater')).slice(0, 100) : [],
      ...(krakenChest ? { krakenChest } : {}),
      ...(krakenDefeated ? { krakenDefeated: true } : {}) },
  };
}

export function encodeSave(game, saveTerrain = true) {
  const { player, inventory, progress, world } = game;
  const ringCooldown = Math.max(0, game.rootReadyAt - game.elapsed);
  const edits = saveTerrain ? Array.from(editedTiles(world), ([x, y, material]) => [x - WEST_EXTENSION, y, MATERIAL_IDS[material]]) : [];
  const doors = saveTerrain ? Array.from(world.doors.values(), ({ tx, ty }) => [tx - WEST_EXTENSION, ty]) : [];
  const tent = saveTerrain && world.tent ? [world.tent.tx - WEST_EXTENSION, world.tent.ty] : null;
  const { x, y, height } = player.downed ? { ...respawnPoint(world), height: PLAYER_SIZE.height } : (player.flightOrigin ?? player);
  const position = { x: x - WEST_EXTENSION * TILE, y, health: player.downed ? 100 : player.health, oxygen: player.downed ? undefined : player.oxygen };
  if (player.armor) { position.armor = player.armor; if (player.perfectArmor) position.perfectArmor = true; }
  if (player.feet) position.feet = player.feet;
  if (height === CRAWL_HEIGHT) position.crawling = true;
  const droppedKrakenChest = world.items.find((item) => item.id === KRAKEN_CHEST_ID);
  return {
    format: SAVE_FORMAT,
    worldTime: game.worldTime,
    weatherSeed: game.weatherSeed,
    appearance: { ...player.appearance },
    player: position,
    inventory: Object.fromEntries(['hotbar', 'backpack'].map((group) => [group, inventory[group].map((stack) => stack && { ...stack })])),
    progress: { snorkel: progress.snorkel,
      classes: game.classes,
      ...(Object.values(progress.addons ?? {}).some(Boolean) ? { addons: progress.addons } : {}),
      ...(player.glowSeconds > 0 ? { glowSeconds: player.glowSeconds } : {}),
      ...(progress.ring ? { ring: progress.ring } : {}),
      ...(progress.offhand ? { offhand: progress.offhand } : {}),
      ...(ringCooldown ? { ringCooldown } : {}) },
    world: {
      generator: WORLD_VERSION, edits, doors, ...(tent ? { tent } : {}), harvested: Array.from(world.harvested),
      placedRopes: world.placedRopes ?? [],
      ...(world.soulRewards?.length ? { soulRewards: world.soulRewards } : {}),
      pendingWreckLoot: Object.fromEntries(world.pendingWreckLoot),
      ...(droppedKrakenChest ? { krakenChest: { x: droppedKrakenChest.x - WEST_EXTENSION * TILE, y: droppedKrakenChest.restY ?? droppedKrakenChest.y } } : {}),
      ...(world.krakenDefeated ? { krakenDefeated: true } : {}),
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
