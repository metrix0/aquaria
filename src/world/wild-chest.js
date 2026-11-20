// Reusable, seed-stable loot for chests found in the wild.
// Add future biomes here without changing the normal chest inventory or save format.
export const WILD_CHEST_LOOT_TABLES = Object.freeze({
  'first-cave': Object.freeze({
    minDrops: 2,
    maxDrops: 4,
    entries: Object.freeze([
      { id: 'copper', weight: 7, min: 2, max: 6 },
      { id: 'wood', weight: 6, min: 3, max: 8 },
      { id: 'arrow', weight: 5, min: 4, max: 10 },
      { id: 'stone', weight: 4, min: 3, max: 7 },
      { id: 'kelp', weight: 3, min: 1, max: 4 },
      { id: 'iron', weight: 2, min: 1, max: 3 },
      { id: 'kelp-dressing', weight: 2, min: 1, max: 2 },
    ]),
  }),
});

export function createWildChest({ id, name = 'Wild chest', x, y, lootTable = 'first-cave' }) {
  return { id, name, kind: 'chest', chestType: 'wild', lootTable, x, y };
}

function chestRandom(id, seed) {
  // Hash the chest ID into the world's existing persistent seed.
  let value = (Number.isInteger(seed) ? seed : 0) >>> 0;
  for (let index = 0; index < id.length; index++) {
    value = Math.imul(value ^ id.charCodeAt(index), 16777619) >>> 0;
  }
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function rollWildChestLoot(chest, worldSeed, tables = WILD_CHEST_LOOT_TABLES) {
  const table = tables[chest.lootTable];
  if (!table) throw new Error('Unknown wild chest loot table: ' + chest.lootTable);
  const random = chestRandom(chest.id, worldSeed);
  const entries = table.entries.slice();
  const target = Math.min(entries.length, table.minDrops +
    Math.floor(random() * (table.maxDrops - table.minDrops + 1)));
  const loot = [];

  // Weighted selection without replacement gives varied loot, not duplicate slots.
  for (let roll = 0; roll < target; roll++) {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let choice = random() * totalWeight;
    let index = entries.findIndex((entry) => (choice -= entry.weight) < 0);
    if (index < 0) index = entries.length - 1;
    const [entry] = entries.splice(index, 1);
    const count = entry.min + Math.floor(random() * (entry.max - entry.min + 1));
    loot.push({ id: entry.id, count });
  }
  return loot;
}
