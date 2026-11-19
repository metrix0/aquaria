/**
 * Modular screen-shake controller that supports multiple concurrent shake impulses
 * triggered by any gameplay event or UI action.
 */
export function createScreenShake() {
  const impulses = [];

  function trigger({ intensity = 6, duration = 0.4, frequency = 42 } = {}) {
    if (!(intensity > 0) || !(duration > 0)) return;
    impulses.push({
      intensity,
      duration,
      remaining: duration,
      frequency,
      phase: impulses.length * 1.7 + 0.4,
    });
  }

  function step(dt, time = 0, reducedMotion = false) {
    let x = 0;
    let y = 0;
    for (let i = impulses.length - 1; i >= 0; i--) {
      const impulse = impulses[i];
      impulse.remaining = Math.max(0, impulse.remaining - dt);
      if (impulse.remaining <= 0) {
        impulses.splice(i, 1);
        continue;
      }
      if (reducedMotion) continue;
      const decay = impulse.remaining / impulse.duration;
      const strength = impulse.intensity * decay * decay;
      x += Math.sin(time * impulse.frequency + impulse.phase) * strength;
      y += Math.cos(time * impulse.frequency * 1.37 + impulse.phase) * strength * 0.85;
    }
    return { x, y };
  }

  function clear() {
    impulses.length = 0;
  }

  function activeCount() {
    return impulses.length;
  }

  return { trigger, step, clear, activeCount };
}
