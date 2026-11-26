import { TILE } from '../world/generation.js';

export const SOLO_DEATH_SECONDS = 4;
export const MULTIPLAYER_DEATH_SECONDS = 20;
export const REVIVE_SECONDS = 3;
export const REVIVE_RANGE = 2.5 * TILE;
export const REVIVE_HEARTBEAT_MS = 500;

export function withinReviveRange(a, b) {
  return Math.hypot(a.x - b.x, a.y + a.height - b.y - b.height) <= REVIVE_RANGE;
}

export function nearestDowned(player, peers = []) {
  if (player.downed || player.health <= 0 || player.flightOrigin) return null;
  return peers.filter(peer => peer.downed && withinReviveRange(player, peer))
    .sort((a, b) => Math.hypot(a.x-player.x, a.y-player.y)-Math.hypot(b.x-player.x, b.y-player.y))[0] ?? null;
}

// The downed player's client owns the timer and validates live hold heartbeats.
export function advanceRevival(player, peers, dt, now) {
  const down = player.downed;
  const eligible = peers.filter(peer => !peer.downed && peer.reviveTarget === down.id &&
    now - peer.seenAt <= REVIVE_HEARTBEAT_MS && withinReviveRange(peer, player));
  const reviver = eligible.find(peer => peer.id === down.reviver) ?? eligible[0];
  if (reviver) {
    if (down.reviver !== reviver.id) down.progress = 0;
    down.reviver = reviver.id;
    down.progress += dt;
    return down.progress >= REVIVE_SECONDS - 1e-6 ? 'revive' : 'holding';
  }
  down.reviver = null;
  down.progress = 0;
  down.remaining = Math.max(0, down.remaining - dt);
  return down.remaining <= 1e-6 ? 'respawn' : 'waiting';
}
