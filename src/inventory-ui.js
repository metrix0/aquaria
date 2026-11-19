import { CHEST_SIZE } from './content.js';
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
    const label = { hotbar: 'Hotbar', backpack: 'Backpack', chest: 'Chest', head: 'Head equipment', feet: 'Feet equipment' }[button.dataset.group];
    const details = stack
      ? ITEMS[stack.id].name + (stack.count > 1 ? ' × ' + stack.count : '')
      : 'Empty';
    drawStack(button, stack);
    button.title = details;
    const isEquip = button.dataset.group === 'head' || button.dataset.group === 'feet';
    button.setAttribute('aria-label', (isEquip ? label : label + ' ' + (index + 1)) + ', ' + details);
    if (selected !== undefined) button.setAttribute('aria-pressed', String(index === selected));
  }
}

export function createInventoryUi(panel, { getInventory, getChest, getSnorkel, getFeet, onMove, onSelect, canMove, moveInventoryStack, collectChest }) {
  const hudSlots = createSlots(document.getElementById('hotbar-slots'), 'hotbar', HOTBAR_SIZE);
  const panelHotbar = createSlots(panel.querySelector('#backpack-hotbar'), 'hotbar', HOTBAR_SIZE);
  const backpackSlots = createSlots(panel.querySelector('#backpack-slots'), 'backpack', BACKPACK_SIZE);
  const chestSlots = createSlots(panel.querySelector('#chest-slots'), 'chest', CHEST_SIZE);
  const headSlot = panel.querySelector('#backpack-head-slot');
  const feetSlot = panel.querySelector('#backpack-feet-slot');
  const equipSlots = {
    head: { slot: headSlot, label: panel.querySelector('#backpack-head-label'), fallback: 'Head', get: getSnorkel },
    feet: { slot: feetSlot, label: panel.querySelector('#backpack-feet-label'), fallback: 'Feet', get: getFeet },
  };
  const groups = { hotbar: panelHotbar, backpack: backpackSlots, chest: chestSlots, head: [headSlot], feet: [feetSlot] };
  const chestStorage = panel.querySelector('#chest-storage');
  const chestCount = panel.querySelector('#chest-count');
  const collectAll = panel.querySelector('#chest-collect-all');
  const chestStatus = panel.querySelector('#chest-status');
  const close = panel.querySelector('[data-close]');
  let chestId;
  const ghost = panel.querySelector('#inventory-drag');
  let gesture;
  let picked;
  let highlighted;

  const address = (button) => ({ group: button.dataset.group, index: Number(button.dataset.index) });
  const stackAt = (button) => {
    const { group, index } = address(button);
    if (Object.hasOwn(equipSlots, group)) {
      const equipped = equipSlots[group].get?.();
      return equipped && { id: equipped.id, count: 1 };
    }
    return (group === 'chest' ? getChest(chestId) : getInventory()[group])?.[index];
  };
  const slotAt = (element) => element?.closest('#backpack-panel .slot[data-group]');
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
    if (moveInventoryStack(chestId, source, target)) {
      chestStatus.textContent = '';
      onMove();
    }
  }

  function activate(button) {
    if (picked) move(picked, button);
    else if (stackAt(button)) pick(button);
  }

  function endGesture() {
    gesture = null;
    ghost.hidden = true;
    highlight(null);
  }

  collectAll.addEventListener('click', () => {
    if (!canMove() || gesture) return;
    pick(null);
    if (collectChest(chestId)) onMove();
    chestStatus.textContent = collectAll.disabled ? '' : 'Inventory full. Remaining items are in the chest.';
  });

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
      if (!stack || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
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

    if ((group === 'head' || group === 'feet') && event.code === 'ArrowLeft') panelHotbar[HOTBAR_SIZE - 1].focus();
    else if (group === 'head' && event.code === 'ArrowDown') feetSlot.focus();
    else if (group === 'feet' && event.code === 'ArrowUp') headSlot.focus();
    else if (group === 'hotbar' && index === HOTBAR_SIZE - 1 && event.code === 'ArrowRight') headSlot.focus();
    else if (group === 'backpack' && index % columns === columns - 1 && event.code === 'ArrowRight') (index >= 12 ? feetSlot : headSlot).focus();
    else if (group === 'hotbar' && event.code === 'ArrowDown') backpackSlots[index].focus();
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
      chestStatus.textContent = '';
      panel.querySelector('#backpack-title').textContent = chest?.name ?? 'Backpack';
      chestStorage.hidden = !chest;
      panel.querySelector('#chest-backpack-label').hidden = !chest;
    },
    openChestId: () => panel.open ? chestId : undefined,
    render(selected) {
      const { hotbar, backpack } = getInventory();
      drawSlots(hudSlots, hotbar, selected);
      drawSlots(panelHotbar, hotbar, selected);
      drawSlots(backpackSlots, backpack);
      for (const { slot, label, fallback, get } of Object.values(equipSlots)) {
        const equipped = get?.();
        drawSlots([slot], [equipped && { id: equipped.id, count: 1 }]);
        label.textContent = equipped?.name ?? fallback;
      }
      if (chestId) {
        const slots = getChest(chestId);
        drawSlots(chestSlots, slots);
        const occupied = slots.filter(Boolean).length;
        chestCount.textContent = occupied + ' / ' + CHEST_SIZE + ' slots';
        collectAll.disabled = occupied === 0;
      }
      document.getElementById('selected').textContent = ITEMS[hotbar[selected]?.id]?.name ?? 'Empty slot';
    },
  };
}
