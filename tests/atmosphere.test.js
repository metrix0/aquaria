import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { createWorld, editTile } from '../src/world.js';
import { WEST_EXTENSION, groundAt } from '../src/world/generation.js';
import { atmosphereTint, createOutdoorExposure, hasBackgroundWall } from '../src/world/atmosphere.js';

test('outdoor atmosphere respects background walls even along open tunnels', () => {
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
  assert.equal(mask.at(column, roof + 4), 0);
  assert.equal(mask.at(column + 3, roof + 4), 0);
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

test('background walls block weather in mined-out rooms but not on the surface', () => {
  const world = createWorld();
  const mask = createOutdoorExposure();
  const x = WEST_EXTENSION + 56;
  const surface = groundAt(x);
  const bounds = { left: x - 8, right: x + 8, top: surface - 3, bottom: surface + 9 };

  assert.equal(hasBackgroundWall(x, surface), false);
  assert.equal(hasBackgroundWall(x, surface + 1), true);
  editTile(world, x, surface, MATERIAL.air);
  editTile(world, x, surface + 1, MATERIAL.air);
  editTile(world, x, surface + 2, MATERIAL.air);
  mask.update(world, bounds);

  assert.equal(mask.at(x, surface - 1), 1);
  assert.equal(mask.at(x, surface), 1);
  assert.equal(mask.at(x, surface + 1), 0);
  assert.equal(mask.at(x, surface + 2), 0);
  assert.ok(mask.at(x + 1, surface) > 0);
});

test('day presets grade the world, with changing pink/amber and stronger sunny warmth', () => {
  const clear = atmosphereTint({atmosphere:'clear', darkness:0, rain:0});
  const sunny = atmosphereTint({atmosphere:'sunny', darkness:0, rain:0});
  const cloudy = atmosphereTint({atmosphere:'cloudy', darkness:0, rain:0});
  const pink = atmosphereTint({atmosphere:'rose', darkness:0, rain:0},0,0);
  const amber = atmosphereTint({atmosphere:'rose', darkness:0, rain:0},0,15);
  const night = atmosphereTint({atmosphere:'moonlit', darkness:1, rain:0});
  const swamp = atmosphereTint({atmosphere:'clear', darkness:0, rain:0},1);
  assert.ok(clear.alpha > cloudy.alpha);
  assert.ok(sunny.alpha > clear.alpha);
  assert.ok(pink.alpha > 0.15);
  assert.notDeepEqual([pink.g,pink.b],[amber.g,amber.b]);
  assert.ok(night.b > night.r);
  assert.ok(swamp.g > clear.g || swamp.b < clear.b);
});
