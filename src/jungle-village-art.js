import { spearCannibalThrust } from './gameplay/enemies/cannibal.js';

function drawHut(rect, polygon, x, y, chief) {
  const halfW = chief ? 26 : 19;
  const wallH = chief ? 24 : 19;
  const roofH = chief ? 20 : 15;
  const stiltH = 4;
  const wallTop = y - stiltH - wallH;

  // Timber stilts & deck platform.
  rect(x - halfW + 2, y - stiltH, 3, stiltH, '#4f3626');
  rect(x + halfW - 5, y - stiltH, 3, stiltH, '#4f3626');
  rect(x - 2, y - stiltH, 4, stiltH, '#5e402d');
  rect(x - halfW - 1, y - stiltH - 2, halfW * 2 + 2, 3, '#6b4c35');
  rect(x - halfW, y - stiltH - 2, halfW * 2, 1, '#9d7557');

  // Woven bamboo hut walls.
  rect(x - halfW + 3, wallTop, (halfW - 3) * 2, wallH, '#7d5f3e');
  for (let row = wallTop + 3; row < y - stiltH - 2; row += 4) {
    rect(x - halfW + 3, row, (halfW - 3) * 2, 1, '#5d442b');
  }
  rect(x - halfW + 3, wallTop, 3, wallH, '#553a24');
  rect(x + halfW - 6, wallTop, 3, wallH, '#553a24');

  // Dark arched doorway.
  const doorW = chief ? 12 : 9;
  const doorH = chief ? 16 : 13;
  rect(x - Math.floor(doorW / 2) - 1, y - stiltH - 2 - doorH - 1, doorW + 2, doorH + 1, '#4a3220');
  rect(x - Math.floor(doorW / 2), y - stiltH - 2 - doorH, doorW, doorH, '#161b20');

  // Steep layered palm-thatch roof.
  const peakY = wallTop - roofH;
  polygon(
    [
      [x - halfW - 6, wallTop + 3],
      [x, peakY],
      [x + halfW + 6, wallTop + 3],
    ],
    '#5e4e2a',
  );
  polygon(
    [
      [x - halfW - 4, wallTop + 1],
      [x, peakY + 2],
      [x + halfW + 4, wallTop + 1],
    ],
    '#876f3b',
  );
  polygon(
    [
      [x - halfW - 2, wallTop - 1],
      [x, peakY + 3],
      [x + 2, wallTop - 1],
    ],
    '#a98d4b',
  );
  // Crossed ridge poles & tribal mask emblem on chief hut.
  rect(x - 4, peakY - 4, 2, 6, '#6b4c35');
  rect(x + 2, peakY - 4, 2, 6, '#6b4c35');
  rect(x - 1, peakY - 6, 2, 5, '#d95c48');
  if (chief) {
    rect(x - 3, wallTop + 3, 6, 5, '#b84839');
    rect(x - 2, wallTop + 4, 2, 2, '#f1f3e5');
    rect(x + 1, wallTop + 4, 2, 2, '#f1f3e5');
  }
}

function drawTotem(rect, x, y) {
  rect(x - 5, y - 34, 10, 34, '#543828');
  rect(x - 4, y - 34, 8, 34, '#745038');
  rect(x - 3, y - 33, 2, 32, '#946a49');
  // Top feathered crest & carved faces.
  rect(x - 7, y - 37, 14, 3, '#c8503c');
  rect(x - 4, y - 40, 8, 3, '#e6b86a');
  rect(x - 5, y - 30, 10, 7, '#3c261b');
  rect(x - 4, y - 28, 3, 2, '#f1f3e5');
  rect(x + 1, y - 28, 3, 2, '#f1f3e5');
  rect(x - 2, y - 25, 4, 2, '#d95c48');
  rect(x - 5, y - 18, 10, 7, '#3c261b');
  rect(x - 4, y - 16, 3, 2, '#f0c88b');
  rect(x + 1, y - 16, 3, 2, '#f0c88b');
  rect(x - 3, y - 13, 6, 2, '#c8503c');
}

function drawSpearRack(rect, x, y) {
  rect(x - 8, y - 16, 2, 16, '#5e402d');
  rect(x + 6, y - 16, 2, 16, '#5e402d');
  rect(x - 9, y - 12, 18, 2, '#855b42');
  for (const sx of [-5, 0, 5]) {
    rect(x + sx, y - 22, 1, 21, '#9d7557');
    rect(x + sx - 1, y - 25, 3, 3, '#b8c4c7');
    rect(x + sx, y - 27, 1, 2, '#e2e9eb');
  }
}

