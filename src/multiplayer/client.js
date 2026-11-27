import { ARMOR, FEET_GEAR, MATERIAL, MATERIAL_IDS, normalizeAppearance, normalizeSnorkel, WALK_CYCLE_DISTANCE } from '../content.js';
import { SPELL_ITEMS } from '../spells.js';
import { CRAWL_HEIGHT, PLAYER_SIZE } from '../gameplay/player.js';
import { isEditableTile } from '../world.js';
import { COLS, ORIGINAL_WEST_EXTENSION, ROWS, TILE, WEST_EXTENSION, WORLD_VERSION, clamp } from '../world/generation.js';
import { caveClimbs, caveStructures } from '../world/island-cave.js';

const roomCodePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const poseOffset = (WEST_EXTENSION - ORIGINAL_WEST_EXTENSION) * TILE;
const peerExpiry = 5000;
const maxPeers = 64;
const maxPeerVelocity = 300;
const climbsByColumn = new Map([
  ...caveClimbs.map(([column, , , kind]) => [column, { tx: column + WEST_EXTENSION, kind }]),
  ...caveStructures.filter(([kind]) => kind === 'shaft' || kind === 'headframe')
    .map(([kind, column, floor]) => [column, { tx: column + WEST_EXTENSION, kind, floor }]),
]);
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
    Number.isFinite(payload.x) && payload.x >= -poseOffset && payload.x <= COLS * TILE - poseOffset &&
    Number.isFinite(payload.y) && payload.y >= 0 && payload.y <= ROWS * TILE &&
    (payload.facing === 1 || payload.facing === -1) &&
    Number.isFinite(payload.dx) && Math.abs(payload.dx) <= maxPeerVelocity &&
    Number.isFinite(payload.dy) && Math.abs(payload.dy) <= maxPeerVelocity;
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
    const x = payload.x + poseOffset;
    const old = peers.get(payload.id);
    if (!old && peers.size >= maxPeers) return;
    const height = payload.crawling === true ? CRAWL_HEIGHT : PLAYER_SIZE.height;
    peers.set(payload.id, {
      ...PLAYER_SIZE, height, walkPhase: old?.walkPhase ?? 0,
      grounded: typeof payload.grounded === 'boolean' ? payload.grounded : payload.dy === 0,
      climb: climbsByColumn.get(payload.climbColumn) ?? null,
      id: payload.id, dx: payload.dx, dy: payload.dy, facing: payload.facing,
      x: old?.x ?? x, y: old ? old.y + old.height - height : payload.y,
      targetX: x, targetY: payload.y, seenAt: performance.now(),
      snorkel: normalizeSnorkel(payload.snorkel ??
        (payload.helmet === true ? (payload.reinforcedHelmet === true ? 'reinforced-helmet' : 'swimming-helmet') : null)),
      armor: Object.hasOwn(ARMOR, payload.armor) ? payload.armor : null,
      feet: Object.hasOwn(FEET_GEAR, payload.feet) ? payload.feet : null,
      appearance: normalizeAppearance(payload.appearance),
      heldTome: SPELL_ITEMS[payload.heldTome]?.form === 'tome' ? payload.heldTome : null,
      damageSequence: Number.isSafeInteger(payload.damageSequence) && payload.damageSequence >= 0 ? payload.damageSequence : 0,
      aegisTime: Number.isFinite(payload.aegisTime) ? clamp(payload.aegisTime, 0, 8) : 0,
      aegisFacing: payload.aegisFacing === -1 ? -1 : 1,
      catching: payload.catching === true,
      spinachTime: Number.isFinite(payload.spinachTime) ? clamp(payload.spinachTime,0,14) : 0,
      beastDrinkTime: Number.isFinite(payload.beastDrinkTime) ? clamp(payload.beastDrinkTime,0,.7) : 0,
      beastTime: Number.isFinite(payload.beastTime) ? clamp(payload.beastTime,0,12) : 0,
      feastPulse: payload.feastPulse && ['spinach','garlic','carrot'].includes(payload.feastPulse.food) &&
        roomCodePattern.test(payload.feastPulse.id ?? '') && Number.isFinite(payload.feastPulse.x) && Number.isFinite(payload.feastPulse.y)
        ? {id:payload.feastPulse.id,food:payload.feastPulse.food,x:payload.feastPulse.x+poseOffset,y:payload.feastPulse.y,remaining:clamp(Number(payload.feastPulse.remaining)||0,0,1.5)} : null,
      downed: roomCodePattern.test(payload.downed?.id ?? '') && Number.isFinite(payload.downed?.remaining)
        ? { id: payload.downed.id, remaining: clamp(payload.downed.remaining, 0, 20),
            progress: Number.isFinite(payload.downed.progress) ? clamp(payload.downed.progress, 0, 3) : 0,
            reviver: roomCodePattern.test(payload.downed.reviver ?? '') ? payload.downed.reviver : null } : null,
      reviveTarget: roomCodePattern.test(payload.reviveTarget ?? '') ? payload.reviveTarget : null,
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
    tick(now, dt, player, snorkel, reviveTarget = null, held = null) {
      const pose = {
        id: peerId,
        x: Math.round(player.x - poseOffset), y: Math.round(player.y),
        // Keep poses compatible with clients that cap animation velocity at 300.
        dx: clamp(Math.round(player.dx), -maxPeerVelocity, maxPeerVelocity),
        dy: clamp(Math.round(player.dy), -maxPeerVelocity, maxPeerVelocity),
        facing: player.facing, grounded: player.grounded, snorkel, appearance: player.appearance,
        armor: player.armor,
        heldTome: SPELL_ITEMS[held]?.form === 'tome' ? held : null,
        damageSequence: player.damageSequence ?? 0,
        aegisTime: Math.ceil((player.aegisTime || 0) * 4) / 4,
        aegisFacing: player.aegisFacing ?? 1,
        catching: Boolean(player.catching),
        spinachTime: Math.ceil((player.spinachTime||0)*4)/4,
        beastDrinkTime: Math.min(.7, Math.ceil((player.beastDrinkTime||0)*10)/10),
        beastTime: Math.ceil((player.beastTime||0)*4)/4,
        feastPulse: player.feastPulse ? {...player.feastPulse,x:player.feastPulse.x-poseOffset} : null,
        downed: player.downed ?? null,
        reviveTarget: player.downed ? null : reviveTarget,
        feet: player.feet,
        crawling: player.height === CRAWL_HEIGHT,
        climbColumn: player.climb ? player.climb.tx - WEST_EXTENSION : null,
      };
      if (connected && now - lastBroadcast >= 125) {
        const fingerprint = JSON.stringify(pose);
        if (fingerprint !== lastPose || now - lastBroadcast >= 1000 || pose.reviveTarget) {
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
        if(peer.feastPulse) { peer.feastPulse.remaining -= dt; if(peer.feastPulse.remaining <= 0) peer.feastPulse = null; }
        peer.spinachTime = Math.max(0,(peer.spinachTime||0)-dt);
        peer.beastDrinkTime = Math.max(0,(peer.beastDrinkTime||0)-dt);
        peer.beastTime = Math.max(0,(peer.beastTime||0)-dt);
        peer.aegisTime = Math.max(0, (peer.aegisTime || 0) - dt);
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
