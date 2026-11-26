import { SOLO_DEATH_SECONDS, MULTIPLAYER_DEATH_SECONDS, advanceRevival } from './revival.js';
import { START_WORLD_TIME } from '../environment.js';
import { absorbSouls, createClassProgress, skillBonuses, SOUL_ITEMS } from '../classes.js';
import { rollWildChestGroupLoot } from '../world/wild-chest.js';
import { stepRootWave } from './root-ring.js';
import { activateWard, skillAttackDamage, stepClassEffects, strikeMob } from './class-effects.js';
import { equippedHook, hasHook } from './hook.js';
import { stepWardenBefore, stepWardenAfter, finishWardenStep, wardenAttackBlocked } from './warden.js';
import { stepWayfarer, finishWayfarer, catchFallMultiplier } from './wayfarer.js';
import { caveTrapAt, stepCaveTraps } from './cave-traps.js';
import { ADDONS, ARMOR, ARROW, BOW, BREATH_SECONDS, CHEST_SIZE, DIVING_FIN, DROPS, FEET_GEAR, FIREPLACE, FOODS, INTERACTION_RANGE, KELP_DRESSING, KELP_MINING_RULE, KRAKEN_CHEST_ID, MATERIAL, MINING_RULES, ORE_MATERIALS, POISON_ARROW, SNORKELS, WOODEN_DOOR, WORKBENCH } from '../content.js';
import { buildCellFree, createWorld, doorAt, editTile, editedTiles, hasOpenFace, inWater, isEditableTile, kelpAt, placeDoor, rootedKelpAt, setDoor, solidAt, tileAt, treeAt } from '../world.js';
import { COLS, ROWS, TILE, WATER, WEST_EXTENSION, clamp, generateMobs } from '../world/generation.js';
import { jungleVillageStructures } from '../world/jungle-village.js';
import { GRAPPLING_HOOK, WOODEN_SHIELD, Inventory, ITEMS, ROOT_RING, moveStack, restoreSlots } from '../inventory.js';
import { CRAWL_HEIGHT, MAX_HEALTH, collides, movePlayer, playerInWater, spawn, stepBleed, stepPoison, takeDamage, updateOxygen, settleDowned } from './player.js';
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
  return BREATH_SECONDS + (equippedSnorkel(game)?.bonusSeconds ?? 0) + skillBonuses(game.classes).oxygen;
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
    classes: createClassProgress(snapshot?.progress?.classes),
    inventory: new Inventory(snapshot?.inventory),
    progress: {
      snorkel: snapshot?.progress?.snorkel ?? null,
      ring: snapshot?.progress?.ring ?? null,
      offhand: snapshot?.progress?.offhand ?? snapshot?.progress?.hands ?? null,
      addons: Object.fromEntries(['head', 'chest', 'legs', 'feet', 'hands'].map((slot) => {
        const id = snapshot?.progress?.addons?.[slot];
        return [slot, ADDONS[id]?.addonSlot === slot ? id : null];
      })),
    },
    dirty: false,
    elapsed: 0,
    rootWave: null,
    rootReadyAt: snapshot?.progress?.ringCooldown ?? 0,
    worldTime: snapshot?.worldTime ?? START_WORLD_TIME,
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
  world.placedRopes = [];
  for (const rope of snapshot?.world.placedRopes ?? []) {
    if (!Number.isInteger(rope?.tx) || !Number.isInteger(rope?.top) ||
      !Number.isInteger(rope?.bottom) || rope.bottom - rope.top !== 6 ||
      rope.tx < 1 || rope.tx >= COLS - 1 || rope.top < 1 || rope.bottom >= ROWS ||
      world.placedRopes.length >= 50) continue;
    const placed = { tx: rope.tx, top: rope.top, bottom: rope.bottom, kind: 'rope', placed: true };
    if (!world.placedRopes.some((other) => other.tx === placed.tx && other.top === placed.top)) {
      world.placedRopes.push(placed);
      world.caveClimbs.push(placed);
    }
  }
  if (snapshot?.world.krakenDefeated) {
    world.krakenDefeated = true;
    world.mobs = world.mobs.filter((mob) => mob.kind !== 'kraken' || mob.testSpawn);
  }
  game.chests = restoreChests(world, snapshot?.world.chests, snapshot?.world.pendingWreckLoot, game.weatherSeed);
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
  game.player.addons = game.progress.addons;
  game.player.perfectArmor = Boolean(game.player.armor && snapshot?.perfectArmor);
  game.player.skillBonuses = skillBonuses(game.classes);
  activateWard(game.player, true);
  game.world.soulRewards = snapshot?.world?.soulRewards ?? [];
  game.player.glowSeconds = Math.max(0, snapshot?.progress?.glowSeconds ?? 0);
  syncMobs(world, game.player);
  return game;
}

