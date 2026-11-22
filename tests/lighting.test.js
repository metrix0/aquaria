import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { advanceMining, createGame, targetTile } from '../src/gameplay/simulation.js';
import { createWorld, editTile, hasOpenFace, tileAt, waterTileAt } from '../src/world.js';
import { groundAt, TILE, WATER_ROW, WEST_EXTENSION } from '../src/world/generation.js';
import { JUNGLE_CAVE } from '../src/world/jungle-cave.js';
import {
  caveAmbientAt,
  caveStructureLight,
  createCaveLight,
  createSurfaceLight,
  createUndergroundLight,
  undergroundAmbientAt,
} from '../src/world/lighting.js';

test('cave light follows open passages and reacts to terrain edits', () => {
  const world = createWorld();
  const light = createCaveLight();
  const column = 95;
  const row = 21;
  const player = { x: (column + .5) * TILE, y: row * TILE, height: TILE };
  for (let x = column - 2; x <= column + 7; x++) {
    for (let y = row - 2; y <= row + 2; y++) editTile(world, x, y, MATERIAL.stone);
  }
  for (const x of [column, column + 2, column + 3]) editTile(world, x, row, MATERIAL.air);
  editTile(world, column + 4, row, MATERIAL.iron);

  light.update(world, player);
  assert.ok(light.at(column, row) > 0.4 && light.at(column, row) < 0.7);
  assert.ok(light.at(column + 1, row) > 0);
  assert.equal(light.at(column + 2, row), 0);
  const shadowedOre = light.at(column + 4, row);
  assert.ok(shadowedOre < .1);
  const chamberAmbient = caveAmbientAt(world, player, column + 3, row);
  const wallAmbient = caveAmbientAt(world, player, column + 4, row);
  assert.ok(chamberAmbient > wallAmbient && wallAmbient > 0);
  assert.equal(caveAmbientAt(world, player, column + 5, row), 0);

  editTile(world, column + 1, row, MATERIAL.air);
  light.update(world, player);
  assert.ok(light.at(column + 2, row) > light.at(column + 4, row));
  assert.ok(light.at(column + 4, row) > shadowedOre);
  assert.ok(light.at(column + 4, row) > light.at(column + 5, row));
  assert.ok(light.at(column + 5, row) > 0);

  editTile(world, column + 1, row, MATERIAL.wood);
  light.update(world, player);
  assert.equal(light.at(column + 2, row), 0);
  assert.equal(light.at(column + 4, row), shadowedOre);
  assert.equal(light.at(column + 18, row), 0);
});

test('light fades over several rock tiles and follows the player within a tile', () => {
  const world = createWorld();
  const light = createCaveLight();
  const column = 100;
  const row = 24;
  const player = { x: (column + .5) * TILE, y: row * TILE, height: TILE };
  for (let x = column - 1; x <= column + 9; x++) {
    for (let y = row - 1; y <= row + 1; y++) editTile(world, x, y, MATERIAL.stone);
  }
  editTile(world, column, row, MATERIAL.air);
  light.update(world, player);
  for (let dx = 1; dx <= 3; dx++) {
    const brightness = light.at(column + dx, row);
    assert.ok(brightness > 0 && brightness < light.at(column + dx - 1, row));
  }
  assert.equal(light.at(column + 4, row), 0);

  for (let dx = 1; dx <= 24; dx++) editTile(world, column + dx, row, MATERIAL.air);
  light.update(world, player);
  const before = light.at(column + 7, row);
  player.x += TILE / 4;
  light.update(world, player);
  assert.ok(light.at(column + 7, row) > before);
  assert.ok(light.at(column + 9, row) > 0);
  assert.equal(light.at(column + 13, row), 0);
});

test('glowing mushrooms light the lower island cave while exposed', () => {
  const world = createWorld();
  const light = createCaveLight();
  for (const { tx, floor } of world.caveMushrooms) {
    assert.equal(tileAt(world, tx, floor - 1), MATERIAL.air);
    assert.ok(tileAt(world, tx, floor));
    assert.equal(waterTileAt(world, tx, floor - 1), false);
  }

  world.caveStructures = [];
  const { tx, floor } = world.caveMushrooms[0];
  const row = floor - 1;
  // Stand far enough from the mushroom to distinguish its light from the player's.
  const player = { x: (tx + 22.5) * TILE, y: row * TILE, height: TILE };
  light.update(world, player);
  assert.ok(light.at(tx, row) > light.at(tx + 1, row));
  assert.ok(light.at(tx + 1, row) > 0.5);

  const lit = light.at(tx + 1, row);
  editTile(world, tx, row, MATERIAL.wood);
  light.update(world, player);
  assert.ok(light.at(tx + 1, row) < lit / 2);
});

