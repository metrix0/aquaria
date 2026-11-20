// Follow exposed cave edges; never dig a shaft to make a rope fit.
// A straight rope through winding stone is both visually wrong and unplayable.
export function placeLedgeClimbs(climbs, dryBands) {
  const air = (x, y) => Boolean(dryBands.get(x)?.has(y));
  const edgeDistance = (x, y) => {
    for (let d = 1; d <= 12; d++) {
      if (!air(x - d, y) || !air(x + d, y)) return d;
    }
    return 13;
  };
  const routes = [];
  for (const [seed, top, bottom, kind] of climbs) {
    let previous = new Map();
    for (let row = top; row <= bottom; row++) {
      const next = new Map();
      for (let x = seed - 48; x <= seed + 48; x++) {
        // Allow room for the entire character, not just the visible rung.
        if (!air(x, row) || !air(x, row - 1) ||
            (row !== bottom && !air(x, row + 1))) continue;
        const gap = edgeDistance(x, row);
        const penalty = (gap - 1) * 3 + Math.abs(x - seed) * .06;
        if (row === top) {
          next.set(x, { cost: penalty, path: [x], gaps: [gap] });
          continue;
        }
        for (const dx of [-1, 0, 1]) {
          const prior = previous.get(x - dx);
          if (!prior) continue;
          const cost = prior.cost + penalty + Math.abs(dx) * .45;
          if (!next.has(x) || cost < next.get(x).cost) {
            next.set(x, {
              cost,
              path: [...prior.path, x],
              gaps: [...prior.gaps, gap],
            });
          }
        }
      }
      previous = next;
      if (!previous.size) break;
    }
    const best = [...previous.values()].sort((a, b) => a.cost - b.cost)[0];
    if (!best || best.path.length !== bottom - top + 1) {
      throw new Error('No natural cave-edge path for climb at ' + seed + ', row ' + top);
    }
    // Open galleries sometimes have no cliff for many rows. Break the climb
    // into short edge-mounted sections instead of suspending it in open space.
    const attached = best.gaps.map((gap) => gap <= 4);
    for (let i = 1; i < attached.length - 1; i++) {
      if (attached[i - 1] && attached[i + 1]) attached[i] = true;
    }
    let from = 0;
    while (from < attached.length) {
      while (from < attached.length && !attached[from]) from++;
      if (from === attached.length) break;
      let end = from;
      while (end + 1 < attached.length && attached[end + 1]) end++;
      if (end - from + 1 >= 4) {
        routes.push([best.path[from], top + from, top + end, kind, best.path.slice(from, end + 1)]);
      }
      from = end + 1;
    }
  }
  return routes;
}

// Both rendering and movement use the exact same sloping climb trajectory.
export function climbCenterX(route, handY, tileSize) {
  const path = route.path;
  if (!path?.length) return (route.tx + .5) * tileSize;
  const index = Math.max(0, Math.min(path.length - 1,
    handY / tileSize - route.top - .5));
  const before = Math.floor(index);
  const after = Math.min(path.length - 1, before + 1);
  return (path[before] + (path[after] - path[before]) * (index - before) + .5) * tileSize;
}
