import { MATERIAL } from '../../content.js';
import { solidAt, waterTileAt } from '../../world.js';
import { COLS, MOB_HEALTH, TILE, WATER, clamp, waterwayAt } from '../../world/generation.js';

export const fishSpec = {
  name: 'fish',
  width: 12,
  height: 8,
  radius: 10,
  centerY: 0,
  material: MATERIAL.sand,
  maxHealth: MOB_HEALTH.fish,
};

export function fishCollides(world, player, x, y, width = 12, height = 8) {
  if (y - height / 2 < WATER + 8) return true;
  const left = Math.floor((x - width / 2) / TILE);
  const right = Math.floor((x + width / 2 - 0.01) / TILE);
  const top = Math.floor((y - height / 2) / TILE);
  const bottom = Math.floor((y + height / 2 - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!waterTileAt(world, tx, ty) || waterwayAt(tx, ty) || solidAt(world, tx, ty, player)) {
        return true;
      }
    }
  }
  return false;
}

// Snapshot each school once per tick so all fish react to the same group state.
export function snapshotFishSchools(mobs, px, py, playerInWater, playerMoving) {
  const schools = new Map();
  for (const mob of mobs) {
    if (!mob.schoolId || mob.enemyType || mob.health <= 0 || mob.respawn > 0) continue;
    if (!schools.has(mob.schoolId)) schools.set(mob.schoolId, { members: [], x: 0, y: 0, startled: false });
    const school = schools.get(mob.schoolId);
    school.members.push({ id: mob.id, x: mob.x, y: mob.y });
    school.x += mob.x;
    school.y += mob.y;
    if (playerInWater && playerMoving && Math.hypot(mob.x - px, mob.y - py) < 55) school.startled = true;
  }
  for (const school of schools.values()) {
    school.x /= school.members.length;
    school.y /= school.members.length;
    school.escapeX = school.x - px;
    school.escapeY = school.y - py;
  }
  return schools;
}

export function stepSchoolFish(world, player, mob, dt, time, school) {
  const scale = mob.fishScale ?? 1;
  const blocked = (x, y) => fishCollides(world, player, x, y, 12 * scale, 8 * scale);
  const phase = time * .31 + mob.schoolPhase;
  const centerX = mob.schoolX + Math.sin(phase) * mob.span;
  const centerY = mob.schoolY + Math.sin(phase * .65) * 13;
  const offsetX = mob.schoolOffsetX, offsetY = mob.schoolOffsetY;
  let targetDx = Math.cos(phase) * mob.span * .31 + (centerX + offsetX - mob.x) * 1.7;
  let targetDy = (centerY + offsetY + Math.sin(time * 2.3 + mob.phase) * 2 - mob.y) * 1.8;
  if (school.startled) mob.flee = Math.max(mob.flee, 1.3);
  if (mob.flee > 0) {
    const distance = Math.hypot(school.escapeX, school.escapeY) || 1;
    targetDx = school.escapeX / distance * mob.speed * 1.85 + (school.x + offsetX - mob.x) * .8;
    targetDy = school.escapeY / distance * mob.speed * 1.45 + (school.y + offsetY - mob.y) * .8;
  }
  // Personal space when turning or regrouping.
  for (const other of school.members) {
    if (other.id === mob.id) continue;
    const x = mob.x - other.x, y = mob.y - other.y;
    const d = Math.hypot(x, y);
    if (d > 0 && d < 11) {
      targetDx += x / d * (11 - d) * 2.8;
      targetDy += y / d * (11 - d) * 2.8;
    }
  }
  const maxSpeed = mob.speed * (mob.flee > 0 ? 1.9 : 1.35);
  const magnitude = Math.hypot(targetDx, targetDy) || 1;
  targetDx *= Math.min(1, maxSpeed / magnitude);
  targetDy *= Math.min(1, maxSpeed / magnitude);
  const probeX = mob.x + Math.sign(targetDx) * 12;
  if (blocked(probeX, mob.y)) {
    targetDx *= -.5;
    if (!blocked(probeX, mob.y - 14)) targetDy = -mob.speed;
    else if (!blocked(probeX, mob.y + 14)) targetDy = mob.speed;
  }
  mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
  mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
  const nx = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
  if (!blocked(nx, mob.y)) mob.x = nx;
  else mob.dx *= -.5;
  const ny = Math.max(WATER + 14, mob.y + mob.dy * dt);
  if (!blocked(mob.x, ny)) mob.y = ny;
  else mob.dy *= -.5;
  if (Math.abs(mob.dx) > 1.5) mob.facing = Math.sign(mob.dx);
}

export function stepFish(
  world,
  player,
  mob,
  dt,
  time,
  enemies,
  { dist, diffX, diffY, playerInWater, playerMoving },
) {
  let hit;
  if (!mob.enemyType && playerInWater && dist < 44 && playerMoving) {
    mob.flee = 1.1;
    if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
  }

  let targetDx;
  let targetDy;
  if (mob.enemyType && playerInWater && dist < (mob.wardenTaunt > 0 ? 192 : 108) && mob.remainingLife > 2) {
    targetDx = (-diffX / dist) * mob.speed;
    targetDy = (-diffY / dist) * mob.speed;
    if (
      !player.flightOrigin &&
      enemies.hitCooldown === 0 &&
      Math.abs(diffX) < 12 &&
      Math.abs(diffY) < 16
    ) {
      enemies.hitCooldown = 3;
      hit = mob.enemyType;
    }
  } else if (mob.flee > 0) {
    targetDx = mob.facing * mob.speed * 1.75;
    targetDy = clamp((diffY / dist) * mob.speed * 1.1, -mob.speed, mob.speed);
  } else {
    if (mob.x > mob.homeX + mob.span) mob.facing = -1;
    else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
    if (fishCollides(world, player, mob.x + mob.facing * 12, mob.y)) {
      mob.facing = -mob.facing;
    }
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

  return hit;
}
