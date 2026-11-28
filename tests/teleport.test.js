import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/gameplay/simulation.js';
import { collides } from '../src/gameplay/player.js';
import { TELEPORT_DESTINATIONS, teleportPlayer } from '../src/gameplay/teleport.js';
import { zoneAt } from '../src/world/zones.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { CORAL_OPEN_ID } from '../src/world/ocean-layout.js';

test('all four teleport destinations are accessible without clipping or changing progress', () => {
  const game = createGame();
  const world = game.world;
  world.coralMarks = [1,2,3,4];
  for (const d of TELEPORT_DESTINATIONS) {
    game.player.dx = 120;
    game.player.dy = 90;
    assert.equal(teleportPlayer(game,d.id),true,d.id);
    assert.equal(game.zone,d.zone);
    assert.equal(collides(game.world,game.player.x,game.player.y,game.player.height),false,d.id);
    assert.equal(game.player.dx,0);
    assert.equal(game.player.dy,0);
    if(d.id === 'undergrounds') assert.equal(zoneAt(game.player),'underground');
    if(d.id === 'mermaid-puzzle') assert.ok(game.world.items.some(i=>i.kind==='coral-dial' && Math.abs(i.x-game.player.x)<64 && Math.abs(i.y-game.player.y)<64));
    if(d.id === 'statues') assert.ok(game.world.items.some(i=>i.kind==='class-statue' && Math.abs(i.x-game.player.x)<64));
  }
  assert.deepEqual(world.coralMarks,[1,2,3,4]);
  assert.equal(world.harvested.has(CORAL_OPEN_ID),false);
  assert.deepEqual(decodeSave(encodeSave(game)).world.coralMarks,[1,2,3,4]);
  assert.equal(teleportPlayer(game,'cave-1'),true);
  assert.equal(game.world,world);
  assert.equal(teleportPlayer(game,'bad'),false);
});

test('god-mode teleport keeps flight active and moves the safe save origin', () => {
  const game=createGame();
  game.player.flightOrigin={x:game.player.x,y:game.player.y,height:game.player.height};
  assert.equal(teleportPlayer(game,'statues'),true);
  assert.equal(game.player.flightOrigin.x,game.player.x);
  assert.equal(teleportPlayer(game,'undergrounds'),true);
  assert.equal(game.player.flightOrigin.y,game.player.y);
  assert.equal(decodeSave(encodeSave(game)).player.x,game.player.x);
});
