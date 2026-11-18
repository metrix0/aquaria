import { Inventory, ITEMS } from './inventory.js';
import { ARROW } from './content.js';
import { fendOffEnemy, targetMobAt } from './gameplay/mobs.js';
import { PLAYER_SIZE } from './gameplay/player.js';
import { config } from './config.js';
import { worldConditions } from './environment.js';
import { advanceMining, applyTerrain, awardTileAction, collectItem, commitTileAction, craftItem, craftTank, createGame, planTileAction, resetRoomProgress, stepGame, targetTile, useWeapon } from './gameplay/simulation.js';
import { bindInput } from './input.js';
import { connectRoom, roomCode } from './multiplayer/client.js';
import { createRenderer } from './render.js';
import { createBrowserSave } from './save.js';
import { createUI } from './ui.js';
import { version } from './build-info.js';
import { COLS, ROWS, TILE, clamp } from './world/generation.js';

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const soloSave = createBrowserSave();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const available = Boolean(config.url && config.publishableKey);
const camera = { x: 0, y: 0, width: 1, height: 1 };
const particles = [];

let save = soloSave;
let game = restore(save);
let room;
let busy = false;
let editPending = false;
let mining = null;
let attackCooldown = 0;
let attackSwing = null;
let selected = 0;
let count = 1;
let time = 0;
let caveShadowsHidden = false;
let message = available ? 'Create a room or join with an invite link.' : 'Multiplayer is unavailable in this build.';

function restore(storage) {
  const { snapshot, migrated } = storage.load();
  const loaded = createGame(snapshot);
  if (migrated) {
    loaded.dirty = true;
    storage.write(loaded);
  }
  return loaded;
}

function storeProgress() {
  save.write(game);
}

function select(slot) {
  selected = slot;
  ui.select(slot);
}

function showAndSave(note) {
  if (note) ui.notify(note);
  storeProgress();
}

function aimedTile() {
  const { pointer } = input;
  return pointer.active ? targetTile(game, pointer.x + camera.x, pointer.y + camera.y) : null;
}

function aimedMob() {
  const { pointer } = input;
  return pointer.active ? targetMobAt(game, pointer.x + camera.x, pointer.y + camera.y) : null;
}

function performAttack() {
  const { pointer } = input;
  const effect = fendOffEnemy(game, pointer.x + camera.x, pointer.y + camera.y);
  if (!effect) return false;
  attackCooldown = 0.28;
  attackSwing = { x: effect.x, y: effect.y, elapsed: 0, duration: 0.24 };
  emitEffect(effect);
  return true;
}

function showTileEffect({ tx, ty, before, amount }) {
  if (amount < 0) return;
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: tx * TILE + 8, y: ty * TILE + 8, dx: (Math.random() - 0.5) * 55,
      dy: Math.random() * -44, life: 0.25 + Math.random() * 0.35, material: before,
    });
  }
}

function inventoryChanged() {
  ui.select(selected);
  game.dirty = true;
  storeProgress();
}

function emitEffect({ x, y, material, color, count, spread, message }) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, dx: (Math.random() - 0.5) * spread, dy: (Math.random() - 0.65) * spread,
      life: 0.25 + Math.random() * 0.4, material, color,
    });
  }
  if (message) ui.notify(message);
}

async function editTile(action) {
  if (!action || editPending) return;
  const rewards = action.supportedDoor ? new Inventory(game.inventory) : null;
  const missing = action.amount > 0 && (rewards
    ? (!rewards.add(action.item, action.amount) ? action.item : !rewards.add('door', 1) ? 'door' : null)
    : !game.inventory.canAdd(action.item, action.amount) ? action.item : null);
  if (missing) {
    input.stopMining();
    ui.notify('No room for more ' + ITEMS[missing].name.toLowerCase() + '.');
    return;
  }
  if (!room || action.treeId) commitTileAction(game, action);
  else {
    editPending = true;
    try {
      const response = await room.edit(action);
      if (!response?.accepted) {
        ui.notify('That tile changed. Try again.');
        return;
      }
      awardTileAction(game, action, response.removedDoor);
    } catch {
      ui.notify('Could not confirm the terrain edit.');
      return;
    } finally {
      editPending = false;
    }
  }
  showTileEffect(action);
  inventoryChanged();
}

function inviteLink(id) {
  const url = new URL(location.href);
  url.hash = 'room=' + id;
  return url.href;
}

