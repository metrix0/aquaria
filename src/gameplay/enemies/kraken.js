import { MATERIAL } from '../../content.js';
import { inWater } from '../../world.js';
import { MOB_HEALTH, WATER, clamp, groundAt } from '../../world/generation.js';
import { takeDamage } from '../player.js';

export const KRAKEN_BARRIER_OFFSET = 38;
const KRAKEN_TACKLE_RANGE = 190;
const KRAKEN_GRAB_RANGE = 410;
const KRAKEN_ENGAGE_RANGE = 420;

export const krakenSpec = {
  name: 'kraken',
  width: 84,
  height: 144,
  radius: 58,
  centerY: -36,
  damage: 5,
  healthDamage: 24,
  message: 'Crushed by the Kraken!',
  material: MATERIAL.bedrock,
  maxHealth: MOB_HEALTH.kraken,
  color: '#833c66',
};

export function krakenBarrierX(mob) {
  return mob.x - KRAKEN_BARRIER_OFFSET;
}

function spawnKrakenSquids(world, mob, py, effects) {
  const offsets = [-34, 0, 34];
  const baseY = clamp(py, WATER + 54, Math.max(WATER + 54, mob.y + 72));
  for (let i = 0; i < offsets.length; i++) {
    const sy = Math.max(WATER + 20, baseY + offsets[i]);
    const sx = mob.x - 48 - (i === 1 ? 10 : 0);
    world.mobs.push({
      id: `kraken-squid-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'squid',
      krakenMinion: true,
      x: sx,
      y: sy,
      homeX: sx - 45,
      homeY: sy,
      span: 64,
      speed: 56,
      dx: -95,
      dy: offsets[i] * 0.9,
      facing: -1,
      grounded: false,
      flee: 0,
      cooldown: 0,
      maxHealth: MOB_HEALTH.squid,
      health: MOB_HEALTH.squid,
      hurt: 0,
      respawn: 0,
      remainingLife: 28,
      attackTimer: 0.7 + i * 0.35,
      windup: 0,
      phase: i * 1.9,
    });
  }
  effects.push({
    x: mob.x - 44,
    y: mob.y,
    color: '#0d1017',
    count: 16,
    spread: 64,
    message: 'The Kraken unleashes three squids!',
  });
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

export function stepKraken(world, player, mob, dt, time, effects) {
  mob.x = mob.homeX;
  mob.y = mob.homeY;
  mob.dx = 0;
  mob.dy = 0;
  mob.facing = -1;
  mob.flee = 0;
  mob.cooldown = Math.max(0, (mob.cooldown ?? 0) - dt);
  mob.attackMode = mob.attackMode ?? 'idle';
  mob.attackTimer = mob.attackTimer ?? 1.8;
  mob.windup = mob.windup ?? 0;
  mob.actionTime = mob.actionTime ?? 0;
  mob.attackIndex = mob.attackIndex ?? 0;
  mob.tentacleReach = mob.tentacleReach ?? 0;

  const barrierX = krakenBarrierX(mob);
  if (!player.flightOrigin && player.x + player.width / 2 > barrierX) {
    player.x = barrierX - player.width / 2;
    if (player.dx > 0) player.dx = 0;
  }

  const px = player.x;
  const py = player.y + Math.ceil(player.height / 2);
  const playerInWater = inWater(world, px, py);

  // Barrier tentacle contact damage at any depth (surface, underwater, or caves).
  if (
    !player.flightOrigin &&
    !mob.grabbing &&
    player.x + player.width / 2 >= barrierX - 6 &&
    (player.hurt ?? 0) <= 0
  ) {
    player.hurt = 1.05;
    player.dx = -150;
    player.dy = -55;
    const loss = takeDamage(player, 16);
    if (playerInWater) player.oxygen = Math.max(0, player.oxygen - 3);
    effects.push({
      x: barrierX,
      y: py,
      color: '#a9557a',
      count: 10,
      spread: 56,
      message: "Blocked by the Kraken's tentacles! −" + loss + ' health',
    });
  }

  const inRange = !player.flightOrigin && Math.abs(mob.x - px) <= KRAKEN_ENGAGE_RANGE;
  const originY = clamp(py, mob.y - 30, Math.max(mob.y + 80, py));

  if (mob.windup > 0) {
    mob.windup = Math.max(0, mob.windup - dt);
    mob.tentacleReach = -0.22;
    mob.tentacleTarget = { x: px, y: py };
    if (mob.windup === 0) {
      if (mob.attackMode === 'summon') {
        spawnKrakenSquids(world, mob, py, effects);
        mob.attackMode = 'idle';
        mob.tentacleReach = 0;
        mob.attackTimer = 2.6;
      } else if (mob.attackMode === 'tackle') {
        mob.actionTime = 0.6;
        mob.attackHit = false;
        const dx = px - (mob.x - 24);
        const dy = py - originY;
        const len = Math.hypot(dx, dy) || 1;
        const reachLen = Math.min(KRAKEN_TACKLE_RANGE, Math.max(125, len + 26));
        mob.tentacleTarget = {
          x: mob.x - 24 + (dx / len) * reachLen,
          y: originY + (dy / len) * reachLen,
          oy: originY,
        };
      } else if (mob.attackMode === 'grab') {
        mob.actionTime = 1.65;
        mob.attackHit = false;
        mob.grabbing = false;
        const dx = px - (mob.x - 24);
        const dy = py - originY;
        const len = Math.hypot(dx, dy) || 1;
        const reachLen = Math.min(KRAKEN_GRAB_RANGE, Math.max(120, len + 28));
        mob.tentacleTarget = {
          x: mob.x - 24 + (dx / len) * reachLen,
          y: originY + (dy / len) * reachLen,
          oy: originY,
        };
      }
    }
    return;
  }

  if (mob.actionTime > 0) {
    mob.actionTime = Math.max(0, mob.actionTime - dt);
    const target = mob.tentacleTarget ?? { x: px, y: py, oy: mob.y };

    if (mob.attackMode === 'tackle') {
      const progress = 1 - mob.actionTime / 0.6;
      mob.tentacleReach = progress < 0.45 ? progress / 0.45 : Math.max(0, (1 - progress) / 0.55);
      const tipX = mob.x - 24 + (target.x - (mob.x - 24)) * mob.tentacleReach;
      const tipY = (target.oy ?? mob.y) + (target.y - (target.oy ?? mob.y)) * mob.tentacleReach;

      if (
        !mob.attackHit &&
        !player.flightOrigin &&
        mob.tentacleReach > 0.35 &&
        pointToSegmentDist(px, py, mob.x - 24, target.oy ?? mob.y, tipX, tipY) <= 28
      ) {
        mob.attackHit = true;
        player.hurt = 1.1;
        player.dx = -175;
        player.dy = -48;
        const loss = takeDamage(player, 24);
        if (playerInWater) player.oxygen = Math.max(0, player.oxygen - 4);
        effects.push({
          x: px,
          y: py,
          color: '#a9557a',
          count: 14,
          spread: 68,
          message: "Struck by the Kraken's tentacle tackle! −" + loss + ' health',
        });
      }
    } else if (mob.attackMode === 'grab') {
      if (!mob.grabbing) {
        const extend = Math.min(1, (1.65 - mob.actionTime) / 0.35);
        mob.tentacleReach = extend;
        const tipX = mob.x - 24 + (target.x - (mob.x - 24)) * extend;
        const tipY = (target.oy ?? mob.y) + (target.y - (target.oy ?? mob.y)) * extend;

        if (
          !player.flightOrigin &&
          playerInWater &&
          (Math.hypot(px - tipX, py - tipY) <= 32 ||
            pointToSegmentDist(px, py, mob.x - 24, target.oy ?? mob.y, tipX, tipY) <= 24)
        ) {
          mob.grabbing = true;
          mob.actionTime = Math.min(mob.actionTime, 1.25);
          if (!mob.attackHit) {
            mob.attackHit = true;
            player.hurt = 0.8;
            const loss = takeDamage(player, 12);
            effects.push({
              x: px,
              y: py,
              color: '#833c66',
              count: 10,
              spread: 48,
              message: 'Grabbed by the Kraken! Pulled deeper underwater! −' + loss + ' health',
            });
          }
        } else if (mob.actionTime < 1.15) {
          mob.tentacleReach = Math.max(0, mob.actionTime / 1.15);
        }
      }

      if (mob.grabbing) {
        if (player.flightOrigin || !playerInWater) {
          mob.grabbing = false;
          mob.actionTime = 0;
        } else {
          const seabedY = (groundAt(Math.floor(px / 16)) - 1) * 16 - player.height;
          if (player.y < seabedY) {
            player.dy = 155;
            player.dx = clamp((mob.x - 95 - px) * 1.8, -55, 65);
          } else {
            player.dy = Math.max(player.dy, 40);
          }
          player.oxygen = Math.max(0, player.oxygen - 2.5 * dt);
          mob.tentacleReach = 1;
          mob.tentacleTarget = { x: px, y: py, oy: mob.y + 20 };
        }
      }
    }

    if (mob.actionTime === 0) {
      mob.attackMode = 'idle';
      mob.grabbing = false;
      mob.tentacleReach = 0;
      mob.attackTimer = 2.2;
    }
    return;
  }

  mob.tentacleReach = 0;
  mob.grabbing = false;
  if (!inRange) return;

  mob.attackTimer = Math.max(0, mob.attackTimer - dt);
  if (mob.attackTimer <= 0) {
    const activeSquids = world.mobs.filter((m) => m.krakenMinion && m.health > 0).length;
    const playerDist = Math.hypot(px - (mob.x - 24), py - originY);
    let mode;
    if (playerDist > KRAKEN_TACKLE_RANGE && playerInWater) {
      mode = 'grab';
    } else {
      const cycle = ['tackle', 'summon', 'grab'];
      mode = cycle[mob.attackIndex % cycle.length];
      mob.attackIndex++;
      if (mode === 'summon' && (activeSquids >= 3 || !playerInWater)) {
        mode = playerInWater ? 'grab' : 'tackle';
      }
      if (mode === 'grab' && !playerInWater) {
        mode = 'tackle';
      }
    }
    mob.attackMode = mode;
    mob.windup = mode === 'summon' ? 0.6 : 0.52;
  }
}
