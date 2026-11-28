import { ITEMS, EQUIPMENT_ITEMS } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';
import { DROP_TYPES, RARITIES } from './loot.js';
import { lootCatalog, sourceLabel } from './loot-catalog.js';

export function createDropsUI(container) {
  const sources = lootCatalog();
  const filters = document.createElement('div');
  filters.className = 'drop-filters';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search items or sources';
  search.setAttribute('aria-label', 'Search drops');
  const select = (label, options) => {
    const control = document.createElement('select');
    control.setAttribute('aria-label', label);
    for (const [value, name] of [['', 'All ' + label.toLowerCase()], ...options]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      control.append(option);
    }
    filters.append(control);
    return control;
  };
  filters.append(search);
  const type = select('Types', Object.entries(DROP_TYPES));
  const rarity = select('Rarities', RARITIES.map(r => [r, r]));
  const kind = select('Sources', [...new Set(sources.map(s => s.kind))].map(s => [s, s]));
  const content = document.createElement('div');
  const empty = document.createElement('p');
  empty.textContent = 'No matching drops.';
  container.append(filters, content, empty);
  const groups = sources.map(s => {
    const region = document.createElement('section');
    region.className = 'drops-biome';
    const title = document.createElement('h3');
    title.textContent = sourceLabel(s);
    const summary = document.createElement('p');
    summary.textContent = s.kind + (s.note ? ' · ' + s.note : '');
    const table = document.createElement('table');
    table.className = 'drops-table';
    const header = document.createElement('thead');
    header.innerHTML = '<tr><th scope="col">Item / type</th><th scope="col">Rarity</th><th scope="col">Roll</th><th scope="col">Qty</th></tr>';
    const body = document.createElement('tbody');
    const rows = s.entries.map(entry => {
      const name = (ITEMS[entry.id] ?? EQUIPMENT_ITEMS[entry.id])?.name ?? entry.id;
      const row = document.createElement('tr');
      const item = document.createElement('td');
      const layout = document.createElement('div');
      layout.className = 'drop-item';
      if (!entry.unavailable) {
        const icon = document.createElement('span');
        setItemIcon(icon, entry.id);
        icon.setAttribute('aria-hidden', 'true');
        layout.append(icon);
      }
      const label = document.createElement('span');
      label.textContent = name;
      const detail = document.createElement('small');
      detail.textContent = DROP_TYPES[entry.category] + (entry.condition ? ' · ' + entry.condition : '');
      label.append(detail);
      layout.append(label);
      item.append(layout);
      const grade = document.createElement('td');
      grade.textContent = entry.rarity;
      grade.dataset.rarity = entry.rarity.toLowerCase();
      const odds = document.createElement('td');
      odds.textContent = entry.unavailable ? 'N/A' : entry.weight != null ? (100 * entry.weight / s.entries.reduce((sum, e) => sum + e.weight, 0)).toFixed(1).replace(/\.0$/, '') + '%*' : (entry.chance * 100) + '%';
      const quantity = document.createElement('td');
      quantity.textContent = entry.min === entry.max ? String(entry.min) : entry.min + '–' + entry.max;
      row.append(item, grade, odds, quantity);
      body.append(row);
      return { row, entry, query: (name + ' ' + sourceLabel(s) + ' ' + s.kind + ' ' + DROP_TYPES[entry.category]).toLowerCase() };
    });
    table.append(header, body);
    region.append(title, summary, table);
    content.append(region);
    return { region, rows, s };
  });
  function filter() {
    const q = search.value.trim().toLowerCase();
    let count = 0;
    for (const { region, rows, s } of groups) {
      for (const { row, entry, query } of rows) {
        row.hidden = !query.includes(q) || Boolean(type.value && entry.category !== type.value) ||
          Boolean(rarity.value && entry.rarity !== rarity.value) || Boolean(kind.value && s.kind !== kind.value);
        if (!row.hidden) count++;
      }
      region.hidden = rows.every(({ row }) => row.hidden);
    }
    empty.hidden = count > 0;
  }
  search.addEventListener('input', filter);
  for (const control of [type, rarity, kind]) control.addEventListener('change', filter);
  filter();
}
