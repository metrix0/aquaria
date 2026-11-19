import { overlapsMob, toolHitbox } from '../melee.js';
import { hurtPlayer, makeCaveEnemySpec, stepCaveEnemyBase } from './cave-shared.js';

const SPEAR_THRUST_DURATION = 0.4;

export const cannibalSpearSpec = {
  ...makeCaveEnemySpec('cannibal-spear', 'spear cannibal', 12, 23, 78, 16, 28),
  color: '#d95c48',
};

export const cannibalBowSpec = {
  ...makeCaveEnemySpec('cannibal-bow', 'bow cannibal', 12, 23, 46, 14, 155),
  color: '#c8503c',
};

export function spearCannibalThrust(phase) {
  if (phase < 0.28) return -Math.round((phase / 0.28) * 3);
  if (phase <= 0.65) return Math.round(-3 + ((phase - 0.28) / 0.37) * 12);
  return Math.round(9 * (1 - (phase - 0.65) / 0.35));
}

export function stepCannibalSpear(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, cannibalSpearSpec, dt, effects, {
    sightRange: 230,
    leashRange: 280,
    chaseDistance: 16,
    jumpSpeed: 210,
    hopSpeed: 155,
    battleHop: true,
    stepActive({ active }) {
      if (mob.spearThrust == null) return undefined;
      mob.spearThrust += dt;
      const phase = Math.min(1, mob.spearThrust / SPEAR_THRUST_DURATION);
      const thrust = spearCannibalThrust(phase);
      if (active && !mob.spearHit && phase >= 0.28 && phase <= 0.65) {
        const hitbox = toolHitbox(Math.round(mob.x) + mob.facing * 2, Math.round(mob.y) - 12, mob.facing, 0, [4 + thrust, -3, 18, 6]);
        if (overlapsMob(hitbox, player, { width: player.width, height: player.height, centerY: player.height / 2 })) {
          mob.spearHit = true;
          hurtPlayer(player, cannibalSpearSpec.damage, mob.facing, 'Struck by a spear cannibal!', '#d95c48', effects);
        }
      }
      if (mob.spearThrust >= SPEAR_THRUST_DURATION) {
        mob.spearThrust = null;
        mob.spearHit = false;
      }
      return phase >= 0.28 && phase <= 0.5 ? mob.facing * 24 : 0;
    },
    startAttack() {
      mob.spearThrust = 0;
      mob.spearHit = false;
      mob.attackTimer = 1.1;
    },
  });
}

export function stepCannibalBow(world, player, mob, dt, effects) {
  stepCaveEnemyBase(world, player, mob, cannibalBowSpec, dt, effects, {
    sightRange: 220,
    leashRange: 200,
    chaseDistance: 95,
    jumpSpeed: 205,
    windupDuration: 0.55,
    attackCooldown: 1.65,
    onWindupComplete({ active, distance, deltaX, deltaY }) {
      if (active && distance <= cannibalBowSpec.reach) {
        const len = distance || 1;
        world.projectiles.push({
          kind: 'cave-arrow',
          x: mob.x + mob.facing * 6,
          y: mob.y + cannibalBowSpec.centerY,
          dx: (deltaX / len) * 210,
          dy: (deltaY / len) * 210,
          life: 1.3,
          damage: cannibalBowSpec.damage,
          message: 'Hit by a cannibal arrow!',
          color: '#d95c48',
        });
      }
    },
  });
}
