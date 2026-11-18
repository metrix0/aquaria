import { AIR_TANK, ARROW, BOW, BREATH_SECONDS, COPPER_SPEAR, DROPS, MATERIAL, MINING_RULES, ORE_MATERIALS, SPEAR, SWIMMING_HELMET, WOODEN_DOOR } from '../content.js';
import { buildCellFree, createWorld, doorAt, editTile, hasOpenFace, inWater, isEditableTile, placeDoor, setDoor, solidAt, tileAt, treeAt } from '../world.js';
import { COLS, ROWS, TILE, WATER, clamp, generateMobs } from '../world/generation.js';
import { Inventory, ITEMS } from '../inventory.js';
import { CRAWL_HEIGHT, MAX_HEALTH, collides, movePlayer, spawn, updateOxygen } from './player.js';
import { damageMob, mobSpec, resetHostiles, stepMobs, syncMobs } from './mobs.js';

export function oxygenCapacity(game) {
  return (game.progress.airTank ? AIR_TANK.breathSeconds : BREATH_SECONDS) +
    (game.progress.swimmingHelmet ? SWIMMING_HELMET.bonusSeconds : 0);
}

export function createGame(snapshot) {
  const game = {
    world: createWorld(),
    inventory: new Inventory(snapshot?.inventory),
    progress: { airTank: false, swimmingHelmet: false, ...snapshot?.progress },
    dirty: false,
    elapsed: 0,
    worldTime: snapshot?.worldTime ?? 0,
    weatherSeed: snapshot?.weatherSeed ?? Math.floor(Math.random() * 0x80000000),
    enemies: { spawnIn: 14, hitCooldown: 0 },
    attack: null,
    projectiles: [],
    effects: [],
  };
  const { world } = game;
  for (const [x, y, material] of snapshot?.world.edits ?? []) editTile(world, x, y, material);
  for (const id of snapshot?.world.harvested ?? []) {
    if (world.fixtureIds.has(id)) world.harvested.add(id);
  }
  if (game.progress.swimmingHelmet || world.harvested.has(SWIMMING_HELMET.chestId)) {
    game.progress.swimmingHelmet = true;
    world.harvested.add(SWIMMING_HELMET.chestId);
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
  world.projectiles = [];
  const player = spawn(world, BREATH_SECONDS);
  syncMobs(world, player);
  return {
    world,
    inventory: new Inventory(),
    progress: { airTank: false, swimmingHelmet: false },
    player,
    dirty: true,
    elapsed: 0,
    worldTime: previous.worldTime,
    weatherSeed: previous.weatherSeed,
    enemies: { spawnIn: 14, hitCooldown: 0 },
    attack: null,
    projectiles: [],
    effects: [],
  };
}

function stepProjectiles(game, dt) {
  const { world, projectiles, effects } = game;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const arrow = projectiles[i];
    arrow.life -= dt;
    if (arrow.life <= 0) {
      projectiles.splice(i, 1);
      continue;
    }
    if (inWater(world, arrow.x, arrow.y)) {
      const drag = Math.exp(-1.1 * dt);
      arrow.dx *= drag;
      arrow.dy = arrow.dy * drag + 45 * dt;
    } else {
      arrow.dy += 140 * dt;
    }
    const travel = Math.hypot(arrow.dx * dt, arrow.dy * dt);
    const steps = Math.max(1, Math.ceil(travel / 6));
    let removed = false;
    for (let step = 0; step < steps; step++) {
      arrow.x += (arrow.dx * dt) / steps;
      arrow.y += (arrow.dy * dt) / steps;
      const tx = Math.floor(arrow.x / TILE);
      const ty = Math.floor(arrow.y / TILE);
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS || solidAt(world, tx, ty)) {
        effects.push({ x: arrow.x, y: arrow.y, material: tileAt(world, tx, ty) || MATERIAL.wood, count: 4, spread: 42 });
        removed = true;
        break;
      }
      for (const mob of world.mobs) {
        if (mob.health <= 0 || mob.respawn > 0) continue;
        const spec = mobSpec(mob);
        if (!spec) continue;
        if (Math.hypot(arrow.x - mob.x, arrow.y - (mob.y + spec.centerY)) <= spec.radius + 4) {
          damageMob(world, mob, arrow.damage, Math.atan2(arrow.dy, arrow.dx), arrow.knockback, effects);
          removed = true;
          break;
        }
      }
      if (removed) break;
    }
    if (removed) projectiles.splice(i, 1);
  }
}

