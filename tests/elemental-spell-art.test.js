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

test('tidal footprint is centered, radial, and clipped to the combat reach',()=>{
  const shapes=[],pixels=[];
  const ctx={globalAlpha:1,save(){},restore(){}};
  const reach=Array.from({length:64},(_,i)=>i<=16||i>=48?20:56);
  drawElementalImpact(ctx,(...v)=>pixels.push(v),(points,color)=>shapes.push(points),{spellFx:'tidal-pulse',radius:56,reach,life:.55,duration:.55});
  assert.equal(shapes[0].length,64);
  for(let i=0;i<64;i++)assert.ok(Math.abs(Math.hypot(...shapes[0][i])-reach[i])<.001);
  assert.ok(shapes[0][0][0]===20);
  assert.ok(shapes[0][32][0]===-56);
  assert.ok(shapes[0][16][1]===20);
  assert.ok(shapes[0][48][1]===-20);
  assert.ok(shapes.flat().every(p=>Math.hypot(...p)<=56.0001));
});
test('fireball is compact and explosion geometry stays within its hit radius',()=>{
  const ctx={globalAlpha:1,save(){},restore(){}};
  const shapes=[];
  drawElementalProjectile(ctx,()=>{},p=>shapes.push(p),{spell:'firebolt',life:.6});
  assert.ok(shapes.flat().every(([x,y])=>x>=-20&&x<=8&&Math.abs(y)<=6));
  for(const life of [.52,.3,.1]){
    shapes.length=0;
    drawElementalImpact(ctx,()=>{},p=>shapes.push(p),{spellFx:'firebolt',radius:44,life,duration:.52});
    assert.ok(shapes.flat().every(p=>Math.hypot(...p)<=44.0001));
  }
});
