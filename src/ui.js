import { ARMOR } from './content.js';
import { ISLAND_DEEPSTONE_ROW, isDryIslandCave } from './world/island-cave.js';
import { JUNGLE_CAVE, isDryJungleCave } from './world/jungle-cave.js';
import { TILE, WEST_EXTENSION } from './world/generation.js';
import { createCharacterEditor } from './character-editor.js';
import { createCraftingUi } from './crafting-ui.js';
import { createDeployUi } from './deploy-ui.js';
import { createInventoryUi, setItemIcon } from './inventory-ui.js';
import { GRAPPLING_HOOK, HOOKS, ITEMS } from './inventory.js';
import { SPELLS, spellCooldown } from './spells.js';
import { createItemsMenu } from './items-menu.js';
import { createDropsUI } from './drops-ui.js';
import { createClassesUI } from './classes-ui.js';
import { createSpawnMenu } from './spawn-menu.js';
import { ringCooldown } from './gameplay/root-ring.js';
import { CLASS_DEFS, equippedSkill, SKILL_KEYS } from './classes.js';
import { WARDEN_SKILLS } from './gameplay/warden.js';
import { SCHOLAR_SKILLS, feastChoice } from './gameplay/scholar.js';
import { WAYFARER_SKILLS } from './gameplay/wayfarer.js';
import { BOW } from './content.js';
import { MAX_HEALTH, playerStatusEffects } from './gameplay/player.js';
import { hudVisibility } from './hud-state.js';
import { nearestDowned, REVIVE_SECONDS } from './gameplay/revival.js';
import { areaDepth, nearestItem, oxygenCapacity } from './gameplay/simulation.js';

