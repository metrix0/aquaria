import { solidAt, waterTileAt } from '../world.js';
import { COLS, ROWS, TILE, generateMobs } from '../world/generation.js';
import { mobSpec } from './mobs.js';
import { pickEnemyType } from './enemies/enemy-fish.js';
import { ALL_SPAWN_ENTRIES, FRIEND_SPAWN_ENTRIES, SPAWN_CATEGORIES } from './spawn-catalog.js';

export { ALL_SPAWN_ENTRIES, FRIEND_SPAWN_ENTRIES, SPAWN_CATEGORIES };

const allowed = new Map(SPAWN_CATEGORIES.flatMap(category => category.entries));
const allAllowed = new Map(ALL_SPAWN_ENTRIES);
const groundedKinds = new Set([
  'crab',
  'spider', 'archer', 'miner', 'scorpion', 'hammer', 'greatsword', 'armored-skeleton', 'mimic',
  'cannibal-spear', 'cannibal-bow', 'shaman', 'cave-frog', 'frog',
  'ambient-ant', 'ambient-spider',
]);
const waterKinds = new Set([
  'fish', 'jellyfish', 'squid', 'shark', 'lionfish', 'pufferfish', 'kraken', 'reef-snapper', 'lanternfish',
]);

function clearSpace(world, x, y, spec, ground = false) {
  const halfWidth = Math.max(3, spec.width / 2);
  const top = y + spec.centerY - spec.height / 2;
  const bottom = y + spec.centerY + spec.height / 2 - .01;
  for (let tx = Math.floor((x - halfWidth) / TILE); tx <= Math.floor((x + halfWidth) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor(bottom / TILE); ty++) {
      if (solidAt(world, tx, ty)) return false;
    }
  }
  if (!ground) return true;
  const feet = y + spec.centerY + spec.height / 2;
  const floor = Math.floor((feet + 1) / TILE);
  return solidAt(world, Math.floor(x / TILE), floor)
    && !waterTileAt(world, Math.floor(x / TILE), floor - 1);
}

function spawnLocation(world, player, kind, spec) {
  const facing = player.facing < 0 ? -1 : 1;
  const center = player.y + player.height / 2;
  const sea = waterKinds.has(kind);
  const ground = groundedKinds.has(kind);
  const candidates = [];
  for (const distance of [4, 6, 8, 10, 12, -4, -6, -8, -10, -12]) {
    const x = Math.round((player.x + facing * distance * TILE) / TILE) * TILE + TILE / 2;
    if (x < TILE * 3 || x > (COLS - 3) * TILE) continue;
    for (const delta of [0, -1, 1, -2, 2, -3, 3, -4, 4, -6, 6, -8, 8, -10, 10]) {
      const y = ground
        ? Math.round((center + delta * TILE) / TILE) * TILE - (spec.centerY + spec.height / 2)
        : center + delta * TILE;
      if (y - spec.height < TILE || y + spec.height >= (ROWS - 2) * TILE) continue;
      if (kind !== 'worm' && !clearSpace(world, x, y, spec, ground)) continue;
      if (kind === 'worm' && solidAt(world, Math.floor(x / TILE), Math.floor(y / TILE))) continue;
      const wet = waterTileAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
      // First prefer the intended habitat, but allow free testing anywhere.
      candidates.push({ x, y, wet, cost: Math.abs(distance) + Math.abs(delta) * 0.65 });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) =>
    (sea && a.wet !== b.wet ? (a.wet ? -1 : 1) : 0) || a.cost - b.cost);
  return candidates[0];
}

let spawnSerial = 0;

function spawnMobFromMap(world, player, kind, registry, wx, wy) {
  if (!registry.has(kind)) return { error: 'Unknown creature.' };
  const fishType = kind === 'reef-snapper' || kind === 'lanternfish';
  const actualKind = fishType ? 'fish' : kind;
  const template = generateMobs().find(mob => mob.kind === actualKind) ?? { kind: actualKind };
  const spec = mobSpec(template);
  if (!spec) return { error: 'This creature cannot be spawned.' };
  const ground = groundedKinds.has(actualKind);
  let position = null;
  if (Number.isFinite(wx) && Number.isFinite(wy)) {
    const px = Math.max(TILE * 2, Math.min((COLS - 2) * TILE, wx));
    if (actualKind === 'worm') {
      const py = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, wy));
      if (!solidAt(world, Math.floor(px / TILE), Math.floor(py / TILE))) {
        position = { x: px, y: py };
      }
    } else if (ground) {
      const startRow = Math.floor(wy / TILE);
      for (let drop = 0; drop <= 6; drop++) {
        const candidateY = (startRow + drop + 1) * TILE - (spec.centerY + spec.height / 2);
        if (candidateY + spec.height >= (ROWS - 2) * TILE) break;
        if (clearSpace(world, px, candidateY, spec, true)) {
          position = { x: px, y: candidateY };
          break;
        }
      }
    } else {
      const py = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, wy));
      if (clearSpace(world, px, py, spec, false)) {
        position = { x: px, y: py };
      }
    }
  }
  position = position ?? spawnLocation(world, player, actualKind, spec);
  if (!position) return { error: 'No clear space near your character. Move and try again.' };

  const index = ++spawnSerial;
  const mob = {
    ...template,
    ...position,
    id: 'test-spawn-' + index,
    kind: actualKind,
    homeX: position.x, homeY: position.y,
    health: spec.maxHealth, maxHealth: spec.maxHealth,
    respawn: 0, respawnDelay: 0, hurt: 0, flee: 0,
    dx: 0, dy: 0, cooldown: 0, windup: 0,
    facing: player.facing < 0 ? -1 : 1,
    phase: index * 0.83,
  };
  if (fishType) {
    mob.enemyType = pickEnemyType(kind === 'lanternfish', kind === 'lanternfish' ? .999 : 0);
    mob.remainingLife = 600;
  }
  if (kind === 'ghost') {
    mob.resident = true;
    mob.remainingLife = 600;
  }
  if (kind === 'mimic') {
    mob.awakened = true;
    mob.attackTimer = .5;
  }
  if (kind === 'frog') {
    mob.praying = false;
    mob.cultAggro = true;
  }
  // Test spawns are ephemeral and won't silently respawn or pollute saved games.
  mob.testSpawn = true;
  world.mobs.push(mob);
  return { mob, name: registry.get(kind) };
}

export function spawnEnemyNear(world, player, kind) {
  if (!allowed.has(kind)) return { error: 'Unknown enemy.' };
  return spawnMobFromMap(world, player, kind, allowed);
}

/** Spawn any hostile or friendly creature near the target world point or player. */
export function spawnCreature(world, player, kind, wx, wy) {
  return spawnMobFromMap(world, player, kind, allAllowed, wx, wy);
}
