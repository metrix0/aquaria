import { CHEST_SIZE, SWIMMING_HELMET } from './content.js';
import { BACKPACK_SIZE, HOTBAR_SIZE, ITEMS } from './inventory.js';
import { pickaxeIcon } from './pickaxe-art.js';

function createSlots(container, group, size) {
  return Array.from({ length: size }, (_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.dataset.group = group;
    button.dataset.index = index;
    if (group === 'hotbar') {
      const key = document.createElement('kbd');
      key.textContent = index + 1;
      key.setAttribute('aria-hidden', 'true');
      button.append(key);
    }
    const icon = document.createElement('span');
    const count = document.createElement('b');
    icon.setAttribute('aria-hidden', 'true');
    count.setAttribute('aria-hidden', 'true');
    button.append(icon, count);
    container.append(button);
    return button;
  });
}

export function setItemIcon(icon, id) {
  const item = ITEMS[id];
  icon.className = id ? 'item item-' + (item?.icon ?? id) : '';
  if (item?.pickaxe) icon.classList.add('item-pickaxe');
  icon.style.backgroundImage = item?.pickaxe ? pickaxeIcon(item.pickaxe) : '';
}

function drawStack(button, stack) {
  setItemIcon(button.querySelector('span'), stack?.id);
  button.querySelector('b').textContent = stack?.count > 1 ? stack.count : '';
  button.toggleAttribute('data-filled', Boolean(stack));
}

function drawSlots(buttons, stacks, selected) {
  for (const [index, button] of buttons.entries()) {
    const stack = stacks[index];
    const label = { hotbar: 'Hotbar', backpack: 'Backpack', chest: 'Chest' }[button.dataset.group];
    const details = stack
      ? ITEMS[stack.id].name + (stack.count > 1 ? ' × ' + stack.count : '')
      : 'Empty';
    const action = stack?.id === SWIMMING_HELMET.id ? 'Equip ' + details.toLowerCase() : details;
    button.toggleAttribute('data-equip', action !== details);
    drawStack(button, stack);
    button.title = action;
    button.setAttribute('aria-label', label + ' ' + (index + 1) + ', ' + action);
    if (selected !== undefined) button.setAttribute('aria-pressed', String(index === selected));
  }
}

