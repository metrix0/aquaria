import { AIR_TANK, ARMOR, ARROW, BOW, BREATH_SECONDS, COBALT_SPEAR, COPPER_PICKAXE, COPPER_SPEAR, IRON_PICKAXE, IRON_SWORD, KELP_DRESSING, REINFORCED_HELMET, SPEAR, SWIMMING_HELMET, WOODEN_DOOR, WORKBENCH } from './content.js';
import { canCraftItem, canCraftTank, equipmentCraftStatus, equippedHelmet } from './gameplay/simulation.js';
import { ITEMS } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';

const recipes = [
  { recipe: AIR_TANK, name: 'Air tank', icon: 'tank' },
  { recipe: WORKBENCH, description: 'Place it from your hotbar to craft advanced gear. Press E, right-click it, or tap Use nearby to open it.' },
  { recipe: SPEAR, description: 'Thrust at nearby creatures to damage them and drive them back.' },
  { recipe: COPPER_SPEAR, description: 'A sturdier spear that deals ' + COPPER_SPEAR.damage + ' damage.' },
  { recipe: IRON_SWORD, description: 'A sweeping blade that deals ' + IRON_SWORD.damage + ' damage.' },
  { recipe: COBALT_SPEAR, description: 'A long thrust that deals ' + COBALT_SPEAR.damage + ' damage and knocks enemies back.' },
  { recipe: BOW, description: 'Fires arrows toward your cursor through air and water.' },
  { recipe: ARROW, name: 'Arrows', description: 'A bundle of four arrows for the bow.' },
  ...Object.values(ARMOR).map((recipe) => ({
    recipe, description: 'Reduces incoming health damage by ' + Math.round(recipe.protection * 100) + '%.',
  })),
  { recipe: REINFORCED_HELMET, description: 'Extends the helmet’s breathing bonus to ' + REINFORCED_HELMET.bonusSeconds + ' seconds.' },
  { recipe: KELP_DRESSING, description: 'Restores up to ' + KELP_DRESSING.heal + ' health. Put it in the hotbar, select it, and click or tap the world to use it.' },
  { recipe: WOODEN_DOOR, description: 'Place it above a solid floor with two blocks of clearance. Opens as you approach.' },
  { recipe: COPPER_PICKAXE, description: 'Carry it in your inventory to mine Deepstone and cobalt ore.' },
  { recipe: IRON_PICKAXE, description: 'Takes 30% less time per block than the copper pickaxe and can mine cobalt and Deepstone.' },
];

export function createCraftingUi(panel, { makeItem, makeTank }) {
  const heading = panel.querySelector('#craft-title');
  const grid = panel.querySelector('#craft-recipes');
  const icon = panel.querySelector('#recipe-icon');
  const title = panel.querySelector('#recipe-title');
  const description = panel.querySelector('#recipe-desc');
  const requirement = panel.querySelector('#recipe-requirement');
  const materials = panel.querySelector('#recipe-cost');
  const craft = panel.querySelector('#craft-recipe');
  const status = panel.querySelector('#craft-status');
  let selected = 0;
  let game;
  let station;

  const availableAt = (recipe) => !recipe.station || recipe.station === station;

  const cards = recipes.map(({ recipe, name = recipe.name ?? ITEMS[recipe.id].name, icon = recipe.id, description }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recipe-tile';
    const symbol = document.createElement('span');
    setItemIcon(symbol, icon);
    symbol.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'recipe-label';
    label.textContent = name;
    button.append(symbol, label);
    button.addEventListener('click', () => {
      selected = index;
      status.textContent = '';
      render(game, station);
    });
    grid.append(button);
    return { recipe, name, icon, description, button };
  });

  function render(state, activeStation) {
    game = state;
    station = activeStation;
    heading.textContent = station === WORKBENCH.id ? ITEMS[WORKBENCH.id].name : 'Crafting';
    if (!availableAt(cards[selected].recipe)) selected = 0;
    const { recipe, name, icon: itemIcon, description: detail } = cards[selected];
    const tank = recipe === AIR_TANK;
    const equipmentStatus = recipe.equipment ? equipmentCraftStatus(game, recipe) : null;
    const equipped = (tank && game.progress.airTank) || equipmentStatus === 'Equipped' || equipmentStatus === 'Already upgraded';
    const bonus = equippedHelmet(game)?.bonusSeconds ?? 0;
    const cost = Object.entries(recipe.cost);
    const ready = cards.map(({ recipe }) => recipe === AIR_TANK ? canCraftTank(game) : canCraftItem(game, recipe, station));

    for (const [index, { button, recipe }] of cards.entries()) {
      button.hidden = !availableAt(recipe);
      button.setAttribute('aria-pressed', String(index === selected));
      button.toggleAttribute('data-ready', ready[index]);
    }
    title.textContent = name;
    setItemIcon(icon, itemIcon);
    description.textContent = tank
      ? `Extends a dive from ${BREATH_SECONDS + bonus} to ${AIR_TANK.breathSeconds + bonus} seconds. Equips when crafted.`
      : detail + (recipe.equipment ? ' Equips when crafted.' : '');
    requirement.hidden = !recipe.requires;
    if (recipe.requires) {
      const base = (ARMOR[recipe.requires] ?? SWIMMING_HELMET).name;
      requirement.textContent = 'Upgrades your equipped ' + base.toLowerCase() + '.';
    }
    materials.replaceChildren(...cost.map(([id, count]) => {
      const row = document.createElement('li');
      const symbol = document.createElement('span');
      setItemIcon(symbol, id);
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
    craft.textContent = equipmentStatus ?? (equipped ? 'Equipped'
      : missing ? 'Missing materials'
      : craft.disabled ? 'Inventory full'
      : 'Craft ' + ((recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '') + name.toLowerCase());
  }

  craft.addEventListener('click', () => {
    const { recipe, name } = cards[selected];
    if (recipe === AIR_TANK) {
      if (makeTank()) status.textContent = 'Air tank equipped.';
    } else if (makeItem(recipe)) {
      const amount = (recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '';
      status.textContent = recipe.equipment
        ? name + ' equipped.'
        : 'Crafted ' + amount + name.toLowerCase() + '.';
    }
  });
  panel.addEventListener('close', () => { status.textContent = ''; });

  return { render };
}
