function dot(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawAnt(ctx, x, y, phase, direction, time, jungle, reducedMotion) {
  const stride = reducedMotion ? 0 : Math.sin(time * 11 + phase) > 0 ? 1 : 0;
  const shell = jungle ? '#c3a078' : '#b8a18b';
  const shadow = jungle ? '#5a4434' : '#48444c';
  dot(ctx, x - 3 * direction, y - 1, 2, 2, shell);
  dot(ctx, x - direction, y - 1, 2, 2, shadow);
  dot(ctx, x + direction, y - 2, 2, 2, shell);
  dot(ctx, x - 2, y + stride, 1, 1, shadow);
  dot(ctx, x + 2, y + (1 - stride), 1, 1, shadow);
  dot(ctx, x + direction * 3, y - 3, 1, 1, shell);
}

function drawSpider(ctx, x, y, phase, time, jungle, reducedMotion) {
  const leg = reducedMotion ? 0 : Math.sin(time * 7 + phase) > 0 ? 1 : 0;
  const shell = jungle ? '#9c9d80' : '#a4a0ad';
  const shadow = jungle ? '#394a3e' : '#484151';
  dot(ctx, x - 2, y - 4, 5, 3, shadow);
  dot(ctx, x - 1, y - 4, 3, 2, shell);
  for (const side of [-1, 1]) {
    dot(ctx, x + side * 3, y - 4 + leg, 2, 1, shell);
    dot(ctx, x + side * 5, y - 3 + leg, 1, 2, shell);
    dot(ctx, x + side * 3, y - 1 - leg, 2, 1, shadow);
  }
  dot(ctx, x - 1, y - 3, 1, 1, '#e6c4aa');
  dot(ctx, x + 1, y - 3, 1, 1, '#e6c4aa');
}

function drawBat(ctx, x, y, phase, time, jungle, reducedMotion, blood = false) {
  const flap = reducedMotion ? 1 : Math.sin(time * 12 + phase);
  const wingRise = flap > .25 ? -3 : flap < -.25 ? 2 : 0;
  const wing = blood ? '#7d1826' : jungle ? '#839b83' : '#9098b4';
  const body = blood ? '#470a14' : jungle ? '#424b42' : '#444354';
  dot(ctx, x - 2, y - 2, 5, 4, body);
  dot(ctx, x - 1, y - 4, 1, 2, wing);
  dot(ctx, x + 2, y - 4, 1, 2, wing);
  for (const side of [-1, 1]) {
    dot(ctx, x + side * 3 - (side < 0 ? 2 : 0), y - 1 + wingRise / 2, 3, 2, wing);
    dot(ctx, x + side * 6 - (side < 0 ? 2 : 0), y - 1 + wingRise, 3, 2, wing);
    dot(ctx, x + side * 8 - (side < 0 ? 2 : 0), y + wingRise + 1, 2, 1, body);
  }
  if (blood) {
    dot(ctx, x - 1, y - 1, 1, 1, '#ff4d5a');
    dot(ctx, x + 1, y - 1, 1, 1, '#ff4d5a');
  } else {
    dot(ctx, x, y - 1, 1, 1, '#d7c6b7');
  }
}

export function drawCaveAmbienceMob(ctx, mob, time, reducedMotion) {
  const { kind, phase, jungle } = mob;
  if (kind === 'ambient-bat' || kind === 'blood-bat') {
    drawBat(ctx, 0, 0, phase, time, jungle, reducedMotion, kind === 'blood-bat');
  } else if (kind === 'ambient-ant') {
    drawAnt(ctx, 0, 0, phase, mob.facing, time, jungle, reducedMotion);
  } else if (kind === 'ambient-spider') {
    drawSpider(ctx, 0, 0, phase, time, jungle, reducedMotion);
  }
}
