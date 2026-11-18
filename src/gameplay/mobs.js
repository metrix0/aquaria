import { MATERIAL } from '../content.js';
import { updateEnemySpawns } from '../enemies.js';
import { solidAt } from '../world.js';
import { COLS, TILE, WATER, clamp } from '../world/generation.js';

const enemySpecs = {
  jellyfish: { width: 12, height: 18, radius: 11, damage: 4, message: 'Stung by a jellyfish. -4s oxygen', material: MATERIAL.reef },
  squid: { width: 16, height: 14, radius: 12, damage: 5, message: 'Struck by a reef squid. -5s oxygen', material: MATERIAL.bedrock },
  shark: { width: 30, height: 14, radius: 15, damage: 7, message: 'Bitten by a shark! -7s oxygen', material: MATERIAL.stone },
};

function fishCollides(world, player, x, y, width = 12, height = 8) {
  if (y - height / 2 < WATER + 8) return true;
  const left = Math.floor((x - width / 2) / TILE);
  const right = Math.floor((x + width / 2 - 0.01) / TILE);
  const top = Math.floor((y - height / 2) / TILE);
  const bottom = Math.floor((y + height / 2 - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(world, tx, ty, player)) return true;
    }
  }
  return false;
}

function crabCollides(world, player, x, y) {
  const left = Math.floor((x - 6) / TILE);
  const right = Math.floor((x + 6 - 0.01) / TILE);
  const top = Math.floor((y - 8) / TILE);
  const bottom = Math.floor((y - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(world, tx, ty, player)) return true;
    }
  }
  return false;
}

function crabHasFloor(world, player, x, y) {
  const tx = Math.floor(x / TILE);
  const baseTy = Math.floor((y + 1) / TILE);
  return solidAt(world, tx, baseTy, player) || solidAt(world, tx, baseTy + 1, player);
}

export function syncMobs(world, player) {
  for (const mob of world.mobs) {
    if (mob.kind === 'crab') {
      while (mob.y > TILE && crabCollides(world, player, mob.x, mob.y)) mob.y -= TILE;
    } else if (fishCollides(world, player, mob.x, mob.y)) {
      for (let offset = 1; offset <= 4; offset++) {
        if (!fishCollides(world, player, mob.x, mob.y - offset * TILE)) {
          mob.y -= offset * TILE;
          break;
        }
        if (!fishCollides(world, player, mob.x, mob.y + offset * TILE)) {
          mob.y += offset * TILE;
          break;
        }
      }
    }
  }
}

