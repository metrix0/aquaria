import { ARMOR, FEET_GEAR, normalizeAppearance, WALK_CYCLE_DISTANCE } from '../content.js';
import { stepGrapplingHook } from './hook.js';
import { mineDecks } from '../world/island-cave.js';
import { hasExposedCaveFloor, inWater, solidAt } from '../world.js';
import { COLS, ROWS, SPAWN, TILE, clamp } from '../world/generation.js';
import { KRAKEN_BARRIER_EAST_OFFSET, KRAKEN_BARRIER_OFFSET } from './enemies/kraken.js';

const jumpSpeed = 217;
const shortHopSpeed = 115;
const ledgeJumpGrace = 0.1;
const maxFallSpeed = 480;
const maxWaterEntrySpeed = 245;
const safeFallTiles = 8;
const fallDamagePerTile = 4;
const swimSpeed = 94;
const flightSpeed = 240;

export const PLAYER_SIZE = { width: 12, height: 23 };
export const CRAWL_HEIGHT = TILE;
export const MAX_HEALTH = 100;
export const CONFUSED_GRACE_DURATION = 1;

export function playerImmobilized(player) {
  return (player.stun ?? 0) > 0 || ((player.confused ?? 0) > 0 && player.confusedStyle === 'stars');
}

/**
 * Applies confusion unless the player is within post-confusion invincibility frames.
 */
export function applyConfusion(player, duration, style = null) {
  if ((player.confusedGrace ?? 0) > 0) return false;
  player.confused = Math.max(player.confused ?? 0, duration);
  if (style) player.confusedStyle = style;
  return true;
}

/**
 * Returns active timed status effects on the player for HUD display.
 */
export function playerStatusEffects(player) {
  if (!player || player.flightOrigin) return [];
  const effects = [];
  if ((player.bleed ?? 0) > 0) {
    effects.push({
      id: 'bleeding',
      title: 'Bleeding',
      seconds: Math.ceil(player.bleed),
      detail: 'Losing health over time.',
    });
  }
  if ((player.stun ?? 0) > 0) {
    effects.push({
      id: 'shock',
      title: 'Shocked',
      seconds: Math.ceil(player.stun),
      detail: 'Paralyzed by electric lightning and unable to move.',
    });
  }
  if ((player.confused ?? 0) > 0) {
    if (player.confusedStyle === 'stars') {
      effects.push({
        id: 'confusion',
        title: 'Confusion',
        seconds: Math.ceil(player.confused),
        detail: 'Dazed by spinning stars and unable to move.',
      });
    } else {
      effects.push({
        id: 'cursed',
        title: 'Cursed',
        seconds: Math.ceil(player.confused),
        detail: 'Controls are inverted by the shaman’s curse.',
      });
    }
  }
  if ((player.confusedGrace ?? 0) > 0) {
    effects.push({
      id: 'confused-grace',
      title: 'Steadied',
      seconds: Math.ceil(player.confusedGrace),
      detail: 'Immune to being confused again.',
    });
  }
  if (player.inkSplats?.length) {
    const remaining = Math.max(0, ...player.inkSplats.map((splat) => splat.time ?? 0));
    if (remaining > 0) {
      effects.push({
        id: 'inked',
        title: 'Inked',
        seconds: Math.ceil(remaining),
        detail: 'Squid ink clouds your vision.',
      });
    }
  }
  if ((player.neurotoxin ?? 0) > 0) {
    effects.push({
      id: 'neurotoxin',
      title: 'Neurotoxin',
      seconds: Math.ceil(player.neurotoxin),
      detail: 'Thick venom drastically slows swimming speed.',
    });
  }
  return effects;
}

export function spawn(world, oxygen, appearance, armor = null, feet = null) {
  let y = SPAWN.y;
  while (y > 0 && collides(world, SPAWN.x, y)) y = Math.max(0, y - TILE);
  return { x: SPAWN.x, y, ...PLAYER_SIZE, dx: 0, dy: 0, fallDistance: 0, grounded: false, jumpGrace: 0, canShortenJump: false, facing: 1, walkPhase: 0, health: MAX_HEALTH, oxygen, armor, feet, hurt: 0, stun: 0, confused: 0, confusedStyle: null, confusedGrace: 0, bleed: 0, bleedTick: 0, neurotoxin: 0, hook: null, appearance: normalizeAppearance(appearance) };
}

