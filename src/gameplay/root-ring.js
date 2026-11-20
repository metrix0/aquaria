import { ROOT_RING } from '../inventory.js';
import { solidAt } from '../world.js';
import { TILE } from '../world/generation.js';
import { damageMob, mobSpec } from './mobs.js';

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

export function useRootRing(game) {
  const { player, progress } = game;
  if (progress.ring !== ROOT_RING.id || player.stun > 0 || player.flightOrigin || ringCooldown(game)) return;
  game.rootReadyAt = game.elapsed + ROOT_RING.cooldown;
  game.rootWave = {
    x: player.x, y: player.y + player.height * .66,
    facing: player.facing, age: 0, length: 0, fade: 0, finished: false,
  };
  game.dirty = true;
  return true;
}

function blocksRoot(world, x, y) {
  return solidAt(world, Math.floor(x / TILE), Math.floor(y / TILE));
}

function reachedEnemy(world, wave, x, y) {
  return world.mobs.find((mob) => {
    if ((mob.x - wave.x) * wave.facing <= 0 || mob.health <= 0 || mob.respawn > 0 || mob.kind === 'crab' ||
        (mob.kind === 'fish' && !mob.enemyType && !mob.krakenMinion)) return false;
    const spec = mobSpec(mob);
    if (!spec) return false;
    const points = mob.segments?.length
      ? mob.segments.map((seg) => ({ x: seg.x, y: seg.y, halfW: seg.radius, halfH: seg.radius }))
      : [{ x: mob.x, y: mob.y + spec.centerY, halfW: spec.width / 2, halfH: spec.height / 2 }];
    return points.some((pt) => {
      if ((pt.x - wave.x) * wave.facing <= 0 || Math.abs(x - pt.x) > pt.halfW) return false;
      const distance = pt.y - y;
      if (Math.abs(distance) > pt.halfH + 8) return false;
      for (let reach = 4; reach < Math.abs(distance); reach += 4) {
        if (blocksRoot(world, x, y + Math.sign(distance) * reach)) return false;
      }
      return true;
    });
  });
}

export function stepRootWave(game, dt) {
  const wave = game.rootWave;
  if (!wave) return;
  wave.age += dt;
  if (wave.finished) {
    const mob = wave.target;
    if (mob && wave.age >= wave.squeezeAt && (mob.rootLift ?? 0) === 0) {
      wave.target = null;
      const angle = wave.facing > 0 ? 0 : Math.PI;
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
    const x = wave.x + wave.facing * distance;
    if (blocksRoot(game.world, x, wave.y)) break;
    wave.length = distance;
    const mob = reachedEnemy(game.world, wave, x, wave.y);
    if (!mob) continue;
    if (mob.kind !== 'kraken') {
      mob.rooted = ROOT_BIND_DURATION;
      mob.rootLift = ROOT_LIFT;
      mob.rootBaseY = mob.y;
      mob.grounded = false;
    }
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
