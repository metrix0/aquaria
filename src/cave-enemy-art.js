import { CLAW_SLASH_DURATION } from './gameplay/enemies/frog-cultist.js';
import { GREATSWORD_SWING_DURATION } from './gameplay/enemies/greatsword-skeleton.js';
import { pickaxePose } from './gameplay/melee.js';
import { drawPickaxe } from './pickaxe-art.js';

function drawFrogCultist(rect, polygon, mob, time) {
  const praying = Boolean(mob.praying && !mob.cultAggro);
  const leaping = !praying && mob.grounded === false;
  const crouching = !praying && !leaping && (mob.leapCooldown ?? 0) > 0 && Math.abs(mob.dx) < 2;
  const slashing = mob.clawSlash != null;
  const moving = !praying && !leaping && Math.abs(mob.dx) > 2;
  const stride = moving ? Math.round(Math.sin(time * 12 + mob.phase) * 2.5) : 0;
  const chant = praying ? Math.sin(time * 3.4 + mob.phase) : 0;

  const dark = '#243a24';
  const skin = '#4a703e';
  const ridge = '#6f9751';
  const belly = '#9fb673';
  const robe = '#512e58';
  const robeTrim = '#7b4982';
  const claw = '#e2dcc4';
  const eye = praying ? '#a3bf67' : '#ffcf54';

  const bodyDrop = praying ? 5 + Math.round(Math.max(0, chant)) : crouching ? 3 : leaping ? -1 : 0;
  const lean = praying ? 3 : leaping ? 4 : crouching ? 2 : 0;

  // Webbed clawed feet / kneeling calves / leaping hind legs
  if (praying) {
    rect(-8, -5, 11, 5, dark);
    rect(-6, -6, 9, 4, skin);
    rect(1, -3, 7, 3, dark);
    rect(2, -2, 6, 2, ridge);
  } else if (leaping) {
    const kick = mob.dy < -20 ? 1 : -1;
    polygon([[-6, -9], [-12, -3 + kick], [-15, 0 + kick], [-10, 0 + kick], [-4, -6]], dark);
    polygon([[-4, -8], [-10, -2 + kick], [-12, -1 + kick], [-3, -5]], skin);
    rect(-15, -1 + kick, 5, 2, claw);
    rect(2, -8, 5, 4, skin);
    rect(5, -6, 4, 2, ridge);
  } else if (crouching) {
    rect(-7, -5, 6, 5, dark);
    rect(-1, -5, 6, 5, skin);
    rect(-9, -2, 7, 2, ridge);
    rect(1, -2, 7, 2, claw);
  } else {
    rect(-6 - stride, -7, 4, 6, dark);
    rect(2 + stride, -7, 4, 6, skin);
    rect(-8 - stride, -2, 7, 2, ridge);
    rect(1 + stride, -2, 7, 2, claw);
  }

  // Hunched amphibious torso & tattered purple cultist vestment
  rect(-7 + lean * 0.4, -20 + bodyDrop, 13, 14, dark);
  rect(-6 + lean * 0.4, -19 + bodyDrop, 11, 12, skin);
  rect(-1 + lean * 0.4, -17 + bodyDrop, 5, 9, belly);
  // Dorsal spines
  rect(-8 + lean * 0.4, -18 + bodyDrop, 2, 3, ridge);
  rect(-8 + lean * 0.4, -13 + bodyDrop, 2, 3, ridge);
  // Cultist loincloth & stole
  rect(-5 + lean * 0.4, -10 + bodyDrop, 10, 5, robe);
  rect(-2 + lean * 0.4, -10 + bodyDrop, 4, 6, robeTrim);

  // Broad monstrous frog head & puffing throat sac
  const headX = -3 + lean;
  const headY = -28 + bodyDrop;
  rect(headX - 2, headY + 2, 12, 9, dark);
  rect(headX - 1, headY + 1, 11, 8, skin);
  // Swelling vocal sac while chanting or leaping
  const sacExpand = praying ? Math.round((chant + 1) * 1.2) : leaping ? 1 : 0;
  rect(headX + 2, headY + 7, 6 + sacExpand, 3 + Math.min(2, sacExpand), belly);

  // Bulging frog eye bumps & amber eyes
  rect(headX + 1, headY - 2, 4, 4, ridge);
  rect(headX + 6, headY - 2, 4, 4, ridge);
  rect(headX + 2, headY - 1, 2, 2, eye);
  rect(headX + 7, headY - 1, 2, 2, eye);
  rect(headX + 3, headY - 1, 1, 2, '#141f14');

  // Fanged frog mouth
  rect(headX + 4, headY + 5, 7, 2, '#2a181d');
  rect(headX + 6, headY + 5, 1, 1, claw);
  rect(headX + 9, headY + 5, 1, 1, claw);

  // Clawed arms
  if (praying) {
    rect(headX + 4, headY + 11, 6, 3, skin);
    rect(headX + 9, headY + 8, 3, 5, ridge);
    rect(headX + 10, headY + 6, 2, 2, claw);
  } else if (slashing) {
    const phase = Math.min(1, mob.clawSlash / CLAW_SLASH_DURATION);
    const sweep = -16 + Math.round(phase * 14);
    polygon([[2, -16], [10, sweep - 2], [13, sweep + 2], [4, -12]], skin);
    rect(12, sweep - 2, 5, 2, claw);
    rect(12, sweep + 1, 4, 2, claw);
    if (phase >= 0.22 && phase <= 0.78) {
      polygon([[10, -24], [22, -14], [18, -3], [14, -7], [17, -14], [8, -21]], '#d8f5aa');
    }
  } else {
    const armY = -16 + bodyDrop;
    rect(2 + lean, armY, 7, 3, skin);
    rect(8 + lean, armY + 1, 4, 2, ridge);
    rect(11 + lean, armY, 3, 1, claw);
    rect(11 + lean, armY + 2, 3, 1, claw);
  }
}

