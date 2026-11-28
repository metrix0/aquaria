import { JUNGLE_FADE_START_COLUMN, MOB_HEALTH, TILE, WATER, WEST_EXTENSION } from '../../world/generation.js';

const species = [
  {
    name: 'Reef snapper', spawnWeight: { day: 9, night: 2 }, speed: 31, airLoss: 1.5, healthLoss: 10,
    colors: ['#6a3938', '#a96250', '#e1aa78', '#f4ca83'],
  },
  {
    name: 'Lanternfish', spawnWeight: { day: 1, night: 8 }, speed: 42, airLoss: 2.5, healthLoss: 15,
    colors: ['#3b3064', '#745597', '#a68ebc', '#a9f3ca'],
  },
];

export function pickEnemyType(night, roll) {
  const phase = night ? 'night' : 'day';
  const totalWeight = species.reduce((total, type) => total + type.spawnWeight[phase], 0);
  let remaining = roll * totalWeight;
  return species.find((type) => (remaining -= type.spawnWeight[phase]) < 0);
}

// Natural arrivals must be outside both the player's local area and the visible camera.
// The extra margin keeps pop-ins out of view while the camera follows the player.
const SPAWN_MARGIN = 96;
const SPAWN_DISTANCE = 320;
export function naturalSpawnHidden(player, x, y, camera) {
  if (Math.hypot(x - player.x, y - player.y - 11) < SPAWN_DISTANCE) return false;
  if (!camera) return true;
  return x < camera.x - SPAWN_MARGIN || x > camera.x + camera.width + SPAWN_MARGIN
    || y < camera.y - SPAWN_MARGIN || y > camera.y + camera.height + SPAWN_MARGIN;
}

export function updateEnemySpawns(state, mobs, player, night, dt, fishCollides, camera) {
  let count = 0;
  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    if (!mob.enemyType) continue;
    mob.remainingLife -= dt;
    // Debug spawns are deliberately allowed on screen, including out of water.
    if (mob.testSpawn) {
      if (mob.remainingLife <= 0 && naturalSpawnHidden(player, mob.x, mob.y, camera)) mobs.splice(i, 1);
      continue;
    }
    const hidden = naturalSpawnHidden(player, mob.x, mob.y, camera);
    const far = Math.hypot(mob.x - player.x, mob.y - player.y - 11) > Math.max(600, (camera?.width ?? 0) + 320);
    if (hidden && (mob.remainingLife <= 0 || far || fishCollides(mob.x, mob.y))) {
      mobs.splice(i, 1);
    } else {
      count++;
    }
  }
  state.spawnIn -= dt;
  if (state.spawnIn > 0) return;
  state.spawnIn = 16;
  if (count >= 1) return;

  for (let attempt = 0; attempt < 12; attempt++) {
    const facing = Math.random() < 0.5 ? -1 : 1;
    const edgeDistance = camera ? (facing > 0 ? player.x - camera.x : camera.x + camera.width - player.x) : 0;
    const distance = Math.max(SPAWN_DISTANCE, edgeDistance + SPAWN_MARGIN + 24);
    const x = player.x - facing * (distance + Math.random() * 125);
    const y = Math.max(WATER + 15, player.y + 12 - 60) + Math.random() * 85;
    if (!naturalSpawnHidden(player, x, y, camera) || fishCollides(x, y) || mobs.some((mob) => Math.hypot(mob.x - x, mob.y - y) < 56)) continue;
    const inLionfishBand = x >= (JUNGLE_FADE_START_COLUMN + WEST_EXTENSION) * TILE && y >= WATER + 20 * TILE && y <= WATER + 80 * TILE;
    if (inLionfishBand && Math.random() < 0.45) {
      mobs.push({
        kind: 'lionfish',
        enemyType: { name: 'Lionfish' },
        x,
        y,
        facing,
        dx: 0,
        dy: 0,
        flee: 0,
        cooldown: 0,
        windup: 0,
        attackTimer: 1.5,
        burstCount: 0,
        homeX: x,
        homeY: y,
        span: 32,
        speed: 22,
        phase: Math.random() * Math.PI * 2,
        remainingLife: 40 + Math.random() * 20,
        maxHealth: MOB_HEALTH.lionfish,
        health: MOB_HEALTH.lionfish,
        hurt: 0,
        respawn: 0,
      });
      return;
    }
    if (y >= WATER + 10 * TILE && Math.random() < 0.28) {
      mobs.push({
        kind: 'pufferfish',
        enemyType: { name: 'Pufferfish' },
        x,
        y,
        facing,
        dx: 0,
        dy: 0,
        flee: 0,
        cooldown: 0,
        pufferState: 'idle',
        pufferTimer: 0,
        inflateScale: 1,
        exhausted: 0,
        homeX: x,
        homeY: y,
        span: 28,
        speed: 18,
        phase: Math.random() * Math.PI * 2,
        remainingLife: 40 + Math.random() * 20,
        maxHealth: MOB_HEALTH.pufferfish,
        health: MOB_HEALTH.pufferfish,
        hurt: 0,
        respawn: 0,
      });
      return;
    }
    const enemyType = pickEnemyType(night, Math.random());
    mobs.push({
      kind: 'fish', enemyType, x, y, facing, dx: 0, dy: 0, flee: 0,
      homeX: x, homeY: y, span: 52, speed: enemyType.speed,
      phase: Math.random() * Math.PI * 2, remainingLife: 35 + Math.random() * 20,
      maxHealth: MOB_HEALTH.fish, health: MOB_HEALTH.fish, hurt: 0, respawn: 0,
    });
    return;
  }
}
