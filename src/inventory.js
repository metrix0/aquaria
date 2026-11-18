import { ARMOR, ARROW, BOW, BROKEN_PICKAXE, CAPTAINS_CUTLASS, COBALT_SPEAR, COPPER_PICKAXE, COPPER_SPEAR, IRON_PICKAXE, IRON_SWORD, KELP_DRESSING, MATERIAL, SNORKEL, SNORKELS, SPEAR, WORKBENCH } from './content.js';

export const HOTBAR_SIZE = 4;
export const BACKPACK_SIZE = 24;

export const ITEMS = {
  [BROKEN_PICKAXE.id]: { name: 'Broken Pickaxe', hotbar: 0, pickaxe: 1 },
  [COPPER_PICKAXE.id]: { name: 'Copper pickaxe', pickaxe: 2 },
  [IRON_PICKAXE.id]: { name: 'Iron pickaxe', pickaxe: 3, miningTime: IRON_PICKAXE.miningTime },
  [KELP_DRESSING.id]: { name: 'Kelp dressing' },
  [CAPTAINS_CUTLASS.id]: { name: CAPTAINS_CUTLASS.name, weapon: CAPTAINS_CUTLASS },
  [IRON_SWORD.id]: { name: 'Iron sword', weapon: IRON_SWORD },
  [COBALT_SPEAR.id]: { name: 'Cobalt spear', weapon: COBALT_SPEAR },
  [SPEAR.id]: { name: 'Spear', weapon: SPEAR },
  [COPPER_SPEAR.id]: { name: 'Copper spear', weapon: COPPER_SPEAR },
  [BOW.id]: { name: 'Bow', weapon: BOW },
  [ARROW.id]: { name: 'Arrow' },
  sand: { name: 'Sand', block: MATERIAL.sand, hotbar: 1 },
  stone: { name: 'Stone', block: MATERIAL.stone, hotbar: 2 },
  wood: { name: 'Wood', block: MATERIAL.wood, hotbar: 3 },
  door: { name: 'Wooden door' },
  [WORKBENCH.id]: { name: 'Workbench', block: MATERIAL.workbench },
  [SNORKEL.id]: SNORKEL,
  kelp: { name: 'Kelp' },
  copper: { name: 'Copper ore' },
  iron: { name: 'Iron ore' },
  cobalt: { name: 'Cobalt ore' },
};

export const EQUIPMENT_ITEMS = { ...SNORKELS, ...ARMOR };

const legacyIds = { tool: BROKEN_PICKAXE.id, 'swimming-helmet': SNORKEL.id };

export function restoreSlots(slots, size) {
  return Array.from({ length: size }, (_, index) => {
    const stack = slots?.[index];
    const id = Object.hasOwn(legacyIds, stack?.id) ? legacyIds[stack.id] : stack?.id;
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
