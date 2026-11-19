import { inWater, solidAt } from '../world.js';
import { TILE, WEST_EXTENSION } from '../world/generation.js';
import { isCaveRefuge } from '../world/island-cave.js';

import { playerWaterborne } from './player.js';
import { crabCollides, crabSpec, stepCrab } from './friends/crab.js';
import { fishCollides, fishSpec, stepFish } from './friends/fish.js';
import { updateEnemySpawns } from './enemies/enemy-fish.js';
import { jellyfishShockRadius, jellyfishSpec, stepJellyfish } from './enemies/jellyfish.js';
import { KRAKEN_DEATH_DURATION, krakenSpec, stepKraken, stepKrakenDeath } from './enemies/kraken.js';
import { sharkSpec, stepShark } from './enemies/shark.js';
import { squidSpec, stepInkBubble, stepSquid } from './enemies/squid.js';
import { stepWreckGhost, wreckGhostSpec } from './enemies/wreck-ghost.js';
import { caveSpiderSpec, stepCaveSpider } from './enemies/cave-spider.js';
import { skeletonArcherSpec, stepCaveArrow, stepSkeletonArcher } from './enemies/skeleton-archer.js';
import { skeletalMinerSpec, stepSkeletalMiner } from './enemies/skeletal-miner.js';
import { caveScorpionSpec, stepCaveScorpion, stepScorpionVenom } from './enemies/cave-scorpion.js';
import { hammerSkeletonSpec, stepHammerSkeleton } from './enemies/hammer-skeleton.js';

export { jellyfishShockRadius };

function atPeace(x, y) {
  const column = Math.floor(x / TILE) - WEST_EXTENSION;
  const row = Math.floor(y / TILE);
  return isCaveRefuge(column, row);
}

const seaEnemySteps = {
  jellyfish: { spec: jellyfishSpec, step: stepJellyfish },
  squid: { spec: squidSpec, step: stepSquid },
  shark: { spec: sharkSpec, step: stepShark },
  kraken: { spec: krakenSpec, step: stepKraken },
};

const caveEnemyModules = {
  spider: { spec: caveSpiderSpec, step: stepCaveSpider },
  archer: { spec: skeletonArcherSpec, step: stepSkeletonArcher },
  miner: { spec: skeletalMinerSpec, step: stepSkeletalMiner },
  scorpion: { spec: caveScorpionSpec, step: stepCaveScorpion },
  hammer: { spec: hammerSkeletonSpec, step: stepHammerSkeleton },
};

export const caveEnemySpecs = Object.fromEntries(
  Object.entries(caveEnemyModules).map(([kind, entry]) => [kind, entry.spec]),
);

const seaEnemySpecs = Object.fromEntries(
  Object.entries(seaEnemySteps).map(([kind, entry]) => [kind, entry.spec]),
);

const mobSpecs = {
  crab: crabSpec,
  fish: fishSpec,
  ...seaEnemySpecs,
  ...caveEnemySpecs,
  ghost: wreckGhostSpec,
};

function clearKrakenState(mob) {
  Object.assign(mob, {
    attackMode: 'idle',
    actionTime: 0,
    attackIndex: 0,
    attackHit: false,
    grabbing: false,
    tentacleReach: 0,
    tentacleTarget: null,
    sonarTime: 0,
    deathTime: 0,
    deathImploded: false,
  });
}

function removeKrakenMinions(world) {
  for (let i = world.mobs.length - 1; i >= 0; i--) {
    if (world.mobs[i].krakenMinion) world.mobs.splice(i, 1);
  }
}

export function stepCaveEnemy(world, player, mob, dt, effects) {
  caveEnemyModules[mob.kind]?.step(world, player, mob, dt, effects);
}

export function stepCaveHazard(world, player, hazard, dt, effects) {
  if (hazard.kind === 'cave-arrow') {
    return stepCaveArrow(world, player, hazard, dt, effects);
  }
  return stepScorpionVenom(world, player, hazard, dt, effects);
}

function stepProjectiles(world, player, dt, time, effects) {
  if (!world.projectiles) world.projectiles = [];

  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const projectile = world.projectiles[i];
    if (projectile.kind === 'cave-arrow' || projectile.kind === 'venom') {
      if (atPeace(player.x, player.y + 11) && Math.abs(projectile.x - player.x) < 350) {
        world.projectiles.splice(i, 1);
        continue;
      }
      if (!stepCaveHazard(world, player, projectile, dt, effects)) {
        world.projectiles.splice(i, 1);
      }
      continue;
    }
    if (!stepInkBubble(world, player, projectile, dt, time, effects)) {
      world.projectiles.splice(i, 1);
    }
  }
}

