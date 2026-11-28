import { ROOT_RING } from '../inventory.js';
import { solidAt } from '../world.js';
import { TILE } from '../world/generation.js';
import { damageMob, mobSpec } from './mobs.js';
import { playerImmobilized } from './player.js';

const WINDUP = .14;
const SPEED = 270;
const RANGE = 10 * TILE;
const TRAIL_HOLD = .45;
const TRAIL_FADE = .45;
const ROOT_LIFT = 20;

export const ROOT_BIND_DURATION = 4.6;
export const ROOT_SQUEEZE_TIME = .48;

export function ringCooldown(game) {
  return Math.max(0, game.rootReadyAt - game.elapsed);
}

export function useRootRing(game, targetX, targetY) {
  const { player, progress } = game;
  if (progress.ring !== ROOT_RING.id || playerImmobilized(player) || player.flightOrigin || ringCooldown(game)) return;
  const x = player.x;
  const y = player.y + player.height * .66;
  const hasTarget = Number.isFinite(targetX) && Number.isFinite(targetY) && (targetX !== x || targetY !== y);
  const angle = hasTarget ? Math.atan2(targetY - y, targetX - x) : (player.facing < 0 ? Math.PI : 0);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const facing = dirX < -0.001 ? -1 : dirX > 0.001 ? 1 : player.facing;
  game.rootReadyAt = game.elapsed + ROOT_RING.cooldown;
  game.rootWave = {
    x, y,
    facing, angle, dirX, dirY,
    age: 0, length: 0, fade: 0, finished: false,
  };
  game.dirty = true;
  return true;
}

function blocksRoot(world, x, y) {
  return solidAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
}

function reachedEnemy(world, wave, x, y) {
  const dirX = wave.dirX ?? wave.facing;
  const dirY = wave.dirY ?? 0;
  return world.mobs.find((mob) => {
    // Every living mob can be bound: no passive, hostile, or species exceptions.
    if (mob.health <= 0 || mob.respawn > 0) return false;
    const spec = mobSpec(mob);
    if (!spec) return false;
    const points = mob.segments?.length
      ? mob.segments.map((seg) => ({ x: seg.x, y: seg.y, halfW: seg.radius, halfH: seg.radius }))
      : [{ x: mob.x, y: mob.y + spec.centerY, halfW: spec.width / 2, halfH: spec.height / 2 }];
    return points.some((pt) => {
      if ((pt.x - wave.x) * dirX + (pt.y - wave.y) * dirY <= 0) return false;
      if (Math.abs(x - pt.x) > pt.halfW + 3 || Math.abs(y - pt.y) > pt.halfH + 8) return false;
      const dx = pt.x - x;
      const dy = pt.y - y;
      const span = Math.hypot(dx, dy);
      for (let reach = 4; reach < span; reach += 4) {
        if (blocksRoot(world, x + dx * (reach / span), y + dy * (reach / span))) return false;
      }
      return true;
    });
  });
}

export function stepRootWave(game, dt) {
  const wave = game.rootWave;
  if (!wave) return;
  wave.age += dt;
  const dirX = wave.dirX ?? wave.facing;
  const dirY = wave.dirY ?? 0;
  if (wave.finished) {
    const mob = wave.target;
    if (mob && wave.age >= wave.squeezeAt && (mob.rootLift ?? 0) === 0) {
      wave.target = null;
      const angle = wave.angle ?? (wave.facing > 0 ? 0 : Math.PI);
      if (game.world.mobs.includes(mob) && damageMob(game.world, mob, 3, angle, 0, game.effects)) {
        game.effects.push({ x: mob.x, y: mob.y + mobSpec(mob).centerY, color: '#93c879', count: 13, spread: 45 });
      }
    }
    wave.fade = Math.min(1, Math.max(0, 1 - (wave.age - wave.fadeAt) / TRAIL_FADE));
    if (wave.fade === 0) game.rootWave = null;
    return;
  }
  if (wave.age < WINDUP) return;
  const end = Math.min(RANGE, (wave.age - WINDUP) * SPEED);
  while (wave.length < end && !wave.finished) {
    const distance = Math.min(end, wave.length + 3);
    const x = wave.x + dirX * distance;
    const y = wave.y + dirY * distance;
    if (blocksRoot(game.world, x, y)) break;
    wave.length = distance;
    const mob = reachedEnemy(game.world, wave, x, y);
    if (!mob) continue;
    mob.rooted = ROOT_BIND_DURATION;
    mob.frostRoot = false;
    mob.rootLift = ROOT_LIFT;
    mob.rootBaseY = mob.y;
    mob.grounded = false;
    wave.target = mob;
    wave.squeezeAt = wave.age + ROOT_SQUEEZE_TIME;
    wave.finished = true;
  }
  if (wave.finished || wave.length < end || end === RANGE) {
    wave.finished = true;
    wave.fadeAt = wave.age + TRAIL_HOLD;
    wave.fade = 1;
  }
}
