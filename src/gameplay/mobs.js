import { MATERIAL } from '../content.js';
import { takeDamage } from './player.js';
import { stepWreckGhost, wreckGhostSpec } from './wreck-ghosts.js';
import { updateEnemySpawns } from '../enemies.js';
import { inWater, solidAt, waterTileAt } from '../world.js';
import { caveEnemySpecs, stepCaveEnemy, stepCaveHazard } from './cave-enemies.js';
import { COLS, MOB_HEALTH, TILE, WATER, clamp, waterwayAt } from '../world/generation.js';

const enemySpecs = {
  jellyfish: { name: 'jellyfish', width: 12, height: 18, radius: 11, centerY: 0, damage: 3, healthDamage: 16, message: 'Stung by a jellyfish.', material: MATERIAL.reef, maxHealth: MOB_HEALTH.jellyfish },
  squid: { name: 'reef squid', width: 16, height: 14, radius: 12, centerY: 0, damage: 4, healthDamage: 22, message: 'Struck by a reef squid.', material: MATERIAL.bedrock, maxHealth: MOB_HEALTH.squid },
  shark: { name: 'shark', width: 30, height: 14, radius: 15, centerY: 0, damage: 5, healthDamage: 34, message: 'Bitten by a shark!', material: MATERIAL.stone, maxHealth: MOB_HEALTH.shark },
};
const mobSpecs = {
  crab: { name: 'crab', width: 12, height: 8, radius: 10, centerY: -4, material: MATERIAL.sand, maxHealth: MOB_HEALTH.crab },
  fish: { name: 'fish', width: 12, height: 8, radius: 10, centerY: 0, material: MATERIAL.sand, maxHealth: MOB_HEALTH.fish },
  ...enemySpecs,
  ...caveEnemySpecs,
  ghost: wreckGhostSpec,
};
const paintColors = ['#7e4268', '#b0667d', '#da9292'];

function stepProjectiles(world, player, dt, time, effects) {
  if (!world.projectiles) world.projectiles = [];
  const px = player.x;
  const py = player.y + Math.ceil(player.height / 2);
  const playerInWater = inWater(world, px, py);

  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const bubble = world.projectiles[i];
    if (bubble.kind === 'cave-arrow' || bubble.kind === 'venom') {
      if (!stepCaveHazard(world, player, bubble, dt, effects)) world.projectiles.splice(i, 1);
      continue;
    }
    bubble.life -= dt;
    const nx = bubble.x + bubble.dx * dt;
    const ny = bubble.y + (bubble.dy + Math.sin(time * 9 + bubble.phase) * 14) * dt;
    const tx = Math.floor(nx / TILE);
    const ty = Math.floor(ny / TILE);

    if (bubble.life <= 0 || ny - bubble.radius < WATER + 4 || !waterTileAt(world, tx, ty) || waterwayAt(tx, ty) || solidAt(world, tx, ty, player)) {
      effects.push({ x: bubble.x, y: bubble.y, color: bubble.color, count: 5, spread: 36 });
      world.projectiles.splice(i, 1);
      continue;
    }

    bubble.x = nx;
    bubble.y = ny;

    if (!player.flightOrigin && playerInWater && Math.hypot(bubble.x - px, bubble.y - py) <= bubble.radius + 7) {
      const effect = { x: bubble.x, y: bubble.y, color: bubble.color, count: 9, spread: 54 };
      if ((player.hurt ?? 0) <= 0) {
        player.hurt = 0.9;
        player.dx = clamp(bubble.dx * 0.65, -95, 95);
        player.dy = clamp(bubble.dy * 0.55 - 10, -80, 80);
        const loss = takeDamage(player, 15);
        player.oxygen = Math.max(0, player.oxygen - 2);
        effect.message = 'Hit by squid paint bubble! −' + loss + ' health';
      }
      effects.push(effect);
      world.projectiles.splice(i, 1);
    }
  }
}

