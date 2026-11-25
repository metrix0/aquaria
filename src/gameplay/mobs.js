import { RAW_CRAB, RAW_FISH } from '../content.js';
import { POISON_NEEDLE, STRING } from '../content.js';
import { inWater, solidAt } from '../world.js';
import { spawnCaveFaunaNear } from '../world/cave-ambience.js';
import { ambientMobSpecs, stepAmbientMob } from './ambient-fauna.js';
import { TILE, WEST_EXTENSION } from '../world/generation.js';
import { isCaveRefuge } from '../world/island-cave.js';

import { playerWaterborne, takeDamage } from './player.js';
import { crabCollides, crabSpec, stepCrab } from './friends/crab.js';
import { fishCollides, fishSpec, stepFish } from './friends/fish.js';
import { updateEnemySpawns } from './enemies/enemy-fish.js';
import { jellyfishShockRadius, jellyfishSpec, stepJellyfish } from './enemies/jellyfish.js';
import { KRAKEN_DEATH_DURATION, krakenSpec, stepKraken, stepKrakenDeath } from './enemies/kraken.js';
import { sharkSpec, stepShark } from './enemies/shark.js';
import { lionfishSpec, stepLionfish, stepLionfishSpine, stepNeurotoxinCloud } from './enemies/lionfish.js';
import { pufferfishSpec, stepPufferfish, triggerPufferfishWindup } from './enemies/pufferfish.js';
import { squidSpec, stepInkBubble, stepSquid } from './enemies/squid.js';
import { stepWreckGhost, wreckGhostSpec } from './enemies/wreck-ghost.js';
import { caveSpiderSpec, stepCaveSpider } from './enemies/cave-spider.js';
import { skeletonArcherSpec, stepCaveArrow, stepSkeletonArcher } from './enemies/skeleton-archer.js';
import { skeletalMinerSpec, stepSkeletalMiner } from './enemies/skeletal-miner.js';
import { caveScorpionSpec, stepCaveScorpion, stepScorpionVenom } from './enemies/cave-scorpion.js';
import { hammerSkeletonSpec, stepHammerSkeleton } from './enemies/hammer-skeleton.js';
import { mimicSpec, stepMimic, wakeMimic } from './enemies/mimic.js';
import { bloodBatSpec, stepBloodBat } from './enemies/blood-bat.js';
import { cannibalBowSpec, cannibalSpearSpec, stepCannibalBow, stepCannibalSpear } from './enemies/cannibal.js';
import { aggroJungleCult, frogCultistSpec, idolFacing, stepFrogCultist } from './enemies/frog-cultist.js';
import { jungleWormSpec, stepJungleWorm } from './enemies/jungle-worm.js';
import { nativeShamanSpec, stepNativeShaman, stepShamanSkull } from './enemies/jungle-shaman.js';
import { caveFrogSpec, stepCaveFrog } from './enemies/cave-frog.js';

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
  lionfish: { spec: lionfishSpec, step: stepLionfish },
  pufferfish: { spec: pufferfishSpec, step: stepPufferfish },
  kraken: { spec: krakenSpec, step: stepKraken },
};

const caveEnemyModules = {
  spider: { spec: caveSpiderSpec, step: stepCaveSpider },
  archer: { spec: skeletonArcherSpec, step: stepSkeletonArcher },
  miner: { spec: skeletalMinerSpec, step: stepSkeletalMiner },
  scorpion: { spec: caveScorpionSpec, step: stepCaveScorpion },
  hammer: { spec: hammerSkeletonSpec, step: stepHammerSkeleton },
  mimic: { spec: mimicSpec, step: stepMimic },
  'blood-bat': { spec: bloodBatSpec, step: stepBloodBat },
};

const jungleEnemyModules = {
  'cannibal-spear': { spec: cannibalSpearSpec, step: stepCannibalSpear },
  'cannibal-bow': { spec: cannibalBowSpec, step: stepCannibalBow },
  shaman: { spec: nativeShamanSpec, step: stepNativeShaman },
  'cave-frog': { spec: caveFrogSpec, step: stepCaveFrog },
  frog: { spec: frogCultistSpec, step: stepFrogCultist },
  worm: { spec: jungleWormSpec, step: stepJungleWorm },
};

export const caveEnemySpecs = Object.fromEntries(
  Object.entries(caveEnemyModules).map(([kind, entry]) => [kind, entry.spec]),
);

export const jungleEnemySpecs = Object.fromEntries(
  Object.entries(jungleEnemyModules).map(([kind, entry]) => [kind, entry.spec]),
);

const seaEnemySpecs = Object.fromEntries(
  Object.entries(seaEnemySteps).map(([kind, entry]) => [kind, entry.spec]),
);