test('surface light fades into rock without lighting a sealed pocket', () => {
  const world = createWorld();
  const light = createSurfaceLight();
  const column = WEST_EXTENSION + 56;
  const ground = groundAt(column);
  const player = { x: (column + .5) * TILE, y: (ground - 1) * TILE, height: TILE };
  const bounds = { left: column - 3, right: column + 4, top: ground - 2, bottom: ground + 8 };
  for (let x = column - 4; x <= column + 4; x++) {
    for (let y = ground; y <= ground + 6; y++) editTile(world, x, y, MATERIAL.stone);
  }
  editTile(world, column + 1, ground + 2, MATERIAL.air);
  light.update(world, player, bounds);

  assert.equal(light.at(column, ground), 1);
  for (let depth = 1; depth <= 5; depth++) {
    assert.ok(light.at(column, ground + depth) > 0);
    assert.ok(light.at(column, ground + depth) < light.at(column, ground + depth - 1));
  }
  assert.equal(light.at(column, ground + 6), 0);
  assert.equal(light.at(column + 1, ground + 2), 0);

  const beforePan = light.at(column, ground + 2);
  light.update(world, player, { ...bounds, top: ground + 2 });
  assert.equal(light.at(column, ground + 2), beforePan);
});

test('ore mining requires an open face, including naturally flooded space', () => {
  const game = createGame();
  const column = 230;
  const row = WATER_ROW + 2;
  const x = (column + .5) * TILE;
  const y = row * TILE;
  Object.assign(game.player, { x: x - 3 * TILE, y });
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    editTile(game.world, column + dx, row + dy, MATERIAL.stone);
  }
  editTile(game.world, column, row, MATERIAL.copper);
  const target = targetTile(game, x, y + TILE / 2);
  assert.equal(target.reachable, true);
  assert.equal(hasOpenFace(game.world, column, row, game.player), false);
  assert.equal(advanceMining(game, target, null, 1), null);

  editTile(game.world, column - 1, row, MATERIAL.air);
  assert.equal(waterTileAt(game.world, column - 1, row), true);
  assert.equal(hasOpenFace(game.world, column, row, game.player), true);
  assert.ok(advanceMining(game, target, null, 1).progress >= 1);
});


test('player cave light does not shine through an open-air island into its walls', () => {
  const world = createWorld();
  const cave = createCaveLight();
  const tx = WEST_EXTENSION + 56;
  const surface = groundAt(tx);
  const player = {x: (tx + .5) * TILE, y: (surface - 3) * TILE, height: TILE};
  cave.update(world, player);
  assert.equal(cave.at(tx, surface), 0);
  assert.equal(cave.at(tx, surface + 2), 0);
  player.y = (surface + 5) * TILE;
  editTile(world, tx, surface + 5, MATERIAL.air);
  cave.update(world, player);
  assert.ok(cave.at(tx, surface + 5) > 0);
});

test('cave structure light colors match island lamps and orange/green jungle torches', () => {
  const lampLight = caveStructureLight({ kind: 'lamp', tx: 40, floor: 50 });
  const orangeTorch = caveStructureLight({ kind: 'native-torch', tx: 350, floor: 70 });
  const greenTorch = caveStructureLight({ kind: 'native-torch', tx: 364, floor: JUNGLE_CAVE.sanctuaryFloor });

  assert.equal(lampLight.color, '#f0b269');
  assert.ok(lampLight.r > lampLight.g && lampLight.g > lampLight.b);
  assert.equal(orangeTorch.color, '#e88d3a');
  assert.ok(orangeTorch.r > orangeTorch.g && orangeTorch.g > orangeTorch.b);
  assert.equal(greenTorch.color, '#62d996');
  assert.ok(greenTorch.g > greenTorch.r && greenTorch.g > greenTorch.b);
});

