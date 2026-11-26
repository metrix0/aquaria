export const EAST_SHIFT = 532;
export const WEST_GROWTH = 384;
export const CORAL_COLUMN = -357;
export const CORAL_OPEN_ID = 'coral-song-open';
export const coralWallColumn = column => Math.abs(column - CORAL_COLUMN) <= 2;
export const MERMAID_SONG = ['mermaid-abyss', 'mermaid-surface', 'mermaid-reef'];
export const MERMAIDS = [
  { id: 'mermaid-reef', name: 'Reef mermaid', column: -180, row: 46, clue: 'The song ends among the reefs. Begin where sunlight is weakest.' },
  { id: 'mermaid-surface', name: 'Surface mermaid', column: -276, row: 23, clue: 'My note follows the deep singer, before the reef singer.' },
  { id: 'mermaid-abyss', name: 'Abyss mermaid', column: -315, row: 78, clue: 'The ocean remembers its deepest voice first.' },
];
export function singWithMermaid(world, id) {
  if (world.harvested.has(CORAL_OPEN_ID)) return 'The coral remembers your song.';
  const mermaid = MERMAIDS.find(m => m.id === id);
  if (!mermaid) return '';
  const step = world.coralSongProgress ?? 0;
  if (MERMAID_SONG[step] !== id) {
    world.coralSongProgress = 0;
    return mermaid.clue + ' The harmony resets.';
  }
  world.coralSongProgress = step + 1;
  if (world.coralSongProgress === MERMAID_SONG.length) {
    world.harvested.add(CORAL_OPEN_ID);
    return 'The three voices harmonize. The living coral wall opens!';
  }
  return mermaid.clue + ' (' + world.coralSongProgress + '/3 notes)';
}
