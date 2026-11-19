import { ROOT_BIND_DURATION, ROOT_SQUEEZE_TIME } from './gameplay/root-ring.js';
import { clamp } from './world/generation.js';

const GRIP_START = .14;

function smoothstep(progress) {
  const t = clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}

export function rootBindPose(mob, spec, reducedMotion) {
  const age = ROOT_BIND_DURATION - mob.rooted;
  const release = smoothstep(mob.rooted / .48);
  const grip = smoothstep((age - GRIP_START) / (ROOT_SQUEEZE_TIME - GRIP_START)) * release;
  const pulse = reducedMotion ? 1 : .88 + .12 * Math.cos((age - ROOT_SQUEEZE_TIME) * 8);
  const feet = spec.centerY + spec.height / 2;
  return {
    base: feet + mob.rootBaseY - mob.y,
    feet,
    height: spec.height,
    spread: Math.max(8, spec.width / 2 + 2),
    rise: smoothstep(age / .34) * release,
    grip: grip * pulse,
    thorns: smoothstep((age - .08) / .32) * release,
  };
}

function tendril(polygon, points, width, bark, ridge) {
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const [fromX, fromY] = points[Math.max(0, i - 1)];
    const [toX, toY] = points[Math.min(i + 1, points.length - 1)];
    const span = Math.hypot(toX - fromX, toY - fromY) || 1;
    const thickness = width * (1 - i / (points.length - 1)) + .4;
    const dx = (fromY - toY) * thickness / span;
    const dy = (toX - fromX) * thickness / span;
    left.push([x + dx, y + dy]);
    right.push([x - dx, y - dy]);
  }
  polygon([...left, ...right.reverse()], bark);
  polygon([...points, ...left.reverse()], ridge);
}

function thorn(polygon, [x, y], side, size) {
  polygon([[x, y + 2], [x + side * (2 + size), y - size], [x + side * 2, y - 3]], '#9fb366');
  polygon([[x, y], [x + side * (2 + size), y - size], [x + side * 2, y - 3]], '#d1d68a');
}

export function drawRootBind(polygon, pose, foreground) {
  const { base, feet, height, spread, rise, grip, thorns } = pose;
  if (rise <= .01) return;
  const lift = (y) => base + (y - base) * rise;
  const shoulder = spread * (1.42 - grip * .39);

  for (const side of [-1, 1]) {
    if (!foreground) {
      const points = [
        [side * (spread + 9), base],
        [side * spread, base - 2 * rise],
        [side * (shoulder + 3), lift(feet - height * .28)],
        [side * shoulder, lift(feet - height * .67)],
        [side * (shoulder - 5), lift(feet - height * .92 - 3)],
        [side * (shoulder - 10), lift(feet - height * .86 - 3)],
      ];
      tendril(polygon, points, 4 * rise, '#374731', '#6d8850');
      if (thorns > .25) {
        thorn(polygon, points[2], side, 6 * thorns);
        thorn(polygon, points[3], side, 8 * thorns);
      }
      continue;
    }

    // Opposing coils close across the lower body and leave the face visible.
    const level = feet - height * (side < 0 ? .42 : .62);
    const points = [
      [side * (spread + 4), base + 1],
      [side * shoulder, lift(feet - height * .18)],
      [side * shoulder * (1 - grip * .38), lift(level - 2)],
      [side * shoulder * (.9 - grip * 1.13), lift(level + 2)],
      [side * shoulder * (.76 - grip * 1.23), lift(level - 1)],
    ];
    tendril(polygon, points, 4.6 * rise, '#4b5634', '#92ab59');
    if (thorns > .25) {
      thorn(polygon, points[1], side, 6 * thorns);
      thorn(polygon, points[3], -side, 5 * thorns);
    }
  }
}
