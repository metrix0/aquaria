import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMining, createGame, targetTile } from '../src/gameplay/simulation.js';
import { playerInWater } from '../src/gameplay/player.js';
import { editTile, waterTileAt } from '../src/world.js';
import { MATERIAL } from '../src/content.js';
import { TILE, WATER_ROW } from '../src/world/generation.js';

test('underwater digging takes four times as long with or without a pickaxe', () => {
  const game = createGame();
  const { world, player } = game;
  const tx = 230, ty = WATER_ROW + 2;
  for (const row of [ty-2,ty-1,ty,ty+1]) {
    for(const col of [tx-2,tx-1,tx,tx+1]) editTile(world,col,row,MATERIAL.air);
  }
  editTile(world,tx,ty,MATERIAL.stone);
  const target = targetTile(game,(tx+.5)*TILE,(ty+.5)*TILE);
  for(const hand of [false,true]) {
    if(hand) game.inventory.hotbar[0]=null;
    Object.assign(player,{x:(tx-1+.5)*TILE,y:(ty-2)*TILE-player.height});
    assert.equal(playerInWater(world,player),false);
    const dry=advanceMining(game,{...target,reachable:true},null,.1);
    Object.assign(player,{x:(tx-1+.5)*TILE,y:ty*TILE});
    assert.equal(waterTileAt(world,tx-1,ty),true);
    assert.equal(playerInWater(world,player),true);
    const wet=advanceMining(game,{...target,reachable:true},null,.1);
    assert.equal(wet.duration,dry.duration*4);
    assert.equal(wet.progress,dry.progress/4);
    const continued=advanceMining(game,{...target,reachable:true},dry,.1);
    assert.equal(continued.progress,dry.progress+wet.progress);
  }
});
