import { TILE, WEST_EXTENSION, WATER_ROW, JUNGLE_ISLAND } from './generation.js';
import { ISLAND_DEEPSTONE_ROW, isDryIslandCave } from './island-cave.js';
import { isDryJungleCave } from './jungle-cave.js';
import { coralWallBounds } from './ocean-layout.js';

export const ZONES = Object.freeze({
  underground: { name: 'The Undergrounds', color: '#c6bce8' },
  jungle: { name: 'The Jungle', color: '#b2df91' },
  mermaid: { name: "Mermaid's Lair", color: '#83e5d8' },
});

// Only major regions get announcements. The entire jungle cave system belongs
// to the jungle region, so moving between its levels never announces a new zone.
export function zoneAt(player) {
  const column = Math.floor(player.x / TILE) - WEST_EXTENSION;
  const row = Math.floor((player.y + player.height / 2) / TILE);
  // Announce only after the player clears the western edge of the reef.
  if (column < coralWallBounds(row)[0]) return 'mermaid';
  if (row >= ISLAND_DEEPSTONE_ROW && isDryIslandCave(column, row)) return 'underground';
  if (isDryJungleCave(column, row) ||
      (row < WATER_ROW && Math.abs(column - JUNGLE_ISLAND.center) <= JUNGLE_ISLAND.halfWidth)) return 'jungle';
  return null;
}
