import { MATERIAL, MATERIAL_IDS, normalizeAppearance, WALK_CYCLE_DISTANCE } from '../content.js';
import { CRAWL_HEIGHT, PLAYER_SIZE } from '../gameplay/player.js';
import { isEditableTile } from '../world.js';
import { COLS, ROWS, TILE, WEST_EXTENSION, WORLD_VERSION } from '../world/generation.js';

const roomCodePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const peerExpiry = 5000;
const maxPeers = 64;
let clientPromise;

export function roomCode(value) {
  const code = roomCodePattern.test(value) ? value : new URLSearchParams(value.split('#')[1] ?? '').get('room');
  return roomCodePattern.test(code ?? '') ? code.toLowerCase() : null;
}

function getClient(config) {
  clientPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../../vendor/supabase.js', import.meta.url);
    script.onload = () => {
      try {
        resolve(globalThis.supabase.createClient(config.url, config.publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }));
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error('Could not load multiplayer.'));
    document.head.append(script);
  }).catch((error) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

async function rpc(client, name, params) {
  const { data, error } = await client.rpc(name, params).abortSignal(AbortSignal.timeout(7500));
  if (error) throw error;
  return data;
}

function validPeer(payload) {
  return payload && roomCodePattern.test(payload.id) &&
    Number.isFinite(payload.x) && payload.x >= 0 && payload.x <= COLS * TILE &&
    Number.isFinite(payload.y) && payload.y >= 0 && payload.y <= ROWS * TILE &&
    (payload.facing === 1 || payload.facing === -1) &&
    Number.isFinite(payload.dx) && Math.abs(payload.dx) <= 300 &&
    Number.isFinite(payload.dy) && Math.abs(payload.dy) <= 300;
}

export async function connectRoom(config, invite, handlers) {
  const client = await getClient(config);
  const snapshot = invite
    ? await rpc(client, 'aquaria_room_snapshot', { invite, after_revision: 0 })
    : await rpc(client, 'aquaria_create_room', {});
  if (!snapshot) throw new Error('Room not found. Check the invite link.');
  if (snapshot.worldVersion !== WORLD_VERSION) throw new Error('This room uses a different world version.');

  const id = snapshot.id;
  const joinedAt = performance.now();
  const roomAge = Number(snapshot.age) || 0;
  const peerId = crypto.randomUUID();
  const channel = client.channel('aquaria:' + snapshot.topic, { config: { broadcast: { ack: false, self: false } } });
  const peers = new Map();
  const versions = new Map();
  let cursor = 0;
  let connected = false;
  let closed = false;
  let syncing = false;
  let syncFailed = false;
  let nextSync = 0;
  let lastBroadcast = 0;
  let lastPose = '';

  const tileKey = (x, y) => x + ',' + y;

  function patch(tile) {
    if (!tile || closed || !Object.hasOwn(MATERIAL, tile.material)) return;
    const tx = tile.x + WEST_EXTENSION;
    if (!isEditableTile(tx, tile.y)) return;
    const key = tileKey(tx, tile.y);
    if (tile.revision <= (versions.get(key) ?? 0)) return;
    versions.set(key, tile.revision);
    handlers.tile(tx, tile.y, MATERIAL[tile.material]);
  }

  async function sync() {
    if (syncing || closed || performance.now() < nextSync) return;
    syncing = true;
    nextSync = performance.now() + 650;
    try {
      const next = await rpc(client, 'aquaria_room_snapshot', { invite: id, after_revision: cursor });
      if (closed) return;
      if (!next) throw new Error('Room unavailable.');
      for (const tile of next.tiles) patch(tile);
      cursor = next.revision;
      if (syncFailed) handlers.status(connected ? 'Invite a friend with this link.' : 'Live player positions are reconnecting.');
      syncFailed = false;
    } catch {
      if (!closed) {
        syncFailed = true;
        handlers.status('Could not sync terrain. Retrying…');
      }
    } finally {
      syncing = false;
    }
  }

  function forgetPeer(id) {
    if (peers.delete(id)) handlers.count(peers.size + 1);
  }

  function broadcast(event, payload) {
    if (connected && !closed) void channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  }

  channel.on('broadcast', { event: 'pose' }, ({ payload }) => {
    if (closed || !validPeer(payload) || payload.id === peerId) return;
    const old = peers.get(payload.id);
    if (!old && peers.size >= maxPeers) return;
    const height = payload.crawling === true ? CRAWL_HEIGHT : PLAYER_SIZE.height;
    peers.set(payload.id, {
      ...PLAYER_SIZE, height, walkPhase: old?.walkPhase ?? 0,
      grounded: typeof payload.grounded === 'boolean' ? payload.grounded : payload.dy === 0,
      id: payload.id, dx: payload.dx, dy: payload.dy, facing: payload.facing,
      x: old?.x ?? payload.x, y: old ? old.y + old.height - height : payload.y,
      targetX: payload.x, targetY: payload.y, seenAt: performance.now(),
      tank: payload.tank === true,
      helmet: payload.helmet === true,
      appearance: normalizeAppearance(payload.appearance),
    });
    if (!old) handlers.count(peers.size + 1);
  });
  channel.on('broadcast', { event: 'leave' }, ({ payload }) => forgetPeer(payload?.id));
  channel.on('broadcast', { event: 'terrain' }, () => { void sync(); });
  channel.subscribe((status) => {
    if (closed) return;
    connected = status === 'SUBSCRIBED';
    if (connected) {
      handlers.status('Invite a friend with this link.');
      void sync();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      handlers.status('Live player positions are reconnecting.');
    }
  });

  for (const tile of snapshot.tiles) patch(tile);
  cursor = snapshot.revision;
  const interval = setInterval(sync, 3000);

  return {
    id,
    worldAge: (now) => roomAge + Math.max(0, now - joinedAt) / 1000,
    async edit(action) {
      const key = tileKey(action.tx, action.ty);
      const operation = crypto.randomUUID();
      const params = {
        invite: id, tile_x: action.tx - WEST_EXTENSION, tile_y: action.ty, next_material: MATERIAL_IDS[action.after],
        expected_revision: versions.get(key) ?? 0, operation,
      };

      // Retry the same operation ID if a response was lost after Postgres committed it.
      let response;
      try {
        response = await rpc(client, 'aquaria_edit_room_tile', params);
      } catch (error) {
        if (closed || error.code === '22023' || error.code === 'P0002') throw error;
        response = await rpc(client, 'aquaria_edit_room_tile', params);
      }
      if (closed) return false;
      patch(response.tile);
      if (response.accepted) broadcast('terrain', {});
      return response;
    },
    tick(now, dt, player, tank, helmet = false) {
      const pose = {
        id: peerId,
        x: Math.round(player.x), y: Math.round(player.y), dx: Math.round(player.dx), dy: Math.round(player.dy),
        facing: player.facing, grounded: player.grounded, tank, helmet, appearance: player.appearance,
        crawling: player.height === CRAWL_HEIGHT,
      };
      if (connected && now - lastBroadcast >= 125) {
        const fingerprint = JSON.stringify(pose);
        if (fingerprint !== lastPose || now - lastBroadcast >= 1000) {
          lastBroadcast = now;
          lastPose = fingerprint;
          broadcast('pose', pose);
        }
      }
      for (const [remoteId, peer] of peers) {
        if (now - peer.seenAt > peerExpiry) {
          forgetPeer(remoteId);
          continue;
        }
        const blend = Math.min(1, dt * 14);
        const horizontal = (peer.targetX - peer.x) * blend;
        peer.x += horizontal;
        if (peer.grounded) peer.walkPhase = (peer.walkPhase + Math.abs(horizontal) / WALK_CYCLE_DISTANCE) % 1;
        peer.y += (peer.targetY - peer.y) * blend;
      }
      return peers.values();
    },
    close() {
      broadcast('leave', { id: peerId });
      closed = true;
      clearInterval(interval);
      void client.removeChannel(channel).catch(() => {});
    },
  };
}
