import { AIR_TANK, BREATH_SECONDS, DROPS, MATERIAL, MINING_RULES, WOODEN_DOOR, WRECK_CACHE } from '../content.js';
import { buildCellFree, createWorld, doorAt, editTile, isEditableTile, placeDoor, setDoor, tileAt, treeAt } from '../world.js';
import { COLS, ROWS, TILE, WATER, clamp, generateMobs } from '../world/generation.js';
import { Inventory, ITEMS } from '../inventory.js';
import { CRAWL_HEIGHT, MAX_HEALTH, collides, movePlayer, spawn, updateOxygen } from './player.js';
import { resetHostiles, stepMobs, syncMobs } from './mobs.js';

export function oxygenCapacity(game) {
  return game.progress.airTank ? AIR_TANK.breathSeconds : BREATH_SECONDS;
}

export function createGame(snapshot) {
  const game = {
    world: createWorld(),
    inventory: new Inventory(snapshot?.inventory),
    progress: { airTank: false, ...snapshot?.progress },
    dirty: false,
    elapsed: 0,
    worldTime: snapshot?.worldTime ?? 0,
    weatherSeed: snapshot?.weatherSeed ?? Math.floor(Math.random() * 0x80000000),
    enemies: { spawnIn: 14, hitCooldown: 0 },
    effects: [],
  };
  const { world } = game;
  for (const [x, y, material] of snapshot?.world.edits ?? []) editTile(world, x, y, material);
  for (const id of snapshot?.world.harvested ?? []) {
    if (world.fixtureIds.has(id)) world.harvested.add(id);
  }
  for (const [x, y] of snapshot?.world.doors ?? []) placeDoor(world, x, y);
  game.player = spawn(world, oxygenCapacity(game), snapshot?.appearance);

  const position = snapshot?.player;
  if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
    const { player } = game;
    const x = clamp(position.x, player.width, COLS * TILE - player.width);
    const height = position.crawling ? CRAWL_HEIGHT : player.height;
    const y = clamp(position.y, 0, ROWS * TILE - height);
    if (!collides(world, x, y, height)) {
      Object.assign(player, { x, y, height });
      if (Number.isFinite(position.health)) player.health = clamp(position.health, 1, MAX_HEALTH);
      if (Number.isFinite(position.oxygen)) player.oxygen = clamp(position.oxygen, 1, oxygenCapacity(game));
    }
  }
  syncMobs(world, game.player);
  return game;
}

export function resetRoomProgress(previous) {
  const world = previous.world;
  world.harvested.clear();
  world.mobs = generateMobs();
  const player = spawn(world, BREATH_SECONDS);
  syncMobs(world, player);
  return {
    world,
    inventory: new Inventory(),
    progress: { airTank: false },
    player,
    dirty: true,
    elapsed: 0,
    worldTime: previous.worldTime,
    weatherSeed: previous.weatherSeed,
    enemies: { spawnIn: 14, hitCooldown: 0 },
    effects: [],
  };
}

export function stepGame(game, input, dt) {
  const { player, world } = game;
  const capacity = oxygenCapacity(game);
  const { x, y, health, oxygen } = player;
  movePlayer(world, player, input, dt);
  game.elapsed += dt;
  const hit = stepMobs(world, player, dt, game.elapsed, input.mining, input.night, game.enemies, game.effects);
  if (hit) {
    player.hurt = Math.max(player.hurt ?? 0, 0.85);
    player.health = Math.max(0, player.health - (hit.healthLoss ?? 10));
    player.oxygen = Math.max(0, player.oxygen - hit.airLoss);
  }
  if (updateOxygen(world, player, dt, capacity, game.enemies.hitCooldown === 0)) {
    game.player = spawn(world, capacity, player.appearance);
    resetHostiles(world);
    game.dirty = true;
    return 'You washed back up on the island.';
  }
  if (player.x !== x || player.y !== y || player.health !== health || player.oxygen !== oxygen) game.dirty = true;
  if (hit) return hit.name + ' bite. −' + (hit.healthLoss ?? 10) + ' health';
}

export function nearestItem(game) {
  const { player, world } = game;
  let result;
  let distance = 35;
  for (const item of world.items) {
    if (world.harvested.has(item.id)) continue;
    const difference = Math.hypot(item.x - player.x, item.y - player.y - Math.ceil(player.height / 2));
    if (difference < distance) {
      distance = difference;
      result = item;
    }
  }
  return result;
}

export function collectItem(game) {
  const item = nearestItem(game);
  if (!item) return;

  const resource = item.kind === 'cache' ? 'wood' : item.kind;
  const amount = item.kind === 'cache' ? WRECK_CACHE.wood : item.amount;
  if (!game.inventory.add(resource, amount)) return 'No room for more ' + ITEMS[resource].name.toLowerCase() + '.';
  game.world.harvested.add(item.id);
  game.dirty = true;
  return item.kind === 'cache' ? 'Wreck cache recovered. +' + amount + ' wood' : '+' + amount + ' ' + resource;
}

export function canCraftTank(game) {
  return !game.progress.airTank && Object.entries(AIR_TANK.cost).every(([item, cost]) => game.inventory.count(item) >= cost);
}

