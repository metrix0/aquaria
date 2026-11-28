// Canonical loot rules. Runtime rolls and reference menus read these same definitions.
export const DROP_TYPES = Object.freeze({
  scrap: 'Scrap', resources: 'Resource', utilities: 'Utility', addons: 'Accessory',
  spells: 'Spell', weapons: 'Weapon', food: 'Food', pets: 'Pet', souls: 'Soul',
});
export const RARITIES = Object.freeze(['Common', 'Uncommon', 'Rare', 'Epic']);
export function rarityForChance(percent) {
  return percent <= 2 ? 'Epic' : percent <= 5 ? 'Rare' : percent <= 12 ? 'Uncommon' : 'Common';
}
function defineDrop(id, category, rarity, min, max, odds) {
  if (!id || !Object.hasOwn(DROP_TYPES, category) || !RARITIES.includes(rarity) ||
      !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min ||
      !Number.isFinite(odds) || odds <= 0 || odds > 100) throw new Error('Invalid loot definition: ' + id);
  return Object.freeze({ id, category, rarity, min, max });
}
function weightedDrop(id, category, weight, min, max) {
  return Object.freeze({ ...defineDrop(id, category, rarityForChance(weight), min, max, weight), weight });
}
function chanceDrop(id, category, chance, count = 1, rarity = rarityForChance(chance * 100)) {
  return Object.freeze({ ...defineDrop(id, category, rarity, count, count, chance * 100), chance });
}
export const CREW_CUTLASS_CHANCE = .05;
export const WRECK_CUTLASS_CHANCE = .05;
export const WRECK_RARE_DROP = chanceDrop('captains-cutlass', 'weapons', WRECK_CUTLASS_CHANCE);
export const MOB_LOOT = Object.freeze({
  captain: { name: "Captain's ghost", area: 'Western shipwreck', entry: chanceDrop('parrot-pet', 'pets', 1, 1, 'Rare') },
  ghost: { name: 'Crew ghost', area: 'Western shipwreck', entry: chanceDrop('captains-cutlass', 'weapons', CREW_CUTLASS_CHANCE) },
  fish: { name: 'Fish', entry: chanceDrop('raw-fish', 'food', 1) },
  crab: { name: 'Crab', entry: chanceDrop('raw-crab', 'food', 1) },
  lionfish: { name: 'Lionfish', entry: chanceDrop('poison-needle', 'resources', 1, 2) },
  spider: { name: 'Cave spider', entry: chanceDrop('string', 'resources', 1) },
  'armored-skeleton': { name: 'Armored skeleton', entry: chanceDrop('morningstar', 'weapons', .10, 1, 'Rare') },
});
export const SOUL_LOOT = Object.freeze({
  kraken: { name: 'Kraken', type: 'greater' },
  mimic: { name: 'Mimic', type: 'lesser' },
  hammer: { name: 'Hammer skeleton', type: 'lesser' },
  greatsword: { name: 'Greatsword skeleton', type: 'lesser' },
  'armored-skeleton': { name: 'Armored skeleton', type: 'lesser' },
  shaman: { name: 'Native shaman', type: 'lesser' },
  worm: { name: 'Jungle worm', type: 'lesser' },
});
export function mobSoulReward(mob) {
  return mob.krakenMinion ? null : SOUL_LOOT[mob.kind]?.type ?? null;
}
export function rollMobLoot(mob, random = Math.random) {
  if (mob.ghostMinion) return null;
  const rule = MOB_LOOT[mob.kind === 'ghost' && mob.resident ? 'captain' : mob.kind]?.entry;
  if (!rule || (rule.chance < 1 && random() >= rule.chance)) return null;
  return { id: rule.id, count: rule.min };
}
export const KRAKEN_CHEST_LOOT = Object.freeze({ id: 'diving-fin', count: 1 });
// The original sanctum uses an unimplemented pearl item; keep its behavior unchanged.
export const TEMPLE_SANCTUM_LOOT = Object.freeze({ id: 'pearl', count: 5 });

