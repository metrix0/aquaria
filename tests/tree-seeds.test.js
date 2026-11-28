import test from 'node:test';
import assert from 'node:assert/strict';

import { MATERIAL, TREE_SEED } from '../src/content.js';
import { DAY_CYCLE_SECONDS } from '../src/environment.js';
import { commitTileAction, createGame, planTileAction, stepGame } from '../src/gameplay/simulation.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { WATER_ROW, TILE } from '../src/world/generation.js';
import { editTile, isTreeStanding, saplingAt } from '../src/world.js';

test('destroying a tree drops 1-2 seeds', () => {
  const game = createGame();
  const tree = game.world.trees[0];
  game.player.x = tree.tx * TILE;
  game.player.y = (tree.ty - 2) * TILE;
  const action = planTileAction(game, { tx: tree.tx, ty: tree.ty - 1, reachable: true }, false);
  assert.ok(action, 'chopping a tree should produce a tile action');
  assert.ok(action.seedAmount >= 1 && action.seedAmount <= 2, 'tree should drop 1-2 seeds');
  commitTileAction(game, action);
  assert.equal(isTreeStanding(game.world, tree), false);
  assert.equal(game.inventory.count(TREE_SEED.id), action.seedAmount);

  // Also test felling a tree by mining the block supporting it
  const game2 = createGame();
  const tree2 = game2.world.trees[1];
  game2.player.x = tree2.tx * TILE;
  game2.player.y = tree2.ty * TILE;
  const supportAction = planTileAction(game2, { tx: tree2.tx, ty: tree2.ty, reachable: true }, false);
  assert.ok(supportAction?.supportedTree, 'mining supporting block should detect supportedTree');
  assert.ok(supportAction.seedAmount >= 1 && supportAction.seedAmount <= 2, 'felling via support should drop 1-2 seeds');
  commitTileAction(game2, supportAction);
  assert.equal(game2.inventory.count(TREE_SEED.id), supportAction.seedAmount);
});

test('seeds plant on sand as palm and on dirt as jungle, and grow after 2 days in open air above ocean level', () => {
  const game = createGame();
  game.inventory.hotbar[0] = { id: TREE_SEED.id, count: 5 };
  const slot = 0;

  const tx = 60;
  const ty = WATER_ROW - 2;
  game.player.x = (tx + 1) * TILE;
  game.player.y = (ty - 1) * TILE;
  // Clear column above and place sand below
  for (let y = 0; y <= ty; y++) editTile(game.world, tx, y, MATERIAL.air);
  editTile(game.world, tx, ty + 1, MATERIAL.sand);

  const plantPalm = planTileAction(game, { tx, ty, reachable: true }, true, slot);
  assert.equal(plantPalm?.plantSeed, 'palm');
  commitTileAction(game, plantPalm);
  assert.equal(saplingAt(game.world, tx, ty)?.kind, 'palm');

  // Cannot plant on stone
  editTile(game.world, tx + 2, ty + 1, MATERIAL.stone);
  assert.equal(planTileAction(game, { tx: tx + 2, ty, reachable: true }, true, slot), undefined);

  // Plant on dirt (soil)
  for (let y = 0; y <= ty; y++) editTile(game.world, tx + 4, y, MATERIAL.air);
  editTile(game.world, tx + 4, ty + 1, MATERIAL.soil);
  const plantJungle = planTileAction(game, { tx: tx + 4, ty, reachable: true }, true, slot);
  assert.equal(plantJungle?.plantSeed, 'jungle');
  commitTileAction(game, plantJungle);
  assert.equal(saplingAt(game.world, tx + 4, ty)?.kind, 'jungle');

  // Block overhead on the jungle sapling so it is not in open air
  editTile(game.world, tx + 4, ty - 3, MATERIAL.stone);

  // Before 2 days: neither grows
  game.worldTime += 2 * DAY_CYCLE_SECONDS - 10;
  stepGame(game, { left: false, right: false, jump: false, up: false, down: false }, 0.016);
  assert.ok(saplingAt(game.world, tx, ty));
  assert.ok(saplingAt(game.world, tx + 4, ty));

  // After 2 days: palm grows, blocked jungle sapling does not
  game.worldTime += 15;
  stepGame(game, { left: false, right: false, jump: false, up: false, down: false }, 0.016);
  assert.equal(saplingAt(game.world, tx, ty), null);
  assert.ok(game.world.trees.some((t) => t.tx === tx && t.ty === ty && t.kind !== 'jungle'));
  assert.ok(saplingAt(game.world, tx + 4, ty), 'covered sapling should not grow');

  // Save and reload preserves both saplings and plantedTrees
  const saved = decodeSave(JSON.parse(JSON.stringify(encodeSave(game))));
  const reloaded = createGame(saved);
  assert.ok(saplingAt(reloaded.world, tx + 4, ty));
  assert.ok(reloaded.world.trees.some((t) => t.tx === tx && t.ty === ty));
});
