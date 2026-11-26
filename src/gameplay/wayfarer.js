import { ARROW, BOW, POISON_ARROW } from '../content.js';
import { ITEMS } from '../inventory.js';
import { TILE } from '../world/generation.js';
import { solidAt } from '../world.js';
import { playerImmobilized, playerInWater } from './player.js';
import { mobSpec } from './mobs.js';
import { strikeMob, skillAttackDamage } from './class-effects.js';
import { wardenAttackBlocked } from './warden.js';

export const WAYFARER_SKILLS = [
  { id:'horizonShot', name:'Horizon Shot', key:'Q', timer:'beamTime', cooldown:20 },
  { id:'counter', name:'Counterstance', key:'R', timer:'counterTime', cooldown:20 },
  { id:'huntersMark', name:'Hunter Mark', key:'T', timer:'markArmed', cooldown:25 },
];

export function screenRange(x,y,dx,dy,camera) {
  return Math.max(0,Math.min(
    dx>1e-6?(camera.x+camera.width-x)/dx:dx< -1e-6?(camera.x-x)/dx:Infinity,
    dy>1e-6?(camera.y+camera.height-y)/dy:dy< -1e-6?(camera.y-y)/dy:Infinity));
}

export function useWayfarerSkill(game,id,slot,wx,wy,camera) {
  const p=game.player, skill=WAYFARER_SKILLS.find(s=>s.id===id);
  if (!skill || !p.skillBonuses?.[id]) return 'Skill not unlocked.';
  if (p.flightOrigin || playerImmobilized(p) || wardenAttackBlocked(p) || p.counterTime>0) return 'Cannot cast right now.';
  p.wardenCooldowns ??= {};
  if (p.wardenCooldowns[id]>0) return 'Skill is recharging.';
  const item=ITEMS[game.inventory.hotbar[slot]?.id], weapon=item?.weapon;
  if (id==='horizonShot') {
    if (weapon?.id!==BOW.id) return 'Select a bow first.';
    if (game.attack) return 'Bow is reloading.';
    const ammo=game.inventory.count(POISON_ARROW.id)?POISON_ARROW:game.inventory.count(ARROW.id)?ARROW:null;
    if (!ammo) return 'Out of arrows.';
    if (!camera) return 'No view available.';
    const x=p.x,y=p.y+p.height/2,angle=Math.atan2(wy-y,wx-x),dx=Math.cos(angle),dy=Math.sin(angle);
    const limit=screenRange(x,y,dx,dy,camera);
    if (!limit) return 'Aim within the screen.';
    let reach=limit;
    for(let d=4;d<limit;d+=4) if(solidAt(game.world,Math.floor((x+dx*d)/TILE),Math.floor((y+dy*d)/TILE))) {reach=d;break;}
    game.inventory.spend(ammo.id,1);
    game.bowDraw=null;
    p.facing=dx<0?-1:1;p.beamTime=.32;
    p.horizonBeam={x,y,endX:x+dx*reach,endY:y+dy*reach};
    const targets=[];
    for(const mob of game.world.mobs) {
      if(mob.health<=0||mob.respawn>0)continue;
      const spec=mobSpec(mob);if(!spec)continue;
      let best=Infinity;
      for(const seg of mob.segments?.length?mob.segments:[{x:mob.x,y:mob.y+spec.centerY,radius:spec.radius}]) {
        const vx=seg.x-x,vy=seg.y-y,d=vx*dx+vy*dy;
        if(d>=0&&d<=reach&&Math.abs(vx*dy-vy*dx)<=12+seg.radius&&seg.x>=camera.x&&seg.x<=camera.x+camera.width&&seg.y>=camera.y&&seg.y<=camera.y+camera.height) {
          // Verify the individual target is not on the other side of a wall.
          let clear=true;
          for(let t=4;t<d;t+=4) if(solidAt(game.world,Math.floor((x+vx*t/d)/TILE),Math.floor((y+vy*t/d)/TILE))) {clear=false;break;}
          if(clear)best=Math.min(best,d);
        }
      }
      if(Number.isFinite(best))targets.push({mob,distance:best});
    }
    for(const {mob,distance} of targets.sort((a,b)=>a.distance-b.distance)) {
      strikeMob(game,mob,skillAttackDamage(p,ammo.damage*(2+4*distance/limit)*(item.perfectWeapon?1.15:1),true),angle,140,true);
      if(ammo.poisonDuration&&mob.health>0){mob.poison=Math.max(mob.poison||0,ammo.poisonDuration);mob.poisonTick??=1;}
    }
    const cooldown=BOW.cooldown/(1+(p.skillBonuses?.bowCooldown||0));
    game.attack={kind:BOW.id,angle,timer:cooldown,duration:cooldown};
  } else if(id==='counter') {
    if(!weapon||weapon.id===BOW.id)return 'Select a melee weapon first.';
    p.counterTime=3;p.counterWeapon=game.inventory.hotbar[slot].id;p.counterSlot=slot;
    p.counterSequence=p.damageSequence||0;p.counterHealth=p.health;
    game.attack=game.bowDraw=null;
  } else {
    if(p.markArmed)return 'Your next hit is already armed.';
    p.markArmed=1;
  }
  p.wardenCooldowns[id]=skill.cooldown;game.dirty=true;return null;
}

