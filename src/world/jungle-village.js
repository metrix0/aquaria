import { EAST_SHIFT } from "./ocean-layout.js";
export const JUNGLE_ISLAND = Object.freeze({
  center: 364 + EAST_SHIFT,
  halfWidth: 34,
  villageStart: 349 + EAST_SHIFT,
  villageEnd: 379 + EAST_SHIFT,
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
  [340 + EAST_SHIFT, 74, -1],
  [343 + EAST_SHIFT, 88, 1],
  [346 + EAST_SHIFT, 78, -1],
  [355 + EAST_SHIFT, 86, 1],
  [370 + EAST_SHIFT, 92, -1],
  [380 + EAST_SHIFT, 82, 1],
  [384 + EAST_SHIFT, 94, -1],
  [388 + EAST_SHIFT, 72, 1],
];

// [id, kind, column, floor]
export const jungleVillageStructures = [
  ['village-totem-west', 'totem', 348 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-hut-west', 'hut', 351 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-rack', 'spear-rack', 358 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-hut-chief', 'chief-hut', 363 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-campfire', 'campfire', 368 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-hut-east', 'hut', 374 + EAST_SHIFT, JUNGLE_ISLAND.floor],
  ['village-totem-east', 'totem', 379 + EAST_SHIFT, JUNGLE_ISLAND.floor],
];

export const jungleVillageCache = {
  id: 'jungle-village-cache',
  name: 'Village supply chest',
  column: 361 + EAST_SHIFT,
  floor: JUNGLE_ISLAND.floor,
  resource: 'cobalt',
  amount: 4,
};

// [id, kind, column, floor, respawnDelay]
export const jungleMobs = [
  ['jungle-west-lookout', 'cannibal-bow', 345 + EAST_SHIFT, 10, 48],
  ['jungle-west-warrior', 'cannibal-spear', 350 + EAST_SHIFT, JUNGLE_ISLAND.floor, 45],
  ['jungle-chief-guard', 'cannibal-spear', 360 + EAST_SHIFT, JUNGLE_ISLAND.floor, 45],
  ['jungle-camp-hunter', 'cannibal-bow', 366 + EAST_SHIFT, JUNGLE_ISLAND.floor, 48],
  ['jungle-east-warrior', 'cannibal-spear', 373 + EAST_SHIFT, JUNGLE_ISLAND.floor, 45],
  ['jungle-east-lookout', 'cannibal-bow', 382 + EAST_SHIFT, 10, 48],
];
