export const MATERIAL = Object.freeze({ air: 0, sand: 1, stone: 2, reef: 3, wood: 5, bedrock: 6, soil: 7, copper: 8, iron: 9, cobalt: 10, door: 11 });
export const MATERIAL_IDS = Object.freeze(Object.fromEntries(Object.entries(MATERIAL).map(([id, code]) => [code, id])));
export const DROPS = Object.freeze({
  [MATERIAL.sand]: 'sand',
  [MATERIAL.stone]: 'stone',
  [MATERIAL.soil]: 'sand',
  [MATERIAL.reef]: 'stone',
  [MATERIAL.wood]: 'wood',
  [MATERIAL.copper]: 'copper',
  [MATERIAL.iron]: 'iron',
  [MATERIAL.cobalt]: 'cobalt',
});

export const BREAK_SECONDS = {
  [MATERIAL.sand]: 0.35,
  [MATERIAL.soil]: 0.4,
  [MATERIAL.wood]: 0.5,
  [MATERIAL.reef]: 0.6,
  [MATERIAL.stone]: 0.7,
  [MATERIAL.copper]: 0.85,
  [MATERIAL.iron]: 1.05,
  [MATERIAL.cobalt]: 1.3,
};

export const ITEM_PROMPTS = { kelp: 'Harvest kelp', cache: 'Open wreck cache' };
export const BREATH_SECONDS = 18;

export const AIR_TANK = {
  id: 'air-tank',
  cost: { stone: 3, kelp: 2 },
  breathSeconds: 42,
};

export const WRECK_CACHE = { id: 'wreck-cache', wood: 8 };

export const WOODEN_DOOR = { id: 'door', wood: 3 };

export const WALK_CYCLE_DISTANCE = 32;

export const APPEARANCE = {
  gender: ['Unspecified', 'Woman', 'Man', 'Nonbinary'].map((name) => ({ name })),
  body: ['Regular', 'Slim', 'Broad'].map((name) => ({ name })),
  hair: ['Side-swept', 'Cropped', 'Bob', 'Ponytail', 'Shaved'].map((name) => ({ name })),
  skin: [
    { name: 'Sunlit', face: '#dcb484', shade: '#d8aa6e', arm: '#e8b57b', hand: '#e9ad81' },
    { name: 'Seashell', face: '#eed2b5', shade: '#dfb792', arm: '#f5ddc3', hand: '#eac5a2' },
    { name: 'Sandbar', face: '#c69063', shade: '#ad784d', arm: '#d49f71', hand: '#c99365' },
    { name: 'Driftwood', face: '#9a6444', shade: '#814f33', arm: '#a97250', hand: '#9e6847' },
    { name: 'Deep Bark', face: '#6b4230', shade: '#553122', arm: '#7b4f3b', hand: '#704633' },
  ],
  hairColor: [
    { name: 'Dark brown', base: '#654239', light: '#99634e', shade: '#422f34' },
    { name: 'Black', base: '#3d3b4a', light: '#6c6774', shade: '#292936' },
    { name: 'Auburn', base: '#934a3b', light: '#ce7c54', shade: '#602e32' },
    { name: 'Blonde', base: '#c49357', light: '#f1ce83', shade: '#7d573f' },
    { name: 'Silver', base: '#a4afb9', light: '#e7e6d8', shade: '#63717f' },
    { name: 'Teal', base: '#43968d', light: '#78ccb7', shade: '#2b535b' },
  ],
  shirt: [
    { name: 'Coral', base: '#bc775a', wet: '#a76e59', light: '#df9b6b' },
    { name: 'Lagoon', base: '#498b84', wet: '#3b7370', light: '#76bfb2' },
    { name: 'Sunburst', base: '#c69853', wet: '#ab8045', light: '#ecc37d' },
    { name: 'Reef Rose', base: '#98576f', wet: '#7f475d', light: '#c68096' },
    { name: 'Storm', base: '#456a7d', wet: '#365668', light: '#6e96a8' },
  ],
  pants: [
    { name: 'Slate', back: '#344956', front: '#52616a', light: '#6d8884' },
    { name: 'Driftwood', back: '#4d3933', front: '#705448', light: '#8e6b51' },
    { name: 'Sandbar', back: '#736047', front: '#988161', light: '#b89f7a' },
    { name: 'Kelp', back: '#2d4b43', front: '#476d61', light: '#649282' },
    { name: 'Abyss', back: '#202938', front: '#364459', light: '#4d5f78' },
  ],
};

export function normalizeAppearance(appearance) {
  return Object.fromEntries(Object.entries(APPEARANCE).map(([part, choices]) => {
    const index = appearance?.[part];
    return [part, Number.isInteger(index) && choices[index] ? index : 0];
  }));
}
