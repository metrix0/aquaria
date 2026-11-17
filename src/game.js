import { COLS, ROWS, TILE, WATER, WEST_EXTENSION, MATERIAL, SPAWN, clamp, createWorld, editTile, tileAt, treeAt } from './world.js';
import { normalizeAppearance, WALK_CYCLE_DISTANCE } from './character.js';
import { createCharacterEditor } from './character-editor.js';
import { createRenderer } from './render.js';
import { worldConditions } from './environment.js';
import { updateEnemySpawns } from './enemies.js';
import { Inventory, ITEMS } from './inventory.js';
import { createInventoryUi } from './inventory-ui.js';
import { devTools, version } from './build-info.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('scene');
const renderer = createRenderer(canvas);
const backpackPanel = byId('backpack-panel');
const craftPanel = byId('craft-panel');
const pausePanel = byId('pause-panel');
const characterPanel = byId('character-panel');
const panels = [backpackPanel, craftPanel, characterPanel, pausePanel];
const characterEditor = createCharacterEditor(characterPanel, (draft) => {
  appearance = draft;
  dirty = true;
  save();
  if (dirty) notify('Appearance updated for this session. The browser could not save it.');
});
const saveKey = 'aquaria.save';
const saveFormat = 2;
const legacyCols = 224;
const legacyEditableRows = 98;
const playerSize = { width: 12, height: 23 };
const jumpSpeed = 217;
const shortHopSpeed = 115;
const swimSpeed = 94;
const keys = new Set();
const pointer = { x: 0, y: 0, active: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const jumpKeys = ['Space', 'KeyW', 'ArrowUp'];
const moveKeys = new Set(['KeyA', 'KeyD', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowDown', ...jumpKeys]);
const drops = {
  [MATERIAL.sand]: 'sand', [MATERIAL.stone]: 'stone', [MATERIAL.soil]: 'sand',
  [MATERIAL.reef]: 'stone', [MATERIAL.wood]: 'wood',
  [MATERIAL.copper]: 'copper', [MATERIAL.iron]: 'iron', [MATERIAL.cobalt]: 'cobalt',
};
const editableMaterials = new Set(Object.values(MATERIAL).filter((material) => material !== MATERIAL.bedrock));
const breakSeconds = {
  [MATERIAL.sand]: 0.35,
  [MATERIAL.soil]: 0.4,
  [MATERIAL.wood]: 0.5,
  [MATERIAL.reef]: 0.6,
  [MATERIAL.stone]: 0.7,
  [MATERIAL.copper]: 0.85,
  [MATERIAL.iron]: 1.05,
  [MATERIAL.cobalt]: 1.3,
};
const prompts = { kelp: 'Harvest kelp', cache: 'Open wreck cache' };
const tankCost = { stone: 3, kelp: 2 };
const enemySpecs = {
  jellyfish: { width: 12, height: 18, radius: 11, damage: 4, message: 'Stung by a jellyfish. -4s oxygen', material: MATERIAL.reef },
  squid: { width: 16, height: 14, radius: 12, damage: 5, message: 'Struck by a reef squid. -5s oxygen', material: MATERIAL.bedrock },
  shark: { width: 30, height: 14, radius: 15, damage: 7, message: 'Bitten by a shark! -7s oxygen', material: MATERIAL.stone },
};

let world;
let player;
let inventory;
let tank;
let appearance = normalizeAppearance();
let selected = 0;
let placing = false;
let dirty = false;
let toastTimer;
let focusedItem;
let time = 0;
let worldTime;
let savedWorldTime;
let weatherSeed;
let enemies;
let jumpRequested = false;
let miningPointerId = null;
let mining = null;

const camera = { x: 0, y: 0, width: 0, height: 0 };
const particles = [];
const inventoryUi = createInventoryUi(backpackPanel, {
  getInventory: () => inventory,
  onMove: inventoryChanged,
  onSelect: select,
});

function spawn() {
  let y = SPAWN.y;
  while (y > 0 && collides(SPAWN.x, y)) y = Math.max(0, y - TILE);
  return { x: SPAWN.x, y, ...playerSize, dx: 0, dy: 0, grounded: false, canShortenJump: false, facing: 1, walkPhase: 0, oxygen: tank ? 42 : 18, hurt: 0 };
}

function startNewWorld() {
  world = createWorld();
  worldTime = 0;
  weatherSeed = Math.floor(Math.random() * 0x80000000);
  enemies = { spawnIn: 5, hitCooldown: 0 };
  tank = false;
  inventory = new Inventory();
  player = spawn();
}

function load() {
  startNewWorld();
  try {
    const state = JSON.parse(localStorage.getItem(saveKey));
    const legacy = state?.format === 1;
    if (!legacy && state?.format !== saveFormat) return;
    if (Number.isFinite(state.worldTime) && state.worldTime >= 0) {
      worldTime = state.worldTime;
      savedWorldTime = worldTime;
    }
    if (Number.isInteger(state.weatherSeed) && state.weatherSeed >= 0 && state.weatherSeed < 0x80000000) {
      weatherSeed = state.weatherSeed;
    }
    appearance = normalizeAppearance(state.appearance);
    tank = state.tank === true;
    inventory = new Inventory(state.inventory);
    for (const edit of state.edits ?? []) {
      if (!Array.isArray(edit)) continue;
      if (legacy) {
        const [index, material] = edit;
        if (Number.isInteger(index) && index >= 0 && index < legacyCols * legacyEditableRows && editableMaterials.has(material)) {
          editTile(world, index % legacyCols + WEST_EXTENSION, Math.floor(index / legacyCols), material);
        }
      } else {
        const [x, y, material] = edit;
        if (Number.isInteger(x) && Number.isInteger(y) && editableMaterials.has(material)) {
          editTile(world, x + WEST_EXTENSION, y, material);
        }
      }
    }
    const harvestableIds = new Set([...world.items, ...world.trees].map(({ id }) => id));
    world.harvested = new Set((state.harvested ?? []).filter((id) => harvestableIds.has(id)));
    syncMobs();
    player = spawn();
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      const x = clamp(state.x + WEST_EXTENSION * TILE, player.width, COLS * TILE - player.width);
      const y = clamp(state.y, 0, ROWS * TILE - player.height);
      if (!collides(x, y)) Object.assign(player, { x, y });
    }
    if (Number.isFinite(state.oxygen)) player.oxygen = clamp(state.oxygen, 1, tank ? 42 : 18);
    dirty = legacy;
    save();
  } catch {
    // An invalid or unavailable save should never prevent a new game.
  }
}

function save() {
  if (!dirty && worldTime === savedWorldTime) return;
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      format: saveFormat, x: player.x - WEST_EXTENSION * TILE, y: player.y, oxygen: player.oxygen, tank, inventory, appearance,
      edits: Array.from(world.edits, ([index, material]) => [index % COLS - WEST_EXTENSION, Math.floor(index / COLS), material]),
      harvested: Array.from(world.harvested),
      worldTime, weatherSeed,
    }));
    savedWorldTime = worldTime;
    dirty = false;
  } catch {
    // The current session remains playable if storage is blocked or full.
  }
}

