import { drawPickaxe } from './pickaxe-art.js';
import { APPEARANCE, CHARACTER_BODIES } from './content.js';
import { characterTilt, frontShoulder, meleePose, pickaxePose } from './gameplay/melee.js';
import { CRAWL_HEIGHT } from './gameplay/player.js';
import { ITEMS } from './inventory.js';
import { TILE, clamp } from './world/generation.js';

const eye = '#35303d';
const sole = '#554851';
const tankShade = '#37585e';
const boot = '#8b6353';
const bootLight = '#b78a69';
const turn = 2 * Math.PI;
const hairStyles = ['swept', 'cropped', 'bob', 'ponytail', 'shaved'];

function walkFoot(phase, weight, restX, direction) {
  const stance = 0.55;
  const reach = 6;
  const swing = clamp((phase - stance) / (1 - stance), 0, 1);
  const travel = phase < stance
    ? reach * (1 - 2 * phase / stance)
    : reach * (2 * swing * swing * (3 - 2 * swing) - 1);
  const lift = Math.sin(swing * Math.PI) ** 1.4 * weight;
  return [
    restX + (travel * direction - restX) * weight,
    22 - Math.round(2.5 * lift),
    (0.8 + 1.8 * lift) * weight,
  ];
}

function swimFoot(phase, effort, far) {
  const stroke = Math.sin(phase) * effort;
  return [
    (far ? -6 : -4) - 2.2 * stroke,
    (far ? 21 : 22) + 1.8 * Math.cos(phase) * effort,
    0.7 + 1.6 * Math.max(0, -stroke),
  ];
}

