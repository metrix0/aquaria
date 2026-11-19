export const JUNGLE_ISLAND = Object.freeze({
  center: 364,
  halfWidth: 34,
  villageStart: 349,
  villageEnd: 379,
  floor: 11,
});

export function jungleIslandSurface(x) {
  const distance = Math.abs(x - JUNGLE_ISLAND.center);
  if (distance <= 16) return JUNGLE_ISLAND.floor;
  if (distance <= 20) return 10;
  if (distance <= 25) return 11 + Math.floor((distance - 20) / 3);
  return 13 + Math.floor((distance - 25) * 1.8);
}

// [column, height, direction]
export const jungleTreeSpecs = [
  [340, 74, -1],
  [343, 88, 1],
  [346, 78, -1],
  [355, 86, 1],
  [370, 92, -1],
  [380, 82, 1],
  [384, 94, -1],
  [388, 72, 1],
];

// [id, kind, column, floor]
export const jungleVillageStructures = [
  ['village-totem-west', 'totem', 348, JUNGLE_ISLAND.floor],
  ['village-hut-west', 'hut', 351, JUNGLE_ISLAND.floor],
  ['village-rack', 'spear-rack', 358, JUNGLE_ISLAND.floor],
  ['village-hut-chief', 'chief-hut', 363, JUNGLE_ISLAND.floor],
  ['village-campfire', 'campfire', 368, JUNGLE_ISLAND.floor],
  ['village-hut-east', 'hut', 374, JUNGLE_ISLAND.floor],
  ['village-totem-east', 'totem', 379, JUNGLE_ISLAND.floor],
];

export const jungleVillageCache = {
  id: 'jungle-village-cache',
  name: 'Village supply chest',
  column: 361,
  floor: JUNGLE_ISLAND.floor,
  resource: 'cobalt',
  amount: 4,
};

// [id, kind, column, floor, respawnDelay]
export const jungleMobs = [
  ['jungle-west-lookout', 'cannibal-bow', 345, 10, 48],
  ['jungle-west-warrior', 'cannibal-spear', 350, JUNGLE_ISLAND.floor, 45],
  ['jungle-chief-guard', 'cannibal-spear', 360, JUNGLE_ISLAND.floor, 45],
  ['jungle-camp-hunter', 'cannibal-bow', 366, JUNGLE_ISLAND.floor, 48],
  ['jungle-east-warrior', 'cannibal-spear', 373, JUNGLE_ISLAND.floor, 45],
  ['jungle-east-lookout', 'cannibal-bow', 382, 10, 48],
];