export function craftTank(game) {
  if (!canCraftTank(game)) return false;
  for (const [item, cost] of Object.entries(AIR_TANK.cost)) game.inventory.spend(item, cost);
  game.progress.airTank = true;
  game.player.oxygen = Math.min(AIR_TANK.breathSeconds, game.player.oxygen + AIR_TANK.breathSeconds - BREATH_SECONDS);
  game.dirty = true;
  return true;
}

function craftResult(inventory, { id, cost }) {
  const materials = Object.entries(cost);
  if (!materials.every(([item, count]) => inventory.count(item) >= count)) return null;
  const after = new Inventory(inventory);
  for (const [item, count] of materials) after.spend(item, count);
  return after.add(id, 1) ? after : null;
}

export function canCraftItem(game, recipe) {
  return Boolean(craftResult(game.inventory, recipe));
}

export function craftItem(game, recipe) {
  const inventory = craftResult(game.inventory, recipe);
  if (!inventory) return false;
  game.inventory = inventory;
  game.dirty = true;
  return true;
}

export function targetTile(game, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const { player } = game;
  const reachable = Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y - Math.floor(player.height / 2)) <= 5 * TILE;
  return { tx, ty, reachable };
}

export function planTileAction(game, target, build, slot) {
  if (!target?.reachable) return;
  const { tx, ty } = target;
  if (!isEditableTile(tx, ty)) return;
  const { world, player, inventory } = game;
  const before = tileAt(world, tx, ty);
  if (!build) {
    const door = doorAt(world, tx, ty);
    if (door) return { ...door, before: MATERIAL.wood, after: MATERIAL.air, door, item: WOODEN_DOOR.id, amount: 1 };
    const tree = before === MATERIAL.air && treeAt(world, tx, ty);
    if (tree) return { tx, ty, before: MATERIAL.wood, treeId: tree.id, item: 'wood', amount: Math.round(tree.height / TILE) };
    const item = DROPS[before];
    return item && { tx, ty, before, after: MATERIAL.air, item, supportedDoor: doorAt(world, tx, ty - 1), amount: 1 };
  }
  const item = inventory.hotbar[slot]?.id;
  if (!buildCellFree(world, tx, ty)) return;
  if (item === WOODEN_DOOR.id) {
    if (buildCellFree(world, tx, ty - 1) && tileAt(world, tx, ty + 1)) {
      return { tx, ty, before, after: MATERIAL.door, item, slot, amount: -1 };
    }
    return;
  }
  const block = ITEMS[item]?.block;
  if (!block) return;
  const connected = tileAt(world, tx - 1, ty) || tileAt(world, tx + 1, ty) || tileAt(world, tx, ty - 1) || tileAt(world, tx, ty + 1);
  const overlapsPlayer = tx * TILE < player.x + player.width / 2 &&
    (tx + 1) * TILE > player.x - player.width / 2 &&
    ty * TILE < player.y + player.height && (ty + 1) * TILE > player.y;
  if (connected && !overlapsPlayer) return { tx, ty, before, after: block, item, slot, amount: -1 };
}

export function advanceMining(game, target, current, dt, slot = 0) {
  const action = planTileAction(game, target, false);
  if (!action) return null;
  const { tx, ty } = target;
  const { before } = action;
  const tool = game.inventory.hotbar[slot]?.id;
  const tier = ITEMS[tool]?.pickaxe ?? 0;
  const rule = MINING_RULES[before];
  if (tier < (rule.tier ?? 0)) {
    const required = rule.tier === 2 ? 'a Copper pickaxe' : 'a pickaxe';
    return { blocked: rule.name + ' requires ' + required + '.' };
  }
  const same = current?.action && current.tier === tier && (action.door || action.treeId
    ? action.door === current.action.door && action.treeId === current.action.treeId
    : !current.action.door && !current.action.treeId && current.tx === tx && current.ty === ty && current.material === before);
  const duration = tier ? rule.pickaxe : rule.hand;
  const progress = (same ? current.progress : 0) + dt / duration;
  return { tx, ty, material: before, duration, progress, action, tier };
}

export function applyTerrain(game, tx, ty, material) {
  const { world, player } = game;
  if (material === MATERIAL.door) {
    setDoor(world, tx, ty, true);
    syncMobs(world, player);
    return;
  }
  setDoor(world, tx, ty, false);
  if (material === MATERIAL.air) {
    const supported = doorAt(world, tx, ty - 1);
    if (supported?.ty === ty - 1) setDoor(world, supported.tx, supported.ty, false);
  }
  if (!editTile(world, tx, ty, material)) return;
  if (material && collides(world, player.x, player.y, player.height)) {
    game.player = spawn(game.world, oxygenCapacity(game), player.appearance);
    game.dirty = true;
  }
  syncMobs(world, game.player);
}

export function commitTileAction(game, action) {
  if (action.treeId) game.world.harvested.add(action.treeId);
  else applyTerrain(game, action.tx, action.ty, action.after);
  awardTileAction(game, action);
}

export function awardTileAction(game, { item, amount, slot, supportedDoor }, removedDoor = Boolean(supportedDoor)) {
  if (amount > 0) game.inventory.add(item, amount);
  else game.inventory.consume(game.inventory.hotbar, slot, -amount);
  if (removedDoor) game.inventory.add(WOODEN_DOOR.id, 1);
  game.dirty = true;
}

export function areaDepth(game) {
  return Math.max(0, Math.floor((game.player.y + 5 - WATER) / TILE));
}
