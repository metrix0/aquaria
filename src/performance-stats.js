// Sample the existing render loop; publish at most twice per second.
export function createPerformanceStats(element) {
  const fields = Object.fromEntries([...element.querySelectorAll('[data-perf]')].map(node => [node.dataset.perf, node]));
  let previous, start;
  let intervals = [], update = 0, draw = 0;
  function clearWindow() {
    intervals = [];
    update = draw = 0;
  }
  function reset() {
    previous = start = undefined;
    clearWindow();
    for (const field of Object.values(fields)) field.textContent = '--';
  }
  function sample(now, updateMs, drawMs) {
    if (previous === undefined) {
      previous = start = now;
      return;
    }
    const interval = now - previous;
    previous = now;
    if (interval <= 0) return;
    intervals.push(interval);
    update += updateMs;
    draw += drawMs;
    if (now - start < 500) return;
    const count = intervals.length;
    const average = (now - start) / count;
    intervals.sort((a, b) => a - b);
    const values = {
      fps: Math.round(1000 / average),
      frame: average.toFixed(1),
      p95: intervals[Math.ceil(count * 0.95) - 1].toFixed(1),
      update: (update / count).toFixed(1),
      draw: (draw / count).toFixed(1),
    };
    for (const [key, value] of Object.entries(values)) {
      const label = String(value);
      if (fields[key].textContent !== label) fields[key].textContent = label;
    }
    start = now;
    clearWindow();
  }
  return { sample, reset };
}
