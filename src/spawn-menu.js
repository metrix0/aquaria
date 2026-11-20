import { SPAWN_CATEGORIES } from './gameplay/enemy-spawner.js';

export function createSpawnMenu(panel, spawnEnemy) {
  const grid = panel.querySelector('#spawn-grid');
  const search = panel.querySelector('#spawn-search');
  const empty = panel.querySelector('#spawn-empty');
  const status = panel.querySelector('#spawn-status');
  const groups = [];

  for (const category of SPAWN_CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'spawn-category';
    const title = document.createElement('h3');
    title.textContent = category.name;
    const buttons = document.createElement('div');
    buttons.className = 'spawn-grid';
    const entries = category.entries.map(([kind, name]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => {
        const error = spawnEnemy(kind);
        status.textContent = error || 'Spawned ' + name + ' near your character.';
      });
      buttons.append(button);
      return { button, name: name.toLowerCase() };
    });
    section.append(title, buttons);
    grid.append(section);
    groups.push({ section, entries });
  }

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let any = false;
    for (const { section, entries } of groups) {
      let shown = false;
      for (const entry of entries) {
        entry.button.hidden = !entry.name.includes(query);
        if (!entry.button.hidden) shown = true;
      }
      section.hidden = !shown;
      if (shown) any = true;
    }
    empty.hidden = any;
  });
  panel.addEventListener('close', () => { status.textContent = ''; });
}
