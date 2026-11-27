import { harmful } from '../effect-potency.js';
import { MATERIAL } from '../../content.js';
import { solidAt, waterTileAt } from '../../world.js';
import { MOB_HEALTH, TILE, WATER, clamp, waterwayAt } from '../../world/generation.js';
import { playerWaterborne, takeDamage } from '../player.js';
import { stepSeaEnemy } from './sea-shared.js';

export const LIONFISH_MIN_DEPTH = 20;
export const LIONFISH_MAX_DEPTH = 80;
export const LIONFISH_AGGRO_RADIUS = 128;
export const LIONFISH_WINDUP = 1.1;
export const LIONFISH_CLOUD_DURATION = 4.5;
export const LIONFISH_SPINE_RANGE = 108;
export const NEUROTOXIN_DURATION = 1.8;

const SPINE_SPEED = 118;
const SPINE_DAMAGE = 14;
const CLOUD_RADIUS = 22;

export const lionfishSpec = {
  name: 'lionfish',
  width: 18,
  height: 14,
  radius: 10,
  centerY: 0,
  damage: 2,
  healthDamage: 12,
  message: 'Brushed a lionfish!',
  material: MATERIAL.reef,
  maxHealth: MOB_HEALTH.lionfish,
};

function spawnStarburst(world, mob) {
  if (!world.projectiles) world.projectiles = [];
  const count = (mob.burstCount ?? 0) % 2 === 0 ? 8 : 6;
  mob.burstCount = (mob.burstCount ?? 0) + 1;
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const angle = i * step;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    world.projectiles.push({
      kind: 'lionfish-spine',
      x: mob.x + dirX * 9,
      y: mob.y + dirY * 9,
      dx: dirX * SPINE_SPEED,
      dy: dirY * SPINE_SPEED,
      angle,
      traveled: 0,
      maxDistance: LIONFISH_SPINE_RANGE,
      radius: 3,
      color: '#c85cff',
    });
  }
}

export function stepLionfish(world, player, mob, dt, time, effects, ctx) {
  stepSeaEnemy(world, player, mob, lionfishSpec, dt, effects, ctx, ({ dist, playerInWater }) => {
    // Passive patrol along a predictable horizontal corridor with gentle vertical bobbing.
    const patrolX = mob.homeX + Math.sin(time * 0.45 + mob.phase) * mob.span;
    const patrolY = mob.homeY + Math.cos(time * 0.9 + mob.phase * 1.3) * 8;
    const toX = patrolX - mob.x;
    const toY = patrolY - mob.y;
    const toDist = Math.hypot(toX, toY) || 1;
    let targetDx = clamp((toX / toDist) * mob.speed, -mob.speed, mob.speed);
    let targetDy = clamp((toY / toDist) * mob.speed * 0.75, -mob.speed * 0.75, mob.speed * 0.75);

    if (mob.windup > 0) {
      mob.windup = Math.max(0, mob.windup - dt);
      targetDx = 0;
      targetDy = 0;
      if (mob.windup === 0) {
        spawnStarburst(world, mob);
        mob.attackTimer = 2.8;
        effects.push({
          x: mob.x,
          y: mob.y,
          color: '#d56bff',
          count: 8,
          spread: 58,
        });
      }
      return { targetDx, targetDy, accel: 9 };
    }

    mob.attackTimer = Math.max(0, (mob.attackTimer ?? 0) - dt);
    if (!player.flightOrigin && playerInWater && mob.attackTimer <= 0 && dist <= LIONFISH_AGGRO_RADIUS) {
      mob.windup = LIONFISH_WINDUP;
      mob.dx *= 0.25;
      mob.dy *= 0.25;
      targetDx = 0;
      targetDy = 0;
    }

    return { targetDx, targetDy };
  });
}

export function stepLionfishSpine(world, player, spine, dt, effects) {
  const px = player.x;
  const py = player.y + Math.ceil(player.height / 2);
  const playerInWater = playerWaterborne(world, player);

  const stepX = spine.dx * dt;
  const stepY = spine.dy * dt;
  const stepDist = Math.hypot(stepX, stepY);
  const nx = spine.x + stepX;
  const ny = spine.y + stepY;
  spine.traveled = (spine.traveled ?? 0) + stepDist;

  const tx = Math.floor(nx / TILE);
  const ty = Math.floor(ny / TILE);

  // Hitting solid rock/wall embeds the spine and blooms a lingering neurotoxin cloud.
  if (solidAt(world, tx, ty)) {
    const dirX = Math.cos(spine.angle);
    const dirY = Math.sin(spine.angle);
    const cx = nx - dirX * 3;
    const cy = ny - dirY * 3;
    world.projectiles.push({
      kind: 'neurotoxin-cloud',
      x: cx,
      y: cy,
      anchorX: nx,
      anchorY: ny,
      angle: spine.angle,
      radius: CLOUD_RADIUS,
      life: LIONFISH_CLOUD_DURATION,
      maxLife: LIONFISH_CLOUD_DURATION,
      phase: Math.abs(Math.sin(nx * 0.17 + ny * 0.31)) * Math.PI * 2,
      color: '#a84de0',
    });
    effects.push({ x: cx, y: cy, color: '#a84de0', count: 7, spread: 44 });
    return false;
  }

  // Dissolve cleanly after traveling max range or leaving water.
  if (spine.traveled >= (spine.maxDistance ?? LIONFISH_SPINE_RANGE) || ny < WATER + 4 || !waterTileAt(world, tx, ty) || waterwayAt(tx, ty)) {
    effects.push({ x: spine.x, y: spine.y, color: '#c85cff', count: 3, spread: 24 });
    return false;
  }

  spine.x = nx;
  spine.y = ny;

  if (!player.flightOrigin && playerInWater && Math.hypot(spine.x - px, spine.y - py) <= 9) {
    player.neurotoxin = Math.max(player.neurotoxin ?? 0, harmful(player,NEUROTOXIN_DURATION * 1.4));
    if ((player.hurt ?? 0) <= 0) {
      player.hurt = 0.85;
      const loss = takeDamage(player, SPINE_DAMAGE);
      effects.push({
        x: px,
        y: py,
        color: '#c85cff',
        count: 8,
        spread: 52,
        message: 'Pierced by a lionfish spine! −' + loss + ' health',
      });
    }
    return false;
  }

  return true;
}

export function stepNeurotoxinCloud(world, player, cloud, dt) {
  cloud.life -= dt;
  if (cloud.life <= 0) return false;
  const px = player.x;
  const py = player.y + Math.ceil(player.height / 2);
  const activeRadius = cloud.radius * Math.min(1, 0.4 + ((cloud.maxLife - cloud.life) / 0.25) * 0.6);
  if (!player.flightOrigin && playerWaterborne(world, player) && Math.hypot(px - cloud.x, py - cloud.y) <= activeRadius + 6) {
    player.neurotoxin = Math.max(player.neurotoxin ?? 0, harmful(player,NEUROTOXIN_DURATION));
  }
  return true;
}
