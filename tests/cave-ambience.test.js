import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';
import { batHasAir, bugHasFloor, caveFaunaInView, spawnCaveFaunaNear } from '../src/world/cave-ambience.js';
import { groveDistance, isDryIslandCave } from '../src/world/island-cave.js';
import { isDryJungleCave } from '../src/world/jungle-cave.js';
import { JUNGLE_ISLAND } from '../src/world/jungle-village.js';
import { ambientMobSpecs, stepAmbientMob } from '../src/gameplay/ambient-fauna.js';
import { damageMob, mobSpec, targetMobAt } from '../src/gameplay/mobs.js';

function area(column, row, width, height) {
  return { x: (column + WEST_EXTENSION) * TILE, y: row * TILE,
    width: width * TILE, height: height * TILE };
}

test('cave fauna are far rarer, exclude the super tree and stay in dry caves', () => {
  const world = createWorld();
  const island = caveFaunaInView(world, area(-50, 35, 115, 240));
  const jungle = caveFaunaInView(world, area(JUNGLE_ISLAND.center - 41, 25, 90, 425));
  const fauna = [...island, ...jungle];
  assert.ok(island.length > 0, 'island cave has wildlife outside tree sanctuary');
  assert.ok(jungle.length > 0, 'jungle cave has wildlife');
  assert.ok(island.length < 30, 'at least ~70% less dense than previous 90 in smaller area');
  for (const kind of ['ambient-ant', 'ambient-spider', 'ambient-bat']) {
    assert.ok(fauna.some(creature => creature.kind === kind), `spawns ${kind}`);
  }
  for (const mob of fauna) {
    const tx = Math.floor(mob.x / TILE);
    const ty = Math.floor(mob.y / TILE);
    const column = tx - WEST_EXTENSION;
    assert.ok(isDryIslandCave(column, ty) || isDryJungleCave(column, ty));
    if (isDryIslandCave(column, ty)) {
      assert.ok(groveDistance(column, ty) > 65, 'super tree and its surroundings stay free of ambient mobs');
    }
    assert.ok(mob.kind === 'ambient-bat'
      ? batHasAir(world, mob.x, mob.y)
      : bugHasFloor(world, mob.x, mob.y));
  }
  assert.deepEqual(caveFaunaInView(world, area(-50, 35, 115, 240)), island,
    'cave spawn locations are deterministic');
});

test('fauna are real, targetable, killable, respawning mobs that wander on their own', () => {
  const world = createWorld();
  const fauna = [
    ...caveFaunaInView(world, area(-50, 35, 115, 240)),
    ...caveFaunaInView(world, area(JUNGLE_ISLAND.center - 41, 25, 90, 425)),
  ];
  assert.ok(fauna.length);
  const before = world.mobs.length;
  const candidate = fauna.find(m => m.kind === 'ambient-bat') ?? fauna[0];
  spawnCaveFaunaNear(world, { x: candidate.x, y: candidate.y });
  const mob = world.mobs.find(m => m.id === candidate.id);
  assert.ok(mob, 'spawns into real world.mobs');
  assert.ok(world.mobs.length > before);
  const count = world.mobs.length;
  spawnCaveFaunaNear(world, { x: candidate.x, y: candidate.y });
  assert.equal(world.mobs.length, count, 'does not duplicate spawns');
  assert.equal(mobSpec(mob), ambientMobSpecs[mob.kind]);
  assert.equal(targetMobAt({ world, player: { x: mob.x, y: mob.y - 11 } },
    mob.x, mob.y + mobSpec(mob).centerY), mob);
  const origin = [mob.x, mob.y];
  mob.wanderDirection = 1;
  mob.wanderVertical = 0;
  mob.wanderTime = 50;
  for (let i = 0; i < 120; i++) stepAmbientMob(world, mob, 1 / 60);
  assert.ok(Math.hypot(mob.x - origin[0], mob.y - origin[1]) > 0, 'moves without player prompting');
  const effects = [];
  damageMob(world, mob, 1, 0, 0, effects);
  assert.equal(mob.health, 0, 'one hit kills small wildlife');
  assert.equal(mob.respawn, 150, 'death uses ordinary mob respawn');
  assert.equal(effects[0].message, 'Defeated ' + mobSpec(mob).name + '!');
});
