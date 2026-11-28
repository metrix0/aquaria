import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, nearestItem } from '../src/gameplay/simulation.js';
import { waterTileAt } from '../src/world.js';
import { TILE, WEST_EXTENSION, KRAKEN_COLUMN } from '../src/world/generation.js';
import { CORAL_COLUMN } from '../src/world/ocean-layout.js';
import { drawOceanLandmark } from '../src/ocean-landmark-art.js';

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
      let pixels=0;
      drawOceanLandmark((x,y,w,h)=>{assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>0&&h>0);pixels++;},item,1);
      assert.ok(pixels>50);
    }
  }
});
