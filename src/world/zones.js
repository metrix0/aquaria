import { TILE, WEST_EXTENSION, WATER_ROW, groundAt, JUNGLE_ISLAND, JUNGLE_CAVE } from './generation.js';
import { ISLAND_DEEPSTONE_ROW, inRootGrove, isDryIslandCave } from './island-cave.js';
import { isDryJungleCave } from './jungle-cave.js';
import { WATER_TEMPLE } from './water-temple.js';

export const ZONES = Object.freeze({
  island: { name: 'Starting Island', color: '#efc27e' },
  ocean: { name: 'Ocean', color: '#91ddeb' },
  caves: { name: 'Island Caves', color: '#e5c69b' },
  grove: { name: 'Root Grove', color: '#b7e6a1' },
  underground: { name: 'Underground', color: '#c6bce8' },
  jungle: { name: 'Jungle Island', color: '#b2df91' },
  jungleCave: { name: 'Jungle Cave', color: '#a7d7a1' },
  temple: { name: 'Temple', color: '#eac68c' },
  sanctum: { name: 'Sanctum', color: '#edd5a7' },
  waterTemple: { name: 'Water Temple', color: '#9ee9ed' },
});

export function zoneAt(player) {
  const tx = Math.floor(player.x / TILE);
  const column = tx - WEST_EXTENSION;
  const row = Math.floor((player.y + player.height / 2) / TILE);
  if (isDryIslandCave(column, row)) {
    if (inRootGrove(column, row)) return 'grove';
    return row >= ISLAND_DEEPSTONE_ROW ? 'underground' : 'caves';
  }
  if (isDryJungleCave(column, row)) {
    return row >= 412 ? 'sanctum' : row >= JUNGLE_CAVE.deepstoneRow ? 'temple' : 'jungleCave';
  }
  if (column >= WATER_TEMPLE.left && column <= WATER_TEMPLE.right &&
      row >= WATER_TEMPLE.topRow && row <= WATER_TEMPLE.seabedRow) return 'waterTemple';
  if (row < WATER_ROW && Math.abs(column - JUNGLE_ISLAND.center) <= JUNGLE_ISLAND.halfWidth) return 'jungle';
  if (row < WATER_ROW && groundAt(tx) <= WATER_ROW && Math.abs(column - 56) < 30) return 'island';
  return 'ocean';
}