function collides(x, y) {
  const left = Math.floor((x - playerSize.width / 2) / TILE);
  const right = Math.floor((x + playerSize.width / 2 - 0.01) / TILE);
  const top = Math.floor(y / TILE);
  const bottom = Math.floor((y + playerSize.height - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (tileAt(world, tx, ty)) return true;
    }
  }
  return false;
}

function moveAxis(axis, amount) {
  let remaining = amount;
  while (Math.abs(remaining) > 0.001) {
    const delta = clamp(remaining, -3, 3);
    const x = player.x + (axis === 'x' ? delta : 0);
    const y = player.y + (axis === 'y' ? delta : 0);
    if (!collides(x, y)) {
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
      if (collides(x, y)) blocked = fraction;
      else allowed = fraction;
    }
    player[axis] += delta * allowed;
    return true;
  }
  return false;
}

function pressed(...codes) {
  return codes.some((code) => keys.has(code));
}

function nearestItem() {
  let result;
  let distance = 35;
  for (const item of world.items) {
    if (world.harvested.has(item.id)) continue;
    const difference = Math.hypot(item.x - player.x, item.y - player.y - 12);
    if (difference < distance) {
      distance = difference;
      result = item;
    }
  }
  return result;
}

function canJumpAshore(direction) {
  if (!direction || player.dy < -swimSpeed || player.y + 5 > WATER || player.y + player.height <= WATER) return false;

  const shoreX = player.x + direction * player.width;
  const clearanceY = player.y - 2 * TILE;
  return collides(shoreX, player.y) && !collides(player.x, clearanceY) && !collides(shoreX, clearanceY);
}

function fishCollides(x, y, width = 12, height = 8) {
  if (y - height / 2 < WATER + 8) return true;
  const left = Math.floor((x - width / 2) / TILE);
  const right = Math.floor((x + width / 2 - 0.01) / TILE);
  const top = Math.floor((y - height / 2) / TILE);
  const bottom = Math.floor((y + height / 2 - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (tileAt(world, tx, ty)) return true;
    }
  }
  return false;
}

