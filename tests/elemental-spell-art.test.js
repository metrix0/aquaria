import test from 'node:test';
import assert from 'node:assert/strict';
import { drawElementalImpact, drawElementalProjectile, drawFrozenMob } from '../src/elemental-spell-art.js';
test('every element draws distinct nonempty shapes across its animation',()=>{
  let calls=[];
  const ctx={globalAlpha:1,save(){},restore(){},scale(){},beginPath(){},lineTo(){},moveTo(){},stroke(){calls.push(this.strokeStyle);}};
  const rect=(x,y,w,h,color)=>{assert.ok([x,y,w,h].every(Number.isFinite));calls.push(color);};
  const polygon=(points,color)=>{assert.ok(points.flat().every(Number.isFinite));calls.push(color);};
  const signatures=new Set();
  for(const spellFx of ['firebolt','frost-lance','storm-arc','tidal-pulse','mend','beam','healing-stream']){
    calls=[];ctx.globalAlpha=1;
    for(const life of [.9,.5,.1])drawElementalImpact(ctx,rect,polygon,{spellFx,life,duration:1,radius:44,x:0,y:0,endX:40,endY:20});
    assert.ok(calls.length>0,spellFx);signatures.add(calls.join(','));
  }
  assert.equal(signatures.size,7);
  for(const spell of ['firebolt','frost-lance','storm-arc']){calls=[];drawElementalProjectile(ctx,rect,polygon,{spell,life:.6});assert.ok(calls.length>0);}
  calls=[];drawFrozenMob(rect,polygon,{radius:9,centerY:0},{},false);drawFrozenMob(rect,polygon,{radius:9,centerY:0},{},true);assert.ok(calls.length>0);
});
