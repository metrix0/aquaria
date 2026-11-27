import assert from 'node:assert/strict';
import test from 'node:test';
import { activateClass, unlockSkill, equippedSkill, equipSkill } from '../src/classes.js';
import { CAULDRON, MATERIAL, STEWS, STEW_RECIPES } from '../src/content.js';
import { createGame, craftItem, canCraftItem, useFood, useDressing, cauldronAt, stepGame, useWeapon } from '../src/gameplay/simulation.js';
import { applyConfusion, takeDamage } from '../src/gameplay/player.js';
import { skillAttackDamage } from '../src/gameplay/class-effects.js';
import { applyFeast, beneficial, harmful, confuseOnHit, foodYield, spendTomeCooldown, stepScholar, receiveFeasts, tomeEffect, useScholarSkill } from '../src/gameplay/scholar.js';
import { mobSpec, stepMobs } from '../src/gameplay/mobs.js';
import { editTile } from '../src/world.js';
import { TILE } from '../src/world/generation.js';
import { encodeSave, decodeSave } from '../src/save.js';

const catalyst=['luminous-formula','invigorating-elixir','perfected-catalyst'];
const alchemist=['bitter-extract','debilitating-compound','venom-mist'];
const chef=['field-dressing','naturalists-care','purifying-tonic'];
function scholar(...ids) {
 const g=createGame();g.classes.total={lesser:50,greater:10};activateClass(g,'scholar');
 for(const id of ids) assert.equal(unlockSkill(g,id),null,id);
 return g;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6, a+' != '+b);
