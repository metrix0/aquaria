// Presentation-only camera motion. Never move the player or gameplay camera.
export const SKY_PAN_SECONDS = .72;
const clamp01 = value => Math.max(0, Math.min(1, value));
export const smoothSky = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export function advanceSkyView(progress, opening, dt, reducedMotion = false) {
  return reducedMotion ? Number(opening) :
    clamp01(progress + (opening ? 1 : -1) * Math.max(0, dt) / SKY_PAN_SECONDS);
}

export function skyCamera(camera, progress) {
  if (!progress) return camera;
  // Travel upward by nearly a full screen, even when already at the map's top.
  return { ...camera, y: camera.y - camera.height * .86 * smoothSky(progress) };
}

export function skyInterfaceOpacity(progress) {
  return smoothSky((progress - .42) / .58);
}