function drawJungleWorm(ctx, rect, polygon, mob, time) {
  const segments = mob.segments?.length ? mob.segments : [{ x: mob.x, y: mob.y, angle: mob.angle ?? 0 }];
  const chomp = mob.aggroTimer > 0 ? Math.abs(Math.sin(time * 9 + (mob.phase ?? 0))) * 2.5 : 0.6;

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    ctx.save();
    ctx.translate(Math.round(seg.x - mob.x), Math.round(seg.y - mob.y));
    ctx.rotate(seg.angle ?? 0);

    if (i === segments.length - 1) {
      // Tapered spiky burrow tail
      polygon([[-9, 0], [-2, -6], [6, -5], [6, 5], [-2, 6]], '#382633');
      polygon([[-7, 0], [-1, -4], [5, -4], [5, 4], [-1, 4]], '#5e4352');
      rect(-3, -2, 6, 4, '#9c7b59');
      rect(-8, -1, 4, 2, '#c7a772');
    } else if (i > 0) {
      const taper = Math.max(0.74, 1 - i * 0.022);
      ctx.scale(taper, taper);
      const wiggle = (i % 2 ? 1 : -1) * Math.round(Math.sin(time * 12 + i * 0.9) * 1.2);
      // Side crawling bristles
      rect(-2, -9 + wiggle, 4, 2, '#9c7b59');
      rect(-2, 7 - wiggle, 4, 2, '#9c7b59');
      // Armored ring segment with mossy chitin ridges
      rect(-7, -7, 14, 14, '#382633');
      rect(-6, -6, 12, 12, i % 2 === 0 ? '#5d4252' : '#533b4a');
      rect(-5, -5, 10, 4, '#876866');
      rect(-4, -3, 7, 6, '#b39463');
      rect(-2, -1, 4, 2, '#d4b885');
      if (i % 3 === 1) rect(-4, 2, 4, 3, '#4c7b45');
    } else {
      // Head carapace & snapping pincer mandibles
      polygon([[4, -6 - chomp], [13, -3 - chomp * 0.7], [10, -1], [4, -2]], '#c9bc9f');
      polygon([[4, 6 + chomp], [13, 3 + chomp * 0.7], [10, 1], [4, 2]], '#c9bc9f');
      rect(6, -4 - chomp * 0.6, 5, 2, '#eee3cb');
      rect(6, 2 + chomp * 0.6, 5, 2, '#eee3cb');
      rect(-8, -8, 15, 16, '#33202d');
      rect(-7, -7, 13, 14, '#6b4b5a');
      rect(-6, -6, 10, 5, '#967470');
      rect(-5, -3, 8, 6, '#b89662');
      rect(-3, -6, 4, 3, '#4c7b45');
      // Predatory amber eyes
      rect(1, -5, 3, 2, '#1a1118');
      rect(1, 3, 3, 2, '#1a1118');
      rect(2, -5, 2, 2, '#f7d06b');
      rect(2, 3, 2, 2, '#f7d06b');
    }
    ctx.restore();
  }
}

