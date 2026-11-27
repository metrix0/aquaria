import { clamp, noise, TILE, WEST_EXTENSION } from './generation.js';

const spacing = 140;
const slope = .36;
const maxTrail = 72;
const maxGlow = 12;

// Each meteor has a stable sky-space lane and a staggered lifetime. The
// invisible reset is the only discontinuity; neither axis wraps mid-flight.
export function meteorAt(lane, time) {
  const duration = 3.8 + noise(lane, 847) * 1.4;
  const phase = time / duration + noise(lane, 848);
  const cycle = Math.floor(phase);
  const age = (phase - cycle) * duration;
  const speed = 28 + noise(lane, 849, cycle) * 32;
  const x = lane * spacing + noise(lane, 850, cycle) * 80 + age * speed;
  const y = 18 + noise(lane, 851, cycle) * 70 + age * speed * slope;
  // Small, distant streaks are common; occasionally a larger, brighter one passes.
  const scale = noise(lane, 852, cycle) ** 1.5;
  const size = 1.2 + scale * 3.3;
  const trail = 20 + scale * 40 + noise(lane, 853, cycle) * 12;
  const brightness = .65 + scale * .35;
  const fade = clamp(Math.min(age / 1.1, (duration - age) / 1.65), 0, 1);
  return { x, y, tailX: x - trail, tailY: y - trail * slope, size, brightness, alpha: fade * fade * (3 - 2 * fade) };
}

export function visibleMeteors(camera, time) {
  const skyX = (camera.x - WEST_EXTENSION * TILE) * .12;
  // Include lanes whose heads or tails can cross into the visible region.
  const first = Math.floor((skyX - 420) / spacing);
  const last = Math.ceil((skyX + camera.width + maxTrail + maxGlow) / spacing);
  const result = [];
  for (let lane = first; lane <= last; lane++) {
    const meteor = meteorAt(lane, time);
    const x = meteor.x - skyX;
    const tailX = meteor.tailX - skyX;
    if (meteor.alpha <= 0 || x + maxGlow < 0 || tailX - maxGlow > camera.width) continue;
    result.push({ ...meteor, x, y: meteor.y - camera.y, tailX, tailY: meteor.tailY - camera.y });
  }
  return result;
}