export function createUI(actions, version) {
  const byId = (id) => document.getElementById(id);
  const fields = Object.fromEntries([
    'depth', 'depth-label', 'depth-meter', 'health-label', 'health-fill', 'hud-context', 'air-label', 'air-fill', 'oxygen-meter',
    'interact', 'feedback', 'backpack-chest-label', 'room-status', 'room-invitation', 'room-create', 'room-join', 'room-copy',
    'room-leave', 'room-join-form', 'multiplayer',
  ].map((id) => [id, byId(id)]));
  const panels = [...document.querySelectorAll('dialog')];
  const craftingUI = createCraftingUi(byId('craft-panel'), actions);
  const itemsMenu = createItemsMenu(byId('items-panel'), actions.giveItem);
  createDropsUI(byId('drops-content'));
  const classesUI = createClassesUI(byId('classes-panel'), byId('skilltree-panel'), {
    ...actions, notify: (message) => notify(message), openClasses: () => open('classes-panel'),
  });
  createSpawnMenu(byId('spawn-panel'), actions.spawnEnemy);
  const characterEditor = createCharacterEditor(byId('customize-panel'), actions.customize);
  const inventoryUI = createInventoryUi(byId('backpack-panel'), {
    getInventory: actions.getInventory,
    getChest: actions.getChest,
    moveInventoryStack: actions.moveInventoryStack,
    collectChest: actions.collectChest,
    getSnorkel: actions.getSnorkel,
    getFeet: actions.getFeet,
    getRing: actions.getRing,
    getOffhand: actions.getOffhand,
    getAddon: actions.getAddon,
    onMove: actions.inventoryChanged,
    onSelect: actions.select,
    canMove: actions.canMoveInventory,
  });
  const touch = matchMedia('(pointer: coarse)').matches;
  let toastTimer;
  let ringWasCharging = false;
  let ringFlashUntil = 0;
  const ringSlot = byId('cast-ring');
  const ringTimer = ringSlot.querySelector('b');
  const hookSlot = byId('use-hook');
  // Reuse the inventory's actual grappling-hook sprite instead of the obsolete CSS glyph.
  setItemIcon(hookSlot.querySelector('span'), GRAPPLING_HOOK.id);
  const wardenSkills = byId('warden-skills');
  const skillButtons = [...document.querySelectorAll('[data-skill-slot]')];
  const skillDefs = [...WARDEN_SKILLS, ...WAYFARER_SKILLS, ...SCHOLAR_SKILLS];
  const skillGlyphs = { shieldRush: '\u26e8', rage: '\u2694', aegisAura: '\u2727', horizonShot: '\u27b6', counter: '\u21c4', huntersMark: '\u25ce', hyperBeam: '\u2726', beastFlask: '\u2697', feast: '\u2668' };
  const braceLabel = byId('warden-brace');
  const statusEffects = byId('status-effects');
  const statusTooltip = byId('status-tooltip');
  const statusTitle = statusTooltip?.querySelector('strong');
  const statusDesc = statusTooltip?.querySelector('em');
  const statusNodes = new Map();
  let hoveredEffectId = null;
  let lastEffects = [];

  function renderStatusTooltip() {
    if (!statusTooltip) return;
    const active = !panels.some((panel) => panel.open) && hoveredEffectId
      ? lastEffects.find((effect) => effect.id === hoveredEffectId)
      : null;
    const node = active && statusNodes.get(active.id);
    if (!active || !node) {
      statusTooltip.hidden = true;
      return;
    }
    const unit = active.seconds === 1 ? 'second' : 'seconds';
    const description = `${active.detail} Duration ${active.seconds} ${unit}.`;
    if (statusTitle.textContent !== active.title) statusTitle.textContent = active.title;
    if (statusDesc.textContent !== description) statusDesc.textContent = description;
    statusTooltip.hidden = false;
    const anchor = node.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = statusTooltip;
    const { clientWidth, clientHeight } = document.documentElement;
    const left = Math.max(8, Math.min(anchor.left - width - 8, clientWidth - width - 8));
    const top = Math.max(8, Math.min(anchor.top + (anchor.height - height) / 2, clientHeight - height - 8));
    statusTooltip.style.left = left + 'px';
    statusTooltip.style.top = top + 'px';
  }

  function updateStatusEffects(game) {
    if (!statusEffects) return;
    const active = playerStatusEffects(game.player);
    lastEffects = active;
    const activeIds = new Set(active.map((effect) => effect.id));
    for (const [id, node] of statusNodes) {
      if (!activeIds.has(id)) {
        node.remove();
        statusNodes.delete(id);
        if (hoveredEffectId === id) hoveredEffectId = null;
      }
    }
    for (const [index, effect] of active.entries()) {
      let node = statusNodes.get(effect.id);
      if (!node) {
        node = document.createElement('button');
        node.type = 'button';
        node.className = 'status-effect';
        node.dataset.effect = effect.id;
        const icon = document.createElement('span');
        icon.className = 'status-icon status-icon-' + effect.id;
        icon.setAttribute('aria-hidden', 'true');
        const duration = document.createElement('b');
        duration.setAttribute('aria-hidden', 'true');
        node.append(icon, duration);
        node.addEventListener('pointerenter', ({ pointerType }) => {
          if (pointerType !== 'touch') {
            hoveredEffectId = effect.id;
            renderStatusTooltip();
          }
        });
        node.addEventListener('pointerleave', ({ pointerType }) => {
          if (pointerType !== 'touch' && hoveredEffectId === effect.id && !node.matches(':focus-visible')) {
            hoveredEffectId = null;
            renderStatusTooltip();
          }
        });
        node.addEventListener('focus', () => {
          if (node.matches(':focus-visible')) {
            hoveredEffectId = effect.id;
            renderStatusTooltip();
          }
        });
        node.addEventListener('blur', () => {
          if (hoveredEffectId === effect.id && !node.matches(':hover')) {
            hoveredEffectId = null;
            renderStatusTooltip();
          }
        });
        node.addEventListener('click', (event) => {
          if (event.pointerType === 'touch') {
            hoveredEffectId = hoveredEffectId === effect.id ? null : effect.id;
            renderStatusTooltip();
          }
        });
        statusNodes.set(effect.id, node);
      }
      if (statusEffects.children[index] !== node) statusEffects.insertBefore(node, statusEffects.children[index] ?? null);
      const timer = node.lastElementChild;
      const timerText = effect.seconds + 's';
      if (timer.textContent !== timerText) timer.textContent = timerText;
      const label = `${effect.title}, ${effect.seconds} ${effect.seconds === 1 ? 'second' : 'seconds'} remaining`;
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
    }
    renderStatusTooltip();
  }

  function updateHook() {
    const item = actions.getOffhand();
    hookSlot.hidden = !item;
    if (!item) return;
    if (hookSlot.dataset.item !== item.id) {
      hookSlot.dataset.item = item.id;
      setItemIcon(hookSlot.querySelector('span'), item.id);
      const label = Object.hasOwn(HOOKS, item.id) ? item.name + ' / Interact' : item.name + ' (passive) / Interact';
      hookSlot.setAttribute('aria-label', label);
      hookSlot.title = label;
    }
  }

  const spellSlots = document.querySelectorAll('#hotbar-slots .slot');
  function updateSpellTimers(game) {
    spellSlots.forEach((slot, i) => {
      const item = ITEMS[game.inventory.hotbar[i]?.id];
      const manaReady = item?.form === 'tome' && game.player.skillBonuses?.manaCapacity && game.player.mana >= SPELLS[item.spell]?.cooldown;
      const remaining = manaReady ? 0 : Math.ceil(spellCooldown(game, item));
      if (remaining > 0) slot.dataset.spellCooldown = remaining + 's';
      else delete slot.dataset.spellCooldown;
    });
  }

  function updateRing(game) {
    const equipped = Boolean(actions.getRing());
    ringSlot.hidden = !equipped;
    const seconds = equipped ? Math.ceil(ringCooldown(game)) : 0;
    if (equipped && ringWasCharging && !seconds) ringFlashUntil = game.elapsed + .9;
    if (!equipped) ringFlashUntil = 0;
    ringWasCharging = seconds > 0;
    ringSlot.toggleAttribute('data-charging', ringWasCharging);
    if (ringSlot.getAttribute('aria-disabled') !== String(ringWasCharging)) {
      ringSlot.setAttribute('aria-disabled', String(ringWasCharging));
    }
    ringSlot.toggleAttribute('data-recharged', equipped && game.elapsed < ringFlashUntil);
    const label = seconds ? `Root Ring recharging, ${seconds} seconds` : 'Cast Root Ring';
    if (ringSlot.getAttribute('aria-label') !== label) ringSlot.setAttribute('aria-label', label);
    const text = seconds ? seconds + 's' : '';
    if (ringTimer.textContent !== text) ringTimer.textContent = text;
  }

  function setText(id, value) {
    const element = fields[id];
    if (element && element.textContent !== value) element.textContent = value;
  }

  function notify(message) {
    fields.feedback.textContent = message;
    fields.feedback.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { fields.feedback.hidden = true; }, 2700);
  }

  function open(id, source) {
    const panel = byId(id);
    if (panel.open) {
      panel.close();
      return;
    }
    for (const other of panels) if (other.open) other.close();
    inventoryUI.clearTooltip();
    if (id === 'backpack-panel') inventoryUI.showChest(source);
    if (id === 'items-panel') itemsMenu.selectTab('all');
    actions.beforePanel(id, source);
    if (id === 'classes-panel') classesUI.renderClasses();
    if (id === 'skilltree-panel') classesUI.renderTree();
    panel.showModal();
  }

  byId('version').textContent = 'v' + version;
  byId('backpack').addEventListener('click', () => open('backpack-panel'));
  byId('customize').addEventListener('click', () => open('customize-panel'));
  byId('craft').addEventListener('click', () => open('craft-panel'));
  byId('items').addEventListener('click', () => open('items-panel'));
  byId('spawn').addEventListener('click', () => open('spawn-panel'));
  byId('drops').addEventListener('click', () => open('drops-panel'));
  byId('classes').addEventListener('click', () => open('classes-panel'));
  byId('skilltree').addEventListener('click', () => open('skilltree-panel'));
  byId('backpack-class').addEventListener('click', () => open('skilltree-panel'));
  byId('debug-souls').addEventListener('click', actions.grantDebugSouls);
  byId('pause')?.addEventListener('click', () => open('pause-panel'));
  byId('multiplayer').addEventListener('click', () => open('room-panel'));
  byId('resume').addEventListener('click', () => byId('pause-panel').close());
  byId('reset-world').addEventListener('click', actions.restart);
  createDeployUi(byId('deploy'), byId('deploy-age'), byId('deploy-status'), notify);
  const zoomOut = byId('zoom-out');
  const zoomIn = byId('zoom-in');
  zoomOut.addEventListener('click', () => actions.zoomBy(-1));
  zoomIn.addEventListener('click', () => actions.zoomBy(1));
  const godMode = byId('god-mode');
  godMode.addEventListener('click', actions.toggleGodMode);
  const flightSpeed = byId('flight-speed');
  const flightSpeedValue = byId('flight-speed-value');
  const flightSlower = byId('flight-slower');
  const flightFaster = byId('flight-faster');
  flightSlower.addEventListener('click', () => actions.adjustFlightSpeed(-1));
  flightFaster.addEventListener('click', () => actions.adjustFlightSpeed(1));
  const weatherValue = byId('weather-value');
  byId('weather-prev').addEventListener('click', () => actions.adjustWeather(-1));
  byId('weather-next').addEventListener('click', () => actions.adjustWeather(1));
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
    setZoom(percent, atMinimum, atMaximum) {
      byId('camera-zoom').value = percent + '%';
      zoomOut.disabled = atMinimum;
      zoomIn.disabled = atMaximum;
    },
    godMode(enabled) {
      godMode.setAttribute('aria-pressed', String(enabled));
      flightSpeed.hidden = !enabled;
    },
    setFlightSpeed(multiplier, atMinimum, atMaximum) {
      flightSpeedValue.value = 'Speed ' + multiplier + '×';
      flightSlower.disabled = atMinimum;
      flightFaster.disabled = atMaximum;
    },
    setWeather(label) {
      weatherValue.value = label;
    },
    close: (id) => byId(id).close(),
    activePanel: () => panels.find((panel) => panel.open)?.id,
    updateCraft: craftingUI.render,
    openChestId: inventoryUI.openChestId,
    updateCustomize: (game) => characterEditor.open(game.player.appearance),
    updateBackpack(game) {
      const classButton = byId('backpack-class');
      const activeClass = CLASS_DEFS[game.classes.active];
      classButton.hidden = !activeClass;
      classButton.textContent = activeClass?.name ?? '';
      classButton.style.setProperty('--class-accent', activeClass?.accent ?? '');
      const armor = ARMOR[game.player.armor];
      const icon = byId('backpack-armor');
      const slot = icon.parentElement;
      icon.hidden = !armor;
      if (armor) {
        icon.className = 'item item-' + armor.id;
        slot.dataset.item = armor.id;
        slot.tabIndex = 0;
        slot.setAttribute('role', 'img');
        slot.setAttribute('aria-label', armor.name);
        slot.removeAttribute('aria-hidden');
      } else {
        delete slot.dataset.item;
        slot.removeAttribute('tabindex');
        slot.removeAttribute('role');
        slot.removeAttribute('aria-label');
        slot.setAttribute('aria-hidden', 'true');
      }
      setText('backpack-chest-label', armor ? (game.player.perfectArmor ? 'Perfect ' : '') + armor.name : 'Chest');
    },
    clearNotice() {
      clearTimeout(toastTimer);
      fields.feedback.hidden = true;
    },
    select(slot) {
      inventoryUI.render(slot);
      byId('explorers-map').hidden = actions.getInventory().hotbar[slot]?.id !== 'explorers-map';
    },
    notify,
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
      updateRing(game);
      updateSpellTimers(game);
      updateHook();
      updateStatusEffects(game);
       const health = Math.round(game.player.health / MAX_HEALTH * 100);
      const healthValue = health + '%';
      const depth = areaDepth(game);
      const { oxygenPercent: air, showOxygen, showDepth } =
        hudVisibility(game.player.oxygen, oxygenCapacity(game), depth);
      const airValue = air + '%';
      fields['oxygen-meter'].hidden = !showOxygen;
      fields['depth-meter'].hidden = !showDepth;
      fields['hud-context'].hidden = !showOxygen && !showDepth;
      if (showDepth) setText('depth', depth + ' m');
      const row = Math.floor((game.player.y + game.player.height / 2) / TILE);
      const column = Math.floor(game.player.x / TILE) - WEST_EXTENSION;
      const zone = isDryIslandCave(column, row)
        ? (row >= ISLAND_DEEPSTONE_ROW ? 'UNDERGROUND' : 'CAVES')
        : isDryJungleCave(column, row)
          ? (row >= 412 ? 'SANCTUM' : row >= JUNGLE_CAVE.deepstoneRow ? 'TEMPLE' : 'JUNGLE CAVE')
          : 'DEPTH';
      setText('depth-label', zone);
      setText('health-label', String(health));
      const healthTrack = fields['health-fill'].parentElement;
      const player = game.player;
      const manaBar = byId('mana-meter'), manaCap = player.skillBonuses?.manaCapacity || 0;
      manaBar.hidden = !manaCap;
      if (manaCap) {
        const mana = Math.max(0,Math.min(manaCap,player.mana ?? manaCap));
        byId('mana-fill').style.width = (mana/manaCap*100)+'%';
        byId('mana-label').textContent = Math.floor(mana)+' / '+manaCap;
        manaBar.setAttribute('aria-valuenow',String(Math.floor(mana)));
      }
      const bloodrush = Boolean(player.skillBonuses?.missingHealthAttack && health < 100);
      fields['health-fill'].classList.toggle('bloodrush', bloodrush);
      if (bloodrush) { const hue = String(Math.round((100 - health) * .38)) + 'deg'; if (fields['health-fill'].style.getPropertyValue('--rage-hue') !== hue) fields['health-fill'].style.setProperty('--rage-hue', hue); }
      let visible = false;
      for (const [index, button] of skillButtons.entries()) {
        const node = equippedSkill(game.classes, index);
        const skill = node && skillDefs.find(def => def.id === node.ability);
        button.hidden = !skill;
        if (!skill) continue;
        const cd = Math.ceil(player.wardenCooldowns?.[skill.id] || 0);
        const active = Math.ceil(player[skill.timer] || 0);
        const glyph = button.querySelector('span'), timer = button.querySelector('b');
        const symbol = skillGlyphs[skill.id] ?? node.name.slice(0, 1);
        const text = skill.id === 'feast' && active ? 'Pick' : skill.id === 'huntersMark' && active ? '!' : active ? active + 's' : cd ? cd + 's' : '';
        const label = SKILL_KEYS[index] + ' ' + node.name + (text ? ' (' + text + ')' : '');
        if (glyph.textContent !== symbol) glyph.textContent = symbol;
        if (timer.textContent !== text) timer.textContent = text;
        if (button.getAttribute('aria-label') !== label) {
          button.setAttribute('aria-label', label);
          button.title = label;
        }
        button.disabled = Boolean(cd || (skill.id==='hyperBeam' && (player.mana||0)<5));
        button.classList.toggle('active', Boolean(active));
      }
      braceLabel.hidden = !player.bracing;
      if (player.bracing) { visible = true; const text = player.braceTime >= 1.5 ? 'Guarded' : 'Bracing ' + player.braceTime.toFixed(1) + '/1.5s'; if (braceLabel.textContent !== text) braceLabel.textContent = text; }
      const wayfarerStatus=byId('wayfarer-status');
      const draw=game.bowDraw;
      const labels=[];
      if (draw) labels.push(draw.extra ? 'Overdraw ready' : draw.elapsed>=BOW.drawTime-1e-6 ? (player.skillBonuses?.extraDraw ? 'Ready / Overdraw '+Math.min(100,Math.round((draw.elapsed-BOW.drawTime)*100))+'%' : 'Ready') : 'Drawing '+Math.round(draw.elapsed/BOW.drawTime*100)+'%');
      if (player.skillBonuses?.heat) labels.push('Heat +'+Math.round((player.heatBonus||0)*100)+'%');
      if (player.catching) labels.push('Ready to catch');
      if(player.feastSelecting) labels.push('Feast: '+feastChoice(player)+' (press skill again)');
      const statusText=labels.join(' | ');
      if(wayfarerStatus.textContent!==statusText)wayfarerStatus.textContent=statusText;
      wayfarerStatus.hidden=!statusText;
      wardenSkills.hidden = !visible && !statusText;
      if (healthTrack.getAttribute('aria-valuenow') !== String(health)) {
        healthTrack.setAttribute('aria-valuenow', String(health));
        fields['health-fill'].style.width = healthValue;
        fields['health-fill'].classList.toggle('low', health <= 25);
      }
      setText('air-label', airValue);
      const fill = fields['air-fill'];
      if (fill.style.width !== airValue) {
        fill.style.width = airValue;
        fill.classList.toggle('low', air <= 25);
        fill.parentElement.setAttribute('aria-valuenow', String(air));
      }
      const prompt = fields.interact;
      const down = game.player.downed;
      const ally = nearestDowned(game.player, game.wayfarerPeers);
      if (down || ally) {
        const state = down ?? ally.downed;
        const seconds = Math.ceil(state.remaining);
        const percent = Math.min(100, Math.floor(state.progress / REVIVE_SECONDS * 100));
        const action = down ? (state.reviver ? 'Being revived · ' + percent + '%' : 'Respawning in ' + seconds + 's')
          : (state.reviver ? 'Reviving · ' + percent + '% · timer paused' : (touch ? 'Hold interact' : 'Hold E') + ' to revive · ' + seconds + 's');
        prompt.hidden = false;
        prompt.querySelector('kbd').hidden = true;
        const label = prompt.querySelector('span');
        if (label.textContent !== action) label.textContent = action;
        return;
      }
      const focusedItem = panels.some((panel) => panel.open) ? null : nearestItem(game);
      prompt.hidden = !focusedItem;
      if (focusedItem) {
        prompt.querySelector('kbd').hidden = touch;
        const label = prompt.querySelector('span');
        const action = (focusedItem.kind === 'mermaid' ? 'Sing with ' : 'Open ') + focusedItem.name.toLowerCase();
        if (label.textContent !== action) label.textContent = action;
      }
    },
  };
}
