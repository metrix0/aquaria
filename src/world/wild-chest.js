import { WILD_CHEST_LOOT_TABLES } from '../loot.js';
export { WILD_CHEST_CATEGORIES, WILD_CHEST_LOOT_TABLES } from '../loot.js';

export function createWildChest({ id, name = 'Wild chest', x, y, lootTable = 'first-cave' }) {
  return { id, name, kind: 'chest', chestType: 'wild', lootTable, x, y };
}

function chestRandom(id, seed) {
  let value = (Number.isInteger(seed) ? seed : 0) >>> 0;
  for (let i = 0; i < id.length; i++) {
    value = Math.imul(value ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function weightedPick(entries, random) {
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let ticket = random() * weight;
  return entries.find((entry) => (ticket -= entry.weight) < 0) ?? entries.at(-1);
}

function stackFrom(entry, random) {
  return { id: entry.id, count: entry.min + Math.floor(random() * (entry.max - entry.min + 1)) };
}

export function rollWildChestLoot(chest, worldSeed, tables = WILD_CHEST_LOOT_TABLES) {
  const table = tables[chest.lootTable];
  if (!table) throw new Error('Unknown wild chest loot table: ' + chest.lootTable);
  const random = chestRandom(chest.id, worldSeed);
  const available = [...table.entries];
  const target = Math.min(available.length, table.minDrops +
    Math.floor(random() * (table.maxDrops - table.minDrops + 1)));
  const stacks = [];
  const take = (entry) => {
    stacks.push(stackFrom(entry, random));
    available.splice(available.indexOf(entry), 1);
  };
  const guaranteed = table.guaranteedPerChest;
  if (guaranteed?.length) {
    const eligible = available.filter((entry) => guaranteed.includes(entry.category));
    if (eligible.length) take(weightedPick(eligible, random));
  }
  while (stacks.length < target) take(weightedPick(available, random));
  return stacks;
}

// Runs once for the biome's chest collection, not once per chest. Guarantees
// a rare addon somewhere across the biome without creating extra chest slots.
export function rollWildChestGroupLoot(chests, worldSeed, tables = WILD_CHEST_LOOT_TABLES) {
  const contents = new Map(chests.map((chest) => [chest.id, rollWildChestLoot(chest, worldSeed, tables)]));
  const byTable = new Map();
  for (const chest of chests) {
    const group = byTable.get(chest.lootTable) ?? [];
    group.push(chest);
    byTable.set(chest.lootTable, group);
  }
  for (const [tableId, group] of byTable) {
    const table = tables[tableId];
    for (const category of table.guaranteedPerBiome ?? []) {
      const categoryIds = new Set(table.entries.filter((entry) => entry.category === category).map((entry) => entry.id));
      if (group.some((chest) => contents.get(chest.id).some((stack) => categoryIds.has(stack.id)))) continue;
      const random = chestRandom('biome:' + tableId + ':' + category, worldSeed);
      const recipient = group[Math.floor(random() * group.length)];
      const entry = weightedPick(table.entries.filter((candidate) => candidate.category === category), random);
      const stacks = contents.get(recipient.id);
      // Slot zero belongs to the per-chest utility guarantee. Preserve it.
      stacks[stacks.length - 1] = stackFrom(entry, random);
    }
  }
  return contents;
}
