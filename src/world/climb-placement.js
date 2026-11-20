// A climb hangs vertically from a real exposed ledge. Never follow a
// sloping wall and never carve terrain to accommodate ropes or ladders.
export function placeLedgeClimbs(climbs, dryBands) {
  const air = (x, y) => Boolean(dryBands.get(x)?.has(y));
  const routes = [];
  for (const [seedX, seedY, targetY, kind] of climbs) {
    let best = null;
    // Each hint identifies a tier; find the actual nearby cliff lip.
    for (let y = seedY - 18; y <= seedY + 18; y++) {
      for (let x = seedX - 18; x <= seedX + 18; x++) {
        if (!air(x, y - 1) || !air(x, y) ||
            !air(x, y + 1) || !air(x, y + 2)) continue;
        // There must be a solid edge right beside the top of the climb.
        const edgeLeft = !air(x - 1, y) || !air(x - 1, y + 1);
        const edgeRight = !air(x + 1, y) || !air(x + 1, y + 1);
        if (!edgeLeft && !edgeRight) continue;
        let clear = 0;
        for (let row = y; row < y + 36; row++) {
          if (!air(x, row - 1) || !air(x, row) || !air(x, row + 1)) break;
          clear++;
        }
        if (clear < 7) continue;
        const length = Math.min(30, clear);
        const preferredLength = Math.min(24, Math.max(12, targetY - seedY));
        const score = Math.abs(y - seedY) * 0.85 +
          Math.abs(x - seedX) * 0.25 +
          Math.abs(length - preferredLength) * 0.4 - length * 0.9;
        if (!best || score < best.score) {
          best = { x, top: y, bottom: y + length - 1, kind, score };
        }
      }
    }
    if (best) routes.push([best.x, best.top, best.bottom, best.kind]);
  }
  return routes;
}
