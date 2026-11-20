import { MATERIAL } from '../content.js';
import { GRAPPLING_HOOK } from '../inventory.js';
import { tileAt } from '../world.js';
import { COLS, ROWS, TILE } from '../world/generation.js';
import { playerImmobilized } from './player.js';

const RETRACT_SPEED_MULTIPLIER = 1.45;
const HOOK_STEP_SIZE = 4;
const HOOK_ARRIVAL_DISTANCE = 2;

/**
 * Returns the equipped Hands grappling hook item if present.
 * @param {object} game
 */
export function equippedHook(game) {
  return game.progress?.hands === GRAPPLING_HOOK.id ? GRAPPLING_HOOK : null;
}

/**
 * Returns the active grappling hook item from Hands slot or inventory.
 * @param {object} game
 */
export function hasHook(game) {
  return equippedHook(game) ?? (game.inventory?.count(GRAPPLING_HOOK.id) > 0 ? GRAPPLING_HOOK : null);
}

/**
 * Launches the grappling hook toward target world coordinates (or player facing).
 * Replaces any currently extending, retracting, or latched hook.
 * @param {object} game
 * @param {number} [targetX]
 * @param {number} [targetY]
 */
export function useGrapplingHook(game, targetX, targetY) {
  const { player } = game;
  const hookItem = hasHook(game);
  if (!hookItem || playerImmobilized(player) || player.flightOrigin) return false;
  const originX = player.x;
  const originY = player.y + player.height * 0.5;
  const hasTarget = Number.isFinite(targetX) && Number.isFinite(targetY) &&
    Math.hypot(targetX - originX, targetY - originY) > 1;
  const angle = hasTarget ? Math.atan2(targetY - originY, targetX - originX) : (player.facing < 0 ? Math.PI : 0);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  player.facing = dirX < -0.001 ? -1 : dirX > 0.001 ? 1 : player.facing;
  player.hook = {
    state: 'extending',
    x: originX,
    y: originY,
    dirX,
    dirY,
    angle,
    range: hookItem.range,
    speed: hookItem.speed,
    pullSpeed: hookItem.pullSpeed,
    tx: null,
    ty: null,
  };
  return true;
}

function isHookSolidTile(world, tx, ty) {
  return ty >= 0 && tx >= 0 && tx < COLS && ty < ROWS && tileAt(world, tx, ty) !== MATERIAL.air;
}

/**
 * Steps active grappling hook flight, latching, pulling, and jump-release physics.
 * Returns `'latched'` while the hook controls player movement, `'jumped'` on jump release,
 * or `false` when normal player physics should continue.
 */
export function stepGrapplingHook(world, player, input, dt, { moveAxis, jumpSpeed }) {
  const hook = player.hook;
  if (!hook) return false;

  const centerX = player.x;
  const centerY = player.y + player.height * 0.5;

  if (hook.state === 'extending') {
    let remaining = hook.speed * dt;
    while (remaining > 0) {
      const step = Math.min(HOOK_STEP_SIZE, remaining);
      hook.x += hook.dirX * step;
      hook.y += hook.dirY * step;
      remaining -= step;
      const tx = Math.floor(hook.x / TILE);
      const ty = Math.floor(hook.y / TILE);
      if (isHookSolidTile(world, tx, ty)) {
        hook.state = 'latched';
        hook.tx = tx;
        hook.ty = ty;
        player.climb = null;
        player.fallDistance = 0;
        player.grounded = false;
        break;
      }
      if (hook.y < 0 || Math.hypot(hook.x - centerX, hook.y - centerY) >= hook.range) {
        hook.state = 'retracting';
        break;
      }
    }
    if (hook.state !== 'latched') return false;
  }

  if (hook.state === 'retracting') {
    const dx = centerX - hook.x;
    const dy = centerY - hook.y;
    const dist = Math.hypot(dx, dy);
    const step = hook.speed * RETRACT_SPEED_MULTIPLIER * dt;
    if (dist <= Math.max(10, step)) {
      player.hook = null;
      return false;
    }
    hook.x += (dx / dist) * step;
    hook.y += (dy / dist) * step;
    return false;
  }

  if (!isHookSolidTile(world, hook.tx, hook.ty)) {
    player.hook = null;
    return false;
  }

  if (input.jump) {
    player.hook = null;
    player.dy = -jumpSpeed;
    player.grounded = false;
    player.jumpGrace = 0;
    player.canShortenJump = true;
    player.fallDistance = 0;
    return 'jumped';
  }

  const dx = hook.x - centerX;
  const dy = hook.y - centerY;
  const dist = Math.hypot(dx, dy);
  player.fallDistance = 0;
  player.grounded = false;
  player.jumpGrace = 0;
  player.waterJump = false;
  player.climb = null;
  if (Math.abs(dx) > 1) player.facing = dx < 0 ? -1 : 1;

  if (dist > HOOK_ARRIVAL_DISTANCE) {
    const maxPull = hook.pullSpeed * dt;
    const stepX = dist <= maxPull ? dx : (dx / dist) * maxPull;
    const stepY = dist <= maxPull ? dy : (dy / dist) * maxPull;
    const previousX = player.x;
    const previousY = player.y;
    moveAxis(world, player, 'x', stepX);
    moveAxis(world, player, 'y', stepY);
    player.dx = dt > 0 ? (player.x - previousX) / dt : 0;
    player.dy = dt > 0 ? (player.y - previousY) / dt : 0;
  } else {
    player.dx = 0;
    player.dy = 0;
  }

  return 'latched';
}
