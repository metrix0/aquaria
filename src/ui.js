import { createCharacterEditor } from './character-editor.js';
import { createCraftingUi } from './crafting-ui.js';
import { createInventoryUi } from './inventory-ui.js';
import { MAX_HEALTH } from './gameplay/player.js';
import { areaDepth, nearestItem, oxygenCapacity } from './gameplay/simulation.js';

export function createUI(actions, version) {
  const byId = (id) => document.getElementById(id);
  const fields = Object.fromEntries([
    'depth', 'health-label', 'health-fill', 'air-label', 'world-conditions', 'air-fill',
    'interact', 'feedback', 'backpack-head-label', 'room-status', 'room-invitation', 'room-create', 'room-join', 'room-copy',
    'room-leave', 'room-join-form', 'multiplayer',
  ].map((id) => [id, byId(id)]));
  const panels = [...document.querySelectorAll('dialog')];
  const craftingUI = createCraftingUi(byId('craft-panel'), actions);
  const characterEditor = createCharacterEditor(byId('customize-panel'), actions.customize);
  const inventoryUI = createInventoryUi(byId('backpack-panel'), {
    getInventory: actions.getInventory,
    getChest: actions.getChest,
    moveChestStack: actions.moveChestStack,
    equipChestLoot: actions.equipChestLoot,
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

  function open(id, source) {
    const panel = byId(id);
    if (panel.open) {
      panel.close();
      return;
    }
    for (const other of panels) if (other.open) other.close();
    if (id === 'backpack-panel') inventoryUI.showChest(source);
    actions.beforePanel(id, source);
    panel.showModal();
  }

  byId('version').textContent = 'v' + version;
  byId('backpack').addEventListener('click', () => open('backpack-panel'));
  byId('customize').addEventListener('click', () => open('customize-panel'));
  byId('craft').addEventListener('click', () => open('craft-panel'));
  byId('pause')?.addEventListener('click', () => open('pause-panel'));
  byId('multiplayer').addEventListener('click', () => open('room-panel'));
  byId('resume').addEventListener('click', () => byId('pause-panel').close());
  byId('reset-world').addEventListener('click', actions.restart);
  const godMode = byId('god-mode');
  godMode.addEventListener('click', actions.toggleGodMode);
  const shadows = byId('hide-cave-shadows');
  shadows.addEventListener('click', () => {
    const hidden = shadows.getAttribute('aria-pressed') !== 'true';
    shadows.setAttribute('aria-pressed', String(hidden));
    actions.hideCaveShadows(hidden);
  });
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
    godMode: (enabled) => godMode.setAttribute('aria-pressed', String(enabled)),
    close: (id) => byId(id).close(),
    activePanel: () => panels.find((panel) => panel.open)?.id,
    updateCraft: craftingUI.render,
    openChestId: inventoryUI.openChestId,
    chestNotice: inventoryUI.notice,
    updateCustomize: (game) => characterEditor.open(game.player.appearance, game.progress.airTank, game.progress.swimmingHelmet),
    updateBackpack(game) {
      byId('backpack-helmet').hidden = !game.progress.swimmingHelmet;
      setText('backpack-head-label', game.progress.swimmingHelmet ? 'Swimming helmet' : 'Head');
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
      const health = Math.round(game.player.health / MAX_HEALTH * 100);
      const healthValue = health + '%';
      const air = Math.round(game.player.oxygen / oxygenCapacity(game) * 100);
      const airValue = air + '%';
      setText('depth', areaDepth(game) + ' m');
      setText('health-label', healthValue);
      const healthFill = fields['health-fill'];
      if (healthFill.style.width !== healthValue) {
        healthFill.style.width = healthValue;
        healthFill.classList.toggle('low', health <= 25);
        healthFill.parentElement.setAttribute('aria-valuenow', String(health));
      }
      setText('air-label', airValue);
      const fill = fields['air-fill'];
      if (fill.style.width !== airValue) {
        fill.style.width = airValue;
        fill.classList.toggle('low', air <= 25);
        fill.parentElement.setAttribute('aria-valuenow', String(air));
      }
      const prompt = fields.interact;
      const focusedItem = panels.some((panel) => panel.open) ? null : nearestItem(game);
      prompt.hidden = !focusedItem;
      if (focusedItem) {
        prompt.querySelector('kbd').hidden = touch;
        const label = prompt.querySelector('span');
        const action = 'Open ' + focusedItem.name.toLowerCase();
        if (label.textContent !== action) label.textContent = action;
      }
    },
  };
}
