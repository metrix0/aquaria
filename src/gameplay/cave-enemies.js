import { overlapsMob, pickaxePose, toolHitbox } from './melee.js';
import { MATERIAL } from '../content.js';
import { solidAt, waterTileAt } from '../world.js';
import { MOB_HEALTH, TILE, clamp } from '../world/generation.js';

export const caveEnemySpecs = Object.fromEntries([
  ['spider', 'cave spider', 13, 8, 34, 13, 86],
  ['archer', 'skeleton archer', 12, 23, 25, 12, 135],
  ['miner', 'skeletal miner', 14, 23, 34, 18, 22],
  ['scorpion', 'cave scorpion', 20, 13, 37, 18, 94],
  ['hammer', 'hammer skeleton', 29, 41, 26, 26, 35],
].map(([kind, name, width, height, speed, damage, reach]) => [kind, {
  name, width, height, speed, damage, reach, centerY: -height / 2, radius: Math.max(width, height) / 2,
  maxHealth: MOB_HEALTH[kind], material: MATERIAL.deepstone,
}]));

function dryCell(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return !waterTileAt(world, tx, ty) && !solidAt(world, tx, ty);
}

function clearPath(world, fromX, fromY, toX, toY) {
  const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / (TILE / 3));
  for (let step = 0; step <= steps; step++) {
    const t = steps ? step / steps : 0;
    if (!dryCell(world, fromX + (toX - fromX) * t, fromY + (toY - fromY) * t)) return false;
  }
  return true;
}

function canStand(world, x, feet, spec) {
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

function onFloor(world, x, y) {
  return solidAt(world, Math.floor(x / TILE), Math.floor((y + 1) / TILE));
}

function hurtPlayer(player, damage, direction, message, color, effects) {
  if (player.flightOrigin || player.hurt > 0) return;
  player.hurt = 1;
  player.health = Math.max(0, player.health - damage);
  player.dx = direction * 112;
  player.dy = -65;
  effects.push({ x: player.x, y: player.y + player.height / 2, color, count: 7, spread: 62, message });
}

export function stepCaveEnemy(world, player, mob, dt, effects) {
  const spec = caveEnemySpecs[mob.kind];
  const archer = mob.kind === 'archer';
  const dasher = mob.kind === 'spider' || mob.kind === 'scorpion';
  const playerY = player.y + player.height / 2;
  const deltaX = player.x - mob.x;
  const deltaY = playerY - (mob.y + spec.centerY);
  const distance = Math.hypot(deltaX, deltaY);
  const active = !player.flightOrigin && distance < 170 &&
    clearPath(world, mob.x, mob.y + spec.centerY, player.x, playerY);

  mob.attackTimer = Math.max(0, mob.attackTimer - dt);
  let speed = 0;

  if (mob.flee > 0) {
    mob.windup = 0;
    mob.minerSwing = null;
    mob.dash = 0;
    speed = mob.dx * .8;
  } else if (mob.minerSwing != null) {
    mob.minerSwing += dt;
    const { angle, bounds } = pickaxePose(Math.min(1, mob.minerSwing / .44));
    if (active && bounds) {
      const hitbox = toolHitbox(Math.round(mob.x) + mob.facing * 2, Math.round(mob.y) - 12, mob.facing, angle, bounds);
      if (overlapsMob(hitbox, player, { width: player.width, height: player.height, centerY: player.height / 2 })) {
        hurtPlayer(player, spec.damage, mob.facing, 'Struck by a ' + spec.name + '!', '#d88e6d', effects);
      }
    }
    if (mob.minerSwing >= .44) mob.minerSwing = null;
  } else if (mob.dash > 0) {
    mob.dash = Math.max(0, mob.dash - dt);
    speed = mob.facing * 168;
    if (active && Math.abs(deltaX) <= spec.radius + 7 && Math.abs(deltaY) < 17) {
      hurtPlayer(player, spec.damage, mob.facing, 'Hit by a ' + spec.name + '!', '#d88e6d', effects);
    }
  } else if (mob.windup > 0) {
    mob.windup = Math.max(0, mob.windup - dt);
    if (mob.windup === 0) {
      mob.attackTimer = mob.kind === 'hammer' ? 2 : 1.45;
      if (active && archer && distance <= spec.reach) {
        world.projectiles.push({ kind: 'cave-arrow', x: mob.x, y: mob.y + spec.centerY,
          dx: deltaX / (distance || 1) * 205, dy: deltaY / (distance || 1) * 205, life: 1.15 });
      } else if (dasher) {
        mob.dash = .55;
        mob.venomIn = 0;
      } else if (active && distance <= spec.reach) {
        hurtPlayer(player, spec.damage, mob.facing, 'Struck by a ' + spec.name + '!', '#d88e6d', effects);
      }
    }
  } else if (active) {
    mob.facing = deltaX >= 0 ? 1 : -1;
    if (distance <= spec.reach && mob.attackTimer === 0) {
      if (mob.kind === 'miner') {
        mob.minerSwing = 0;
        mob.attackTimer = 1.45;
      } else {
        mob.windup = mob.kind === 'hammer' ? .65 : .38;
      }
    }
    else if (distance > (archer ? 90 : 14) && Math.abs(mob.x - mob.homeX) < 170) speed = mob.facing * spec.speed;
  } else if (Math.abs(mob.x - mob.homeX) > 3) {
    mob.facing = Math.sign(mob.homeX - mob.x);
    speed = mob.facing * spec.speed * .65;
  }

  mob.dx = speed;
  const nextX = mob.x + speed * dt;
  if (canStand(world, nextX, mob.y, spec)) {
    if (onFloor(world, nextX, mob.y) || !mob.grounded ||
        (canStand(world, nextX, mob.y + TILE, spec) && onFloor(world, nextX, mob.y + TILE))) mob.x = nextX;
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

  if (mob.kind === 'scorpion' && mob.dash > 0 && mob.grounded) {
    mob.venomIn -= dt;
    if (mob.venomIn <= 0) {
      world.projectiles.push({ kind: 'venom', x: mob.x, y: mob.y - 1, life: 4.5 });
      mob.venomIn = .13;
    }
  }
}

export function stepCaveHazard(world, player, hazard, dt, effects) {
  const oldX = hazard.x;
  const oldY = hazard.y;
  hazard.life -= dt;
  if (hazard.life <= 0) return false;
  if (hazard.kind === 'cave-arrow') {
    hazard.x += hazard.dx * dt;
    hazard.y += hazard.dy * dt;
    if (!clearPath(world, oldX, oldY, hazard.x, hazard.y)) return false;
    if (!player.flightOrigin && Math.abs(player.x - hazard.x) < player.width / 2 + 2 &&
        hazard.y >= player.y && hazard.y < player.y + player.height) {
      hurtPlayer(player, 12, Math.sign(hazard.dx), 'Hit by a skeleton arrow!', '#e6ceaa', effects);
      return false;
    }
  } else {
    if (!dryCell(world, hazard.x, hazard.y) || !onFloor(world, hazard.x, hazard.y)) return false;
    const feet = player.y + player.height;
    if (Math.abs(player.x - hazard.x) < 10 && Math.abs(feet - hazard.y) < 4 && player.grounded) {
      hurtPlayer(player, 8, Math.sign(player.x - hazard.x), 'Stepped in scorpion venom!', '#a6c968', effects);
    }
  }
  return true;
}
