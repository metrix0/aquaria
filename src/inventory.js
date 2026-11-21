import { ADDONS, ARMOR, ARROW, BOW, BROKEN_PICKAXE, CAPTAINS_CUTLASS, COBALT_SPEAR, COPPER_PICKAXE, COPPER_SPEAR, FEET_GEAR, IRON_PICKAXE, IRON_SWORD, KELP_DRESSING, MATERIAL, SNORKELS, SPEAR, WORKBENCH, normalizeSnorkel } from './content.js';
import { TILE } from './world/generation.js';

export const HOTBAR_SIZE = 6;
export const BACKPACK_SIZE = 24;

export const ROOT_RING = { id: 'root-ring', name: 'Root ring', cooldown: 18, description: 'A living knot from the grove. It remembers what trespassers sound like.' };
export const GRAPPLING_HOOK = {
  id: 'grappling-hook',
  name: 'Grappling hook',
  range: 18 * TILE,
  speed: 480,
  pullSpeed: 330,
  description: 'An iron-clawed climber’s line. Fires where you aim and hauls you to solid rock.',
};

export const ITEMS = {
  [BROKEN_PICKAXE.id]: {
    name: 'Broken Pickaxe', description: 'One tooth left. The mountain still counts it.', hotbar: 0, pickaxe: 1,
  },
  [COPPER_PICKAXE.id]: {
    name: 'Copper pickaxe', description: 'Rings like a harbor bell on the first strike.', pickaxe: 2,
  },
  [IRON_PICKAXE.id]: {
    name: 'Iron pickaxe', description: 'Miners say you can hear it grinning in the dark.', pickaxe: 3, miningTime: IRON_PICKAXE.miningTime,
  },
  [ROOT_RING.id]: ROOT_RING,
  [GRAPPLING_HOOK.id]: GRAPPLING_HOOK,
  'explorers-map': { name: 'Weathered explorer’s map', description: 'The ink survived the sea. The warnings in the margins nearly didn’t.' },
  [KELP_DRESSING.id]: { name: 'Kelp dressing', description: 'A tidewitch’s remedy. Cold, slimy, and annoyingly effective.' },
  [CAPTAINS_CUTLASS.id]: {
    name: CAPTAINS_CUTLASS.name, description: 'The captain went down with the ship. His grudges came back up.', weapon: CAPTAINS_CUTLASS,
  },
  [IRON_SWORD.id]: { name: 'Iron sword', description: 'The smith etched a prayer on the edge, where it would do the most good.', weapon: IRON_SWORD },
  [COBALT_SPEAR.id]: { name: 'Cobalt spear', description: 'A blue glint is often the last thing a cave beast sees.', weapon: COBALT_SPEAR },
  [SPEAR.id]: { name: 'Spear', description: 'A stone tooth on a shaft. Every village’s first answer to a monster.', weapon: SPEAR },
  [COPPER_SPEAR.id]: { name: 'Copper spear', description: 'Shore guards polish the tip so trouble can see itself coming.', weapon: COPPER_SPEAR },
  [BOW.id]: { name: 'Bow', description: 'Driftwood bent low and strung with kelp. It sings on the release.', weapon: BOW },
  [ARROW.id]: { name: 'Arrow', description: 'Stone-tipped and straight enough for a smuggler’s oath.' },
  sand: { name: 'Sand', description: 'A handful of beach that will outlive every attempt to shake it out.', block: MATERIAL.sand, hotbar: 1 },
  stone: { name: 'Stone', description: 'Cold and stubborn. Dwarves have been accused of worse.', block: MATERIAL.stone, hotbar: 2 },
  wood: { name: 'Wood', description: 'The grain curls like a tiny chart of the sea.', block: MATERIAL.wood, hotbar: 3 },
  door: { name: 'Wooden door', description: 'A good door makes even a rented cave feel like a castle.' },
  [WORKBENCH.id]: { name: 'Workbench', description: 'Its legs are uneven. Its claim to have built a kingdom is unproven.', block: MATERIAL.workbench },
  ...SNORKELS,
  ...FEET_GEAR,
  ...ADDONS,
  'rusty-metal-scraps': { name: 'Rusty metal scraps', description: 'Twisted armor fragments; smelt four at a workbench for copper.' },
  'torn-cloth': { name: 'Torn cloth', description: 'Old expedition fabric. Three pieces braid into a rope bundle.' },
  'broken-gears': { name: 'Broken gears', description: 'Worn-down machine parts; salvage three at a workbench for iron.' },
  'ancient-coins': { name: 'Ancient coins', description: 'Weathered currency from a forgotten settlement. Valuable to collectors, eventually.' },
  'glowshroom-torch': { name: 'Glowshroom torch', description: 'Use from your hotbar for 90 seconds of brighter cave light.' },
  'rope-bundle': { name: 'Rope bundle', description: 'Use near a clear ledge to hang six blocks of rope.' },
  kelp: { name: 'Kelp', description: 'Sailors call it mermaid’s ribbon. Mermaids have lodged complaints.' },
  copper: { name: 'Copper ore', description: 'Little flecks of sunset trapped in stone.' },
  iron: { name: 'Iron ore', description: 'An old forge song calls it the bones of the earth.' },
  cobalt: { name: 'Cobalt ore', description: 'A vein of midnight blue. The deep keeps its finest colors to itself.' },
};

