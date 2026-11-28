export const EAST_SHIFT = 532;
export const WEST_GROWTH = 384;
export const CORAL_COLUMN = -357;
export const CORAL_OPEN_ID = 'coral-song-open';
// Broad, asymmetric living reef; the east edge leaves the puzzle terrace clear.
// Continuous core from sky to bedrock prevents swimming or digging around it.
export function coralWallBounds(row) {
  const y = Math.max(0, Math.min(row, 110));
  const swell = Math.sin(y * .13 + .6) * 2.2 + Math.sin(y * .37) * 1.2;
  const west = CORAL_COLUMN - 18 - Math.round(swell + Math.sin(y * .065) * 1.6);
  const east = CORAL_COLUMN + 4 + Math.round(Math.sin(y * .18 + 1.5) * 1.5 + Math.sin(y * .47) * .6);
  return [west, Math.min(CORAL_COLUMN + 5, east)];
}
export function coralWallColumn(column, row = 40) {
  // Fast rejection for almost every tile in the world.
  if (column < CORAL_COLUMN - 24 || column > CORAL_COLUMN + 5) return false;
  const [west, east] = coralWallBounds(row);
  return column >= west && column <= east;
}
export const MERMAIDS = [
  { id: 'mermaid-reef', name: 'Reef mermaid', column: -180, row: 46 },
  { id: 'mermaid-surface', name: 'Surface mermaid', column: -276, row: 23 },
  { id: 'mermaid-abyss', name: 'Abyss mermaid', column: -315, row: 78 },
];

// Read the marked ruins in the order encountered swimming west from the island.
export const CORAL_RUINS = Object.freeze([
  { column: -132, mark: 3 },
  { column: -164 },
  { column: -202, mark: 1 },
  { column: -238 },
  { column: -276, mark: 4 },
  { column: -311, mark: 2 },
]);
export const CORAL_MARK_COUNT = 4;
export const CORAL_SOLUTION = Object.freeze(CORAL_RUINS.filter(ruin => ruin.mark).map(ruin => ruin.mark));
export const CORAL_DIALS = Object.freeze([-350, -348, -346, -344].map((column, slot) => ({
  id: 'coral-dial-' + slot, column, row: 73, slot, name: 'Mark ' + (slot + 1),
})));

export function normalizeCoralMarks(marks) {
  return CORAL_SOLUTION.map((_, slot) => {
    const mark = marks?.[slot];
    return Number.isInteger(mark) && mark >= 0 && mark <= CORAL_MARK_COUNT ? mark : 0;
  });
}

export function coralMarksFor(world) {
  return world.harvested.has(CORAL_OPEN_ID) ? CORAL_SOLUTION : (world.coralMarks ?? normalizeCoralMarks());
}

export function cycleCoralMark(world, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= CORAL_SOLUTION.length || world.harvested.has(CORAL_OPEN_ID)) return false;
  const marks = world.coralMarks = normalizeCoralMarks(world.coralMarks);
  marks[slot] = (marks[slot] + 1) % (CORAL_MARK_COUNT + 1);
  if (!marks.every((mark, index) => mark === CORAL_SOLUTION[index])) return false;
  world.harvested.add(CORAL_OPEN_ID);
  return true;
}
