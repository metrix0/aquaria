// Data-driven loot rules shared by Wild Chest generation and the Drops panel.
// Weights are base roll percentages, before guarantees and unique-item selection.
export const WILD_CHEST_CATEGORIES = Object.freeze([
  { id: 'scrap', name: 'Scrappy items' },
  { id: 'resources', name: 'Resources' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'addons', name: 'Addons' },
]);

export const WILD_CHEST_LOOT_TABLES = Object.freeze({
  'first-cave': Object.freeze({
    name: 'First cave',
    minDrops: 2,
    maxDrops: 4,
    guaranteedPerChest: ['resources', 'utilities'],
    guaranteedPerBiome: ['addons'],
    entries: Object.freeze([
      { id: 'rusty-metal-scraps', category: 'scrap', weight: 16, min: 2, max: 5 },
      { id: 'torn-cloth', category: 'scrap', weight: 12, min: 1, max: 3 },
      { id: 'broken-gears', category: 'scrap', weight: 10, min: 1, max: 2 },
      { id: 'ancient-coins', category: 'scrap', weight: 10, min: 1, max: 4 },
      { id: 'copper', category: 'resources', weight: 12, min: 2, max: 5 },
      { id: 'wood', category: 'resources', weight: 7, min: 2, max: 5 },
      { id: 'iron', category: 'resources', weight: 5, min: 1, max: 2 },
      { id: 'kelp-dressing', category: 'utilities', weight: 8, min: 1, max: 1 },
      { id: 'glowshroom-torch', category: 'utilities', weight: 6, min: 2, max: 2 },
      { id: 'rope-bundle', category: 'utilities', weight: 5, min: 1, max: 1 },
      { id: 'scrappers-gloves', category: 'addons', weight: 4, min: 1, max: 1 },
      { id: 'explorers-anklet', category: 'addons', weight: 3, min: 1, max: 1 },
      { id: 'padded-leg-wraps', category: 'addons', weight: 1, min: 1, max: 1 },
      { id: 'prospectors-brooch', category: 'addons', weight: 1, min: 1, max: 1 },
    ]),
  }),
});

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
