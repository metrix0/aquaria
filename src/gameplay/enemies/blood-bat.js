import { isCaveRefuge } from '../../world/island-cave.js';
import { clamp, TILE, WEST_EXTENSION } from '../../world/generation.js';
import { clearPath, dryCell, hurtPlayer, makeCaveEnemySpec } from './cave-shared.js';

export const BLOOD_BAT_BLIND_DURATION = 10;
export const BLOOD_BAT_BLEED_DURATION = 5;

export const bloodBatSpec = {
  ...makeCaveEnemySpec('blood-bat', 'blood bat', 14, 10, 86, 11, 14),
  centerY: 0,
  radius: 10,
  color: '#7d1826',
};

function canFlyAt(world, x, y) {
  return (
    dryCell(world, x - 5, y - 3) &&
    dryCell(world, x + 5, y - 3) &&
    dryCell(world, x - 5, y + 3) &&
    dryCell(world, x + 5, y + 3) &&
    !isCaveRefuge(Math.floor(x / TILE) - WEST_EXTENSION, Math.floor(y / TILE))
  );
}

export function stepBloodBat(world, player, mob, dt, effects) {
  mob.attackTimer = Math.max(0, (mob.attackTimer ?? 0) - dt);
  mob.flyTime = (mob.flyTime ?? 0) + dt;
  const playerY = player.y + player.height / 2;
  const deltaX = player.x - mob.x;
  const deltaY = playerY - mob.y;
  const distance = Math.hypot(deltaX, deltaY);
  const active =
    !player.flightOrigin &&
    distance < 220 &&
    !isCaveRefuge(Math.floor(player.x / TILE) - WEST_EXTENSION, Math.floor(playerY / TILE)) &&
    clearPath(world, mob.x, mob.y, player.x, playerY);

  let targetDx = 0;
  let targetDy = 0;

  if (mob.flee > 0) {
    targetDx = mob.dx * 0.85;
    targetDy = mob.dy * 0.85 - 12;
  } else if (active) {
    mob.facing = deltaX >= 0 ? 1 : -1;
    if (distance <= 13 && mob.attackTimer === 0) {
      if ((player.hurt ?? 0) <= 0) {
        const roll = mob.statusRoll ?? Math.random();
        let message = 'Bitten by a blood bat!';
        let color = '#9e2030';
        if (roll < 0.30) {
          player.blindness = Math.max(player.blindness ?? 0, BLOOD_BAT_BLIND_DURATION);
          message = 'Struck by a blood bat! Blinded!';
          color = '#5d121d';
        } else if (roll < 0.70) {
          player.bleed = Math.max(player.bleed ?? 0, BLOOD_BAT_BLEED_DURATION);
          if (!(player.bleedTick > 0)) player.bleedTick = 1;
          message = 'Bitten by a blood bat! Bleeding!';
          color = '#c4313d';
        }
        hurtPlayer(player, bloodBatSpec.damage, mob.facing, message, color, effects);
      }
      mob.attackTimer = 1.15;
      mob.dx = -mob.facing * 55;
      mob.dy = -32;
      return;
    }
    const len = distance || 1;
    const flutter = Math.sin(mob.flyTime * 9 + mob.phase) * 14;
    targetDx = (deltaX / len) * bloodBatSpec.speed;
    targetDy = (deltaY / len) * bloodBatSpec.speed + flutter;
  } else {
    const hoverX = mob.homeX + Math.sin(mob.flyTime * 1.4 + mob.phase) * 26;
    const hoverY = mob.homeY + Math.cos(mob.flyTime * 2.1 + mob.phase) * 10;
    const hx = hoverX - mob.x;
    const hy = hoverY - mob.y;
    const hDist = Math.hypot(hx, hy) || 1;
    const patrolSpeed = Math.min(34, hDist * 2.2);
    targetDx = (hx / hDist) * patrolSpeed;
    targetDy = (hy / hDist) * patrolSpeed;
    if (Math.abs(targetDx) > 2) mob.facing = Math.sign(targetDx);
  }

  const blend = clamp(dt * 6.5, 0, 1);
  mob.dx += (targetDx - mob.dx) * blend;
  mob.dy += (targetDy - mob.dy) * blend;

  const nextX = mob.x + mob.dx * dt;
  if (canFlyAt(world, nextX, mob.y)) {
    mob.x = nextX;
  } else {
    mob.dx = -mob.dx * 0.4;
  }

  const nextY = mob.y + mob.dy * dt;
  if (canFlyAt(world, mob.x, nextY)) {
    mob.y = nextY;
  } else {
    mob.dy = -mob.dy * 0.4;
  }
}