// Fixed chest items must have a declared type and rarity. Quantities stay in
// the actual fixture definitions rather than being copied into documentation.
const FIXED_ITEM_META = Object.freeze({
  wood: ['resources', 'Common'], copper: ['resources', 'Common'],
  iron: ['resources', 'Common'], cobalt: ['resources', 'Uncommon'],
  kelp: ['resources', 'Common'], bow: ['weapons', 'Common'], arrow: ['weapons', 'Common'],
  'kelp-dressing': ['utilities', 'Common'], 'root-ring': ['addons', 'Rare'],
  'explorers-map': ['utilities', 'Rare'], 'grappling-hook': ['utilities', 'Rare'],
  'copper-snorkel': ['utilities', 'Uncommon'], 'diving-fin': ['addons', 'Rare'],
  pearl: ['resources', 'Common'],
});
export function fixedDrop(stack) {
  const meta = FIXED_ITEM_META[stack.id];
  if (!meta) throw new Error('Missing drop type/rarity for fixed loot: ' + stack.id);
  return { ...chanceDrop(stack.id, meta[0], 1, stack.count, meta[1]), unavailable: stack.id === TEMPLE_SANCTUM_LOOT.id };
}

// Data-driven loot rules shared by Wild Chest generation and the Drops panel.
// Weights are base roll percentages, before guarantees and unique-item selection.
export const WILD_CHEST_CATEGORIES = Object.freeze([
  { id: 'scrap', name: 'Scrappy items' },
  { id: 'resources', name: 'Resources' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'addons', name: 'Addons' },
  { id: 'spells', name: 'Spells' },
]);

export const WILD_CHEST_LOOT_TABLES = Object.freeze({
  'sunken-ruins': Object.freeze({
    name: 'Sunken ruins', minDrops: 2, maxDrops: 4,
    guaranteedPerChest: ['resources', 'utilities'],
    entries: Object.freeze([
      weightedDrop('ancient-coins', 'scrap', 18, 2, 6),
      weightedDrop('rusty-metal-scraps', 'scrap', 12, 2, 5),
      weightedDrop('iron', 'resources', 16, 2, 5),
      weightedDrop('copper', 'resources', 12, 3, 6),
      weightedDrop('kelp-dressing', 'utilities', 16, 1, 2),
      weightedDrop('glowshroom-torch', 'utilities', 9, 1, 3),
      weightedDrop('explorers-anklet', 'addons', 3, 1, 1),
      weightedDrop('frost-lance-scroll', 'spells', 5, 1, 1),
      weightedDrop('mend-scroll', 'spells', 5, 1, 1),
    ]),
  }),
  'first-cave': Object.freeze({
    name: 'First cave',
    minDrops: 2,
    maxDrops: 4,
    guaranteedPerChest: ['resources', 'utilities'],
    guaranteedPerBiome: ['addons'],
    entries: Object.freeze([
      weightedDrop('rusty-metal-scraps', 'scrap', 12, 2, 5),
      weightedDrop('torn-cloth', 'scrap', 9, 1, 3),
      weightedDrop('broken-gears', 'scrap', 7, 1, 2),
      weightedDrop('ancient-coins', 'scrap', 7, 1, 4),
      weightedDrop('copper', 'resources', 10, 2, 5),
      weightedDrop('wood', 'resources', 7, 2, 5),
      weightedDrop('iron', 'resources', 5, 1, 2),
      weightedDrop('kelp-dressing', 'utilities', 8, 1, 1),
      weightedDrop('glowshroom-torch', 'utilities', 6, 2, 2),
      weightedDrop('rope-bundle', 'utilities', 5, 1, 1),
      weightedDrop('scrappers-gloves', 'addons', 4, 1, 1),
      weightedDrop('explorers-anklet', 'addons', 3, 1, 1),
      weightedDrop('padded-leg-wraps', 'addons', 1, 1, 1),
      weightedDrop('prospectors-brooch', 'addons', 1, 1, 1),
      weightedDrop('firebolt-tome', 'spells', 1, 1, 1),
      weightedDrop('firebolt-scroll', 'spells', 4, 1, 1),
      weightedDrop('frost-lance-tome', 'spells', 1, 1, 1),
      weightedDrop('frost-lance-scroll', 'spells', 4, 1, 1),
      weightedDrop('mend-tome', 'spells', 1, 1, 1),
      weightedDrop('mend-scroll', 'spells', 4, 1, 1),
    ]),
  }),
});

