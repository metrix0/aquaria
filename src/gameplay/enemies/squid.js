import { harmful } from '../effect-potency.js';
import { MATERIAL } from '../../content.js';
import { playerWaterborne, takeDamage } from '../player.js';
import { solidAt, waterTileAt } from '../../world.js';
import { MOB_HEALTH, TILE, WATER, clamp, waterwayAt } from '../../world/generation.js';
import { stepSeaEnemy } from './sea-shared.js';

const paintColors = ['#07080d', '#0d1017', '#141821'];
const INK_EFFECT_DURATION = 7;

export const squidSpec = {
  name: 'reef squid',
  width: 16,
  height: 14,
  radius: 12,
  centerY: 0,
  damage: 4,
  healthDamage: 22,
  message: 'Struck by a reef squid.',
  material: MATERIAL.bedrock,
  maxHealth: MOB_HEALTH.squid,
};

export function stepSquid(world, player, mob, dt, time, effects, ctx) {
  stepSeaEnemy(world, player, mob, squidSpec, dt, effects, ctx, ({ dist, playerInWater, toPlayerX, toPlayerY }) => {
    const pulse = 0.3 + 0.95 * Math.pow(Math.max(0, Math.sin(time * 2.7 + mob.phase)), 2);
    let targetDx = 0;
    let targetDy = 0;

    if (mob.windup > 0) {
      mob.windup = Math.max(0, mob.windup - dt);
      if (Math.abs(toPlayerX) > 2) mob.facing = toPlayerX < 0 ? -1 : 1;
      targetDx = -mob.facing * 12;
      targetDy = clamp(toPlayerY * 0.25, -14, 14);
      if (mob.windup === 0 && playerInWater) {
        const baseAngle = Math.atan2(toPlayerY, toPlayerX);
        const projectiles = world.projectiles ?? (world.projectiles = []);
        for (const [idx, offset] of [-0.17, 0, 0.17].entries()) {
          const angle = baseAngle + offset;
          const speed = offset === 0 ? 128 : 116;
          projectiles.push({
            kind: 'paint-bubble',
            x: mob.x + mob.facing * 9,
            y: mob.y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            radius: offset === 0 ? 4 : 3,
            life: 2.4,
            phase: mob.phase + idx * 1.4,
            color: paintColors[idx],
          });
        }
        mob.attackTimer = 2.8 + (mob.phase % 1.1);
        effects.push({
          x: mob.x + mob.facing * 9,
          y: mob.y,
          color: '#0d1017',
          count: 6,
          spread: 40,
        });
      }
    } else if (playerInWater && dist < 175 && mob.cooldown === 0) {
      if (Math.abs(toPlayerX) > 2) mob.facing = toPlayerX < 0 ? -1 : 1;
      if (dist < 56) {
        targetDx = -(toPlayerX / dist) * mob.speed * 0.75 * pulse;
        targetDy = -(toPlayerY / dist) * mob.speed * 0.55 * pulse;
      } else if (dist > 95) {
        targetDx = (toPlayerX / dist) * mob.speed * 1.15 * pulse;
        targetDy = (toPlayerY / dist) * mob.speed * pulse;
      } else {
        targetDy = Math.sin(time * 2.1 + mob.phase) * 16;
      }
      mob.attackTimer -= dt;
      if (mob.attackTimer <= 0 && dist > 26) mob.windup = 0.42;
    } else {
      const targetX = mob.homeX + Math.sin(time * 0.75 + mob.phase) * mob.span;
      const targetY = mob.homeY + Math.cos(time * 1.35 + mob.phase) * 15;
      const toX = targetX - mob.x;
      const toY = targetY - mob.y;
      const toDist = Math.hypot(toX, toY) || 1;
      targetDx = (toX / toDist) * mob.speed * pulse;
      targetDy = (toY / toDist) * mob.speed * 0.75 * pulse;
    }

    return { targetDx, targetDy };
  });
}

export function stepInkBubble(world, player, bubble, dt, time, effects) {
  const px = player.x;
  const py = player.y + Math.ceil(player.height / 2);
  const playerInWater = playerWaterborne(world, player);

  bubble.life -= dt;
  const nx = bubble.x + bubble.dx * dt;
  const ny = bubble.y + (bubble.dy + Math.sin(time * 9 + bubble.phase) * 14) * dt;
  const tx = Math.floor(nx / TILE);
  const ty = Math.floor(ny / TILE);

  if (
    bubble.life <= 0 ||
    ny - bubble.radius < WATER + 4 ||
    !waterTileAt(world, tx, ty) ||
    waterwayAt(tx, ty) ||
    solidAt(world, tx, ty, player)
  ) {
    effects.push({
      x: bubble.x,
      y: bubble.y,
      color: bubble.color,
      count: 5,
      spread: 36,
    });
    return false;
  }

  bubble.x = nx;
  bubble.y = ny;

  if (
    !player.flightOrigin &&
    playerInWater &&
    Math.hypot(bubble.x - px, bubble.y - py) <= bubble.radius + 7
  ) {
    const effect = {
      x: bubble.x,
      y: bubble.y,
      color: bubble.color,
      count: 9,
      spread: 54,
    };
    if ((player.inkCooldown ?? 0) <= 0) {
      player.inkCooldown = 0.35;
      if (!player.inkSplats) player.inkSplats = [];
      // Gera entre 3 e 5 manchas por impacto
      const splatCount = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < splatCount; s++) {
        const isMainSplat = s === 0;
        const duration = harmful(player,INK_EFFECT_DURATION * (0.8 + Math.random() * 0.35));

        player.inkSplats.push({
          nx: 0.1 + Math.random() * 0.8,
          ny: 0.1 + Math.random() * 0.8,
          scale: isMainSplat
            ? 0.95 + Math.random() * 0.35 // mancha principal maior
            : 0.45 + Math.random() * 0.45, // respingos menores ao redor
          angle: Math.random() * Math.PI * 2,
          seed: Math.floor(Math.random() * 10000),
          color: paintColors[Math.floor(Math.random() * paintColors.length)],
          time: duration,
          duration,
        });
      }

      // 'while' garante o limite de 10 mesmo adicionando várias de uma vez
      while (player.inkSplats.length > 10) player.inkSplats.shift();
    }
    if ((player.hurt ?? 0) <= 0) {
      player.hurt = 0.9;
      player.dx = clamp(bubble.dx * 0.65, -95, 95);
      player.dy = clamp(bubble.dy * 0.55 - 10, -80, 80);
      const loss = takeDamage(player, 15);
      player.oxygen = Math.max(0, player.oxygen - 2);
      effect.message = 'Hit by squid ink bubble! −' + loss + ' health';
    }
    effects.push(effect);
    return false;
  }

  return true;
}
