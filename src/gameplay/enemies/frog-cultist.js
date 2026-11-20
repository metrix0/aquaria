import { overlapsMob, toolHitbox } from '../melee.js';
import { JUNGLE_CAVE } from '../../world/jungle-cave.js';
import { TILE, WEST_EXTENSION } from '../../world/generation.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const FROG_PROXIMITY_RANGE = 112;
export const CLAW_SLASH_DURATION = 0.22;
const FROG_ATTACK_COOLDOWN = 0.58;
const FROG_LEAP_SPEED = 142;
const FROG_LEAP_DY = 182;
const CLAW_DAMAGE = 16;

export const frogCultistSpec = {
  ...makeCaveEnemySpec('frog', 'frog cultist', 16, 26, 68, CLAW_DAMAGE, 34),
  color: '#6e9a54',
};

export function idolFacing(x) {
  const idolX = (JUNGLE_CAVE.idolColumn + WEST_EXTENSION + 0.5) * TILE;
  return x <= idolX ? 1 : -1;
}

export function aggroJungleCult(world) {
  if (!world) return;
  world.jungleCultAggro = true;
  for (const mob of world.mobs ?? []) {
    if (mob.kind !== 'frog' || mob.dayKind || mob.health <= 0 || mob.respawn > 0) continue;
    mob.cultAggro = true;
    mob.praying = false;
    mob.attackTimer = Math.min(mob.attackTimer ?? 0, 0.18);
  }
}

export function stepFrogCultist(world, player, mob, dt, effects) {
  const transformedCannibal = Boolean(mob.dayKind);
  if (mob.praying == null) {
    mob.praying = !transformedCannibal && !world.jungleCultAggro;
    mob.cultAggro = transformedCannibal || Boolean(world.jungleCultAggro);
    mob.facing = transformedCannibal ? (mob.facing ?? 1) : idolFacing(mob.x);
    mob.clawSlash = null;
    mob.clawHit = false;
    mob.leapCooldown = 0;
  }

  mob.leapCooldown = Math.max(0, (mob.leapCooldown ?? 0) - dt);
  if (!transformedCannibal) {
    const playerCenterY = player.y + player.height / 2;
    const distToPlayer = Math.hypot(player.x - mob.x, playerCenterY - (mob.y + frogCultistSpec.centerY));

    if (!world.jungleCultAggro && (
      mob.hurt > 0 ||
      mob.health < frogCultistSpec.maxHealth ||
      (!player.flightOrigin && distToPlayer <= FROG_PROXIMITY_RANGE &&
        clearPath(world, mob.x, mob.y + frogCultistSpec.centerY, player.x, playerCenterY))
    )) {
      aggroJungleCult(world);
    }
    if (world.jungleCultAggro) {
      mob.cultAggro = true;
      mob.praying = false;
    }
  } else {
    mob.cultAggro = true;
    mob.praying = false;
  }
  if (mob.flee > 0) {
    mob.clawSlash = null;
    mob.clawHit = false;
    mob.leapCooldown = 0;
  }

  if (!mob.cultAggro) {
    mob.facing = idolFacing(mob.x);
    mob.dx = 0;
    mob.windup = 0;
    mob.dash = 0;
    mob.clawSlash = null;
    stepCaveEnemyBase(world, player, mob, frogCultistSpec, dt, effects, {
      sightRange: 0,
      leashRange: 0,
      stepActive: () => 0,
    });
    mob.facing = idolFacing(mob.x);
    return;
  }

  const leashRange = transformedCannibal ? 280 : 640;
  stepCaveEnemyBase(world, player, mob, frogCultistSpec, dt, effects, {
    sightRange: transformedCannibal ? 230 : 720,
    leashRange,
    chaseDistance: 16,
    jumpSpeed: 210,
    stepActive({ active, distance, deltaX }) {
      if (mob.clawSlash != null) {
        mob.clawSlash += dt;
        const phase = Math.min(1, mob.clawSlash / CLAW_SLASH_DURATION);
        if (active && !mob.clawHit && phase >= 0.22 && phase <= 0.78) {
          const reach = Math.round(-2 + phase * 18);
          const hitbox = toolHitbox(Math.round(mob.x) + mob.facing * 2, Math.round(mob.y) - 13, mob.facing, 0, [reach, -8, 22, 16]);
          if (overlapsMob(hitbox, player, { width: player.width, height: player.height, centerY: player.height / 2 })) {
            mob.clawHit = true;
            hurtPlayer(player, CLAW_DAMAGE, mob.facing, 'Slashed by a frog cultist!', '#7cb356', effects);
          }
        }
        if (mob.clawSlash >= CLAW_SLASH_DURATION) {
          mob.clawSlash = null;
          mob.clawHit = false;
        }
        return phase >= 0.18 && phase <= 0.56 ? mob.facing * 56 : 0;
      }

      if (!active || (distance <= frogCultistSpec.reach && mob.attackTimer === 0)) {
        return undefined;
      }

      mob.facing = deltaX >= 0 ? 1 : -1;
      if (!mob.grounded) {
        return distance > 14 ? mob.facing * FROG_LEAP_SPEED : 0;
      }
      if (distance > 32 && Math.abs(mob.x - mob.homeX) < leashRange) {
        if (mob.leapCooldown > 0) return 0;
        mob.dy = -FROG_LEAP_DY;
        mob.grounded = false;
        mob.leapCooldown = 0.24 + (mob.phase % 0.12);
        mob.jumpCooldown = 0.45;
        return mob.facing * FROG_LEAP_SPEED;
      }
      return undefined;
    },
    startAttack() {
      mob.clawSlash = 0;
      mob.clawHit = false;
      mob.attackTimer = FROG_ATTACK_COOLDOWN;
    },
  });
}
