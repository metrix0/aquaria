export const MATERIAL = Object.freeze({ air: 0, sand: 1, stone: 2, reef: 3, wood: 5, bedrock: 6, soil: 7, copper: 8, iron: 9, cobalt: 10, door: 11, deepstone: 12 });
export const MATERIAL_IDS = Object.freeze(Object.fromEntries(Object.entries(MATERIAL).map(([id, code]) => [code, id])));
export const ORE_MATERIALS = new Set([MATERIAL.copper, MATERIAL.iron, MATERIAL.cobalt]);
export const DROPS = Object.freeze({
  [MATERIAL.sand]: 'sand',
  [MATERIAL.stone]: 'stone',
  [MATERIAL.deepstone]: 'stone',
  [MATERIAL.soil]: 'sand',
  [MATERIAL.reef]: 'stone',
  [MATERIAL.wood]: 'wood',
  [MATERIAL.copper]: 'copper',
  [MATERIAL.iron]: 'iron',
  [MATERIAL.cobalt]: 'cobalt',
});

export const MINING_RULES = {
  [MATERIAL.sand]: { hand: 0.45, pickaxe: 0.35 },
  [MATERIAL.soil]: { hand: 0.55, pickaxe: 0.4 },
  [MATERIAL.wood]: { hand: 0.8, pickaxe: 0.5 },
  [MATERIAL.reef]: { hand: 2.7, pickaxe: 0.6 },
  [MATERIAL.stone]: { hand: 3.6, pickaxe: 0.7 },
  [MATERIAL.copper]: { name: 'Copper ore', tier: 1, pickaxe: 0.85 },
  [MATERIAL.iron]: { name: 'Iron ore', tier: 1, pickaxe: 1.05 },
  [MATERIAL.cobalt]: { name: 'Cobalt ore', tier: 2, pickaxe: 1.3 },
  [MATERIAL.deepstone]: { name: 'Deepstone', tier: 2, pickaxe: 1.7 },
};

export const ITEM_PROMPTS = { kelp: 'Harvest kelp', helmet: 'Open chest' };
export const BREATH_SECONDS = 18;

export const SWIMMING_HELMET = {
  id: 'swimming-helmet',
  chestId: 'shore-chest',
  bonusSeconds: 14,
};

export const AIR_TANK = {
  id: 'air-tank',
  cost: { stone: 3, kelp: 2 },
  breathSeconds: 42,
};


export const WOODEN_DOOR = { id: 'door', cost: { wood: 3 } };
export const COPPER_PICKAXE = { id: 'copper-pickaxe', cost: { copper: 3, wood: 2 } };

export const WALK_CYCLE_DISTANCE = 32;

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
