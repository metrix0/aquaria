import test from 'node:test';
import assert from 'node:assert/strict';

import { MATERIAL } from '../src/content.js';
import { createGame, nearestItem, stepGame, templeDoorAt, transitionZone } from '../src/gameplay/simulation.js';
import { connectRoom } from '../src/multiplayer/client.js';
import { editTile, tileAt, waterTileAt } from '../src/world.js';
import { TILE, WEST_EXTENSION, WORLD_VERSION } from '../src/world/generation.js';
import { waterTempleDoorBounds } from '../src/world/water-temple.js';
import { OVERWORLD_ZONE, WATER_TEMPLE_INTERIOR, WATER_TEMPLE_ZONE } from '../src/world/water-temple-interior.js';

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

  // Interior walls are protected; water fills from the top height of the door down to the floor.
  assert.equal(editTile(game.world, 10, 33, MATERIAL.air), false);
  assert.equal(tileAt(game.world, 0, 0), MATERIAL.stone);
  const doorTopRow = WATER_TEMPLE_INTERIOR.lowerFloorRow - WATER_TEMPLE_INTERIOR.exitDoorHeightTiles;
  assert.equal(game.world.waterRow, doorTopRow);
  assert.equal(waterTileAt(game.world, 15, doorTopRow - 1), false);
  assert.equal(waterTileAt(game.world, 15, doorTopRow), true);
  assert.equal(waterTileAt(game.world, 15, doorTopRow + 1), true);
  assert.equal(waterTileAt(game.world, 36, 12), false);
  assert.ok(game.chests.has('water-temple-sanctum-chest'));
  assert.ok(game.world.templeDoors.some((d) => d.id === 'water-temple-sanctum-door'));
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
