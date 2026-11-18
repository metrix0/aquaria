import { normalizeAppearance, WALK_CYCLE_DISTANCE } from '../content.js';
import { inWater, solidAt } from '../world.js';
import { SPAWN, TILE, clamp } from '../world/generation.js';

const jumpSpeed = 217;
const shortHopSpeed = 115;
const swimSpeed = 94;

export const PLAYER_SIZE = { width: 12, height: 23 };
export const CRAWL_HEIGHT = TILE;
export const MAX_HEALTH = 100;

export function spawn(world, oxygen, appearance) {
  let y = SPAWN.y;
  while (y > 0 && collides(world, SPAWN.x, y)) y = Math.max(0, y - TILE);
  return { x: SPAWN.x, y, ...PLAYER_SIZE, dx: 0, dy: 0, grounded: false, canShortenJump: false, facing: 1, walkPhase: 0, health: MAX_HEALTH, oxygen, hurt: 0, appearance: normalizeAppearance(appearance) };
}

export function collides(world, x, y, height = PLAYER_SIZE.height) {
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

function canJumpAshore(world, player, direction) {
  if (!direction || player.height === CRAWL_HEIGHT || player.dy < -swimSpeed || inWater(world, player.x, player.y + 5)
    || !inWater(world, player.x, player.y + player.height - 0.01)) return false;
  const shoreX = player.x + direction * player.width;
  const clearanceY = player.y - 2 * TILE;
  return collides(world, shoreX, player.y) && !collides(world, player.x, clearanceY) && !collides(world, shoreX, clearanceY);
}

export function playerInWater(world, player) {
  return inWater(world, player.x, player.y + player.height - PLAYER_SIZE.height * 0.35);
}

export function movePlayer(world, player, { left, right, up, down, jump }, dt) {
  player.hurt = Math.max(0, (player.hurt ?? 0) - dt);
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
  const horizontal = Number(right) - Number(left);

  if (horizontal) player.facing = horizontal;
  const speed = bodyInWater ? 102 : crawling ? 56 : 112;
  player.dx += (horizontal * speed - player.dx) * Math.min(1, dt * (bodyInWater ? 5 : 13));
  const shoreJump = (up || jump) && !down && canJumpAshore(world, player, horizontal);
  if (bodyInWater && !shoreJump) {
    player.canShortenJump = false;
    const vertical = Number(down) - Number(up);
    player.dy += ((vertical ? vertical * swimSpeed : 10) - player.dy) * Math.min(1, 7 * dt);
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
  const headInWater = inWater(world, player.x, player.y + 5);
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
