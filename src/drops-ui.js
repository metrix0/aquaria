import { ITEMS } from './inventory.js';
import { WILD_CHEST_CATEGORIES, WILD_CHEST_LOOT_TABLES } from './world/wild-chest.js';

export function createDropsUI(container) {
  for (const table of Object.values(WILD_CHEST_LOOT_TABLES)) {
    const region = document.createElement('section');
    region.className = 'drops-biome';
    const title = document.createElement('h3');
    title.textContent = table.name;
    const summary = document.createElement('p');
    summary.textContent = table.minDrops + '–' + table.maxDrops +
      ' different items per chest · One resource or utility guaranteed · At least one addon across the biome.';
    const caption = document.createElement('p');
    caption.className = 'drops-note';
    caption.textContent = 'Chances show base roll weights. Guarantees and no-duplicate rolls affect actual odds.';
    const grid = document.createElement('table');
    grid.className = 'drops-table';
    const header = document.createElement('thead');
    header.innerHTML = '<tr><th scope="col">Item</th><th scope="col">Chance</th><th scope="col">Quantity</th></tr>';
    const body = document.createElement('tbody');
    for (const category of WILD_CHEST_CATEGORIES) {
      const entries = table.entries.filter((entry) => entry.category === category.id);
      if (!entries.length) continue;
      const headingRow = document.createElement('tr');
      headingRow.className = 'drops-category';
      const headingCell = document.createElement('th');
      headingCell.scope = 'rowgroup';
      headingCell.colSpan = 3;
      const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      headingCell.textContent = category.name + ' — ' + total + '%';
      headingRow.append(headingCell);
      body.append(headingRow);
      for (const entry of entries) {
        const row = document.createElement('tr');
        const item = document.createElement('td');
        item.textContent = ITEMS[entry.id]?.name ?? entry.id;
        const chance = document.createElement('td');
        chance.textContent = entry.weight + '%';
        const amount = document.createElement('td');
        amount.textContent = entry.min === entry.max ? String(entry.min) : entry.min + '–' + entry.max;
        row.append(item, chance, amount);
        body.append(row);
      }
    }
    grid.append(header, body);
    region.append(title, summary, grid, caption);
    container.append(region);
  }
}