test('Catalyst tome potency, mana bypass and normal cooldown fallback, very slow regeneration and save',()=>{
 const g=scholar(...catalyst),p=g.player;
 near(tomeEffect(p,100),107);
 assert.deepEqual(spendTomeCooldown(p,8),{allowed:true,cooldown:0,manaSpent:8});
 assert.equal(p.mana,22);
 p.mana=2;
 assert.deepEqual(spendTomeCooldown(p,8),{allowed:true,cooldown:8,manaSpent:0});
 assert.equal(spendTomeCooldown(p,8,4).allowed,false);
 stepScholar(g,10);near(p.mana,3);
 const loaded=createGame(decodeSave(encodeSave(g)));near(loaded.player.mana,3);
 activateClass(g,'warden');stepScholar(g,10);near(p.mana,3);
});
test('Hyper Beam consumes mana, hits the target and respects a solid wall',()=>{
 const g=scholar(...catalyst),p=g.player;
 const y=p.y+p.height/2;
 const crab=g.world.mobs.find(m=>m.kind==='crab'),spec=mobSpec(crab);
 Object.assign(crab,{x:p.x+40,y:y-spec.centerY,health:100,respawn:0});
 g.world.mobs=[crab];
 const camera={x:p.x-100,y:p.y-100,width:300,height:250};
 assert.equal(useScholarSkill(g,'hyperBeam',p.x+100,y,camera),null);
 assert.equal(p.mana,0);near(crab.health,100-30*1.5*1.07);
 assert.ok(p.hyperBeamTime>0);
 p.mana=30;crab.health=100;
 editTile(g.world,Math.floor((p.x+20)/TILE),Math.floor(y/TILE),MATERIAL.stone);
 assert.equal(useScholarSkill(g,'hyperBeam',p.x+100,y,camera),null);
 assert.equal(crab.health,100);
});
test('Alchemist scales existing effects and beast transformation expires',()=>{
 const g=scholar(...alchemist),p=g.player;
 near(beneficial(p,10),11.5);near(harmful(p,10),8.5);
 p.health=20;g.inventory.hotbar[0]={id:'kelp-dressing',count:1};
 assert.ok(useDressing(g,0).inventoryChanged);near(p.health,54.5);
 applyConfusion(p,10);near(p.confused,8.5);p.confused=0;
 assert.equal(useScholarSkill(g,'beastFlask'),null);near(p.beastDrinkTime,.7);
 assert.ok(!p.beastTime);near(skillAttackDamage(p,5),5);
 stepScholar(g,.3);assert.ok(p.beastDrinkTime>0);
 stepScholar(g,.4);near(p.beastTime,11.5);
 near(skillAttackDamage(p,5),15);near(takeDamage(p,20,true),10.8);
 assert.match(useScholarSkill(g,'beastFlask'),/recharging/);
 stepScholar(g,12);assert.equal(p.beastTime,0);near(skillAttackDamage(p,5),5);
});
test('Confusing Touch lasts five seconds and cannot trigger again until ready',()=>{
 const g=scholar(...alchemist),p=g.player;
 const enemy=g.world.mobs.find(m=>m.kind==='shark');
 assert.ok(enemy);assert.equal(confuseOnHit(g,enemy),true);assert.equal(enemy.scholarConfused,5);
 assert.equal(confuseOnHit(g,enemy),false);
 assert.equal(p.wardenCooldowns.confusingTouch,12);
 const before=enemy.scholarConfused;
 g.world.mobs=[enemy];stepMobs(g.world,p,.1,1,false,false,g.enemies,g.effects);
 near(enemy.scholarConfused,before-.1);assert.equal(enemy.dx,0);assert.equal(enemy.dy,0);
});
test('Chef doubles food drops only and makes persistent stews with 1?3 ingredients',()=>{
 const g=scholar(...chef),p=g.player;
 assert.equal(foodYield(p,'raw-crab',2,()=>.49),4);assert.equal(foodYield(p,'kelp',2,()=>.49),4);
 assert.equal(foodYield(p,'raw-fish',2,()=>.5),2);assert.equal(foodYield(p,'iron',2,()=>0),2);
 assert.ok(STEW_RECIPES.every(r=>r.ingredients.length>=1&&r.ingredients.length<=3));
 g.inventory.add('iron',4);g.inventory.add('stone',3);
 assert.equal(canCraftItem(g,CAULDRON,'workbench'),true);
 assert.equal(craftItem(g,CAULDRON,'workbench'),true);
 const tx=Math.floor(p.x/TILE)+1,ty=Math.floor(p.y/TILE);
 editTile(g.world,tx,ty,MATERIAL.cauldron);assert.equal(cauldronAt(g,tx,ty).kind,'cauldron');
 const r=STEW_RECIPES.find(r=>r.ingredients.join(',')==='cooked-crab,cooked-crab,cooked-fish');
 g.inventory.add('cooked-crab',2);g.inventory.add('cooked-fish',1);
 assert.equal(craftItem(g,r,'cauldron'),true);
 const loaded=createGame(decodeSave(encodeSave(g)));assert.equal(loaded.inventory.count(r.id),1);
 const slot=g.inventory.hotbar.findIndex(s=>s?.id===r.id);
 if(slot<0){g.inventory.spend(r.id,1);g.inventory.hotbar[0]={id:r.id,count:1};}
 p.health=30;p.oxygen=1;assert.ok(useFood(g,slot<0?0:slot).inventoryChanged);
 near(p.health,60);near(p.oxygen,16);
 activateClass(g,'warden');assert.equal(canCraftItem(g,CAULDRON,'workbench'),false);
});
test('Feast cycles, selects, cleanses and applies a single area pulse to allies',()=>{
 const g=scholar(...chef),p=g.player;
 assert.equal(useScholarSkill(g,'feast'),null);assert.equal(p.feastSelecting,1);
 assert.equal(useScholarSkill(g,'feast'),null);assert.equal(p.spinachTime,12);
 near(skillAttackDamage(p,10),12);
 const receiver=createGame();receiver.player.x=p.x;receiver.player.y=p.y;
 receiver.wayfarerPeers=[{feastPulse:p.feastPulse}];stepScholar(receiver,.1);
 assert.equal(receiver.player.spinachTime,12);
 stepScholar(receiver,1);assert.equal(receiver.player.spinachTime,11);
 p.wardenCooldowns.feast=0;assert.equal(useScholarSkill(g,'feast'),null);
 stepScholar(g,.5);p.poison=5;p.blindness=3;p.inkSplats=[{time:1}];
 assert.equal(useScholarSkill(g,'feast'),null);assert.equal(p.poison,0);assert.equal(p.blindness,0);assert.equal(p.inkSplats.length,0);
 p.wardenCooldowns.feast=0;useScholarSkill(g,'feast');stepScholar(g,1);
 useScholarSkill(g,'feast');assert.equal(p.carrotTime,12);
});
test('All three active skills can be unlocked but only two equipped',()=>{
 const g=scholar(...catalyst,...alchemist,...chef);
 assert.equal(equippedSkill(g.classes,0).ability,'hyperBeam');
 assert.equal(equippedSkill(g.classes,1).ability,'beastFlask');
 assert.equal(equipSkill(g,1,'purifying-tonic'),null);assert.equal(equippedSkill(g.classes,1).ability,'feast');
});

test('Beast Flask drinking is cancelled by incapacitation before transformation',()=>{
 const g=scholar(...alchemist),p=g.player;
 assert.equal(useScholarSkill(g,'beastFlask'),null);
 p.stun=2;stepScholar(g,.2);
 assert.equal(p.beastDrinkTime,0);assert.equal(p.beastTime,0);
});
test('Feast receive works without a simulation step and does not reapply or affect distant allies',()=>{
 const g=scholar(...chef),p=g.player;
 useScholarSkill(g,'feast');useScholarSkill(g,'feast');
 const ally=createGame();
 ally.player.x=p.x;ally.player.y=p.y;
 ally.wayfarerPeers=[{feastPulse:p.feastPulse}];
 receiveFeasts(ally);assert.equal(ally.player.spinachTime,12);
 ally.player.spinachTime=10;
 receiveFeasts(ally);assert.equal(ally.player.spinachTime,10);
 const far=createGame();
 far.player.x=p.x+7*TILE;far.player.y=p.y;
 far.wayfarerPeers=ally.wayfarerPeers;
 receiveFeasts(far);assert.ok(!far.player.spinachTime);
});