function burstParticles(x, y, material, count = 8, spread = 55) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, dx: (Math.random() - 0.5) * spread,
      dy: (Math.random() - 0.65) * spread, life: 0.25 + Math.random() * 0.4, material,
    });
  }
}

function crabCollides(x, y) {
  const left = Math.floor((x - 6) / TILE);
  const right = Math.floor((x + 6 - 0.01) / TILE);
  const top = Math.floor((y - 8) / TILE);
  const bottom = Math.floor((y - 0.01) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (tileAt(world, tx, ty)) return true;
    }
  }
  return false;
}

function crabHasFloor(x, y) {
  const tx = Math.floor(x / TILE);
  const baseTy = Math.floor((y + 1) / TILE);
  return Boolean(tileAt(world, tx, baseTy) || tileAt(world, tx, baseTy + 1));
}

function syncMobs() {
  for (const mob of world.mobs) {
    if (mob.kind === 'crab') {
      while (mob.y > TILE && crabCollides(mob.x, mob.y)) mob.y -= TILE;
    } else if (fishCollides(mob.x, mob.y)) {
      for (let offset = 1; offset <= 4; offset++) {
        if (!fishCollides(mob.x, mob.y - offset * TILE)) {
          mob.y -= offset * TILE;
          break;
        }
        if (!fishCollides(mob.x, mob.y + offset * TILE)) {
          mob.y += offset * TILE;
          break;
        }
      }
    }
  }
}

