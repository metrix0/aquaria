import { isCaveRefuge } from '../../world/island-cave.js';
import { MATERIAL } from '../../content.js';
import { takeDamage } from '../player.js';
import { solidAt, waterTileAt } from '../../world.js';
import { MOB_HEALTH, TILE, WEST_EXTENSION, clamp } from '../../world/generation.js';

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
  return !isCaveRefuge(Math.floor(x / TILE) - WEST_EXTENSION, bottom);
}

export function onFloor(world, x, y, spec = null) {
  const ty = Math.floor((y + 1) / TILE);
  if (!spec) return solidAt(world, Math.floor(x / TILE), ty);
  const left = Math.floor((x - spec.width / 2) / TILE);
  const right = Math.floor((x + spec.width / 2 - .01) / TILE);
  for (let tx = left; tx <= right; tx++) {
    if (solidAt(world, tx, ty)) return true;
  }
  return false;
}

function hasWaterBelow(world, x, y) {
  const tx = Math.floor(x / TILE);
  const startTy = Math.floor(y / TILE);
  for (let ty = startTy; ty <= startTy + 6; ty++) {
    if (solidAt(world, tx, ty)) return false;
    if (waterTileAt(world, tx, ty)) return true;
  }
  return false;
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
  const sightRange = hooks.sightRange ?? 170;
  const leashRange = hooks.leashRange ?? 170;
  const active = !player.flightOrigin && distance < (mob.wardenTaunt > 0 ? Math.max(sightRange, 12 * TILE) : sightRange) &&
    !isCaveRefuge(Math.floor(player.x / TILE) - WEST_EXTENSION, Math.floor(playerY / TILE)) &&
    clearPath(world, mob.x, mob.y + spec.centerY, player.x, playerY);

  mob.attackTimer = Math.max(0, mob.attackTimer - dt);
  mob.jumpCooldown = Math.max(0, (mob.jumpCooldown ?? 0) - dt);
  let speed = 0;
  const ctx = { world, player, mob, spec, dt, effects, deltaX, deltaY, distance, active };

  if (mob.flee > 0) {
    mob.windup = 0;
    mob.minerSwing = null;
    mob.spearThrust = null;
    mob.spearHit = false;
    mob.dash = 0;
    mob.airDx = 0;
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
      } else if (distance > (mob.grounded ? (hooks.chaseDistance ?? 14) : 4) && (mob.wardenTaunt > 0 || Math.abs(mob.x - mob.homeX) < leashRange)) {
        speed = mob.facing * spec.speed;
      }
    } else if (Math.abs(mob.x - mob.homeX) > 3) {
      mob.facing = Math.sign(mob.homeX - mob.x);
      speed = mob.facing * spec.speed * .65;
    }
  }

  const moveSpeed = !mob.grounded && !active && speed === 0 && mob.flee <= 0 ? (mob.airDx ?? 0) : speed;
  if (mob.grounded) mob.airDx = speed;
  else if (speed !== 0) mob.airDx = speed;

  mob.dx = moveSpeed;
  const nextX = mob.x + moveSpeed * dt;
  const leadingX = nextX + Math.sign(moveSpeed) * (spec.width / 2 - .01);
  const jumpSpeed = hooks.jumpSpeed ?? 210;
  if (mob.grounded && jumpSpeed > 0 && mob.flee <= 0 && moveSpeed !== 0 && mob.jumpCooldown === 0) {
    const blockedAhead = !canStand(world, nextX, mob.y, spec);
    const hasStep = blockedAhead && canStand(world, nextX, mob.y - TILE, spec) && onFloor(world, nextX, mob.y - TILE, spec);
    const canJumpObstacle = blockedAhead && !hasStep
      && canStand(world, mob.x, mob.y - 2 * TILE, spec)
      && canStand(world, nextX, mob.y - 2 * TILE, spec);
    const gapAhead = !blockedAhead
      && !onFloor(world, nextX, mob.y)
      && !onFloor(world, leadingX, mob.y)
      && !(canStand(world, nextX, mob.y + TILE, spec) && onFloor(world, nextX, mob.y + TILE))
      && [1, 2, 3].some((step) => {
        const landX = mob.x + mob.facing * step * TILE;
        return !hasWaterBelow(world, landX, mob.y) && (onFloor(world, landX, mob.y) || onFloor(world, landX, mob.y + TILE));
      });
    const playerAbove = active && player.y + player.height <= mob.y - 6 && Math.abs(deltaX) < 6 * TILE
      && canStand(world, mob.x, mob.y - TILE, spec) && !hasWaterBelow(world, nextX, mob.y);
    const battleHop = active && hooks.battleHop && Math.abs(deltaX) > 36 && Math.abs(deltaX) < 120
      && Math.abs(deltaY) < 28 && !hasWaterBelow(world, mob.x + mob.facing * TILE, mob.y)
      && (onFloor(world, mob.x + mob.facing * TILE, mob.y) || onFloor(world, mob.x + mob.facing * TILE, mob.y + TILE));

    if (canJumpObstacle || gapAhead || playerAbove || battleHop) {
      mob.dy = -(canJumpObstacle || gapAhead || playerAbove ? jumpSpeed : hooks.hopSpeed ?? jumpSpeed);
      mob.grounded = false;
      mob.jumpCooldown = canJumpObstacle || gapAhead ? 0.55 : 1.35 + (mob.phase % 0.8);
    }
  }

  if (canStand(world, nextX, mob.y, spec)) {
    if (onFloor(world, nextX, mob.y) ||
        (onFloor(world, leadingX, mob.y) && !hasWaterBelow(world, nextX, mob.y)) ||
        (!mob.grounded && !hasWaterBelow(world, nextX, mob.y)) ||
        (canStand(world, nextX, mob.y + TILE, spec) && onFloor(world, nextX, mob.y + TILE))) {
      mob.x = nextX;
    }
  } else if (mob.grounded && canStand(world, nextX, mob.y - TILE, spec) && onFloor(world, nextX, mob.y - TILE, spec)) {
    mob.x = nextX;
    mob.y -= TILE;
  }
  mob.dy = clamp(mob.dy + 510 * dt, -220, 200);
  const nextY = mob.y + mob.dy * dt;
  if (canStand(world, mob.x, nextY, spec)) {
    mob.y = nextY;
    mob.grounded = false;
  } else {
    if (mob.dy > 0 && onFloor(world, mob.x, nextY, spec)) {
      mob.y = Math.floor((nextY + 1) / TILE) * TILE;
      mob.grounded = true;
      mob.airDx = 0;
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
