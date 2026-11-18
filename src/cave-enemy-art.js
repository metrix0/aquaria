import { pickaxePose } from './gameplay/melee.js';
import { drawPickaxe } from './pickaxe-art.js';

export function drawCaveEnemy(ctx, rect, polygon, mob, time) {
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