function stepMobs(dt, night) {
  updateEnemySpawns(enemies, world.mobs, player, night, dt, fishCollides);
  enemies.hitCooldown = Math.max(0, enemies.hitCooldown - dt);
  const underwater = player.y + 5 > WATER;
  const px = player.x;
  const py = player.y + 11;
  const playerMoving = Math.hypot(player.dx, player.dy) > 14 || miningPointerId !== null;
  let hit;

  for (const mob of world.mobs) {
    mob.flee = Math.max(0, mob.flee - dt);
    const diffX = mob.x - px;
    const diffY = (mob.kind === 'crab' ? mob.y - 4 : mob.y) - py;
    const dist = Math.hypot(diffX, diffY) || 1;

    if (mob.kind === 'fish') {
      if (!mob.enemyType && py > WATER && dist < 44 && playerMoving) {
        mob.flee = 1.1;
        if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
      }

      let targetDx;
      let targetDy;
      if (mob.enemyType && underwater && dist < 108 && mob.remainingLife > 2) {
        targetDx = -diffX / dist * mob.speed;
        targetDy = -diffY / dist * mob.speed;
        if (enemies.hitCooldown === 0 && Math.abs(diffX) < 12 && Math.abs(diffY) < 10) {
          enemies.hitCooldown = 3;
          hit = mob.enemyType;
        }
      } else if (mob.flee > 0) {
        targetDx = mob.facing * mob.speed * 1.75;
        targetDy = clamp((diffY / dist) * mob.speed * 1.1, -mob.speed, mob.speed);
      } else {
        if (mob.x > mob.homeX + mob.span) mob.facing = -1;
        else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
        if (fishCollides(mob.x + mob.facing * 12, mob.y)) mob.facing = -mob.facing;
        targetDx = mob.facing * mob.speed * (0.85 + 0.25 * Math.sin(time * 2.1 + mob.phase));
        const targetY = Math.max(WATER + 14, mob.homeY + Math.sin(time * 1.5 + mob.phase) * 10);
        targetDy = clamp((targetY - mob.y) * 1.8, -mob.speed * 0.65, mob.speed * 0.65);
      }

      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
      mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
      if (Math.abs(mob.dx) > 1.5) mob.facing = mob.dx < 0 ? -1 : 1;

      const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
      if (!fishCollides(nextX, mob.y)) {
        mob.x = nextX;
      } else {
        mob.facing = -mob.facing;
        mob.dx *= -0.6;
      }

      const nextY = Math.max(WATER + 10, mob.y + mob.dy * dt);
      if (!fishCollides(mob.x, nextY)) {
        mob.y = nextY;
      } else {
        mob.dy *= -0.6;
      }
    } else if (mob.kind === 'crab') {
      if (dist < 36 && playerMoving) {
        mob.flee = 1;
        if (Math.abs(diffX) > 1) mob.facing = diffX < 0 ? -1 : 1;
      }

      if (mob.x > mob.homeX + mob.span) mob.facing = -1;
      else if (mob.x < mob.homeX - mob.span) mob.facing = 1;

      const scuttling = mob.flee > 0 || Math.sin(time * 1.15 + mob.phase * 2.1) > -0.55;
      const targetDx = scuttling ? mob.facing * mob.speed * (mob.flee > 0 ? 1.65 : 1) : 0;
      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 10);

      if (Math.abs(mob.dx) > 0.5) {
        const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
        if (!crabCollides(nextX, mob.y)) {
          if (!mob.grounded || crabHasFloor(nextX, mob.y)) {
            mob.x = nextX;
          } else {
            mob.facing = -mob.facing;
            mob.dx = 0;
          }
        } else {
          const stepY = Math.floor((mob.y - 1) / TILE) * TILE;
          if (mob.grounded && mob.y - stepY <= TILE && !crabCollides(mob.x, stepY) && !crabCollides(nextX, stepY)) {
            mob.x = nextX;
            mob.y = stepY;
          } else {
            mob.facing = -mob.facing;
            mob.dx = 0;
          }
        }
      }

      const inWater = mob.y > WATER;
      mob.dy = Math.min(mob.dy + (inWater ? 260 : 480) * dt, inWater ? 120 : 210);
      const nextY = mob.y + mob.dy * dt;
      if (!crabCollides(mob.x, nextY)) {
        mob.y = nextY;
        mob.grounded = false;
      } else {
        mob.y = Math.floor((nextY - 0.01) / TILE) * TILE;
        mob.dy = 0;
        mob.grounded = true;
      }
    } else if (enemySpecs[mob.kind]) {
      const spec = enemySpecs[mob.kind];
      mob.cooldown = Math.max(0, (mob.cooldown ?? 0) - dt);
      const playerInWater = py > WATER + 6;
      const toPlayerX = px - mob.x;
      const toPlayerY = py - mob.y;
      let targetDx = 0;
      let targetDy = 0;

      if (mob.flee > 0) {
        targetDx = -(toPlayerX / dist) * (mob.speed * 1.6 + 24);
        targetDy = -(toPlayerY / dist) * (mob.speed * 1.2 + 16);
      } else if (mob.kind === 'jellyfish') {
        const targetX = mob.homeX + Math.sin(time * 0.55 + mob.phase) * mob.span;
        const targetY = mob.homeY + Math.sin(time * 1.5 + mob.phase * 1.7) * 16;
        targetDx = clamp((targetX - mob.x) * 1.4, -mob.speed, mob.speed);
        targetDy = clamp((targetY - mob.y) * 2.1, -mob.speed * 1.3, mob.speed * 1.3);
      } else if (mob.kind === 'squid') {
        const pulse = 0.3 + 0.95 * Math.pow(Math.max(0, Math.sin(time * 2.7 + mob.phase)), 2);
        if (playerInWater && dist < 115 && mob.cooldown === 0) {
          targetDx = (toPlayerX / dist) * mob.speed * 1.25 * pulse;
          targetDy = (toPlayerY / dist) * mob.speed * 1.1 * pulse;
        } else {
          const targetX = mob.homeX + Math.sin(time * 0.75 + mob.phase) * mob.span;
          const targetY = mob.homeY + Math.cos(time * 1.35 + mob.phase) * 15;
          const toX = targetX - mob.x;
          const toY = targetY - mob.y;
          const toDist = Math.hypot(toX, toY) || 1;
          targetDx = (toX / toDist) * mob.speed * pulse;
          targetDy = (toY / toDist) * mob.speed * 0.75 * pulse;
        }
      } else if (mob.kind === 'shark') {
        if (playerInWater && dist < 165 && Math.abs(px - mob.homeX) < mob.span + 95 && mob.cooldown === 0) {
          targetDx = (toPlayerX / dist) * mob.speed * 1.18;
          targetDy = (toPlayerY / dist) * mob.speed * 0.82;
        } else {
          if (mob.x > mob.homeX + mob.span) mob.facing = -1;
          else if (mob.x < mob.homeX - mob.span) mob.facing = 1;
          targetDx = mob.facing * mob.speed;
          const targetY = mob.homeY + Math.sin(time * 1.2 + mob.phase) * 9;
          targetDy = clamp((targetY - mob.y) * 1.8, -26, 26);
        }
      }

      mob.dx += (targetDx - mob.dx) * Math.min(1, dt * 5);
      mob.dy += (targetDy - mob.dy) * Math.min(1, dt * 5);
      if (Math.abs(mob.dx) > 1.5 && mob.kind !== 'jellyfish') mob.facing = mob.dx < 0 ? -1 : 1;

      const nextX = clamp(mob.x + mob.dx * dt, TILE, (COLS - 1) * TILE);
      if (!fishCollides(nextX, mob.y, spec.width, spec.height)) {
        mob.x = nextX;
      } else {
        mob.dx *= -0.75;
        mob.facing = -mob.facing;
      }

      const nextY = Math.max(WATER + 12, mob.y + mob.dy * dt);
      if (!fishCollides(mob.x, nextY, spec.width, spec.height)) {
        mob.y = nextY;
      } else {
        mob.dy *= -0.75;
      }

      if (playerInWater && player.hurt <= 0 && mob.flee <= 0 && mob.cooldown <= 0 && dist < spec.radius + 7) {
        player.hurt = 1.15;
        mob.cooldown = 1.6;
        if (mob.kind === 'squid') mob.flee = 1.8;
        player.dx = (toPlayerX / dist) * 135;
        player.dy = (toPlayerY / dist) * 105 - 18;
        player.oxygen = Math.max(0, player.oxygen - spec.damage);
        burstParticles(mob.x, mob.y, spec.material, mob.kind === 'squid' ? 14 : 9, 68);
        notify(spec.message);
        dirty = true;
      }
    }
  }
  return hit;
}

