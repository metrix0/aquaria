import { stepRootWave } from './root-ring.js';
import { caveTrapAt, stepCaveTraps } from './cave-traps.js';
import { ARMOR, ARROW, BOW, BREATH_SECONDS, CHEST_SIZE, DIVING_FIN, DROPS, FEET_GEAR, INTERACTION_RANGE, KELP_DRESSING, KELP_MINING_RULE, KRAKEN_CHEST_ID, MATERIAL, MINING_RULES, ORE_MATERIALS, SNORKELS, WOODEN_DOOR, WORKBENCH } from '../content.js';
import { buildCellFree, createWorld, doorAt, editTile, editedTiles, hasOpenFace, inWater, isEditableTile, kelpAt, placeDoor, rootedKelpAt, setDoor, solidAt, tileAt, treeAt } from '../world.js';
import { COLS, ROWS, TILE, WATER, clamp, generateMobs } from '../world/generation.js';
import { Inventory, ITEMS, ROOT_RING, moveStack, restoreSlots } from '../inventory.js';
import { CRAWL_HEIGHT, MAX_HEALTH, collides, movePlayer, playerInWater, spawn, takeDamage, updateOxygen } from './player.js';
import { meleeHitbox, overlapsMob } from './melee.js';
import { damageMob, mobSpec, resetHostiles, stepMobs, syncMobs } from './mobs.js';

export function equippedSnorkel(game) {
  return SNORKELS[game.progress.snorkel] ?? null;
}

export function equippedFeet(game) {
  return FEET_GEAR[game.player.feet] ?? null;
}

export function equippedRing(game) {
  return game.progress.ring === ROOT_RING.id ? ROOT_RING : null;
}

export function oxygenCapacity(game) {
  return BREATH_SECONDS + (equippedSnorkel(game)?.bonusSeconds ?? 0);
}

function setSnorkel(game, id) {
  game.progress.snorkel = id;
  game.player.oxygen = Math.min(game.player.oxygen, oxygenCapacity(game));
}

function setFeet(game, id) {
  game.player.feet = Object.hasOwn(FEET_GEAR, id) ? id : null;
}

