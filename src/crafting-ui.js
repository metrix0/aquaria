import { AIR_TANK, ARROW, BOW, BREATH_SECONDS, COPPER_PICKAXE, COPPER_SPEAR, SPEAR, SWIMMING_HELMET, WOODEN_DOOR } from './content.js';
import { canCraftItem, canCraftTank } from './gameplay/simulation.js';
import { ITEMS } from './inventory.js';

const recipes = [
  { recipe: AIR_TANK, name: 'Air tank', icon: 'tank' },
  { recipe: WOODEN_DOOR, description: 'Place it above a solid floor with two blocks of clearance. Opens as you approach.' },
  { recipe: COPPER_PICKAXE, description: 'Equip it in the hotbar to mine Deepstone and cobalt ore.' },
  { recipe: SPEAR, description: 'Thrust at nearby creatures to damage them and drive them back.' },
  { recipe: COPPER_SPEAR, description: 'A sturdier spear with longer reach and heavier damage.' },
  { recipe: BOW, description: 'Fires arrows toward your cursor through air and water.' },
  { recipe: ARROW, name: 'Arrows', description: 'A bundle of four arrows for the bow.' },
];

export function createCraftingUi(panel, { makeItem, makeTank }) {
  const grid = panel.querySelector('#craft-recipes');
  const icon = panel.querySelector('#recipe-icon');
  const title = panel.querySelector('#recipe-title');
  const description = panel.querySelector('#recipe-desc');
  const materials = panel.querySelector('#recipe-cost');
  const craft = panel.querySelector('#craft-recipe');
  const status = panel.querySelector('#craft-status');
  let selected = 0;
  let game;

  const cards = recipes.map(({ recipe, name = ITEMS[recipe.id].name, icon = recipe.id, description }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recipe-tile';
    const symbol = document.createElement('span');
    symbol.className = 'item item-' + icon;
    symbol.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'recipe-label';
    label.textContent = name;
    button.append(symbol, label);
    button.addEventListener('click', () => {
      selected = index;
      status.textContent = '';
      render(game);
    });
    grid.append(button);
    return { recipe, name, icon, description, button };
  });

  function render(state) {
    game = state;
    const { recipe, name, icon: itemIcon, description: detail } = cards[selected];
    const tank = recipe === AIR_TANK;
    const equipped = tank && game.progress.airTank;
    const bonus = game.progress.swimmingHelmet ? SWIMMING_HELMET.bonusSeconds : 0;
    const cost = Object.entries(recipe.cost);
    const ready = cards.map(({ recipe }) => recipe === AIR_TANK ? canCraftTank(game) : canCraftItem(game, recipe));

    for (const [index, { button }] of cards.entries()) {
      button.setAttribute('aria-pressed', String(index === selected));
      button.toggleAttribute('data-ready', ready[index]);
    }
    title.textContent = name;
    icon.className = 'item item-' + itemIcon;
    description.textContent = tank
      ? `Extends a dive from ${BREATH_SECONDS + bonus} to ${AIR_TANK.breathSeconds + bonus} seconds. Equips when crafted.`
      : detail;
    materials.replaceChildren(...cost.map(([id, count]) => {
      const row = document.createElement('li');
      const symbol = document.createElement('span');
      symbol.className = 'item item-' + id;
      symbol.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = ITEMS[id].name;
      const quantity = document.createElement('strong');
      const owned = game.inventory.count(id);
      quantity.textContent = owned + ' / ' + count;
      quantity.setAttribute('aria-label', owned + ' of ' + count + ' required');
      row.toggleAttribute('data-missing', !equipped && owned < count);
      row.append(symbol, label, quantity);
      return row;
    }));

    const missing = cost.some(([id, count]) => game.inventory.count(id) < count);
    craft.disabled = !ready[selected];
    craft.textContent = equipped ? 'Equipped'
      : missing ? 'Missing materials'
      : craft.disabled ? 'Inventory full'
      : 'Craft ' + ((recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '') + name.toLowerCase();
  }

  craft.addEventListener('click', () => {
    const { recipe, name } = cards[selected];
    if (recipe === AIR_TANK) {
      if (makeTank()) status.textContent = 'Air tank equipped.';
    } else if (makeItem(recipe)) {
      const amount = (recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '';
      status.textContent = 'Crafted ' + amount + name.toLowerCase() + '.';
    }
  });
  panel.addEventListener('close', () => { status.textContent = ''; });

  return { render };
}
