import test from 'node:test';
import assert from 'node:assert/strict';

import { MATERIAL } from '../src/content.js';
import { PLAYER_SIZE } from '../src/gameplay/player.js';
import { createGame, nearestItem, stepGame, templeDoorAt, transitionZone, beginClassStatueAwakening, advanceClassStatueAwakening } from '../src/gameplay/simulation.js';
import { connectRoom } from '../src/multiplayer/client.js';
import { editTile, tileAt, waterTileAt } from '../src/world.js';
import { TILE, WEST_EXTENSION, WORLD_VERSION } from '../src/world/generation.js';
import { waterTempleDoorBounds } from '../src/world/water-temple.js';
import { OVERWORLD_ZONE, WATER_TEMPLE_INTERIOR, WATER_TEMPLE_ZONE, STATUE_AWAKEN_SECONDS, CLASS_STATUE_HEIGHT } from '../src/world/water-temple-interior.js';

const NO_INPUT = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  holdingInteract: () => false,
};

test('Water Temple main door is interactable and transitions into the standalone temple interior', () => {
  const game = createGame();
  assert.equal(game.zone, OVERWORLD_ZONE);
  assert.ok(game.worlds[WATER_TEMPLE_ZONE]);

  const doorBounds = waterTempleDoorBounds(WEST_EXTENSION);
  game.player.x = doorBounds.x + doorBounds.width / 2;
  game.player.y = doorBounds.floor * TILE - game.player.height;

  const focused = nearestItem(game);
  assert.equal(focused?.kind, 'temple-door');
  assert.equal(focused?.targetZone, WATER_TEMPLE_ZONE);
  assert.equal(focused?.prompt, 'Enter Water Temple');

  const clicked = templeDoorAt(game, doorBounds.x + 12, doorBounds.y + 20);
  assert.equal(clicked?.id, 'water-temple-main-door');

  assert.equal(transitionZone(game, WATER_TEMPLE_ZONE), true);
  assert.equal(game.zone, WATER_TEMPLE_ZONE);
  assert.equal(game.world, game.worlds[WATER_TEMPLE_ZONE]);
  assert.equal(game.world.cols, WATER_TEMPLE_INTERIOR.cols);
  assert.equal(game.world.rows, WATER_TEMPLE_INTERIOR.rows);

  assert.equal(editTile(game.world, 10, 0, MATERIAL.air), false);
  assert.equal(tileAt(game.world, 0, 0), MATERIAL.stone);
  assert.equal(game.world.waterRow, game.world.rows);
  const floor = WATER_TEMPLE_INTERIOR.lowerFloorRow;
  for (let tx = 4; tx < game.world.cols - 4; tx++) {
    assert.equal(tileAt(game.world, tx, floor), MATERIAL.stone);
    assert.equal(tileAt(game.world, tx, floor - 1), MATERIAL.air);
    assert.equal(waterTileAt(game.world, tx, floor - 1), false);
  }
  assert.equal(game.world.templeDoors.length, 1);
  assert.ok(game.chests.has('water-temple-sanctum-chest'));
  assert.deepEqual(game.world.items.filter(i => i.kind === 'class-statue').map(i => i.classId), ['warden','wayfarer','scholar']);

});

test('Exiting Water Temple returns player outside the main door and overworld keeps running while inside', () => {
  const game = createGame();
  const doorBounds = waterTempleDoorBounds(WEST_EXTENSION);
  const outsideX = doorBounds.x + doorBounds.width / 2;
  const outsideY = doorBounds.floor * TILE - game.player.height;
  game.player.x = outsideX;
  game.player.y = outsideY;

  const overworldMob = game.worlds[OVERWORLD_ZONE].mobs.find(
    (mob) => mob.kind === 'fish' && mob.health > 0 && Math.abs(mob.x - outsideX) < 400,
  ) ?? game.worlds[OVERWORLD_ZONE].mobs.find((mob) => mob.kind === 'fish' && mob.health > 0);
  assert.ok(overworldMob);
  overworldMob.x = outsideX + 64;
  overworldMob.y = outsideY - 32;
  const initialX = overworldMob.x;

  assert.equal(transitionZone(game, WATER_TEMPLE_ZONE), true);

  // Step simulation while player is inside the Water Temple; overworld mob must continue moving.
  for (let i = 0; i < 10; i++) {
    stepGame(game, NO_INPUT, 0.05);
  }
  assert.notEqual(overworldMob.x, initialX);

  // Move to the interior exit door and return to overworld.
  const exitDoor = game.world.templeDoors[0];
  game.player.x = exitDoor.x;
  game.player.y = exitDoor.floor * TILE - game.player.height;

  const focusedExit = nearestItem(game);
  assert.equal(focusedExit?.kind, 'temple-door');
  assert.equal(focusedExit?.targetZone, OVERWORLD_ZONE);
  assert.equal(focusedExit?.prompt, 'Exit Water Temple');

  assert.equal(transitionZone(game, OVERWORLD_ZONE), true);
  assert.equal(game.zone, OVERWORLD_ZONE);
  assert.equal(game.world, game.worlds[OVERWORLD_ZONE]);
  assert.equal(game.player.x, outsideX);
  assert.equal(game.player.y, outsideY);
});