export function createGame(snapshot) {
  const game = {
    world: createWorld(),
    inventory: new Inventory(snapshot?.inventory),
    progress: { snorkel: snapshot?.progress?.snorkel ?? null, ring: snapshot?.progress?.ring ?? null },
    dirty: false,
    elapsed: 0,
    rootWave: null,
    rootReadyAt: snapshot?.progress?.ringCooldown ?? 0,
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
  if (snapshot?.world.krakenChest && !world.items.some((item) => item.id === KRAKEN_CHEST_ID)) {
    world.items.push({
      id: KRAKEN_CHEST_ID,
      name: 'Kraken chest',
      kind: 'chest',
      loot: { id: DIVING_FIN.id, count: 1 },
      x: snapshot.world.krakenChest.x,
      y: snapshot.world.krakenChest.y,
    });
  }
  game.chests = restoreChests(world, snapshot?.world.chests, snapshot?.world.pendingWreckLoot);
  for (const [x, y] of snapshot?.world.doors ?? []) placeDoor(world, x, y);
  game.player = spawn(world, oxygenCapacity(game), snapshot?.appearance,
    Object.hasOwn(ARMOR, snapshot?.armor) ? snapshot.armor : null,
    Object.hasOwn(FEET_GEAR, snapshot?.feet) ? snapshot.feet : null);

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
  for (const [tx, ty, material] of editedTiles(world)) {
    const uprooted = material === MATERIAL.air && rootedKelpAt(world, tx, ty);
    if (uprooted) world.harvested.add(uprooted.id);
  }
  world.items = world.items.filter((item) => world.fixtureIds.has(item.id));
  world.mobs = generateMobs();
  world.projectiles = [];
  const player = spawn(world, BREATH_SECONDS);
  syncMobs(world, player);
  return {
    world,
    inventory: new Inventory(),
    chests: restoreChests(world),
    progress: { snorkel: null },
    player,
    dirty: true,
    elapsed: 0,
    rootWave: null,
    rootReadyAt: 0,
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
        const hit = mob.segments?.length
          ? mob.segments.some((seg) => Math.hypot(arrow.x - seg.x, arrow.y - seg.y) <= seg.radius + 4)
          : Math.hypot(arrow.x - mob.x, arrow.y - (mob.y + spec.centerY)) <= spec.radius + 4;
        if (hit) {
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

export function useDressing(game, slot) {
  const { player, inventory } = game;
  if (inventory.hotbar[slot]?.id !== KELP_DRESSING.id) return;
  const healed = Math.min(KELP_DRESSING.heal, MAX_HEALTH - player.health);
  if (healed < 1) return { message: 'Health is already full.' };
  inventory.consume(inventory.hotbar, slot, 1);
  player.health += healed;
  game.dirty = true;
  return { inventoryChanged: true, message: 'Kelp dressing restored ' + Math.round(healed) + ' health.' };
}

export function useWeapon(game, slot, wx, wy) {
  const itemId = game.inventory.hotbar[slot]?.id;
  const item = ITEMS[itemId];
  const weapon = item?.weapon;
  if (game.attack) return { handled: true };

  const ox = game.player.x;
  const oy = game.player.y + Math.ceil(game.player.height / 2);
  const angle = wx === ox && wy === oy ? (game.player.facing < 0 ? Math.PI : 0) : Math.atan2(wy - oy, wx - ox);
  if (weapon?.id !== BOW.id) {
    const duration = (weapon?.cooldown ?? 0.28) * 1.4;
    const facing = Math.sign(wx - ox) || game.player.facing;
    game.player.facing = facing;
    game.attack = {
      kind: weapon?.id ?? 'melee', angle, facing, timer: duration, duration,
      tier: item?.pickaxe, damage: weapon?.damage ?? 1, knockback: weapon?.knockback, hitMobs: new Set(),
    };
    return { handled: true };
  }

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  game.player.facing = dirX < 0 ? -1 : 1;
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

function stepAttack(game, dt) {
  const { attack, player, world, effects } = game;
  if (!attack) return;
  attack.timer -= dt;
  if (attack.timer <= 0) {
    game.attack = null;
    return;
  }
  if (!attack.hitMobs) return;
  const hitbox = meleeHitbox(player, attack, playerInWater(world, player));
  if (!hitbox) return;
  const angle = Math.atan2(hitbox.uy, hitbox.ux);
  for (let i = world.mobs.length - 1; i >= 0; i--) {
    const mob = world.mobs[i];
    if (mob.health <= 0 || mob.respawn > 0 || attack.hitMobs.has(mob)) continue;
    const spec = mobSpec(mob);
    if (spec && overlapsMob(hitbox, mob, spec)) {
      attack.hitMobs.add(mob);
      damageMob(world, mob, attack.damage, angle, attack.knockback, effects);
    }
  }
}

function stepDroppedChests(game, dt) {
  for (const item of game.world.items) {
    if (item.kind !== 'chest') continue;
    if (!game.chests.has(item.id)) {
      game.chests.set(item.id, restoreSlots([item.loot], CHEST_SIZE));
      game.dirty = true;
    }
    if (item.falling) {
      item.dy = Math.min(130, (item.dy ?? 0) + 260 * dt);
      item.y = Math.min(item.restY, item.y + item.dy * dt);
      if (item.y >= item.restY) {
        item.y = item.restY;
        item.dy = 0;
        item.falling = false;
      }
      game.dirty = true;
    }
  }
}

export function stepGame(game, input, dt) {
  const { player, world } = game;
  const capacity = oxygenCapacity(game);
  const { x, y, health, oxygen } = player;
  const fallDamage = movePlayer(world, player, input, dt);
  let fallLoss = 0;
  if (fallDamage) {
    fallLoss = takeDamage(player, fallDamage);
    player.hurt = Math.max(player.hurt, 0.85);
  }
  const fatalFall = fallLoss > 0 && player.health === 0;
  stepAttack(game, dt);
  game.elapsed += dt;
  const hit = stepMobs(world, player, dt, game.elapsed, input.mining, input.night, game.enemies, game.effects);
  stepRootWave(game, dt);
  stepDroppedChests(game, dt);
  stepProjectiles(game, dt);
  stepCaveTraps(world, player, game.elapsed, dt, game.effects, (mob, x) => {
    damageMob(world, mob, 4, mob.x >= x ? 0 : Math.PI, 65, game.effects);
  });
  if (hit) {
    player.hurt = Math.max(player.hurt ?? 0, 0.85);
    takeDamage(player, hit.healthLoss ?? 10);
    player.oxygen = Math.max(0, player.oxygen - hit.airLoss);
  }
  if (updateOxygen(world, player, dt, capacity, game.enemies.hitCooldown === 0)) {
    game.player = spawn(world, capacity, player.appearance, player.armor, player.feet);
    game.attack = null;
    game.projectiles.length = 0;
    game.rootWave = null;
    resetHostiles(world);
    game.dirty = true;
    return fatalFall ? 'Fatal fall. You woke up back on the island.' : 'You washed back up on the island.';
  }
  if (player.x !== x || player.y !== y || player.health !== health || player.oxygen !== oxygen) game.dirty = true;
  if (hit) return hit.name + ' bite. −' + (hit.healthLoss ?? 10) + ' health';
  if (fallLoss) return `Hard landing. −${fallLoss} health`;
}

function stockWreckLoot(world, item, slots, remaining) {
  const first = item.bonusLoot.length - remaining;
  for (let index = first; index < item.bonusLoot.length; index++) {
    const emptySlot = slots.indexOf(null);
    if (emptySlot < 0) break;
    slots[emptySlot] = { ...item.bonusLoot[index] };
    remaining--;
  }
  if (remaining > 0) world.pendingWreckLoot.set(item.id, remaining);
  else world.pendingWreckLoot.delete(item.id);
}

function restoreChests(world, saved, pendingWreckLoot) {
  const chests = new Map();
  world.pendingWreckLoot.clear();
  for (const item of world.items) {
    if (item.kind !== 'chest') continue;
    const savedSlots = saved?.[item.id];
    const hasSavedSlots = Array.isArray(savedSlots);
    const slots = restoreSlots(hasSavedSlots ? savedSlots : world.harvested.has(item.id) ? [] : [item.loot], CHEST_SIZE);
    if (item.bonusLoot) {
      const savedCount = pendingWreckLoot?.[item.id];
      const remaining = !pendingWreckLoot || !hasSavedSlots ? item.bonusLoot.length
        : Number.isInteger(savedCount) ? clamp(savedCount, 0, item.bonusLoot.length) : 0;
      if (remaining) stockWreckLoot(world, item, slots, remaining);
    }
    chests.set(item.id, slots);
  }
  return chests;
}

function itemDistance(player, item) {
  return Math.hypot(item.x - player.x, item.y - player.y - Math.ceil(player.height / 2));
}

export function chestAt(game, x, y) {
  return game.world.items.find((item) => item.kind === 'chest' &&
    Math.abs(x - item.x) < 12 && y >= item.y - 11 && y < item.y + 8 &&
    itemDistance(game.player, item) < INTERACTION_RANGE);
}

const EQUIP_SLOTS = {
  head: { items: SNORKELS, get: equippedSnorkel, set: setSnorkel },
  feet: { items: FEET_GEAR, get: equippedFeet, set: setFeet },
  ring: { items: { [ROOT_RING.id]: ROOT_RING }, get: equippedRing, set: (game, id) => { game.progress.ring = id; } },
};

export function moveInventoryStack(game, chestId, from, to) {
  const slots = game.chests.get(chestId);
  const equipStacks = Object.fromEntries(Object.entries(EQUIP_SLOTS).map(([group, config]) => {
    const item = config.get(game);
    return [group, [item ? { id: item.id, count: 1 } : null]];
  }));
  const groups = { hotbar: game.inventory.hotbar, backpack: game.inventory.backpack, chest: slots, ...equipStacks };
  const source = groups[from.group];
  const target = groups[to.group];
  const fromEquip = Object.hasOwn(EQUIP_SLOTS, from.group);
  const toEquip = Object.hasOwn(EQUIP_SLOTS, to.group);

  if (fromEquip || toEquip) {
    if (fromEquip && toEquip) return false;
    const equipGroup = fromEquip ? from.group : to.group;
    if ((fromEquip ? from.index : to.index) !== 0) return false;
    const config = EQUIP_SLOTS[equipGroup];
    const current = config.get(game);
    const other = fromEquip ? target : source;
    const index = fromEquip ? to.index : from.index;
    if (!other || !Number.isInteger(index) || index < 0 || index >= other.length) return false;
    const stack = other[index];
    if (stack && !Object.hasOwn(config.items, stack.id)) return false;
    if (toEquip && (!stack || stack.id === current?.id)) return false;
    if (stack?.count > 1 && stack.id !== current?.id) {
      if (current) return false;
      stack.count--;
      equipStacks[equipGroup][0] = { id: stack.id, count: 1 };
    } else if (!moveStack(source, from.index, target, to.index)) return false;
    config.set(game, equipStacks[equipGroup][0]?.id ?? null);
  } else if (!moveStack(source, from.index, target, to.index)) return false;

  if (from.group === 'chest') restockPendingWreckLoot(game, chestId, slots);
  game.dirty = true;
  return true;
}

function restockPendingWreckLoot(game, chestId, slots) {
  const remaining = game.world.pendingWreckLoot.get(chestId);
  if (!remaining) return false;
  const item = game.world.items.find(({ id }) => id === chestId);
  stockWreckLoot(game.world, item, slots, remaining);
  return true;
}

export function collectChest(game, chestId) {
  const slots = game.chests.get(chestId);
  if (!slots) return false;

  let collected = false;
  let freedSlot;
  do {
    freedSlot = false;
    for (const [index, stack] of slots.entries()) {
      if (!stack || !game.inventory.add(stack.id, stack.count)) continue;
      slots[index] = null;
      freedSlot = true;
      collected = true;
    }
  } while (freedSlot && restockPendingWreckLoot(game, chestId, slots));

  if (collected) game.dirty = true;
  return collected;
}

export function workbenchAt(game, tx, ty) {
  if (tileAt(game.world, tx, ty) !== MATERIAL.workbench) return;
  const item = { kind: WORKBENCH.id, name: ITEMS[WORKBENCH.id].name, tx, ty, x: (tx + .5) * TILE, y: (ty + .5) * TILE };
  if (itemDistance(game.player, item) < INTERACTION_RANGE) return item;
}

export function nearestItem(game) {
  const { player, world } = game;
  let result;
  let distance = INTERACTION_RANGE;
  for (const item of world.items) {
    if (item.kind !== 'chest') continue;
    const difference = itemDistance(player, item);
    if (difference < distance) {
      distance = difference;
      result = item;
    }
  }
  const row = player.y + Math.ceil(player.height / 2);
  const left = Math.floor((player.x - distance) / TILE);
  const right = Math.floor((player.x + distance) / TILE);
  const top = Math.floor((row - distance) / TILE);
  const bottom = Math.floor((row + distance) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const bench = workbenchAt(game, tx, ty);
      if (!bench) continue;
      const difference = itemDistance(player, bench);
      if (difference < distance) {
        distance = difference;
        result = bench;
      }
    }
  }
  return result;
}

function usesEquippedSnorkel(game, recipe, id) {
  return id === game.progress.snorkel && Object.hasOwn(SNORKELS, recipe.id);
}

export function craftMaterialCount(game, recipe, id) {
  return game.inventory.count(id) + Number(usesEquippedSnorkel(game, recipe, id));
}

function craftResult(game, recipe, activeStation) {
  const { id, cost, amount = 1, station } = recipe;
  if (station && station !== activeStation) return null;
  const materials = Object.entries(cost);
  if (!materials.every(([item, count]) => craftMaterialCount(game, recipe, item) >= count)) return null;
  const after = new Inventory(game.inventory);
  let upgrade = false;
  for (const [item, count] of materials) {
    const worn = usesEquippedSnorkel(game, recipe, item);
    after.spend(item, count - Number(worn));
    upgrade ||= worn;
  }
  return upgrade || after.add(id, amount, { preferHotbar: true }) ? { inventory: after, upgrade } : null;
}

export function equipmentCraftStatus(game, recipe) {
  const current = game.player.armor;
  for (let id = current; id; id = ARMOR[id]?.requires) {
    if (id === recipe.id) return current === id ? 'Equipped' : 'Already upgraded';
  }
  if (recipe.requires && current !== recipe.requires) return 'Upgrade required';
  return null;
}

export function canCraftItem(game, recipe, station) {
  if (recipe.station && recipe.station !== station) return false;
  if (!recipe.equipment) return Boolean(craftResult(game, recipe, station));
  return !equipmentCraftStatus(game, recipe) &&
    Object.entries(recipe.cost).every(([id, count]) => game.inventory.count(id) >= count);
}

export function craftItem(game, recipe, station) {
  if (recipe.equipment) {
    if (!canCraftItem(game, recipe, station)) return false;
    for (const [id, count] of Object.entries(recipe.cost)) game.inventory.spend(id, count);
    game.player.armor = recipe.id;
    game.dirty = true;
    return true;
  }
  const result = craftResult(game, recipe, station);
  if (!result) return false;
  game.inventory = result.inventory;
  if (result.upgrade) setSnorkel(game, recipe.id);
  game.dirty = true;
  return true;
}

export function grantItem(game, id, count) {
  if (!Number.isSafeInteger(count) || count < 1) return false;
  if (Object.hasOwn(ARMOR, id)) {
    game.player.armor = id;
  } else if (!game.inventory.add(id, count, { preferHotbar: true })) return false;
  game.dirty = true;
  return true;
}

export function targetTile(game, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const { player } = game;
  const reachable = Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y - Math.floor(player.height / 2)) <= 5 * TILE;
  return { tx, ty, x, reachable };
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
    const trap = caveTrapAt(world, tx, ty);
    if (trap) return { tx, ty, before: MATERIAL.wood, after: MATERIAL.air, trap, amount: 0 };
    const tree = before === MATERIAL.air && treeAt(world, tx, ty);
    if (tree) return { tx, ty, before: MATERIAL.wood, fixtureId: tree.id, item: 'wood', amount: Math.round(tree.height / TILE) };
    const kelp = before === MATERIAL.air && kelpAt(world, target.x ?? (tx + .5) * TILE, ty);
    if (kelp) return { tx, ty, before, fixtureId: kelp.id, item: 'kelp', amount: kelp.amount };
    const item = DROPS[before];
    if (ORE_MATERIALS.has(before) && !hasOpenFace(world, tx, ty, player)) return;
    return item && { tx, ty, before, after: MATERIAL.air, item, amount: 1,
      supportedDoor: doorAt(world, tx, ty - 1), supportedKelp: rootedKelpAt(world, tx, ty) };
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
  const tool = game.inventory.bestPickaxe(slot);
  const tier = ITEMS[tool]?.pickaxe ?? 0;
  const rule = action.trap ? { hand: 1.1, pickaxe: .42 } : action.item === 'kelp' ? KELP_MINING_RULE : MINING_RULES[before];
  if (tier < (rule.tier ?? 0)) {
    const required = rule.tier === 2 ? 'a Copper pickaxe' : 'a pickaxe';
    return { tool, blocked: rule.name + ' requires ' + required + '.' };
  }
  const fixture = action.door ?? action.fixtureId;
  const same = current?.action && current.tier === tier && fixture === (current.action.door ?? current.action.fixtureId) &&
    (fixture || (current.tx === tx && current.ty === ty && current.material === before));
  const duration = tier ? rule.pickaxe * (ITEMS[tool].miningTime ?? 1) : rule.hand;
  const progress = (same ? current.progress : 0) + dt / duration;
  return { tx, ty, material: before, duration, progress, action, tier, tool };
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
  const harvested = world.harvested.size;
  if (!editTile(world, tx, ty, material)) return;
  if (world.harvested.size !== harvested) game.dirty = true;
  if (material && collides(world, player.x, player.y, player.height)) {
    game.player = spawn(game.world, oxygenCapacity(game), player.appearance, player.armor, player.feet);
    game.attack = null;
    game.dirty = true;
  }
  syncMobs(world, game.player);
}

export function commitTileAction(game, action) {
  if (action.fixtureId) game.world.harvested.add(action.fixtureId);
  else applyTerrain(game, action.tx, action.ty, action.after);
  awardTileAction(game, action);
}

export function awardTileAction(game, { item, amount, slot, supportedDoor, supportedKelp }, removedDoor = Boolean(supportedDoor)) {
  if (amount > 0) game.inventory.add(item, amount);
  else if (amount < 0) game.inventory.consume(game.inventory.hotbar, slot, -amount);
  if (removedDoor) game.inventory.add(WOODEN_DOOR.id, 1);
  if (supportedKelp) game.inventory.add('kelp', supportedKelp.amount);
  game.dirty = true;
}

export function areaDepth(game) {
  return Math.max(0, Math.floor((game.player.y + 5 - WATER) / TILE));
}
