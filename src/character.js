import { drawPickaxe } from './pickaxe-art.js';
import { APPEARANCE, ARMOR, CAPTAINS_CUTLASS, CHARACTER_BODIES, COBALT_SPEAR, COPPER_SPEAR, FEET_GEAR, SNORKELS, SPEAR } from './content.js';
import { PLAYER_SWING_ARC_SCALE, characterTilt, frontShoulder, meleePose, pickaxePose } from './gameplay/melee.js';
import { CRAWL_HEIGHT } from './gameplay/player.js';
import { ITEMS } from './inventory.js';
import { TILE, clamp } from './world/generation.js';

const eye = '#35303d';
const sole = '#554851';
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

function climbStep(y, restY, rung, cycle) {
  // Hold a rung for half the cycle, then reach for the next one. Using the
  // player's position keeps the same contacts when pausing or reversing.
  const phase = (y + restY - rung) / cycle;
  const step = Math.floor(phase);
  const reach = clamp((phase - step - .5) * 2, 0, 1);
  return [rung + (step + reach * reach * (3 - 2 * reach)) * cycle - y,
    Math.sin(reach * Math.PI)];
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

  function leg(hip, foot, pants, far, swimming, feetGear = null) {
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
    if (feetGear) {
      const [finShade, finMain, finLight] = feetGear.colors;
      if (swimming) {
        rect(x - 8, y - 2, 3, 3, finShade);
        rect(x - 6, y - 1, 8, 2, finShade);
        rect(x - 7, y - 1, 7, 1, far ? finShade : finMain);
        if (!far) rect(x - 7, y - 1, 3, 1, finLight);
      } else {
        rect(x - 2, y - 1, far ? 6 : 8, 2, finShade);
        rect(x - 1, y - 1, far ? 4 : 6, 1, far ? finShade : finMain);
        if (!far) rect(x + 3, y - 1, 2, 1, finLight);
      }
      return;
    }
    const bootLeft = x - (swimming ? 3 : 2);
    rect(bootLeft, y - 1, far ? 4 : 5, 2, sole);
    rect(bootLeft + 1, y - 1, far ? 2 : 4, 1, far ? '#625051' : boot);
    if (!far) rect(x + (swimming ? -2 : 1), y - 1, 1, 1, bootLight);
  }

  function bentArm(shoulder, elbow, hand, skin, shirt, far, ring = false) {
    pixelLine(shoulder, elbow, 3, shirt.wet);
    pixelLine(elbow, hand, 3, skin.shade);
    pixelLine(shoulder, elbow, 2, far ? shirt.wet : shirt.base);
    pixelLine(elbow, hand, 2, far ? skin.shade : skin.face);
    if (!far) {
      rect(elbow[0], elbow[1], 1, 1, shirt.light);
      rect(hand[0], hand[1] - 1, 1, 1, skin.arm);
      rect(hand[0], hand[1], 1, 1, ring ? '#a8f184' : skin.hand);
    }
  }

  function arm(x, y, swing, skin, shirt, far, ring = false) {
    bentArm([x, y], [x + Math.round(swing * 0.4), y + 3],
      [x + swing, y + 5 - Math.floor(Math.abs(swing) / 2)], skin, shirt, far, ring);
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

  function chestArmor(x, y, width, armor) {
    const [shade, metal, shine] = armor.colors;
    rect(x, y, width, 4, shade);
    rect(x + 1, y, width - 2, 3, metal);
    rect(x + 2, y, width - 4, 1, shine);
    rect(x + 1, y + 4, width - 2, 2, shade);
    rect(x + 2, y + 4, width - 4, 1, metal);
  }

  function divingSnorkel(x, y, snorkel) {
    const [shade, light] = snorkel.colors;
    rect(x - 2, y + 4, 6, 1, shade);
    rect(x + 2, y + 3, 5, 3, '#314650');
    rect(x + 3, y + 4, 3, 1, '#b6e7e2');
    rect(x + 6, y + 1, 3, 7, shade);
    rect(x + 7, y + 1, 1, 6, light);
    rect(x + 6, y, 4, 2, shade);
    rect(x + 7, y, 2, 1, light);
    rect(x + 4, y + 7, 4, 2, shade);
    rect(x + 5, y + 7, 2, 1, light);
  }

  function pickaxeGrip(tier, skin) {
    drawPickaxe(rect, tier);
    rect(5, -1, 3, 3, skin.shade);
    rect(5, -1, 2, 2, skin.arm);
    rect(7, 0, 1, 1, skin.hand);
  }

  function carryPickaxe(x, y, sway, tilt, skin, shirt, tier, swimming, crawling, ring) {
    const shoulder = [x, y];
    const elbow = [x + Math.round(sway * .2), y + 4];
    const hand = [x + 4 + Math.round(sway * .4), y + (crawling ? 3 : 5)];
    pixelLine(shoulder, elbow, 3, shirt.wet);
    pixelLine(shoulder, elbow, 2, shirt.base);
    pixelLine(elbow, hand, 3, skin.shade);
    pixelLine(elbow, hand, 2, skin.face);

    ctx.save();
    ctx.translate(hand[0], hand[1]);
    ctx.rotate((swimming || crawling ? -.65 : -.95) + sway * .045 - tilt);
    ctx.translate(-6, 0);
    pickaxeGrip(tier, skin);
    if (ring) rect(7, 0, 1, 1, '#a8f184');
    ctx.restore();
  }

  function miningArm(x, y, targetX, targetY, tilt, phase, skin, shirt, tier, ring) {
    const angle = clamp(Math.atan2(targetY - y, targetX - x), -1.05, 1.15);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(pickaxePose(phase, angle, tier, PLAYER_SWING_ARC_SCALE).angle - tilt);
    rect(-2, -2, 6, 4, shirt.wet);
    rect(-1, -1, 4, 3, shirt.base);
    rect(2, -1, 5, 3, skin.face);
    if (tier) pickaxeGrip(tier, skin);
    else rect(5, -1, 2, 2, skin.arm);
    if (ring) rect(6, 0, 1, 1, '#a8f184');
    ctx.restore();
  }

  function weaponArm(x, y, weapon, attack, swimming, tilt, skin, shirt, hasArrow, reducedMotion, ring) {
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
      if (ring) rect(6 + melee.thrust, 0, 1, 1, '#a8f184');
      ctx.restore();
      return;
    }
    rect(2, -1, 5, 3, skin.face);
    if (weapon === 'melee') pickaxeGrip(attack.tier, skin);
    else rect(5, -1, 2, 2, skin.arm);
    const blade = ITEMS[weapon]?.weapon?.blade;
    if (weapon === CAPTAINS_CUTLASS.id) {
      const [left, top, width, height] = blade;
      rect(5, -1, 4, 2, '#65483f');
      rect(5, 2, 5, 1, '#bd9659');
      rect(8, 3, 2, 1, '#bd9659');
      rect(8, -1, 2, 5, '#d8b872');
      rect(left, top + 2, width - 2, height - 2, '#638188');
      rect(left + 2, top + 1, width - 3, 2, '#a7c4bc');
      rect(left + width - 4, top, 4, 2, '#dce7c9');
    } else if (blade) {
      const [left, top, width, height] = blade;
      rect(5, -1, 4, 2, '#85604c');
      rect(7, -3, 2, 6, '#d5a467');
      rect(left, top, width - 1, height, '#637985');
      rect(left + 1, top, width - 2, 2, '#dae5dc');
      rect(left + width - 1, -1, 1, 2, '#a2bac0');
    } else if (weapon === SPEAR.id || weapon === COPPER_SPEAR.id || weapon === COBALT_SPEAR.id) {
      const reach = weapon === COBALT_SPEAR.id ? COBALT_SPEAR.reach : 0;
      const [shade, metal, shine] = reach ? ARMOR['cobalt-breastplate'].colors
        : weapon === COPPER_SPEAR.id ? ['#a35646', '#e09b71', '#ffd3a0'] : ['#6e888a', '#b5c6bd', '#d9e1cf'];
      const thrust = melee?.thrust ?? 0;
      rect(-3 + thrust, -1, 18 + reach, 2, '#85604c');
      rect(-1 + thrust, -1, 14 + reach, 1, '#d29c65');
      rect(4 + thrust, -1, 3, 2, '#483d42');
      rect(14 + thrust + reach, -2, 4, 4, shade);
      rect(15 + thrust + reach, -1, 5, 2, metal);
      rect(18 + thrust + reach, -1, 3, 1, shine);
      if (melee?.bounds && !reducedMotion) rect(9 + thrust, -2, 6, 1, '#f4d4a5a8');
    } else if (weapon === 'bow') {
      const pull = attack?.charging ? Math.round(attack.drawProgress * 4) : active && !reducedMotion ? Math.round((attack.timer / attack.duration) * 3) : 0;
      rect(5 - pull, -6, 1, 12, '#bed8ba');
      rect(5, -7, 2, 2, '#85604c');
      rect(5, 5, 2, 2, '#85604c');
      rect(7, -6, 2, 12, '#85604c');
      rect(8, -5, 1, 10, '#d29c65');
      rect(7, -1, 2, 3, '#483d42');
      if (hasArrow && (!active || attack?.charging)) {
        rect(5-pull, -1, 8, 1, '#d29c65');
        rect(12-pull, -2, 3, 3, attack?.extra ? '#9affcc' : attack?.drawProgress >= 1 ? '#fff2a7' : '#b5c6bd');
      }
    }
    if (ring) rect(6, 0, 1, 1, '#a8f184');
    ctx.restore();
  }

  return function drawCharacter(player, appearance, { snorkel = null, ring = false, time = 0, miningSwing = null, held = null, attack = null, hasArrow = false, reducedMotion = false, swimming = false } = {}) {
    if (player.downed) {
      // Reuse the complete customized sprite, laid sideways with its back on the ground.
      ctx.save();
      ctx.translate(Math.round(player.x), Math.round(player.y + player.height - 7));
      ctx.rotate(-Math.PI / 2 * player.facing);
      drawCharacter({ ...player, downed: null, x: 0, y: -11, height: 23, grounded: true, dx: 0, dy: 0, climb: null, hurt: 0 }, appearance, { snorkel, reducedMotion: true });
      ctx.restore();
      return;
    }
    const gear = SNORKELS[snorkel];
    const crawling = player.height === CRAWL_HEIGHT;
    const climb = !crawling && player.climb;
    const rope = climb?.kind === 'rope';
    const climbCenter = climb ? (climb.tx + .5) * TILE - Math.round(player.x) : 0;
    const speed = Math.abs(player.dx);
    const strideWeight = !climb && !reducedMotion && player.grounded && !swimming
      ? clamp((speed - 8) / (crawling ? 32 : 52), 0, 1) : 0;
    const phase = player.walkPhase;
    const angle = phase * turn;
    const targetX = miningSwing ? (miningSwing.tx + 0.5) * TILE - player.x : 0;
    const climbFacing = rope && Math.abs(climbCenter) > 2 ? Math.sign(climbCenter) : player.facing;
    const facing = attack?.facing ?? (Math.sign(attack ? Math.cos(attack.angle) : targetX) || climbFacing);
    const pixelY = Math.round(player.y);
    const gripCenter = climbCenter * facing;
    const shaft = climb?.kind === 'shaft';
    const rungGap = shaft ? 7 : 8;
    const firstRung = shaft ? climb.floor * TILE - 3 : 4;
    const secondRung = firstRung + rungGap;
    const railReach = climb?.kind === 'headframe' ? 9 : shaft ? 6 : 4;
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
    const feetGear = FEET_GEAR[player.feet] ?? null;
    const swimPhase = time * (feetGear ? 9.5 : 7.5);
    const swimEffort = swimming && !reducedMotion
      ? 0.32 + 0.68 * clamp(Math.hypot(player.dx, player.dy) / 82, 0, 1) : 0;
    const nearFoot = swimming ? swimFoot(swimPhase, swimEffort, false)
      : player.grounded ? walkFoot(phase, strideWeight, 2, walkDirection) : [3, rising ? 19 : 21];
    const farFoot = swimming ? swimFoot(swimPhase + Math.PI, swimEffort, true)
      : player.grounded ? walkFoot((phase + 0.5) % 1, strideWeight, -3, walkDirection) : [-4, rising ? 20 : 22];
    const targetY = miningSwing ? (miningSwing.ty + 0.5) * TILE - player.y : 0;
    const swingPhase = reducedMotion ? 0 : (miningSwing?.phase ?? 0);
    const armor = ARMOR[player.armor];
    const heldItem = ITEMS[held];
    const weapon = attack?.kind ?? heldItem?.weapon?.id;

    function drawClimbArm(side, rung) {
      const far = side < 0;
      const [y, lift] = reducedMotion ? [far ? 6 : 10, 0] : climbStep(pixelY, 12, rung, rungGap * 2);
      const grip = rope ? gripCenter + side : clamp(side * 5, gripCenter - railReach, gripCenter + railReach);
      const hand = [grip + (rope ? -lift : side * lift), y];
      const elbow = [(side * shoulderX + hand[0]) / 2 + side * 2, 12 - (12 - y) * .35];
      bentArm([side * shoulderX, 11], elbow, hand, skin, shirt, far, ring);
    }

    function climbFoot(side, rung) {
      const [y, lift] = reducedMotion ? [side < 0 ? 22 : 20, 0] : climbStep(pixelY, 23, rung - 1, rungGap * 2);
      const boot = rope ? gripCenter + side * 2 : clamp(side * 4, gripCenter - railReach, gripCenter + railReach);
      return [boot + side * lift, Math.min(y, player.grounded ? 22 : 23)];
    }

    function drawFrontArm(restSwing, restY) {
      if (player.beastDrinkTime > 0) {
        // Raise the flask to the mouth, tilt it during the sip, then lower it.
        const phase = clamp(1 - player.beastDrinkTime / .7, 0, 1);
        const lift = reducedMotion ? 1 : Math.min(1, phase / .25, (1 - phase) / .2);
        const hand = [shoulderX + 5 - 3 * lift, restY + 4 - 8 * lift];
        const elbow = [shoulderX + 4, restY + 3 - 2 * lift];
        bentArm([shoulderX, restY], elbow, hand, skin, shirt, false, ring);
        ctx.save();
        ctx.translate(Math.round(hand[0]), Math.round(hand[1] - 2));
        ctx.rotate(-lift * .65);
        rect(-2,-5,4,2,'#c8b58d'); rect(-1,-3,2,2,'#d6ddd0');
        rect(-3,-1,6,6,'#202f35'); rect(-2,0,4,4,'#a4dd72');
        rect(-2,0,1,3,'#ecf8c6'); rect(1,2,1,2,'#58854a');
        ctx.restore();
      } else if (attack || (weapon && !miningSwing)) {
        weaponArm(shoulderX, shoulderY, weapon, attack, swimming, tilt, skin, shirt, hasArrow, reducedMotion, ring);
      } else if (miningSwing) {
        miningArm(shoulderX, shoulderY, Math.abs(targetX), targetY, tilt, swingPhase, skin, shirt, miningSwing.tier, ring);
      } else if (heldItem?.pickaxe) {
        carryPickaxe(shoulderX, shoulderY, -armSwing, tilt, skin, shirt, heldItem.pickaxe, swimming, crawling, ring);
      } else {
        arm(shoulderX, restY, restSwing, skin, shirt, false, ring);
      }
    }

    ctx.save();
    const flashTimer = player.hurt > 0 ? player.hurt : (player.confusedGrace ?? 0);
    if (flashTimer > 0 && Math.floor(flashTimer * 14) % 2 === 1) ctx.globalAlpha = 0.65;
    const jitter = (player.stun ?? 0) > 0 && !reducedMotion ? Math.round(Math.sin(time * 48)) : 0;
    ctx.translate(Math.round(player.x) + jitter, pixelY);
    const drawElectricStun = (cy) => {
      if (!((player.stun ?? 0) > 0)) return;
      const tick = Math.floor(time * 24);
      if (tick % 4 === 0) {
        rect(-6, cy - 10, 12, 20, tick % 8 === 0 ? '#ffe44d38' : '#38bdf838');
      }
      for (let b = 0; b < 3; b++) {
        const isBlue = (b + tick) % 2 === 1;
        const color = isBlue ? '#38bdf8' : '#ffe44d';
        const core = isBlue ? '#7dd3fc' : '#fff4a3';
        const startY = cy - 8 + b * 6;
        let prev = [-8, startY];
        for (let s = 1; s <= 4; s++) {
          const next = [
            -8 + s * 4,
            Math.round(startY + Math.sin(time * 42 + b * 2.1 + s * 2.9) * 3),
          ];
          pixelLine(prev, next, 1, color);
          if (s % 2 === 0) rect(next[0], next[1], 1, 1, core);
          prev = next;
        }
      }
      for (let i = 0; i < 8; i++) {
        const spark = time * 16 + i * 0.78;
        const sx = Math.round(Math.cos(spark) * 9);
        const sy = Math.round(cy + Math.sin(spark * 1.3) * 10);
        rect(sx, sy, 2, 1, i % 2 ? '#38bdf8' : '#ffe44d');
        rect(sx + 1, sy - 1, 1, 2, i % 2 ? '#fff4a3' : '#7dd3fc');
      }
    };
    ctx.scale(facing, 1);
    const enlargedArms = player.spinachTime > 0 || player.beastTime > 0;
    const drawMuscles = (y) => {
      if(enlargedArms) {
        const w=player.beastTime>0?5:4;
        rect(-shoulderX-w,y,w,6,skin.shadow ?? skin.dark ?? '#9e795c');
        rect(shoulderX+2,y,w,6,skin.base ?? '#c99f7d');
        rect(shoulderX+2,y,w,1,skin.light ?? '#e3b998');
        if(player.beastTime>0) {rect(-5,y-3,11,3,'#78634a');rect(-5,y-4,2,2,'#e8d6af');rect(4,y-4,2,2,'#e8d6af');}
      }
      if(player.skillBonuses?.confusingTouch && !(player.wardenCooldowns?.confusingTouch>0)) {
        const drop=Math.floor(time*14)%5;
        rect(shoulderX+4,y+5+drop,1,2,'#7dcc65');
        rect(shoulderX+3,y+4,2,2,'#b2e97b');
      }
    };
    if (crawling) {
      const shuffle = Math.round(armSwing * 0.4);
      if (feetGear) {
        const [finShade, finMain, finLight] = feetGear.colors;
        rect(-8 - shuffle, 13, 7, 3, finShade);
        rect(-7 - shuffle, 13, 5, 2, finMain);
        rect(-7 - shuffle, 13, 2, 1, finLight);
      } else {
        rect(-6 - shuffle, 13, 5, 3, sole);
      }
      rect(-5 - shuffle, 13, 3, 2, pants.back);
      rect(-5, 11, 6, 4, pants.front);
      rect(-6, 7, shoulder, 6, shirt.wet);
      rect(-5, 8, shoulder - 2, 4, swimming ? shirt.wet : shirt.base);
      rect(-5, 8, shoulder - 3, 1, shirt.light);
      if (armor) chestArmor(-6, 7, shoulder, armor);
      head(hairStyles[appearance.hair], hair, skin, 3, 2, Math.sign(shuffle));
      if (gear) divingSnorkel(3, 2, gear);
      drawFrontArm(2 - shuffle, 9);
      drawMuscles(9);
      drawElectricStun(12);
      ctx.restore();
      return;
    }
    if (swimming && (!climb || attack || miningSwing)) ctx.rotate(tilt);
    leg([-2, 17], climb ? climbFoot(-1, firstRung) : farFoot, pants, true, swimming && !climb, feetGear);
    if (strideWeight) leg([1, 17], nearFoot, pants, false, swimming, feetGear);
    if (climb) drawClimbArm(-1, secondRung);
    else arm(-shoulderX, 11, swimming ? 1 - kick : armSwing, skin, shirt, true);

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
    if (!strideWeight) leg([1, 17], climb ? climbFoot(1, secondRung) : nearFoot, pants, false, swimming && !climb, feetGear);
    head(hairStyles[appearance.hair], hair, skin, 0, 0, swimming ? -Math.sign(kick) : 0);
    if (gear) divingSnorkel(0, 0, gear);
    rect(-2, 9, 5, 1, '#efc48d');
    rect(-2, 10, 2, 1, '#b4755a');

    if (armor) chestArmor(-(shoulder - 1) / 2, 10, shoulder, armor);
    if (climb && !attack && !miningSwing && !(player.beastDrinkTime > 0)) drawClimbArm(1, firstRung);
    else drawFrontArm(swimming ? 4 + Math.sign(kick) : -armSwing, 11);
    drawMuscles(11);

    if (swimming) {
      for (let i = 0; i < 3; i++) {
        const rise = (time * 18 + i * 9) % 27;
        const x = 7 + Math.sin(rise * .27 + i) * 3;
        rect(x, 5 - rise, 2, 1, '#a1d9cb');
        rect(x - 1, 6 - rise, 1, 1, '#7ebdbb');
      }
    }
    drawElectricStun(10);
    ctx.restore();
  };
}
