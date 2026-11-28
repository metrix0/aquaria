import { skyCamera } from './sky-camera.js';
import { nearestDowned } from './gameplay/revival.js';
import { cycleCoralMark } from './world/ocean-layout.js';
import { Inventory, ITEMS, WOODEN_SHIELD } from './inventory.js';
import { activateClass, unlockSkill as purchaseSkill, absorbSouls, grantDebugSouls, equipSkill, equippedSkill } from './classes.js';
import { ARROW, BOW, FIREPLACE, CAULDRON, MORNINGSTAR, POISON_ARROW, WORKBENCH } from './content.js';
import { useRootRing } from './gameplay/root-ring.js';
import { equippedHook, useGrapplingHook } from './gameplay/hook.js';
import { wakeMimic } from './gameplay/enemies/mimic.js';
import { targetMobAt } from './gameplay/mobs.js';
import { spawnEnemyNear } from './gameplay/enemy-spawner.js';
import { createScreenShake } from './gameplay/screen-shake.js';
import { CRAWL_HEIGHT, PLAYER_SIZE, playerHeadInWater, playerImmobilized, playerInWater, toggleGodMode } from './gameplay/player.js';
import { config } from './config.js';
import { WEATHER_MODES, worldConditions } from './environment.js';
import { beginBowDraw, aimBow, releaseBowDraw, beginMorningstarSwing, aimMorningstar, releaseMorningstar, advanceMining, applyTerrain, awardTileAction, chestAt, collectChest, commitTileAction, beginClassStatueAwakening, advanceClassStatueAwakening, craftItem, cauldronAt, createGame, equippedFeet, equippedRing, equippedSnorkel, equippedAddon, fireplaceAt, grantItem, moveInventoryStack, nearestItem, planTileAction, resetRoomProgress, stepGame, targetTile, templeDoorAt, transitionZone, useDressing, useFood, useUtilityItem, useWeapon, workbenchAt } from './gameplay/simulation.js';
import { bindInput } from './input.js';
import { TELEPORT_DESTINATIONS, teleportPlayer } from './gameplay/teleport.js';
import { useScholarSkill, receiveFeasts } from './gameplay/scholar.js';
import { receiveMends } from './gameplay/spell-combat.js';
import { useWayfarerSkill } from './gameplay/wayfarer.js';
import { useWardenSkill, updateWardenAllies, wardenAttackBlocked } from './gameplay/warden.js';
import { connectRoom, roomCode } from './multiplayer/client.js';
import { createRenderer } from './render.js';
import { createPerformanceStats } from './performance-stats.js';
import { createBrowserSave } from './save.js';
import { consumeNewGame, createIslandReveal } from './start-flow.js';
import { createUI } from './ui.js';
import { createZoneTitle, createZoneTracker } from './zone-title.js';
import { zoneAt } from './world/zones.js';
import { version } from './build-info.js';
import { inWater, worldCols, worldRows } from './world.js';
import { OVERWORLD_ZONE, WATER_TEMPLE_ZONE } from './world/water-temple-interior.js';
import { TILE, clamp } from './world/generation.js';

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const soloSave = createBrowserSave();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const newAppearance = consumeNewGame();
const arrival = newAppearance ? createIslandReveal(reducedMotion) : null;
const available = Boolean(config.url && config.publishableKey);
const camera = { x: 0, y: 0, width: 1, height: 1, swimSeconds: 0, swimBlend: 0, crawlSeconds: 0 };
const particles = [];
const drowningWarningSeconds = 5;
const screenShake = createScreenShake();
const zoomLevels = [3, 6, 12.5, 25, 50, 75, 100, 125, 150, 200];
const flightSpeedLevels = [0.5, 1, 2, 4, 8, 16];
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
  if (selected !== slot) { game.bowDraw = null; game.morningstarDraw = null; }
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
  if (!craftingBench) return;
  if (craftingBench.kind === WORKBENCH.id && workbenchAt(game, craftingBench.tx, craftingBench.ty)) return WORKBENCH.id;
  if (craftingBench.kind === CAULDRON.id && cauldronAt(game,craftingBench.tx,craftingBench.ty)) return CAULDRON.id;
  if (craftingBench.kind === FIREPLACE.id && fireplaceAt(game, craftingBench.tx, craftingBench.ty)) return FIREPLACE.id;
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
    ['wood', action.supportedTree ? Math.round(action.supportedTree.height / TILE) : 0],
    ['seed', action.seedAmount ?? 0],
    ['tent', action.supportedTent ? 1 : 0],
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
  if (action.message) ui.notify(action.message);
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
  ui.close('teleport-panel');
  ui.close('drops-panel');
  craftingBench = undefined;
  input.clear();
  input.pointer.active = false;
  miningSwing = null;
  ui.godMode(false);
  particles.length = 0;
  screenShake.clear();
  select(0);
  resetCameraFraming();
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
  getGame: () => game,
  chooseClass(id) {
    const error = activateClass(game, id);
    if (!error) storeProgress();
    return error;
  },
  unlockSkill(id) {
    const error = purchaseSkill(game, id);
    if (!error) storeProgress();
    return error;
  },
  equipSkill(slot, id) {
    const error = equipSkill(game, slot, id);
    if (!error) storeProgress();
    return error;
  },
  grantDebugSouls() {
    grantDebugSouls(game);
    storeProgress();
    ui.notify("Lesser and Greater Souls refilled.");
  },
  absorbSoul(type, quantity) {
    const error = absorbSouls(game, type, quantity);
    if (!error) inventoryChanged();
    return error;
  },
  zoomBy,
  hideCaveShadows: (hidden) => { caveShadowsHidden = hidden; },
  toggleGodMode: toggleGodModeState,
  emitEmoji,
  dance: toggleDance,
  adjustFlightSpeed,
  teleportMenu,
  teleportTo,
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
  getOffhand: () => equippedHook(game) ?? (game.progress.offhand === WOODEN_SHIELD.id ? WOODEN_SHIELD : null),
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
    if (recipe.equipment && game.player.perfectArmor) ui.notify('Perfect Armor forged! +5% protection.');
    return true;
  },
}, version);

