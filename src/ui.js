import { AIR_TANK, APPEARANCE, ITEM_PROMPTS, WOODEN_DOOR } from './content.js';
import { createInventoryUi } from './inventory-ui.js';
import { areaDepth, canCraftDoor, canCraftTank, nearestItem, oxygenCapacity } from './gameplay/simulation.js';

export function createUI(actions, version) {
  const byId = (id) => document.getElementById(id);
  const fields = Object.fromEntries([
    'depth', 'air-label', 'world-conditions', 'air-fill',
    'interact', 'selected', 'feedback',
    'skin-name', 'shirt-name', 'pants-name', 'make-tank', 'recipe-cost', 'make-door', 'door-cost', 'room-status', 'room-invitation', 'room-create', 'room-join', 'room-copy',
    'room-leave', 'room-join-form', 'multiplayer',
  ].map((id) => [id, byId(id)]));
  const panels = [...document.querySelectorAll('dialog')];
  const preview = byId('character-preview');
  const swatches = [...byId('customize-panel').querySelectorAll('.swatch')];
  const inventoryUI = createInventoryUi(byId('backpack-panel'), {
    getInventory: actions.getInventory,
    onMove: actions.inventoryChanged,
    onSelect: actions.select,
    canMove: actions.canMoveInventory,
  });
  const touch = matchMedia('(pointer: coarse)').matches;
  let toastTimer;

  function setText(id, value) {
    const element = fields[id];
    if (element && element.textContent !== value) element.textContent = value;
  }

  function open(id) {
    const panel = byId(id);
    if (panel.open) {
      panel.close();
      return;
    }
    for (const other of panels) if (other.open) other.close();
    actions.beforePanel(id);
    panel.showModal();
  }

  function updateCraft(game) {
    fields['make-door'].disabled = !canCraftDoor(game);
    setText('door-cost', WOODEN_DOOR.wood + ' wood');
    fields['make-tank'].disabled = !canCraftTank(game);
    setText('make-tank', game.progress.airTank ? 'Equipped' : 'Craft air tank');
    setText('recipe-cost', game.progress.airTank ? 'Air tank equipped' : Object.entries(AIR_TANK.cost).map(([item, cost]) => cost + ' ' + item).join(' · '));
  }

  byId('version').textContent = 'v' + version;
  byId('backpack').addEventListener('click', () => open('backpack-panel'));
  byId('customize').addEventListener('click', () => open('customize-panel'));
  for (const swatch of swatches) swatch.addEventListener('click', () => {
    const { part, index } = swatch.dataset;
    if (Object.hasOwn(APPEARANCE, part) && APPEARANCE[part][Number(index)]) actions.customize(part, Number(index));
  });
  byId('craft').addEventListener('click', () => open('craft-panel'));
  byId('pause')?.addEventListener('click', () => open('pause-panel'));
  byId('multiplayer').addEventListener('click', () => open('room-panel'));
  byId('resume').addEventListener('click', () => byId('pause-panel').close());
  byId('reset-world').addEventListener('click', actions.restart);
  byId('make-tank').addEventListener('click', actions.makeTank);
  byId('make-door').addEventListener('click', actions.makeDoor);
  byId('room-create').addEventListener('click', () => actions.enterRoom());
  byId('room-join-form').addEventListener('submit', (event) => {
    event.preventDefault();
    actions.enterRoom(byId('room-code').value.trim());
  });
  byId('room-copy').addEventListener('click', actions.copyRoom);
  byId('room-leave').addEventListener('click', actions.leaveRoom);
  for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
  return {
    open,
    close: (id) => byId(id).close(),
    activePanel: () => panels.find((panel) => panel.open)?.id,
    updateCraft,
    updateCustomize(game) {
      const appearance = game.player.appearance;
      for (const [part, choices] of Object.entries(APPEARANCE)) setText(part + '-name', choices[appearance[part]].name);
      for (const swatch of swatches) swatch.setAttribute('aria-pressed', String(appearance[swatch.dataset.part] === Number(swatch.dataset.index)));
      actions.drawPreview(preview, appearance, game.progress.airTank);
    },
    updateBackpack(game) {
      byId('backpack-tank').hidden = !game.progress.airTank;
    },
    clearNotice() {
      clearTimeout(toastTimer);
      fields.feedback.hidden = true;
    },
    select: inventoryUI.render,
    notify(message) {
      fields.feedback.textContent = message;
      fields.feedback.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { fields.feedback.hidden = true; }, 2700);
    },
    room(state) {
      const inRoom = Boolean(state.room);
      const invite = fields['room-invitation'];
      invite.hidden = !inRoom;
      if (!inRoom) invite.value = '';
      else if (invite.value !== state.link) invite.value = state.link;
      fields['room-copy'].hidden = !inRoom;
      fields['room-leave'].hidden = !inRoom;
      fields['room-create'].hidden = inRoom;
      fields['room-join-form'].hidden = inRoom;
      fields['room-create'].disabled = state.busy || !state.available;
      fields['room-join'].disabled = state.busy || !state.available;
      fields['room-leave'].disabled = state.busy;
      setText('room-status', state.message);
      setText('multiplayer', inRoom ? 'Multiplayer · ' + state.count : 'Multiplayer');
    },
    update(game, conditions) {
      setText('world-conditions', (conditions.night ? 'Night' : 'Day') + ' · ' + (conditions.rain > 0.08 ? 'Rain' : 'Clear'));
      const air = Math.round(game.player.oxygen / oxygenCapacity(game) * 100);
      const airValue = air + '%';
      setText('depth', areaDepth(game) + ' m');
      setText('air-label', airValue);
      const fill = fields['air-fill'];
      if (fill.style.width !== airValue) {
        fill.style.width = airValue;
        fill.classList.toggle('low', air <= 25);
        fill.parentElement.setAttribute('aria-valuenow', String(air));
      }
      const prompt = fields.interact;
      const focusedItem = nearestItem(game);
      prompt.hidden = !focusedItem;
      if (focusedItem) {
        prompt.querySelector('kbd').hidden = touch;
        const label = prompt.querySelector('span');
        if (label.textContent !== ITEM_PROMPTS[focusedItem.kind]) label.textContent = ITEM_PROMPTS[focusedItem.kind];
      }
    },
  };
}
