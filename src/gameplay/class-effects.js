// Mechanics shared by the three starter classes. The class definitions own the
// numbers; these hooks keep combat and consumable behavior in the simulation.
import { MAX_HEALTH } from './player.js';
import { damageMob } from './mobs.js';

export function skillAttackDamage(player, base, bow = false) {
  const bonus = player.skillBonuses || {};
  return base + Math.round(base * (bonus.missingHealthAttack || 0) * (1 - Math.max(0, player.health) / MAX_HEALTH)) + (bonus.attack || 0) + (bow ? bonus.bowDamage || 0 : 0)
    + (player.health <= MAX_HEALTH * .4 ? bonus.lowHealthAttack || 0 : 0)
    + ((player.catalystSeconds || 0) > 0 ? bonus.catalystAttack || 0 : 0);
}

export function classHit(game, mob, damageDealt, bow = false) {
  if (damageDealt <= 0) return;
  const bonus = game.player.skillBonuses || {};
  const lifesteal = (bonus.lifesteal || 0) + (bonus.rage && game.player.rageTime > 0 ? .30 : 0);
  if (lifesteal && game.player.health > 0) {
    game.player.health = Math.min(MAX_HEALTH, game.player.health + damageDealt * lifesteal);
  }
  if (bow && bonus.snare && mob.health > 0 && mob.kind !== 'kraken') {
    mob.rooted = Math.max(mob.rooted || 0, bonus.snare);
    mob.rootLift = 0;
  }
  if (bonus.poison && mob.health > 0 && mob.kind !== 'kraken') {
    mob.skillVenom = {
      remaining: 3 + (bonus.poisonDuration || 0),
      accumulated: 0,
      damage: bonus.poison,
    };
  }
  game.dirty = true;
}

// Shared by both melee and projectile hits, so the damage source never matters.
export function strikeMob(game, mob, damage, angle, knockback, bow = false) {
  if (mob.health <= 0 || mob.respawn > 0) return;
  const before = mob.health;
  damageMob(game.world, mob, damage, angle, knockback, game.effects,
    { melee: !bow, attacker: game.player });
  classHit(game, mob, Math.max(0, before - mob.health), bow);
}

export function stepClassEffects(game, dt) {
  const player = game.player;
  player.catalystSeconds = Math.max(0, (player.catalystSeconds || 0) - dt);
  player.wardCooldown = Math.max(0, (player.wardCooldown || 0) - dt);
  const maxWard = player.skillBonuses?.ward || 0;
  if (maxWard && player.wardCooldown <= 0) {
    player.wardShield = Math.min(maxWard, (player.wardShield || 0) + 4 * dt);
  }
  for (const mob of [...game.world.mobs]) {
    const venom = mob.skillVenom;
    if (!venom) continue;
    if (mob.health <= 0 || mob.respawn > 0) {
      mob.skillVenom = null;
      continue;
    }
    const time = Math.min(dt, venom.remaining);
    venom.remaining -= dt;
    venom.accumulated += time;
    if (venom.accumulated >= 1) {
      const ticks = Math.floor(venom.accumulated);
      venom.accumulated -= ticks;
      damageMob(game.world, mob, venom.damage * ticks, 0, 0, game.effects, { poisonTick: true });
      game.effects.push({ x: mob.x, y: mob.y, color: '#b3dc71', count: 3, spread: 20 });
      game.dirty = true;
    }
    if (venom.remaining <= 0 || mob.health <= 0) mob.skillVenom = null;
  }
}

export function activateWard(player, fill = false) {
  const capacity = player.skillBonuses?.ward || 0;
  player.wardShield = fill ? capacity : Math.min(capacity, player.wardShield || 0);
  player.wardCooldown = fill ? 0 : player.wardCooldown || 0;
}
