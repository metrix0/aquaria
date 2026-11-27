import { ZONES } from './world/zones.js';

export const ENTRY_DELAY = 650;
export const GLOBAL_COOLDOWN = 6000;
export const ZONE_COOLDOWN = 30000;

// A candidate must remain stable before becoming the current zone. A pending
// title is discarded when the player leaves; titles never queue up behind it.
export function createZoneTracker(initialZone) {
  let current = initialZone, candidate = initialZone, since = 0, pending = null;
  let lastTitle = -Infinity;
  const shownAt = new Map();
  return {
    update(zone, now) {
      if (zone !== candidate) {
        candidate = zone;
        since = now;
        pending = null;
      }
      if (candidate !== current && now - since >= ENTRY_DELAY) {
        current = candidate;
        pending = current === 'island' || now - (shownAt.get(current) ?? -Infinity) < ZONE_COOLDOWN
          ? null : current;
      }
      if (pending && pending === candidate && now - lastTitle >= GLOBAL_COOLDOWN) {
        const title = pending;
        pending = null;
        lastTitle = now;
        shownAt.set(title, now);
        return title;
      }
      return null;
    },
  };
}

export function createZoneTitle(container) {
  const overlay = document.createElement('div');
  overlay.className = 'zone-title';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.hidden = true;
  const ornament = document.createElement('div');
  ornament.className = 'zone-title-ornament';
  ornament.setAttribute('aria-hidden', 'true');
  ornament.textContent = '◆';
  const name = document.createElement('div');
  name.className = 'zone-title-name';
  const rule = document.createElement('div');
  rule.className = 'zone-title-rule';
  overlay.append(ornament, name, rule);
  container.append(overlay);
  let timer;
  function clear() {
    clearTimeout(timer);
    overlay.hidden = true;
    name.textContent = '';
  }
  return {
    clear,
    show(zone) {
      clear();
      const { name: title, color } = ZONES[zone];
      overlay.style.setProperty('--zone-accent', color);
      name.textContent = title;
      overlay.hidden = false;
      timer = setTimeout(clear, 4800);
    },
  };
}
