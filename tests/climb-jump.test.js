import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '../src/gameplay/simulation.js';
import { movePlayer } from '../src/gameplay/player.js';
import { TILE } from '../src/world/generation.js';

for (const kind of ['rope', 'ladder']) {
  for (const right of [false, true]) {
    test(`jump from ${kind} (right=${right}) launches and does not immediately reattach`, () => {
      const { world, player } = createGame();
      const route = world.caveClimbs.find(r => r.kind === kind && r.bottom - r.top >= 6);
      assert.ok(route);
      Object.assign(player, { x: (route.tx + .5) * TILE, y: (route.top + 3) * TILE });
      const dt = 1 / 60;
      movePlayer(world, player, { down: true }, dt);
      assert.equal(player.climb, route);
      const y = player.y;
      movePlayer(world, player, { jump: true, up: true, right }, dt);
      assert.equal(player.climb, null);
      assert.ok(player.dy < -200);
      assert.ok(player.y < y);
      const launch = player.dy;
      movePlayer(world, player, { up: true }, dt);
      assert.equal(player.climb, null);
      assert.ok(player.dy > launch && player.dy < -180);
      movePlayer(world, player, {}, dt);
      assert.ok(player.dy >= -115, 'releasing up shortens the jump');
      movePlayer(world, player, { up: true, jump: true }, dt);
      assert.equal(player.climb, route, 'a fresh press can grab the climb again');
    });
  }
}
