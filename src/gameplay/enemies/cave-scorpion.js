import { dryCell, hurtPlayer, makeCaveEnemySpec, onFloor, stepCaveDasherActive, stepCaveEnemyBase } from './cave-shared.js';

export const caveScorpionSpec = makeCaveEnemySpec('scorpion', 'cave scorpion', 20, 13, 37, 18, 94);

export function stepCaveScorpion(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, caveScorpionSpec, dt, effects, {
    stepActive: stepCaveDasherActive,
    onWindupComplete() {
      mob.dash = .55;
      mob.venomIn = 0;
    },
    onPostMove() {
      if (mob.dash > 0 && mob.grounded) {
        mob.venomIn -= dt;
        if (mob.venomIn <= 0) {
          world.projectiles.push({ kind: 'venom', x: mob.x, y: mob.y - 1, life: 4.5 });
          mob.venomIn = .13;
        }
      }
    },
  });
}

export function stepScorpionVenom(world, player, hazard, dt, effects) {
  hazard.life -= dt;
  if (hazard.life <= 0) return false;
  if (!dryCell(world, hazard.x, hazard.y) || !onFloor(world, hazard.x, hazard.y)) return false;
  const feet = player.y + player.height;
  if (Math.abs(player.x - hazard.x) < 10 && Math.abs(feet - hazard.y) < 4 && player.grounded) {
    hurtPlayer(player, 8, Math.sign(player.x - hazard.x), 'Stepped in scorpion venom!', '#a6c968', effects);
  }
  return true;
}