export const EQUIPMENT_ITEMS = ARMOR;

export function restoreSlots(slots, size) {
  return Array.from({ length: size }, (_, index) => {
    const stack = slots?.[index];
    const id = stack?.id === 'tool' ? BROKEN_PICKAXE.id : normalizeSnorkel(stack?.id) ?? stack?.id;
    if (!Object.hasOwn(ITEMS, id) || !Number.isSafeInteger(stack.count) || stack.count < 1) return null;
    return { id, count: stack.count };
  });
}

export class Inventory {
  constructor(saved) {
    this.hotbar = restoreSlots(saved?.hotbar, HOTBAR_SIZE);
    this.backpack = restoreSlots(saved?.backpack, BACKPACK_SIZE);
    if (Array.isArray(saved?.hotbar) && Array.isArray(saved?.backpack)) return;

    this.add(BROKEN_PICKAXE.id, 1);
    for (const id of Object.keys(ITEMS)) {
      if (id === BROKEN_PICKAXE.id) continue;
      const count = saved?.[id];
      if (Number.isSafeInteger(count) && count >= 0) this.add(id, count);
      else if (id === 'wood') this.add(id, 3);
    }
  }

  add(id, count, { preferHotbar = false } = {}) {
    if (!Object.hasOwn(ITEMS, id) || !Number.isSafeInteger(count) || count < 1) return false;
    const preferred = ITEMS[id].hotbar;
    const preferredFree = preferred !== undefined && this.hotbar[preferred] === null;
    const hotbarSlot = preferredFree ? preferred : this.hotbar.indexOf(null);
    const existing = this.hotbar.find((stack) => stack?.id === id) ??
      ((!preferHotbar || hotbarSlot === -1) ? this.backpack.find((stack) => stack?.id === id) : undefined);
    if (existing) {
      if (!Number.isSafeInteger(existing.count + count)) return false;
      existing.count += count;
      return true;
    }

    const backpackSlot = this.backpack.indexOf(null);
    const stack = { id, count };
    if (hotbarSlot !== -1 && (preferHotbar || preferredFree || backpackSlot === -1)) this.hotbar[hotbarSlot] = stack;
    else if (backpackSlot !== -1) this.backpack[backpackSlot] = stack;
    else return false;
    return true;
  }

  bestPickaxe(slot) {
    const held = this.hotbar[slot]?.id;
    let tool = ITEMS[held]?.pickaxe ? held : undefined;
    for (const slots of [this.hotbar, this.backpack]) {
      for (const stack of slots) {
        const id = stack?.id;
        if ((ITEMS[id]?.pickaxe ?? 0) > (ITEMS[tool]?.pickaxe ?? 0)) tool = id;
      }
    }
    return tool;
  }

  canAdd(id, count) {
    return new Inventory(this).add(id, count);
  }

  count(id) {
    return [...this.hotbar, ...this.backpack].reduce((total, stack) => total + (stack?.id === id ? stack.count : 0), 0);
  }

  spend(id, count) {
    for (const slots of [this.backpack, this.hotbar]) {
      for (const [index, stack] of slots.entries()) {
        if (stack?.id !== id) continue;
        const consumed = Math.min(count, stack.count);
        this.consume(slots, index, consumed);
        count -= consumed;
        if (count === 0) return;
      }
    }
  }

  consume(slots, index, count) {
    const stack = slots[index];
    stack.count -= count;
    if (stack.count === 0) slots[index] = null;
  }

  move(from, to) {
    const source = this[from.group];
    const target = this[to.group];
    return moveStack(source, from.index, target, to.index);
  }
}

export function moveStack(source, sourceIndex, target, targetIndex) {
  if (!source || !target ||
      !Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= source.length ||
      !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= target.length) return false;
  const stack = source[sourceIndex];
  const replacement = target[targetIndex];
  if (!stack || stack === replacement) return false;
  if (stack.id === replacement?.id) {
    if (!Number.isSafeInteger(stack.count + replacement.count)) return false;
    replacement.count += stack.count;
    source[sourceIndex] = null;
  } else {
    target[targetIndex] = stack;
    source[sourceIndex] = replacement;
  }
  return true;
}
