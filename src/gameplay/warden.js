import { WOODEN_SHIELD } from '../inventory.js';
import { playerInWater, playerImmobilized, PLAYER_SIZE } from './player.js';
import { damageMob, mobSpec } from './mobs.js';
import { wakeMimic } from './enemies/mimic.js';
import { TILE } from '../world/generation.js';

export const WARDEN_SKILLS = [
  { id: 'shieldRush', name: 'Shield Rush', key: 'Q', timer: 'rushTime', cooldown: 18, duration: .65 },
  { id: 'rage', name: 'Rage', key: 'R', timer: 'rageTime', cooldown: 25, duration: 8 },
  { id: 'aegisAura', name: 'Aegis Aura', key: 'T', timer: 'aegisTime', cooldown: 25, duration: 8 },
];

export const wardenAttackBlocked = p => Boolean(p.bracing || p.rushTime > 0);

export function useWardenSkill(game, id) {
  const p = game.player;
  const skill = WARDEN_SKILLS.find(s => s.id === id);
  if (!skill || !p.skillBonuses?.[id]) return 'Skill not unlocked.';
  if (p.flightOrigin || playerImmobilized(p) || wardenAttackBlocked(p)) return 'Cannot cast right now.';
  p.wardenCooldowns ??= {};
  if (p.wardenCooldowns[id] > 0) return 'Skill is recharging.';
  if (id === 'shieldRush' && game.progress.offhand !== WOODEN_SHIELD.id) return 'Equip a shield in your off-hand.';
  p[skill.timer] = skill.duration;
  p.wardenCooldowns[id] = skill.cooldown;
  if (id === 'shieldRush') {
    p.rushFacing = p.facing;
    p.rushHits = new Set();
    p.hook = null;
    p.climb = null;
    game.attack = null;
  }
  if (id === 'aegisAura') p.aegisFacing = p.facing;
  game.dirty = true;
  return null;
}

export function behindAegis(player, protector) {
  const dx = (player.x - protector.x) * protector.aegisFacing;
  return protector.aegisTime > 0 && Math.abs(player.y - protector.y) <= 3 * TILE &&
    dx <= TILE && dx >= -8 * TILE;
}

export function updateWardenAllies(game, peers) {
  const p = game.player;
  const seen = game.wardenAllyHits ??= new Map();
  const active = new Set();
  p.allyAegis = false;
  for (const peer of peers ?? []) {
    active.add(peer.id);
    if (behindAegis(p, peer)) p.allyAegis = true;
    const previous = seen.get(peer.id);
    seen.set(peer.id, peer.damageSequence);
    if (previous === undefined || !(peer.damageSequence > previous) || !p.skillBonuses?.guardianCry ||
        (p.wardenCooldowns?.guardianCry ?? 0) > 0 || Math.hypot(peer.x - p.x, peer.y - p.y) > 8 * TILE) continue;
    p.wardenCooldowns ??= {};
    p.wardenCooldowns.guardianCry = 20;
    p.cryTime = .8;
    for (const mob of game.world.mobs) {
      if (mob.health <= 0 || mob.respawn > 0 || Math.hypot(mob.x - p.x, mob.y - p.y) > 12 * TILE ||
          mob.kind.startsWith('ambient-') || ['crab','kraken'].includes(mob.kind) || (mob.kind === 'fish' && !mob.enemyType)) continue;
      mob.wardenTaunt = 6;
      if (mob.kind === 'mimic') wakeMimic(game.world, mob, p, game.effects);
      mob.flee = 0;
      mob.aggroTimer = Math.max(mob.aggroTimer || 0, 6);
    }
    game.effects.push({ x: p.x, y: p.y + 8, color: '#e9cf9e', count: 16, spread: 90, message: 'Guardian Cry!' });
  }
  for (const id of seen.keys()) if (!active.has(id)) seen.delete(id);
}

export function stepWardenBefore(game, input, dt) {
  const p = game.player;
  if (p.wardenCooldowns) for (const key of Object.keys(p.wardenCooldowns))
    p.wardenCooldowns[key] = Math.max(0, p.wardenCooldowns[key] - dt);
  for (const timer of ['rageTime', 'aegisTime', 'cryTime'])
    if (p[timer] > 0) p[timer] = Math.max(0, p[timer] - dt);
  if (p.rushTime > 0 && (!p.skillBonuses?.shieldRush || game.progress.offhand !== WOODEN_SHIELD.id || playerImmobilized(p) || p.flightOrigin)) p.rushTime = 0;
  p.bracing = Boolean(p.skillBonuses?.brace && input.down && p.grounded &&
    p.height === PLAYER_SIZE.height && !p.climb && !p.hook && !p.rushTime &&
    !p.flightOrigin && !playerImmobilized(p) && !playerInWater(game.world, p));
  p.braceTime = p.bracing ? Math.min(1.5, (p.braceTime || 0) + dt + 1e-9) : 0;
  if (wardenAttackBlocked(p)) game.attack = null;
}

export function stepWardenAfter(game, oldX, dt) {
  const p = game.player;
  if (!(p.rushTime > 0)) return;
  for (const mob of [...game.world.mobs]) {
    if (mob.health <= 0 || mob.respawn > 0 || p.rushHits.has(mob)) continue;
    const spec = mobSpec(mob);
    if (!spec || Math.abs(mob.y + spec.centerY - p.y - p.height / 2) > 20 + spec.height / 2) continue;
    if (mob.x < Math.min(oldX, p.x) - 12 - spec.width / 2 ||
        mob.x > Math.max(oldX, p.x) + 12 + spec.width / 2) continue;
    if ((mob.x - oldX) * p.rushFacing < -spec.width / 2) continue;
    p.rushHits.add(mob);
    damageMob(game.world, mob, 0, p.rushFacing > 0 ? 0 : Math.PI, 190, game.effects);
  }
  // Retain invulnerability for this complete fixed step, including enemy updates.
}

export function finishWardenStep(player, dt) {
  if (player.rushTime > 0) {
    player.rushTime = Math.max(0, player.rushTime - dt);
    if (!player.rushTime) { player.rushHits = null; player.dx = 0; }
  }
}