export function stepMobs(world, player, dt, time, mining, night, enemies, effects) {
  updateEnemySpawns(enemies, world.mobs, player, night, dt, (x, y) => fishCollides(world, player, x, y));
  enemies.hitCooldown = Math.max(0, enemies.hitCooldown - dt);
  const underwater = player.y + 5 > WATER;
  const px = player.x;
  const py = player.y + 11;
  const playerMoving = Math.hypot(player.dx, player.dy) > 14 || mining;
  let hit;

  for (const mob of world.mobs) {
    mob.flee = Math.max(0, mob.flee - dt);
    const diffX = mob.x - px;
    const diffY = (mob.kind === 'crab' ? mob.y - 4 : mob.y) - py;
    const dist = Math.hypot(diffX, diffY) || 1;

    if (mob.kind === 'fish') {
      if (!mob.enemyType && py > WATER && dist < 44 && playerMoving) {
        mob.flee = 1.1;
        if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
      }

      let targetDx;
      let targetDy;
      if (mob.enemyType && underwater && dist < 108 && mob.remainingLife > 2) {
        targetDx = -diffX / dist * mob.speed;
        targetDy = -diffY / dist * mob.speed;
        if (enemies.hitCooldown === 0 && Math.abs(diffX) < 12 && Math.abs(diffY) < 10) {
          enemies.hitCooldown = 3;
          hit = mob.enemyType;
        }
      } else if (mob.flee > 0) {
        targetDx = mob.facing * mob.speed * 1.75;
        targetDy = clamp((diffY / dist) * mob.speed * 1.1, -mob.speed, mob.speed);
      } else {
        if (mob.x > mob.homeX + mob.span) mob.facing = -1;
        else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
        if (fishCollides(world, player, mob.x + mob.facing * 12, mob.y)) mob.facing = -mob.facing;
        targetDx = mob.facing * mob.speed * (0.85 + 0.25 * Math.sin(time * 2.1 + mob.phase));
        const targetY = Math.max(WATER + 14, mob.homeY + Math.sin(time * 1.5 + mob.phase) * 10);
        targetDy = clamp((targetY - mob.y) * 1.8, -mob.speed * 0.65, mob.speed * 0.65);
      }

      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
      mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
      if (Math.abs(mob.dx) > 1.5) mob.facing = mob.dx < 0 ? -1 : 1;

      const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
      if (!fishCollides(world, player, nextX, mob.y)) {
        mob.x = nextX;
      } else {
        mob.facing = -mob.facing;
        mob.dx *= -0.6;
      }

      const nextY = Math.max(WATER + 10, mob.y + mob.dy * dt);
      if (!fishCollides(world, player, mob.x, nextY)) {
        mob.y = nextY;
      } else {
        mob.dy *= -0.6;
      }
    } else if (mob.kind === 'crab') {
      if (dist < 36 && playerMoving) {
        mob.flee = 1;
        if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
      }

      if (mob.x > mob.homeX + mob.span) mob.facing = -1;
      else if (mob.x < mob.homeX - mob.span) mob.facing = 1;

      const scuttling = mob.flee > 0 || Math.sin(time * 1.15 + mob.phase * 2.1) > -0.55;
      const targetDx = scuttling ? mob.facing * mob.speed * (mob.flee > 0 ? 1.65 : 1) : 0;
      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 10);

      if (Math.abs(mob.dx) > 0.5) {
        const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
        if (!crabCollides(world, player, nextX, mob.y)) {
          if (!mob.grounded || crabHasFloor(world, player, nextX, mob.y)) {
            mob.x = nextX;
          } else {
            mob.facing = -mob.facing;
            mob.dx = 0;
          }
        } else {
          const stepY = Math.floor((mob.y - 1) / TILE) * TILE;
          if (mob.grounded && mob.y - stepY <= TILE && !crabCollides(world, player, mob.x, stepY) && !crabCollides(world, player, nextX, stepY)) {
            mob.x = nextX;
            mob.y = stepY;
          } else {
            mob.facing = -mob.facing;
            mob.dx = 0;
          }
        }
      }

      const inWater = mob.y > WATER;
      mob.dy = Math.min(mob.dy + (inWater ? 260 : 480) * dt, inWater ? 120 : 210);
      const nextY = mob.y + mob.dy * dt;
      if (!crabCollides(world, player, mob.x, nextY)) {
        mob.y = nextY;
        mob.grounded = false;
      } else {
        mob.y = Math.floor((nextY - 0.01) / TILE) * TILE;
        mob.dy = 0;
        mob.grounded = true;
      }
    } else if (enemySpecs[mob.kind]) {
      const spec = enemySpecs[mob.kind];
      mob.cooldown = Math.max(0, (mob.cooldown ?? 0) - dt);
      const playerInWater = py > WATER + 6;
      const toPlayerX = px - mob.x;
      const toPlayerY = py - mob.y;
      let targetDx = 0;
      let targetDy = 0;

      if (mob.flee > 0) {
        targetDx = -(toPlayerX / dist) * (mob.speed * 1.6 + 24);
        targetDy = -(toPlayerY / dist) * (mob.speed * 1.2 + 16);
      } else if (mob.kind === 'jellyfish') {
        const targetX = mob.homeX + Math.sin(time * 0.55 + mob.phase) * mob.span;
        const targetY = mob.homeY + Math.sin(time * 1.5 + mob.phase * 1.7) * 16;
        targetDx = clamp((targetX - mob.x) * 1.4, -mob.speed, mob.speed);
        targetDy = clamp((targetY - mob.y) * 2.1, -mob.speed * 1.3, mob.speed * 1.3);
      } else if (mob.kind === 'squid') {
        const pulse = 0.3 + 0.95 * Math.pow(Math.max(0, Math.sin(time * 2.7 + mob.phase)), 2);
        if (playerInWater && dist < 115 && mob.cooldown === 0) {
          targetDx = (toPlayerX / dist) * mob.speed * 1.25 * pulse;
          targetDy = (toPlayerY / dist) * mob.speed * 1.1 * pulse;
        } else {
          const targetX = mob.homeX + Math.sin(time * 0.75 + mob.phase) * mob.span;
          const targetY = mob.homeY + Math.cos(time * 1.35 + mob.phase) * 15;
          const toX = targetX - mob.x;
          const toY = targetY - mob.y;
          const toDist = Math.hypot(toX, toY) || 1;
          targetDx = (toX / toDist) * mob.speed * pulse;
          targetDy = (toY / toDist) * mob.speed * 0.75 * pulse;
        }
      } else if (mob.kind === 'shark') {
        if (playerInWater && dist < 165 && Math.abs(px - mob.homeX) < mob.span + 95 && mob.cooldown === 0) {
          targetDx = (toPlayerX / dist) * mob.speed * 1.18;
          targetDy = (toPlayerY / dist) * mob.speed * 0.82;
        } else {
          if (mob.x > mob.homeX + mob.span) mob.facing = -1;
          else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
          targetDx = mob.facing * mob.speed;
          const targetY = mob.homeY + Math.sin(time * 1.2 + mob.phase) * 9;
          targetDy = clamp((targetY - mob.y) * 1.8, -26, 26);
        }
      }

      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
      mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
      if (Math.abs(mob.dx) > 1.5 && mob.kind !== 'jellyfish') mob.facing = mob.dx < 0 ? -1 : 1;

      const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
      if (!fishCollides(world, player, nextX, mob.y, spec.width, spec.height)) {
        mob.x = nextX;
      } else {
        mob.dx *= -0.75;
        mob.facing = -mob.facing;
      }

      const nextY = Math.max(WATER + 12, mob.y + mob.dy * dt);
      if (!fishCollides(world, player, mob.x, nextY, spec.width, spec.height)) {
        mob.y = nextY;
      } else {
        mob.dy *= -0.75;
      }

      if (playerInWater && player.hurt <= 0 && mob.flee <= 0 && mob.cooldown <= 0 && dist < spec.radius + 7) {
        player.hurt = 1.15;
        mob.cooldown = 1.6;
        if (mob.kind === 'squid') mob.flee = 1.8;
        player.dx = (toPlayerX / dist) * 135;
        player.dy = (toPlayerY / dist) * 105 - 18;
        player.oxygen = Math.max(0, player.oxygen - spec.damage);
        effects.push({ x: mob.x, y: mob.y, material: spec.material, count: mob.kind === 'squid' ? 14 : 9, spread: 68, message: spec.message });
        dirty = true;
      }
    }
  }
  return hit;
}

export function fendOffEnemy({ world, player }, wx, wy) {
  for (const mob of world.mobs) {
    const spec = enemySpecs[mob.kind];
    if (!spec) continue;
    if (Math.hypot(wx - mob.x, wy - mob.y) <= spec.radius + 10 && Math.hypot(mob.x - player.x, mob.y - player.y - 11) <= 5 * TILE) {
      const angle = Math.atan2(mob.y - (player.y + 11), mob.x - player.x);
      mob.dx = Math.cos(angle) * 125;
      mob.dy = Math.sin(angle) * 95;
      mob.flee = 2.4;
      mob.cooldown = 1.4;
      return { x: mob.x, y: mob.y, material: spec.material, count: mob.kind === 'squid' ? 14 : 8, spread: 64,
        message: mob.kind === 'squid' ? 'Startled squid jetted away in ink!' : 'Fended off ' + mob.kind + '!' };
    }
  }
}

export function resetHostiles(world) {
  for (const mob of world.mobs) {
    if (enemySpecs[mob.kind]) Object.assign(mob, { x: mob.homeX, y: mob.homeY, dx: 0, dy: 0, flee: 0, cooldown: 0 });
  }
}