function drawCaveFrog(rect, polygon, mob, time) {
  const airborne = mob.grounded === false;
  const mouthOpen = mob.windup > 0 || Boolean(mob.tongue) || (mob.biteTimer ?? 0) > 0;
  const dark = '#244535';
  const skin = '#3f7352';
  const ridge = '#68a169';
  const belly = '#b1c799';
  const mouth = '#7a2237';
  const hopLift = airborne ? (mob.dy < -30 ? 3 : 1) : 0;

  // Elastic pink tongue stretching from mouth to world tip (rendered unflipped relative to facing)
  if (mob.tongue) {
    const localMouthX = 7;
    const localMouthY = -10;
    const tipX = (mob.tongue.tipX - mob.x) * mob.facing;
    const tipY = mob.tongue.tipY - mob.y;
    const dx = tipX - localMouthX;
    const dy = tipY - localMouthY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 1.8;
    const ny = (dx / len) * 1.8;
    polygon([
      [localMouthX + nx, localMouthY + ny],
      [tipX + nx * 0.7, tipY + ny * 0.7],
      [tipX - nx * 0.7, tipY - ny * 0.7],
      [localMouthX - nx, localMouthY - ny],
    ], '#d9647d');
    rect(tipX - 3, tipY - 3, 6, 6, '#f58ca3');
  }

  // Heavy muscular hind jumping legs
  if (airborne) {
    polygon([[-12, -4], [-5, -12], [0, -7], [-8, -1]], skin);
    rect(-15, -3, 6, 2, ridge);
  } else {
    polygon([[-10, -10], [-3, -10], [-1, -2], [-9, -2]], dark);
    polygon([[-9, -11], [-2, -11], [-3, -3], [-10, -3]], skin);
    rect(-12, -2, 8, 2, ridge);
  }

  // Squat cave toad body & warty crest
  rect(-7, -14 - hopLift, 14, 11, dark);
  rect(-6, -15 - hopLift, 13, 10, skin);
  rect(0, -10 - hopLift, 7, 5, belly);
  rect(-5, -16 - hopLift, 7, 2, ridge);

  // Forelegs
  rect(4, -7 - hopLift, 3, 7 + hopLift, skin);
  rect(5, -2, 5, 2, ridge);

  // Broad hinged frog head & mouth
  if (mouthOpen) {
    // Open upper & lower jaw revealing crimson maw and fangs
    rect(1, -18 - hopLift, 10, 6, skin);
    rect(3, -13 - hopLift, 9, 5, mouth);
    rect(2, -9 - hopLift, 10, 3, skin);
    rect(4, -8 - hopLift, 7, 2, belly);
    rect(9, -13 - hopLift, 2, 2, '#ede4cb');
    rect(9, -10 - hopLift, 2, 1, '#ede4cb');
    // Bulging golden eye
    rect(3, -20 - hopLift, 4, 4, ridge);
    rect(4, -19 - hopLift, 2, 2, '#ffcf54');
  } else {
    const throat = Math.round(Math.sin(time * 4 + (mob.phase ?? 0)) * 0.8);
    rect(1, -16 - hopLift, 10, 8, skin);
    rect(3, -10 - hopLift, 7, 3 + Math.max(0, throat), belly);
    rect(4, -12 - hopLift, 7, 1, dark);
    rect(3, -18 - hopLift, 4, 4, ridge);
    rect(4, -17 - hopLift, 2, 2, '#f2b354');
    rect(5, -17 - hopLift, 1, 2, '#1b1d14');
  }
}