function fishCollides(world, player, x, y, width = 12, height = 8) {
  if (y - height / 2 < WATER + 8) return true;
  const left = Math.floor((x - width / 2) / TILE);
  const right = Math.floor((x + width / 2 - 0.01) / TILE);
  const top = Math.floor((y - height / 2) / TILE);
  const bottom = Math.floor((y + height / 2 - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!waterTileAt(world, tx, ty) || waterwayAt(tx, ty) || solidAt(world, tx, ty, player)) return true;
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
    if (caveEnemySpecs[mob.kind] || mob.kind === 'ghost') continue;
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
  const px = player.x;
  const py = player.y + 11;
  const playerInWater = inWater(world, px, py);
  const underwater = inWater(world, px, player.y + 5);
  const playerMoving = Math.hypot(player.dx, player.dy) > 14 || mining;
  let hit;

  for (const mob of world.mobs) {
    mob.hurt = Math.max(0, (mob.hurt ?? 0) - dt);
    if (mob.kind === 'ghost') {
      stepWreckGhost(world, player, mob, dt, time, effects);
      continue;
    }
    if (mob.respawn > 0) {
      mob.respawn = Math.max(0, mob.respawn - dt);
      if (mob.respawn === 0) {
        Object.assign(mob, {
          x: mob.homeX, y: mob.homeY, dx: 0, dy: 0, flee: 0, cooldown: 0, hurt: 0, health: mob.maxHealth, grounded: mob.kind === 'crab',
          attackTimer: 1.4 + (mob.phase % 1.5), windup: 0, minerSwing: null, dash: 0, dashDx: 0, dashDy: 0, shock: 0, shockHit: false,
        });
      }
      continue;
    }
    if (mob.health <= 0) continue;
    mob.flee = Math.max(0, mob.flee - dt);
    const diffX = mob.x - px;
    const diffY = (mob.kind === 'crab' ? mob.y - 4 : mob.y) - py;
    const dist = Math.hypot(diffX, diffY) || 1;

    if (caveEnemySpecs[mob.kind]) {
      stepCaveEnemy(world, player, mob, dt, effects);
    } else if (mob.kind === 'fish') {
      if (!mob.enemyType && playerInWater && dist < 44 && playerMoving) {
        mob.flee = 1.1;
        if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
      }

      let targetDx;
      let targetDy;
      if (mob.enemyType && underwater && dist < 108 && mob.remainingLife > 2) {
        targetDx = -diffX / dist * mob.speed;
        targetDy = -diffY / dist * mob.speed;
        if (!player.flightOrigin && enemies.hitCooldown === 0 && Math.abs(diffX) < 12 && Math.abs(diffY) < 10) {
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

      const submerged = inWater(world, mob.x, mob.y - 1);
      mob.dy = Math.min(mob.dy + (submerged ? 260 : 480) * dt, submerged ? 120 : 210);
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
      mob.attackTimer = mob.attackTimer ?? 1.8;
      mob.windup = mob.windup ?? 0;
      const toPlayerX = px - mob.x;
      const toPlayerY = py - mob.y;
      let targetDx = 0;
      let targetDy = 0;
      let accel = 5;

      if (mob.flee > 0) {
        mob.windup = 0;
        mob.dash = 0;
        mob.shock = 0;
        targetDx = -(toPlayerX / dist) * (mob.speed * 1.6 + 24);
        targetDy = -(toPlayerY / dist) * (mob.speed * 1.2 + 16);
      } else if (mob.kind === 'jellyfish') {
        const targetX = mob.homeX + Math.sin(time * 0.55 + mob.phase) * mob.span;
        const targetY = mob.homeY + Math.sin(time * 1.5 + mob.phase * 1.7) * 16;
        targetDx = clamp((targetX - mob.x) * 1.4, -mob.speed, mob.speed);
        targetDy = clamp((targetY - mob.y) * 2.1, -mob.speed * 1.3, mob.speed * 1.3);

        if ((mob.shock ?? 0) > 0) {
          mob.shock = Math.max(0, mob.shock - dt);
          const shockRadius = 14 + (1 - mob.shock / 0.45) * 44;
          if (!player.flightOrigin && playerInWater && !mob.shockHit && (player.hurt ?? 0) <= 0 && dist <= shockRadius) {
            mob.shockHit = true;
            player.hurt = 1.2;
            player.stun = 2.5;
            mob.cooldown = 1.8;
            player.dx = (toPlayerX / dist) * 115;
            player.dy = (toPlayerY / dist) * 95 - 12;
            takeDamage(player, 20);
            player.oxygen = Math.max(0, player.oxygen - 3);
            effects.push({ x: px, y: py, color: '#8bdfd0', count: 12, spread: 75, message: 'Shocked by a jellyfish! Stunned!' });
          }
        } else if (mob.windup > 0) {
          mob.windup = Math.max(0, mob.windup - dt);
          targetDx *= 0.25;
          targetDy *= 0.25;
          if (mob.windup === 0) {
            mob.shock = 0.45;
            mob.shockHit = false;
            mob.attackTimer = 4.4 + (mob.phase % 1.4);
            effects.push({ x: mob.x, y: mob.y, color: '#f8dca5', count: 10, spread: 80 });
          }
        } else if (playerInWater && mob.cooldown === 0 && dist < 96) {
          mob.attackTimer -= dt;
          if (mob.attackTimer <= 0) mob.windup = 0.72;
        }
      } else if (mob.kind === 'squid') {
        const pulse = 0.3 + 0.95 * Math.pow(Math.max(0, Math.sin(time * 2.7 + mob.phase)), 2);
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
            effects.push({ x: mob.x + mob.facing * 9, y: mob.y, color: '#b0667d', count: 6, spread: 40 });
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
      } else if (mob.kind === 'shark') {
        if ((mob.dash ?? 0) > 0) {
          mob.dash = Math.max(0, mob.dash - dt);
          targetDx = mob.dashDx;
          targetDy = mob.dashDy;
          accel = 15;
          if (Math.random() < 0.4) effects.push({ x: mob.x - mob.facing * 14, y: mob.y, color: '#a1d9cb', count: 1, spread: 18 });
        } else if (mob.windup > 0) {
          mob.windup = Math.max(0, mob.windup - dt);
          if (Math.abs(toPlayerX) > 2) mob.facing = toPlayerX < 0 ? -1 : 1;
          targetDx = -mob.facing * 26;
          targetDy = clamp(toPlayerY * 0.4, -18, 18);
          accel = 9;
          if (mob.windup === 0) {
            mob.dashDx = (toPlayerX / dist) * 210;
            mob.dashDy = (toPlayerY / dist) * 165;
            mob.dash = 0.6;
            mob.attackTimer = 3.2 + (mob.phase % 1.2);
            effects.push({ x: mob.x - mob.facing * 12, y: mob.y, color: '#a1d9cb', count: 6, spread: 44 });
          }
        } else if (playerInWater && dist < 170 && Math.abs(px - mob.homeX) < mob.span + 105 && mob.cooldown === 0) {
          targetDx = (toPlayerX / dist) * mob.speed * 0.85;
          targetDy = (toPlayerY / dist) * mob.speed * 0.68;
          mob.attackTimer -= dt;
          if (mob.attackTimer <= 0 && dist < 145) mob.windup = 0.45;
        } else {
          if (mob.x > mob.homeX + mob.span) mob.facing = -1;
          else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
          targetDx = mob.facing * mob.speed;
          const targetY = mob.homeY + Math.sin(time * 1.2 + mob.phase) * 9;
          targetDy = clamp((targetY - mob.y) * 1.8, -26, 26);
        }
      }

      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * accel);
      mob.dy += (targetDy - mob.dy) * Math.min(1, dt * accel);
      if (Math.abs(mob.dx) > 1.5 && mob.kind !== 'jellyfish' && mob.windup <= 0) mob.facing = mob.dx < 0 ? -1 : 1;

      const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
      if (!fishCollides(world, player, nextX, mob.y, spec.width, spec.height)) {
        mob.x = nextX;
      } else {
        mob.dx *= -0.75;
        mob.facing = -mob.facing;
        mob.dash = 0;
      }

      const nextY = Math.max(WATER + 12, mob.y + mob.dy * dt);
      if (!fishCollides(world, player, mob.x, nextY, spec.width, spec.height)) {
        mob.y = nextY;
      } else {
        mob.dy *= -0.75;
        mob.dash = 0;
      }

      const dashingShark = mob.kind === 'shark' && (mob.dash ?? 0) > 0;
      const hitRadius = dashingShark ? spec.radius + 9 : spec.radius + 7;
      if (!player.flightOrigin && playerInWater && (player.hurt ?? 0) <= 0 && mob.flee <= 0 && mob.cooldown <= 0 && dist < hitRadius) {
        player.hurt = 1.15;
        mob.cooldown = dashingShark ? 2.0 : 1.6;
        if (mob.kind === 'squid') mob.flee = 1.8;
        const dmg = dashingShark ? 42 : spec.healthDamage;
        const air = dashingShark ? 6 : spec.damage;
        const knock = dashingShark ? 175 : 135;
        mob.dash = 0;
        player.dx = (toPlayerX / dist) * knock;
        player.dy = (toPlayerY / dist) * 105 - 18;
        const loss = takeDamage(player, dmg);
        player.oxygen = Math.max(0, player.oxygen - air);
        effects.push({
          x: mob.x, y: mob.y, material: spec.material, count: mob.kind === 'squid' ? 14 : 9, spread: 68,
          message: (dashingShark ? 'Shark dash bite!' : spec.message) + ' −' + loss + ' health',
        });
      }
    }
  }
  stepProjectiles(world, player, dt, time, effects);
  return hit;
}

export function mobSpec(mob) {
  return mobSpecs[mob.kind];
}

export function damageMob(world, mob, damage, angle, knockback, effects) {
  const spec = mobSpecs[mob.kind];
  if (!spec || mob.health <= 0 || mob.respawn > 0) return null;
  const cy = mob.y + spec.centerY;
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  mob.health = Math.max(0, (mob.health ?? spec.maxHealth) - damage);
  mob.hurt = 0.32;

  if (mob.kind === 'crab') {
    mob.facing = dir;
    mob.dx = dir * (knockback ?? 95);
    mob.dy = -65;
    mob.grounded = false;
    mob.flee = 1.8;
  } else if (mob.kind === 'fish') {
    mob.facing = dir;
    const force = knockback ?? 115;
    mob.dx = Math.cos(angle) * force;
    mob.dy = Math.sin(angle) * (force * 0.74);
    mob.flee = 1.8;
  } else {
    const force = knockback ?? (mob.kind === 'shark' ? 85 : 115);
    mob.dx = Math.cos(angle) * force;
    mob.dy = Math.sin(angle) * (force * 0.75);
    mob.flee = mob.kind === 'shark' ? 0.65 : 1.6;
    mob.cooldown = Math.max(mob.cooldown ?? 0, 0.9);
  }

  const label = mob.enemyType ? mob.enemyType.name.toLowerCase() : spec.name;
  let effect;
  if (mob.health <= 0) {
    if (mob.enemyType) {
      const index = world.mobs.indexOf(mob);
      if (index !== -1) world.mobs.splice(index, 1);
    } else if (mob.kind !== 'ghost') {
      mob.respawn = mob.respawnDelay ?? 45;
    }
    effect = { x: mob.x, y: cy, material: spec.material, color: spec.color, count: 14, spread: 72, message: 'Defeated ' + label + '!' };
  } else {
    effect = {
      x: mob.x, y: cy, material: spec.material, color: spec.color, count: mob.kind === 'squid' ? 12 : 7, spread: 58,
      message: 'Hit ' + label + ' (' + mob.health + '/' + mob.maxHealth + ' HP)',
    };
  }
  effects?.push(effect);
  return effect;
}

export function targetMobAt({ world, player }, wx, wy) {
  let best = null;
  let bestDist = Infinity;
  for (const mob of world.mobs) {
    if (mob.health <= 0 || mob.respawn > 0) continue;
    const spec = mobSpecs[mob.kind];
    if (!spec) continue;
    const cy = mob.y + spec.centerY;
    const pointerDist = Math.hypot(wx - mob.x, wy - cy);
    const playerDist = Math.hypot(mob.x - player.x, cy - (player.y + 11));
    if (pointerDist <= spec.radius + 12 && playerDist <= 5 * TILE && pointerDist < bestDist) {
      best = mob;
      bestDist = pointerDist;
    }
  }
  return best;
}

export function resetHostiles(world) {
  if (world.projectiles) world.projectiles.length = 0;
  for (const mob of world.mobs) {
    if ((enemySpecs[mob.kind] || caveEnemySpecs[mob.kind]) && !(mob.respawn > 0)) {
      Object.assign(mob, {
        x: mob.homeX, y: mob.homeY, dx: 0, dy: 0, flee: 0, cooldown: 0, health: mob.maxHealth,
        attackTimer: 1.4 + (mob.phase % 1.5), windup: 0, minerSwing: null, dash: 0, dashDx: 0, dashDy: 0, shock: 0, shockHit: false,
      });
    }
  }
}
