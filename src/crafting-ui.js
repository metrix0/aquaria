import { ARMOR, SALVAGE_RECIPES, ARROW, BOW, BREATH_SECONDS, COBALT_SNORKEL, COBALT_SPEAR, COOKED_CRAB, COOKED_FISH, COPPER_PICKAXE, COPPER_SNORKEL, COPPER_SPEAR, FIREPLACE, IRON_PICKAXE, IRON_SNORKEL, IRON_SWORD, KELP_DRESSING, SPEAR, WOODEN_DOOR, WORKBENCH } from './content.js';
import { canCraftItem, craftMaterialCount, equipmentCraftStatus } from './gameplay/simulation.js';
import { ITEMS } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';

const recipes = [
  ...SALVAGE_RECIPES.map((recipe) => ({ recipe, name: recipe.name, description: recipe.description })),
  ...[COPPER_SNORKEL, IRON_SNORKEL, COBALT_SNORKEL].map((recipe) => ({
    recipe, description: 'Lets you stay underwater for ' + (BREATH_SECONDS + recipe.bonusSeconds) + ' seconds.',
  })),
  { recipe: WORKBENCH, description: 'Place it from your hotbar to craft advanced gear. Press E, right-click it, or tap Use nearby to open it.' },
  { recipe: FIREPLACE, description: 'Place it from your hotbar to cook raw fish and crab. Press E, right-click it, or tap Use nearby to cook.' },
  { recipe: COOKED_FISH, description: 'Cooked over the fire. Restores ' + COOKED_FISH.oxygen + ' seconds of oxygen with no poison risk.' },
  { recipe: COOKED_CRAB, description: 'Roasted crab meat. Restores up to ' + COOKED_CRAB.heal + ' health with no poison risk.' },
  { recipe: SPEAR, description: 'Thrust at nearby creatures to damage them and drive them back.' },
  { recipe: COPPER_SPEAR, description: 'A sturdier spear that deals ' + COPPER_SPEAR.damage + ' damage.' },
  { recipe: IRON_SWORD, description: 'A sweeping blade that deals ' + IRON_SWORD.damage + ' damage.' },
  { recipe: COBALT_SPEAR, description: 'A long thrust that deals ' + COBALT_SPEAR.damage + ' damage and knocks enemies back.' },
  { recipe: BOW, description: 'Fires arrows toward your cursor through air and water.' },
  { recipe: ARROW, name: 'Arrows', description: 'A bundle of four arrows for the bow.' },
  ...Object.values(ARMOR).map((recipe) => ({
    recipe, description: 'Reduces incoming health damage by ' + Math.round(recipe.protection * 100) + '%.',
  })),
  { recipe: KELP_DRESSING, description: 'Restores up to ' + KELP_DRESSING.heal + ' health. Put it in the hotbar, select it, and click or tap the world to use it.' },
  { recipe: WOODEN_DOOR, description: 'Place it above a solid floor with two blocks of clearance. Opens as you approach.' },
  { recipe: COPPER_PICKAXE, description: 'Carry it in your inventory to mine Deepstone and cobalt ore.' },
  { recipe: IRON_PICKAXE, description: 'Takes 30% less time per block than the copper pickaxe and can mine cobalt and Deepstone.' },
];

export function createCraftingUi(panel, { makeItem }) {
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

  const availableAt = (recipe) => station === FIREPLACE.id
    ? recipe.station === FIREPLACE.id
    : !recipe.station || recipe.station === station;

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
    heading.textContent = station ? ITEMS[station].name : 'Crafting';
    if (!availableAt(cards[selected].recipe)) {
      selected = Math.max(0, cards.findIndex(({ recipe }) => availableAt(recipe)));
    }
    const { recipe, name, icon: itemIcon, description: detail } = cards[selected];
    const equipmentStatus = recipe.equipment ? equipmentCraftStatus(game, recipe) : null;
    const equipped = equipmentStatus === 'Equipped' || equipmentStatus === 'Already upgraded';
    const cost = Object.entries(recipe.cost);
    const ready = cards.map(({ recipe }) => canCraftItem(game, recipe, station));

    for (const [index, { button, recipe }] of cards.entries()) {
      button.hidden = !availableAt(recipe);
      button.setAttribute('aria-pressed', String(index === selected));
      button.toggleAttribute('data-ready', ready[index]);
    }
    title.textContent = name;
    setItemIcon(icon, itemIcon);
    description.textContent = detail + (recipe.equipment ? ' Equips when crafted.' : '');
    requirement.hidden = !recipe.requires;
    if (recipe.requires) {
      requirement.textContent = 'Upgrades your equipped ' + ARMOR[recipe.requires].name.toLowerCase() + '.';
    }
    materials.replaceChildren(...cost.map(([id, count]) => {
      const row = document.createElement('li');
      const symbol = document.createElement('span');
      setItemIcon(symbol, id);
      symbol.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = ITEMS[id].name;
      const quantity = document.createElement('strong');
      const owned = craftMaterialCount(game, recipe, id);
      quantity.textContent = owned + ' / ' + count;
      quantity.setAttribute('aria-label', owned + ' of ' + count + ' required');
      row.toggleAttribute('data-missing', !equipped && owned < count);
      row.append(symbol, label, quantity);
      return row;
    }));

    const missing = cost.some(([id, count]) => craftMaterialCount(game, recipe, id) < count);
    craft.disabled = !ready[selected];
    const cooking = recipe.station === FIREPLACE.id;
    const actionName = cooking ? name.replace(/^Cooked /i, '').toLowerCase() : name.toLowerCase();
    const verb = cooking ? 'Cook ' : 'Craft ';
    craft.textContent = equipmentStatus ?? (equipped ? 'Equipped'
      : missing ? 'Missing materials'
      : craft.disabled ? 'Inventory full'
      : verb + ((recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '') + actionName);
  }

  craft.addEventListener('click', () => {
    const { recipe, name } = cards[selected];
    if (makeItem(recipe)) {
      const cooking = recipe.station === FIREPLACE.id;
      const actionName = cooking ? name.replace(/^Cooked /i, '').toLowerCase() : name.toLowerCase();
      const amount = (recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '';
      const past = cooking ? 'Cooked ' : 'Crafted ';
      status.textContent = recipe.equipment
        ? name + ' equipped.'
        : past + amount + actionName + '.';
    }
  });
  panel.addEventListener('close', () => { status.textContent = ''; });

  return { render };
}
