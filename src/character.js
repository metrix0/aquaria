import { TILE, WATER, clamp } from './world.js';

export const WALK_CYCLE_DISTANCE = 32;
export const appearanceOptions = {
  gender: {
    label: 'Gender',
    choices: { unspecified: 'Unspecified', woman: 'Woman', man: 'Man', nonbinary: 'Nonbinary' },
  },
  body: { label: 'Body', choices: { regular: 'Regular', slim: 'Slim', broad: 'Broad' } },
  hair: {
    label: 'Hairstyle',
    choices: { swept: 'Side-swept', cropped: 'Cropped', bob: 'Bob', ponytail: 'Ponytail', shaved: 'Shaved' },
  },
  skin: {
    label: 'Skin tone',
    choices: {
      fair: 'Fair', light: 'Light', tan: 'Tan', olive: 'Olive', brown: 'Brown', deep: 'Deep',
    },
    colors: {
      fair: ['#f7d8b6', '#dca58b', '#ab6f68'],
      light: ['#e8b184', '#c78267', '#8b524d'],
      tan: ['#cb9260', '#a9604a', '#733f3d'],
      olive: ['#b99a68', '#92714e', '#634d41'],
      brown: ['#a46b4c', '#7e483b', '#553431'],
      deep: ['#784f41', '#603b36', '#402a2a'],
    },
  },
  hairColor: {
    label: 'Hair color',
    choices: { umber: 'Dark brown', black: 'Black', auburn: 'Auburn', blonde: 'Blonde', silver: 'Silver', teal: 'Teal' },
    colors: {
      umber: ['#99634e', '#654239', '#422f34'],
      black: ['#6c6774', '#3d3b4a', '#292936'],
      auburn: ['#ce7c54', '#934a3b', '#602e32'],
      blonde: ['#f1ce83', '#c49357', '#7d573f'],
      silver: ['#e7e6d8', '#a4afb9', '#63717f'],
      teal: ['#78ccb7', '#43968d', '#2b535b'],
    },
  },
  outfit: {
    label: 'Outfit color',
    choices: { rust: 'Rust', kelp: 'Kelp', navy: 'Navy', plum: 'Plum', ochre: 'Ochre', slate: 'Slate' },
    colors: {
      rust: ['#f0aa76', '#b86650', '#82484a'],
      kelp: ['#b8cf88', '#728f59', '#4e654c'],
      navy: ['#8bc6df', '#4c85a3', '#335270'],
      plum: ['#d5aad5', '#a46f9f', '#674969'],
      ochre: ['#f2cf7d', '#b28743', '#765839'],
      slate: ['#c2c9cc', '#7c8c98', '#52616e'],
    },
  },
};

export function normalizeAppearance(value) {
  return Object.fromEntries(Object.entries(appearanceOptions).map(([name, { choices }]) => {
    const choice = value?.[name];
    return [name, typeof choice === 'string' && Object.hasOwn(choices, choice) ? choice : Object.keys(choices)[0]];
  }));
}