function tryStepUp(world, player, targetDx, remainingX) {
  const feet = player.y + player.height;
  const stepFeet = Math.floor((feet - 0.01) / TILE) * TILE;
  const rise = feet - stepFeet;
  const stepY = stepFeet - player.height;
  if (rise <= 0 || rise > TILE + 0.01 || stepY < 0) return false;
  const stepProbe = Math.sign(targetDx) * Math.max(0.5, Math.abs(remainingX));
  if (collides(world, player.x, stepY, player.height) ||
      collides(world, player.x + stepProbe, stepY, player.height)) {
    return false;
  }
  player.y = stepY;
  moveAxis(world, player, 'x', remainingX);
  return true;
}

export function takeDamage(player, damage) {
  const protection = ARMOR[player.armor]?.protection ?? 0;
  const loss = Math.max(0, Math.round(damage * (1 - protection) * (1 - (player.skillBonuses?.resist ?? 0))));
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
  if (!direction || player.height === CRAWL_HEIGHT || player.dy < -maxSwimSpeed || playerHeadInWater(world, player)
    || !inWater(world, player.x, player.y + player.height - 0.01)) return false;
  const shoreX = player.x + direction * player.width;
  const clearanceY = player.y - 2 * TILE;
  if (collides(world, shoreX, player.y) && !collides(world, player.x, clearanceY) && !collides(world, shoreX, clearanceY)) {
    return true;
  }
  const stepY = Math.floor((player.y - TILE) / TILE) * TILE - player.height;
  return collides(world, shoreX, player.y - TILE)
    && !collides(world, player.x, player.y - TILE)
    && !collides(world, player.x, stepY)
    && !collides(world, shoreX, stepY);
}

function waterSensorOffset(player) {
  return player.height - PLAYER_SIZE.height * 0.35;
}

export function playerInWater(world, player) {
  return inWater(world, player.x, player.y + waterSensorOffset(player));
}

export function playerWaterborne(world, player) {
  return playerInWater(world, player) || Boolean(player.waterJump);
}

export function playerHeadInWater(world, player) {
  return inWater(world, player.x, player.y + 5);
}