function drawCampfire(rect, x, y, time) {
  // Stone pit ring & crossed logs.
  rect(x - 8, y - 3, 16, 3, '#414f55');
  rect(x - 6, y - 4, 12, 2, '#627379');
  rect(x - 6, y - 5, 12, 2, '#4d3324');
  rect(x - 4, y - 6, 8, 2, '#734b34');
  // Flickering flames & ember sparks.
  const flicker = Math.round(Math.sin(time * 13 + x) * 2);
  const rise = Math.round((time * 18) % 12);
  rect(x - 4, y - 12 - Math.max(0, flicker), 8, 7 + Math.max(0, flicker), '#d95c48');
  rect(x - 3, y - 14 + Math.min(0, flicker), 6, 8, '#f09c46');
  rect(x - 2, y - 10, 4, 5, '#ffe17d');
  rect(x - 1 + flicker, y - 16 - rise, 2, 2, '#ffe17d');
  rect(x + 2 - flicker, y - 20 - ((rise + 5) % 12), 2, 2, '#8b9ca355');
}

export function drawJungleVillageStructure(rect, polygon, kind, x, y, time) {
  if (kind === 'chief-hut') drawHut(rect, polygon, x, y, true);
  else if (kind === 'hut') drawHut(rect, polygon, x, y, false);
  else if (kind === 'totem') drawTotem(rect, x, y);
  else if (kind === 'spear-rack') drawSpearRack(rect, x, y);
  else if (kind === 'campfire') drawCampfire(rect, x, y, time);
}

export function drawCannibal(ctx, rect, polygon, mob, time) {
  const airborne = mob.grounded === false;
  const moving = !airborne && Math.abs(mob.dx) > 2;
  const spear = mob.kind === 'cannibal-spear';
  const running = spear && Math.abs(mob.dx) > 45;
  const stride = moving ? Math.round(Math.sin(time * (running ? 20 : 12) + mob.phase) * (running ? 3 : 2)) : 0;
  const bob = airborne ? (mob.dy < -30 ? 2 : 1)
    : moving ? Math.abs(Math.round(Math.cos(time * (running ? 20 : 12) + mob.phase))) : 0;
  const windingUp = mob.windup > 0;
  const skinShade = '#6b4430';
  const skin = '#936044';
  const skinLight = '#b57b5a';
  const hair = '#261c1a';
  const wrapDark = '#5e4e2a';
  const wrap = '#876f3b';
  const wrapLight = '#a98d4b';
  const paint = '#d95c48';
  const paintDark = '#9e382b';
  const bone = '#f1f3e5';

  ctx.scale(mob.facing, 1);

  // Back arm.
  rect(-5 - Math.round(stride * 0.6), -15 - bob, 3, 5, skinShade);

  // Legs & bare feet.
  if (airborne) {
    const tuck = mob.dy < -30 ? 2 : 1;
    rect(-4, -6 - tuck, 3, 4, skinShade);
    rect(-5, -3 - tuck, 4, 2, skinShade);
    rect(2, -7 - tuck, 3, 4, skin);
    rect(2, -4 - tuck, 4, 2, skinLight);
  } else {
    rect(-4 - stride, -6, 3, 5, skinShade);
    rect(-5 - stride, -2, 4, 2, skinShade);
    rect(1 + stride, -6, 3, 5, skin);
    rect(1 + stride, -2, 4, 2, skinLight);
  }

  // Woven leaf waist wrap & crimson sash.
  rect(-5, -10 - bob, 10, 4, wrap);
  rect(-5, -10 - bob, 10, 1, paintDark);
  rect(-4, -7 - bob, 2, 2, wrapDark);
  rect(0, -7 - bob, 2, 2, wrapLight);
  rect(3, -7 - bob, 2, 2, wrapDark);

  // Bare torso with bone necklace & tribal war paint.
  rect(-4, -16 - bob, 8, 6, skin);
  rect(-4, -16 - bob, 2, 6, skinShade);
  rect(1, -15 - bob, 2, 4, skinLight);
  rect(-2, -16 - bob, 1, 1, bone);
  rect(0, -15 - bob, 1, 1, bone);
  rect(2, -16 - bob, 1, 1, bone);
  rect(-3, -13 - bob, 6, 1, paint);
  rect(-1, -12 - bob, 4, 1, bone);

  // Head, wild hair, fierce eyes & variant headdress.
  rect(-6, -23 - bob, 3, 7, hair);
  rect(-4, -23 - bob, 8, 7, skin);
  rect(-4, -23 - bob, 2, 7, skinShade);
  rect(-4, -24 - bob, 8, 2, hair);
  rect(-1, -21 - bob, 5, 1, hair);
  rect(0, -20 - bob, 2, 2, '#161b20');
  rect(3, -20 - bob, 2, 2, '#161b20');
  rect(1, -20 - bob, 1, 1, bone);
  rect(4, -20 - bob, 1, 1, bone);

  if (spear) {
    rect(-1, -18 - bob, 5, 1, paint);
    rect(1, -19 - bob, 1, 2, bone);
    rect(-2, -27 - bob, 2, 3, paint);
    rect(1, -26 - bob, 2, 2, '#e6b86a');

    const phase = mob.spearThrust == null ? null : Math.min(1, mob.spearThrust / 0.4);
    const thrust = phase == null ? (running ? 2 : 0) : spearCannibalThrust(phase);
    rect(0, -14 - bob, 5 + Math.max(0, Math.round(thrust * 0.4)), 3, skinLight);

    const sx = -7 + thrust;
    const sy = -13 - bob;
    rect(sx, sy, 21, 2, '#855b42');
    rect(sx + 2, sy, 17, 1, '#d29c65');
    rect(sx + 15, sy - 1, 2, 3, paint);
    rect(sx + 17, sy - 1, 4, 4, '#6e888a');
    rect(sx + 18, sy, 5, 2, '#b8c4c7');
    rect(sx + 21, sy, 3, 1, '#e2e9eb');
    if (phase != null && phase >= 0.28 && phase <= 0.65) {
      rect(sx + 12, sy - 1, 7, 1, '#f4d4a5a8');
    }
  } else {
    rect(-4, -23 - bob, 9, 2, '#3b7a4b');
    rect(-2, -23 - bob, 5, 1, '#68b064');
    rect(0, -18 - bob, 4, 1, '#e6b86a');
    rect(-4, -26 - bob, 3, 2, paint);
    rect(-5, -27 - bob, 2, 1, '#e6b86a');

    rect(1, -14 - bob, 5, 2, skinLight);
    const bowX = windingUp ? 10 : 8;
    polygon(
      [
        [bowX - 2, -20 - bob],
        [bowX + 2, -17 - bob],
        [bowX + 2, -10 - bob],
        [bowX - 2, -7 - bob],
        [bowX + 1, -11 - bob],
        [bowX + 1, -16 - bob],
      ],
      '#855b42',
    );
    rect(bowX + 1, -17 - bob, 1, 8, '#d29c65');
    rect(bowX - 2 - (windingUp ? 2 : 0), -19 - bob, 1, 11, '#ccc0b1');
    if (windingUp) {
      rect(bowX - 4, -14 - bob, 11, 1, '#d29c65');
      rect(bowX + 6, -15 - bob, 3, 3, '#b8c4c7');
      rect(bowX - 5, -15 - bob, 2, 3, paint);
    }
  }
}