const mobSpecs = {
  ...ambientMobSpecs,
  crab: crabSpec,
  fish: fishSpec,
  ...seaEnemySpecs,
  ...caveEnemySpecs,
  ...jungleEnemySpecs,
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
  if (hazard.kind === 'shaman-skull') {
    return stepShamanSkull(world, player, hazard, dt, effects);
  }
  return stepScorpionVenom(world, player, hazard, dt, effects);
}

function stepProjectiles(world, player, dt, time, effects) {
  if (!world.projectiles) world.projectiles = [];

  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const projectile = world.projectiles[i];
    if (projectile.kind === 'cave-arrow' || projectile.kind === 'venom' || projectile.kind === 'shaman-skull') {
      if (atPeace(player.x, player.y + 11) && Math.abs(projectile.x - player.x) < 350) {
        world.projectiles.splice(i, 1);
        continue;
      }
      if (!stepCaveHazard(world, player, projectile, dt, effects)) {
        world.projectiles.splice(i, 1);
      }
      continue;
    }
    if (projectile.kind === 'lionfish-spine') {
      if (!stepLionfishSpine(world, player, projectile, dt, effects)) {
        world.projectiles.splice(i, 1);
      }
      continue;
    }
    if (projectile.kind === 'neurotoxin-cloud') {
      if (!stepNeurotoxinCloud(world, player, projectile, dt)) {
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
    if (ambientMobSpecs[mob.kind] || caveEnemySpecs[mob.kind] || jungleEnemySpecs[mob.kind] || mob.kind === 'ghost' || mob.kind === 'kraken') continue;
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

function syncCannibalForms(world, night, effects) {
  for (const mob of world.mobs) {
    if (mob.kind === 'cannibal-spear' || mob.kind === 'cannibal-bow') {
      mob.dayKind ??= mob.kind;
    }
    if (!mob.dayKind) continue;
    const targetKind = night ? 'frog' : mob.dayKind;
    if (mob.kind === targetKind) continue;
    const nextSpec = mobSpecs[targetKind];
    if (!nextSpec) continue;
    const prevMax = mob.maxHealth || mobSpecs[mob.kind]?.maxHealth || nextSpec.maxHealth;
    const wasAlive = mob.health > 0 && !(mob.respawn > 0);
    mob.kind = targetKind;
    mob.maxHealth = nextSpec.maxHealth;
    mob.health = wasAlive ? Math.max(1, Math.round((mob.health / prevMax) * nextSpec.maxHealth)) : 0;
    mob.windup = 0;
    mob.spearThrust = null;
    mob.spearHit = false;
    mob.clawSlash = null;
    mob.clawHit = false;
    mob.leapCooldown = 0;
    mob.praying = false;
    mob.cultAggro = targetKind === 'frog';
    if (wasAlive) {
      effects?.push({
        x: mob.x,
        y: mob.y - 12,
        color: targetKind === 'frog' ? '#7cb356' : '#d95c48',
        count: 10,
        spread: 48,
      });
    }
  }
}

export function stepMobs(world, player, dt, time, mining, night, enemies, effects) {
  spawnCaveFaunaNear(world, player);
  syncCannibalForms(world, night, effects);
  updateEnemySpawns(enemies, world.mobs, player, night, dt, (x, y) =>
    atPeace(x, y) || fishCollides(world, player, x, y),
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
    if (mob.wardenTaunt > 0) { mob.wardenTaunt = Math.max(0, mob.wardenTaunt - dt); mob.flee = 0; }
    if (mob.kind === 'kraken' && (mob.deathTime ?? 0) > 0) {
      stepKrakenDeath(world, mob, dt, effects);
      if (mob.deathTime === 0) {
        world.mobs.splice(world.mobs.indexOf(mob), 1);
        continue;
      }
    }
    if (mob.respawn > 0) {
      mob.respawn = Math.max(0, mob.respawn - dt);
      if (mob.respawn === 0) {
        Object.assign(mob, {
          x: mob.homeX,
          y: mob.homeY,
          dx: 0,
          dy: 0,
          poison: 0,
          poisonTick: 0,
          flee: 0,
          cooldown: 0,
          hurt: 0,
          rooted: 0,
          rootLift: 0,
          health: mob.maxHealth,
          grounded: mob.kind === 'crab' || mob.kind === 'mimic',
          awakened: false,
          biteHit: false,
          attackTimer: 1.4 + (mob.phase % 1.5),
          windup: 0,
          minerSwing: null,
          spearThrust: null,
          spearHit: false,
          clawSlash: null,
          clawHit: false,
          tongue: null,
          biteTimer: 0,
          leapCooldown: 0,
          segments: null,
          praying: mob.kind === 'frog' && !mob.dayKind && !world.jungleCultAggro,
          cultAggro: mob.kind === 'frog' && (Boolean(mob.dayKind) || Boolean(world.jungleCultAggro)),
          facing: mob.kind === 'mimic' ? 1 : mob.kind === 'frog' && !mob.dayKind ? idolFacing(mob.homeX) : (mob.facing ?? 1),
          jumpCooldown: 0,
          airDx: 0,
          dash: 0,
          dashDx: 0,
          dashDy: 0,
          shock: 0,
          shockHit: false,
          burstCount: 0,
        });
        if (mob.kind === 'kraken') clearKrakenState(mob);
      }
      continue;
    }
    if ((mob.poison ?? 0) > 0 && mob.health > 0) {
      mob.poison = Math.max(0, mob.poison - dt);
      mob.poisonTick = (mob.poisonTick ?? 1) - dt;
      while (mob.poisonTick <= 0 && mob.poison > 0 && mob.health > 0) {
        mob.poisonTick += 1;
        damageMob(world, mob, 1, 0, 0, effects, { poisonTick: true });
      }
      if (mob.poison === 0) mob.poisonTick = 0;
      if (mob.health <= 0) continue;
    }
    if (mob.rooted > 0 && mob.health > 0) {
      mob.rooted = Math.max(0, mob.rooted - dt);
      if (mob.rootLift > 0) {
        const spec = mobSpec(mob);
        const lift = Math.min(mob.rootLift, dt * 56);
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

    if (ambientMobSpecs[mob.kind]) {
      if (Math.abs(mob.x - px) < 900 && Math.abs(mob.y - py) < 700) stepAmbientMob(world, mob, dt);
    } else if (caveEnemyModules[mob.kind]) {
      stepCaveEnemy(world, player, mob, dt, effects);
    } else if (jungleEnemyModules[mob.kind]) {
      jungleEnemyModules[mob.kind].step(world, player, mob, dt, effects);
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

export function damageMob(world, mob, damage, angle, knockback, effects, options = {}) {
  const spec = mobSpecs[mob.kind];
  if (!spec || mob.health <= 0 || mob.respawn > 0) return null;
  const cy = mob.y + spec.centerY;
  if (mob.kind === 'pufferfish' && mob.pufferState === 'inflated' && options.melee) {
    const attacker = options.attacker;
    if (attacker && !attacker.flightOrigin) {
      attacker.dx = -Math.cos(angle) * 145;
      attacker.dy = -Math.sin(angle) * 95 - 12;
      if ((attacker.hurt ?? 0) <= 0) {
        attacker.hurt = 0.45;
        const recoil = takeDamage(attacker, 2);
        effects?.push({
          x: mob.x,
          y: cy,
          color: '#f5e8ba',
          count: 6,
          spread: 54,
          message: 'Attack bounced off inflated pufferfish! −' + recoil + ' health',
        });
        return { killed: false, bounced: true };
      }
    }
    effects?.push({ x: mob.x, y: cy, color: '#f5e8ba', count: 6, spread: 54 });
    return { killed: false, bounced: true };
  }
  const dir = Math.cos(angle) >= 0 ? 1 : -1;
  mob.health = Math.max(0, (mob.health ?? spec.maxHealth) - damage);
  if (!options.poisonTick) {
    mob.hurt = 0.32;
  }

  if (options.poisonTick) {
    // Poison damage ticks without knockback, flee resets, or white hurt flash.
  } else if (mob.kind === 'kraken') {
    mob.facing = -1;
    mob.dx = 0;
    mob.dy = 0;
    mob.flee = 0;
  } else if (mob.kind === 'worm') {
    mob.dx *= 0.65;
    mob.dy *= 0.65;
    mob.flee = 0;
    mob.aggroTimer = 5;
  } else if (ambientMobSpecs[mob.kind]) {
    mob.facing = dir;
    mob.dx = dir * Math.min(knockback ?? 65, 65);
    mob.dy = mob.kind === 'ambient-bat' ? Math.sin(angle) * 35 : 0;
    mob.flee = .7;
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
    mob.flee = mob.kind === 'shark' ? 0.65 : mob.kind === 'cannibal-spear' ? 0.55 : mob.kind === 'frog' ? 0.32 : mob.kind === 'mimic' ? 0.22 : 1.6;
    mob.cooldown = Math.max(mob.cooldown ?? 0, 0.9);
    if (mob.kind === 'frog' && !mob.dayKind) aggroJungleCult(world);
    if (mob.kind === 'mimic' && !mob.awakened) wakeMimic(world, mob, null, effects);
    if (mob.kind === 'pufferfish' && mob.health > 0) {
      mob.flee = 0;
      if ((mob.pufferState ?? 'idle') === 'idle' && (mob.exhausted ?? 0) <= 0) {
        triggerPufferfishWindup(mob);
      }
    }
  }

  const label = mob.enemyType ? mob.enemyType.name.toLowerCase() : spec.name;
  let effect;
  if (mob.health <= 0) {
    if (mob.enemyType || mob.krakenMinion || (mob.testSpawn && mob.kind !== 'kraken')) {
      const index = world.mobs.indexOf(mob);
      if (index !== -1) world.mobs.splice(index, 1);
    } else if (mob.kind !== 'kraken' && (mob.kind !== 'ghost' || mob.resident)) {
      mob.respawn = mob.respawnDelay ?? 45;
    }
    const rewardType = mob.kind === 'kraken' ? 'greater'
      : ['mimic', 'hammer', 'shaman', 'worm'].includes(mob.kind) ? 'lesser' : null;
    if (rewardType && !mob.krakenMinion) {
      world.soulRewards ??= [];
      world.soulRewards.push({ id: mob.id ?? mob.kind + ':' + Math.floor(mob.homeX || mob.x), type: rewardType });
    }
    if (mob.kind === 'kraken') {
      clearKrakenState(mob);
      mob.windup = 0;
      mob.deathTime = KRAKEN_DEATH_DURATION;
      mob.deathImploded = false;
      if (!mob.testSpawn) world.krakenDefeated = true;
      removeKrakenMinions(world);
    }
    const dropId = mob.kind === 'fish'
      ? RAW_FISH.id
      : mob.kind === 'crab'
        ? RAW_CRAB.id
        : mob.kind === 'lionfish'
          ? POISON_NEEDLE.id
          : mob.kind === 'spider'
            ? STRING.id
            : null;
    const dropCount = mob.kind === 'lionfish' ? 2 : 1;
    effect = {
      x: mob.x,
      y: cy,
      material: spec.material,
      color: spec.color,
      count: ambientMobSpecs[mob.kind] ? 4 : 14,
      spread: ambientMobSpecs[mob.kind] ? 22 : 72,
      message: 'Defeated ' + label + '!',
      ...(dropId ? { drop: { id: dropId, count: dropCount } } : {}),
    };
  } else if (options.poisonTick) {
    effect = {
      x: mob.x,
      y: cy,
      color: '#79d956',
      count: 4,
      spread: 36,
    };
  } else {
    effect = {
      x: mob.x,
      y: cy,
      material: spec.material,
      color: spec.color,
      count: ambientMobSpecs[mob.kind] ? 3 : mob.kind === 'squid' ? 12 : 7,
      spread: ambientMobSpecs[mob.kind] ? 22 : 58,
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
    const maxRange = mob.kind === 'kraken' ? 8 * TILE : 5 * TILE;
    const points = mob.segments?.length
      ? mob.segments.map((seg) => ({ x: seg.x, y: seg.y, r: seg.radius }))
      : [{ x: mob.x, y: mob.y + spec.centerY, r: spec.radius }];
    for (const pt of points) {
      const pointerDist = Math.hypot(wx - pt.x, wy - pt.y);
      const playerDist = Math.hypot(pt.x - player.x, pt.y - (player.y + 11));
      if (pointerDist <= pt.r + 12 && playerDist <= maxRange && pointerDist < bestDist) {
        best = mob;
        bestDist = pointerDist;
      }
    }
  }
  return best;
}

export function resetHostiles(world) {
  if (world.projectiles) world.projectiles.length = 0;
  world.jungleCultAggro = false;
  removeKrakenMinions(world);
  for (const mob of world.mobs) {
    if (mob.kind === 'kraken' && (mob.health <= 0 || world.krakenDefeated)) continue;
    if ((seaEnemySpecs[mob.kind] || caveEnemySpecs[mob.kind] || jungleEnemySpecs[mob.kind]) && !(mob.respawn > 0)) {
      if (mob.dayKind && mob.kind !== mob.dayKind) {
        mob.kind = mob.dayKind;
        mob.maxHealth = mobSpecs[mob.dayKind].maxHealth;
      }
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
        spearThrust: null,
        spearHit: false,
        clawSlash: null,
        clawHit: false,
        tongue: null,
        biteTimer: 0,
        biteHit: false,
        awakened: false,
        leapCooldown: 0,
        segments: null,
        praying: mob.kind === 'frog' && !mob.dayKind,
        cultAggro: false,
        facing: mob.kind === 'mimic' ? 1 : mob.kind === 'frog' && !mob.dayKind ? idolFacing(mob.homeX) : (mob.facing ?? 1),
        jumpCooldown: 0,
        airDx: 0,
        dash: 0,
        dashDx: 0,
        dashDy: 0,
        shock: 0,
        shockHit: false,
        burstCount: 0,
      });
      if (mob.kind === 'kraken') clearKrakenState(mob);
    }
  }
}