function step(dt, night) {
  const left = pressed('KeyA', 'ArrowLeft');
  const right = pressed('KeyD', 'ArrowRight');
  const up = pressed(...jumpKeys);
  const down = pressed('KeyS', 'ArrowDown');
  const bodyInWater = player.y + player.height * 0.65 > WATER;
  const maxOxygen = tank ? 42 : 18;
  const horizontal = Number(right) - Number(left);
  const shoreJump = (up || jumpRequested) && !down && canJumpAshore(horizontal);

  player.hurt = Math.max(0, (player.hurt ?? 0) - dt);
  if (horizontal) player.facing = horizontal;
  player.dx += (horizontal * (bodyInWater ? 102 : 112) - player.dx) * Math.min(1, dt * (bodyInWater ? 5 : 13));
  if (bodyInWater && !shoreJump) {
    player.canShortenJump = false;
    const vertical = Number(down) - Number(up);
    player.dy += ((vertical ? vertical * swimSpeed : 10) - player.dy) * Math.min(1, 7 * dt);
  } else {
    if (shoreJump || (jumpRequested && player.grounded)) {
      player.dy = -jumpSpeed;
      player.canShortenJump = !shoreJump;
    }
    if (player.canShortenJump && !up) {
      player.dy = Math.max(player.dy, -shortHopSpeed);
      player.canShortenJump = false;
    }
    player.dy = Math.min(player.dy + 510 * dt, 245);
  }
  jumpRequested = false;

  const previousX = player.x;
  if (moveAxis('x', player.dx * dt)) player.dx = 0;
  const falling = player.dy >= 0;
  const yCollision = moveAxis('y', player.dy * dt);
  player.grounded = yCollision && falling;
  if (yCollision) player.dy = 0;
  if (player.dy >= 0) player.canShortenJump = false;
  if (player.y < 0) player.y = 0;
  if (player.grounded && !bodyInWater) {
    player.walkPhase = (player.walkPhase + Math.abs(player.x - previousX) / WALK_CYCLE_DISTANCE) % 1;
  }

  const hit = stepMobs(dt, night);
  if (hit) {
    player.oxygen = Math.max(0, player.oxygen - hit.airLoss);
    notify(hit.name + ' bite. −' + hit.airLoss + ' s of air.');
  }

  const atVent = world.vents.some(({ x, y }) => Math.hypot(player.x - x, player.y + 5 - (y - TILE)) < 30);
  if (atVent) {
    if (player.oxygen < maxOxygen) dirty = true;
    player.oxygen = Math.min(maxOxygen, player.oxygen + 18 * dt);
  } else if (player.y + 5 > WATER) {
    player.oxygen = Math.max(0, player.oxygen - dt);
    if (player.oxygen === 0) {
      player = spawn();
      for (const mob of world.mobs) {
        if (enemySpecs[mob.kind]) {
          mob.x = mob.homeX;
          mob.y = mob.homeY;
          mob.dx = 0;
          mob.dy = 0;
          mob.flee = 0;
          mob.cooldown = 0;
        }
      }
      stopMining();
      notify('You washed back up on the island.');
      dirty = true;
      save();
    }
  } else {
    player.oxygen = Math.min(maxOxygen, player.oxygen + 14 * dt);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
    else {
      particle.x += particle.dx * dt;
      particle.y += particle.dy * dt;
      particle.dy += 42 * dt;
    }
  }

  focusedItem = nearestItem();
  if (Math.abs(player.dx) > 0.1 || Math.abs(player.dy) > 0.1 || player.oxygen < maxOxygen) dirty = true;
}

