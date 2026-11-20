export const MATERIAL = Object.freeze({ air: 0, sand: 1, stone: 2, reef: 3, wood: 5, bedrock: 6, soil: 7, copper: 8, iron: 9, cobalt: 10, door: 11, deepstone: 12, workbench: 13 });
export const MATERIAL_IDS = Object.freeze(Object.fromEntries(Object.entries(MATERIAL).map(([id, code]) => [code, id])));
export const ORE_MATERIALS = new Set([MATERIAL.copper, MATERIAL.iron, MATERIAL.cobalt]);
export const DROPS = Object.freeze({
  [MATERIAL.sand]: 'sand',
  [MATERIAL.stone]: 'stone',
  [MATERIAL.deepstone]: 'stone',
  [MATERIAL.soil]: 'sand',
  [MATERIAL.reef]: 'stone',
  [MATERIAL.wood]: 'wood',
  [MATERIAL.workbench]: 'workbench',
  [MATERIAL.copper]: 'copper',
  [MATERIAL.iron]: 'iron',
  [MATERIAL.cobalt]: 'cobalt',
});

const WOOD_MINING_RULE = { hand: 0.8, pickaxe: 0.5 };

export const MINING_RULES = {
  [MATERIAL.sand]: { hand: 0.45, pickaxe: 0.35 },
  [MATERIAL.soil]: { hand: 0.55, pickaxe: 0.4 },
  [MATERIAL.wood]: WOOD_MINING_RULE,
  [MATERIAL.workbench]: WOOD_MINING_RULE,
  [MATERIAL.reef]: { hand: 2.7, pickaxe: 0.6 },
  [MATERIAL.stone]: { hand: 3.6, pickaxe: 0.7 },
  [MATERIAL.copper]: { name: 'Copper ore', tier: 1, pickaxe: 0.85 },
  [MATERIAL.iron]: { name: 'Iron ore', tier: 1, pickaxe: 1.05 },
  [MATERIAL.cobalt]: { name: 'Cobalt ore', tier: 2, pickaxe: 1.3 },
  [MATERIAL.deepstone]: { name: 'Deepstone', tier: 2, pickaxe: 1.7 },
};

export const KELP_MINING_RULE = { hand: 0.3, pickaxe: 0.25 };
export const CHEST_SIZE = 8;
export const INTERACTION_RANGE = 35;
export const BREATH_SECONDS = 18;

export const WORKBENCH = { id: 'workbench', cost: { wood: 6 } };

export const SNORKEL_CHEST_ID = 'wreck-chest';
export const KRAKEN_CHEST_ID = 'kraken-chest';

export const DIVING_FIN = {
  id: 'diving-fin', name: 'Diving fin', swimMultiplier: 1.5,
  description: 'Cut to a reef runner’s pattern, after a particularly smug fish.',
  colors: ['#1e468a', '#3580e0', '#82c8ff'],
};

export const FEET_GEAR = Object.freeze({
  [DIVING_FIN.id]: DIVING_FIN,
});

export const COPPER_SNORKEL = {
  id: 'copper-snorkel', name: 'Copper snorkel', station: WORKBENCH.id,
  description: 'A wreck diver’s charm for borrowing one more breath from the sea.',
  cost: { copper: 3, kelp: 2 }, bonusSeconds: 20, colors: ['#875147', '#f1ac73'],
};

export const IRON_SNORKEL = {
  id: 'iron-snorkel', name: 'Iron snorkel', station: WORKBENCH.id,
  description: 'Riveted tight enough to keep a drowned sailor’s sigh inside.',
  cost: { [COPPER_SNORKEL.id]: 1, iron: 4 }, bonusSeconds: 28, colors: ['#536874', '#d6e3df'],
};

export const COBALT_SNORKEL = {
  id: 'cobalt-snorkel', name: 'Cobalt snorkel', station: WORKBENCH.id,
  description: 'A cold blue pipe for dives your guardian spirit would rather sit out.',
  cost: { [IRON_SNORKEL.id]: 1, cobalt: 2 }, bonusSeconds: 36, colors: ['#48568b', '#a6b7ff'],
};

export const SNORKELS = Object.freeze(Object.fromEntries(
  [COPPER_SNORKEL, IRON_SNORKEL, COBALT_SNORKEL].map((gear) => [gear.id, gear]),
));

