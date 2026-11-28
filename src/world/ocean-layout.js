export const EAST_SHIFT = 532;
export const WEST_GROWTH = 384;
export const CORAL_COLUMN = -357;
export const CORAL_OPEN_ID = 'coral-song-open';
export const coralWallColumn = column => Math.abs(column - CORAL_COLUMN) <= 2;
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
export const CORAL_DIALS = Object.freeze([-337, -335, -333, -331].map((column, slot) => ({
  id: 'coral-dial-' + slot, column, row: 94, slot, name: 'Mark ' + (slot + 1),
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
