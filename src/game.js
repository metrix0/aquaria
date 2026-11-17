import { COLS, ROWS, TILE, WATER, MATERIAL, SPAWN, SLOT_NAMES, SLOT_MATERIAL, clamp, createWorld, editTile, tileAt, zoneAt } from './world.js';
import { createRenderer } from './render.js';
import { version } from './version.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('scene');
const renderer = createRenderer(canvas);
const craftPanel = byId('craft-panel');
const pausePanel = byId('pause-panel');
const slots = Array.from(document.querySelectorAll('.slot'));
const saveKey = 'aquaria.save';
const saveFormat = 1;
const playerSize = { width: 12, height: 23 };
const keys = new Set();
const pointer = { x: 0, y: 0, active: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const moveKeys = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
const drops = { [MATERIAL.sand]: 'sand', [MATERIAL.stone]: 'stone', [MATERIAL.soil]: 'sand', [MATERIAL.reef]: 'stone', [MATERIAL.scrap]: 'scrap', [MATERIAL.wood]: 'wood' };
const prompts = { scrap: 'Collect salvage', kelp: 'Harvest kelp', cache: 'Open wreck cache' };

let world;
let player;
let inventory;
let tank;
let completed;
let selected = 0;
let placing = false;
let dirty = false;
let toastTimer;
let focusedItem;
let time = 0;
let jumpRequested = false;

const camera = { x: 0, y: 0, width: 0, height: 0 };
const particles = [];

function spawn() {
  let y = SPAWN.y;
  while (y > 0 && collides(SPAWN.x, y)) y = Math.max(0, y - TILE);
  return { x: SPAWN.x, y, ...playerSize, dx: 0, dy: 0, grounded: false, facing: 1, oxygen: tank ? 42 : 18 };
}

function load() {
  world = createWorld();
  tank = false;
  completed = false;
  inventory = { sand: 0, stone: 0, wood: 3, scrap: 0, kelp: 0 };
  player = spawn();

  try {
    const state = JSON.parse(localStorage.getItem(saveKey));
    if (state?.format !== saveFormat) return;
    tank = state.tank === true;
    completed = state.completed === true;
    for (const key of Object.keys(inventory)) {
      if (Number.isSafeInteger(state.inventory?.[key]) && state.inventory[key] >= 0) inventory[key] = state.inventory[key];
    }
    for (const [index, material] of state.edits ?? []) {
      if (Number.isInteger(index) && index >= 0 && index < COLS * (ROWS - 2) && Number.isInteger(material) && material >= 0 && material <= MATERIAL.soil && material !== MATERIAL.bedrock) {
        editTile(world, index % COLS, Math.floor(index / COLS), material);
      }
    }
    const validItems = new Set(world.items.map(({ id }) => id));
    world.harvested = new Set((state.harvested ?? []).filter((id) => validItems.has(id)));
    player = spawn();
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      const x = clamp(state.x, player.width, COLS * TILE - player.width);
      const y = clamp(state.y, 0, ROWS * TILE - player.height);
      if (!collides(x, y)) Object.assign(player, { x, y });
    }
    if (Number.isFinite(state.oxygen)) player.oxygen = clamp(state.oxygen, 1, tank ? 42 : 18);
  } catch {
    // An invalid or unavailable save should never prevent a new game.
  }
}

