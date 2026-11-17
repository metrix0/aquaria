import { BACKPACK_SIZE, HOTBAR_SIZE, ITEMS } from './inventory.js';

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

function drawStack(button, stack) {
  const icon = button.querySelector('span');
  icon.className = stack ? 'item item-' + stack.id : '';
  button.querySelector('b').textContent = stack?.count > 1 ? stack.count : '';
  button.toggleAttribute('data-filled', Boolean(stack));
}

function drawSlots(buttons, stacks, selected) {
  for (const [index, button] of buttons.entries()) {
    const stack = stacks[index];
    const label = button.dataset.group === 'hotbar' ? 'Hotbar ' : 'Backpack ';
    const details = stack ? ITEMS[stack.id].name + (stack.count > 1 ? ' × ' + stack.count : '') : 'Empty';
    drawStack(button, stack);
    button.title = details;
    button.setAttribute('aria-label', label + (index + 1) + ', ' + details);
    if (selected !== undefined) button.setAttribute('aria-pressed', String(index === selected));
  }
}

export function createInventoryUi(panel, { getInventory, onMove, onSelect }) {
  const hudSlots = createSlots(document.getElementById('hotbar-slots'), 'hotbar', HOTBAR_SIZE);
  const panelHotbar = createSlots(panel.querySelector('#backpack-hotbar'), 'hotbar', HOTBAR_SIZE);
  const backpackSlots = createSlots(panel.querySelector('#backpack-slots'), 'backpack', BACKPACK_SIZE);
  const close = panel.querySelector('[data-close]');
  const ghost = panel.querySelector('#inventory-drag');
  let gesture;
  let picked;
  let highlighted;

  const address = (button) => ({ group: button.dataset.group, index: Number(button.dataset.index) });
  const stackAt = (button) => getInventory()[button.dataset.group][Number(button.dataset.index)];
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
    if (from !== to && getInventory().move(address(from), address(to))) onMove();
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
      panelHotbar[0].focus();
      return;
    }
    const button = slotAt(event.target);
    const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 }[event.code];
    if (!button || direction === undefined) return;
    event.preventDefault();
    const { group, index } = address(button);
    (group === 'hotbar' ? panelHotbar : backpackSlots)[index + direction]?.focus();
    if (group === 'hotbar' && event.code === 'ArrowDown') backpackSlots[index].focus();
    if (group === 'backpack' && index < 6 && event.code === 'ArrowUp') panelHotbar[Math.min(index, HOTBAR_SIZE - 1)].focus();
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
    render(selected) {
      const { hotbar, backpack } = getInventory();
      drawSlots(hudSlots, hotbar, selected);
      drawSlots(panelHotbar, hotbar, selected);
      drawSlots(backpackSlots, backpack);
      document.getElementById('selected').textContent = ITEMS[hotbar[selected]?.id]?.name ?? 'Empty slot';
    },
  };
}