test('Multiplayer pose broadcasts include zone so players in different maps do not freeze or overlap', async () => {
  const listeners = new Map();
  const sent = [];
  const fakeChannel = {
    on(type, filter, handler) {
      listeners.set(`${type}:${filter.event}`, handler);
      return this;
    },
    subscribe(cb) {
      cb('SUBSCRIBED');
      return this;
    },
    async send(msg) {
      sent.push(msg);
    },
  };
  const fakeClient = {
    channel() { return fakeChannel; },
    async removeChannel() {},
    rpc() {
      return {
        abortSignal: async () => ({
          data: { id: 'room-1', topic: 'room-1', worldVersion: WORLD_VERSION, revision: 0, age: 0, tiles: [] },
          error: null,
        }),
      };
    },
  };
  const room = await connectRoom(
    { client: fakeClient },
    null,
    { status: () => {}, count: () => {}, terrain: () => {} },
  );

  const onPose = listeners.get('broadcast:pose');
  onPose({
    payload: {
      id: '11111111-1111-4111-8111-111111111112',
      zone: 'water-temple',
      x: 100,
      y: 200,
      dx: 0,
      dy: 0,
      facing: 1,
      grounded: true,
    },
  });

  const peers = Array.from(room.tick(2000, 0.016, { x: 500, y: 500, dx: 0, dy: 0, facing: 1, grounded: true }, null, null, null, 'water-temple'));
  assert.equal(peers.length, 1);
  assert.equal(peers[0].zone, 'water-temple');
  const lastPose = sent.findLast((m) => m.event === 'pose');
  assert.equal(lastPose.payload.zone, 'water-temple');
  room.close();
});

test('each nearby starter statue awakens its class only after the animation; distant and duplicate interactions are rejected', () => {
  const game = createGame();
  transitionZone(game, WATER_TEMPLE_ZONE);
  const statues = game.world.items.filter(i => i.kind === 'class-statue');
  assert.equal(beginClassStatueAwakening(game, statues[2]), false);
  assert.equal(statues[1].x - statues[0].x, 7 * TILE);
  assert.equal(statues[2].x - statues[1].x, 7 * TILE);
  assert.ok(game.world.cols <= 50, 'compact class chamber');
  for (const statue of statues) {
    assert.ok(CLASS_STATUE_HEIGHT >= 2 * PLAYER_SIZE.height && CLASS_STATUE_HEIGHT <= 3 * PLAYER_SIZE.height);
    assert.equal(statue.bounds.height, CLASS_STATUE_HEIGHT);
    assert.equal(statue.bounds.y + statue.bounds.height, statue.floor * TILE);
    game.player.x = statue.x;
    game.player.y = statue.floor * TILE - game.player.height;
    assert.equal(nearestItem(game)?.id, statue.id);
    const old = game.classes.active;
    assert.equal(beginClassStatueAwakening(game, statue), true);
    assert.equal(beginClassStatueAwakening(game, statue), false);
    assert.equal(advanceClassStatueAwakening(game, .25), null);
    assert.equal(game.classes.active, old);
    assert.equal(advanceClassStatueAwakening(game, STATUE_AWAKEN_SECONDS), statue.classId);
    assert.equal(game.classes.active, statue.classId);
    assert.equal(game.world.statueAwakening, null);
  }
});
