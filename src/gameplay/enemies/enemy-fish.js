import { KRAKEN_COLUMN, MOB_HEALTH, TILE, WATER } from '../../world/generation.js';

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

export function updateEnemySpawns(state, mobs, player, night, dt, fishCollides) {
  let count = 0;
  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    if (!mob.enemyType) continue;
    mob.remainingLife -= dt;
    if (mob.remainingLife <= 0 || Math.hypot(mob.x - player.x, mob.y - player.y - 11) > 375 || fishCollides(mob.x, mob.y)) {
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
    const x = player.x - facing * (92 + Math.random() * 125);
    const y = Math.max(WATER + 15, player.y + 12 - 60) + Math.random() * 85;
    if (fishCollides(x, y) || mobs.some((mob) => Math.hypot(mob.x - x, mob.y - y) < 56)) continue;
    const inLionfishBand = x < KRAKEN_COLUMN * TILE && y >= WATER + 20 * TILE && y <= WATER + 80 * TILE;
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
