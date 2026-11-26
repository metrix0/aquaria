import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/gameplay/simulation.js';
import { SOLO_DEATH_SECONDS, MULTIPLAYER_DEATH_SECONDS, REVIVE_SECONDS, nearestDowned } from '../src/gameplay/revival.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { SPAWN, TILE } from '../src/world/generation.js';

function die(multiplayer=false) {
  const game=createGame();
  game.world.mobs=[];
  game.world.caveTraps=[];
  game.player.health=0;
  stepGame(game,{multiplayer},1/60);
  return game;
}

test('solo corpse remains before respawn and cannot move or attack',()=>{
  const g=die();
  const p=g.player;
  assert.equal(p.downed.remaining,SOLO_DEATH_SECONDS);
  const x=p.x;
  stepGame(g,{right:true,jump:true},1);
  assert.equal(g.player,p);
  assert.equal(p.x,x);
  assert.equal(p.health,0);
  stepGame(g,{},SOLO_DEATH_SECONDS-1);
  assert.notEqual(g.player,p);
  assert.equal(g.player.x,SPAWN.x);
  assert.equal(g.player.health,100);
});

test('multiplayer hold pauses the timer; release resets progress and resumes timer',()=>{
  const g=die(true), p=g.player, d=p.downed;
  assert.equal(d.remaining,MULTIPLAYER_DEATH_SECONDS);
  const ally={id:'ally',x:p.x,y:p.y,height:p.height,reviveTarget:d.id,seenAt:1000};
  g.wayfarerPeers=[ally];
  stepGame(g,{multiplayer:true,now:1000},1);
  assert.equal(d.remaining,20);
  assert.equal(d.progress,1);
  ally.reviveTarget=null;
  stepGame(g,{multiplayer:true,now:1100},1);
  assert.equal(d.remaining,19);
  assert.equal(d.progress,0);
  ally.reviveTarget=d.id; ally.seenAt=1200;
  stepGame(g,{multiplayer:true,now:1200},1);
  assert.equal(d.remaining,19);
  ally.seenAt=1300;
  stepGame(g,{multiplayer:true,now:1300},REVIVE_SECONDS-1);
  assert.equal(g.player,p);
  assert.equal(p.downed,null);
  assert.equal(p.health,50);
});

test('stale holds, wrong death tokens and distant or downed allies cannot pause timer',()=>{
  const g=die(true),p=g.player,d=p.downed;
  const a={id:'ally',x:p.x,y:p.y,height:p.height,reviveTarget:d.id,seenAt:0};
  g.wayfarerPeers=[a];
  stepGame(g,{multiplayer:true,now:1000},1);
  a.seenAt=1000;a.reviveTarget='old';
  stepGame(g,{multiplayer:true,now:1000},1);
  a.reviveTarget=d.id;a.x+=10*TILE;
  stepGame(g,{multiplayer:true,now:1000},1);
  a.x=p.x;a.downed={};
  stepGame(g,{multiplayer:true,now:1000},1);
  assert.equal(d.remaining,16);
  stepGame(g,{multiplayer:true,now:1000},16);
  assert.notEqual(g.player,p);
});

test('nearby living player can select a corpse; reload cannot resurrect at death site',()=>{
  const g=die(true),p=g.player;
  const ally={x:p.x,y:p.y,height:p.height,health:100};
  assert.equal(nearestDowned(ally,[p]),p);
  assert.equal(nearestDowned(p,[p]),null);
  const restored=createGame(decodeSave(encodeSave(g)));
  assert.equal(restored.player.health,100);
  assert.equal(restored.player.x,SPAWN.x);
  assert.equal(restored.player.downed,undefined);
});
