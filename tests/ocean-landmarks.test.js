import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, nearestItem } from '../src/gameplay/simulation.js';
import { waterTileAt } from '../src/world.js';
import { TILE, WEST_EXTENSION, KRAKEN_COLUMN, groundAt, WATER_ROW } from '../src/world/generation.js';
import { CORAL_COLUMN } from '../src/world/ocean-layout.js';
import { drawOceanLandmark, landmarkFloorAt } from '../src/ocean-landmark-art.js';

test('longer approaches contain swimmable ruins with stocked chests and oversized scenery', () => {
  const game = createGame();
  const {world} = game;
  assert.ok(Math.abs(CORAL_COLUMN) >= 2 * 357 && Math.abs(CORAL_COLUMN) <= 3 * 357);
  assert.ok(KRAKEN_COLUMN-150 >= 2*303 && KRAKEN_COLUMN-150 <= 3*303);
  for(const side of ['west','east']) {
    const items=world.items.filter(item=>item.id.startsWith('ocean-'+side+'-'));
    const landmarks=items.filter(item=>item.kind==='ocean-landmark');
    for(const style of ['ruin','bones','reef','kelp']) assert.ok(landmarks.some(item=>item.style===style));
    const chests=items.filter(item=>item.kind==='chest');
    assert.equal(chests.length,5);
    for(const chest of chests) {
      assert.equal(waterTileAt(world,Math.floor(chest.x/TILE),Math.floor(chest.y/TILE)),true,chest.id);
      assert.ok(game.chests.get(chest.id).filter(Boolean).length>=2);
      game.player.x=chest.x; game.player.y=chest.y-game.player.height/2;
      assert.equal(nearestItem(game)?.id,chest.id);
      const column=chest.x/TILE-WEST_EXTENSION;
      assert.ok(side==='west'?column>CORAL_COLUMN&&column<-108:column>150&&column<KRAKEN_COLUMN);
    }
    for(const item of landmarks) {
      assert.ok(item.floorProfile.length * TILE >= item.radius * 2);
      let pixels=0;
      drawOceanLandmark((x,y,w,h)=>{assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>0&&h>0);assert.ok(y+h<=landmarkFloorAt(item,x)+1e-6, 'buried art must be clipped');pixels++;},item,1);
      assert.ok(pixels>50);
    }
  }
});

test('fossils and ruins use varied silhouettes, scales and the actual seabed profile', () => {
  const {world}=createGame();
  const bones=world.items.filter(item=>item.style==='bones');
  const ruins=world.items.filter(item=>item.style==='ruin');
  assert.ok(Math.max(...bones.map(item=>item.scale))/Math.min(...bones.map(item=>item.scale))>4);
  assert.ok(new Set(bones.map(item=>item.variant)).size>=3);
  assert.ok(new Set(ruins.map(item=>item.variant)).size>=3);
  for(const item of [...bones,...ruins]) {
    assert.ok(item.topY<item.y && item.bottomY>=item.y);
    let grounded=false;
    drawOceanLandmark((x,y,w,h)=>{if(Math.abs(y+h-landmarkFloorAt(item,x))<2) grounded=true;},item,0);
    assert.ok(grounded,item.id+' should touch seabed');
  }
});

import { shipwreckOrigin, WRECK_DEBRIS_SITES, WRECK_WIDTH } from '../src/world/shipwreck.js';

test('western wreck moves east and its debris follows the submerged seabed nearly to the beach', () => {
  const {world}=createGame();
  assert.equal(shipwreckOrigin.column,-190);
  const debris=world.items.filter(item=>item.style==='wreck-debris');
  assert.equal(debris.length,WRECK_DEBRIS_SITES.length);
  assert.ok(new Set(debris.map(item=>item.variant)).size>=4);
  const columns=debris.map(item=>Math.floor(item.x/TILE)-WEST_EXTENSION);
  assert.ok(columns[0]>shipwreckOrigin.column+WRECK_WIDTH);
  assert.ok(columns.every((col,i)=>i===0||col-columns[i-1]<=15));
  let beach=56;
  while(groundAt(beach-1+WEST_EXTENSION)<=WATER_ROW) beach--;
  assert.ok(beach-columns.at(-1)>=20 && beach-columns.at(-1)<=25);
  for(const item of debris) {
    const tx=Math.floor(item.x/TILE),ty=groundAt(tx);
    assert.equal(item.y,ty*TILE);
    assert.ok(waterTileAt(world,tx,ty-1),item.id);
    let pixels=0,grounded=false;
    drawOceanLandmark((x,y,w,h)=>{
      assert.ok([x,y,w,h].every(Number.isFinite));
      assert.ok(y+h<=landmarkFloorAt(item,x)+1e-6);
      if(Math.abs(y+h-landmarkFloorAt(item,x))<2) grounded=true;
      pixels++;
    },item,0);
    assert.ok(pixels>20 && grounded,item.id+' should have grounded wreck art');
  }
});
