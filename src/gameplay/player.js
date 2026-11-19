import { ARMOR, FEET_GEAR, normalizeAppearance, WALK_CYCLE_DISTANCE } from '../content.js';
import { inWater, solidAt } from '../world.js';
import { COLS, ROWS, SPAWN, TILE, clamp } from '../world/generation.js';
import { KRAKEN_BARRIER_EAST_OFFSET, KRAKEN_BARRIER_OFFSET } from './enemies/kraken.js';

const jumpSpeed = 217;
const shortHopSpeed = 115;
const swimSpeed = 94;
const flightSpeed = 240;

export const PLAYER_SIZE = { width: 12, height: 23 };
export const CRAWL_HEIGHT = TILE;
export const MAX_HEALTH = 100;

export function spawn(world, oxygen, appearance, armor = null, feet = null) {
  let y = SPAWN.y;
  while (y > 0 && collides(world, SPAWN.x, y)) y = Math.max(0, y - TILE);
  return { x: SPAWN.x, y, ...PLAYER_SIZE, dx: 0, dy: 0, grounded: false, canShortenJump: false, facing: 1, walkPhase: 0, health: MAX_HEALTH, oxygen, armor, feet, hurt: 0, stun: 0, appearance: normalizeAppearance(appearance) };
}

export function takeDamage(player, damage) {
  const protection = ARMOR[player.armor]?.protection ?? 0;
  const loss = Math.max(1, Math.round(damage * (1 - protection)));
  player.health = Math.max(0, player.health - loss);
  return loss;
}

export function collides(world, x, y, height = PLAYER_SIZE.height) {
  const kraken = world.mobs?.find((mob) => mob.kind === 'kraken' && mob.health > 0 && mob.respawn <= 0);
  if (kraken && x + PLAYER_SIZE.width / 2 > kraken.x - KRAKEN_BARRIER_OFFSET && x - PLAYER_SIZE.width / 2 < kraken.x + KRAKEN_BARRIER_EAST_OFFSET) return true;
  const left = Math.floor((x - PLAYER_SIZE.width / 2) / TILE);
  const right = Math.floor((x + PLAYER_SIZE.width / 2 - 0.01) / TILE);
  const top = Math.floor(y / TILE);
  const bottom = Math.floor((y + height - 0.01) / TILE);
  const viewer = { x, y, height };
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(world, tx, ty, viewer)) return true;
    }
  }
  return false;
}

function moveAxis(world, player, axis, amount) {
  let remaining = amount;
  while (Math.abs(remaining) > 0.001) {
    const delta = clamp(remaining, -3, 3);
    const x = player.x + (axis === 'x' ? delta : 0);
    const y = player.y + (axis === 'y' ? delta : 0);
    if (!collides(world, x, y, player.height)) {
      player[axis] += delta;
      remaining -= delta;
      continue;
    }
    let allowed = 0;
    let blocked = 1;
    for (let iteration = 0; iteration < 8; iteration++) {
      const fraction = (allowed + blocked) / 2;
      const x = player.x + (axis === 'x' ? delta * fraction : 0);
      const y = player.y + (axis === 'y' ? delta * fraction : 0);
      if (collides(world, x, y, player.height)) blocked = fraction;
      else allowed = fraction;
    }
    player[axis] += delta * allowed;
    return true;
  }
  return false;
}

function canJumpAshore(world, player, direction, maxSwimSpeed = swimSpeed) {
  if (!direction || player.height === CRAWL_HEIGHT || player.dy < -maxSwimSpeed || inWater(world, player.x, player.y + 5)
    || !inWater(world, player.x, player.y + player.height - 0.01)) return false;
  const shoreX = player.x + direction * player.width;
  const clearanceY = player.y - 2 * TILE;
  return collides(world, shoreX, player.y) && !collides(world, player.x, clearanceY) && !collides(world, shoreX, clearanceY);
}

export function playerInWater(world, player) {
  return inWater(world, player.x, player.y + player.height - PLAYER_SIZE.height * 0.35);
}

export function playerHeadInWater(world, player) {
  return inWater(world, player.x, player.y + 5);
}

export function toggleGodMode(world, player) {
  const { flightOrigin, x, y, height } = player;
  player.dx = 0;
  player.dy = 0;
  player.grounded = false;
  player.canShortenJump = false;
  if (!flightOrigin) {
    player.flightOrigin = { x, y, height };
    player.y = Math.max(0, y + height - PLAYER_SIZE.height);
    player.height = PLAYER_SIZE.height;
    player.hurt = 0;
    player.stun = 0;
    player.inkCooldown = 0;
    player.inkSplats = [];
    return true;
  }
  if (collides(world, x, y, height)) {
    const safe = collides(world, flightOrigin.x, flightOrigin.y, flightOrigin.height)
      ? spawn(world, player.oxygen)
      : flightOrigin;
    Object.assign(player, { x: safe.x, y: safe.y, height: safe.height });
  }
  player.flightOrigin = null;
  return false;
}