test('cave colored light fills open passages and stops behind closed rock walls until opened', () => {
  const world = createWorld();
  const cave = createCaveLight();
  const column = 95;
  const floor = 26;
  const player = { x: (column + 0.5) * TILE, y: (floor - 2) * TILE, height: TILE };

  for (let x = column - 4; x <= column + 7; x++) {
    for (let y = floor - 4; y <= floor + 1; y++) {
      editTile(world, x, y, MATERIAL.stone);
    }
  }
  // Open left chamber with a warm island lamp and a separated right air pocket across a 1-tile stone wall.
  for (let x = column - 2; x <= column + 2; x++) {
    editTile(world, x, floor - 2, MATERIAL.air);
    editTile(world, x, floor - 1, MATERIAL.air);
  }
  editTile(world, column + 4, floor - 2, MATERIAL.air);
  editTile(world, column + 4, floor - 1, MATERIAL.air);
  world.caveStructures = [{ kind: 'lamp', tx: column, floor }];

  cave.update(world, player);
  const atLamp = cave.colorAt(column, floor - 2);
  const nextToLamp = cave.colorAt(column + 2, floor - 2);
  const behindWall = cave.colorAt(column + 4, floor - 2);
  assert.ok(atLamp.strength > 0.5);
  assert.equal(atLamp.r, 240);
  assert.equal(atLamp.g, 178);
  assert.equal(atLamp.b, 105);
  assert.ok(nextToLamp.strength > 0 && nextToLamp.strength < atLamp.strength);
  assert.equal(behindWall.strength, 0);

  // Mining the separating rock tile lets the lamp color spill into the adjacent chamber.
  editTile(world, column + 3, floor - 2, MATERIAL.air);
  cave.update(world, player);
  const afterBreach = cave.colorAt(column + 4, floor - 2);
  assert.ok(afterBreach.strength > 0);
  assert.equal(afterBreach.r, 240);

  // Sanctuary green torch switches emitted color to green.
  world.caveStructures = [{ kind: 'native-torch', tx: column, floor: JUNGLE_CAVE.sanctuaryFloor }];
  player.y = (JUNGLE_CAVE.sanctuaryFloor - 2) * TILE;
  for (let x = column - 2; x <= column + 2; x++) {
    editTile(world, x, JUNGLE_CAVE.sanctuaryFloor - 2, MATERIAL.air);
    editTile(world, x, JUNGLE_CAVE.sanctuaryFloor - 1, MATERIAL.air);
  }
  editTile(world, column, JUNGLE_CAVE.sanctuaryFloor, MATERIAL.stone);
  cave.update(world, player);
  const green = cave.colorAt(column, JUNGLE_CAVE.sanctuaryFloor - 2);
  assert.ok(green.strength > 0.5);
  assert.equal(green.r, 98);
  assert.equal(green.g, 217);
  assert.equal(green.b, 150);
});

test('cave light covers lamps near the left edge of camera bounds even when the player is far to the right', () => {
  const world = createWorld();
  const cave = createCaveLight();
  const column = 95;
  const floor = 26;
  for (let x = column - 6; x <= column + 36; x++) {
    for (let y = floor - 4; y <= floor + 1; y++) {
      editTile(world, x, y, y === floor ? MATERIAL.stone : MATERIAL.air);
    }
  }
  world.caveStructures = [{ kind: 'lamp', tx: column, floor }];
  const player = { x: (column + 28.5) * TILE, y: (floor - 2) * TILE, height: TILE };
  const bounds = { left: column - 1, right: column + 42, top: floor - 14, bottom: floor + 12 };

  cave.update(world, player, bounds);
  assert.ok(cave.at(column - 3, floor - 2) > 0, 'left side of lamp must stay lit');
  assert.ok(cave.colorAt(column - 3, floor - 2).strength > 0, 'left side of lamp color must not be clipped');
});

test('underground light system emits mushroom cyan, glowshroom torch cyan, and deepens ambient by depth', () => {
  const world = createWorld();
  const underground = createUndergroundLight();
  const column = 75;
  const shallowRow = 30;
  const deepRow = 260;

  for (const row of [shallowRow, deepRow]) {
    for (let x = column - 3; x <= column + 3; x++) {
      for (let y = row - 1; y <= row + 1; y++) {
        editTile(world, x, y, y === row - 1 || y === row + 1 ? MATERIAL.stone : MATERIAL.air);
      }
    }
  }

  // Ambient is clearer in upper caves and noticeably darker in deep underground caverns.
  const player = { x: (column + 0.5) * TILE, y: shallowRow * TILE, height: TILE, glowSeconds: 0 };
  assert.equal(undergroundAmbientAt(world, player, column, shallowRow), 0.34);
  assert.ok(undergroundAmbientAt(world, player, column, deepRow) < 0.2);

  // Cave mushrooms emit cyan colored light in the underground light system.
  world.caveStructures = [];
  world.caveMushrooms = [{ tx: column + 2, floor: shallowRow + 1 }];
  underground.update(world, player);
  const mushroomGlow = underground.colorAt(column + 2, shallowRow);
  assert.ok(mushroomGlow.strength > 0.4);
  assert.equal(mushroomGlow.r, 83);
  assert.equal(mushroomGlow.g, 185);
  assert.equal(mushroomGlow.b, 188);

  // Activating glowshroom-torch emits cyan-teal light from the player underground.
  world.caveMushrooms = [];
  player.glowSeconds = 30;
  underground.update(world, player);
  const torchGlow = underground.colorAt(column, shallowRow);
  assert.ok(torchGlow.strength > 0.5);
  assert.equal(torchGlow.r, 107);
  assert.equal(torchGlow.g, 227);
  assert.equal(torchGlow.b, 220);
});