function aim() {
  if (!pointer.active) return null;
  const tx = Math.floor((pointer.x + camera.x) / TILE);
  const ty = Math.floor((pointer.y + camera.y) / TILE);
  const reachable = Math.hypot(tx * TILE + 8 - player.x, ty * TILE + 8 - player.y - 11) <= 5 * TILE;
  return { tx, ty, reachable };
}

function placeBlock() {
  const target = aim();
  if (!target?.reachable) return;
  const { tx, ty } = target;
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  const block = ITEMS[inventory.hotbar[selected]?.id]?.block;
  if (!block || tileAt(world, tx, ty) || treeAt(world, tx, ty)) return;
  const touches = tileAt(world, tx - 1, ty) || tileAt(world, tx + 1, ty) || tileAt(world, tx, ty - 1) || tileAt(world, tx, ty + 1);
  if (!touches || world.items.some((item) => !world.harvested.has(item.id) && Math.floor(item.x / TILE) === tx && Math.floor(item.y / TILE) === ty)) return;
  editTile(world, tx, ty, block);
  if (collides(player.x, player.y)) {
    editTile(world, tx, ty, MATERIAL.air);
    return;
  }
  syncMobs();
  inventory.consume(inventory.hotbar, selected, 1);
  inventoryChanged();
}

function stopMining() {
  miningPointerId = null;
  mining = null;
}

function updateMining(dt) {
  if (miningPointerId === null) return;
  const target = aim();
  const tile = target?.reachable ? tileAt(world, target.tx, target.ty) : MATERIAL.air;
  const tree = target?.reachable && tile === MATERIAL.air ? treeAt(world, target.tx, target.ty) : undefined;
  const material = tree ? MATERIAL.wood : tile;
  const duration = breakSeconds[material];
  if (!duration) {
    mining = null;
    return;
  }

  const { tx, ty } = target;
  if (!mining || mining.tree !== tree || (!tree && (mining.tx !== tx || mining.ty !== ty || mining.material !== material))) {
    mining = { tree, material, duration, progress: 0 };
  }
  mining.tx = tx;
  mining.ty = ty;
  mining.progress += dt / duration;
  if (mining.progress < 1) return;

  const drop = tree ? 'wood' : drops[material];
  if (!collect(drop, tree ? Math.round(tree.height / TILE) : 1)) {
    stopMining();
    return;
  }
  mining = null;
  if (tree) {
    world.harvested.add(tree.id);
  } else {
    editTile(world, tx, ty, MATERIAL.air);
  }
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: tx * TILE + 8, y: ty * TILE + 8, dx: (Math.random() - 0.5) * 55,
      dy: Math.random() * -44, life: 0.25 + Math.random() * 0.35, material,
    });
  }
  inventoryChanged();
}

function interact() {
  const item = nearestItem();
  if (!item) return;
  if (item.kind === 'cache') {
    if (!collect('wood', 8)) return;
    notify('Wreck cache recovered. +8 wood');
  } else {
    if (!collect(item.kind, item.amount)) return;
    notify('+' + item.amount + ' ' + item.kind);
  }
  world.harvested.add(item.id);
  focusedItem = nearestItem();
  inventoryChanged();
}

function collect(id, count) {
  if (inventory.add(id, count)) return true;
  notify('No room for more ' + ITEMS[id].name.toLowerCase() + '.');
  return false;
}

function notify(message) {
  const element = byId('feedback');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 2700);
}

function select(slot) {
  selected = slot;
  inventoryUi.render(selected);
}

function inventoryChanged() {
  inventoryUi.render(selected);
  dirty = true;
  save();
}

function openPanel(panel) {
  if (panel.open) {
    panel.close();
    return;
  }
  for (const other of panels) {
    if (other.open) other.close();
  }
  keys.clear();
  jumpRequested = false;
  stopMining();
  if (panel === backpackPanel) byId('backpack-tank').hidden = !tank;
  if (panel === craftPanel) updateCraft();
  if (panel === characterPanel) characterEditor.open(appearance);
  save();
  panel.showModal();
}

function canCraftTank() {
  return !tank && inventory.count('stone') >= tankCost.stone && inventory.count('kelp') >= tankCost.kelp;
}