function drawMimic(ctx, rect, mob, time) {
  const frame = '#332c30';
  const iron = '#716f65';
  const edge = '#b5aa87';

  if (!mob.awakened) {
    // Disguised mimic matches closed chest pixels identically.
    rect(-9, -16, 18, 2, frame);
    rect(-11, -14, 22, 7, frame);
    rect(-9, -14, 18, 5, '#ac7649');
    rect(-8, -14, 16, 2, '#d0a06a');
    rect(-8, -10, 16, 1, '#81513d');
    rect(-8, -14, 2, 5, iron);
    rect(6, -14, 2, 5, iron);

    rect(-11, -8, 22, 8, frame);
    rect(-9, -7, 18, 6, '#935c3e');
    rect(-9, -7, 18, 2, '#b27b4c');
    rect(-9, -3, 18, 1, '#784532');
    for (const band of [-8, 6]) {
      rect(band, -7, 2, 6, iron);
      rect(band, -6, 1, 1, edge);
    }
    rect(-2, -9, 4, 5, '#bc8b56');
    rect(-1, -8, 2, 1, '#edd09a');
    rect(0, -6, 1, 1, frame);
    return;
  }

  const biting = (mob.biteTimer ?? 0) > 0;
  const chomp = biting
    ? Math.max(0.08, Math.sin((mob.biteTimer / 0.34) * Math.PI))
    : mob.grounded === false
      ? 0.88
      : 0.34 + Math.max(0, Math.sin(time * 9 + mob.phase)) * 0.35;
  const bob = mob.grounded ? Math.round(Math.sin(time * 14 + mob.phase) * 0.6) : 0;

  // Lower chest jaw
  rect(-11, -8 + bob, 22, 8 - bob, frame);
  rect(-9, -7 + bob, 18, 6, '#935c3e');
  rect(-9, -7 + bob, 18, 2, '#b27b4c');
  rect(-9, -3 + bob, 18, 1, '#784532');
  for (const band of [-8, 6]) {
    rect(band, -7 + bob, 2, 6, iron);
    rect(band, -6 + bob, 1, 1, edge);
  }
  rect(-2, -7 + bob, 4, 4, '#bc8b56');
  rect(-1, -6 + bob, 2, 1, '#edd09a');

  // Dark maw & lolling fleshy tongue
  const mawLift = Math.round(chomp * 4);
  rect(-8, -9 - mawLift + bob, 16, 4 + mawLift, '#2b0d14');
  rect(-6, -8 - mawLift + bob, 12, 2 + mawLift, '#591a26');
  const tongueLen = Math.round(chomp * 5);
  if (tongueLen > 0) {
    rect(1, -6 + bob, 6, 2, '#c95763');
    rect(4, -5 + bob, tongueLen, 2, '#e8898e');
  }

  // Lower row of jagged fangs
  for (const fx of [-7, -2, 3, 7]) {
    rect(fx, -10 + bob, 2, 3, '#f2ebda');
    rect(fx, -8 + bob, 1, 1, '#c7baa3');
  }

  // Hinged upper lid & predatory eyes
  ctx.save();
  ctx.translate(-9, -8 + bob);
  ctx.rotate(-chomp * 0.62);
  rect(0, -8, 18, 2, frame);
  rect(-2, -6, 22, 7, frame);
  rect(0, -6, 18, 5, '#ac7649');
  rect(1, -6, 16, 2, '#d0a06a');
  rect(1, -2, 16, 1, '#81513d');
  rect(1, -6, 2, 5, iron);
  rect(15, -6, 2, 5, iron);
  // Glowing eyes under lid shadow
  rect(11, -3, 3, 2, '#ffcf54');
  rect(13, -3, 1, 2, '#ff6b4a');
  // Upper row of fangs
  for (const fx of [3, 8, 13, 17]) {
    rect(fx, 0, 2, 3, '#f2ebda');
  }
  ctx.restore();
}

