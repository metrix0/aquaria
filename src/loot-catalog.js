import { DROPS, MATERIAL_IDS } from './content.js';
import { SOUL_ITEMS } from './classes.js';
import { ITEMS, EQUIPMENT_ITEMS } from './inventory.js';
import { recipes } from './crafting-recipes.js';
import { generateFixtures } from './world/generation.js';
import { shipwreckCaches } from './world/shipwreck.js';
import { DROP_TYPES, RARITIES, WILD_CHEST_LOOT_TABLES, MOB_LOOT, SOUL_LOOT,
  WRECK_RARE_DROP, KRAKEN_CHEST_LOOT, TEMPLE_SANCTUM_LOOT, fixedDrop } from './loot.js';

const catalogItems = { ...ITEMS, ...EQUIPMENT_ITEMS };
const source = (kind, name, area, entries, note = '') => ({ kind, name, area, entries, note });
export function sourceLabel(s) {
  return s.area && s.area !== s.name ? s.name + ' · ' + s.area : s.name;
}
export function createLootCatalog() {
  const result = [];
  for (const table of Object.values(WILD_CHEST_LOOT_TABLES)) {
    const guarantees = [
      table.guaranteedPerChest?.length ? 'One of ' + table.guaranteedPerChest.map(c => DROP_TYPES[c].toLowerCase()).join(' or ') + ' guaranteed per chest.' : '',
      ...(table.guaranteedPerBiome ?? []).map(c => 'At least one ' + DROP_TYPES[c].toLowerCase() + ' across the area.'),
    ].filter(Boolean).join(' ');
    result.push(source('Wild chest', 'Wild chests', table.name, table.entries,
      table.minDrops + '–' + table.maxDrops + ' different items per chest. ' + guarantees + ' * Base unrestricted roll share; guarantees and unique selection affect final chest odds.'));
  }
  const fixed = generateFixtures().filter(f => f.kind === 'chest' && f.chestType !== 'wild');
  const wreckIds = new Set(shipwreckCaches.map(c => c.id));
  for (const chest of fixed) {
    if (!chest.lootArea) throw new Error('Missing loot area: ' + chest.id);
    result.push(source('Chest', chest.name, chest.lootArea,
      [chest.loot, ...(chest.bonusLoot ?? [])].map(fixedDrop).concat(wreckIds.has(chest.id) ? [WRECK_RARE_DROP] : [])));
  }
  result.push(source('Boss chest', 'Kraken chest', 'Kraken', [fixedDrop(KRAKEN_CHEST_LOOT)]));
  result.push(source('Chest', 'Sanctum Chest', 'Water Temple', [fixedDrop(TEMPLE_SANCTUM_LOOT)], 'Pearl is not currently an obtainable inventory item.'));
  const mobs = new Map();
  for (const [kind, rule] of Object.entries(MOB_LOOT)) {
    mobs.set(kind, source('Mob', rule.name, rule.area, [rule.entry]));
  }
  for (const [kind, rule] of Object.entries(SOUL_LOOT)) {
    const group = mobs.get(kind) ?? source('Mob', rule.name, null, []);
    group.entries.push({ id: SOUL_ITEMS[rule.type], category: 'souls', rarity: rule.type === 'greater' ? 'Epic' : 'Rare',
      min: 1, max: 1, chance: 1, condition: 'Once per creature identity' });
    mobs.set(kind, group);
  }
  result.push(...mobs.values());
  for (const s of result) for (const entry of s.entries) {
    if (!entry.unavailable && !Object.hasOwn(catalogItems, entry.id)) throw new Error('Unknown loot item: ' + entry.id);
    if (!Object.hasOwn(DROP_TYPES, entry.category) || !RARITIES.includes(entry.rarity)) throw new Error('Invalid loot metadata: ' + entry.id);
  }
  return result;
}

let cache;
export function lootCatalog() {
  return cache ??= createLootCatalog();
}

export function itemSources() {
  const map = new Map();
  const add = (id, label) => {
    const labels = map.get(id) ?? new Set();
    labels.add(label);
    map.set(id, labels);
  };
  for (const s of lootCatalog()) for (const entry of s.entries) {
    if (!entry.unavailable) add(entry.id, sourceLabel(s) + (entry.condition ? ' (once)' : ''));
  }
  for (const [material, id] of Object.entries(DROPS)) add(id, 'Mining: ' + MATERIAL_IDS[material]);
  add('wood', 'Harvest trees');
  add('seed', 'Harvest trees');
  add('kelp', 'Harvest kelp');
  add('broken-pickaxe', 'Starting equipment');
  add('door', 'Recover placed door');
  add('tent', 'Recover placed tent');
  for (const { recipe } of recipes) {
    const station = catalogItems[recipe.station]?.name ?? recipe.station;
    const label = (recipe.station === 'fireplace' ? 'Cooking' : 'Crafting') + (station ? ' · ' + station : '') +
      (recipe.requiresSkill ? ' (skill required)' : '');
    add(recipe.id, label);
    if (catalogItems['perfect-' + recipe.id]) add('perfect-' + recipe.id, label + ' (perfect weapon skill)');
  }
  return Object.fromEntries([...map].map(([id, labels]) => [id, [...labels]]));
}
