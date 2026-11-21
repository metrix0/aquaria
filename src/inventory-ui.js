import { ARROW, BOW, CHEST_SIZE, KELP_DRESSING, MATERIAL } from './content.js';
import { BACKPACK_SIZE, EQUIPMENT_ITEMS, GRAPPLING_HOOK, HOTBAR_SIZE, ITEMS, ROOT_RING } from './inventory.js';
import { pickaxeIcon } from './pickaxe-art.js';
import { ITEM_ICON_IDS } from './art/items/manifest.js';

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
  const item = ITEMS[id] ?? EQUIPMENT_ITEMS[id];
  const appearance = item?.icon ?? id;
  // Placeable terrain cubes use their original block icon, not a loose-resource sprite.
  const cubeBlock = Boolean(item?.block && item.block !== MATERIAL.workbench);
  const sprite = Boolean(!cubeBlock && appearance && ITEM_ICON_IDS.has(appearance));
  icon.className = id ? 'item item-' + appearance : '';
  if (item?.pickaxe) icon.classList.add('item-pickaxe');
  if (sprite) icon.classList.add('item-sprite');
  icon.style.backgroundImage = sprite
    ? 'url("' + new URL('./art/items/' + appearance + '.png', import.meta.url).href + '")'
    : item?.pickaxe ? pickaxeIcon(item.pickaxe) : '';
}

function drawStack(button, stack) {
  setItemIcon(button.querySelector('span'), stack?.id);
  button.querySelector('b').textContent = stack?.count > 1 ? stack.count : '';
  button.toggleAttribute('data-filled', Boolean(stack));
}

function drawSlots(buttons, stacks, selected) {
  for (const [index, button] of buttons.entries()) {
    const stack = stacks[index];
    const label = { hotbar: 'Hotbar', backpack: 'Backpack', chest: 'Chest', head: 'Head equipment', feet: 'Feet equipment', ring: 'Ring equipment', hands: 'Hands equipment' }[button.dataset.group] ?? button.dataset.group.replace('addon-', 'Accessory ') ;
    const details = stack
      ? ITEMS[stack.id].name + (stack.count > 1 ? ' × ' + stack.count : '')
      : 'Empty';
    drawStack(button, stack);
    const isEquip = ['head', 'feet', 'ring', 'hands'].includes(button.dataset.group) || button.dataset.group.startsWith('addon-');
    button.setAttribute('aria-label', (isEquip ? label : label + ' ' + (index + 1)) + ', ' + details);
    if (selected !== undefined) button.setAttribute('aria-pressed', String(index === selected));
  }
}

function itemStats(id, item) {
  if (item.weapon?.damage) return item.weapon.damage + ' damage';
  if (id === ARROW.id) return ARROW.damage + ' damage';
  if (id === BOW.id) return ARROW.damage + ' damage per arrow';
  if (id === KELP_DRESSING.id) return 'Restores up to ' + KELP_DRESSING.heal + ' health';
  if (item.bonusSeconds) return '+' + item.bonusSeconds + ' s underwater';
  if (item.swimMultiplier) return item.swimMultiplier + '× swim speed';
  if (item.protection) return Math.round(item.protection * 100) + '% damage reduction';
  if (item.miningSpeed) return '+' + Math.round(item.miningSpeed * 100) + '% mining speed';
  if (item.moveSpeed) return '+' + Math.round(item.moveSpeed * 100) + '% ground movement speed';
  if (item.fallProtection) return '-' + Math.round(item.fallProtection * 100) + '% fall damage';
  if (item.oreSense) return 'Nearby ore veins glimmer';
  if (item.pickaxe) {
    const tier = 'Mining tier ' + item.pickaxe;
    return item.miningTime ? tier + ' · ' + Math.round((1 - item.miningTime) * 100) + '% less mining time' : tier;
  }
  if (id === ROOT_RING.id) return `F · Lift and bind a foe · ${ROOT_RING.cooldown}s recharge`;
  if (id === GRAPPLING_HOOK.id) return 'E · Fire hook toward cursor · Space to jump off';
  if (id === 'explorers-map') return 'Opens while held';
  return '';
}

