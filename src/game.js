import { Inventory, ITEMS } from './inventory.js';
import { ARROW, WORKBENCH } from './content.js';
import { useRootRing } from './gameplay/root-ring.js';
import { equippedHook, useGrapplingHook } from './gameplay/hook.js';
import { wakeMimic } from './gameplay/enemies/mimic.js';
import { targetMobAt } from './gameplay/mobs.js';
import { spawnEnemyNear } from './gameplay/enemy-spawner.js';
import { createScreenShake } from './gameplay/screen-shake.js';
import { PLAYER_SIZE, playerHeadInWater, playerImmobilized, playerInWater, toggleGodMode } from './gameplay/player.js';
import { config } from './config.js';
import { WEATHER_MODES, worldConditions } from './environment.js';
import { advanceMining, applyTerrain, awardTileAction, chestAt, collectChest, commitTileAction, craftItem, createGame, equippedFeet, equippedRing, equippedSnorkel, equippedAddon, grantItem, moveInventoryStack, nearestItem, planTileAction, resetRoomProgress, stepGame, targetTile, useDressing, useUtilityItem, useWeapon, workbenchAt } from './gameplay/simulation.js';
import { bindInput } from './input.js';
import { connectRoom, roomCode } from './multiplayer/client.js';
import { createRenderer } from './render.js';
import { createBrowserSave } from './save.js';
import { consumeNewGame, createIslandReveal } from './start-flow.js';
import { createUI } from './ui.js';
import { version } from './build-info.js';
import { inWater } from './world.js';
import { COLS, ROWS, TILE, clamp } from './world/generation.js';

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const soloSave = createBrowserSave();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const newAppearance = consumeNewGame();
const arrival = newAppearance ? createIslandReveal(reducedMotion) : null;
const available = Boolean(config.url && config.publishableKey);
const camera = { x: 0, y: 0, width: 1, height: 1, swimSeconds: 0, swimBlend: 0 };
const particles = [];
const drowningWarningSeconds = 5;
const screenShake = createScreenShake();
const zoomLevels = [12.5, 25, 50, 75, 100, 125, 150, 200];
const flightSpeedLevels = [0.5, 1, 2, 4, 8];
let zoomIndex = zoomLevels.indexOf(100);

let save = soloSave;
let game = newAppearance ? createGame() : restore(save);
if (newAppearance) {
  save.clear();
  game.player.appearance = newAppearance;
  game.dirty = true;
  save.write(game);
}
let room;
let busy = false;
let editPending = false;
let mining = null;
let miningSwing = null;
let craftingBench;
let selected = 0;
let flightSpeedIndex = flightSpeedLevels.indexOf(1);
let weatherModeIndex = 0;
let count = 1;
let time = 0;
let drowning = 0;
let nextBreathBubble = 0;
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
  if (game.inventory.hotbar[slot]?.id === 'explorers-map') input.stopMining();
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

function mineAtPointer(current, dt) {
  const attempt = advanceMining(game, aimedTile(), current, dt, selected);
  const held = game.inventory.hotbar[selected]?.id;
  return ITEMS[held]?.weapon && !attempt?.tool ? null : attempt;
}

function startMiningSwing({ tx, ty, tier, duration }) {
  const cycles = Math.max(1, Math.round(duration / 0.42));
  miningSwing = { tx, ty, tier, duration: Math.max(0.36, duration / cycles), phase: 0 };
}

function showTileEffect({ tx, ty, before, amount, item }) {
  if (amount < 0) return;
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: tx * TILE + 8, y: ty * TILE + 8, dx: (Math.random() - 0.5) * 55,
      dy: Math.random() * -44, life: 0.25 + Math.random() * 0.35, material: before,
      color: item === 'kelp' ? '#72a78a' : undefined,
    });
  }
}

function craftingStation() {
  if (craftingBench && workbenchAt(game, craftingBench.tx, craftingBench.ty)) return WORKBENCH.id;
}

function inventoryChanged() {
  ui.select(selected);
  if (ui.activePanel() === 'craft-panel') ui.updateCraft(game, craftingStation());
  game.dirty = true;
  storeProgress();
}

function emitEffect({ x, y, material, color, count, spread, message, shake }) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, dx: (Math.random() - 0.5) * spread, dy: (Math.random() - 0.65) * spread,
      life: 0.25 + Math.random() * 0.4, material, color,
    });
  }
  if (shake) screenShake.trigger(shake);
  if (message) ui.notify(message);
}