function save() {
  if (!dirty) return;
  try {
    localStorage.setItem(saveKey, JSON.stringify({
      format: saveFormat, x: player.x, y: player.y, oxygen: player.oxygen, tank, completed, inventory,
      edits: Array.from(world.edits), harvested: Array.from(world.harvested),
    }));
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

function step(dt) {
  const left = pressed('KeyA', 'ArrowLeft');
  const right = pressed('KeyD', 'ArrowRight');
  const up = pressed('Space', 'KeyW', 'ArrowUp');
  const down = pressed('KeyS', 'ArrowDown');
  const bodyInWater = player.y + player.height * 0.65 > WATER;
  const maxOxygen = tank ? 42 : 18;
  const horizontal = Number(right) - Number(left);

  if (horizontal) player.facing = horizontal;
  player.dx += (horizontal * (bodyInWater ? 102 : 112) - player.dx) * Math.min(1, dt * (bodyInWater ? 5 : 13));
  if (bodyInWater) {
    const vertical = Number(down) - Number(up);
    player.dy += ((vertical ? vertical * 94 : 10) - player.dy) * Math.min(1, 7 * dt);
  } else {
    if (jumpRequested && player.grounded) player.dy = -217;
    player.dy = Math.min(player.dy + 510 * dt, 245);
  }
  jumpRequested = false;

  if (moveAxis('x', player.dx * dt)) player.dx = 0;
  const falling = player.dy >= 0;
  const yCollision = moveAxis('y', player.dy * dt);
  player.grounded = yCollision && falling;
  if (yCollision) player.dy = 0;
  if (player.y < 0) player.y = 0;

  if (player.y + 5 > WATER) {
    player.oxygen = Math.max(0, player.oxygen - dt);
    if (player.oxygen === 0) {
      player = spawn();
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

function tileAction(build) {
  const target = aim();
  if (!target?.reachable) return;
  const { tx, ty } = target;
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  const material = tileAt(world, tx, ty);
  if (build) {
    const block = SLOT_MATERIAL[selected];
    if (!block || material || !inventory[drops[block]]) return;
    const touches = tileAt(world, tx - 1, ty) || tileAt(world, tx + 1, ty) || tileAt(world, tx, ty - 1) || tileAt(world, tx, ty + 1);
    if (!touches || world.items.some((item) => !world.harvested.has(item.id) && Math.floor(item.x / TILE) === tx && Math.floor(item.y / TILE) === ty)) return;
    editTile(world, tx, ty, block);
    if (collides(player.x, player.y)) {
      editTile(world, tx, ty, MATERIAL.air);
      return;
    }
    inventory[drops[block]]--;
  } else {
    const drop = drops[material];
    if (!drop) return;
    editTile(world, tx, ty, MATERIAL.air);
    inventory[drop]++;
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: tx * TILE + 8, y: ty * TILE + 8, dx: (Math.random() - 0.5) * 55,
        dy: Math.random() * -44, life: 0.25 + Math.random() * 0.35, material,
      });
    }
  }
  dirty = true;
  save();
}

function interact() {
  const item = nearestItem();
  if (!item) return;
  if (item.kind === 'cache') {
    if (!tank) {
      notify('Craft an air tank before opening the wreck cache.');
      return;
    }
    completed = true;
    inventory.wood += 8;
    notify('Wreck cache recovered. +8 driftwood');
  } else {
    inventory[item.kind] += item.amount;
    notify('+' + item.amount + ' ' + item.kind);
  }
  world.harvested.add(item.id);
  focusedItem = nearestItem();
  dirty = true;
  save();
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
  byId('selected').textContent = SLOT_NAMES[slot];
  for (const [index, element] of slots.entries()) element.setAttribute('aria-pressed', String(slot === index));
}

function openPanel(panel) {
  const other = panel === craftPanel ? pausePanel : craftPanel;
  if (other.open) other.close();
  if (panel.open) {
    panel.close();
    return;
  }
  keys.clear();
  jumpRequested = false;
  if (panel === craftPanel) updateCraft();
  save();
  panel.showModal();
}

function updateCraft() {
  const button = byId('make-tank');
  button.disabled = tank || inventory.scrap < 3 || inventory.kelp < 2;
  button.textContent = tank ? 'Equipped' : 'Craft air tank';
  byId('recipe-cost').textContent = tank ? 'Air tank equipped' : '3 scrap · 2 kelp';
}

function setText(id, value) {
  const element = byId(id);
  if (element.textContent !== value) element.textContent = value;
}

function updateHud() {
  const depth = Math.max(0, Math.floor((player.y + 5 - WATER) / TILE));
  const air = Math.round(player.oxygen / (tank ? 42 : 18) * 100);
  const airValue = air + '%';
  setText('zone', zoneAt(player.x, player.y + 5));
  setText('depth', depth + ' m');
  setText('air-label', airValue);
  const fill = byId('air-fill');
  if (fill.style.width !== airValue) {
    fill.style.width = airValue;
    fill.classList.toggle('low', air <= 25);
    fill.parentElement.setAttribute('aria-valuenow', String(air));
  }
  for (const name of ['sand', 'stone', 'wood']) setText(name + '-count', String(inventory[name]));
  setText('objective-title', completed ? 'Beyond the wreck' : tank ? 'Into the channel' : 'Ashore');
  setText('objective-text', completed ? 'The wreck cache is secure. Explore the caves beneath the reef.' : tank ? 'Follow the reef east and recover the cache from the wreck.' : 'The wreck drifted into the reef. Salvage enough to craft an air tank.');
  byId('requirements').hidden = tank;
  if (!tank) {
    setText('scrap-goal', Math.min(inventory.scrap, 3) + ' / 3 scrap');
    setText('kelp-goal', Math.min(inventory.kelp, 2) + ' / 2 kelp');
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
  updateCamera(1);
}

function locatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * camera.width;
  pointer.y = (event.clientY - rect.top) / rect.height * camera.height;
  pointer.active = true;
}

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (code === 'KeyC' && !event.repeat) {
    event.preventDefault();
    openPanel(craftPanel);
    return;
  }
  if (code === 'Escape' && !craftPanel.open && !pausePanel.open && !event.repeat) {
    event.preventDefault();
    openPanel(pausePanel);
    return;
  }
  if (craftPanel.open || pausePanel.open) return;
  if (event.target instanceof HTMLButtonElement && code === 'Space') return;
  if (moveKeys.has(code)) {
    event.preventDefault();
    if (!event.repeat && ['Space', 'KeyW', 'ArrowUp'].includes(code)) jumpRequested = true;
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
  save();
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('resize', resize);

canvas.addEventListener('pointermove', locatePointer);
canvas.addEventListener('pointerleave', () => { pointer.active = false; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
  locatePointer(event);
  tileAction(event.button === 2 || (event.pointerType === 'touch' && placing));
  if (event.pointerType === 'touch') pointer.active = false;
});

for (const [index, slot] of slots.entries()) {
  slot.addEventListener('click', (event) => {
    select(index);
    if (event.detail) slot.blur();
  });
}
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
  placing = !placing;
  event.currentTarget.textContent = placing ? 'Build' : 'Mine';
  event.currentTarget.setAttribute('aria-pressed', String(placing));
});
byId('craft').addEventListener('click', () => openPanel(craftPanel));
byId('pause').addEventListener('click', () => openPanel(pausePanel));
byId('resume').addEventListener('click', () => pausePanel.close());
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
byId('restart').addEventListener('click', () => {
  if (!confirm('Start a new game and erase the save in this browser?')) return;
  try { localStorage.removeItem(saveKey); } catch {}
  load();
  select(0);
  focusedItem = null;
  particles.length = 0;
  pausePanel.close();
  updateCamera(1);
  dirty = true;
  save();
});
byId('make-tank').addEventListener('click', () => {
  if (tank || inventory.scrap < 3 || inventory.kelp < 2) return;
  inventory.scrap -= 3;
  inventory.kelp -= 2;
  tank = true;
  player.oxygen = Math.min(42, player.oxygen + 24);
  dirty = true;
  save();
  craftPanel.close();
  notify('Air tank equipped.');
});

byId('version').textContent = 'v' + version;
load();
resize();
setInterval(save, 4000);

let last = performance.now();
let accumulator = 0;
const timestep = 1 / 60;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!craftPanel.open && !pausePanel.open) {
    time += dt;
    accumulator += dt;
    while (accumulator >= timestep) {
      step(timestep);
      accumulator -= timestep;
    }
    updateCamera(dt);
  }
  updateHud();
  renderer.draw({ world, player, tank, camera, time: reducedMotion ? 0 : time, aim: aim(), particles });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