const input = bindInput(canvas, camera, {
  blocked: ui.activePanel,
  chestOpen: ui.openChestId,
  interact() {
    if (editPending || game.player.downed || game.world.statueAwakening || nearestDowned(game.player, game.wayfarerPeers)) return;
    const item = nearestItem(game);
    if (item?.kind === 'class-statue') {
      if (beginClassStatueAwakening(game, item)) { input.clear(); input.stopMining(); }
      return;
    }
    if (item?.kind === 'temple-door') {
      if (transitionZone(game, item.targetZone)) {
        input.stopMining();
        updateCamera(0, true);
      }
      return;
    }
    if (item?.kind === 'coral-dial') {
      if (cycleCoralMark(game.world, item.slot)) ui.notify('The ancient marks align. The coral wall opens!');
      game.dirty = true;
    }
    else if (item?.kind === WORKBENCH.id || item?.kind === FIREPLACE.id || item?.kind === CAULDRON.id) ui.open('craft-panel', item);
    else if (item?.kind === 'mimic') {
      if (wakeMimic(game.world, item.mob, game.player, game.effects)) {
        for (const effect of game.effects) {
        emitEffect(effect);
        if (effect.inventoryChanged) inventoryChanged();
      }
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
    if (game.player.downed || game.world.statueAwakening) return true;
    const { pointer } = input;
    const worldX = pointer.x + camera.x;
    const worldY = pointer.y + camera.y;
    const statue = game.world.items.find(item => {
      if (item.kind !== 'class-statue' || !item.bounds) return false;
      const b = item.bounds;
      return worldX >= b.x && worldX <= b.x + b.width && worldY >= b.y && worldY <= b.y + b.height;
    });
    if (statue && !editPending && beginClassStatueAwakening(game, statue)) {
      input.clear(); input.stopMining(); return true;
    }
    const door = templeDoorAt(game, worldX, worldY);
    if (door) {
      if (!editPending && transitionZone(game, door.targetZone)) {
        input.stopMining();
        updateCamera(0, true);
      }
      return true;
    }
    const chest = chestAt(game, worldX, worldY);
    if (!chest) return false;
    if (chest.kind === 'mimic') {
      if (editPending) return true;
      if (wakeMimic(game.world, chest.mob, game.player, game.effects)) {
        for (const effect of game.effects) {
        emitEffect(effect);
        if (effect.inventoryChanged) inventoryChanged();
      }
        game.effects.length = 0;
      }
      return !ITEMS[game.inventory.hotbar[selected]?.id]?.weapon;
    }
    if (!editPending) ui.open('backpack-panel', chest);
    return true;
  },
  castSkill(slot) {
    if (game.player.downed || editPending) return;
    const skill = equippedSkill(game.classes, slot);
    if (!skill) return;
    const resolved = skill.ability;
    const pointer = input.pointer;
    const wayfarer = game.classes.active === 'wayfarer';
    const error = wayfarer
      ? useWayfarerSkill(game, resolved, selected, pointer.active ? pointer.x+camera.x : game.player.x+game.player.facing*100, pointer.active ? pointer.y+camera.y : game.player.y+game.player.height/2, camera)
      : game.classes.active === 'scholar' ? useScholarSkill(game,resolved,pointer.active ? pointer.x+camera.x : game.player.x+game.player.facing*100,pointer.active ? pointer.y+camera.y : game.player.y+game.player.height/2,camera)
      : useWardenSkill(game, resolved);
    if (!error && wayfarer) inventoryChanged();
    if (error) ui.notify(error);
    else input.stopMining();
  },
  castRing() {
    if (editPending || wardenAttackBlocked(game.player)) return;
    const { pointer } = input;
    const cast = pointer.active
      ? useRootRing(game, pointer.x + camera.x, pointer.y + camera.y)
      : useRootRing(game);
    if (cast) storeProgress();
  },
  beginBow() {
    const weaponId = ITEMS[game.inventory.hotbar[selected]?.id]?.weapon?.id;
    if (weaponId !== BOW.id && weaponId !== MORNINGSTAR.id) return false;
    if (editPending || playerImmobilized(game.player)) return true;
    const {pointer} = input;
    const result = weaponId === MORNINGSTAR.id
      ? beginMorningstarSwing(game, selected, pointer.x + camera.x, pointer.y + camera.y)
      : beginBowDraw(game, selected, pointer.x + camera.x, pointer.y + camera.y);
    if (result?.message) ui.notify(result.message);
    return true;
  },
  releaseBow() {
    if (ui.activePanel() || document.hidden) { game.bowDraw = null; game.morningstarDraw = null; return; }
    const {pointer} = input;
    if (game.morningstarDraw) {
      aimMorningstar(game, pointer.x + camera.x, pointer.y + camera.y);
      const result = releaseMorningstar(game);
      if (result?.message) ui.notify(result.message);
      return;
    }
    aimBow(game,pointer.x+camera.x,pointer.y+camera.y);
    const result=releaseBowDraw(game);
    if (result?.inventoryChanged) inventoryChanged();
    if (result?.message) ui.notify(result.message);
  },
  cancelBow: () => { game.bowDraw = null; game.morningstarDraw = null; },
  fend() {
    if (wardenAttackBlocked(game.player) || game.player.counterTime > 0) return true;
    if (editPending || playerImmobilized(game.player)) return false;
    const { pointer } = input;
    const wx = pointer.x + camera.x;
    const wy = pointer.y + camera.y;
    if (game.inventory.hotbar[selected]?.id === 'explorers-map') return true;
    if (ITEMS[game.inventory.hotbar[selected]?.id]?.spell) {
      const result = useWeapon(game, selected, wx, wy);
      if (result.inventoryChanged) inventoryChanged();
      if (result.message) ui.notify(result.message);
      return true;
    }
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
    const food = useFood(game, selected);
    if (food) {
      if (food.inventoryChanged) inventoryChanged();
      ui.notify(food.message);
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
    if (editPending || game.player.downed) return;
    const target = aimedTile();
    if (!target) return;
    const bench = workbenchAt(game, target.tx, target.ty) ?? fireplaceAt(game, target.tx, target.ty) ?? cauldronAt(game,target.tx,target.ty);
    if (bench) ui.open('craft-panel', bench);
    else void editTile(planTileAction(game, target, true, selected));
  },
  stopMining: () => { mining = null; },
  select,
  craft: () => { if (!game.player.downed) ui.open('craft-panel'); },
  backpack: () => { if (!game.player.downed) ui.open('backpack-panel'); },
  character: () => { if (!game.player.downed) ui.open('customize-panel'); },
  pause: () => { if (!game.player.downed) ui.open('pause-panel'); },
  toggleGodMode: toggleGodModeState,
  cycleFlightSpeed,
  zoomBy,
  teleportMenu,
  teleportTo,
  emotes: () => { if (!game.player.downed) ui.toggleEmotes(); },
  dance: toggleDance,
});

function teleportMenu() {
  if (game.player.downed || game.world.statueAwakening || editPending) return;
  ui.toggleEmotes(false);
  ui.open('teleport-panel');
}

function teleportTo(index) {
  if (editPending || ui.activePanel() !== 'teleport-panel') return;
  const destination = TELEPORT_DESTINATIONS[index];
  if (!destination) return;
  if (!teleportPlayer(game, destination.id)) {
    ui.notify('Teleport destination unavailable.');
    return;
  }
  ui.close('teleport-panel');
  input.clear();
  input.pointer.active = false;
  mining = null;
  miningSwing = null;
  particles.length = 0;
  screenShake.clear();
  ui.godMode(Boolean(game.player.flightOrigin));
  resetCameraFraming();
  updateCamera(0, true);
  storeProgress();
}

function zoomBy(delta) {
  zoomIndex = clamp(zoomIndex + delta, 0, zoomLevels.length - 1);
  updateViewport();
  ui.setZoom(zoomLevels[zoomIndex], zoomIndex === 0, zoomIndex === zoomLevels.length - 1);
}

function adjustFlightSpeed(step) {
  if (!game.player.flightOrigin) return;
  const last = flightSpeedLevels.length - 1;
  flightSpeedIndex = clamp(flightSpeedIndex + step, 0, last);
  ui.setFlightSpeed(flightSpeedLevels[flightSpeedIndex], flightSpeedIndex === 0, flightSpeedIndex === last);
}

function cycleFlightSpeed() {
  if (!game.player.flightOrigin) return;
  const last = flightSpeedLevels.length - 1;
  const next = flightSpeedIndex === last ? flightSpeedLevels.indexOf(1) : flightSpeedIndex + 1;
  adjustFlightSpeed(next - flightSpeedIndex);
}

function toggleGodModeState() {
  if (game.player.downed) return;
  const flying = toggleGodMode(game.world, game.player);
  ui.godMode(flying);
  if (flying) {
    ui.notify('Fly with WASD, arrow keys, or touch controls.');
  } else {
    game.dirty = true;
    storeProgress();
    ui.clearNotice();
  }
}

function emitEmoji(symbol) {
  if (!symbol || game.player.downed) return;
  game.player.emoji = { symbol, timer: 2.6, duration: 2.6 };
}

function toggleDance() {
  if (game.player.downed) return;
  game.player.dancing = (game.player.dancing ?? 0) > 0 ? 0 : 4.5;
  ui.dancing(game.player.dancing > 0);
}

function resetCameraFraming() {
  camera.swimSeconds = 0;
  camera.swimBlend = 0;
  camera.crawlSeconds = 0;
}

function updateCamera(dt, snap = false) {
  const { player, world } = game;
  const horizontalAnchor = camera.width / camera.height < 0.8 ? 0.36 : 0.42;
  const x = clamp(player.x - camera.width * horizontalAnchor, 0, Math.max(0, worldCols(world) * TILE - camera.width));
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
  const crawling = input.holdingDown() && player.grounded && player.height === CRAWL_HEIGHT &&
    !player.downed && !player.flightOrigin && !player.climb && !swimming;
  camera.crawlSeconds = crawling ? Math.min(1, camera.crawlSeconds + dt) : 0;
  const crawlOffset = camera.crawlSeconds >= 1 ? camera.height * 0.25 : 0;
  const targetY = centeredY + (underwaterY - centeredY) * camera.swimBlend + crawlOffset;
  const y = clamp(targetY, 0, Math.max(0, worldRows(world) * TILE - camera.height));
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
  const urgency = !player.downed && !player.flightOrigin && playerHeadInWater(world, player)
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

const performanceStats = createPerformanceStats(document.getElementById('performance-stats'));
document.addEventListener('visibilitychange', () => performanceStats.reset());
const zoneTitle = createZoneTitle(document.getElementById('game'));
let zoneGame = game;
let zoneTracker = createZoneTracker(zoneAt(game.player));
let last = performance.now();
let accumulator = 0;
const timestep = 1 / 60;
function frame(now) {
  const frameStart = performance.now();
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = Math.min(elapsed, 0.05);
  last = now;
  if (craftingBench && ui.activePanel() === 'craft-panel' && !craftingStation()) {
    ui.close('craft-panel');
    craftingBench = undefined;
  }
  if (!document.hidden && !ui.activePanel() && game.world.statueAwakening) {
    if (advanceClassStatueAwakening(game, dt, reducedMotion)) {
      input.clear();
      storeProgress();
      ui.open('skilltree-panel');
    }
  }
  const skyProgress = ui.updateSky(dt);
  const playing = !document.hidden && !game.world.statueAwakening && (game.player.downed || !ui.activePanel()) && !arrival?.active;
  if (playing && !room) {
    game.worldTime += elapsed;
    game.dirty = true;
  }
  const worldTime = room?.worldAge(now) ?? game.worldTime;
  const conditions = worldConditions(worldTime, game.weatherSeed, WEATHER_MODES[weatherModeIndex].id);
  let shake = { x: 0, y: 0 };
  if (!playing) {
    game.bowDraw = null;
    game.morningstarDraw = null;
    camera.crawlSeconds = 0;
  }
  if (playing) {
    if (game.bowDraw) aimBow(game,input.pointer.x+camera.x,input.pointer.y+camera.y);
    if (game.morningstarDraw) aimMorningstar(game,input.pointer.x+camera.x,input.pointer.y+camera.y);
    time += dt;
    accumulator += dt;
    while (accumulator >= timestep) {
      const previousPlayer = game.player;
      const note = stepGame(game, {
        ...input.sample(),
        multiplayer: Boolean(room),
        now,
        selectedSlot: selected,
        mining: input.holdingMine(),
        night: conditions.night,
        flightSpeedMultiplier: flightSpeedLevels[flightSpeedIndex],
        camera,
      }, timestep);
      for (const effect of game.effects) {
        emitEffect(effect);
        if (effect.inventoryChanged) inventoryChanged();
      }
      game.effects.length = 0;
      if (game.player.downed && !previousPlayer.wasDowned) {
        input.clear();
        miningSwing = null;
        game.player.wasDowned = true;
      }
      if (!game.player.downed) game.player.wasDowned = false;
      if (game.player !== previousPlayer) {
        input.stopMining();
        miningSwing = null;
        resetCameraFraming();
      }
      if (note) showAndSave(note);
      accumulator -= timestep;
    }
    updateParticles(dt);
    updateDrowningWarning(dt);
    updateCamera(dt);
    ui.dancing((game.player.dancing ?? 0) > 0);
    if (game.bowDraw) aimBow(game,input.pointer.x+camera.x,input.pointer.y+camera.y);
    if (game.morningstarDraw) aimMorningstar(game,input.pointer.x+camera.x,input.pointer.y+camera.y);
    shake = screenShake.step(dt, time, reducedMotion);
    if (miningSwing) {
      miningSwing.phase += dt / miningSwing.duration;
      if (miningSwing.phase >= 1) miningSwing = null;
    }
    const heldItem = game.inventory.hotbar[selected]?.id;
    if (playerImmobilized(game.player) || wardenAttackBlocked(game.player) || game.player.counterTime>0) {
      input.stopMining();
      miningSwing = null;
    } else if (game.attack) {
      mining = null;
    } else if (input.holdingMine() && !editPending && heldItem !== 'explorers-map') {
      if (ITEMS[heldItem]?.spell) {
        mining = null;
      } else if (aimedMob()) {
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
  const currentZoneLabel = () => (game.zone === WATER_TEMPLE_ZONE ? 'Water Temple' : zoneAt(game.player));
  if (zoneGame !== game) {
    zoneGame = game;
    zoneTitle.clear();
    zoneTracker = createZoneTracker(currentZoneLabel());
  }
  if (playing && !game.player.downed) {
    const enteredZone = zoneTracker.update(currentZoneLabel(), now);
    if (enteredZone) zoneTitle.show(enteredZone);
  }
  const activeZone = game.zone ?? OVERWORLD_ZONE;
  const snorkel = equippedSnorkel(game)?.id ?? null;
  const held = game.inventory.hotbar[selected]?.id;
  const allPeers = Array.from(room?.tick(now, dt, game.player, snorkel, null, held, activeZone) ?? []);
  const peers = allPeers.filter((peer) => (peer.zone ?? OVERWORLD_ZONE) === activeZone);
  const reviveTarget = room && playing && input.holdingInteract() ? nearestDowned(game.player, peers)?.downed.id : null;
  if (reviveTarget && room) {
    room.tick(now, 0, game.player, snorkel, reviveTarget, held, activeZone);
  }
  ui.update(game, conditions);
  game.wayfarerPeers = peers;
  game.localPeerId = room?.peerId ?? null;
  if (room) { receiveFeasts(game); receiveMends(game); }
  if (room && !game.player.downed) updateWardenAllies(game, peers.filter(peer => !peer.downed));
  else game.player.allyAegis = false;
  const targetMob = aimedMob();
  const drawStart = performance.now();
  renderer.draw({
    world: game.world, player: game.player, activeClass: game.classes.active, snorkel, ring: Boolean(equippedRing(game)), camera: skyCamera(camera, skyProgress), time: reducedMotion ? 0 : time, elapsed: game.elapsed,
    aim: targetMob ? null : aimedTile(), mining, miningSwing, held: ITEMS[held]?.weapon?.id ?? held, attack: game.bowDraw ? {kind:BOW.id,angle:game.bowDraw.angle,drawProgress:Math.min(1,game.bowDraw.elapsed/BOW.drawTime),extra:game.bowDraw.extra,charging:true} : game.morningstarDraw ? {kind:MORNINGSTAR.id,angle:game.morningstarDraw.angle,drawProgress:Math.min(1,game.morningstarDraw.elapsed/MORNINGSTAR.drawTime),elapsed:game.morningstarDraw.elapsed,charging:true} : game.attack,
    hasArrow: game.inventory.count(ARROW.id) > 0 || game.inventory.count(POISON_ARROW.id) > 0, playerArrows: game.projectiles, rootWave: game.rootWave, hook: game.player.hook,
    targetMob, particles, peers, reducedMotion, conditions, worldTime, weatherSeed: game.weatherSeed,
    caveShadowsHidden, chests: game.chests, openChestId: ui.openChestId(), shake, drowning,
  });
  const drawEnd = performance.now();
  arrival?.reveal();
  if (!document.hidden) performanceStats.sample(now, drawStart - frameStart, drawEnd - drawStart);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