async function editTile(action) {
  if (!action || editPending) return;
  const rewards = action.amount > 0 ? new Inventory(game.inventory) : null;
  const missing = rewards && [
    [action.item, action.amount], ['door', action.supportedDoor ? 1 : 0], ['kelp', action.supportedKelp?.amount ?? 0],
  ].find(([item, amount]) => amount > 0 && !rewards.add(item, amount));
  if (missing) {
    input.stopMining();
    ui.notify('No room for more ' + ITEMS[missing[0]].name.toLowerCase() + '.');
    return;
  }
  if (!room || action.fixtureId) commitTileAction(game, action);
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
  ui.close('backpack-panel');
  ui.close('craft-panel');
  ui.close('items-panel');
  ui.close('spawn-panel');
  ui.close('drops-panel');
  craftingBench = undefined;
  input.clear();
  input.pointer.active = false;
  miningSwing = null;
  ui.godMode(false);
  particles.length = 0;
  screenShake.clear();
  select(0);
  resetSwimFraming();
  updateCamera(0, true);
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
  weatherModeIndex = 0;
  ui.setWeather(WEATHER_MODES[0].label);
  switchView();
  game.dirty = true;
  storeProgress();
  ui.close('pause-panel');
  ui.clearNotice();
  if (game.dirty) ui.notify('World reset for this session. The browser could not save it.');
}

const ui = createUI({
  beforePanel(id, source) {
    input.clear();
    if (id === 'craft-panel') {
      craftingBench = source;
      ui.updateCraft(game, craftingStation());
    }
    if (id === 'backpack-panel') {
      ui.updateBackpack(game);
      ui.select(selected);
    }
    if (id === 'customize-panel') ui.updateCustomize(game);
    storeProgress();
  },
  select, enterRoom, leaveRoom, copyRoom, restart, inventoryChanged,
  zoomBy(delta) {
    zoomIndex = clamp(zoomIndex + delta, 0, zoomLevels.length - 1);
    updateViewport();
    ui.setZoom(zoomLevels[zoomIndex], zoomIndex === 0, zoomIndex === zoomLevels.length - 1);
  },
  hideCaveShadows: (hidden) => { caveShadowsHidden = hidden; },
  toggleGodMode() {
    const flying = toggleGodMode(game.world, game.player);
    ui.godMode(flying);
    if (flying) {
      ui.notify('Fly with WASD, arrow keys, or touch controls.');
    } else {
      game.dirty = true;
      storeProgress();
      ui.clearNotice();
    }
  },
  adjustFlightSpeed(step) {
    if (!game.player.flightOrigin) return;
    const last = flightSpeedLevels.length - 1;
    flightSpeedIndex = clamp(flightSpeedIndex + step, 0, last);
    ui.setFlightSpeed(flightSpeedLevels[flightSpeedIndex], flightSpeedIndex === 0, flightSpeedIndex === last);
  },
  adjustWeather(step) {
    weatherModeIndex = (weatherModeIndex + step + WEATHER_MODES.length) % WEATHER_MODES.length;
    const mode = WEATHER_MODES[weatherModeIndex];
    ui.setWeather(mode.label);
    ui.notify('Weather: ' + mode.label + (mode.id === 'auto' ? ' (natural cycle)' : ''));
  },
  getInventory: () => game.inventory,
  getChest: (id) => game.chests.get(id),
  canMoveInventory: () => !editPending,
  moveInventoryStack: (id, from, to) => moveInventoryStack(game, id, from, to),
  collectChest: (id) => collectChest(game, id),
  getSnorkel: () => equippedSnorkel(game),
  getFeet: () => equippedFeet(game),
  getRing: () => equippedRing(game),
  getHands: () => equippedHook(game),
  getAddon: (slot) => equippedAddon(game, slot),
  customize(appearance) {
    game.player.appearance = appearance;
    game.dirty = true;
    storeProgress();
    if (game.dirty) ui.notify('Appearance updated for this session. The browser could not save it.');
  },
  spawnEnemy(kind) {
    if (editPending) return 'Wait for the terrain edit to finish.';
    const result = spawnEnemyNear(game.world, game.player, kind);
    return result.error;
  },
  giveItem(id, amount) {
    if (editPending) return 'Wait for the terrain edit to finish.';
    if (!grantItem(game, id, amount)) return 'No room in your inventory.';
    inventoryChanged();
  },
  makeItem(recipe) {
    if (editPending || !craftItem(game, recipe, craftingStation())) return false;
    inventoryChanged();
    return true;
  },
}, version);

