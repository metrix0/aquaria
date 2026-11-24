import { ARROW, KELP_DRESSING, POISON_ARROW, SNORKELS, FEET_GEAR } from './content.js';
import { EQUIPMENT_ITEMS, GRAPPLING_HOOK, ITEMS, ROOT_RING } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';

const GEAR_IDS = new Set([GRAPPLING_HOOK.id, 'explorers-map', 'glowshroom-torch', 'rope-bundle']);
const CONSUMABLE_IDS = new Set([KELP_DRESSING.id, 'raw-fish', 'cooked-fish', 'raw-crab', 'cooked-crab']);

export function itemCategory(id, item) {
  if (item?.weapon || id === ARROW.id || id === POISON_ARROW.id || id === ROOT_RING.id) return 'weapons';
  if (
    item?.pickaxe ||
    item?.addonSlot ||
    Object.hasOwn(EQUIPMENT_ITEMS, id) ||
    Object.hasOwn(SNORKELS, id) ||
    Object.hasOwn(FEET_GEAR, id) ||
    GEAR_IDS.has(id)
  ) return 'gear';
  if (item?.food || CONSUMABLE_IDS.has(id)) return 'consumables';
  if (item?.block || id === 'door') return 'blocks';
  return 'materials';
}

export function createItemsMenu(panel, giveItem) {
  const grid = panel.querySelector('#items-grid');
  const tabs = [...(panel.querySelectorAll('#items-tabs [role="tab"]') ?? [])];
  const search = panel.querySelector('#item-search');
  const quantity = panel.querySelector('#item-quantity');
  const empty = panel.querySelector('#items-empty');
  const status = panel.querySelector('#items-status');
  let activeTab = 'all';

  const catalog = Object.entries({ ...ITEMS, ...EQUIPMENT_ITEMS })
    .sort(([, left], [, right]) => left.name.localeCompare(right.name));
  const buttons = catalog.map(([id, item]) => {
    const equipment = Object.hasOwn(EQUIPMENT_ITEMS, id);
    const category = itemCategory(id, item);
    const button = document.createElement('button');
    button.type = 'button';
    const icon = document.createElement('span');
    setItemIcon(icon, item.icon ?? id);
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = item.name;
    button.append(icon, label);
    button.addEventListener('click', () => {
      if (!equipment && !quantity.reportValidity()) return;
      const amount = equipment ? 1 : quantity.valueAsNumber;
      if (!Number.isSafeInteger(amount)) {
        status.textContent = 'Enter a smaller quantity.';
        return;
      }
      const error = giveItem(id, amount);
      status.textContent = error ?? (equipment ? item.name + ' equipped.' : 'Added ' + amount + ' × ' + item.name + '.');
    });
    grid.append(button);
    return { button, category, name: item.name.toLowerCase() };
  });

  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    for (const { button, category, name } of buttons) {
      const matchesTab = activeTab === 'all' || category === activeTab;
      button.hidden = !matchesTab || !name.includes(query);
    }
    empty.hidden = buttons.some(({ button }) => !button.hidden);
  }

  function selectTab(tab) {
    activeTab = tab || 'all';
    for (const tabButton of tabs) {
      tabButton.setAttribute('aria-selected', String(tabButton.dataset.tab === activeTab));
    }
    applyFilter();
  }

  for (const tabButton of tabs) {
    tabButton.addEventListener('click', () => selectTab(tabButton.dataset.tab));
  }
  search.addEventListener('input', applyFilter);
  panel.addEventListener('close', () => {
    status.textContent = '';
    selectTab('all');
  });

  selectTab('all');
  return { selectTab };
}