export function resetRoomProgress(previous) {
  const world = previous.world;
  world.harvested.clear();
  world.coralSongProgress = 0;
  world.soulRewards = [];
  for (const [tx, ty, material] of editedTiles(world)) {
    const uprooted = material === MATERIAL.air && rootedKelpAt(world, tx, ty);
    if (uprooted) world.harvested.add(uprooted.id);
  }
  world.items = world.items.filter((item) => world.fixtureIds.has(item.id));
  world.mobs = generateMobs();
  world.krakenDefeated = false;
  world.ambientCells?.clear();
  world.projectiles = [];
  const player = spawn(world, BREATH_SECONDS);
  const addons = { head: null, chest: null, legs: null, feet: null, hands: null };
  player.addons = addons;
  syncMobs(world, player);
  return {
    world,
    inventory: new Inventory(),
    chests: restoreChests(world, undefined, undefined, previous.weatherSeed),
    progress: { snorkel: null, ring: null, offhand: null, addons },
    classes: createClassProgress(),
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
        if (mob.health <= 0 || mob.respawn > 0 || arrow.hitMobs?.has(mob)) continue;
        const spec = mobSpec(mob);
        if (!spec) continue;
        const hit = mob.segments?.length
          ? mob.segments.some((seg) => Math.hypot(arrow.x - seg.x, arrow.y - seg.y) <= seg.radius + 4)
          : Math.hypot(arrow.x - mob.x, arrow.y - (mob.y + spec.centerY)) <= spec.radius * (mob.inflateScale ?? 1) + 4;
        if (hit) {
          const damage = arrow.damage + ((mob.rooted || 0) > 0 ? arrow.rootedDamage || 0 : 0);
          strikeMob(game, mob, damage, Math.atan2(arrow.dy, arrow.dx), arrow.knockback, true);
          arrow.hitMobs?.add(mob);
          if (arrow.poisonDuration > 0 && mob.health > 0) {
            mob.poison = Math.max(mob.poison ?? 0, arrow.poisonDuration);
            mob.poisonTick = mob.poisonTick ?? 1;
          }
          if ((arrow.pierce || 0) > 0) {
            arrow.pierce--;
            continue;
          }
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
  const buffs = player.skillBonuses || {};
  const healed = Math.min(KELP_DRESSING.heal * (1 + (buffs.healBoost || 0)), MAX_HEALTH - player.health);
  const afflicted = (player.bleed || 0) > 0 || (player.neurotoxin || 0) > 0 ||
    (player.stun || 0) > 0 || (player.confused || 0) > 0 ||
    (player.poison || 0) > 0 || (player.blindness || 0) > 0;
  const catalyst = (buffs.catalystSeconds || 0) > 0;
  if (healed < 1 && !(buffs.cleanse && afflicted) && !(catalyst && !(player.catalystSeconds > 0))) {
    return { message: 'Health is already full.' };
  }
  inventory.consume(inventory.hotbar, slot, 1);
  player.health += healed;
  if (buffs.cleanse) {
    player.bleed = 0;
    player.bleedTick = 0;
    player.neurotoxin = 0;
    player.poison = 0;
    player.poisonTick = 0;
    player.blindness = 0;
    player.stun = 0;
    player.confused = 0;
    player.confusedStyle = null;
  }
  if (catalyst) player.catalystSeconds = Math.max(player.catalystSeconds || 0, buffs.catalystSeconds);
  game.dirty = true;
  return { inventoryChanged: true, message: 'Remedy used' +
    (healed ? ': +' + Math.round(healed) + ' health' : '') +
    (catalyst ? ' and invigorated for ' + buffs.catalystSeconds + 's' : '') + '.' };
}

export function useFood(game, slot, random = Math.random) {
  const { player, inventory } = game;
  const id = inventory.hotbar[slot]?.id;
  const food = FOODS[id];
  if (!food) return;

  let restored;
  let unit;
  if (food.heal) {
    const missing = MAX_HEALTH - player.health;
    if (missing <= 0) return { message: 'Health is already full.' };
    restored = Math.min(food.heal, missing);
    player.health += restored;
    unit = 'health';
  } else if (food.oxygen) {
    const capacity = oxygenCapacity(game);
    const missing = capacity - player.oxygen;
    if (missing <= 0) return { message: 'Oxygen is already full.' };
    restored = Math.min(food.oxygen, missing);
    player.oxygen += restored;
    unit = 'seconds of oxygen';
  } else {
    return;
  }

  inventory.consume(inventory.hotbar, slot, 1);
  const poisoned = Boolean(food.poisonChance && random() < food.poisonChance);
  if (poisoned) {
    player.poison = Math.max(player.poison ?? 0, food.poisonDuration ?? 5);
  }
  game.dirty = true;
  const amountText = Number.isInteger(restored) ? String(restored) : restored.toFixed(1).replace(/\.0$/, '');
  return {
    inventoryChanged: true,
    poisoned,
    message: food.name + ' restored ' + amountText + ' ' + unit + (poisoned ? ' — poisoned for ' + (food.poisonDuration ?? 5) + 's!' : '.'),
  };
}

export function useWeapon(game, slot, wx, wy, draw = null) {
  const itemId = game.inventory.hotbar[slot]?.id;
  const item = ITEMS[itemId];
  const weapon = item?.weapon;
  if (game.attack || game.player.counterTime > 0 || wardenAttackBlocked(game.player)) return { handled: true };

  const ox = game.player.x;
  const oy = game.player.y + Math.ceil(game.player.height / 2);
  const angle = wx === ox && wy === oy ? (game.player.facing < 0 ? Math.PI : 0) : Math.atan2(wy - oy, wx - ox);
  if (weapon?.id !== BOW.id) {
    const duration = (weapon?.cooldown ?? 0.28) * 1.4;
    const facing = Math.sign(wx - ox) || game.player.facing;
    game.player.facing = facing;
    game.attack = {
      kind: weapon?.id ?? 'melee', angle, facing, timer: duration, duration,
      tier: item?.pickaxe, damage: skillAttackDamage(game.player, (weapon?.damage ?? 1) * (item?.perfectWeapon ? 1.15 : 1), false, Boolean(weapon)), knockback: weapon?.knockback, hitMobs: new Set(),
    };
    return { handled: true };
  }

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  game.player.facing = dirX < 0 ? -1 : 1;
  const ammo = game.inventory.count(POISON_ARROW.id) > 0
    ? POISON_ARROW
    : game.inventory.count(ARROW.id) > 0
      ? ARROW
      : null;
  if (!ammo) {
    return { handled: true, message: 'Out of arrows. Craft more in Crafting.' };
  }
  game.inventory.spend(ammo.id, 1);
  game.dirty = true;
  const buffs = game.player.skillBonuses || {};
  const cooldown = weapon.cooldown / (1 + (buffs.bowCooldown || 0));
  const extra = Boolean(draw?.extra);
  const power = draw ? .5 + .5 * Math.min(1, draw.elapsed / BOW.drawTime) : 1;
  const arrowSpeed = ammo.speed * (1 + (buffs.arrowSpeed || 0)) * (extra ? 1.25 : 1) * power;
  game.attack = { kind: BOW.id, angle, timer: cooldown, duration: cooldown };
  game.projectiles.push({
    x: ox + dirX * 10,
    y: oy + dirY * 10,
    dx: dirX * arrowSpeed,
    dy: dirY * arrowSpeed,
    damage: skillAttackDamage(game.player, ammo.damage * power * (item?.perfectWeapon ? 1.15 : 1), true),
    rootedDamage: buffs.rootedDamage || 0,
    pierce: (buffs.arrowPierce || 0) + Number(extra),
    charged: extra,
    hitMobs: new Set(),
    knockback: ammo.knockback,
    poisonDuration: ammo.poisonDuration ?? 0,
    life: 2.5,
  });
  return { handled: true, inventoryChanged: true };
}

export function beginBowDraw(game, slot, wx, wy) {
  if (ITEMS[game.inventory.hotbar[slot]?.id]?.weapon?.id !== BOW.id) return false;
  if (game.attack || game.bowDraw || wardenAttackBlocked(game.player) || game.player.counterTime > 0) return true;
  if (!game.inventory.count(ARROW.id) && !game.inventory.count(POISON_ARROW.id)) return { message: 'Out of arrows. Craft more in Crafting.' };
  game.bowDraw = { slot, id: game.inventory.hotbar[slot].id, elapsed: 0, wx, wy };
  aimBow(game, wx, wy);
  return true;
}
export function aimBow(game, wx, wy) {
  const draw = game.bowDraw;
  if (!draw) return;
  draw.wx = wx; draw.wy = wy;
  const p = game.player;
  draw.angle = Math.atan2(wy - p.y - Math.ceil(p.height / 2), wx - p.x);
  p.facing = Math.cos(draw.angle) < 0 ? -1 : 1;
}
export function releaseBowDraw(game) {
  const draw = game.bowDraw;
  game.bowDraw = null;
  if (!draw || game.inventory.hotbar[draw.slot]?.id !== draw.id || wardenAttackBlocked(game.player) || game.player.stun > 0 || game.player.flightOrigin) return;
  return useWeapon(game, draw.slot, draw.wx, draw.wy, {
    elapsed: draw.elapsed, extra: Boolean(game.player.skillBonuses?.extraDraw && draw.elapsed >= BOW.drawTime + 1 - 1e-6),
  });
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
      strikeMob(game, mob, attack.damage, angle, attack.knockback);
    }
  }
}

