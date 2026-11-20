// Keep the passive HUD quiet until its readings matter to the player.
export const MIN_DEPTH_METERS = 12;

export function hudVisibility(oxygen, capacity, depth) {
  const max = Number.isFinite(capacity) && capacity > 0 ? capacity : 100;
  const remaining = Number.isFinite(oxygen) ? Math.max(0, oxygen) : 0;
  const showOxygen = remaining < max;
  const oxygenPercent = Math.max(0, Math.min(showOxygen ? 99 : 100, Math.floor(remaining / max * 100)));
  return { oxygenPercent, showOxygen, showDepth: depth >= MIN_DEPTH_METERS };
}
