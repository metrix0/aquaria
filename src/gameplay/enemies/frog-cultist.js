import { overlapsMob, toolHitbox } from '../melee.js';
import { JUNGLE_CAVE } from '../../world/jungle-cave.js';
import { TILE, WEST_EXTENSION } from '../../world/generation.js';
import { clearPath, hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

export const FROG_PROXIMITY_RANGE = 112;
export const CLAW_SLASH_DURATION = 0.22;
const BITE_WINDUP_DURATION = 0.18;
const BITE_DASH_DURATION = 0.18;
const BITE_DASH_SPEED = 225;
const FROG_ATTACK_COOLDOWN = 0.58;
const BITE_DAMAGE = 20;
const CLAW_DAMAGE = 16;

export const frogCultistSpec = {
  ...makeCaveEnemySpec('frog', 'frog cultist', 16, 26, 74, CLAW_DAMAGE, 82),
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
    if (mob.kind !== 'frog' || mob.health <= 0 || mob.respawn > 0) continue;
    mob.cultAggro = true;
    mob.praying = false;
    mob.attackTimer = Math.min(mob.attackTimer ?? 0, 0.18);
  }
}

export function stepFrogCultist(world, player, mob, dt, effects) {
  if (mob.praying == null) {
    mob.praying = !world.jungleCultAggro;
    mob.facing = idolFacing(mob.x);
    mob.attackMode = 'claw';
    mob.clawSlash = null;
    mob.clawHit = false;
    mob.biteHit = false;
  }

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
  if (mob.flee > 0) {
    mob.clawSlash = null;
    mob.clawHit = false;
    mob.biteHit = false;
  }
  if (world.jungleCultAggro) {
    mob.cultAggro = true;
    mob.praying = false;
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

  stepCaveEnemyBase(world, player, mob, frogCultistSpec, dt, effects, {
    sightRange: 720,
    leashRange: 640,
    chaseDistance: 16,
    windupDuration: 0.16,
    attackCooldown: FROG_ATTACK_COOLDOWN,
    stepActive({ active, distance, deltaX, deltaY }) {
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

      if (mob.dash > 0) {
        mob.dash = Math.max(0, mob.dash - dt);
        if (active && !mob.biteHit && Math.abs(deltaX) <= frogCultistSpec.radius + 9 && Math.abs(deltaY) < 18) {
          mob.biteHit = true;
          hurtPlayer(player, BITE_DAMAGE, mob.facing, 'Bitten by a frog cultist!', '#93c85e', effects);
        }
        if (mob.dash === 0) mob.biteHit = false;
        return mob.facing * BITE_DASH_SPEED;
      }

      if (mob.windup > 0 && active && distance > 38 && mob.attackMode === 'claw') {
        mob.attackMode = 'bite';
      }
      return undefined;
    },
    startAttack({ distance }) {
      if (distance > 34 || mob.attackMode === 'bite') {
        mob.attackMode = 'bite';
        mob.windup = BITE_WINDUP_DURATION;
        mob.biteHit = false;
      } else {
        mob.attackMode = 'claw';
        mob.clawSlash = 0;
        mob.clawHit = false;
        mob.attackTimer = FROG_ATTACK_COOLDOWN;
      }
    },
    onWindupComplete({ active }) {
      if (mob.attackMode === 'bite') {
        mob.dash = BITE_DASH_DURATION;
        mob.biteHit = false;
        mob.attackMode = 'claw';
        mob.attackTimer = FROG_ATTACK_COOLDOWN + 0.04;
      } else if (active) {
        mob.clawSlash = 0;
        mob.clawHit = false;
      }
    },
  });
}
