import { WATER } from './world/generation.js';

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
  state.spawnIn = 6;
  if (count >= 3) return;

  for (let attempt = 0; attempt < 12; attempt++) {
    const facing = Math.random() < 0.5 ? -1 : 1;
    const x = player.x - facing * (92 + Math.random() * 125);
    const y = Math.max(WATER + 15, player.y + 12 - 60) + Math.random() * 85;
    if (fishCollides(x, y) || mobs.some((mob) => mob.enemyType && Math.hypot(mob.x - x, mob.y - y) < 34)) continue;
    const enemyType = pickEnemyType(night, Math.random());
    mobs.push({
      kind: 'fish', enemyType, x, y, facing, dx: 0, dy: 0, flee: 0,
      homeX: x, homeY: y, span: 52, speed: enemyType.speed,
      phase: Math.random() * Math.PI * 2, remainingLife: 35 + Math.random() * 20,
    });
    return;
  }
}