function updateCraft() {
  const button = byId('make-tank');
  button.disabled = !canCraftTank();
  button.textContent = tank ? 'Equipped' : 'Craft air tank';
  byId('recipe-cost').textContent = tank ? 'Air tank equipped' : `${tankCost.stone} stone · ${tankCost.kelp} kelp`;
}

function setText(id, value) {
  const element = byId(id);
  if (element.textContent !== value) element.textContent = value;
}

function updateHud(conditions) {
  const depth = Math.max(0, Math.floor((player.y + 5 - WATER) / TILE));
  const air = Math.round(player.oxygen / (tank ? 42 : 18) * 100);
  const airValue = air + '%';
  setText('depth', depth + ' m');
  setText('world-conditions', (conditions.night ? 'Night' : 'Day') + (conditions.rain > 0 ? ' · Rain' : ' · Clear'));
  setText('air-label', airValue);
  const fill = byId('air-fill');
  if (fill.style.width !== airValue) {
    fill.style.width = airValue;
    fill.classList.toggle('low', air <= 25);
    fill.parentElement.setAttribute('aria-valuenow', String(air));
  }
  const prompt = byId('interact');
  prompt.hidden = !focusedItem;
  if (focusedItem) {
    prompt.querySelector('kbd').hidden = touch;
    prompt.querySelector('span').textContent = prompts[focusedItem.kind];
  }
}

function updateCamera(dt) {
  const horizontalAnchor = camera.width / camera.height < 0.8 ? 0.36 : 0.42;
  const x = clamp(player.x - camera.width * horizontalAnchor, 0, Math.max(0, COLS * TILE - camera.width));
  const y = clamp(player.y - camera.height * 0.28, 0, Math.max(0, ROWS * TILE - camera.height));
  const factor = reducedMotion ? 1 : Math.min(1, dt * 5);
  camera.x += (x - camera.x) * factor;
  camera.y += (y - camera.y) * factor;
}

function resize() {
  const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  camera.height = ratio < 0.8 ? 420 : ratio > 2.1 ? 330 : 380;
  camera.width = Math.max(1, Math.round(camera.height * ratio));
  canvas.width = camera.width;
  canvas.height = camera.height;
  pointer.active = false;
  stopMining();
  updateCamera(1);
}

function locatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * camera.width;
  pointer.y = (event.clientY - rect.top) / rect.height * camera.height;
  pointer.active = pointer.x >= 0 && pointer.x < camera.width && pointer.y >= 0 && pointer.y < camera.height;
}

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (event.ctrlKey || event.metaKey || event.altKey || characterPanel.open) return;
  if (code === 'Tab' && !event.shiftKey && !craftPanel.open && !pausePanel.open) {
    event.preventDefault();
    if (!event.repeat) openPanel(backpackPanel);
    return;
  }
  if (code === 'KeyC' && !event.repeat) {
    event.preventDefault();
    openPanel(craftPanel);
    return;
  }
  const panelOpen = panels.some((panel) => panel.open);
  if (code === 'KeyV' && !panelOpen && !event.repeat) {
    event.preventDefault();
    openPanel(characterPanel);
    return;
  }
  if (code === 'Escape' && !panelOpen && !event.repeat) {
    event.preventDefault();
    openPanel(pausePanel);
    return;
  }
  if (panelOpen) return;
  if (event.target instanceof HTMLButtonElement && code === 'Space') return;
  if (moveKeys.has(code)) {
    event.preventDefault();
    if (!event.repeat && jumpKeys.includes(code)) jumpRequested = true;
    keys.add(code);
  }
  if (event.repeat) return;
  if (code === 'KeyE') interact();
  if (/^Digit[1-4]$/.test(code)) select(Number(code.slice(-1)) - 1);
});
window.addEventListener('keyup', ({ code }) => keys.delete(code));
window.addEventListener('blur', () => {
  keys.clear();
  jumpRequested = false;
  stopMining();
  save();
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (!document.hidden) return;
  stopMining();
  save();
});
window.addEventListener('resize', resize);

