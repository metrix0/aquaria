import { ARMOR, SALVAGE_RECIPES, ARROW, BOW, BREATH_SECONDS, COBALT_SNORKEL, COBALT_SPEAR, COOKED_CRAB, COOKED_FISH, CAULDRON, FOODS, STEW_RECIPES, COPPER_PICKAXE, COPPER_SNORKEL, COPPER_SPEAR, FIREPLACE, IRON_PICKAXE, IRON_SNORKEL, IRON_SWORD, KELP_DRESSING, POISON_ARROW, SPEAR, WOODEN_DOOR, WORKBENCH } from './content.js';
import { COBALT_GRAPPLING_HOOK, IRON_GRAPPLING_HOOK, ITEMS, WOODEN_SHIELD } from './inventory.js';

export const recipes = [
  ...SALVAGE_RECIPES.map((recipe) => ({ recipe, name: recipe.name, description: recipe.description })),
  ...[COPPER_SNORKEL, IRON_SNORKEL, COBALT_SNORKEL].map((recipe) => ({
    recipe, description: 'Lets you stay underwater for ' + (BREATH_SECONDS + recipe.bonusSeconds) + ' seconds.',
  })),
  ...[IRON_GRAPPLING_HOOK, COBALT_GRAPPLING_HOOK].map((recipe) => ({
    recipe, description: recipe.description,
  })),
  { recipe: WORKBENCH, description: 'Place it from your hotbar to craft advanced gear. Press E, right-click it, or tap Use nearby to open it.' },
  { recipe: CAULDRON, description: "Scholar Chef unlock. Place to combine up to three foods." },
  ...STEW_RECIPES.map(recipe=>({recipe,icon:recipe.id,description:"Combines all selected ingredients, including raw food risks."})),
  { recipe: FIREPLACE, description: 'Place it from your hotbar to cook raw fish and crab. Press E, right-click it, or tap Use nearby to cook.' },
  { recipe: COOKED_FISH, description: 'Cooked over the fire. Restores ' + COOKED_FISH.oxygen + ' seconds of oxygen with no poison risk.' },
  { recipe: COOKED_CRAB, description: 'Roasted crab meat. Restores up to ' + COOKED_CRAB.heal + ' health with no poison risk.' },
  { recipe: SPEAR, description: 'Thrust at nearby creatures to damage them and drive them back.' },
  { recipe: COPPER_SPEAR, description: 'A sturdier spear that deals ' + COPPER_SPEAR.damage + ' damage.' },
  { recipe: IRON_SWORD, description: 'A sweeping blade that deals ' + IRON_SWORD.damage + ' damage.' },
  { recipe: COBALT_SPEAR, description: 'A long thrust that deals ' + COBALT_SPEAR.damage + ' damage and knocks enemies back.' },
  { recipe: BOW, description: 'Fires arrows toward your cursor through air and water.' },
  { recipe: ARROW, name: 'Arrows', description: 'A bundle of four arrows for the bow.' },
  { recipe: POISON_ARROW, name: 'Poison arrows', description: 'Coats four arrows with a lionfish needle, poisoning hit enemies.' },
  { recipe: WOODEN_SHIELD, description: WOODEN_SHIELD.description },
  ...Object.values(ARMOR).map((recipe) => ({
    recipe, description: 'Reduces incoming health damage by ' + Math.round(recipe.protection * 100) + '%.',
  })),
  { recipe: KELP_DRESSING, description: 'Restores up to ' + KELP_DRESSING.heal + ' health. Put it in the hotbar, select it, and click or tap the world to use it.' },
  { recipe: WOODEN_DOOR, description: 'Place it above a solid floor with two blocks of clearance. Opens as you approach.' },
  { recipe: COPPER_PICKAXE, description: 'Carry it in your inventory to mine Deepstone and cobalt ore.' },
  { recipe: IRON_PICKAXE, description: 'Takes 30% less time per block than the copper pickaxe and can mine cobalt and Deepstone.' },
];
