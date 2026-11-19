import { ACCESSORY_SLOTS, ARROW, BOW, CHEST_SIZE, KELP_DRESSING } from './content.js';
import { BACKPACK_SIZE, EQUIPMENT_ITEMS, HOTBAR_SIZE, ITEMS } from './inventory.js';
import { pickaxeIcon } from './pickaxe-art.js';

const accessoryLabels = ACCESSORY_SLOTS.map((slot) => slot[0].toUpperCase() + slot.slice(1));

function createSlots(container, group, size, labels) {
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
    if (labels) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = labels[index];
      label.setAttribute('aria-hidden', 'true');
      row.append(button, label);
      container.append(row);
    } else {
      container.append(button);
    }
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

function drawSlots(buttons, stacks, selected, nativeHint = false) {
  for (const [index, button] of buttons.entries()) {
    const stack = stacks[index];
    const { group } = button.dataset;
    const label = { hotbar: 'Hotbar', backpack: 'Backpack', chest: 'Chest', head: 'Head equipment', feet: 'Feet equipment', ring: 'Ring equipment' }[group];
    const details = stack
      ? ITEMS[stack.id].name + (stack.count > 1 ? ' × ' + stack.count : '')
      : 'Empty';
    drawStack(button, stack);
    if (nativeHint) button.title = details;
    const slotName = group === 'accessory' ? accessoryLabels[index] + ' accessory'
      : ['head', 'feet', 'ring'].includes(group) ? label : label + ' ' + (index + 1);
    button.setAttribute('aria-label', slotName + ', ' + details);
    if (selected !== undefined) button.setAttribute('aria-pressed', String(index === selected));
  }
}

function itemStats(id, item) {
  if (item.effect) return item.effect;
  if (item.weapon?.damage) return item.weapon.damage + ' damage';
  if (id === ARROW.id) return ARROW.damage + ' damage';
  if (id === BOW.id) return ARROW.damage + ' damage per arrow';
  if (id === KELP_DRESSING.id) return 'Restores up to ' + KELP_DRESSING.heal + ' health';
  if (item.bonusSeconds) return '+' + item.bonusSeconds + ' s underwater';
  if (item.swimMultiplier) return item.swimMultiplier + '× swim speed';
  if (item.protection) return Math.round(item.protection * 100) + '% damage reduction';
  if (item.pickaxe) {
    const tier = 'Mining tier ' + item.pickaxe;
    return item.miningTime ? tier + ' · ' + Math.round((1 - item.miningTime) * 100) + '% less mining time' : tier;
  }
  if (id === 'root-ring') return 'F · Bind a nearby enemy and deal 3 damage';
  if (id === 'explorers-map') return 'Use to open the map';
  return '';
}