export function syncMobs(world, player) {
  for (const mob of world.mobs) {
    if (caveEnemySpecs[mob.kind] || mob.kind === 'ghost' || mob.kind === 'kraken') continue;
    if (mob.kind === 'crab') {
      while (mob.y > TILE && crabCollides(world, player, mob.x, mob.y)) mob.y -= TILE;
    } else if (fishCollides(world, player, mob.x, mob.y)) {
      for (let offset = 1; offset <= 4; offset++) {
        if (!fishCollides(world, player, mob.x, mob.y - offset * TILE)) {
          mob.y -= offset * TILE;
          break;
        }
        if (!fishCollides(world, player, mob.x, mob.y + offset * TILE)) {
          mob.y += offset * TILE;
          break;
        }
      }
    }
  }
}

export function stepMobs(world, player, dt, time, mining, night, enemies, effects) {
  updateEnemySpawns(enemies, world.mobs, player, night, dt, (x, y) =>
    fishCollides(world, player, x, y),
  );
  for (let i = world.mobs.length - 1; i >= 0; i--) {
    const mob = world.mobs[i];
    if (mob.krakenMinion) {
      mob.remainingLife -= dt;
      if (mob.remainingLife <= 0 || mob.health <= 0) world.mobs.splice(i, 1);
    }
  }
  enemies.hitCooldown = Math.max(0, enemies.hitCooldown - dt);
  const px = player.x;
  const py = player.y + 11;
  const playerInWater = playerWaterborne(world, player);
  const playerMoving = Math.hypot(player.dx, player.dy) > 14 || mining;
  let hit;

  for (const mob of [...world.mobs]) {
    mob.hurt = Math.max(0, (mob.hurt ?? 0) - dt);
    if (mob.kind === 'kraken' && (mob.deathTime ?? 0) > 0) {
      stepKrakenDeath(world, mob, dt, effects);
    }
    if (mob.respawn > 0) {
      mob.respawn = Math.max(0, mob.respawn - dt);
      if (mob.respawn === 0) {
        Object.assign(mob, {
          x: mob.homeX,
          y: mob.homeY,
          dx: 0,
          dy: 0,
          flee: 0,
          cooldown: 0,
          hurt: 0,
          rooted: 0,
          rootLift: 0,
          health: mob.maxHealth,
          grounded: mob.kind === 'crab',
          attackTimer: 1.4 + (mob.phase % 1.5),
          windup: 0,
          minerSwing: null,
          dash: 0,
          dashDx: 0,
          dashDy: 0,
          shock: 0,
          shockHit: false,
        });
        if (mob.kind === 'kraken') clearKrakenState(mob);
      }
      continue;
    }
    if (mob.rooted > 0 && mob.health > 0) {
      mob.rooted = Math.max(0, mob.rooted - dt);
      if (mob.rootLift > 0) {
        const spec = mobSpec(mob);
        const lift = Math.min(mob.rootLift, dt * 48);
        const ceiling = Math.floor((mob.y + spec.centerY - spec.height / 2 - lift) / TILE);
        const left = Math.floor((mob.x - spec.width / 2) / TILE);
        const right = Math.floor((mob.x + spec.width / 2 - .01) / TILE);
        let clear = true;
        for (let tx = left; tx <= right; tx++) {
          if (solidAt(world, tx, ceiling)) {
            clear = false;
            break;
          }
        }
        if (clear) mob.y -= lift;
        mob.rootLift = clear ? mob.rootLift - lift : 0;
      }
      mob.dx = 0;
      mob.dy = 0;
      continue;
    }
    if (mob.kind === 'ghost') {
      stepWreckGhost(world, player, mob, dt, time, effects);
      continue;
    }
    if (mob.health <= 0) continue;
    mob.flee = Math.max(0, mob.flee - dt);
    const diffX = mob.x - px;
    const diffY = (mob.kind === 'crab' ? mob.y - 4 : mob.y) - py;
    const dist = Math.hypot(diffX, diffY) || 1;

    if (caveEnemyModules[mob.kind]) {
      stepCaveEnemy(world, player, mob, dt, effects);
    } else if (mob.kind === 'fish') {
      const fishHit = stepFish(world, player, mob, dt, time, enemies, {
        dist,
        diffX,
        diffY,
        playerInWater,
        playerMoving,
      });
      if (fishHit) hit = fishHit;
    } else if (mob.kind === 'crab') {
      stepCrab(world, player, mob, dt, time, { dist, diffX, playerMoving }, inWater);
    } else if (mob.kind === 'kraken') {
      stepKraken(world, player, mob, dt, time, effects);
    } else if (seaEnemySteps[mob.kind]) {
      seaEnemySteps[mob.kind].step(world, player, mob, dt, time, effects, {
        px,
        py,
        dist,
        playerInWater,
      });
    }
  }
  stepProjectiles(world, player, dt, time, effects);
  return hit;
}

