import { TILE, clamp } from '../world/generation.js';
import { solidAt } from '../world.js';
import { damageMob, mobSpec } from './mobs.js';
import { playerImmobilized } from './player.js';
import { screenRange } from './wayfarer.js';
import { skillAttackDamage } from './class-effects.js';

export const SCHOLAR_SKILLS = [
  { id: 'hyperBeam', timer: 'hyperBeamTime', cooldown: 0 },
  { id: 'beastFlask', timer: 'beastTime', cooldown: 40 },
  { id: 'feast', timer: 'feastSelecting', cooldown: 30 },
];
export const FEAST_RADIUS = 6 * TILE;
export const FEAST_DURATION = 12;
export const FEAST_FOODS = ['spinach', 'garlic', 'carrot'];
import { beneficial, harmful } from './effect-potency.js';
export { beneficial, harmful } from './effect-potency.js';
export const tomeEffect = (p, amount) => amount * (1 + (p.skillBonuses?.tomePower || 0));
export function spendTomeCooldown(p, cooldown, normalRemaining = 0) {
  if (!Number.isFinite(cooldown) || cooldown < 0) return { allowed: false, cooldown: normalRemaining };
  if (p.skillBonuses?.manaCapacity && (p.mana || 0) >= cooldown) {
    p.mana -= cooldown;
    return { allowed: true, cooldown: normalRemaining, manaSpent: cooldown };
  }
  return normalRemaining > 0 ? { allowed: false, cooldown: normalRemaining } : { allowed: true, cooldown, manaSpent: 0 };
}
export function foodYield(player, id, count, random = Math.random) {
  return (id === 'kelp' || id === 'raw-fish' || id === 'raw-crab') && player.skillBonuses?.foodDouble && random() < player.skillBonuses.foodDouble ? count * 2 : count;
}
export function cleansePlayer(p) {
  for (const key of ['bleed','bleedTick','neurotoxin','poison','poisonTick','blindness','stun','confused']) p[key] = 0;
  p.confusedStyle = null;
  p.inkSplats = [];
}
export function applyFeast(p, food) {
  if (p.downed) return;
  if (food === 'garlic') cleansePlayer(p);
  if (food === 'spinach' || food === 'carrot') {
    const key = food + 'Time';
    p[key] = Math.max(p[key] || 0, beneficial(p, FEAST_DURATION));
  }
}
export function feastChoice(p) {
  return FEAST_FOODS[Math.floor((p.feastCycle || 0) / .45) % FEAST_FOODS.length];
}
export function useScholarSkill(game, id, wx, wy, camera) {
  const p = game.player;
  if (!p.skillBonuses?.[id]) return 'Skill not unlocked.';
  if (p.flightOrigin || playerImmobilized(p)) return 'Cannot cast right now.';
  p.wardenCooldowns ??= {};
  if (p.wardenCooldowns[id] > 0) return 'Skill is recharging.';
  if (id === 'hyperBeam') {
    const mana = p.mana || 0;
    if (mana < 5 || !camera) return 'Need at least 5 mana.';
    const x = p.x, y = p.y + p.height / 2;
    const angle = Math.atan2(wy - y, wx - x), dx = Math.cos(angle), dy = Math.sin(angle);
    let reach = screenRange(x,y,dx,dy,camera);
    if (!reach) return 'Aim within the screen.';
    for (let d = 4; d < reach; d += 4) if (solidAt(game.world, Math.floor((x+dx*d)/TILE),Math.floor((y+dy*d)/TILE))) { reach = d; break; }
    p.mana = 0; p.hyperBeamTime = .65; p.facing = dx < 0 ? -1 : 1;
    p.hyperBeam = { x, y, endX: x+dx*reach, endY: y+dy*reach };
    for (const mob of [...game.world.mobs]) {
      if (mob.health <= 0 || mob.respawn > 0) continue;
      const spec = mobSpec(mob); if (!spec) continue;
      const segments = mob.segments?.length ? mob.segments : [{x:mob.x,y:mob.y+spec.centerY,radius:spec.radius || 6}];
      if (segments.some(seg => {
        const vx=seg.x-x,vy=seg.y-y,d=vx*dx+vy*dy;
        if (d<0 || d>reach || Math.abs(vx*dy-vy*dx)>12+seg.radius) return false;
        for(let t=4;t<d;t+=4) if(solidAt(game.world,Math.floor((x+vx*t/d)/TILE),Math.floor((y+vy*t/d)/TILE))) return false;
        return true;
      })) damageMob(game.world,mob,skillAttackDamage(p,tomeEffect(p,mana*1.5),false,false),angle,150,game.effects,{attacker:p});
    }
  } else if (id === 'beastFlask') {
    p.beastTime = beneficial(p,10); p.wardenCooldowns[id] = 40;
  } else if (id === 'feast') {
    if (!p.feastSelecting) { p.feastSelecting = 1; p.feastCycle = 0; return null; }
    const food = feastChoice(p);
    p.feastSelecting = 0;
    p.wardenCooldowns[id] = 30;
    applyFeast(p,food);
    p.feastPulse = { id: globalThis.crypto.randomUUID(), food, x:p.x, y:p.y+p.height/2, remaining:1.5 };
    game.effects.push({ x:p.x,y:p.y+8,color:'#b4dda1',count:14,spread:65,message:food[0].toUpperCase()+food.slice(1)+'!' });
  } else return 'Unknown skill.';
  game.dirty = true;
  return null;
}
export function confuseOnHit(game,mob) {
  const p=game.player;
  if (!p.skillBonuses?.confusingTouch || (p.wardenCooldowns?.confusingTouch || 0)>0 || mob.health<=0 || ['kraken','crab','fish'].includes(mob.kind) || mob.kind.startsWith('ambient-')) return false;
  p.wardenCooldowns ??= {}; p.wardenCooldowns.confusingTouch=12;
  mob.scholarConfused=5; mob.scholarAttack=0;
  game.effects.push({x:mob.x,y:mob.y,color:'#9ae17d',count:8,spread:30});
  return true;
}
export function stepScholar(game,dt) {
  const p=game.player, cap=p.skillBonuses?.manaCapacity || 0;
  if (cap) { const old=p.mana; p.mana=clamp((p.mana ?? cap)+dt*.1,0,cap); if(old!==p.mana) game.dirty=true; }
  for (const key of ['beastTime','hyperBeamTime','spinachTime','carrotTime']) p[key]=Math.max(0,(p[key]||0)-dt);
  if (p.feastSelecting) { p.feastCycle=(p.feastCycle||0)+dt; if(p.feastCycle>12 || playerImmobilized(p)) p.feastSelecting=0; }
  if(p.feastPulse) { p.feastPulse.remaining-=dt; if(p.feastPulse.remaining<=0) p.feastPulse=null; }
  game.receivedFeasts ??= new Set();
  for(const peer of game.wayfarerPeers ?? []) {
    const pulse=peer.feastPulse;
    if(!pulse || game.receivedFeasts.has(pulse.id)) continue;
    game.receivedFeasts.add(pulse.id);
    if(game.receivedFeasts.size>256) game.receivedFeasts.delete(game.receivedFeasts.values().next().value);
    if(Math.hypot(p.x-pulse.x,p.y+p.height/2-pulse.y)<=FEAST_RADIUS) applyFeast(p,pulse.food);
  }
}
