import { MATERIAL } from './content.js';

export const HOTBAR_SIZE = 4;
export const BACKPACK_SIZE = 24;

export const ITEMS = {
  tool: { name: 'Salvage tool', hotbar: 0 },
  sand: { name: 'Sand', block: MATERIAL.sand, hotbar: 1 },
  stone: { name: 'Stone', block: MATERIAL.stone, hotbar: 2 },
  wood: { name: 'Wood', block: MATERIAL.wood, hotbar: 3 },
  door: { name: 'Wooden door' },
  kelp: { name: 'Kelp' },
  copper: { name: 'Copper ore' },
  iron: { name: 'Iron ore' },
  cobalt: { name: 'Cobalt ore' },
};

function restoreSlots(slots, size) {
  return Array.from({ length: size }, (_, index) => {
    const stack = slots?.[index];
    if (!stack || !Object.hasOwn(ITEMS, stack.id) || !Number.isSafeInteger(stack.count) || stack.count < 1) return null;
    return { id: stack.id, count: stack.count };
  });
}

export class Inventory {
  constructor(saved) {
    this.hotbar = restoreSlots(saved?.hotbar, HOTBAR_SIZE);
    this.backpack = restoreSlots(saved?.backpack, BACKPACK_SIZE);
    if (Array.isArray(saved?.hotbar) && Array.isArray(saved?.backpack)) return;

    this.add('tool', 1);
    for (const id of Object.keys(ITEMS)) {
      if (id === 'tool') continue;
      const count = saved?.[id];
      if (Number.isSafeInteger(count) && count >= 0) this.add(id, count);
      else if (id === 'wood') this.add(id, 3);
    }
  }

  add(id, count) {
    if (!Object.hasOwn(ITEMS, id) || !Number.isSafeInteger(count) || count < 1) return false;
    const existing = [...this.hotbar, ...this.backpack].find((stack) => stack?.id === id);
    if (existing) {
      if (!Number.isSafeInteger(existing.count + count)) return false;
      existing.count += count;
      return true;
    }

    const preferred = ITEMS[id].hotbar;
    const empty = this.backpack.indexOf(null);
    const spare = this.hotbar.indexOf(null);
    const stack = { id, count };
    if (preferred !== undefined && this.hotbar[preferred] === null) this.hotbar[preferred] = stack;
    else if (empty !== -1) this.backpack[empty] = stack;
    else if (spare !== -1) this.hotbar[spare] = stack;
    else return false;
    return true;
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
    const stack = source[from.index];
    const replacement = target[to.index];
    if (!stack || stack === replacement) return false;
    if (stack.id === replacement?.id) {
      if (!Number.isSafeInteger(stack.count + replacement.count)) return false;
      replacement.count += stack.count;
      source[from.index] = null;
    } else {
      target[to.index] = stack;
      source[from.index] = replacement;
    }
    return true;
  }
}