export function createInventoryUi(panel, { getInventory, getChest, getSnorkel, getFeet, getRing, getAccessory, onMove, onSelect, canMove, moveInventoryStack, collectChest }) {
  const hudSlots = createSlots(document.getElementById('hotbar-slots'), 'hotbar', HOTBAR_SIZE);
  const panelHotbar = createSlots(panel.querySelector('#backpack-hotbar'), 'hotbar', HOTBAR_SIZE);
  const backpackSlots = createSlots(panel.querySelector('#backpack-slots'), 'backpack', BACKPACK_SIZE);
  const chestSlots = createSlots(panel.querySelector('#chest-slots'), 'chest', CHEST_SIZE);
  const accessorySlots = createSlots(panel.querySelector('#accessory-slots'), 'accessory', ACCESSORY_SLOTS.length, accessoryLabels);
  const headSlot = panel.querySelector('#backpack-head-slot');
  const feetSlot = panel.querySelector('#backpack-feet-slot');
  const ringSlot = panel.querySelector('#backpack-ring-slot');
  const equipSlots = {
    head: { slot: headSlot, label: panel.querySelector('#backpack-head-label'), fallback: 'Head', get: getSnorkel },
    feet: { slot: feetSlot, label: panel.querySelector('#backpack-feet-label'), fallback: 'Feet', get: getFeet },
    ring: { slot: ringSlot, label: panel.querySelector('#backpack-ring-label'), fallback: 'Ring', get: getRing },
  };
  const groups = { hotbar: panelHotbar, backpack: backpackSlots, chest: chestSlots, head: [headSlot], feet: [feetSlot], ring: [ringSlot], accessory: accessorySlots };
  const chestStorage = panel.querySelector('#chest-storage');
  const chestCount = panel.querySelector('#chest-count');
  const collectAll = panel.querySelector('#chest-collect-all');
  const chestStatus = panel.querySelector('#chest-status');
  const close = panel.querySelector('[data-close]');
  const armorSlot = panel.querySelector('#backpack-armor').parentElement;
  const tooltip = panel.querySelector('#inventory-tooltip');
  const tooltipName = tooltip.querySelector('strong');
  const tooltipStats = tooltip.querySelector('small');
  const tooltipDescription = tooltip.querySelector('em');
  let chestId;
  const ghost = panel.querySelector('#inventory-drag');
  let gesture;
  let picked;
  let highlighted;
  let tooltipSlot;

  const address = (button) => ({ group: button.dataset.group, index: Number(button.dataset.index) });
  const equippedStack = (item) => item && { id: item.id, count: 1 };
  const stackAt = (button) => {
    const { group, index } = address(button);
    if (group === 'accessory') return equippedStack(getAccessory(ACCESSORY_SLOTS[index]));
    if (Object.hasOwn(equipSlots, group)) return equippedStack(equipSlots[group].get());
    return (group === 'chest' ? getChest(chestId) : getInventory()[group])?.[index];
  };
  const slotAt = (element) => element?.closest('#backpack-panel .slot[data-group]');
  const slotAtPointer = ({ clientX, clientY }) => slotAt(document.elementFromPoint(clientX, clientY));

  function renderTooltip() {
    if (!tooltipSlot) return;
    const stack = tooltipSlot === armorSlot ? { id: armorSlot.dataset.item, count: 1 } : stackAt(tooltipSlot);
    const item = ITEMS[stack?.id] ?? EQUIPMENT_ITEMS[stack?.id];
    const anchor = tooltipSlot.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    if (!item || !panel.open || anchor.bottom <= bounds.top || anchor.top >= bounds.bottom) {
      tooltipSlot.removeAttribute('aria-describedby');
      tooltip.hidden = true;
      return;
    }

    tooltipName.textContent = item.name + (stack.count > 1 ? ' × ' + stack.count : '');
    tooltipStats.textContent = itemStats(stack.id, item);
    tooltipStats.hidden = !tooltipStats.textContent;
    tooltipDescription.textContent = item.description;
    tooltip.hidden = false;
    tooltipSlot.setAttribute('aria-describedby', tooltip.id);

    const gap = 8;
    const { offsetWidth: width, offsetHeight: height } = tooltip;
    const { clientWidth, clientHeight } = document.documentElement;
    const centerX = (anchor.left + anchor.right) / 2;
    const leftSide = bounds.left - width - gap;
    const rightSide = bounds.right + gap;
    const fitsLeft = leftSide >= gap;
    const fitsRight = rightSide + width <= clientWidth - gap;
    let left = centerX - width / 2;
    const above = anchor.top - height - gap;
    let top = above >= gap ? above : anchor.bottom + gap;
    if (fitsLeft || fitsRight) {
      left = fitsLeft && (!fitsRight || centerX - bounds.left < bounds.right - centerX) ? leftSide : rightSide;
      top = (anchor.top + anchor.bottom - height) / 2;
    }
    tooltip.style.left = Math.max(gap, Math.min(left, clientWidth - width - gap)) + 'px';
    tooltip.style.top = Math.max(gap, Math.min(top, clientHeight - height - gap)) + 'px';
  }

  function showTooltip(slot) {
    tooltipSlot?.removeAttribute('aria-describedby');
    tooltipSlot = slot;
    tooltip.hidden = true;
    renderTooltip();
  }

  for (const slot of [...Object.values(groups).flat(), armorSlot]) {
    slot.addEventListener('pointerenter', ({ pointerType }) => {
      if (pointerType !== 'touch' && !gesture) showTooltip(slot);
    });
    slot.addEventListener('pointerleave', ({ pointerType }) => {
      if (pointerType !== 'touch' && tooltipSlot === slot && !slot.matches(':focus-visible')) showTooltip(null);
    });
    slot.addEventListener('focus', () => {
      if (slot.matches(':focus-visible')) showTooltip(slot);
    });
    slot.addEventListener('blur', () => {
      if (tooltipSlot === slot && !slot.matches(':hover')) showTooltip(null);
    });
  }
  panel.addEventListener('scroll', renderTooltip);
  window.addEventListener('resize', renderTooltip);

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
    showTooltip(null);
    pick(null);
    if (collectChest(chestId)) onMove();
    chestStatus.textContent = collectAll.disabled ? '' : 'Inventory full. Remaining items are in the chest.';
  });

  panel.addEventListener('pointerdown', (event) => {
    const button = slotAt(event.target);
    if (event.pointerType === 'touch') showTooltip(null);
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
      showTooltip(null);
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
    if (event.pointerType !== 'touch' || (!dragging && picked === target)) showTooltip(target);
  });
  armorSlot.addEventListener('pointerup', ({ pointerType }) => {
    if (pointerType === 'touch') showTooltip(armorSlot);
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

    if (Object.hasOwn(equipSlots, group) && event.code === 'ArrowLeft') panelHotbar[HOTBAR_SIZE - 1].focus();
    else if (group === 'head' && event.code === 'ArrowDown') feetSlot.focus();
    else if (group === 'feet' && event.code === 'ArrowUp') headSlot.focus();
    else if (group === 'feet' && event.code === 'ArrowDown') ringSlot.focus();
    else if (group === 'ring' && event.code === 'ArrowUp') feetSlot.focus();
    else if (group === 'ring' && event.code === 'ArrowDown') accessorySlots.at(-1).focus();
    else if (group === 'hotbar' && index === HOTBAR_SIZE - 1 && event.code === 'ArrowRight') headSlot.focus();
    else if (group === 'backpack' && index % columns === columns - 1 && event.code === 'ArrowRight') (index >= 12 ? feetSlot : headSlot).focus();
    else if (group === 'hotbar' && event.code === 'ArrowDown') backpackSlots[index].focus();
    else if (group === 'hotbar' && event.code === 'ArrowUp' && chestId) chestSlots[index + 4].focus();
    else if (group === 'backpack' && index < 6 && event.code === 'ArrowUp') panelHotbar[Math.min(index, HOTBAR_SIZE - 1)].focus();
    else if (group === 'backpack' && index >= BACKPACK_SIZE - columns && event.code === 'ArrowDown') {
      accessorySlots[Math.min(index % columns, accessorySlots.length - 1)].focus();
    } else if (group === 'accessory' && event.code === 'ArrowUp') backpackSlots[BACKPACK_SIZE - columns + index].focus();
    else if (group === 'chest' && index >= 4 && event.code === 'ArrowDown') panelHotbar[index - 4].focus();
    else groups[group][index + direction]?.focus();
  });
  panel.addEventListener('close', () => {
    showTooltip(null);
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
      drawSlots(hudSlots, hotbar, selected, true);
      drawSlots(panelHotbar, hotbar, selected);
      drawSlots(backpackSlots, backpack);
      for (const { slot, label, fallback, get } of Object.values(equipSlots)) {
        const equipped = get?.();
        drawSlots([slot], [equippedStack(equipped)]);
        label.textContent = fallback === 'Ring' && equipped ? 'Root ring [F]' : (equipped?.name ?? fallback);
        if (fallback === 'Ring') {
          document.getElementById('cast-ring').hidden = !equipped;
        }
      }
      drawSlots(accessorySlots, ACCESSORY_SLOTS.map((slot) => equippedStack(getAccessory(slot))));
      if (chestId) {
        const slots = getChest(chestId);
        drawSlots(chestSlots, slots);
        const occupied = slots.filter(Boolean).length;
        chestCount.textContent = occupied + ' / ' + CHEST_SIZE + ' slots';
        collectAll.disabled = occupied === 0;
      }
      renderTooltip();
      document.getElementById('selected').textContent = ITEMS[hotbar[selected]?.id]?.name ?? 'Empty slot';
    },
  };
}
