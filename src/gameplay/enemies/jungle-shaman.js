import { applyConfusion } from '../player.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const CONFUSED_DURATION = 4.5;

export const nativeShamanSpec = {
  ...makeCaveEnemySpec('shaman', 'native shaman', 14, 24, 42, 12, 185),
  color: '#6cf085',
};

export function stepNativeShaman(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, nativeShamanSpec, dt, effects, {
    sightRange: 215,
    leashRange: 200,
    chaseDistance: 76,
    windupDuration: 0.45,
    attackCooldown: 2.05,
    jumpSpeed: 215,
    hopSpeed: 160,
    battleHop: true,
    onWindupComplete({ active, distance, deltaX, deltaY }) {
      if (active && distance <= nativeShamanSpec.reach) {
        const len = distance || 1;
        world.projectiles.push({
          kind: 'shaman-skull',
          x: mob.x + mob.facing * 8,
          y: mob.y - 17,
          dx: (deltaX / len) * 138,
          dy: (deltaY / len) * 138,
          life: 2.2,
          damage: nativeShamanSpec.damage,
          confusedDuration: CONFUSED_DURATION,
          facing: deltaX >= 0 ? 1 : -1,
        });
      }
    },
  });
}

export function stepShamanSkull(world, player, hazard, dt, effects) {
  const oldX = hazard.x;
  const oldY = hazard.y;
  hazard.life -= dt;
  if (hazard.life <= 0) return false;
  hazard.x += hazard.dx * dt;
  hazard.y += hazard.dy * dt;
  if (!clearPath(world, oldX, oldY, hazard.x, hazard.y)) return false;
  if (
    !player.flightOrigin &&
    Math.abs(player.x - hazard.x) < player.width / 2 + 5 &&
    hazard.y + 5 >= player.y &&
    hazard.y - 5 < player.y + player.height
  ) {
    const confusedApplied = applyConfusion(player, hazard.confusedDuration ?? CONFUSED_DURATION);
    hurtPlayer(
      player,
      hazard.damage ?? nativeShamanSpec.damage,
      Math.sign(hazard.dx),
      confusedApplied ? 'Cursed by a laughing skull! Controls inverted!' : 'Cursed by a laughing skull!',
      '#6cf085',
      effects,
    );
    return false;
  }
  return true;
}