export function toggleGodMode(world, player) {
  const { flightOrigin, x, y, height } = player;
  player.dx = 0;
  player.dy = 0;
  player.fallDistance = 0;
  player.grounded = false;
  player.jumpGrace = 0;
  player.canShortenJump = false;
  player.waterJump = false;
  player.climb = null;
  player.hook = null;
  if (!flightOrigin) {
    player.flightOrigin = { x, y, height };
    player.y = Math.max(0, y + height - PLAYER_SIZE.height);
    player.height = PLAYER_SIZE.height;
    player.hurt = 0;
    player.stun = 0;
    player.confused = 0;
    player.confusedStyle = null;
    player.confusedGrace = 0;
    player.bleed = 0;
    player.bleedTick = 0;
    player.neurotoxin = 0;
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

function landingDeck(world, player, nextFeet) {
  const feet = player.y + player.height;
  let landing = Infinity;
  for (const structure of world.mineDecks ?? []) {
    const { tx, floor, kind } = structure;
    const distance = Math.abs(player.x - (tx + .5) * TILE);
    if (distance >= mineDecks[kind].at(-1).halfWidth + player.width / 2 || !hasExposedCaveFloor(world, structure)) continue;
    for (const { rise, halfWidth } of mineDecks[kind]) {
      const deck = floor * TILE - rise;
      if (feet <= deck && nextFeet >= deck && distance < halfWidth + player.width / 2) {
        landing = Math.min(landing, deck);
      }
    }
  }
  return landing;
}

export function movePlayer(world, player, input, dt) {
  if (player.flightOrigin) {
    fly(player, input, dt);
    return;
  }
  let { left, right, up, down, jump } = input;
  player.hurt = Math.max(0, (player.hurt ?? 0) - dt);
  player.stun = Math.max(0, (player.stun ?? 0) - dt);
  const wasConfused = (player.confused ?? 0) > 0;
  player.confused = Math.max(0, (player.confused ?? 0) - dt);
  player.confusedGrace = Math.max(0, (player.confusedGrace ?? 0) - dt);
  if (wasConfused && player.confused === 0) {
    player.confusedStyle = null;
    player.confusedGrace = CONFUSED_GRACE_DURATION;
  }
  player.bleed = player.bleed ?? 0;
  player.neurotoxin = Math.max(0, (player.neurotoxin ?? 0) - dt);
  player.inkCooldown = Math.max(0, (player.inkCooldown ?? 0) - dt);
  if (player.inkSplats?.length) {
    for (let i = player.inkSplats.length - 1; i >= 0; i--) {
      player.inkSplats[i].time -= dt;
      if (player.inkSplats[i].time <= 0) player.inkSplats.splice(i, 1);
    }
  }
  if (playerImmobilized(player)) {
    left = false;
    right = false;
    up = false;
    down = false;
    jump = false;
  } else if (player.confused > 0) {
    [left, right] = [right, left];
    const nextDown = Boolean(jump || up);
    const nextJump = Boolean(down);
    down = nextDown;
    jump = nextJump;
    up = nextJump;
  }
  const hookState = stepGrapplingHook(world, player, { left, right, up, down, jump }, dt, { moveAxis, jumpSpeed });
  if (hookState === 'latched') return;
  if (hookState === 'jumped') player.waterJump = playerInWater(world, player);
  const canClimb = hookState !== 'jumped' && !left && !right && !playerImmobilized(player) && (up || down || player.climb);
  const caveRoute = canClimb && world.caveClimbs?.find(({ tx, top, bottom }) => {
    const hand = player.y + 8;
    // Never grab a climb after passing its end.
    if (down && hand > (bottom - .5) * TILE) return false;
    return Math.abs(player.x - (tx + .5) * TILE) < 12 &&
      hand >= top * TILE - 12 && hand <= (bottom + 1) * TILE + 4 &&
      !solidAt(world, tx, Math.floor(hand / TILE));
  });
  const shaft = canClimb && !caveRoute && world.mineDecks?.find((structure) => {
    const { tx, floor, kind } = structure;
    if (kind === 'trestle' || Math.abs(player.x - (tx + .5) * TILE) >= 9) return false;
    const feet = player.y + player.height;
    return feet >= floor * TILE - mineDecks[kind].at(-1).rise - 1 &&
      feet <= floor * TILE + 1 && hasExposedCaveFloor(world, structure);
  });
  player.climb = caveRoute || shaft || null;
  if (player.climb) {
    player.fallDistance = 0;
    player.jumpGrace = 0;
    const standingY = player.y + player.height - PLAYER_SIZE.height;
    if (player.height === CRAWL_HEIGHT && standingY >= 0 && !collides(world, player.x, standingY)) {
      player.y = standingY;
      player.height = PLAYER_SIZE.height;
    }
    player.dx = 0;
    player.dy = (Number(Boolean(down)) - Number(Boolean(up))) * 81;
    player.canShortenJump = false;
    player.waterJump = false;
    const climbDistance = player.dy * dt;
    if (shaft && climbDistance < 0) {
      const deck = shaft.floor * TILE - mineDecks[shaft.kind].at(-1).rise;
      const toDeck = deck - player.height - player.y;
      if (climbDistance <= toDeck) {
        player.grounded = !moveAxis(world, player, 'y', toDeck);
        player.dy = 0;
        if (player.grounded) player.climb = null;
        return;
      }
    }
    player.grounded = moveAxis(world, player, 'y', climbDistance) && player.dy > 0;
    return;
  }
  const bodyInWater = playerInWater(world, player);
  if (bodyInWater) player.jumpGrace = 0;
  else if (player.grounded) player.jumpGrace = ledgeJumpGrace;
  else player.jumpGrace = Math.max(0, player.jumpGrace - dt);
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
  const swimMultiplier = (FEET_GEAR[player.feet]?.swimMultiplier ?? 1) * ((player.neurotoxin ?? 0) > 0 ? 0.38 : 1) * (1 + (player.skillBonuses?.swim ?? 0));
  const verticalSwimSpeed = swimSpeed * swimMultiplier;
  const speed = (bodyInWater ? 102 * swimMultiplier : crawling ? 56 : 112) * (!bodyInWater ? 1 + (player.addons?.feet === 'explorers-anklet' ? 0.05 : 0) + (player.skillBonuses?.move ?? 0) : 1);
  player.dx += (horizontal * speed - player.dx) * Math.min(1, dt * (bodyInWater ? 5 : 13));
  const headInWater = playerHeadInWater(world, player);
  const shoreJump = (up || jump) && !down && canJumpAshore(world, player, horizontal, verticalSwimSpeed);
  const surfaceJump = jump && !down && !crawling && bodyInWater && !headInWater;
  const risingFromWaterJump = Boolean(player.waterJump) && player.dy < 0 && !down;
  if (bodyInWater && !shoreJump && !surfaceJump && !risingFromWaterJump) {
    player.canShortenJump = false;
    player.waterJump = false;
    const vertical = Number(Boolean(down)) - Number(Boolean(up));
    let targetDy = vertical ? vertical * verticalSwimSpeed : 10;
    let surfaceRestY = null;
    if (up && !down && !headInWater) {
      const waterOffset = waterSensorOffset(player);
      const surfaceTileY = Math.floor((player.y + waterOffset) / TILE) * TILE;
      if (!inWater(world, player.x, surfaceTileY - 1)) {
        surfaceRestY = surfaceTileY - waterOffset + 1.5;
        targetDy = clamp((surfaceRestY - player.y) * 8, -verticalSwimSpeed, verticalSwimSpeed);
      }
    }
    player.dy = Math.min(player.dy, maxWaterEntrySpeed);
    player.dy += (targetDy - player.dy) * Math.min(1, 7 * dt);
    if (surfaceRestY !== null && player.dy < 0 && player.y + player.dy * dt < surfaceRestY) {
      player.dy = Math.min(0, (surfaceRestY - player.y) / dt);
    }
  } else {
    if (shoreJump || surfaceJump || (jump && !crawling && (player.grounded || player.jumpGrace > 0))) {
      player.jumpGrace = 0;
      player.dy = -jumpSpeed;
      player.canShortenJump = !shoreJump;
      player.waterJump = bodyInWater;
    }
    if (player.canShortenJump && !up) {
      player.dy = Math.max(player.dy, -shortHopSpeed);
      player.canShortenJump = false;
    }
    player.dy = Math.min(player.dy + 510 * dt, maxFallSpeed);
  }

  const previousX = player.x;
  const targetDx = player.dx * dt;
  if (moveAxis(world, player, 'x', targetDx)) {
    const remainingX = previousX + targetDx - player.x;
    const canAutoStep = (player.grounded || bodyInWater) && horizontal !== 0 && Math.abs(targetDx) > 0.001;
    if (!canAutoStep || !tryStepUp(world, player, targetDx, remainingX)) {
      player.dx = 0;
    }
  }
  const previousY = player.y;
  const falling = player.dy >= 0;
  const dy = player.dy * dt;
  const deck = falling && !down && !bodyInWater ? landingDeck(world, player, player.y + player.height + dy) : Infinity;
  const yCollision = moveAxis(world, player, 'y', Math.min(dy, deck - player.y - player.height)) || Number.isFinite(deck);
  player.grounded = yCollision && falling;
  if (player.grounded) player.waterJump = false;
  if (yCollision) player.dy = 0;
  if (player.dy >= 0) player.canShortenJump = false;
  if (player.y < 0) player.y = 0;
  if (player.grounded && !bodyInWater) {
    player.walkPhase = (player.walkPhase + Math.abs(player.x - previousX) / WALK_CYCLE_DISTANCE) % 1;
  }

  player.fallDistance = falling && !bodyInWater ? player.fallDistance + (player.y - previousY) : 0;
  if (player.grounded) {
    const damage = Math.round((player.fallDistance / TILE - safeFallTiles) * fallDamagePerTile);
    player.fallDistance = 0;
    if (damage > 0 && !playerInWater(world, player)) return damage;
  }
}

export function stepBleed(player, dt, effects) {
  if (player.flightOrigin || !(player.bleed > 0)) {
    if (player.bleed) player.bleed = 0;
    player.bleedTick = 0;
    return 0;
  }
  player.bleed = Math.max(0, player.bleed - dt);
  player.bleedTick = (player.bleedTick ?? 1) - dt;
  let lost = 0;
  while (player.bleedTick <= 0 && player.bleed > 0 && player.health > 0) {
    player.bleedTick += 1;
    player.health = Math.max(0, player.health - 1);
    lost += 1;
    effects?.push({
      x: player.x + (Math.random() - 0.5) * 8,
      y: player.y + 8 + Math.random() * 10,
      color: '#c4313d',
      count: 4,
      spread: 36,
    });
  }
  if (player.bleed === 0) player.bleedTick = 0;
  return lost;
}

export function updateOxygen(world, player, dt, maxOxygen, outOfCombat = true) {
  if (player.flightOrigin) return false;
  const headInWater = playerHeadInWater(world, player);
  const atVent = headInWater && world.vents.some(({ x, y }) => Math.hypot(player.x - x, player.y + 5 - (y - TILE)) < 30);
  const canRegen = player.hurt <= 0 && !(player.bleed > 0);
  if (atVent) {
    player.oxygen = Math.min(maxOxygen, player.oxygen + 18 * dt);
    if (canRegen) player.health = Math.min(MAX_HEALTH, player.health + 6 * dt);
  } else if (headInWater) {
    player.oxygen = Math.max(0, player.oxygen - dt);
    if (canRegen && outOfCombat && player.oxygen > 0) {
      player.health = Math.min(MAX_HEALTH, player.health + 1.5 * dt);
    }
  } else {
    player.oxygen = Math.min(maxOxygen, player.oxygen + 14 * dt);
    if (canRegen) player.health = Math.min(MAX_HEALTH, player.health + 8 * dt);
  }
  return player.oxygen === 0 || player.health === 0;
}