canvas.addEventListener('pointermove', (event) => {
  if (miningPointerId === null || event.pointerId === miningPointerId) locatePointer(event);
});
canvas.addEventListener('pointerleave', (event) => {
  if (miningPointerId !== null && event.pointerId !== miningPointerId) return;
  pointer.active = false;
  stopMining();
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
function fendOffEnemy() {
  if (!pointer.active) return false;
  const wx = pointer.x + camera.x;
  const wy = pointer.y + camera.y;
  for (const mob of world.mobs) {
    const spec = enemySpecs[mob.kind];
    if (!spec) continue;
    if (Math.hypot(wx - mob.x, wy - mob.y) <= spec.radius + 10 && Math.hypot(mob.x - player.x, mob.y - player.y - 11) <= 5 * TILE) {
      const angle = Math.atan2(mob.y - (player.y + 11), mob.x - player.x);
      mob.dx = Math.cos(angle) * 125;
      mob.dy = Math.sin(angle) * 95;
      mob.flee = 2.4;
      mob.cooldown = 1.4;
      burstParticles(mob.x, mob.y, spec.material, mob.kind === 'squid' ? 14 : 8, 64);
      notify(mob.kind === 'squid' ? 'Startled squid jetted away in ink!' : 'Fended off ' + mob.kind + '!');
      return true;
    }
  }
  return false;
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  if (miningPointerId !== null && miningPointerId !== event.pointerId) return;
  event.preventDefault();
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
  locatePointer(event);
  if (event.button === 2 || (event.pointerType === 'touch' && placing)) {
    stopMining();
    placeBlock();
    if (event.pointerType === 'touch') pointer.active = false;
    return;
  }
  if (fendOffEnemy()) {
    if (event.pointerType === 'touch') pointer.active = false;
    return;
  }
  miningPointerId = event.pointerId;
  mining = null;
});
function releaseMiningPointer(event) {
  if (event.pointerId !== miningPointerId) return;
  if (event.type === 'pointerup' && event.button !== 0) return;
  if (event.pointerType === 'touch') pointer.active = false;
  stopMining();
}
window.addEventListener('pointerup', releaseMiningPointer);
window.addEventListener('pointercancel', releaseMiningPointer);
canvas.addEventListener('lostpointercapture', releaseMiningPointer);
window.addEventListener('mouseup', (event) => { if (event.button === 0) stopMining(); });

for (const button of document.querySelectorAll('[data-hold]')) {
  const key = button.dataset.hold;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (key === 'Space') jumpRequested = true;
    keys.add(key);
  });
  for (const action of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(action, () => keys.delete(key));
  }
}
byId('grab').addEventListener('click', interact);
byId('touch-mode').addEventListener('click', (event) => {
  stopMining();
  placing = !placing;
  event.currentTarget.textContent = placing ? 'Build' : 'Mine';
  event.currentTarget.setAttribute('aria-pressed', String(placing));
});
byId('backpack').addEventListener('click', () => openPanel(backpackPanel));
byId('craft').addEventListener('click', () => openPanel(craftPanel));
byId('character').addEventListener('click', () => openPanel(characterPanel));
byId('pause').addEventListener('click', () => openPanel(pausePanel));
byId('resume').addEventListener('click', () => pausePanel.close());
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
if (devTools) {
  const resetWorld = byId('reset-world');
  resetWorld.hidden = false;
  resetWorld.addEventListener('click', () => {
    if (!confirm('Rebuild the world and erase all progress saved in this browser?')) return;
    startNewWorld();
    select(0);
    pointer.active = false;
    focusedItem = null;
    particles.length = 0;
    clearTimeout(toastTimer);
    byId('feedback').hidden = true;
    pausePanel.close();
    updateCamera(1);
    dirty = true;
    save();
    if (dirty) notify('World reset for this session. The browser could not save it.');
  });
}
byId('make-tank').addEventListener('click', () => {
  if (!canCraftTank()) return;
  inventory.spend('stone', tankCost.stone);
  inventory.spend('kelp', tankCost.kelp);
  tank = true;
  player.oxygen = Math.min(42, player.oxygen + 24);
  inventoryChanged();
  craftPanel.close();
  notify('Air tank equipped.');
});

byId('version').textContent = 'v' + version;
load();
select(0);
resize();
setInterval(save, 4000);

let last = performance.now();
let accumulator = 0;
const timestep = 1 / 60;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = Math.min(elapsed, 0.05);
  last = now;
  const playing = !document.hidden && !panels.some((panel) => panel.open);
  if (playing) worldTime += elapsed;
  const conditions = worldConditions(worldTime, weatherSeed);
  if (playing) {
    time += dt;
    accumulator += dt;
    while (accumulator >= timestep) {
      step(timestep, conditions.night);
      accumulator -= timestep;
    }
    updateCamera(dt);
    updateMining(dt);
  }
  updateHud(conditions);
  renderer.draw({
    world, player, appearance, tank, camera, time: reducedMotion ? 0 : time, aim: aim(),
    mining, particles, reducedMotion, conditions,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
