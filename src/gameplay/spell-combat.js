import { TILE } from '../world/generation.js';
import { solidAt, worldCols, worldRows } from '../world.js';
import { damageMob, mobSpec } from './mobs.js';
import { MAX_HEALTH } from './player.js';
import { beneficial } from './effect-potency.js';
import { SPELLS } from '../spells.js';

export function spellLineClear(world,x,y,tx,ty) {
  const d=Math.hypot(tx-x,ty-y);
  for(let i=4;i<d;i+=4) if(solidAt(world,Math.floor((x+(tx-x)*i/d)/TILE),Math.floor((y+(ty-y)*i/d)/TILE))) return false;
  return true;
}
function candidates(game,x,y,radius,excluded=new Set()) {
  const result=[];
  for(const mob of game.world.mobs) {
    if(excluded.has(mob)||mob.health<=0||mob.respawn>0) continue;
    const spec=mobSpec(mob);if(!spec) continue;
    const points=mob.segments?.length?mob.segments:[{x:mob.x,y:mob.y+spec.centerY,radius:spec.radius*(mob.inflateScale??1)}];
    const near=points.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)}))
      .filter(p=>p.d<=radius+(p.radius??0)&&spellLineClear(game.world,x,y,p.x,p.y)).sort((a,b)=>a.d-b.d)[0];
    if(near) result.push({mob,...near});
  }
  return result.sort((a,b)=>a.d-b.d);
}
export function spellVisual(game,kind,x,y,radius,color,endX,endY) {
  const duration={beam:.32, 'healing-stream':.8, mend:1.15, firebolt:.52, 'frost-lance':.72, 'storm-arc':.32, 'tidal-pulse':.55}[kind]??.52;
  game.projectiles.push({spellFx:kind,x,y,radius,color,endX,endY,life:duration,duration});
  return game.projectiles[game.projectiles.length-1];
}
function hit(game,mob,amount,x,y,force) {
  damageMob(game.world,mob,amount,Math.atan2(mob.y-y,mob.x-x),force,game.effects,{melee:false,attacker:game.player});
  game.dirty=true;
}
export function burstSpell(game,kind,x,y,damage,radius,direct=null,splash=damage) {
  const spell=SPELLS[kind],excluded=new Set(direct?[direct]:[]);
  for(const entry of candidates(game,x,y,radius,excluded)) {
    const falloff=Math.max(.45,1-Math.max(0,entry.d-(entry.radius??0))/radius*.55);
    hit(game,entry.mob,Math.max(1,Math.round(splash*falloff)),x,y,kind==='tidal-pulse'?210:130);
  }
  const fx=spellVisual(game,kind,x,y,radius,spell.color);
  if(kind==='tidal-pulse'){
    // Match the radial line-of-sight used for damage, including terrain.
    fx.reach=Array.from({length:64},(_,i)=>{
      const a=i*Math.PI*2/64,dx=Math.cos(a),dy=Math.sin(a);
      for(let d=4;d<=radius;d+=4){
        if(solidAt(game.world,Math.floor((x+dx*d)/TILE),Math.floor((y+dy*d)/TILE)))return d-4;
      }
      return radius;
    });
  }
  // The elemental renderer owns the burst; generic debris used to obscure it.
}
// Trace the aimed discharge to the first solid tile or enemy. All visible
// branches correspond to actual hits, never an unrelated weather effect.
export function castStormArc(game,wx,wy,damage) {
  const spell=SPELLS['storm-arc'], p=game.player, x=p.x, y=p.y+p.height/2;
  const angle=Math.atan2(wy-y,wx-x), dx=Math.cos(angle),dy=Math.sin(angle);
  p.facing=Math.sign(dx)||p.facing;
  const ox=x+dx*5, oy=y+dy*5;
  let ex=x,ey=y,target=null;
  const points=[];
  for(const mob of game.world.mobs){
    if(mob.health<=0||mob.respawn>0)continue;
    const spec=mobSpec(mob);if(!spec)continue;
    const parts=mob.segments?.length?mob.segments:[{x:mob.x,y:mob.y+spec.centerY,radius:spec.radius*(mob.inflateScale??1)}];
    for(const part of parts){
      const vx=part.x-x,vy=part.y-y,along=vx*dx+vy*dy,r=(part.radius??0)+4;
      if(along+r>=0&&along-r<=spell.range&&Math.abs(vx*dy-vy*dx)<=r)points.push({mob,part,r});
    }
  }
  for(let d=4;d<=spell.range;d+=4){
    const px=x+dx*d,py=y+dy*d,tx=Math.floor(px/TILE),ty=Math.floor(py/TILE);
    if(tx<0||ty<0||tx>=worldCols(game.world)||ty>=worldRows(game.world)||solidAt(game.world,tx,ty))break;
    ex=px;ey=py;
    const contact=points.find(({part,r})=>Math.hypot(px-part.x,py-part.y)<=r);
    if(contact){target=contact.mob;break;}
  }
  if(Math.hypot(ex-x,ey-y)>5)spellVisual(game,'beam',ox,oy,0,spell.color,ex,ey);
  spellImpact(game,{x:ex,y:ey,spell:'storm-arc',damage,dx,dy,knockback:110},target);
}