export function drawNativeShaman(ctx, rect, polygon, mob, time) {
  const moving = Math.abs(mob.dx) > 2;
  const stride = moving ? Math.round(Math.sin(time * 11 + (mob.phase ?? 0)) * 2) : 0;
  const bob = moving ? Math.abs(Math.round(Math.cos(time * 11 + (mob.phase ?? 0)))) : 0;
  const windingUp = mob.windup > 0;
  const skinShade = '#633e2b';
  const skin = '#8c5a3e';
  const cloakDark = '#3a2645';
  const cloak = '#563961';
  const bone = '#ece3c8';
  const boneShade = '#b5ab92';
  const emerald = '#5ee67d';

  ctx.scale(mob.facing, 1);

  // Legs & bone anklets
  rect(-4 - stride, -6, 3, 6, skinShade);
  rect(2 + stride, -6, 3, 6, skin);
  rect(-4 - stride, -3, 3, 1, bone);
  rect(2 + stride, -3, 3, 1, bone);

  // Layered shaman cloak & waist fetish wrap
  polygon([[-6, -4 - bob], [-5, -16 - bob], [4, -16 - bob], [5, -4 - bob]], cloakDark);
  rect(-4, -15 - bob, 7, 10, cloak);
  rect(-2, -13 - bob, 4, 2, emerald);
  rect(-5, -10 - bob, 10, 2, '#9c7b49');

  // Horned tribal skull mask & feathers
  rect(-5, -24 - bob, 9, 8, skinShade);
  rect(-4, -23 - bob, 8, 7, bone);
  rect(0, -21 - bob, 2, 2, '#17211d');
  rect(3, -21 - bob, 2, 2, '#17211d');
  rect(1, -21 - bob, 1, 1, '#a9ff9e');
  rect(4, -21 - bob, 1, 1, '#a9ff9e');
  rect(-1, -18 - bob, 5, 2, boneShade);
  // Horned crest
  polygon([[-5, -23 - bob], [-8, -28 - bob], [-3, -25 - bob]], boneShade);
  polygon([[1, -24 - bob], [4, -29 - bob], [4, -23 - bob]], bone);
  rect(-3, -26 - bob, 2, 3, '#c8503c');

  // Staff arm & skull-topped totem staff glowing with green flame
  const raise = windingUp ? -4 : 0;
  rect(1, -14 - bob + Math.round(raise * 0.5), 5, 2, skin);
  rect(6, -24 - bob + raise, 2, 23 - raise, '#734b34');
  rect(6, -22 - bob + raise, 2, 2, '#b84839');
  // Floating green-flamed skull atop staff
  const flame = Math.round(Math.sin(time * 13 + (mob.phase ?? 0)) * 1.5);
  rect(4, -31 - bob + raise + flame, 6, 7, windingUp ? '#78ffa044' : '#50d17428');
  rect(5, -29 - bob + raise, 5, 5, bone);
  rect(6, -28 - bob + raise, 1, 1, '#1b2b20');
  rect(8, -28 - bob + raise, 1, 1, '#1b2b20');
  rect(6, -32 - bob + raise + Math.min(0, flame), 3, 3, emerald);
  if (windingUp) rect(5, -34 - bob + raise - Math.abs(flame), 5, 3, '#b8ffb8');
}