const input = bindInput(canvas, camera, {
  blocked: ui.activePanel,
  chestOpen: ui.openChestId,
  interact() {
    if (editPending) return;
    const item = nearestItem(game);
    if (item?.kind === WORKBENCH.id) ui.open('craft-panel', item);
    else if (item?.kind === 'mimic') {
      if (wakeMimic(game.world, item.mob, game.player, game.effects)) {
        for (const effect of game.effects) emitEffect(effect);
        game.effects.length = 0;
      }
    } else if (item) ui.open('backpack-panel', item);
    else this.useHook();
  },
  useHook() {
    if (editPending) return;
    const { pointer } = input;
    const shot = pointer.active
      ? useGrapplingHook(game, pointer.x + camera.x, pointer.y + camera.y)
      : useGrapplingHook(game);
    if (shot) game.dirty = true;
  },
  interactAtPointer() {
    const { pointer } = input;
    const chest = chestAt(game, pointer.x + camera.x, pointer.y + camera.y);
    if (!chest) return false;
    if (chest.kind === 'mimic') {
      if (editPending) return true;
      if (wakeMimic(game.world, chest.mob, game.player, game.effects)) {
        for (const effect of game.effects) emitEffect(effect);
        game.effects.length = 0;
      }
      return !ITEMS[game.inventory.hotbar[selected]?.id]?.weapon;
    }
    if (!editPending) ui.open('backpack-panel', chest);
    return true;
  },
  castRing() {
    if (editPending) return;
    const cast = useRootRing(game);
    if (cast) storeProgress();
  },
  fend() {
    if (editPending || playerImmobilized(game.player)) return false;
    const { pointer } = input;
    const wx = pointer.x + camera.x;
    const wy = pointer.y + camera.y;
    if (game.inventory.hotbar[selected]?.id === 'explorers-map') return true;
    const utility = useUtilityItem(game, selected, aimedTile());
    if (utility) {
      if (utility.inventoryChanged) inventoryChanged();
      ui.notify(utility.message);
      return true;
    }
    const dressing = useDressing(game, selected);
    if (dressing) {
      if (dressing.inventoryChanged) inventoryChanged();
      ui.notify(dressing.message);
      return true;
    }
    if (!aimedMob()) {
      const next = mineAtPointer(null, 0);
      if (next) {
        if (!next.blocked && !miningSwing && !game.attack) {
          mining = next;
          startMiningSwing(next);
        }
        return false;
      }
    }
    if (miningSwing) return true;
    const result = useWeapon(game, selected, wx, wy);
    if (result.inventoryChanged) inventoryChanged();
    if (result.message) ui.notify(result.message);
    return result.handled;
  },
  place() {
    const target = aimedTile();
    if (!target || editPending) return;
    const bench = workbenchAt(game, target.tx, target.ty);
    if (bench) ui.open('craft-panel', bench);
    else void editTile(planTileAction(game, target, true, selected));
  },
  stopMining: () => { mining = null; },
  select,
  craft: () => ui.open('craft-panel'),
  backpack: () => ui.open('backpack-panel'),
  character: () => ui.open('customize-panel'),
  pause: () => ui.open('pause-panel'),
});

function resetSwimFraming() {
  camera.swimSeconds = 0;
  camera.swimBlend = 0;
}

function updateCamera(dt, snap = false) {
  const { player, world } = game;
  const horizontalAnchor = camera.width / camera.height < 0.8 ? 0.36 : 0.42;
  const x = clamp(player.x - camera.width * horizontalAnchor, 0, Math.max(0, COLS * TILE - camera.width));
  const swimming = !player.flightOrigin && !player.climb && playerInWater(world, player);
  const transitionDelay = 2;
  const transitionDuration = 1.5;
  // Count consecutive time in the water as positive and consecutive time out as negative.
  camera.swimSeconds = swimming
    ? Math.min(transitionDelay, Math.max(0, camera.swimSeconds) + dt)
    : Math.max(-transitionDelay, Math.min(0, camera.swimSeconds) - dt);
  if (Math.abs(camera.swimSeconds) >= transitionDelay) {
    const direction = swimming ? 1 : -1;
    camera.swimBlend = clamp(camera.swimBlend + direction * dt / transitionDuration, 0, 1);
  }
  const standingY = player.y + player.height - PLAYER_SIZE.height;
  const centeredY = standingY + PLAYER_SIZE.height / 2 - camera.height / 2;
  const underwaterY = standingY - camera.height * 0.28;
  const targetY = centeredY + (underwaterY - centeredY) * camera.swimBlend;
  const y = clamp(targetY, 0, Math.max(0, ROWS * TILE - camera.height));
  const factor = snap || reducedMotion ? 1 : Math.min(1, dt * 5);
  camera.x += (x - camera.x) * factor;
  camera.y += (y - camera.y) * factor;
}

function resize() {
  const ratio = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  canvas.height = ratio < 0.8 ? 420 : ratio > 2.1 ? 330 : 380;
  canvas.width = Math.max(1, Math.round(canvas.height * ratio));
  updateViewport();
}