export function stepWayfarer(game,input,dt) {
  const p=game.player;
  if(game.bowDraw) {
    const d=game.bowDraw;
    if(playerImmobilized(p)||wardenAttackBlocked(p)||p.flightOrigin||game.inventory.hotbar[d.slot]?.id!==d.id)game.bowDraw=null;
    else {d.elapsed=Math.min(BOW.drawTime+(p.skillBonuses?.extraDraw?1:0),d.elapsed+dt);d.extra=Boolean(p.skillBonuses?.extraDraw&&d.elapsed>=BOW.drawTime+1-1e-6);}
  }
  if(p.heatHits?.length){p.heatHits=p.heatHits.filter(h=>game.elapsed-h.time<5);p.heatBonus=Math.min(.30,p.heatHits.reduce((s,h)=>s+h.damage,0)*.01);}
  for(const timer of ['beamTime','counterFlash','catchFlash'])if(p[timer]>0)p[timer]=Math.max(0,p[timer]-dt);
  if(p.counterTime>0&&(!p.skillBonuses?.counter||game.inventory.hotbar[p.counterSlot]?.id!==p.counterWeapon||(input.selectedSlot!==undefined&&input.selectedSlot!==p.counterSlot)))p.counterTime=0;
  p.catching=Boolean(p.skillBonuses?.catchAlly&&input.down&&p.grounded&&!p.flightOrigin&&!playerInWater(game.world,p)&&!playerImmobilized(p));
}

export function finishWayfarer(game,dt=0) {
  const p=game.player;
  if(!(p.counterTime>0))return;
  if(((p.damageSequence||0)<=p.counterSequence&&p.health>=p.counterHealth)||p.health<=0){p.counterTime=Math.max(0,p.counterTime-dt);return;}
  p.counterTime=0;p.counterFlash=.45;
  const item=ITEMS[p.counterWeapon];if(!item?.weapon)return;
  const damage=skillAttackDamage(p,item.weapon.damage*3*(item.perfectWeapon?1.15:1),false);
  for(const mob of [...game.world.mobs]) {
    if(mob.health<=0||mob.respawn>0)continue;
    const spec=mobSpec(mob);if(!spec)continue;
    if(Math.hypot(mob.x-p.x,mob.y+spec.centerY-p.y-p.height/2)<=4*TILE+spec.radius)strikeMob(game,mob,damage,Math.atan2(mob.y-p.y,mob.x-p.x),220);
  }
  game.effects.push({x:p.x,y:p.y+8,color:'#e5bb85',count:16,spread:100,message:'Counterstrike!'});
}
export function catchFallMultiplier(game) {
  const p=game.player;
  for(const ally of game.wayfarerPeers??[])if(ally.catching&&ally.grounded&&Math.abs(ally.x-p.x)<=2*TILE&&Math.abs(ally.y+ally.height-p.y-p.height)<=TILE) {
    p.catchFlash=.6;game.effects.push({x:p.x,y:p.y+8,color:'#b4dda1',count:12,spread:40,message:'Caught by an ally!'});return .3;
  }
  return 1;
}

