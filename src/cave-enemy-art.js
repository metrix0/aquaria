import { pickaxePose } from './gameplay/melee.js';
import { drawPickaxe } from './pickaxe-art.js';

function drawFrogCultist(rect, polygon, mob, time) {
  const praying = Boolean(mob.praying && !mob.cultAggro);
  const biting = mob.dash > 0 || (mob.windup > 0 && mob.attackMode === 'bite');
  const slashing = mob.clawSlash != null;
  const moving = !praying && Math.abs(mob.dx) > 2;
  const stride = moving ? Math.round(Math.sin(time * (mob.dash > 0 ? 22 : 12) + mob.phase) * 2.5) : 0;
  const chant = praying ? Math.sin(time * 3.4 + mob.phase) : 0;

  const dark = '#243a24';
  const skin = '#4a703e';
  const ridge = '#6f9751';
  const belly = '#9fb673';
  const robe = '#512e58';
  const robeTrim = '#7b4982';
  const claw = '#e2dcc4';
  const eye = praying ? '#a3bf67' : '#ffcf54';

  const bodyDrop = praying ? 5 + Math.round(Math.max(0, chant)) : biting ? 3 : 0;
  const lean = praying ? 3 : biting ? 5 : 0;

  // Webbed clawed feet / kneeling calves
  if (praying) {
    rect(-8, -5, 11, 5, dark);
    rect(-6, -6, 9, 4, skin);
    rect(1, -3, 7, 3, dark);
    rect(2, -2, 6, 2, ridge);
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
  // Swelling vocal sac while chanting or snarling
  const sacExpand = praying ? Math.round((chant + 1) * 1.2) : biting ? 2 : 0;
  rect(headX + 2, headY + 7, 6 + sacExpand, 3 + Math.min(2, sacExpand), belly);

  // Bulging frog eye bumps & amber eyes
  rect(headX + 1, headY - 2, 4, 4, ridge);
  rect(headX + 6, headY - 2, 4, 4, ridge);
  rect(headX + 2, headY - 1, 2, 2, eye);
  rect(headX + 7, headY - 1, 2, 2, eye);
  rect(headX + 3, headY - 1, 1, 2, '#141f14');

  // Wide fanged gape (snarling or biting wide open)
  if (biting) {
    rect(headX + 4, headY + 3, 9, 6, '#5c1824');
    rect(headX + 5, headY + 3, 2, 2, claw);
    rect(headX + 9, headY + 3, 2, 2, claw);
    rect(headX + 6, headY + 7, 2, 2, claw);
    rect(headX + 10, headY + 7, 2, 2, claw);
  } else {
    rect(headX + 4, headY + 5, 7, 2, '#2a181d');
    rect(headX + 6, headY + 5, 1, 1, claw);
    rect(headX + 9, headY + 5, 1, 1, claw);
  }

  // Clawed arms
  if (praying) {
    rect(headX + 4, headY + 11, 6, 3, skin);
    rect(headX + 9, headY + 8, 3, 5, ridge);
    rect(headX + 10, headY + 6, 2, 2, claw);
  } else if (slashing) {
    const phase = Math.min(1, mob.clawSlash / 0.34);
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

export function drawCaveEnemy(ctx, rect, polygon, mob, time) {
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
