import { MATERIAL } from '../../content.js';
import { takeDamage } from '../player.js';
import { solidAt, waterTileAt } from '../../world.js';
import { MOB_HEALTH, TILE, clamp } from '../../world/generation.js';

export function makeCaveEnemySpec(kind, name, width, height, speed, damage, reach) {
  return {
    name,
    width,
    height,
    speed,
    damage,
    reach,
    centerY: -height / 2,
    radius: Math.max(width, height) / 2,
    maxHealth: MOB_HEALTH[kind],
    material: MATERIAL.deepstone,
  };
}

export function dryCell(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return !waterTileAt(world, tx, ty) && !solidAt(world, tx, ty);
}

export function clearPath(world, fromX, fromY, toX, toY) {
  const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / (TILE / 3));
  for (let step = 0; step <= steps; step++) {
    const t = steps ? step / steps : 0;
    if (!dryCell(world, fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)) return false;
  }
  return true;
}

export function canStand(world, x, feet, spec) {
  const left = Math.floor((x - spec.width / 2) / TILE);
  const right = Math.floor((x + spec.width / 2 - .01) / TILE);
  const top = Math.floor((feet - spec.height) / TILE);
  const bottom = Math.floor((feet - .01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (waterTileAt(world, tx, ty) || solidAt(world, tx, ty)) return false;
    }
  }
  return true;
}

export function onFloor(world, x, y) {
  return solidAt(world, Math.floor(x / TILE), Math.floor((y + 1) / TILE));
}

export function hurtPlayer(player, damage, direction, message, color, effects) {
  if (player.flightOrigin || player.hurt > 0) return;
  player.hurt = 1;
  takeDamage(player, damage);
  player.dx = direction * 112;
  player.dy = -65;
  effects.push({ x: player.x, y: player.y + player.height / 2, color, count: 7, spread: 62, message });
}

export function stepCaveEnemyBase(world, player, mob, spec, dt, effects, hooks = {}) {
  const playerY = player.y + player.height / 2;
  const deltaX = player.x - mob.x;
  const deltaY = playerY - (mob.y + spec.centerY);
  const distance = Math.hypot(deltaX, deltaY);
  const active = !player.flightOrigin && distance < 170 &&
    clearPath(world, mob.x, mob.y + spec.centerY, player.x, playerY);

  mob.attackTimer = Math.max(0, mob.attackTimer - dt);
  let speed = 0;
  const ctx = { world, player, mob, spec, dt, effects, deltaX, deltaY, distance, active };

  if (mob.flee > 0) {
    mob.windup = 0;
    mob.minerSwing = null;
    mob.dash = 0;
    speed = mob.dx * .8;
  } else {
    const activeSpeed = hooks.stepActive?.(ctx);
    if (activeSpeed !== undefined) {
      speed = activeSpeed;
    } else if (mob.windup > 0) {
      mob.windup = Math.max(0, mob.windup - dt);
      if (mob.windup === 0) {
        mob.attackTimer = hooks.attackCooldown ?? 1.45;
        if (hooks.onWindupComplete) {
          hooks.onWindupComplete(ctx);
        } else if (active && distance <= spec.reach) {
          hurtPlayer(player, spec.damage, mob.facing, 'Struck by a ' + spec.name + '!', '#d88e6d', effects);
        }
      }
    } else if (active) {
      mob.facing = deltaX >= 0 ? 1 : -1;
      if (distance <= spec.reach && mob.attackTimer === 0) {
        if (hooks.startAttack) {
          hooks.startAttack(ctx);
        } else {
          mob.windup = hooks.windupDuration ?? .38;
        }
      } else if (distance > (hooks.chaseDistance ?? 14) && Math.abs(mob.x - mob.homeX) < 170) {
        speed = mob.facing * spec.speed;
      }
    } else if (Math.abs(mob.x - mob.homeX) > 3) {
      mob.facing = Math.sign(mob.homeX - mob.x);
      speed = mob.facing * spec.speed * .65;
    }
  }

  mob.dx = speed;
  const nextX = mob.x + speed * dt;
  if (canStand(world, nextX, mob.y, spec)) {
    if (onFloor(world, nextX, mob.y) || !mob.grounded ||
        (canStand(world, nextX, mob.y + TILE, spec) && onFloor(world, nextX, mob.y + TILE))) {
      mob.x = nextX;
    }
  } else if (!mob.dash && mob.grounded && canStand(world, nextX, mob.y - TILE, spec) && onFloor(world, nextX, mob.y - TILE)) {
    mob.x = nextX;
    mob.y -= TILE;
  }
  mob.dy = clamp(mob.dy + 510 * dt, -160, 200);
  const nextY = mob.y + mob.dy * dt;
  if (canStand(world, mob.x, nextY, spec)) {
    mob.y = nextY;
    mob.grounded = false;
  } else {
    if (mob.dy > 0 && onFloor(world, mob.x, nextY)) {
      mob.y = Math.floor((nextY + 1) / TILE) * TILE;
      mob.grounded = true;
    }
    mob.dy = 0;
  }

  hooks.onPostMove?.(ctx);
}

export function stepCaveDasherActive({ player, mob, spec, dt, effects, deltaX, deltaY, active }) {
  if (!(mob.dash > 0)) return undefined;
  mob.dash = Math.max(0, mob.dash - dt);
  if (active && Math.abs(deltaX) <= spec.radius + 7 && Math.abs(deltaY) < 17) {
    hurtPlayer(player, spec.damage, mob.facing, 'Hit by a ' + spec.name + '!', '#d88e6d', effects);
  }
  return mob.facing * 168;
}
