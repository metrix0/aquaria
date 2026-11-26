import assert from 'node:assert/strict';
import test from 'node:test';
import { ADDONS, MATERIAL, SALVAGE_RECIPES, WORKBENCH } from '../src/content.js';
import { advanceMining, canCraftItem, craftItem, createGame, moveInventoryStack, useUtilityItem } from '../src/gameplay/simulation.js';
import { movePlayer } from '../src/gameplay/player.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { tileAt, waterTileAt } from '../src/world.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { rollWildChestGroupLoot, WILD_CHEST_CATEGORIES, WILD_CHEST_LOOT_TABLES } from '../src/world/wild-chest.js';

test('first cave drop rates are shared with the Drops table and fulfill both guarantees', () => {
  const table = WILD_CHEST_LOOT_TABLES['first-cave'];
  assert.equal(table.entries.reduce((total, item) => total + item.weight, 0), 100);
  assert.deepEqual(WILD_CHEST_CATEGORIES.map((category) =>
    table.entries.filter((entry) => entry.category === category.id)
      .reduce((total, entry) => total + entry.weight, 0)), [48, 24, 19, 9]);
  const wild = createGame().world.items.filter((chest) => chest.chestType === 'wild');
  assert.equal(wild.length, 12);
  for (let seed = 1; seed <= 40; seed++) {
    const loot = rollWildChestGroupLoot(wild, seed);
    let addons = 0;
    for (const chest of wild) {
      const stacks = loot.get(chest.id);
      assert.ok(stacks.length >= 2 && stacks.length <= 4);
      assert.equal(stacks.length, new Set(stacks.map((stack) => stack.id)).size);
      const categories = stacks.map((stack) => table.entries.find((entry) => entry.id === stack.id)?.category);
      assert.ok(categories.some((category) => table.guaranteedPerChest.includes(category)),
        'useful drop missing in ' + chest.id);
      addons += categories.filter((category) => category === 'addons').length;
    }
    assert.ok(addons >= 1, 'biome addon missing for world seed ' + seed);
  }
});

test('salvage recipes turn real scraps into copper, iron and rope', () => {
  const game = createGame();
  for (const [id, amount, material] of [
    ['rusty-metal-scraps', 4, 'copper'],
    ['broken-gears', 3, 'iron'],
    ['torn-cloth', 3, 'rope-bundle'],
  ]) {
    const recipe = SALVAGE_RECIPES.find((candidate) => candidate.id === material);
    assert.ok(recipe);
    game.inventory.add(id, amount);
    assert.equal(canCraftItem(game, recipe, undefined), !recipe.station);
    assert.equal(craftItem(game, recipe, recipe.station), true);
    assert.equal(game.inventory.count(id), 0);
    assert.equal(game.inventory.count(material), 1);
  }
});

test('all four wild addons equip only into their accessory slot and survive reload', () => {
  const game = createGame();
  for (const addon of Object.values(ADDONS)) {
    game.inventory.add(addon.id, 1);
    const from = { group: 'backpack', index: game.inventory.backpack.findIndex((stack) => stack?.id === addon.id) };
    const to = { group: 'addon-' + addon.addonSlot, index: 0 };
    assert.ok(from.index >= 0);
    assert.equal(moveInventoryStack(game, null, from, to), true);
    assert.equal(game.progress.addons[addon.addonSlot], addon.id);
  }
  assert.equal(game.player.addons.hands, 'scrappers-gloves');
  assert.equal(game.player.addons.feet, 'explorers-anklet');
  assert.equal(game.player.addons.legs, 'padded-leg-wraps');
  assert.equal(game.player.addons.chest, 'prospectors-brooch');
  assert.equal(moveInventoryStack(game, null, { group: 'addon-hands', index: 0 },
    { group: 'addon-feet', index: 0 }), false, 'cannot equip addon in the wrong slot');
  const reloaded = createGame(decodeSave(encodeSave(game)));
  assert.deepEqual(reloaded.progress.addons, game.progress.addons);
  assert.equal(reloaded.player.addons, reloaded.progress.addons);
  const gloveSlot = game.inventory.backpack.findIndex((stack) => stack === null);
  assert.equal(moveInventoryStack(game, null, { group: 'addon-hands', index: 0 },
    { group: 'backpack', index: gloveSlot }), true);
  assert.equal(game.progress.addons.hands, null);
});

test('scrapper gloves accelerate mining; anklet accelerates dry ground movement', () => {
  const game = createGame();
  const tx = 54 + WEST_EXTENSION, ty = 34;
  assert.notEqual(tileAt(game.world, tx, ty), MATERIAL.air);
  game.player.x = (tx + .5) * TILE;
  game.player.y = (ty - 2) * TILE;
  const target = { tx, ty, x: (tx + .5) * TILE, reachable: true };
  const normal = advanceMining(game, target, null, 0, 0);
  assert.ok(normal?.duration > 0);
  game.progress.addons.hands = 'scrappers-gloves';
  const faster = advanceMining(game, target, null, 0, 0);
  assert.ok(Math.abs(faster.duration / normal.duration - .92) < 0.001);
  const a = createGame(), b = createGame();
  b.progress.addons.feet = 'explorers-anklet';
  movePlayer(a.world, a.player, { right: true }, 1 / 60);
  movePlayer(b.world, b.player, { right: true }, 1 / 60);
  assert.ok(Math.abs(b.player.dx / a.player.dx - 1.05) < .001);
});

test('glowshroom torch lasts 90 seconds and spent utility is saved', () => {
  const game = createGame();
  game.inventory.add('glowshroom-torch', 1, { preferHotbar: true });
  const slot = game.inventory.hotbar.findIndex((stack) => stack?.id === 'glowshroom-torch');
  assert.ok(slot >= 0);
  assert.equal(useUtilityItem(game, slot)?.inventoryChanged, true);
  assert.equal(game.inventory.count('glowshroom-torch'), 0);
  assert.equal(game.player.glowSeconds, 90);
  assert.equal(createGame(decodeSave(encodeSave(game))).player.glowSeconds, 90);
});

test('rope placement ignores terrain and extends overlapping ropes downward, including after reload', () => {
  const game = createGame();
  game.inventory.add('rope-bundle', 4, { preferHotbar: true });
  const slot = game.inventory.hotbar.findIndex((stack) => stack?.id === 'rope-bundle');
  const tx = WEST_EXTENSION + 4;
  const target = { tx, ty: 4, reachable: true };
  assert.equal(useUtilityItem(game, slot, { ...target, reachable: false }).inventoryChanged, undefined);
  assert.equal(useUtilityItem(game, slot, target).inventoryChanged, true);
  assert.equal(useUtilityItem(game, slot, target).inventoryChanged, true);
  assert.equal(useUtilityItem(game, slot, { ...target, ty: 8 }).inventoryChanged, true);
  assert.deepEqual(game.world.placedRopes.map(({ top, bottom }) => [top, bottom]), [[4, 10], [10, 16], [16, 22]]);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.deepEqual(restored.world.placedRopes, game.world.placedRopes);
  assert.equal(useUtilityItem(restored, slot, target).inventoryChanged, true);
  assert.equal(restored.world.placedRopes.at(-1).top, 22);
  assert.equal(restored.inventory.count('rope-bundle'), 0);
});
