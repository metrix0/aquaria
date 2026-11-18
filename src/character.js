import { APPEARANCE } from './content.js';
import { CRAWL_HEIGHT } from './gameplay/player.js';
import { TILE, clamp } from './world/generation.js';

const ink = '#242633';
const bodies = [
  { shoulder: 9, waist: 7 },
  { shoulder: 7, waist: 5 },
  { shoulder: 11, waist: 9 },
];
const hairStyles = ['swept', 'cropped', 'bob', 'ponytail', 'shaved'];

function walkFoot(phase) {
  const stance = 0.55;
  if (phase < stance) return [Math.round(8 - 16 * phase / stance), 22];
  const swing = (phase - stance) / (1 - stance);
  return [Math.round(-8 + 16 * swing), 22 - Math.round(4 * Math.sin(swing * Math.PI))];
}

export function createCharacterRenderer(ctx) {
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
  }

  function pixelLine(from, to, width, color) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.max(1, Math.abs(dx), Math.abs(dy));
    const offset = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      rect(from[0] + i * dx / steps - offset, from[1] + i * dy / steps - offset, width, width, color);
    }
  }

  function leg(hip, foot, pants, far) {
    const [x, y] = foot;
    const knee = [Math.round((hip[0] + x) / 2) + 1, Math.min(19, y - 2)];
    const ankle = [x, y - 1];
    pixelLine(hip, knee, 4, ink);
    pixelLine(knee, ankle, 4, ink);
    pixelLine(hip, knee, 2, far ? pants.back : pants.light);
    pixelLine(knee, ankle, 2, far ? pants.back : pants.front);
    rect(x - 2, y - 1, far ? 4 : 5, 2, ink);
    rect(x - 1, y - 1, 3, 1, far ? '#584c4b' : '#8c6d59');
  }

  function arm(x, y, swing, skin, shirt, far) {
    const shoulder = [x, y];
    const elbow = [x + Math.round(swing * 0.4), y + 3];
    const hand = [x + swing, y + 5 - Math.floor(Math.abs(swing) / 2)];
    pixelLine(shoulder, elbow, 4, ink);
    pixelLine(elbow, hand, 3, ink);
    pixelLine(shoulder, elbow, 2, far ? shirt.wet : shirt.base);
    pixelLine(elbow, hand, 2, far ? skin.shade : skin.face);
    if (!far) rect(hand[0], hand[1] - 1, 1, 2, skin.arm);
  }

  function head(style, hair, skin, x, y, sway) {
    ctx.save();
    ctx.translate(x, y);
    if (style === 'ponytail') {
      rect(-7, 4, 4, 5, ink);
      rect(-8 + sway, 6, 4, 4, ink);
      rect(-7 + sway, 6, 2, 3, hair.base);
      rect(-6, 4, 2, 2, '#e8ba79');
    }
    rect(-4, 1, 9, 8, ink);
    rect(-3, 0, 7, 2, ink);
    rect(-4, 4, 2, 4, skin.shade);
    rect(-2, 2, 6, 7, skin.shade);
    rect(-1, 3, 5, 5, skin.face);
    rect(4, 5, 2, 2, skin.arm);
    rect(1, 8, 3, 1, skin.face);
    rect(3, 4, 1, 2, ink);
    rect(-2, 6, 1, 1, skin.arm);
    if (style !== 'shaved') {
      rect(-4, 1, 8, 3, hair.base);
      rect(-3, 0, 6, 1, hair.shade);
      rect(-3, 1, 5, 1, hair.light);
      rect(-4, 3, 3, 3, hair.shade);
    }
    if (style === 'swept') {
      rect(0, 2, 5, 2, hair.base);
      rect(3, 2, 2, 1, hair.light);
    }
    if (style === 'cropped') rect(-3, 2, 7, 1, hair.light);
    if (style === 'bob') {
      rect(-5, 3, 3, 7, ink);
      rect(-4, 3, 2, 6, hair.base);
      rect(-1, 2, 6, 2, hair.base);
      rect(-4, 4, 1, 3, hair.light);
    }
    if (style === 'shaved') rect(-2, 1, 5, 1, skin.face);
    ctx.restore();
  }

  function miningArm(x, y, targetX, targetY, tilt, phase, skin, shirt, tier) {
    const angle = clamp(Math.atan2(targetY - y, targetX - x), -1.05, 1.15);
    const swing = 0.52 * (1 - Math.cos(phase * 2 * Math.PI));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle - tilt - swing);
    rect(-2, -2, 6, 4, ink);
    rect(-1, -1, 4, 3, shirt.base);
    rect(2, -1, 5, 3, skin.face);
    rect(5, -1, 2, 2, skin.arm);
    if (tier) {
      rect(7, -1, 7, 2, '#85604c');
      rect(8, -1, 5, 1, '#d29c65');
      rect(12, -4, 3, 8, tier === 2 ? '#a35646' : '#6e888a');
      rect(13, -3, 2, 6, tier === 2 ? '#e09b71' : '#b5c6bd');
      rect(12, -4, 2, 1, tier === 2 ? '#ffd3a0' : '#d9e1cf');
    }
    ctx.restore();
  }

  return function drawCharacter(player, appearance, { tank = false, time = 0, mining = null, reducedMotion = false, swimming = false } = {}) {
    const crawling = player.height === CRAWL_HEIGHT;
    const moving = Math.abs(player.dx) > 9;
    const walking = moving && player.grounded && !swimming;
    const phase = player.walkPhase;
    const bob = walking && !reducedMotion ? -Math.round(Math.sin(phase * 2 * Math.PI) ** 2) : 0;
    const targetX = mining ? (mining.tx + 0.5) * TILE - player.x : 0;
    const facing = Math.sign(targetX) || player.facing;
    const tilt = swimming ? clamp(player.dy * .0022, -.3, .3) * facing : 0;
    const lean = Number(walking && facing === player.facing);
    const stride = walking && !reducedMotion ? Math.round(Math.cos(phase * 2 * Math.PI) * 4) : 0;
    const kick = swimming && !reducedMotion ? Math.round(Math.sin(time * 11) * (moving ? 3 : 1)) : 0;
    const { shoulder, waist } = bodies[appearance.body];
    const skin = APPEARANCE.skin[appearance.skin];
    const hair = APPEARANCE.hairColor[appearance.hairColor];
    const shirt = APPEARANCE.shirt[appearance.shirt];
    const pants = APPEARANCE.pants[appearance.pants];
    const shoulderX = (shoulder - 5) / 2 + lean;
    const nearFoot = swimming ? [-1 + kick, 21] : !player.grounded ? [3, 20] : [2, 22];
    const farFoot = swimming ? [-4 - kick, 22] : !player.grounded ? [-4, 21] : [-3, 22];
    const nearPhase = facing === player.facing ? phase : (1 - phase) % 1;
    const targetY = mining ? (mining.ty + 0.5) * TILE - player.y : 0;
    const swingPhase = mining && !reducedMotion ? mining.progress * Math.round(mining.duration / 0.26) : 0;

    ctx.save();
    if (player.hurt > 0 && Math.floor(player.hurt * 14) % 2 === 1) ctx.globalAlpha = 0.65;
    ctx.translate(Math.round(player.x), Math.round(player.y));
    ctx.scale(facing, 1);
    if (crawling) {
      const shuffle = Math.round(stride / 2);
      rect(-6 - shuffle, 13, 5, 3, ink);
      rect(-5 - shuffle, 13, 3, 2, pants.back);
      rect(-5, 11, 6, 4, pants.front);
      rect(-6, 7, shoulder, 6, ink);
      rect(-5, 8, shoulder - 2, 4, swimming ? shirt.wet : shirt.base);
      rect(-5, 8, shoulder - 3, 1, shirt.light);
      if (tank) {
        rect(-7, 4, 7, 4, ink);
        rect(-6, 5, 5, 2, '#55988f');
        rect(-6, 5, 4, 1, '#bed8ba');
      }
      head(hairStyles[appearance.hair], hair, skin, 3, 2, Math.sign(shuffle));
      if (mining) miningArm(1, 10, Math.abs(targetX), targetY, 0, swingPhase, skin, shirt, mining.tier);
      else arm(1, 9, 2 - shuffle, skin, shirt, false);
      ctx.restore();
      return;
    }
    if (swimming) ctx.rotate(tilt);
    leg([-2, 17 + bob], walking && !reducedMotion ? walkFoot((nearPhase + 0.5) % 1) : farFoot, pants, true);
    arm(-shoulderX, 11 + bob, stride - Number(swimming) * 2, skin, shirt, true);

    if (tank) {
      rect(-shoulderX - 5, 9 + bob, 5, 9, ink);
      rect(-shoulderX - 4, 10 + bob, 3, 7, '#55988f');
      rect(-shoulderX - 4, 11 + bob, 1, 4, '#bed8ba');
      rect(-shoulderX - 3, 8 + bob, 2, 2, '#d2a673');
    }
    rect(lean - (shoulder - 1) / 2, 9 + bob, shoulder, 5, ink);
    rect(-(waist - 1) / 2, 13 + bob, waist, 5, ink);
    rect(lean - (shoulder - 3) / 2, 10 + bob, shoulder - 2, 4, shirt.base);
    rect(-(waist - 3) / 2, 13 + bob, waist - 2, 3, shirt.base);
    rect(-(waist - 3) / 2, 15 + bob, waist - 2, 1, shirt.wet);
    rect(lean - 2, 10 + bob, 4, 1, shirt.light);
    rect(-1, 16 + bob, 2, 1, '#ddb57b');
    leg([1, 17 + bob], walking && !reducedMotion ? walkFoot(nearPhase) : nearFoot, pants, false);
    head(hairStyles[appearance.hair], hair, skin, lean, bob, Math.sign(stride));
    rect(lean - 2, 9 + bob, 5, 1, '#edb77b');
    rect(lean - 2, 10 + bob, 2, 1, '#b77357');

    if (mining) {
      miningArm(shoulderX, 11 + bob, Math.abs(targetX), targetY, tilt, swingPhase, skin, shirt, mining.tier);
    } else {
      arm(shoulderX, 11 + bob, swimming ? 4 + Math.sign(kick) : -stride, skin, shirt, false);
    }

    if (swimming) {
      for (let i = 0; i < 3; i++) {
        const rise = (time * 18 + i * 9) % 27;
        const x = 7 + Math.sin(rise * .27 + i) * 3;
        rect(x, 5 - rise, 2, 1, '#a1d9cb');
        rect(x - 1, 6 - rise, 1, 1, '#7ebdbb');
      }
    }
    ctx.restore();
  };
}