export function mobSpec(mob) {
  return mobSpecs[mob.kind];
}

export function damageMob(world, mob, damage, angle, knockback, effects) {
  const spec = mobSpecs[mob.kind];
  if (!spec || mob.health <= 0 || mob.respawn > 0) return null;
  const cy = mob.y + spec.centerY;
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  mob.health = Math.max(0, (mob.health ?? spec.maxHealth) - damage);
  mob.hurt = 0.32;

  if (mob.kind === 'kraken') {
    mob.facing = -1;
    mob.dx = 0;
    mob.dy = 0;
    mob.flee = 0;
  } else if (mob.kind === 'crab') {
    mob.facing = dir;
    mob.dx = dir * (knockback ?? 95);
    mob.dy = -65;
    mob.grounded = false;
    mob.flee = 1.8;
  } else if (mob.kind === 'fish') {
    mob.facing = dir;
    const force = knockback ?? 115;
    mob.dx = Math.cos(angle) * force;
    mob.dy = Math.sin(angle) * (force * 0.74);
    mob.flee = 1.8;
  } else {
    const force = knockback ?? (mob.kind === 'shark' ? 85 : 115);
    mob.dx = Math.cos(angle) * force;
    mob.dy = Math.sin(angle) * (force * 0.75);
    mob.flee = mob.kind === 'shark' ? 0.65 : 1.6;
    mob.cooldown = Math.max(mob.cooldown ?? 0, 0.9);
  }

  const label = mob.enemyType ? mob.enemyType.name.toLowerCase() : spec.name;
  let effect;
  if (mob.health <= 0) {
    if (mob.enemyType || mob.krakenMinion) {
      const index = world.mobs.indexOf(mob);
      if (index !== -1) world.mobs.splice(index, 1);
    } else if (mob.kind !== 'ghost' || mob.resident) {
      mob.respawn = mob.respawnDelay ?? 45;
    }
    if (mob.kind === 'kraken') {
      clearKrakenState(mob);
      mob.windup = 0;
      mob.deathTime = KRAKEN_DEATH_DURATION;
      mob.deathImploded = false;
      removeKrakenMinions(world);
    }
    effect = {
      x: mob.x,
      y: cy,
      material: spec.material,
      color: spec.color,
      count: 14,
      spread: 72,
      message: 'Defeated ' + label + '!',
    };
  } else {
    effect = {
      x: mob.x,
      y: cy,
      material: spec.material,
      color: spec.color,
      count: mob.kind === 'squid' ? 12 : 7,
      spread: 58,
      message: 'Hit ' + label + ' (' + mob.health + '/' + mob.maxHealth + ' HP)',
    };
  }
  effects?.push(effect);
  return effect;
}

export function targetMobAt({ world, player }, wx, wy) {
  let best = null;
  let bestDist = Infinity;
  for (const mob of world.mobs) {
    if (mob.health <= 0 || mob.respawn > 0) continue;
    const spec = mobSpecs[mob.kind];
    if (!spec) continue;
    const cy = mob.y + spec.centerY;
    const pointerDist = Math.hypot(wx - mob.x, wy - cy);
    const playerDist = Math.hypot(mob.x - player.x, cy - (player.y + 11));
    const maxRange = mob.kind === 'kraken' ? 8 * TILE : 5 * TILE;
    if (pointerDist <= spec.radius + 12 && playerDist <= maxRange && pointerDist < bestDist) {
      best = mob;
      bestDist = pointerDist;
    }
  }
  return best;
}

export function resetHostiles(world) {
  if (world.projectiles) world.projectiles.length = 0;
  removeKrakenMinions(world);
  for (const mob of world.mobs) {
    if ((seaEnemySpecs[mob.kind] || caveEnemySpecs[mob.kind]) && !(mob.respawn > 0)) {
      Object.assign(mob, {
        x: mob.homeX,
        y: mob.homeY,
        dx: 0,
        dy: 0,
        flee: 0,
        cooldown: 0,
        rooted: 0,
        rootLift: 0,
        health: mob.maxHealth,
        attackTimer: 1.4 + (mob.phase % 1.5),
        windup: 0,
        minerSwing: null,
        dash: 0,
        dashDx: 0,
        dashDy: 0,
        shock: 0,
        shockHit: false,
      });
      if (mob.kind === 'kraken') clearKrakenState(mob);
    }
  }
}