export function normalizeSnorkel(id) {
  if (id === 'snorkel' || id === 'swimming-helmet') return COPPER_SNORKEL.id;
  if (id === 'reinforced-snorkel' || id === 'reinforced-helmet') return COBALT_SNORKEL.id;
  return Object.hasOwn(SNORKELS, id) ? id : null;
}

export const ARMOR = Object.freeze({
  'copper-breastplate': {
    id: 'copper-breastplate', name: 'Copper breastplate', equipment: 'armor', station: WORKBENCH.id,
    description: 'Harbor recruits take their oaths in copper. The dents come later.',
    cost: { copper: 5, kelp: 2 }, protection: 0.15, colors: ['#874f45', '#d88a62', '#ffd3a0'],
  },
  'iron-breastplate': {
    id: 'iron-breastplate', name: 'Iron breastplate', equipment: 'armor', station: WORKBENCH.id,
    description: 'There’s a tally scratched inside. The last mark is unfinished.',
    cost: { iron: 6, kelp: 2 }, protection: 0.28, colors: ['#536874', '#9eafae', '#e4e5cf'],
    requires: 'copper-breastplate',
  },
  'cobalt-breastplate': {
    id: 'cobalt-breastplate', name: 'Cobalt breastplate', equipment: 'armor', station: WORKBENCH.id,
    description: 'Hammered from deep-vein cobalt until the anvil struck sparks like stars.',
    cost: { cobalt: 6, kelp: 2 }, protection: 0.40, colors: ['#455294', '#768de5', '#c4d8ff'],
    requires: 'iron-breastplate',
  },
});

export const WOODEN_DOOR = { id: 'door', cost: { wood: 3 } };
export const BROKEN_PICKAXE = { id: 'broken-pickaxe' };
export const COPPER_PICKAXE = { id: 'copper-pickaxe', station: WORKBENCH.id, cost: { copper: 3, wood: 2 } };
export const IRON_PICKAXE = { id: 'iron-pickaxe', station: WORKBENCH.id, cost: { iron: 4, wood: 2 }, miningTime: 0.7 };
export const KELP_DRESSING = { id: 'kelp-dressing', cost: { kelp: 3 }, heal: 30 };
export const SPEAR = { id: 'spear', station: WORKBENCH.id, cost: { wood: 2, stone: 1 }, amount: 1, damage: 2, cooldown: 0.34, knockback: 165 };
export const COPPER_SPEAR = { id: 'copper-spear', station: WORKBENCH.id, cost: { copper: 2, wood: 2 }, amount: 1, damage: 3, cooldown: 0.3, knockback: 195 };
export const IRON_SWORD = {
  id: 'iron-sword', station: WORKBENCH.id, cost: { iron: 4, wood: 1 }, damage: 5, cooldown: 0.42, knockback: 205,
  blade: [8, -2, 12, 4],
};
export const CAPTAINS_CUTLASS = {
  id: 'captains-cutlass', name: "Captain's cutlass", damage: 4, cooldown: 0.35, knockback: 175,
  blade: [8, -3, 10, 5],
};
export const COBALT_SPEAR = {
  id: 'cobalt-spear', station: WORKBENCH.id, cost: { cobalt: 4, iron: 1, wood: 2 }, damage: 6, cooldown: 0.4, knockback: 250, reach: 6,
};
export const BOW = { id: 'bow', cost: { wood: 3, kelp: 1 }, amount: 1, cooldown: 0.38 };
export const ARROW = { id: 'arrow', cost: { wood: 1, stone: 1 }, amount: 4, damage: 2, speed: 300, knockback: 115 };

export const ADDONS = Object.freeze({
  'scrappers-gloves': {
    id: 'scrappers-gloves', name: "Scrapper's Gloves", addonSlot: 'hands', miningSpeed: 0.08,
    description: 'Worn mining gloves. Mining is 8% faster.',
  },
  'explorers-anklet': {
    id: 'explorers-anklet', name: "Explorer's Anklet", addonSlot: 'feet', moveSpeed: 0.05,
    description: 'A tiny silver charm. Ground movement is 5% faster.',
  },
  'padded-leg-wraps': {
    id: 'padded-leg-wraps', name: 'Padded Leg Wraps', addonSlot: 'legs', fallProtection: 0.15,
    description: 'Cushions hard landings, reducing fall damage by 15%.',
  },
  'prospectors-brooch': {
    id: 'prospectors-brooch', name: "Prospector's Brooch", addonSlot: 'chest', oreSense: 12,
    description: 'Nearby ore veins glimmer faintly through cave walls.',
  },
});