function updateViewport() {
  const zoom = zoomLevels[zoomIndex] / 100;
  camera.width = canvas.width / zoom;
  camera.height = canvas.height / zoom;
  input.pointer.active = false;
  input.stopMining();
  updateCamera(0, true);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
    else {
      particle.x += particle.dx * dt;
      particle.y += particle.dy * dt;
      if (particle.bubbleRadius) {
        if (!inWater(game.world, particle.x, particle.y)) particles.splice(i, 1);
      } else particle.dy += 42 * dt;
    }
  }
}

function updateDrowningWarning(dt) {
  const { player, world } = game;
  const urgency = !player.flightOrigin && playerHeadInWater(world, player)
    ? clamp(1 - player.oxygen / drowningWarningSeconds, 0, 1)
    : 0;
  drowning += (urgency - drowning) * Math.min(1, dt * 8);
  if (!urgency) {
    if (drowning < 0.005) drowning = 0;
    nextBreathBubble = 0;
    return;
  }
  if (time < nextBreathBubble) return;
  nextBreathBubble = time + 0.85 - urgency * 0.4;

  const count = reducedMotion ? 1 : 3;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: player.x + player.facing * (4 + i), y: player.y + 7 + i,
      dx: player.facing * (5 + i * 5), dy: -20 - i * 7,
      life: 0.55 + i * 0.15, bubbleRadius: i === 1 ? 3 : 2,
    });
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
  if (craftingBench && ui.activePanel() === 'craft-panel' && !craftingStation()) {
    ui.close('craft-panel');
    craftingBench = undefined;
  }
  const playing = !document.hidden && !ui.activePanel() && !arrival?.active;
  if (playing && !room) {
    game.worldTime += elapsed;
    game.dirty = true;
  }
  const worldTime = room?.worldAge(now) ?? game.worldTime;
  const conditions = worldConditions(worldTime, game.weatherSeed, WEATHER_MODES[weatherModeIndex].id);
  let shake = { x: 0, y: 0 };
  if (playing) {
    time += dt;
    accumulator += dt;
    while (accumulator >= timestep) {
      const previousPlayer = game.player;
      const note = stepGame(game, {
        ...input.sample(),
        mining: input.holdingMine(),
        night: conditions.night,
        flightSpeedMultiplier: flightSpeedLevels[flightSpeedIndex],
      }, timestep);
      for (const effect of game.effects) emitEffect(effect);
      game.effects.length = 0;
      if (game.player !== previousPlayer) {
        input.stopMining();
        miningSwing = null;
        resetSwimFraming();
      }
      if (note) showAndSave(note);
      accumulator -= timestep;
    }
    updateParticles(dt);
    updateDrowningWarning(dt);
    updateCamera(dt);
    shake = screenShake.step(dt, time, reducedMotion);
    if (miningSwing) {
      miningSwing.phase += dt / miningSwing.duration;
      if (miningSwing.phase >= 1) miningSwing = null;
    }
    const heldItem = game.inventory.hotbar[selected]?.id;
    if (playerImmobilized(game.player)) {
      input.stopMining();
      miningSwing = null;
    } else if (game.attack) {
      mining = null;
    } else if (input.holdingMine() && !editPending && heldItem !== 'explorers-map') {
      if (aimedMob()) {
        mining = null;
        if (!miningSwing && !ITEMS[heldItem]?.weapon) useWeapon(game, selected, input.pointer.x + camera.x, input.pointer.y + camera.y);
      } else if (mining || !miningSwing) {
        mining = mineAtPointer(mining, dt);
        if (mining?.blocked) {
          ui.notify(mining.blocked);
          input.stopMining();
        } else if (mining) {
          if (!miningSwing) startMiningSwing(mining);
          if (mining.progress >= 1) {
            void editTile(mining.action);
            mining = null;
          }
        }
      }
    }
  }
  ui.update(game, conditions);
  const snorkel = equippedSnorkel(game)?.id ?? null;
  const held = game.inventory.hotbar[selected]?.id;
  const peers = room?.tick(now, dt, game.player, snorkel);
  const targetMob = aimedMob();
  renderer.draw({
    world: game.world, player: game.player, snorkel, ring: Boolean(equippedRing(game)), camera, time: reducedMotion ? 0 : time, elapsed: game.elapsed,
    aim: targetMob ? null : aimedTile(), mining, miningSwing, held, attack: game.attack,
    hasArrow: game.inventory.count(ARROW.id) > 0, playerArrows: game.projectiles, rootWave: game.rootWave, hook: game.player.hook,
    targetMob, particles, peers, reducedMotion, conditions, worldTime, weatherSeed: game.weatherSeed,
    caveShadowsHidden, openChestId: ui.openChestId(), shake, drowning,
  });
  arrival?.reveal();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
