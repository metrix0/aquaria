import { normalizeAppearance } from './content.js';

const KEY = 'aquaria.pending-new-game';

export function queueNewGame(appearance) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      appearance: normalizeAppearance(appearance),
      timestamp: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeNewGame() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const data = JSON.parse(raw);
    if (!data || !Number.isFinite(data.timestamp) || Date.now() - data.timestamp > 60_000 ||
        Date.now() < data.timestamp || !data.appearance) return null;
    return normalizeAppearance(data.appearance);
  } catch {
    return null;
  }
}

// Put the black veil in place before the first world frame; lift it only after rendering.
export function createIslandReveal(reducedMotion = false) {
  const veil = document.createElement('div');
  veil.id = 'island-arrival-veil';
  Object.assign(veil.style, {
    position: 'fixed', inset: '0', background: '#030c13', zIndex: '1000',
    opacity: '1', pointerEvents: 'auto',
    transition: reducedMotion ? 'none' : 'opacity 1650ms ease-in-out',
  });
  document.body.append(veil);
  let started = false;
  let finished = false;
  return {
    get active() { return !finished; },
    reveal() {
      if (started) return;
      started = true;
      requestAnimationFrame(() => {
        setTimeout(() => { veil.style.opacity = '0'; }, reducedMotion ? 0 : 170);
        setTimeout(() => {
          veil.remove();
          finished = true;
        }, reducedMotion ? 20 : 1880);
      });
    },
  };
}
