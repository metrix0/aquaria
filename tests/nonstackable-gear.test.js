import assert from 'node:assert/strict';
import test from 'node:test';
import { Inventory, isStackable, moveStack, restoreSlots } from '../src/inventory.js';

const empty = () => new Inventory({hotbar:[],backpack:[]});
const gear=['firebolt-tome','storm-arc-tome','iron-sword','perfect-iron-sword','bow','copper-pickaxe','grappling-hook','root-ring','wooden-shield','explorers-anklet','parrot-pet'];
test('each reusable item uses a separate inventory slot',()=>{
  for(const id of gear){
    const inv=empty();
    assert.equal(isStackable(id),false,id);
    assert.ok(inv.add(id,2),id);
    assert.ok(inv.add(id,1,{preferHotbar:true}),id);
    assert.equal(inv.count(id),3);
    assert.ok([...inv.hotbar,...inv.backpack].filter(s=>s?.id===id).every(s=>s.count===1));
  }
});
test('resources, ammunition, scrolls and food still stack',()=>{
  for(const id of ['wood','arrow','poison-arrow','firebolt-scroll','mend-scroll','cooked-fish','kelp-dressing']){
    const inv=empty();
    assert.ok(inv.add(id,2));
    assert.ok(inv.add(id,3));
    assert.equal(inv.count(id),5);
    assert.equal([...inv.hotbar,...inv.backpack].filter(s=>s?.id===id).length,1);
  }
});
test('adding several individual items is atomic when there is insufficient space',()=>{
  const inv=empty();
  inv.backpack.fill({id:'wood',count:1});
  inv.hotbar.fill({id:'stone',count:1},0,4);
  assert.equal(inv.canAdd('iron-sword',2),false);
  assert.equal(inv.add('iron-sword',2),false);
  assert.equal(inv.count('iron-sword'),0);
  assert.ok(inv.add('iron-sword',1));
  assert.equal(inv.hotbar[4].count,1);
  assert.equal(inv.hotbar[5],null);
});
test('inventory and chest transfers never merge identical gear',()=>{
  const a=[{id:'iron-sword',count:1}],b=[{id:'iron-sword',count:1},null];
  assert.equal(moveStack(a,0,b,0),false);
  assert.ok(moveStack(a,0,b,1));
  assert.equal(b[1].count,1);
});
test('legacy equipment stacks split into available inventory and chest slots',()=>{
  const inv=new Inventory({hotbar:[{id:'firebolt-tome',count:3}],backpack:[]});
  assert.equal(inv.count('firebolt-tome'),3);
  assert.ok([...inv.hotbar,...inv.backpack].filter(s=>s?.id==='firebolt-tome').every(s=>s.count===1));
  const chest=restoreSlots([{id:'iron-sword',count:2}],4);
  assert.deepEqual(chest.slice(0,2),[{id:'iron-sword',count:1},{id:'iron-sword',count:1}]);
});
test('full legacy saves preserve overflow without allowing it to merge',()=>{
  const inv=new Inventory({hotbar:Array.from({length:6},()=>({id:'wood',count:1})),backpack:[{id:'iron-sword',count:3},...Array.from({length:23},()=>({id:'wood',count:1}))]});
  assert.equal(inv.count('iron-sword'),3);
  const chest=[null];
  assert.ok(moveStack(inv.backpack,0,chest,0));
  assert.equal(chest[0].count,1);
  assert.equal(inv.backpack[0].count,2);
  assert.equal(moveStack(inv.backpack,0,chest,0),false);
});