export function createInventoryUi(panel, { getInventory, getChest, getSnorkel, getFeet, getRing, getHands, getAddon, onMove, onSelect, canMove, moveInventoryStack, collectChest }) {
  const hudSlots = createSlots(document.getElementById('hotbar-slots'), 'hotbar', HOTBAR_SIZE);
  const panelHotbar = createSlots(panel.querySelector('#backpack-hotbar'), 'hotbar', HOTBAR_SIZE);
  const backpackSlots = createSlots(panel.querySelector('#backpack-slots'), 'backpack', BACKPACK_SIZE);
  const chestSlots = createSlots(panel.querySelector('#chest-slots'), 'chest', CHEST_SIZE);
  const headSlot = panel.querySelector('#backpack-head-slot');
  const feetSlot = panel.querySelector('#backpack-feet-slot');
  const ringSlot = panel.querySelector('#backpack-ring-slot');
  const handsSlot = panel.querySelector('#backpack-hands-slot');
  const addonSlots = ['head', 'chest', 'legs', 'feet', 'hands'];
  const equipSlots = {
    head: { slot: headSlot, label: panel.querySelector('#backpack-head-label'), fallback: 'Head', get: getSnorkel },
    feet: { slot: feetSlot, label: panel.querySelector('#backpack-feet-label'), fallback: 'Feet', get: getFeet },
    ring: { slot: ringSlot, label: panel.querySelector('#backpack-ring-label'), fallback: 'Ring', get: getRing },
    hands: { slot: handsSlot, label: panel.querySelector('#backpack-hands-label'), fallback: 'Hands', get: getHands },
    ...Object.fromEntries(addonSlots.map((type) => ['addon-' + type, {
      slot: panel.querySelector('#backpack-addon-' + type + '-slot'),
      label: panel.querySelector('#backpack-addon-' + type + '-label'),
      fallback: type.charAt(0).toUpperCase() + type.slice(1), get: () => getAddon(type),
    }])),
  };
  const groups = { hotbar: panelHotbar, backpack: backpackSlots, chest: chestSlots, head: [headSlot], feet: [feetSlot], ring: [ringSlot], hands: [handsSlot] };
  const chestStorage = panel.querySelector('#chest-storage');
  const chestCount = panel.querySelector('#chest-count');
  const collectAll = panel.querySelector('#chest-collect-all');
  const chestStatus = panel.querySelector('#chest-status');
  const close = panel.querySelector('[data-close]');
  const armorSlot = panel.querySelector('#backpack-armor').parentElement;
  const game = panel.parentElement;
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

  function renderTooltip() {
    if (!tooltipSlot) return;
    const stack = tooltipSlot === armorSlot ? { id: armorSlot.dataset.item, count: 1 } : stackAt(tooltipSlot);
    const item = ITEMS[stack?.id] ?? EQUIPMENT_ITEMS[stack?.id];
    const anchor = tooltipSlot.getBoundingClientRect();
    const bounds = panel.contains(tooltipSlot) ? panel.getBoundingClientRect() : null;
    if (!item || !anchor.height || (bounds && (!panel.open || anchor.bottom <= bounds.top || anchor.top >= bounds.bottom))) {
      tooltipSlot.removeAttribute('aria-describedby');
      tooltip.hidden = true;
      return;
    }

    const host = bounds ? panel : game;
    if (tooltip.parentElement !== host) host.append(tooltip);
    tooltipName.textContent = item.name + (stack.count > 1 ? ' × ' + stack.count : '');
    tooltipStats.textContent = itemStats(stack.id, item);
    tooltipStats.hidden = !tooltipStats.textContent;
    tooltipDescription.textContent = item.description;
    tooltip.hidden = false;
    tooltipSlot.setAttribute('aria-describedby', tooltip.id);

    const gap = 8;
    const { offsetWidth: width, offsetHeight: height } = tooltip;
    const { clientWidth, clientHeight } = document.documentElement;
    const left = (anchor.left + anchor.right - width) / 2;
    const above = anchor.top - height - gap;
    const top = above >= gap ? above : anchor.bottom + gap;
    tooltip.style.left = Math.max(gap, Math.min(left, clientWidth - width - gap)) + 'px';
    tooltip.style.top = Math.max(gap, Math.min(top, clientHeight - height - gap)) + 'px';
  }

  function showTooltip(slot) {
    tooltipSlot?.removeAttribute('aria-describedby');
    tooltipSlot = slot;
    tooltip.hidden = true;
    renderTooltip();
  }

  for (const slot of [...hudSlots, ...Object.values(groups).flat(), armorSlot]) {
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
  game.addEventListener('pointerdown', () => showTooltip(null), { capture: true });
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
    if (event.pointerType === 'touch' && !dragging && picked === target) showTooltip(target);
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
    else if (group === 'ring' && event.code === 'ArrowDown') handsSlot.focus();
    else if (group === 'addon-hands' && event.code === 'ArrowUp') equipSlots['addon-feet'].slot.focus();
    else if (group === 'addon-hands' && event.code === 'ArrowDown') handsSlot.focus();
    else if (group === 'hands' && event.code === 'ArrowUp') ringSlot.focus();
    else if (group === 'hotbar' && index === HOTBAR_SIZE - 1 && event.code === 'ArrowRight') headSlot.focus();
    else if (group === 'backpack' && index % columns === columns - 1 && event.code === 'ArrowRight') (index >= 12 ? feetSlot : headSlot).focus();
    else if (group === 'hotbar' && event.code === 'ArrowDown') backpackSlots[index].focus();
    else if (group === 'hotbar' && event.code === 'ArrowUp' && chestId) chestSlots[Math.min(index, 3) + 4].focus();
    else if (group === 'backpack' && index < 6 && event.code === 'ArrowUp') panelHotbar[Math.min(index, HOTBAR_SIZE - 1)].focus();
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
      if (event.pointerType === 'touch') showTooltip(slot);
    });
  }

  return {
    clearTooltip: () => showTooltip(null),
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
      for (const [group, { slot, label, fallback, get }] of Object.entries(equipSlots)) {
        const equipped = get?.();
        drawSlots([slot], [equipped && { id: equipped.id, count: 1 }]);
        label.textContent = group === 'ring' && equipped ? 'Root ring [F]'
          : group === 'hands' && equipped ? 'Grappling hook [E]'
          : (equipped?.name ?? fallback);
      }
      if (chestId) {
        const slots = getChest(chestId);
        drawSlots(chestSlots, slots);
        const occupied = slots.filter(Boolean).length;
        chestCount.textContent = occupied + ' / ' + CHEST_SIZE + ' slots';
        collectAll.disabled = occupied === 0;
      }
      renderTooltip();
    },
  };
}