function updateRoomUI() {
  ui.room({ room, busy, available, message, count, link: room && inviteLink(room.id) });
}

async function enterRoom(value) {
  if (busy || room || !available) return;
  const invite = value === undefined ? null : roomCode(value);
  if (value !== undefined && !invite) {
    message = 'Enter a valid room link or code.';
    updateRoomUI();
    return;
  }
  busy = true;
  message = 'Connecting…';
  updateRoomUI();
  const pendingTiles = [];
  try {
    const connection = await connectRoom(config, invite, {
      tile: (...args) => room ? applyTerrain(game, ...args) : pendingTiles.push(args),
      status: (status) => {
        message = status;
        updateRoomUI();
      },
      count: (players) => {
        count = players;
        updateRoomUI();
      },
    });
    storeProgress();
    room = connection;
    save = createBrowserSave('aquaria.room.' + room.id, { saveTerrain: false });
    game = restore(save);
    game.weatherSeed = Number.parseInt(room.id.slice(0, 8), 16) & 0x7fffffff;
    for (const tile of pendingTiles) applyTerrain(game, ...tile);
    switchView();
    history.replaceState(null, '', inviteLink(room.id));
    if (message === 'Connecting…') message = 'Invite a friend with this link.';
    ui.close('room-panel');
  } catch (error) {
    message = error instanceof Error ? error.message : 'Could not connect to the room. Try again.';
    if (ui.activePanel() !== 'room-panel') ui.open('room-panel');
  } finally {
    busy = false;
    updateRoomUI();
  }
}

function leaveRoom() {
  if (!room || editPending) return;
  storeProgress();
  room.close();
  room = undefined;
  count = 1;
  save = soloSave;
  game = restore(save);
  message = 'Create a room or join with an invite link.';
  const url = new URL(location.href);
  url.hash = '';
  history.replaceState(null, '', url);
  switchView();
  updateRoomUI();
  ui.close('room-panel');
}

function switchView() {
  input.clear();
  input.pointer.active = false;
  attackCooldown = 0;
  attackSwing = null;
  particles.length = 0;
  select(0);
  updateCamera(1);
}

async function copyRoom() {
  if (!room) return;
  try {
    await navigator.clipboard.writeText(inviteLink(room.id));
    message = 'Invite copied.';
    updateRoomUI();
  } catch {
    document.getElementById('room-invitation').select();
  }
}

function restart() {
  if (editPending) return;
  const question = room
    ? 'Reset your progress in this room? The shared terrain will stay.'
    : 'Start a new game and erase the save in this browser?';
  if (!confirm(question)) return;
  save.clear();
  game = room ? resetRoomProgress(game) : createGame();
  switchView();
  game.dirty = true;
  storeProgress();
  ui.close('pause-panel');
  ui.clearNotice();
  if (game.dirty) ui.notify('World reset for this session. The browser could not save it.');
}

const ui = createUI({
  beforePanel(id) {
    input.clear();
    if (id === 'craft-panel') ui.updateCraft(game);
    if (id === 'backpack-panel') ui.updateBackpack(game);
    if (id === 'customize-panel') ui.updateCustomize(game);
    storeProgress();
  },
  select, enterRoom, leaveRoom, copyRoom, restart, inventoryChanged,
  hideCaveShadows: (hidden) => { caveShadowsHidden = hidden; },
  getInventory: () => game.inventory,
  canMoveInventory: () => !editPending,
  customize(appearance) {
    game.player.appearance = appearance;
    game.dirty = true;
    storeProgress();
    if (game.dirty) ui.notify('Appearance updated for this session. The browser could not save it.');
  },
  makeItem(recipe) {
    if (editPending || !craftItem(game, recipe)) return;
    inventoryChanged();
    ui.updateCraft(game);
    const label = (recipe.amount ?? 1) > 1 ? recipe.amount + ' × ' + ITEMS[recipe.id].name : ITEMS[recipe.id].name;
    ui.notify(label + ' crafted.');
  },
  makeTank() {
    if (editPending || !craftTank(game)) return;
    ui.close('craft-panel');
    inventoryChanged();
    ui.notify('Air tank equipped.');
  },
}, version);

