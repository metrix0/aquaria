// Explicit creature spawn catalog shared by the Items spawn tab and enemy spawner.
export const SPAWN_CATEGORIES = Object.freeze([
  { name: 'Ocean', entries: [
    ['jellyfish', 'Jellyfish'], ['squid', 'Squid'], ['shark', 'Shark'],
    ['lionfish', 'Lionfish'], ['pufferfish', 'Pufferfish'], ['reef-snapper', 'Reef snapper'],
    ['lanternfish', 'Lanternfish'], ['kraken', 'Kraken'],
  ] },
  { name: 'Island caves', entries: [
    ['spider', 'Cave spider'], ['archer', 'Skeleton archer'],
    ['miner', 'Skeletal miner'], ['scorpion', 'Scorpion'],
    ['hammer', 'Hammer skeleton'], ['greatsword', 'Greatsword skeleton'],
    ['armored-skeleton', 'Armoured skeleton'], ['mimic', 'Mimic'],
    ['blood-bat', 'Blood bat'],
  ] },
  { name: 'Jungle', entries: [
    ['cannibal-spear', 'Spear cannibal'], ['cannibal-bow', 'Bow cannibal'],
    ['shaman', 'Native shaman'], ['cave-frog', 'Giant cave frog'],
    ['frog', 'Frog cultist'], ['worm', 'Jungle worm'],
  ] },
  { name: 'Shipwreck', entries: [['ghost', 'Wreck ghost']] },
  { name: 'Passive cave wildlife', entries: [
    ['ambient-ant', 'Ant'], ['ambient-spider', 'Tiny spider'], ['ambient-bat', 'Bat'],
  ] },
]);

export const FRIEND_SPAWN_ENTRIES = Object.freeze([
  ['crab', 'Crab'],
  ['fish', 'Fish'],
]);

export const ALL_SPAWN_ENTRIES = Object.freeze([
  ...SPAWN_CATEGORIES.flatMap((category) => category.entries),
  ...FRIEND_SPAWN_ENTRIES,
]);
