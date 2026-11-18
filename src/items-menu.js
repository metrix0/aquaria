import { EQUIPMENT_ITEMS, ITEMS } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';

export function createItemsMenu(panel, giveItem) {
  const grid = panel.querySelector('#items-grid');
  const search = panel.querySelector('#item-search');
  const quantity = panel.querySelector('#item-quantity');
  const empty = panel.querySelector('#items-empty');
  const status = panel.querySelector('#items-status');
  const catalog = Object.entries({ ...ITEMS, ...EQUIPMENT_ITEMS })
    .sort(([, left], [, right]) => left.name.localeCompare(right.name));
  const buttons = catalog.map(([id, item]) => {
    const equipment = Object.hasOwn(EQUIPMENT_ITEMS, id);
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
    return { button, name: item.name.toLowerCase() };
  });

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    for (const { button, name } of buttons) button.hidden = !name.includes(query);
    empty.hidden = buttons.some(({ button }) => !button.hidden);
  });
  panel.addEventListener('close', () => { status.textContent = ''; });
}