export function createInventoryUi(panel, { getInventory, getChest, onMove, onSelect, canMove, moveChestStack, equipChestLoot }) {
  const hudSlots = createSlots(document.getElementById('hotbar-slots'), 'hotbar', HOTBAR_SIZE);
  const panelHotbar = createSlots(panel.querySelector('#backpack-hotbar'), 'hotbar', HOTBAR_SIZE);
  const backpackSlots = createSlots(panel.querySelector('#backpack-slots'), 'backpack', BACKPACK_SIZE);
  const chestSlots = createSlots(panel.querySelector('#chest-slots'), 'chest', CHEST_SIZE);
  const groups = { hotbar: panelHotbar, backpack: backpackSlots, chest: chestSlots };
  const chestStorage = panel.querySelector('#chest-storage');
  const chestCount = panel.querySelector('#chest-count');
  const chestNotice = panel.querySelector('#chest-notice');
  const equipHint = panel.querySelector('#chest-equip-hint');
  const close = panel.querySelector('[data-close]');
  let chestId;
  const ghost = panel.querySelector('#inventory-drag');
  let gesture;
  let picked;
  let highlighted;

  const address = (button) => ({ group: button.dataset.group, index: Number(button.dataset.index) });
  const stackAt = (button) => {
    const { group, index } = address(button);
    return (group === 'chest' ? getChest(chestId) : getInventory()[group])?.[index];
  };
  const slotAt = (element) => element?.closest('#backpack-panel .slot');
  const slotAtPointer = ({ clientX, clientY }) => slotAt(document.elementFromPoint(clientX, clientY));

  function pick(button) {
    picked?.removeAttribute('data-picked');
    picked = button;
    picked?.setAttribute('data-picked', '');
  }

  function highlight(button) {
    highlighted?.removeAttribute('data-drop-target');
    highlighted = button;
    highlighted?.setAttribute('data-drop-target', '');
  }

  function move(from, to) {
    pick(null);
    if (!canMove() || from === to) return;
    const source = address(from);
    const target = address(to);
    const moved = chestId ? moveChestStack(chestId, source, target) : getInventory().move(source, target);
    if (moved) onMove();
  }

  function activate(button) {
    if (picked) move(picked, button);
    else if (button.hasAttribute('data-equip')) {
      if (canMove()) equipChestLoot(chestId, address(button).index);
    } else if (stackAt(button)) pick(button);
  }

  function endGesture() {
    gesture = null;
    ghost.hidden = true;
    highlight(null);
  }

  panel.addEventListener('pointerdown', (event) => {
    const button = slotAt(event.target);
    if (!button || gesture || event.button !== 0) return;
    gesture = { button, id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    button.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointermove', (event) => {
    if (gesture?.id !== event.pointerId) return;
    if (!gesture.dragging) {
      const stack = stackAt(gesture.button);
      if (!stack || gesture.button.hasAttribute('data-equip') || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
      gesture.dragging = true;
      pick(gesture.button);
      drawStack(ghost, stack);
      ghost.hidden = false;
    }
    ghost.style.left = event.clientX + 'px';
    ghost.style.top = event.clientY + 'px';
    highlight(slotAtPointer(event));
  });
  panel.addEventListener('pointerup', (event) => {
    if (gesture?.id !== event.pointerId) return;
    const { button, dragging } = gesture;
    const target = slotAtPointer(event);
    endGesture();
    if (dragging) {
      if (target) move(button, target);
      else pick(null);
    } else if (target === button) activate(button);
  });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    panel.addEventListener(name, ({ pointerId }) => {
      if (gesture?.id !== pointerId) return;
      endGesture();
      pick(null);
    });
  }
  panel.addEventListener('click', (event) => {
    const button = slotAt(event.target);
    if (button && event.detail === 0) activate(button);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.target === close && event.code === 'ArrowDown') {
      event.preventDefault();
      (chestId ? chestSlots : panelHotbar)[0].focus();
      return;
    }
    const button = slotAt(event.target);
    if (!button) return;
    const { group, index } = address(button);
    const columns = group === 'chest' ? 4 : 6;
    const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.code];
    if (direction === undefined) return;
    event.preventDefault();

    if (group === 'hotbar' && event.code === 'ArrowDown') backpackSlots[index].focus();
    else if (group === 'hotbar' && event.code === 'ArrowUp' && chestId) chestSlots[index + 4].focus();
    else if (group === 'backpack' && index < 6 && event.code === 'ArrowUp') panelHotbar[Math.min(index, HOTBAR_SIZE - 1)].focus();
    else if (group === 'chest' && index >= 4 && event.code === 'ArrowDown') panelHotbar[index - 4].focus();
    else groups[group][index + direction]?.focus();
  });
  panel.addEventListener('close', () => {
    endGesture();
    pick(null);
  });
  for (const [index, slot] of hudSlots.entries()) {
    slot.addEventListener('click', (event) => {
      onSelect(index);
      if (event.detail) slot.blur();
    });
  }

  return {
    showChest(chest) {
      chestId = chest?.id;
      panel.querySelector('#backpack-title').textContent = chest?.name ?? 'Backpack';
      chestStorage.hidden = !chest;
      panel.querySelector('#chest-backpack-label').hidden = !chest;
      chestNotice.hidden = true;
    },
    openChestId: () => panel.open ? chestId : undefined,
    notice(message) {
      chestNotice.textContent = message;
      chestNotice.hidden = false;
    },
    render(selected) {
      const { hotbar, backpack } = getInventory();
      drawSlots(hudSlots, hotbar, selected);
      drawSlots(panelHotbar, hotbar, selected);
      drawSlots(backpackSlots, backpack);
      if (chestId) {
        const slots = getChest(chestId);
        drawSlots(chestSlots, slots);
        equipHint.hidden = !slots.some((stack) => stack?.id === SWIMMING_HELMET.id);
        chestCount.textContent = slots.filter(Boolean).length + ' / ' + CHEST_SIZE + ' slots';
      }
      document.getElementById('selected').textContent = ITEMS[hotbar[selected]?.id]?.name ?? 'Empty slot';
    },
  };
}