export function drawCaveEnemy(ctx, rect, polygon, mob, time) {
  if (mob.kind === 'worm') {
    drawJungleWorm(ctx, rect, polygon, mob, time);
    return;
  }
  if (mob.kind === 'mimic') {
    if (mob.awakened) ctx.scale(mob.facing, 1);
    drawMimic(ctx, rect, mob, time);
    return;
  }
  if (mob.kind === 'cave-frog') {
    ctx.scale(mob.facing, 1);
    drawCaveFrog(rect, polygon, mob, time);
    return;
  }
  if (mob.kind === 'frog') {
    ctx.scale(mob.facing, 1);
    drawFrogCultist(rect, polygon, mob, time);
    return;
  }
  const moving = Math.abs(mob.dx) > 2;
  const stride = moving ? Math.round(Math.sin(time * (mob.dash > 0 ? 24 : 13) + mob.phase) * 2) : 0;
  const windingUp = mob.windup > 0;
  ctx.scale(mob.facing, 1);

  if (mob.kind === 'spider' || mob.kind === 'scorpion') {
    const scorpion = mob.kind === 'scorpion';
    const shell = scorpion ? '#735065' : '#524555';
    const edge = scorpion ? '#b28783' : '#826c76';
    const back = scorpion ? 8 : 6;
    for (let i = 0; i < 4; i++) {
      const x = -back + i * 4;
      const step = i % 2 ? stride : -stride;
      polygon([[x, -6], [x - 3, -4], [x - 4 + step, -1], [x - 2 + step, -1], [x, -4], [x + 2, -5]], edge);
    }
    rect(-back, -9, back + 6, 5, '#302735');
    rect(-back + 1, -10, back + 3, 5, shell);
    rect(-back + 2, -9, back - 1, 1, edge);
    rect(3, -8, 5, 4, shell);
    rect(5, -7, 2, 1, windingUp ? '#ffdcad' : '#e58d78');

    if (scorpion) {
      polygon([[-8, -6], [-13, -10], [-13, -16], [-8, -20], [-4, -19], [-3, -15], [-7, -16], [-10, -14], [-10, -11], [-5, -8]], edge);
      rect(-4, -16, 2, 2, windingUp ? '#dcf297' : '#9ebb79');
      rect(6, -6, 7, 3, edge);
      rect(11, -8, 4, 3, shell);
      rect(12, -3, 3, 2, shell);
    }
    return;
  }

  const archer = mob.kind === 'archer';
  const heavy = mob.kind === 'hammer';
  const greatsword = mob.kind === 'greatsword';
  if (greatsword) {
    drawGreatswordSkeleton(ctx, rect, polygon, mob, time, stride, moving);
    return;
  }
  const bone = heavy ? '#b5ae9e' : '#e3cfaf';
  const shade = '#918578';
  const cloth = heavy ? '#454151' : archer ? '#5e6363' : '#755652';
  if (heavy) ctx.scale(1.77, 1.71);

  rect(-5 - stride, -5, 4, 4, cloth);
  rect(2 + stride, -5, 4, 4, shade);
  rect(-6 - stride, -2, 5, 2, shade);
  rect(1 + stride, -2, 5, 2, bone);
  rect(-5, -16, 10, 11, cloth);
  rect(0, -15, 2, 8, bone);
  rect(-3, -14, 6, 1, shade);
  rect(-3, -11, 7, 1, bone);
  rect(-2, -8, 6, 1, shade);
  rect(-5, -23, 10, 7, shade);
  rect(-4, -24, 8, 7, bone);
  rect(0, -21, 2, 2, '#392f39');
  rect(4, -21, 1, 2, '#392f39');
  rect(-1, -17, 5, 2, bone);
  rect(-1, -18, 4, 1, shade);

  if (archer) {
    const bowX = windingUp ? 12 : 8;
    rect(3, -14, 5, 2, bone);
    polygon([[bowX - 2, -20], [bowX + 2, -17], [bowX + 2, -10], [bowX - 2, -7], [bowX + 1, -11], [bowX + 1, -16]], '#be9368');
    rect(bowX - 2, -19, 1, 11, '#ccc0b1');
    if (windingUp) rect(3, -14, 13, 1, '#e6ceaa');
  } else {
    rect(-7, -23, 13, 3, heavy ? '#656476' : '#9d784b');
    rect(-4, -25, 8, 3, heavy ? '#777789' : '#b69159');
    if (heavy) {
      ctx.translate(5, -13);
      ctx.rotate(windingUp ? -.64 : .44);
      rect(-1, -2, 2, 10, '#ae8463');
      rect(-5, -7, 10, 6, '#828494');
      rect(-5, -7, 10, 2, '#b7b5be');
    } else {
      ctx.translate(2, -12);
      const phase = mob.minerSwing == null ? 0 : mob.minerSwing / .44;
      ctx.rotate(pickaxePose(phase).angle);
      rect(-2, -2, 6, 4, cloth);
      rect(2, -1, 5, 3, bone);
      drawPickaxe(rect, 1);
    }
  }
}

