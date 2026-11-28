import { TILE, WEST_EXTENSION, ISLAND_CAVE } from '../world/generation.js';
import { CORAL_DIALS } from '../world/ocean-layout.js';
import { OVERWORLD_ZONE, WATER_TEMPLE_ZONE } from '../world/water-temple-interior.js';
import { worldCols, worldRows } from '../world.js';
import { collides, PLAYER_SIZE } from './player.js';
import { transitionZone } from './simulation.js';

export const TELEPORT_DESTINATIONS = Object.freeze([
  { id: 'undergrounds', name: 'Undergrounds', zone: OVERWORLD_ZONE, column: 25, floor: 345 },
  { id: 'cave-1', name: 'Cave 1', zone: OVERWORLD_ZONE, column: ISLAND_CAVE.camp, floor: ISLAND_CAVE.campFloor },
  { id: 'mermaid-puzzle', name: 'Mermaid Puzzle', zone: OVERWORLD_ZONE, column: CORAL_DIALS[2].column, row: CORAL_DIALS[2].row },
  { id: 'statues', name: 'Statues', zone: WATER_TEMPLE_ZONE },
]);

function safePosition(world, x, y) {
  // Find nearby open space if a player has built over the intended arrival point.
  const height = PLAYER_SIZE.height;
  for (let radius = 0; radius <= 4; radius++) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const px = x + dx * TILE, py = y + dy * TILE;
      if (px < PLAYER_SIZE.width || px > worldCols(world) * TILE - PLAYER_SIZE.width || py < 0 || py + height > worldRows(world) * TILE) continue;
      if (!collides(world, px, py, height)) return { x: px, y: py, height };
    }
  }
  return null;
}

export function teleportPlayer(game, id) {
  const destination = TELEPORT_DESTINATIONS.find(entry => entry.id === id);
  if (!destination || game.player.downed || game.world.statueAwakening) return false;
  const world = game.worlds[destination.zone];
  if (!world) return false;
  const statue = destination.zone === WATER_TEMPLE_ZONE && world.items.find(item => item.kind === 'class-statue');
  const x = statue ? statue.x - 2 * TILE : (destination.column + WEST_EXTENSION + .5) * TILE;
  const y = statue ? statue.floor * TILE - PLAYER_SIZE.height
    : destination.floor != null ? destination.floor * TILE - PLAYER_SIZE.height
    : (destination.row + .5) * TILE - PLAYER_SIZE.height / 2;
  const position = safePosition(world, x, y);
  if (!position) return false;
  const flying = Boolean(game.player.flightOrigin);
  if (game.zone !== destination.zone && !transitionZone(game, destination.zone)) return false;
  const { player } = game;
  Object.assign(player, position, {
    dx: 0, dy: 0, fallDistance: 0, grounded: false, jumpGrace: 0,
    canShortenJump: false, waterJump: false, climb: null, climbJump: false, hook: null,
    flightOrigin: flying ? { ...position } : null,
  });
  game.attack = null;
  game.bowDraw = null;
  game.morningstarDraw = null;
  game.dirty = true;
  return true;
}