export const SALVAGE_RECIPES = Object.freeze([
  { id: 'copper', name: 'Recover copper', station: WORKBENCH.id, cost: { 'rusty-metal-scraps': 4 }, amount: 1,
    description: 'Smelt four rusty pieces of armor into one copper ore.' },
  { id: 'iron', name: 'Recover iron', station: WORKBENCH.id, cost: { 'broken-gears': 3 }, amount: 1,
    description: 'Strip three broken gears for one iron ore.' },
  { id: 'rope-bundle', name: 'Braid rope', cost: { 'torn-cloth': 3 }, amount: 1,
    description: 'Twist salvaged fabric into a short climbing rope.' },
]);

export const WALK_CYCLE_DISTANCE = 32;

export const CHARACTER_BODIES = [
  { shoulder: 9, waist: 7 },
  { shoulder: 7, waist: 5 },
  { shoulder: 11, waist: 9 },
];

export const APPEARANCE = {
  gender: ['Unspecified', 'Woman', 'Man', 'Nonbinary'].map((name) => ({ name })),
  body: ['Regular', 'Slim', 'Broad'].map((name) => ({ name })),
  hair: ['Side-swept', 'Cropped', 'Bob', 'Ponytail', 'Shaved'].map((name) => ({ name })),
  skin: [
    { name: 'Sunlit', face: '#e1ae82', shade: '#ad725d', arm: '#f2c59b', hand: '#d29372' },
    { name: 'Seashell', face: '#efd0b8', shade: '#c28e83', arm: '#fae4cd', hand: '#e0b298' },
    { name: 'Sandbar', face: '#c89063', shade: '#905541', arm: '#dfa779', hand: '#b77555' },
    { name: 'Driftwood', face: '#a46d51', shade: '#6d4038', arm: '#bd8969', hand: '#90563d' },
    { name: 'Deep Bark', face: '#785042', shade: '#4f302e', arm: '#9a6855', hand: '#654037' },
  ],
  hairColor: [
    { name: 'Dark brown', base: '#674339', light: '#a96d53', shade: '#432c31' },
    { name: 'Black', base: '#393c4c', light: '#6c7087', shade: '#252533' },
    { name: 'Auburn', base: '#9f5140', light: '#de8d5c', shade: '#642f35' },
    { name: 'Blonde', base: '#c99a59', light: '#f7d997', shade: '#8d623f' },
    { name: 'Silver', base: '#9caac1', light: '#d6e2f0', shade: '#627182' },
    { name: 'Teal', base: '#398b84', light: '#78cec0', shade: '#285359' },
    { name: 'Pink', base: '#da79a7', light: '#ffc8dd', shade: '#954e76' },
    { name: 'White', base: '#e5e6ec', light: '#fffaf1', shade: '#9997a8' },
  ],
  shirt: [
    { name: 'Coral', base: '#c57962', wet: '#935650', light: '#efaa7e' },
    { name: 'Lagoon', base: '#519a8e', wet: '#396f70', light: '#9ed1b9' },
    { name: 'Sunburst', base: '#c89b54', wet: '#926641', light: '#f3d187' },
    { name: 'Reef Rose', base: '#a96583', wet: '#76465e', light: '#da9caa' },
    { name: 'Storm', base: '#53778c', wet: '#385266', light: '#8eb4c4' },
  ],
  pants: [
    { name: 'Slate', back: '#344555', front: '#586a7a', light: '#8596a2' },
    { name: 'Driftwood', back: '#513d3c', front: '#795a52', light: '#b1856f' },
    { name: 'Sandbar', back: '#745b45', front: '#9f8565', light: '#d1b48a' },
    { name: 'Kelp', back: '#304d47', front: '#517669', light: '#83a395' },
    { name: 'Abyss', back: '#243043', front: '#414f68', light: '#7184a1' },
  ],
};

export function normalizeAppearance(appearance) {
  return Object.fromEntries(Object.entries(APPEARANCE).map(([part, choices]) => {
    const index = appearance?.[part];
    return [part, Number.isInteger(index) && choices[index] ? index : 0];
  }));
}