export function createCharacterRenderer(ctx) {
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
  }

  function pixelLine(from, to, width, color) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.ceil(Math.max(1, Math.abs(dx), Math.abs(dy)));
    const offset = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      rect(from[0] + i * dx / steps - offset, from[1] + i * dy / steps - offset, width, width, color);
    }
  }

  function leg(hip, foot, pants, far, swimming) {
    const [x, y, bend = 0] = foot;
    const ankle = [x, y - 1];
    let knee = [Math.round((hip[0] + x) / 2) + 1, Math.min(19, y - 2)];
    if (bend) {
      const dx = x - hip[0];
      const dy = ankle[1] - hip[1];
      const offset = bend / Math.hypot(dx, dy);
      knee = [hip[0] + dx / 2 + dy * offset, hip[1] + dy / 2 - dx * offset];
    }
    pixelLine(hip, knee, 3, pants.back);
    pixelLine(knee, ankle, 3, pants.back);
    const trimWidth = far ? 1 : 2;
    pixelLine(hip, knee, trimWidth, far ? pants.front : pants.light);
    pixelLine(knee, ankle, trimWidth, pants.front);
    const bootLeft = x - (swimming ? 3 : 2);
    rect(bootLeft, y - 1, far ? 4 : 5, 2, sole);
    rect(bootLeft + 1, y - 1, far ? 2 : 4, 1, far ? '#625051' : boot);
    if (!far) rect(x + (swimming ? -2 : 1), y - 1, 1, 1, bootLight);
  }

  function arm(x, y, swing, skin, shirt, far) {
    const shoulder = [x, y];
    const elbow = [x + Math.round(swing * 0.4), y + 3];
    const hand = [x + swing, y + 5 - Math.floor(Math.abs(swing) / 2)];
    pixelLine(shoulder, elbow, 3, shirt.wet);
    pixelLine(elbow, hand, 3, skin.shade);
    pixelLine(shoulder, elbow, 2, far ? shirt.wet : shirt.base);
    pixelLine(elbow, hand, 2, far ? skin.shade : skin.face);
    if (!far) {
      rect(elbow[0], elbow[1], 1, 1, shirt.light);
      rect(hand[0], hand[1] - 1, 1, 1, skin.arm);
      rect(hand[0], hand[1], 1, 1, skin.hand);
    }
  }

  function head(style, hair, skin, x, y, sway) {
    ctx.save();
    ctx.translate(x, y);
    if (style === 'ponytail') {
      rect(-7, 4, 4, 5, hair.shade);
      rect(-8 + sway, 6, 4, 4, hair.shade);
      rect(-7 + sway, 6, 2, 3, hair.base);
      rect(-7 + sway, 6, 1, 2, hair.light);
      rect(-6, 4, 2, 2, '#e8ba79');
    }
    rect(-4, 1, 9, 8, skin.shade);
    rect(-3, 0, 7, 2, style === 'shaved' ? skin.shade : hair.shade);
    rect(-2, 2, 6, 7, skin.shade);
    rect(-1, 3, 5, 5, skin.face);
    rect(4, 5, 2, 2, skin.arm);
    rect(1, 8, 3, 1, skin.face);
    rect(3, 4, 1, 2, eye);
    rect(-2, 6, 1, 1, skin.hand);
    rect(2, 7, 2, 1, skin.hand);
    if (style !== 'shaved') {
      rect(-4, 1, 8, 3, hair.base);
      rect(-3, 0, 6, 1, hair.shade);
      rect(-3, 1, 4, 1, hair.light);
      rect(0, 2, 2, 1, hair.light);
      rect(-4, 3, 3, 3, hair.shade);
    }
    if (style === 'swept') {
      rect(0, 2, 5, 2, hair.base);
      rect(1, 2, 3, 1, hair.light);
    }
    if (style === 'cropped') rect(-3, 2, 7, 1, hair.light);
    if (style === 'bob') {
      rect(-5, 3, 3, 7, hair.shade);
      rect(-4, 3, 2, 6, hair.base);
      rect(-1, 2, 6, 2, hair.base);
      rect(-4, 4, 1, 3, hair.light);
    }
    if (style === 'shaved') rect(-2, 1, 5, 1, skin.face);
    ctx.restore();
  }

  function divingHelmet(x, y) {
    rect(x - 5, y, 11, 9, '#665347');
    rect(x - 4, y + 1, 9, 7, '#cfa368');
    rect(x - 3, y + 1, 6, 2, '#f0ce93');
    rect(x - 4, y + 8, 9, 1, '#69513e');
    rect(x, y + 2, 6, 5, '#2b4752');
    rect(x + 1, y + 3, 5, 3, '#8bdfd0');
    rect(x + 2, y + 3, 2, 1, '#d8f6ec');
  }

  function miningArm(x, y, targetX, targetY, tilt, phase, skin, shirt, tier, far = false) {
    const angle = clamp(Math.atan2(targetY - y, targetX - x), -1.05, 1.15);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(pickaxePose(phase, angle).angle - tilt);
    rect(-2, -2, 6, 4, shirt.wet);
    rect(-1, -1, 4, 3, far ? shirt.wet : shirt.base);
    rect(2, -1, 5, 3, far ? skin.shade : skin.face);
    if (tier) drawPickaxe(rect, tier);
    rect(5, -1, 2, 2, far ? skin.face : skin.arm);
    ctx.restore();
  }

  function weaponArm(x, y, weapon, attack, swimming, tilt, skin, shirt, hasArrow, reducedMotion) {
    const active = attack?.kind === weapon;
    const melee = active && attack.hitMobs ? meleePose(attack) : null;
    const baseAngle = melee ? melee.angle - tilt : active
      ? clamp(Math.atan2(Math.sin(attack.angle), Math.max(0.15, Math.abs(Math.cos(attack.angle)))), -1.15, 1.15) - tilt
      : (weapon === 'bow' ? 0 : (swimming ? 0.08 : -0.18));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(baseAngle);
    rect(-2, -2, 6, 4, shirt.wet);
    rect(-1, -1, 4, 3, shirt.base);
    if (weapon === 'melee' && !attack.tier) {
      rect(2, -1, 5 + melee.thrust, 3, skin.face);
      rect(5 + melee.thrust, -2, 2, 4, skin.arm);
      ctx.restore();
      return;
    }
    rect(2, -1, 5, 3, skin.face);
    rect(5, -1, 2, 2, skin.arm);
    if (weapon === 'melee') {
      drawPickaxe(rect, attack.tier);
    } else if (weapon === 'spear' || weapon === 'copper-spear') {
      const copper = weapon === 'copper-spear';
      const thrust = melee?.thrust ?? 0;
      rect(-3 + thrust, -1, 18, 2, '#85604c');
      rect(-1 + thrust, -1, 14, 1, '#d29c65');
      rect(4 + thrust, -1, 3, 2, '#483d42');
      rect(14 + thrust, -2, 4, 4, copper ? '#a35646' : '#6e888a');
      rect(15 + thrust, -1, 5, 2, copper ? '#e09b71' : '#b5c6bd');
      rect(18 + thrust, -1, 3, 1, copper ? '#ffd3a0' : '#d9e1cf');
      if (melee?.bounds && !reducedMotion) rect(9 + thrust, -2, 6, 1, '#f4d4a5a8');
    } else if (weapon === 'bow') {
      const pull = active && !reducedMotion ? Math.round((attack.timer / attack.duration) * 3) : 0;
      rect(5 - pull, -6, 1, 12, '#bed8ba');
      rect(5, -7, 2, 2, '#85604c');
      rect(5, 5, 2, 2, '#85604c');
      rect(7, -6, 2, 12, '#85604c');
      rect(8, -5, 1, 10, '#d29c65');
      rect(7, -1, 2, 3, '#483d42');
      if (hasArrow && !active) {
        rect(5, -1, 8, 1, '#d29c65');
        rect(12, -2, 3, 3, '#b5c6bd');
      }
    }
    ctx.restore();
  }

  return function drawCharacter(player, appearance, { tank = false, helmet = false, time = 0, miningSwing = null, held = null, attack = null, hasArrow = false, reducedMotion = false, swimming = false } = {}) {
    const crawling = player.height === CRAWL_HEIGHT;
    const speed = Math.abs(player.dx);
    const strideWeight = !reducedMotion && player.grounded && !swimming
      ? clamp((speed - 8) / (crawling ? 32 : 52), 0, 1) : 0;
    const phase = player.walkPhase;
    const angle = phase * turn;
    const targetX = miningSwing ? (miningSwing.tx + 0.5) * TILE - player.x : 0;
    const facing = attack?.facing ?? (Math.sign(attack ? Math.cos(attack.angle) : targetX) || player.facing);
    const tilt = characterTilt(player, swimming, facing);
    const armSwing = Math.round(Math.cos(angle + 0.18) * (crawling ? 5 : 3) * strideWeight);
    const kick = swimming && !reducedMotion ? Math.round(Math.sin(time * 10) * (1 + 2 * clamp(speed / 70, 0, 1))) : 0;
    const { shoulder, waist } = CHARACTER_BODIES[appearance.body];
    const skin = APPEARANCE.skin[appearance.skin];
    const hair = APPEARANCE.hairColor[appearance.hairColor];
    const shirt = APPEARANCE.shirt[appearance.shirt];
    const pants = APPEARANCE.pants[appearance.pants];
    const { x: shoulderX, y: shoulderY } = frontShoulder(player, appearance);
    const walkDirection = player.dx * facing < 0 ? -1 : 1;
    const rising = player.dy < -35;
    const swimPhase = time * 7.5;
    const swimEffort = swimming && !reducedMotion
      ? 0.32 + 0.68 * clamp(Math.hypot(player.dx, player.dy) / 82, 0, 1) : 0;
    const nearFoot = swimming ? swimFoot(swimPhase, swimEffort, false)
      : player.grounded ? walkFoot(phase, strideWeight, 2, walkDirection) : [3, rising ? 19 : 21];
    const farFoot = swimming ? swimFoot(swimPhase + Math.PI, swimEffort, true)
      : player.grounded ? walkFoot((phase + 0.5) % 1, strideWeight, -3, walkDirection) : [-4, rising ? 20 : 22];
    const targetY = miningSwing ? (miningSwing.ty + 0.5) * TILE - player.y : 0;
    const swingPhase = reducedMotion ? 0 : (miningSwing?.phase ?? 0);
    const offhand = Boolean(miningSwing?.tool && miningSwing.tool !== held);
    const mainSwing = miningSwing && !offhand;
    const heldItem = ITEMS[held];
    const weapon = attack?.kind ?? heldItem?.weapon?.id;

    function drawFrontArm(restSwing, restY) {
      if (attack || (weapon && !mainSwing)) {
        weaponArm(shoulderX, shoulderY, weapon, attack, swimming, tilt, skin, shirt, hasArrow, reducedMotion);
      } else if (mainSwing) {
        miningArm(shoulderX, shoulderY, Math.abs(targetX), targetY, tilt, swingPhase, skin, shirt, miningSwing.tier);
      } else if (heldItem?.pickaxe) {
        miningArm(shoulderX, shoulderY, shoulderX + 10, shoulderY + 5, tilt, 0, skin, shirt, heldItem.pickaxe);
      } else {
        arm(shoulderX, restY, restSwing, skin, shirt, false);
      }
    }

    ctx.save();
    if (player.hurt > 0 && Math.floor(player.hurt * 14) % 2 === 1) ctx.globalAlpha = 0.65;
    const jitter = (player.stun ?? 0) > 0 && !reducedMotion ? Math.round(Math.sin(time * 48)) : 0;
    ctx.translate(Math.round(player.x) + jitter, Math.round(player.y));
    ctx.scale(facing, 1);
    if (crawling) {
      const shuffle = Math.round(armSwing * 0.4);
      if (offhand) miningArm(-shoulderX, shoulderY, Math.abs(targetX), targetY, tilt, swingPhase, skin, shirt, miningSwing.tier, true);
      rect(-6 - shuffle, 13, 5, 3, sole);
      rect(-5 - shuffle, 13, 3, 2, pants.back);
      rect(-5, 11, 6, 4, pants.front);
      rect(-6, 7, shoulder, 6, shirt.wet);
      rect(-5, 8, shoulder - 2, 4, swimming ? shirt.wet : shirt.base);
      rect(-5, 8, shoulder - 3, 1, shirt.light);
      if (tank) {
        rect(-7, 4, 7, 4, tankShade);
        rect(-6, 5, 5, 2, '#55988f');
        rect(-6, 5, 4, 1, '#bed8ba');
      }
      head(hairStyles[appearance.hair], hair, skin, 3, 2, Math.sign(shuffle));
      if (helmet) divingHelmet(3, 2);
      drawFrontArm(2 - shuffle, 9);
      ctx.restore();
      return;
    }
    if (swimming) ctx.rotate(tilt);
    leg([-2, 17], farFoot, pants, true, swimming);
    if (strideWeight) leg([1, 17], nearFoot, pants, false, swimming);
    if (offhand) miningArm(-shoulderX, shoulderY, Math.abs(targetX), targetY, tilt, swingPhase, skin, shirt, miningSwing.tier, true);
    else arm(-shoulderX, 11, swimming ? 1 - kick : armSwing, skin, shirt, true);

    if (tank) {
      rect(-shoulderX - 5, 9, 5, 9, tankShade);
      rect(-shoulderX - 4, 10, 3, 7, '#55988f');
      rect(-shoulderX - 4, 11, 1, 4, '#bed8ba');
      rect(-shoulderX - 3, 8, 2, 2, '#d2a673');
    }
    rect(-(shoulder - 1) / 2, 9, shoulder, 5, shirt.wet);
    rect(-(waist - 1) / 2, 13, waist, 5, pants.back);
    rect(-(shoulder - 3) / 2, 10, shoulder - 2, 4, shirt.base);
    rect(-(waist - 3) / 2, 13, waist - 2, 3, shirt.base);
    rect(-(waist - 3) / 2, 15, waist - 2, 1, shirt.wet);
    rect(-2, 10, 4, 1, shirt.light);
    rect(-2, 12, 1, 3, shirt.wet);
    rect(0, 13, 2, 1, shirt.light);
    rect(-(waist - 3) / 2, 16, waist - 2, 1, '#5e4946');
    rect(-1, 16, 2, 1, '#d9ac75');
    if (!strideWeight) leg([1, 17], nearFoot, pants, false, swimming);
    head(hairStyles[appearance.hair], hair, skin, 0, 0, swimming ? -Math.sign(kick) : 0);
    if (helmet) divingHelmet(0, 0);
    rect(-2, 9, 5, 1, '#efc48d');
    rect(-2, 10, 2, 1, '#b4755a');

    drawFrontArm(swimming ? 4 + Math.sign(kick) : -armSwing, 11);

    if (swimming) {
      for (let i = 0; i < 3; i++) {
        const rise = (time * 18 + i * 9) % 27;
        const x = 7 + Math.sin(rise * .27 + i) * 3;
        rect(x, 5 - rise, 2, 1, '#a1d9cb');
        rect(x - 1, 6 - rise, 1, 1, '#7ebdbb');
      }
    }
    if ((player.stun ?? 0) > 0) {
      for (let i = 0; i < 6; i++) {
        const spark = time * 14 + i * 1.1;
        const sx = Math.round(Math.cos(spark) * 8);
        const sy = Math.round(10 + Math.sin(spark * 1.3) * 9);
        rect(sx, sy, 2, 1, i % 2 ? '#8bdfd0' : '#f8dca5');
        rect(sx + 1, sy - 1, 1, 2, i % 2 ? '#f8dca5' : '#8bdfd0');
      }
    }
    ctx.restore();
  };
}