export function spellImpact(game,projectile,mob=null) {
  const {x,y,spell:kind}=projectile,spell=SPELLS[kind];
  if(mob) {
    hit(game,mob,projectile.damage,x-projectile.dx*.02,y-projectile.dy*.02,projectile.knockback);
    if(projectile.root&&mob.health>0&&mob.kind!=='kraken') {
      mob.rooted=Math.max(mob.rooted||0,projectile.root);mob.rootLift=0;mob.frostRoot=true;
    }
  }
  if(kind==='firebolt') burstSpell(game,kind,x,y,projectile.damage,spell.radius,mob,projectile.splash);
  else if(kind==='storm-arc'&&mob) {
    let ox=x,oy=y;const hitMobs=new Set([mob]);
    for(let jump=1;jump<spell.chain;jump++) {
      const next=candidates(game,ox,oy,spell.radius,hitMobs)[0];if(!next) break;
      hitMobs.add(next.mob);
      spellVisual(game,'beam',ox,oy,0,spell.color,next.x,next.y);
      spellVisual(game,'storm-arc',next.x,next.y,10,spell.color);
      hit(game,next.mob,Math.max(1,Math.round(projectile.damage*.72**jump)),ox,oy,90);
      game.effects.push({x:next.x,y:next.y,color:spell.color,count:9,spread:75});
      ox=next.x;oy=next.y;
    }
    spellVisual(game,'storm-arc',x,y,12,spell.color);
  } else {
    spellVisual(game,kind,x,y,kind==='frost-lance'?18:8,spell.color);
    game.effects.push({x,y,color:spell.color,count:12,spread:75});
  }
}
export function mendTarget(game,wx,wy) {
  const p=game.player,y=p.y+p.height/2;
  const aimed=(game.wayfarerPeers??[]).filter(peer=>!peer.downed&&peer.id&&Number.isFinite(peer.health))
    .map(peer=>({peer,y:peer.y+peer.height/2,d:Math.hypot(peer.x-wx,peer.y+peer.height/2-wy)}))
    .filter(v=>v.d<=Math.max(14,v.peer.height/2+5)).sort((a,b)=>a.d-b.d)[0];
  if(!aimed) return {target:p,local:true};
  if(Math.hypot(aimed.peer.x-p.x,aimed.y-y)>SPELLS.mend.range||!spellLineClear(game.world,p.x,y,aimed.peer.x,aimed.y)) return {message:'Ally is out of reach.'};
  return {target:aimed.peer,local:false};
}
export function castMend(game,target,local,amount) {
  const p=game.player,y=p.y+p.height/2,ty=target.y+target.height/2;
  if(local) {
    p.health=Math.min(MAX_HEALTH,p.health+beneficial(p,amount));
    spellVisual(game,'mend',p.x,y,19,SPELLS.mend.color);
  } else {
    p.mendPulses??=[];
    p.mendPulses.push({id:globalThis.crypto.randomUUID(),target:target.id,amount,x:p.x,y,remaining:1.5});
    if(p.mendPulses.length>8) p.mendPulses.shift();
    spellVisual(game,'healing-stream',p.x,y,0,SPELLS.mend.color,target.x,ty);
    spellVisual(game,'mend',target.x,ty,19,SPELLS.mend.color);
  }
  game.effects.push({x:target.x,y:ty,color:SPELLS.mend.color,count:18,spread:55});
}
export function stepMendPulses(player,dt) {
  if(player.mendPulses) player.mendPulses=player.mendPulses.filter(pulse=>(pulse.remaining-=dt)>0);
}
export function receiveMends(game) {
  const p=game.player;if(!game.localPeerId||p.downed) return;
  game.receivedMends??=new Set();
  for(const peer of game.wayfarerPeers??[]) for(const pulse of peer.mendPulses??[]) {
    if(peer.downed||pulse.target!==game.localPeerId||pulse.remaining<=0||game.receivedMends.has(pulse.id)) continue;
    game.receivedMends.add(pulse.id);
    if(game.receivedMends.size>256) game.receivedMends.delete(game.receivedMends.values().next().value);
    const y=p.y+p.height/2;
    if(Math.hypot(p.x-pulse.x,y-pulse.y)>SPELLS.mend.range+16||!spellLineClear(game.world,pulse.x,pulse.y,p.x,y)||!Number.isFinite(pulse.amount)||pulse.amount<=0) continue;
    p.health=Math.min(MAX_HEALTH,p.health+beneficial(p,Math.min(SPELLS.mend.heal*1.2,pulse.amount)));
    spellVisual(game,'healing-stream',pulse.x,pulse.y,0,SPELLS.mend.color,p.x,y);
    spellVisual(game,'mend',p.x,y,19,SPELLS.mend.color);
    game.effects.push({x:p.x,y,color:SPELLS.mend.color,count:18,spread:55});game.dirty=true;
  }
}
