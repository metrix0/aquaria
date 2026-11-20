import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/gameplay/simulation.js';
import { SPAWN_CATEGORIES, spawnEnemyNear } from '../src/gameplay/enemy-spawner.js';
import { damageMob, mobSpec } from '../src/gameplay/mobs.js';
import { TILE, WEST_EXTENSION } from '../src/world/generation.js';

const options = SPAWN_CATEGORIES.flatMap(group => group.entries.map(([id]) => id));

test('Spawn menu lists every hostile kind plus ambient wildlife', () => {
  const all = new Set(options);
  assert.equal(all.size, options.length, 'no duplicate entries');
  for (const kind of [
    'jellyfish', 'squid', 'shark', 'lionfish', 'reef-snapper', 'lanternfish', 'kraken',
    'spider', 'archer', 'miner', 'scorpion', 'hammer', 'mimic',
    'cannibal-spear', 'cannibal-bow', 'shaman', 'cave-frog', 'frog', 'worm',
    'ghost', 'ambient-ant', 'ambient-spider', 'ambient-bat',
  ]) assert.ok(all.has(kind), kind);
});

test('Can spawn every enemy near the player with real health and valid targets', () => {
  const game = createGame();
  const { world, player } = game;
  player.facing = 1;
  for (const kind of options) {
    const result = spawnEnemyNear(world, player, kind);
    assert.ok(result.mob, kind + ': ' + (result.error ?? 'missing mob'));
    const mob = result.mob;
    assert.ok(world.mobs.includes(mob));
    assert.ok(mobSpec(mob).maxHealth > 0);
    assert.equal(mob.health, mob.maxHealth);
    assert.equal(mob.respawn, 0);
    assert.equal(mob.homeX, mob.x);
    assert.equal(mob.homeY, mob.y);
    assert.equal(mob.testSpawn, true);
  }
  assert.equal(spawnEnemyNear(world, player, 'nonexistent').error, 'Unknown enemy.');
});

test('Spawns work in a cave, and killing a test enemy removes it without respawning', () => {
  const game = createGame();
  const { world, player } = game;
  player.x = (40 + WEST_EXTENSION) * TILE;
  player.y = 106 * TILE;
  const result = spawnEnemyNear(world, player, 'spider');
  assert.ok(result.mob, result.error);
  const mob = result.mob;
  const events = [];
  damageMob(world, mob, mob.health, 0, 20, events);
  assert.equal(mob.health, 0);
  assert.equal(world.mobs.includes(mob), false);
  assert.ok(events.length);
});

test('all spawned types can enter the normal gameplay update without errors', () => {
  const game = createGame();
  for (const kind of options) {
    const result = spawnEnemyNear(game.world, game.player, kind);
    assert.ok(result.mob, kind + ': ' + (result.error ?? 'missing'));
    for (let frame = 0; frame < 15; frame++) {
      assert.doesNotThrow(() => stepGame(game, { night: false }, 1 / 60), kind);
      game.effects.length = 0;
    }
    game.world.mobs = game.world.mobs.filter(mob => !mob.testSpawn);
  }
});
