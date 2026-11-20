// Place long cave climbs at actual ledge borders, then clear a narrow passage so
// ropes and ladders never float in the middle of a chamber or end inside stone.
// The original cave profiles decide the anchors; carving happens only afterward.
export function placeLedgeClimbs(climbs, dryBands) {
  const open = (column, row) => Boolean(dryBands.get(column)?.has(row));
  const anchors = climbs.map(([seed, top, bottom, kind]) => {
    let best = null;
    for (let column = seed - 22; column <= seed + 22; column++) {
      if (!open(column, top - 1) || !open(column, top) || !open(column, top + 1)) continue;
      let left = 0;
      let right = 0;
      while (left < 12 && open(column - left - 1, top)) left++;
      while (right < 12 && open(column + right + 1, top)) right++;
      const score = Math.min(left, right) * 5 + Math.abs(column - seed) * 0.35;
      if (!best || score < best.score) best = { column, score };
    }
    const column = best?.column ?? seed;
    // Find a pre-existing exit before the narrow shaft is carved.
    let exit = null;
    if (!open(column, bottom) || !open(column, bottom - 1)) {
      for (let distance = 1; distance <= 24 && exit === null; distance++) {
        for (const side of [-1, 1]) {
          const other = column + distance * side;
          if (open(other, bottom) && open(other, bottom - 1)) {
            exit = other;
            break;
          }
        }
      }
    }
    return { column, top, bottom, kind, exit };
  });

  const carve = (column, row) => {
    let rows = dryBands.get(column);
    if (!rows) {
      rows = new Set();
      dryBands.set(column, rows);
    }
    rows.add(row);
  };
  for (const { column, top, bottom, exit } of anchors) {
    for (let row = top - 1; row <= bottom; row++) carve(column, row);
    if (exit !== null) {
      for (let x = Math.min(column, exit); x <= Math.max(column, exit); x++) {
        carve(x, bottom - 1);
        carve(x, bottom);
      }
    }
  }
  return anchors.map(({ column, top, bottom, kind }) => [column, top, bottom, kind]);
}
