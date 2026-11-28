import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMobs, WATER } from '../src/world/generation.js';
import { snapshotFishSchools } from '../src/gameplay/friends/fish.js';
import { sharkSpec } from '../src/gameplay/enemies/shark.js';

test('sea schools have unique members, varied sizes and textures, and common retreat state', () => {
  const fish = generateMobs().filter(mob => mob.schoolId);
  assert.ok(fish.length >= 50);
  assert.equal(new Set(fish.map(mob => mob.id)).size, fish.length);
  assert.ok(new Set(fish.map(mob => mob.variant)).size >= 6);
  assert.ok(new Set(fish.map(mob => mob.fishPattern)).size === 4);
  assert.ok(Math.max(...fish.map(mob => mob.fishScale)) - Math.min(...fish.map(mob => mob.fishScale)) > .35);
  assert.ok(fish.every(mob => mob.y > WATER && !mob.enemyType));
  const first = fish[0];
  const schools = snapshotFishSchools(fish, first.x, first.y, true, true);
  assert.ok(schools.size >= 10);
  for (const school of schools.values()) assert.ok(school.members.length >= 5 && school.members.length <= 8);
  assert.equal(schools.get(first.schoolId).startled, true);
  assert.ok([...schools.values()].some(school => !school.startled));
  assert.ok([...snapshotFishSchools(fish, first.x, first.y, true, false).values()].every(school => !school.startled));
});

test('shark size and collision dimensions are enlarged together', () => {
  assert.equal(sharkSpec.width, 39);
  assert.equal(sharkSpec.height, 18);
  assert.equal(sharkSpec.radius, 19.5);
  assert.equal(sharkSpec.maxHealth, 7);
});