const input = bindInput(canvas, {
  blocked: ui.activePanel,
  collect() {
    if (editPending) return;
    const note = collectItem(game);
    if (note) {
      inventoryChanged();
      ui.notify(note);
    }
  },
  fend() {
    if (editPending || game.player.stun > 0) return false;
    const { pointer } = input;
    const wx = pointer.x + camera.x;
    const wy = pointer.y + camera.y;
    const result = useWeapon(game, selected, wx, wy);
    if (result) {
      for (const effect of game.effects) emitEffect(effect);
      game.effects.length = 0;
      if (result.inventoryChanged) inventoryChanged();
      if (result.message) ui.notify(result.message);
      return true;
    }
    if (attackCooldown > 0) return Boolean(aimedMob());
    return performAttack();
  },
  place: () => void editTile(planTileAction(game, aimedTile(), true, selected)),
  stopMining: () => { mining = null; },
  select,
  craft: () => ui.open('craft-panel'),
  backpack: () => ui.open('backpack-panel'),
  character: () => ui.open('customize-panel'),
  pause: () => ui.open('pause-panel'),
});

function updateCamera(dt) {
  const horizontalAnchor = camera.width / camera.height < 0.8 ? 0.36 : 0.42;
  const x = clamp(game.player.x - camera.width * horizontalAnchor, 0, Math.max(0, COLS * TILE - camera.width));
  const standingY = game.player.y + game.player.height - PLAYER_SIZE.height;
  const y = clamp(standingY - camera.height * 0.28, 0, Math.max(0, ROWS * TILE - camera.height));
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
  input.pointer.active = false;
  input.stopMining();
  updateCamera(1);
}

function updateParticles(dt) {
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
}

window.addEventListener('blur', storeProgress);
window.addEventListener('pagehide', storeProgress);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  input.stopMining();
  storeProgress();
});
window.addEventListener('resize', resize);
setInterval(storeProgress, 4000);
resize();
select(0);
updateRoomUI();

const invite = roomCode(location.hash);
if (invite && available) void enterRoom(invite);

let last = performance.now();
let accumulator = 0;
const timestep = 1 / 60;
function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = Math.min(elapsed, 0.05);
  last = now;
  const playing = !document.hidden && !ui.activePanel();
  if (playing && !room) {
    game.worldTime += elapsed;
    game.dirty = true;
  }
  const conditions = worldConditions(room?.worldAge(now) ?? game.worldTime, game.weatherSeed);
  if (playing) {
    time += dt;
    attackCooldown = Math.max(0, attackCooldown - dt);
    if (attackSwing) {
      attackSwing.elapsed += dt;
      if (attackSwing.elapsed >= attackSwing.duration) attackSwing = null;
    }
    accumulator += dt;
    while (accumulator >= timestep) {
      const previousPlayer = game.player;
      const note = stepGame(game, { ...input.sample(), mining: input.holdingMine(), night: conditions.night }, timestep);
      for (const effect of game.effects) emitEffect(effect);
      game.effects.length = 0;
      if (game.player !== previousPlayer) input.stopMining();
      if (note) showAndSave(note);
      accumulator -= timestep;
    }
    updateParticles(dt);
    updateCamera(dt);
    const heldItem = game.inventory.hotbar[selected]?.id;
    if (game.player.stun > 0) {
      mining = null;
      input.stopMining();
    } else if (ITEMS[heldItem]?.weapon) {
      mining = null;
    } else if (input.holdingMine() && !editPending) {
      if (aimedMob()) {
        mining = null;
        if (attackCooldown <= 0) performAttack();
      } else {
        mining = advanceMining(game, aimedTile(), mining, dt, selected);
        if (mining?.blocked) {
          ui.notify(mining.blocked);
          input.stopMining();
        } else if (mining?.progress >= 1) {
          void editTile(mining.action);
          mining = null;
        }
      }
    }
  }
  ui.update(game, conditions);
  const tank = game.progress.airTank;
  const helmet = game.progress.swimmingHelmet;
  const held = game.inventory.hotbar[selected]?.id;
  const peers = room?.tick(now, dt, game.player, tank, helmet);
  const targetMob = aimedMob();
  renderer.draw({
    world: game.world, player: game.player, tank, helmet, camera, time: reducedMotion ? 0 : time,
    aim: targetMob ? null : aimedTile(), mining, attackSwing, held, attack: game.attack,
    hasArrow: game.inventory.count(ARROW.id) > 0, playerArrows: game.projectiles,
    targetMob, particles, peers, reducedMotion, conditions, caveShadowsHidden,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