function stepDroppedChests(game, dt) {
  for (const item of game.world.items) {
    if (item.kind !== 'chest') continue;
    if (!game.chests.has(item.id)) {
      const newLoot = item.chestType === 'wild'
        ? rollWildChestGroupLoot(game.world.items.filter((fixture) => fixture.chestType === 'wild'), game.weatherSeed).get(item.id)
        : [item.loot];
      game.chests.set(item.id, restoreSlots(newLoot, CHEST_SIZE));
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
  if (player.downed) {
    game.elapsed += dt;
    settleDowned(world, player, dt);
    const state = advanceRevival(player, input.multiplayer ? (game.wayfarerPeers ?? []) : [], dt, input.now ?? 0);
    if (state === 'revive') {
      player.downed = null;
      player.health = MAX_HEALTH / 2;
      player.oxygen = oxygenCapacity(game);
      player.hurt = 0;
      game.dirty = true;
      return 'Revived by a teammate.';
    }
    if (state === 'respawn') return respawnAfterDeath(game);
    return;
  }
  if (player.hook && !hasHook(game)) player.hook = null;
  const capacity = oxygenCapacity(game);
  const { x, y, health, oxygen } = player;
  stepWardenBefore(game, input, dt);
  stepWayfarer(game, input, dt);
  const fallDamage = movePlayer(world, player, input, dt);
  stepWardenAfter(game, x, dt);
  if (player.glowSeconds > 0) player.glowSeconds = Math.max(0, player.glowSeconds - dt);
  let fallLoss = 0;
  if (fallDamage) {
    fallLoss = takeDamage(player, Math.max(0, Math.round(fallDamage * (player.addons?.legs === 'padded-leg-wraps' ? 0.85 : 1) * (1 - (player.skillBonuses?.fall ?? 0)) * catchFallMultiplier(game))));
    player.hurt = Math.max(player.hurt, 0.85);
  }
  const fatalFall = fallLoss > 0 && player.health === 0;
  stepAttack(game, dt);
  game.elapsed += dt;
  const hit = stepMobs(world, player, dt, game.elapsed, input.mining, input.night, game.enemies, game.effects);
  stepClassEffects(game, dt);
  stepRootWave(game, dt);
  stepDroppedChests(game, dt);
  let soulMessage = null;
  for (const reward of [...(world.soulRewards ?? [])]) {
    if (game.classes.claimed.includes(reward.id)) {
      world.soulRewards.splice(world.soulRewards.indexOf(reward), 1);
      continue;
    }
    const soulItem = SOUL_ITEMS[reward.type];
    if (!game.inventory.add(soulItem, 1)) continue;
    game.classes.claimed.push(reward.id);
    world.soulRewards.splice(world.soulRewards.indexOf(reward), 1);
    game.dirty = true;
    soulMessage = 'A ' + (reward.type === 'greater' ? 'Greater' : 'Lesser') + ' Soul entered your backpack.';
  }
  stepProjectiles(game, dt);
  stepCaveTraps(world, player, game.elapsed, dt, game.effects, (mob, x) => {
    damageMob(world, mob, 4, mob.x >= x ? 0 : Math.PI, 65, game.effects);
  });
  for (const effect of game.effects) {
    if (!effect.drop || effect.collected) continue;
    effect.collected = true;
    const added = game.inventory.add(effect.drop.id, effect.drop.count);
    const itemName = ITEMS[effect.drop.id]?.name ?? effect.drop.id;
    if (added) {
      game.dirty = true;
      effect.inventoryChanged = true;
      effect.message = `${effect.message} Got ${itemName.toLowerCase()}.`;
    } else {
      effect.message = `${effect.message} Inventory full!`;
    }
  }
  stepBleed(player, dt, game.effects);
  stepPoison(player, dt, game.effects);
  if (player.health > 0) player.health = Math.min(MAX_HEALTH, player.health + (player.skillBonuses?.regen ?? 0) * dt);
  const fatalBleed = (player.bleed ?? 0) > 0 && player.health === 0;
  const fatalPoison = (player.poison ?? 0) > 0 && player.health === 0;
  if (hit) {
    player.hurt = Math.max(player.hurt ?? 0, 0.85);
    takeDamage(player, hit.healthLoss ?? 10);
    player.oxygen = Math.max(0, player.oxygen - hit.airLoss);
  }
  finishWayfarer(game,dt);
  if (updateOxygen(world, player, dt, capacity, game.enemies.hitCooldown === 0)) {
    player.health = 0;
    player.downed = { id: globalThis.crypto.randomUUID(), remaining: input.multiplayer ? MULTIPLAYER_DEATH_SECONDS : SOLO_DEATH_SECONDS, progress: 0, reviver: null };
    Object.assign(player, { dx: 0, climb: null, hook: null, hurt: 0, stun: 0, confused: 0, confusedGrace: 0, bleed: 0, bleedTick: 0, poison: 0, poisonTick: 0, blindness: 0, neurotoxin: 0, rushTime: 0, rageTime: 0, aegisTime: 0, cryTime: 0, counterTime: 0, catching: false, bracing: false });
    game.attack = null;
    game.bowDraw = null;
    game.projectiles.length = 0;
    game.rootWave = null;
    game.dirty = true;
    return fatalFall ? 'Fatal fall.' : fatalBleed ? 'You bled out.' : fatalPoison ? 'You succumbed to poison.' : 'You are down.';
  }
  finishWardenStep(player, dt);
  if (player.x !== x || player.y !== y || player.health !== health || player.oxygen !== oxygen) game.dirty = true;
  if (hit) return hit.name + ' bite. −' + (hit.healthLoss ?? 10) + ' health';
  if (soulMessage) return soulMessage;
  if (fallLoss) return `Hard landing. −${fallLoss} health`;
}

function respawnAfterDeath(game) {
    const { world, player } = game;
    game.player = spawn(world, oxygenCapacity(game), player.appearance, player.armor, player.feet);
    game.player.addons = game.progress.addons;
    game.player.perfectArmor = player.perfectArmor;
    game.player.damageSequence = player.damageSequence;
    game.player.wardenCooldowns = player.wardenCooldowns;
    game.player.skillBonuses = skillBonuses(game.classes);
    activateWard(game.player, true);
    game.player.glowSeconds = player.glowSeconds;
    game.attack = null;
    game.bowDraw = null;
    game.projectiles.length = 0;
    game.rootWave = null;
    resetHostiles(world);
    game.dirty = true;
    return 'You woke up back on the island.';
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

function restoreChests(world, saved, pendingWreckLoot, worldSeed) {
  const chests = new Map();
  const wildContents = rollWildChestGroupLoot(world.items.filter((item) => item.chestType === 'wild'), worldSeed);
  world.pendingWreckLoot.clear();
  for (const item of world.items) {
    if (item.kind !== 'chest') continue;
    const savedSlots = saved?.[item.id];
    const hasSavedSlots = Array.isArray(savedSlots);
    const initialLoot = item.chestType === 'wild'
      ? wildContents.get(item.id)
      : world.harvested.has(item.id) ? [] : [item.loot];
    const slots = restoreSlots(hasSavedSlots ? savedSlots : initialLoot, CHEST_SIZE);
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
  const realChest = game.world.items.find((item) => item.kind === 'chest' &&
    Math.abs(x - item.x) < 12 && y >= item.y - 11 && y < item.y + 8 &&
    itemDistance(game.player, item) < INTERACTION_RANGE);
  if (realChest) return realChest;
  const mimic = game.world.mobs?.find((mob) => mob.kind === 'mimic' && !mob.awakened &&
    mob.health > 0 && !(mob.respawn > 0) &&
    Math.abs(x - mob.x) < 12 && y >= (mob.y - 8) - 11 && y < (mob.y - 8) + 8 &&
    itemDistance(game.player, { x: mob.x, y: mob.y - 8 }) < INTERACTION_RANGE);
  return mimic && { id: mimic.id, kind: 'mimic', name: 'Chest', mob: mimic, x: mimic.x, y: mimic.y - 8 };
}

export function equippedAddon(game, slot) {
  return ADDONS[game.progress.addons?.[slot]] ?? null;
}

const EQUIP_SLOTS = {
  head: { items: SNORKELS, get: equippedSnorkel, set: setSnorkel },
  feet: { items: FEET_GEAR, get: equippedFeet, set: setFeet },
  ring: { items: { [ROOT_RING.id]: ROOT_RING }, get: equippedRing, set: (game, id) => { game.progress.ring = id; } },
  offhand: { items: { [GRAPPLING_HOOK.id]: GRAPPLING_HOOK, [WOODEN_SHIELD.id]: WOODEN_SHIELD }, get: (game) => equippedHook(game) ?? (game.progress.offhand === WOODEN_SHIELD.id ? WOODEN_SHIELD : null), set: (game, id) => { game.progress.offhand = id; } },
  ...Object.fromEntries(['head', 'chest', 'legs', 'feet', 'hands'].map((slot) => ['addon-' + slot, {
    items: Object.fromEntries(Object.values(ADDONS).filter((addon) => addon.addonSlot === slot).map((addon) => [addon.id, addon])),
    get: (game) => equippedAddon(game, slot),
    set: (game, id) => { game.progress.addons[slot] = id; },
  }])),
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

function stationAt(game, tx, ty, material, kind) {
  if (tileAt(game.world, tx, ty) !== material) return;
  const item = { kind, name: ITEMS[kind].name, tx, ty, x: (tx + .5) * TILE, y: (ty + .5) * TILE };
  if (itemDistance(game.player, item) < INTERACTION_RANGE) return item;
}

export function workbenchAt(game, tx, ty) {
  return stationAt(game, tx, ty, MATERIAL.workbench, WORKBENCH.id);
}

export function fireplaceAt(game, tx, ty) {
  const placed = stationAt(game, tx, ty, MATERIAL.fireplace, FIREPLACE.id);
  if (placed) return placed;
  const villageCampfire = jungleVillageStructures.find(([, kind]) => kind === 'campfire');
  if (!villageCampfire) return;
  const [, , column, floor] = villageCampfire;
  const vtx = column + WEST_EXTENSION;
  if (tx === vtx && ty === floor - 1 && tileAt(game.world, vtx, floor)) {
    const item = { kind: FIREPLACE.id, name: ITEMS[FIREPLACE.id].name, tx: vtx, ty: floor - 1, x: (vtx + .5) * TILE, y: (floor - 0.5) * TILE };
    if (itemDistance(game.player, item) < INTERACTION_RANGE) return item;
  }
}

export function nearestItem(game) {
  const { player, world } = game;
  let result;
  let distance = INTERACTION_RANGE;
  for (const item of world.items) {
    if (item.kind !== 'chest' && item.kind !== 'mermaid') continue;
    const difference = itemDistance(player, item);
    if (difference < distance) {
      distance = difference;
      result = item;
    }
  }
  for (const mob of world.mobs ?? []) {
    if (mob.kind !== 'mimic' || mob.awakened || mob.health <= 0 || mob.respawn > 0) continue;
    const mimicItem = { id: mob.id, kind: 'mimic', name: 'Chest', mob, x: mob.x, y: mob.y - 8 };
    const difference = itemDistance(player, mimicItem);
    if (difference < distance) {
      distance = difference;
      result = mimicItem;
    }
  }
  const row = player.y + Math.ceil(player.height / 2);
  const left = Math.floor((player.x - distance) / TILE);
  const right = Math.floor((player.x + distance) / TILE);
  const top = Math.floor((row - distance) / TILE);
  const bottom = Math.floor((row + distance) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const station = workbenchAt(game, tx, ty) ?? fireplaceAt(game, tx, ty);
      if (!station) continue;
      const difference = itemDistance(player, station);
      if (difference < distance) {
        distance = difference;
        result = station;
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

function craftResult(game, recipe, activeStation, outputId = recipe.id) {
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
  return upgrade || after.add(outputId, amount, { preferHotbar: true }) ? { inventory: after, upgrade } : null;
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

export function craftItem(game, recipe, station, random = Math.random) {
  if (recipe.equipment) {
    if (!canCraftItem(game, recipe, station)) return false;
    for (const [id, count] of Object.entries(recipe.cost)) game.inventory.spend(id, count);
    game.player.armor = recipe.id;
    game.player.perfectArmor = random() < (game.player.skillBonuses?.perfectArmor ?? 0);
    game.dirty = true;
    return true;
  }
  const perfectId = 'perfect-' + recipe.id;
  const perfect = Boolean(ITEMS[perfectId] && game.player.skillBonuses?.perfectWeapon && random() < game.player.skillBonuses.perfectWeapon);
  const result = craftResult(game, recipe, station, perfect ? perfectId : recipe.id);
  if (!result) return false;
  game.inventory = result.inventory;
  if (perfect) game.effects.push({ x: game.player.x, y: game.player.y, color: '#ffe5a2', count: 8, spread: 25, message: 'Perfect Weapon forged! +15% damage.' });
  if (result.upgrade) setSnorkel(game, recipe.id);
  game.dirty = true;
  return true;
}

export function grantItem(game, id, count) {
  if (!Number.isSafeInteger(count) || count < 1) return false;
  if (Object.hasOwn(ARMOR, id)) {
    game.player.armor = id;
    game.player.perfectArmor = false;
  } else if (id === GRAPPLING_HOOK.id && !game.progress.offhand) {
    game.progress.offhand = GRAPPLING_HOOK.id;
    if (count > 1 && !game.inventory.add(id, count - 1, { preferHotbar: true })) return false;
  } else if (!game.inventory.add(id, count, { preferHotbar: true })) return false;
  game.dirty = true;
  return true;
}

export function useUtilityItem(game, slot, target) {
  const inventory = game.inventory;
  const held = inventory.hotbar[slot]?.id;
  if (held === SOUL_ITEMS.lesser || held === SOUL_ITEMS.greater) {
    const type = held === SOUL_ITEMS.lesser ? 'lesser' : 'greater';
    const error = absorbSouls(game, type, 1);
    return { inventoryChanged: !error, message: error ?? 'Soul attuned. Open Skill Tree to spend its power.' };
  }
  if (held === 'glowshroom-torch') {
    inventory.consume(inventory.hotbar, slot, 1);
    const duration = 90 * (1 + (game.player.skillBonuses?.torchDuration || 0));
    game.player.glowSeconds = Math.max(game.player.glowSeconds ?? 0, duration);
    game.dirty = true;
    return { inventoryChanged: true, message: 'Glowshroom lit for ' + Math.round(duration) + ' seconds.' };
  }
  if (held !== 'rope-bundle') return null;
  if (!target?.reachable) return { message: 'Aim near a ledge to hang a six-block rope.' };
  const { world } = game;
  const { tx, ty } = target;
  const pathClear = tx > 0 && tx < COLS - 1 && ty > 0 && ty + 6 < ROWS &&
    !solidAt(world, tx, ty - 1) &&
    Array.from({ length: 7 }, (_, offset) => ty + offset)
      .every((row) => !solidAt(world, tx, row) && !inWater(world, (tx + 0.5) * TILE, (row + 0.5) * TILE));
  let walls = 0;
  if (pathClear) {
    for (let row = ty; row <= ty + 6; row++) {
      if (solidAt(world, tx - 1, row) || solidAt(world, tx + 1, row)) walls++;
    }
  }
  if (!pathClear || walls < 2 || world.caveClimbs.some((climb) =>
    climb.tx === tx && climb.top <= ty + 6 && climb.bottom >= ty))
    return { message: 'Need six clear blocks beside a rock ledge for the rope.' };
  const rope = { tx, top: ty, bottom: ty + 6, kind: 'rope', placed: true };
  world.placedRopes.push(rope);
  world.caveClimbs.push(rope);
  inventory.consume(inventory.hotbar, slot, 1);
  game.dirty = true;
  return { inventoryChanged: true, message: 'Rope secured along the ledge.' };
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
  const duration = (tier ? rule.pickaxe * (ITEMS[tool].miningTime ?? 1) : rule.hand) *
    (equippedAddon(game, 'hands')?.miningSpeed ? 1 - equippedAddon(game, 'hands').miningSpeed : 1) *
    (1 - (game.player.skillBonuses?.mine ?? 0));
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
    game.player.addons = game.progress.addons;
    game.player.skillBonuses = skillBonuses(game.classes);
    activateWard(game.player, true);
    game.player.glowSeconds = player.glowSeconds;
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
