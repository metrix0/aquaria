import test from 'node:test';
import assert from 'node:assert/strict';
import { activateClass, unlockSkill } from '../src/classes.js';
import { ARROW, BOW, SPEAR, WORKBENCH } from '../src/content.js';
import { ITEMS } from '../src/inventory.js';
import { beginBowDraw, releaseBowDraw, createGame, craftItem, useWeapon, stepGame } from '../src/gameplay/simulation.js';
import { classHit, strikeMob, skillAttackDamage } from '../src/gameplay/class-effects.js';
import { damageMob, mobSpec } from '../src/gameplay/mobs.js';
import { takeDamage } from '../src/gameplay/player.js';
import { useWayfarerSkill, screenRange, stepWayfarer, finishWayfarer, catchFallMultiplier } from '../src/gameplay/wayfarer.js';
import { encodeSave, decodeSave } from '../src/save.js';

function game(...skills) {
 const g=createGame();
 g.classes.total={lesser:100,greater:10};activateClass(g,'wayfarer');
 for(const s of skills)assert.equal(unlockSkill(g,s),null);
 g.world.mobs=[]; g.inventory.hotbar[0]={id:'bow',count:1};g.inventory.add('arrow',8);
 return g;
}
function draw(g,time) {
 const p=g.player;
 assert.equal(beginBowDraw(g,0,p.x+100,p.y+Math.ceil(p.height/2)),true);
 const before=g.inventory.count('arrow');
 stepWayfarer(g,{},time);
 assert.equal(g.inventory.count('arrow'),before);
 assert.equal(g.projectiles.length,0);
 assert.equal(releaseBowDraw(g).inventoryChanged,true);
 assert.equal(g.inventory.count('arrow'),before-1);
 return g.projectiles[0];
}
test('normal bows hold and release, shorter charge is weaker, reload is longer',()=>{
 const early=draw(game(),.1);
 assert.ok(early.dx<ARROW.speed);assert.ok(early.damage<ARROW.damage);
 const normal=game();const shot=draw(normal,BOW.drawTime);
 assert.equal(shot.dx,240);assert.equal(shot.pierce,0);
 assert.equal(normal.attack.timer,.75);
 assert.equal(beginBowDraw(normal,0,normal.player.x+100,normal.player.y),true);
 assert.equal(normal.bowDraw,null);
});
test('Marksman full draw and overdraw have distinct speed and pierce',()=>{
 const normal=game('sharpened-eye','quickdraw');
 const a=draw(normal,BOW.drawTime+.9);
 assert.equal(a.dx,300);assert.equal(a.pierce,0);
 assert.equal(normal.attack.duration,.75/1.15);
 const g=game('sharpened-eye','quickdraw');
 const b=draw(g,BOW.drawTime+1);
 assert.equal(b.dx,375);assert.equal(b.pierce,1);assert.equal(b.charged,true);
});
function mobAt(g,dx,dy=0) {
 const mob=createGame().world.mobs.find(m=>m.kind==='crab');
 Object.assign(mob,{x:g.player.x+dx,y:g.player.y+g.player.height/2+dy-mobSpec(mob).centerY,health:100,maxHealth:100,respawn:0});
 g.world.mobs.push(mob);return mob;
}
test('Horizon Shot requires a bow, spends ammo and deals more damage at distance',()=>{
 const g=game('sharpened-eye','quickdraw','splitting-arrow');
 const p=g.player; p.y=40; const camera={x:p.x-80,y:0,width:260,height:200};
 const near=mobAt(g,30),far=mobAt(g,130),off=mobAt(g,190);
 assert.equal(screenRange(p.x,p.y,1,0,camera),180);
 g.inventory.hotbar[1]={id:'spear',count:1};
 assert.match(useWayfarerSkill(g,'horizonShot',1,p.x+100,p.y+11,camera),/bow/);
 assert.equal(useWayfarerSkill(g,'horizonShot',0,p.x+100,p.y+p.height/2,camera),null);
 assert.ok(near.health<100);assert.ok(far.health<near.health);assert.equal(off.health,100);
 assert.equal(g.inventory.count('arrow'),7);assert.equal(p.horizonBeam.endX,camera.x+camera.width);
});
test('Heat grows on hits, expires in five seconds, and counter triggers once on damage',()=>{
 const g=game('snareshot','barbed-trail','master-snare');
 const p=g.player;g.inventory.hotbar[1]={id:'spear',count:1};
 assert.equal(skillAttackDamage(p,10,false),11);
 classHit(g,{},10,false);assert.equal(p.heatBonus,.1);
 assert.ok(Math.abs(skillAttackDamage(p,10,false)-12.1)<1e-8);
 g.elapsed=5;stepWayfarer(g,{},0);assert.equal(p.heatBonus,0);
 const mob=mobAt(g,20);
 assert.match(useWayfarerSkill(g,'counter',0,p.x,p.y),/melee/);
 assert.equal(useWayfarerSkill(g,'counter',1,p.x,p.y),null);
 useWeapon(g,1,p.x+20,p.y);assert.equal(g.attack,null);
 finishWayfarer(g);assert.equal(mob.health,100);
 takeDamage(p,10);finishWayfarer(g);
 assert.ok(mob.health<100);assert.equal(p.counterTime,0);
 const health=mob.health;finishWayfarer(g);assert.equal(mob.health,health);
});
test('Perfect Weapon survives inventory serialization and is stronger independently of class',()=>{
 const g=game('trailrunner');g.inventory.add('wood',10);g.inventory.add('stone',10);
 for(const [id,n] of Object.entries(SPEAR.cost))g.inventory.add(id,n);
 assert.equal(craftItem(g,SPEAR,SPEAR.station,()=>.099),true);
 assert.equal(g.inventory.count('perfect-spear'),1);
 assert.equal(craftItem(g,SPEAR,SPEAR.station,()=>.1),true);
 assert.equal(g.inventory.count('spear'),1);
 const restored=createGame(decodeSave(encodeSave(g)));
 assert.equal(restored.inventory.count('perfect-spear'),1);
 assert.equal(ITEMS['perfect-spear'].weapon.id,'spear');
 activateClass(restored,'scholar');
 restored.inventory.hotbar[0]={id:'perfect-spear',count:1};
 useWeapon(restored,0,restored.player.x+30,restored.player.y);
 assert.ok(Math.abs(restored.attack.damage-SPEAR.damage*1.15)<1e-8);
});
test('Pathfinder catch reduces nearby ally fall loss, and mark affects direct and environmental damage',()=>{
 const g=game('trailrunner','safe-footing','far-sight');const p=g.player;
 assert.equal(p.skillBonuses.fall,.85);
 g.wayfarerPeers=[{x:p.x+12,y:p.y,height:p.height,grounded:true,catching:true}];
 assert.equal(catchFallMultiplier(g),.3);
 g.wayfarerPeers[0].x+=100;assert.equal(catchFallMultiplier(g),1);
 const mob=mobAt(g,20);
 assert.equal(useWayfarerSkill(g,'huntersMark',0,p.x,p.y),null);
 strikeMob(g,mob,10,0,0,true);
 assert.equal(mob.health,90);assert.equal(p.markArmed,0);assert.equal(mob.markedTime,12);
 damageMob(g.world,mob,10,0,0,g.effects,{poisonTick:true});
 assert.equal(mob.health,79);
});

