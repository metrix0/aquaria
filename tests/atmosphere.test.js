import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { createWorld, editTile } from '../src/world.js';
import { WEST_EXTENSION, groundAt } from '../src/world/generation.js';
import { createOutdoorExposure } from '../src/world/atmosphere.js';

test('outdoor atmosphere follows open tunnels but never crosses sealed rock', () => {
  const world = createWorld();
  const mask = createOutdoorExposure();
  const column = WEST_EXTENSION + 56;
  const roof = groundAt(column);
  const bounds = { left: column - 5, right: column + 27, top: roof - 3, bottom: roof + 10 };
  for (let x = column - 3; x < column + 24; x++) {
    for (let y = roof; y <= roof + 7; y++) editTile(world, x, y, MATERIAL.stone);
  }
  // An open vertical shaft with a horizontal cave continuing beyond its light.
  for (let y = roof; y <= roof + 4; y++) editTile(world, column, y, MATERIAL.air);
  for (let x = column; x <= column + 20; x++) editTile(world, x, roof + 4, MATERIAL.air);

  mask.update(world, bounds);
  assert.equal(mask.at(column, roof - 1), 1);
  assert.ok(mask.at(column, roof + 4) > 0);
  assert.ok(mask.at(column + 3, roof + 4) > mask.at(column + 8, roof + 4));
  assert.equal(mask.at(column + 20, roof + 4), 0);
  assert.equal(mask.at(column + 15, roof + 6), 0);

  // Plug the opening: the weather overlay must disappear from the chamber.
  editTile(world, column, roof, MATERIAL.stone);
  mask.update(world, bounds);
  assert.equal(mask.at(column + 3, roof + 4), 0);
  assert.equal(mask.at(column + 20, roof + 4), 0);
});

test('atmosphere is anchored to world tiles as the viewport moves', () => {
  const world = createWorld();
  const mask = createOutdoorExposure();
  const x = WEST_EXTENSION + 48;
  const y = groundAt(x) - 1;
  const bounds = { left: x - 7, right: x + 9, top: y - 4, bottom: y + 10 };
  mask.update(world, bounds);
  const before = mask.at(x, y);
  assert.equal(before, 1);
  mask.update(world, { ...bounds, left: bounds.left + 3, right: bounds.right + 3 });
  assert.equal(mask.at(x, y), before);
});
