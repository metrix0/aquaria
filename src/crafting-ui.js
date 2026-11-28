import { ARMOR, SALVAGE_RECIPES, ARROW, BOW, BREATH_SECONDS, COBALT_SNORKEL, COBALT_SPEAR, COOKED_CRAB, COOKED_FISH, CAULDRON, FOODS, STEW_RECIPES, COPPER_PICKAXE, COPPER_SNORKEL, COPPER_SPEAR, FIREPLACE, IRON_PICKAXE, IRON_SNORKEL, IRON_SWORD, KELP_DRESSING, POISON_ARROW, SPEAR, WOODEN_DOOR, WORKBENCH } from './content.js';
import { canCraftItem, craftMaterialCount, equipmentCraftStatus } from './gameplay/simulation.js';
import { COBALT_GRAPPLING_HOOK, IRON_GRAPPLING_HOOK, ITEMS, WOODEN_SHIELD } from './inventory.js';
import { setItemIcon } from './inventory-ui.js';

import { recipes } from './crafting-recipes.js';


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

  const ingredientPicker = document.createElement('div');
  ingredientPicker.className = 'stew-ingredients';
  ingredientPicker.hidden = true;
  const selectors = Array.from({length:3},(_,i)=>{
    const select=document.createElement('select');
    select.setAttribute('aria-label','Ingredient '+(i+1));
    select.append(new Option(i===0?'Choose ingredient':'Optional ingredient',''));
    for(const [id,food] of Object.entries(FOODS)) select.append(new Option(food.name,id));
    ingredientPicker.append(select);
    select.addEventListener('change',()=>{
      const ids=selectors.map(s=>s.value).filter(Boolean).sort();
      const match=cards.findIndex(({recipe})=>recipe.id==='stew-'+ids.join('+'));
      if(match>=0) selected=match;
      status.textContent='';
      render(game,station);
    });
    return select;
  });
  grid.before(ingredientPicker);
  const availableAt = (recipe) => station === CAULDRON.id
    ? recipe.station === CAULDRON.id
    : station === FIREPLACE.id
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
    ingredientPicker.hidden = station !== CAULDRON.id;
    grid.hidden = station === CAULDRON.id;
    if (!availableAt(cards[selected].recipe)) {
      selected = Math.max(0, cards.findIndex(({ recipe }) => availableAt(recipe)));
    }
    if(station===CAULDRON.id) {
      const ids=selectors.map(s=>s.value).filter(Boolean).sort();
      const match=cards.findIndex(({recipe})=>recipe.id==='stew-'+ids.join('+'));
      if(match>=0) selected=match;
    }
    const { recipe, name, icon: itemIcon, description: detail } = cards[selected];
    if(station===CAULDRON.id && !selectors.some(s=>s.value) && !ingredientPicker.dataset.initialized) {
      selectors[0].value=recipe.ingredients[0];
      ingredientPicker.dataset.initialized='true';
    }
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
    craft.disabled = !ready[selected] || (station===CAULDRON.id && !selectors.some(s=>s.value));
    const cooking = recipe.station === FIREPLACE.id;
    const actionName = cooking ? name.replace(/^Cooked /i, '').toLowerCase() : name.toLowerCase();
    const verb = cooking ? 'Cook ' : 'Craft ';
    craft.textContent = equipmentStatus ?? (equipped ? 'Equipped'
      : recipe.requiresSkill && !game.player.skillBonuses?.[recipe.requiresSkill] ? "Unlock Chef: Cauldron"
      : missing ? 'Missing materials'
      : craft.disabled ? 'Inventory full'
      : verb + ((recipe.amount ?? 1) > 1 ? recipe.amount + ' ' : '') + actionName);
  }

  craft.addEventListener('click', () => {
    const { recipe, name } = cards[selected];
    if (!craft.disabled && makeItem(recipe)) {
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