function drawGreatswordBlade(rect, polygon) {
  rect(-4, -1, 2, 2, '#5a6370');
  rect(-2, -1, 3, 2, '#634435');
  rect(1, -4, 2, 8, '#6e7987');
  rect(1, -3, 1, 6, '#b7c2cc');
  rect(3, -2, 14, 4, '#6b7785');
  rect(3, -2, 14, 2, '#bcc7cf');
  rect(4, -1, 11, 1, '#e8eff2');
  polygon([[17, -2], [21, 0], [17, 2]], '#dce5ea');
}

function drawGreatswordSkeleton(ctx, rect, polygon, mob, time, stride, moving) {
  const bone = '#dfd6be';
  const boneHi = '#f0ead8';
  const shade = '#94887a';
  const cavity = '#261e24';
  const swing = mob.greatswordSwing;
  const winding = Boolean(swing && swing.windup > 0) || mob.windup > 0;
  const swinging = Boolean(swing && swing.windup === 0);

  ctx.scale(1.77, 1.71);

  // Bare leg bones & skeletal feet (no armor or cloth)
  rect(-4 - stride, -8, 2, 6, shade);
  rect(-5 - stride, -2, 4, 2, shade);
  rect(-4 - stride, -5, 2, 1, bone);
  rect(2 + stride, -8, 2, 6, bone);
  rect(2 + stride, -2, 5, 2, bone);
  rect(2 + stride, -5, 3, 1, boneHi);

  // Pelvis & exposed spine + open ribcage (unarmored skeleton)
  rect(-4, -10, 8, 2, bone);
  rect(-3, -9, 6, 1, shade);
  rect(-1, -17, 2, 8, shade);
  rect(-1, -16, 1, 6, bone);
  rect(-5, -17, 10, 2, bone);
  rect(-4, -17, 8, 1, boneHi);
  for (const ry of [-15, -13, -11]) {
    rect(-4, ry, 3, 1, bone);
    rect(1, ry, 3, 1, bone);
    rect(-3, ry + 1, 2, 1, cavity);
    rect(1, ry + 1, 2, 1, cavity);
  }

  // Bare skull with no helmet and one glowing crimson eye
  rect(-5, -24, 10, 6, shade);
  rect(-4, -25, 8, 7, bone);
  rect(-3, -25, 6, 2, boneHi);
  rect(-2, -18, 6, 2, bone);
  rect(0, -18, 1, 1, cavity);
  rect(2, -18, 1, 1, cavity);
  // Left/rear socket empty hollow, right/leading socket lit with one red eye
  rect(0, -22, 2, 2, cavity);
  rect(3, -22, 2, 2, winding || swinging ? '#ff3a3a' : '#d62229');
  rect(4, -22, 1, 1, '#ff8b82');

  // Greatsword pose: drags behind on the ground when idle/moving, cleaves front/back in swings
  let pivotX = -5;
  let pivotY = -10;
  let angle = Math.PI - Math.asin(0.5);
  if (swinging) {
    const progress = Math.min(1, swing.elapsed / GREATSWORD_SWING_DURATION);
    const front = swing.phase % 2 === 0;
    pivotX = front ? 3 : -3;
    pivotY = -15;
    angle = front ? -1.55 + progress * 1.95 : -1.6 - progress * 1.95;
    // Wide slash trail arc
    ctx.save();
    ctx.globalAlpha = 0.34 * (1 - progress * 0.45);
    ctx.strokeStyle = front ? '#e8eef2' : '#ff7b76';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (front) ctx.arc(pivotX, pivotY, 17, -1.55, angle);
    else ctx.arc(pivotX, pivotY, 17, angle, -1.6);
    ctx.stroke();
    ctx.restore();
    polygon([[-1, -16], [pivotX, pivotY], [pivotX - 1, pivotY + 2], [-1, -14]], bone);
  } else if (winding) {
    pivotX = -2;
    pivotY = -19;
    angle = -2.2;
    polygon([[0, -16], [-2, -20], [-4, -19], [-1, -14]], bone);
  } else {
    // Dragging on ground behind skeleton when idle or walking
    const bounce = moving ? Math.abs(Math.sin(time * 16 + mob.phase)) * -0.045 : 0;
    angle += bounce;
    polygon([[-2, -16], [-5, -10], [-3, -9], [0, -15]], bone);
    if (moving) {
      rect(-22, -1, 2, 1, '#e6bf86');
      rect(-20, -2, 1, 1, '#cfd7de');
    }
  }

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  drawGreatswordBlade(rect, polygon);
  ctx.restore();
}