export function useWeapon(game, slot, wx, wy) {
  const itemId = game.inventory.hotbar[slot]?.id;
  const weapon = ITEMS[itemId]?.weapon;
  if (!weapon) return null;
  if (game.attack) return { handled: true };

  const ox = game.player.x;
  const oy = game.player.y + Math.ceil(game.player.height / 2);
  const angle = wx === ox && wy === oy ? (game.player.facing < 0 ? Math.PI : 0) : Math.atan2(wy - oy, wx - ox);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  game.player.facing = dirX < 0 ? -1 : 1;

  if (weapon.id === SPEAR.id || weapon.id === COPPER_SPEAR.id) {
    game.attack = { kind: weapon.id, angle, timer: weapon.cooldown, duration: weapon.cooldown };
    for (let i = game.world.mobs.length - 1; i >= 0; i--) {
      const mob = game.world.mobs[i];
      if (mob.health <= 0 || mob.respawn > 0) continue;
      const spec = mobSpec(mob);
      if (!spec) continue;
      const mx = mob.x - ox;
      const my = mob.y + spec.centerY - oy;
      const along = mx * dirX + my * dirY;
      const across = Math.abs(mx * -dirY + my * dirX);
      if ((along >= -6 && along <= weapon.reach + spec.radius && across <= spec.radius + 12) || Math.hypot(mx, my) <= spec.radius + 10) {
        damageMob(game.world, mob, weapon.damage, angle, weapon.knockback, game.effects);
      }
    }
    return { handled: true };
  }

  if (weapon.id === BOW.id) {
    if (game.inventory.count(ARROW.id) < 1) {
      return { handled: true, message: 'Out of arrows. Craft more in Crafting.' };
    }
    game.inventory.spend(ARROW.id, 1);
    game.dirty = true;
    game.attack = { kind: BOW.id, angle, timer: weapon.cooldown, duration: weapon.cooldown };
    game.projectiles.push({
      x: ox + dirX * 10,
      y: oy + dirY * 10,
      dx: dirX * ARROW.speed,
      dy: dirY * ARROW.speed,
      damage: ARROW.damage,
      knockback: ARROW.knockback,
      life: 2.5,
    });
    return { handled: true, inventoryChanged: true };
  }
  return null;
}

export function stepGame(game, input, dt) {
  const { player, world } = game;
  const capacity = oxygenCapacity(game);
  const { x, y, health, oxygen } = player;
  if (game.attack) {
    game.attack.timer -= dt;
    if (game.attack.timer <= 0) game.attack = null;
  }
  movePlayer(world, player, input, dt);
  game.elapsed += dt;
  const hit = stepMobs(world, player, dt, game.elapsed, input.mining, input.night, game.enemies, game.effects);
  stepProjectiles(game, dt);
  if (hit) {
    player.hurt = Math.max(player.hurt ?? 0, 0.85);
    player.health = Math.max(0, player.health - (hit.healthLoss ?? 10));
    player.oxygen = Math.max(0, player.oxygen - hit.airLoss);
  }
  if (updateOxygen(world, player, dt, capacity, game.enemies.hitCooldown === 0)) {
    game.player = spawn(world, capacity, player.appearance);
    game.attack = null;
    game.projectiles.length = 0;
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

  if (item.kind === 'helmet') {
    game.world.harvested.add(item.id);
    game.progress.swimmingHelmet = true;
    game.player.oxygen = Math.min(oxygenCapacity(game), game.player.oxygen + SWIMMING_HELMET.bonusSeconds);
    game.dirty = true;
    return 'Swimming helmet equipped. +' + SWIMMING_HELMET.bonusSeconds + 's oxygen';
  }

  const { resource = item.kind, amount } = item;
  const name = ITEMS[resource].name.toLowerCase();
  if (!game.inventory.add(resource, amount)) return 'No room for more ' + name + '.';
  game.world.harvested.add(item.id);
  game.dirty = true;
  const reward = '+' + amount + ' ' + name;
  return item.kind === 'cache' ? item.name + ' recovered. ' + reward : reward;
}

export function canCraftTank(game) {
  return !game.progress.airTank && Object.entries(AIR_TANK.cost).every(([item, cost]) => game.inventory.count(item) >= cost);
}

export function craftTank(game) {
  if (!canCraftTank(game)) return false;
  for (const [item, cost] of Object.entries(AIR_TANK.cost)) game.inventory.spend(item, cost);
  game.progress.airTank = true;
  game.player.oxygen = Math.min(oxygenCapacity(game), game.player.oxygen + AIR_TANK.breathSeconds - BREATH_SECONDS);
  game.dirty = true;
  return true;
}

function craftResult(inventory, { id, cost, amount = 1 }) {
  const materials = Object.entries(cost);
  if (!materials.every(([item, count]) => inventory.count(item) >= count)) return null;
  const after = new Inventory(inventory);
  for (const [item, count] of materials) after.spend(item, count);
  return after.add(id, amount) ? after : null;
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
    if (ORE_MATERIALS.has(before) && !hasOpenFace(world, tx, ty, player)) return;
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