const ink = '#242633';
const bodies = {
  slim: { shoulder: 7, waist: 5 },
  regular: { shoulder: 9, waist: 7 },
  broad: { shoulder: 11, waist: 9 },
};

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

  function leg(hip, foot, far) {
    const [x, y] = foot;
    const knee = [Math.round((hip[0] + x) / 2) + 1, Math.min(19, y - 2)];
    const ankle = [x, y - 1];
    pixelLine(hip, knee, 4, ink);
    pixelLine(knee, ankle, 4, ink);
    pixelLine(hip, knee, 2, far ? '#364251' : '#617382');
    pixelLine(knee, ankle, 2, far ? '#364251' : '#4c5d6e');
    rect(x - 2, y - 1, far ? 4 : 5, 2, ink);
    rect(x - 1, y - 1, 3, 1, far ? '#584c4b' : '#8c6d59');
  }

  function arm(x, y, swing, skin, outfit, far) {
    const shoulder = [x, y];
    const elbow = [x + Math.round(swing * 0.4), y + 3];
    const hand = [x + swing, y + 5 - Math.floor(Math.abs(swing) / 2)];
    pixelLine(shoulder, elbow, 4, ink);
    pixelLine(elbow, hand, 3, ink);
    pixelLine(shoulder, elbow, 2, far ? outfit[2] : outfit[1]);
    pixelLine(elbow, hand, 2, far ? skin[2] : skin[1]);
    if (!far) rect(hand[0], hand[1] - 1, 1, 2, skin[0]);
  }

  function head(style, hair, skin, x, y, sway) {
    ctx.save();
    ctx.translate(x, y);
    if (style === 'ponytail') {
      rect(-7, 4, 4, 5, ink);
      rect(-8 + sway, 6, 4, 4, ink);
      rect(-7 + sway, 6, 2, 3, hair[1]);
      rect(-6, 4, 2, 2, '#e8ba79');
    }
    rect(-4, 1, 9, 8, ink);
    rect(-3, 0, 7, 2, ink);
    rect(-4, 4, 2, 4, skin[2]);
    rect(-2, 2, 6, 7, skin[1]);
    rect(-1, 3, 5, 5, skin[0]);
    rect(4, 5, 2, 2, skin[0]);
    rect(1, 8, 3, 1, skin[1]);
    rect(3, 4, 1, 2, ink);
    rect(-2, 6, 1, 1, skin[0]);
    if (style !== 'shaved') {
      rect(-4, 1, 8, 3, hair[1]);
      rect(-3, 0, 6, 1, hair[2]);
      rect(-3, 1, 5, 1, hair[0]);
      rect(-4, 3, 3, 3, hair[2]);
    }
    if (style === 'swept') {
      rect(0, 2, 5, 2, hair[1]);
      rect(3, 2, 2, 1, hair[0]);
    }
    if (style === 'cropped') rect(-3, 2, 7, 1, hair[0]);
    if (style === 'bob') {
      rect(-5, 3, 3, 7, ink);
      rect(-4, 3, 2, 6, hair[1]);
      rect(-1, 2, 6, 2, hair[1]);
      rect(-4, 4, 1, 3, hair[0]);
    }
    if (style === 'shaved') rect(-2, 1, 5, 1, skin[1]);
    ctx.restore();
  }

  function miningArm(x, y, targetX, targetY, tilt, phase, skin, outfit) {
    const angle = clamp(Math.atan2(targetY - y, targetX - x), -1.05, 1.15);
    const swing = 0.52 * (1 - Math.cos(phase * 2 * Math.PI));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle - tilt - swing);
    rect(-2, -2, 6, 4, ink);
    rect(-1, -1, 4, 3, outfit[1]);
    rect(2, -1, 5, 3, skin[1]);
    rect(5, -1, 2, 2, skin[0]);
    rect(7, -1, 7, 2, '#85604c');
    rect(8, -1, 5, 1, '#d29c65');
    rect(12, -4, 3, 8, '#6e888a');
    rect(13, -3, 2, 6, '#b5c6bd');
    rect(12, -4, 2, 1, '#d9e1cf');
    ctx.restore();
  }

  return function drawCharacter(player, appearance, { tank = false, time = 0, mining = null, reducedMotion = false } = {}) {
    const swimming = player.y + player.height * 0.65 > WATER;
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
    const skin = appearanceOptions.skin.colors[appearance.skin];
    const hair = appearanceOptions.hairColor.colors[appearance.hairColor];
    const outfit = appearanceOptions.outfit.colors[appearance.outfit];
    const shoulderX = (shoulder - 5) / 2 + lean;
    const nearFoot = swimming ? [-1 + kick, 21] : !player.grounded ? [3, 20] : [2, 22];
    const farFoot = swimming ? [-4 - kick, 22] : !player.grounded ? [-4, 21] : [-3, 22];
    const nearPhase = facing === player.facing ? phase : (phase + 0.5) % 1;

    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    ctx.scale(facing, 1);
    if (swimming) ctx.rotate(tilt);
    leg([-2, 17 + bob], walking && !reducedMotion ? walkFoot((nearPhase + 0.5) % 1) : farFoot, true);
    arm(-shoulderX, 11 + bob, stride - Number(swimming) * 2, skin, outfit, true);

    if (tank) {
      rect(-shoulderX - 5, 9 + bob, 5, 9, ink);
      rect(-shoulderX - 4, 10 + bob, 3, 7, '#55988f');
      rect(-shoulderX - 4, 11 + bob, 1, 4, '#bed8ba');
      rect(-shoulderX - 3, 8 + bob, 2, 2, '#d2a673');
    }
    rect(lean - (shoulder - 1) / 2, 9 + bob, shoulder, 5, ink);
    rect(-(waist - 1) / 2, 13 + bob, waist, 5, ink);
    rect(lean - (shoulder - 3) / 2, 10 + bob, shoulder - 2, 4, outfit[1]);
    rect(-(waist - 3) / 2, 13 + bob, waist - 2, 3, outfit[1]);
    rect(-(waist - 3) / 2, 15 + bob, waist - 2, 1, outfit[2]);
    rect(lean - 2, 10 + bob, 4, 1, outfit[0]);
    rect(-1, 16 + bob, 2, 1, '#ddb57b');
    leg([1, 17 + bob], walking && !reducedMotion ? walkFoot(nearPhase) : nearFoot, false);
    head(appearance.hair, hair, skin, lean, bob, Math.sign(stride));
    rect(lean - 2, 9 + bob, 5, 1, '#edb77b');
    rect(lean - 2, 10 + bob, 2, 1, '#b77357');

    if (mining) {
      const targetY = (mining.ty + 0.5) * TILE - player.y;
      const swings = Math.round(mining.duration / 0.26);
      miningArm(shoulderX, 11 + bob, Math.abs(targetX), targetY, tilt, reducedMotion ? 0 : mining.progress * swings, skin, outfit);
    } else {
      arm(shoulderX, 11 + bob, swimming ? 4 + Math.sign(kick) : -stride, skin, outfit, false);
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