function fly(player, { left, right, up, down, flightSpeedMultiplier = 1 }, dt) {
  const horizontal = Number(Boolean(right)) - Number(Boolean(left));
  const vertical = Number(Boolean(down)) - Number(Boolean(up));
  const speed = flightSpeed * flightSpeedMultiplier * (horizontal && vertical ? Math.SQRT1_2 : 1);
  player.dx = horizontal * speed;
  player.dy = vertical * speed;
  if (horizontal) player.facing = horizontal;
  player.x = clamp(player.x + player.dx * dt, player.width, COLS * TILE - player.width);
  player.y = clamp(player.y + player.dy * dt, 0, ROWS * TILE - player.height);
}

export function movePlayer(world, player, input, dt) {
  if (player.flightOrigin) {
    fly(player, input, dt);
    return;
  }
  let { left, right, up, down, jump } = input;
  player.hurt = Math.max(0, (player.hurt ?? 0) - dt);
  player.stun = Math.max(0, (player.stun ?? 0) - dt);
  player.inkCooldown = Math.max(0, (player.inkCooldown ?? 0) - dt);
  if (player.inkSplats?.length) {
    for (let i = player.inkSplats.length - 1; i >= 0; i--) {
      player.inkSplats[i].time -= dt;
      if (player.inkSplats[i].time <= 0) player.inkSplats.splice(i, 1);
    }
  }
  if (player.stun > 0) {
    left = false;
    right = false;
    up = false;
    down = false;
    jump = false;
  }
  const bodyInWater = playerInWater(world, player);
  const wantsCrawl = down && !bodyInWater && (player.grounded || player.height === CRAWL_HEIGHT);
  const height = wantsCrawl ? CRAWL_HEIGHT : PLAYER_SIZE.height;
  if (height !== player.height) {
    const y = player.y + player.height - height;
    if (height < player.height || (y >= 0 && !collides(world, player.x, y, height))) {
      player.y = y;
      player.height = height;
    }
  }
  const crawling = player.height === CRAWL_HEIGHT;
  const horizontal = Number(Boolean(right)) - Number(Boolean(left));

  if (horizontal) player.facing = horizontal;
  const swimMultiplier = FEET_GEAR[player.feet]?.swimMultiplier ?? 1;
  const verticalSwimSpeed = swimSpeed * swimMultiplier;
  const speed = bodyInWater ? 102 * swimMultiplier : crawling ? 56 : 112;
  player.dx += (horizontal * speed - player.dx) * Math.min(1, dt * (bodyInWater ? 5 : 13));
  const shoreJump = (up || jump) && !down && canJumpAshore(world, player, horizontal, verticalSwimSpeed);
  if (bodyInWater && !shoreJump) {
    player.canShortenJump = false;
    const vertical = Number(Boolean(down)) - Number(Boolean(up));
    player.dy += ((vertical ? vertical * verticalSwimSpeed : 10) - player.dy) * Math.min(1, 7 * dt);
  } else {
    if (shoreJump || (jump && player.grounded && !crawling)) {
      player.dy = -jumpSpeed;
      player.canShortenJump = !shoreJump;
    }
    if (player.canShortenJump && !up) {
      player.dy = Math.max(player.dy, -shortHopSpeed);
      player.canShortenJump = false;
    }
    player.dy = Math.min(player.dy + 510 * dt, 245);
  }

  const previousX = player.x;
  if (moveAxis(world, player, 'x', player.dx * dt)) player.dx = 0;
  const falling = player.dy >= 0;
  const yCollision = moveAxis(world, player, 'y', player.dy * dt);
  player.grounded = yCollision && falling;
  if (yCollision) player.dy = 0;
  if (player.dy >= 0) player.canShortenJump = false;
  if (player.y < 0) player.y = 0;
  if (player.grounded && !bodyInWater) {
    player.walkPhase = (player.walkPhase + Math.abs(player.x - previousX) / WALK_CYCLE_DISTANCE) % 1;
  }
}

export function updateOxygen(world, player, dt, maxOxygen, outOfCombat = true) {
  if (player.flightOrigin) return false;
  const headInWater = playerHeadInWater(world, player);
  const atVent = headInWater && world.vents.some(({ x, y }) => Math.hypot(player.x - x, player.y + 5 - (y - TILE)) < 30);
  if (atVent) {
    player.oxygen = Math.min(maxOxygen, player.oxygen + 18 * dt);
    if (player.hurt <= 0) player.health = Math.min(MAX_HEALTH, player.health + 6 * dt);
  } else if (headInWater) {
    player.oxygen = Math.max(0, player.oxygen - dt);
    if (player.hurt <= 0 && outOfCombat && player.oxygen > 0) {
      player.health = Math.min(MAX_HEALTH, player.health + 1.5 * dt);
    }
  } else {
    player.oxygen = Math.min(maxOxygen, player.oxygen + 14 * dt);
    if (player.hurt <= 0) player.health = Math.min(MAX_HEALTH, player.health + 8 * dt);
  }
  return player.oxygen === 0 || player.health === 0;
}
