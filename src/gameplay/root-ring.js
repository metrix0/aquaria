import { ROOT_RING } from '../inventory.js';
import { solidAt } from '../world.js';
import { TILE } from '../world/generation.js';
import { damageMob, mobSpec } from './mobs.js';

const WINDUP = .14;
const SPEED = 270;
const RANGE = 10 * TILE;
const HOLD = .24;

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
    if (!spec || Math.abs(x - mob.x) > spec.width / 2) return false;
    const center = mob.y + spec.centerY;
    const distance = center - y;
    if (Math.abs(distance) > spec.height / 2 + 8) return false;
    for (let reach = 4; reach < Math.abs(distance); reach += 4) {
      if (blocksRoot(world, x, y + Math.sign(distance) * reach)) return false;
    }
    return true;
  });
}

export function stepRootWave(game, dt) {
  const wave = game.rootWave;
  if (!wave) return;
  if (wave.finished) {
    wave.fade = Math.max(0, wave.fade - dt / HOLD);
    if (wave.fade === 0) game.rootWave = null;
    return;
  }
  wave.age += dt;
  if (wave.age < WINDUP) return;
  const end = Math.min(RANGE, (wave.age - WINDUP) * SPEED);
  while (wave.length < end && !wave.finished) {
    const distance = Math.min(end, wave.length + 3);
    const x = wave.x + wave.facing * distance;
    if (blocksRoot(game.world, x, wave.y)) break;
    wave.length = distance;
    const mob = reachedEnemy(game.world, wave, x, wave.y);
    if (!mob) continue;
    const hitY = mob.y + mobSpec(mob).centerY;
    damageMob(game.world, mob, 3, wave.facing > 0 ? 0 : Math.PI, 0, game.effects);
    if (mob.health > 0 && mob.kind !== 'kraken') {
      mob.rooted = 2.8;
      mob.rootLift = 10;
      mob.grounded = false;
    }
    game.effects.push({ x, y: hitY, color: '#93c879', count: 13, spread: 45 });
    wave.finished = true;
  }
  if (wave.finished || wave.length < end || end === RANGE) {
    wave.finished = true;
    wave.fade = 1;
  }
}
