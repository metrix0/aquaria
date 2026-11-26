import { ringCooldown, stepRootWave, useRootRing } from '../src/gameplay/root-ring.js';
import { equippedHook, hasHook, useGrapplingHook } from '../src/gameplay/hook.js';
import { wakeMimic } from '../src/gameplay/enemies/mimic.js';
import { isTrapIntact, stepCaveTraps, swingHead } from '../src/gameplay/cave-traps.js';
import { GROVE_FLOOR_GAP, ISLAND_DEEPSTONE_ROW, ROOT_GROVE, groveDistance, groveFloor, groveGroundGrowth, groveMossDistance, inRootGrove, isDryIslandCave, isDungeonMasonry, isGrovePool, mineDecks } from '../src/world/island-cave.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterRenderer } from '../src/character.js';
import { ARMOR, ARROW, BOW, BROKEN_PICKAXE, CAPTAINS_CUTLASS, CHEST_SIZE, COBALT_SNORKEL, COBALT_SPEAR, COOKED_CRAB, COOKED_FISH, COPPER_PICKAXE, COPPER_SNORKEL, COPPER_SPEAR, DIVING_FIN, FIREPLACE, IRON_PICKAXE, IRON_SNORKEL, IRON_SWORD, KELP_DRESSING, KRAKEN_CHEST_ID, MATERIAL, POISON_ARROW, POISON_NEEDLE, RAW_CRAB, RAW_FISH, SNORKEL_CHEST_ID, SPEAR, STRING, WOODEN_DOOR, WORKBENCH } from '../src/content.js';
import { updateEnemySpawns } from '../src/gameplay/enemies/enemy-fish.js';
import { caveEnemySpecs, damageMob, jellyfishShockRadius, resetHostiles, stepCaveEnemy, stepCaveHazard, stepMobs, targetMobAt } from '../src/gameplay/mobs.js';
import { KRAKEN_DEATH_DURATION, krakenBarrierX } from '../src/gameplay/enemies/kraken.js';
import { createScreenShake } from '../src/gameplay/screen-shake.js';
import { stepWreckGhost } from '../src/gameplay/enemies/wreck-ghost.js';
import { isInsideShipwreck } from '../src/world/shipwreck.js';
import { collides, movePlayer, playerHeadInWater, playerInWater, playerStatusEffects, PLAYER_SIZE, takeDamage, toggleGodMode, updateOxygen } from '../src/gameplay/player.js';
import { EQUIPMENT_ITEMS, GRAPPLING_HOOK, Inventory, ITEMS } from '../src/inventory.js';
import { createItemsMenu, itemCategory } from '../src/items-menu.js';
import { advanceMining, applyTerrain, canCraftItem, chestAt, commitTileAction, createGame, craftItem, equippedFeet, fireplaceAt, grantItem, moveInventoryStack, nearestItem, oxygenCapacity, planTileAction, resetRoomProgress, stepGame, targetTile, useDressing, useFood, useWeapon, workbenchAt } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { createRenderer } from '../src/render.js';
import { CHUNK_SIZE, buildCellFree, createWorld, editTile, inWater, isTreeStanding, tileAt, waterTileAt } from '../src/world.js';
import { CAVE_SYSTEM, COLS, EAST_EXTENSION, exposedUndergroundVeins, ISLAND_CAVE, JUNGLE_FADE_END_COLUMN, JUNGLE_FADE_START_COLUMN, JUNGLE_ISLAND, KRAKEN_COLUMN, ORIGINAL_COLS, ROWS, SPAWN, TILE, WATER, WATER_ROW, WEST_EXTENSION, generateCaveSystem, groundAt, isDeepstoneAt, undergroundRockBlendAt, waterwayAt } from '../src/world/generation.js';
import { jungleVillageStructures } from '../src/world/jungle-village.js';
import { JUNGLE_CAVE, isDryJungleCave, jungleMossProgress, jungleScriptureProgress } from '../src/world/jungle-cave.js';
import { FROG_PROXIMITY_RANGE } from '../src/gameplay/enemies/frog-cultist.js';

test('climbs hang straight down from real ledge edges without carved terrain', () => {
  const world = createWorld();
  assert.ok(world.caveClimbs.length >= 16, 'most tiers have a usable edge');
  for (const { tx, top, bottom, path } of world.caveClimbs) {
    assert.equal(path, undefined, 'no zigzag path');
    assert.ok(bottom - top >= 6, 'a usable vertical drop');
    assert.equal(tileAt(world, tx, top), MATERIAL.air);
    assert.equal(tileAt(world, tx, top + 1), MATERIAL.air);
    assert.ok(tileAt(world, tx - 1, top) || tileAt(world, tx + 1, top) ||
      tileAt(world, tx - 1, top + 1) || tileAt(world, tx + 1, top + 1),
      'the upper anchor touches an actual ledge edge');
    for (let y = top; y <= bottom; y++) {
      assert.equal(tileAt(world, tx, y), MATERIAL.air, 'rope must not intersect rock');
    }
  }
});

test('every cave rope and ladder can be descended vertically without touching rock', () => {
  const { world, player } = createGame();
  for (const route of world.caveClimbs) {
    const originalX = (route.tx + .5) * TILE;
    Object.assign(player, {
      x: originalX, y: route.top * TILE, dx: 0, dy: 0,
      grounded: false, climb: null, stun: 0, confused: 0,
      neurotoxin: 0, flightOrigin: null,
    });
    assert.equal(collides(world, player.x, player.y), false);
    for (let frame = 0; frame < (route.bottom - route.top + 5) * 18; frame++) {
      if (player.y / TILE >= route.bottom - 1.6) break;
      movePlayer(world, player, { down: true }, 1 / 60);
    }
    assert.ok(player.y / TILE >= route.bottom - 1.6,
      `${route.kind} at ${route.tx - WEST_EXTENSION}, ${route.top} is traversable`);
    assert.equal(player.x, originalX, 'climbing is perfectly vertical');
    assert.equal(collides(world, player.x, player.y), false);
  }
});

test('a straight cave rope can be climbed without crossing rock', () => {
  const { world, player } = createGame();
  const rope = world.caveClimbs.find(({ top, kind }) => kind === 'rope' && top > 50 && top < 85);
  assert.ok(rope);
  Object.assign(player, { x: (rope.tx + .5) * TILE, y: rope.top * TILE,
    dx: 0, dy: 0, grounded: false });
  assert.equal(collides(world, player.x, player.y), false);
  for (let frame = 0; frame < 140; frame++) movePlayer(world, player, { down: true }, 1 / 60);
  assert.ok(player.y >= (rope.top + 6) * TILE, 'descend at least 6 blocks');
  assert.equal(collides(world, player.x, player.y), false);
});

test('a late ledge jump works briefly and uses up the grace period', () => {
  const dt = 1 / 60;
  const column = Math.floor(SPAWN.x / TILE);
  const platformRow = 7;
  const jump = { right: true, up: true, jump: true };

  for (const delay of [3, 7]) {
    const { world, player } = createGame();
    assert.ok(editTile(world, column, platformRow, MATERIAL.stone));
    Object.assign(player, { x: (column + 1) * TILE - 2, y: platformRow * TILE - player.height });
    movePlayer(world, player, {}, dt);
    assert.equal(player.grounded, true);
    for (let frame = 0; frame < 20 && player.grounded; frame++) movePlayer(world, player, { right: true }, dt);
    assert.equal(player.grounded, false);
    for (let frame = 0; frame < delay; frame++) movePlayer(world, player, { right: true }, dt);

    movePlayer(world, player, jump, dt);
    if (delay === 3) {
      assert.ok(player.dy < -200);
      const launchSpeed = player.dy;
      movePlayer(world, player, jump, dt);
      assert.ok(player.dy > launchSpeed);
    } else {
      assert.ok(player.dy > 0);
    }
  }
});

test('dry falls keep accelerating after five tiles and stop safely at the floor', () => {
  const { world, player } = createGame();
  const startY = player.y - 10 * TILE;
  player.y = startY;

  for (let i = 0; i < 20; i++) movePlayer(world, player, {}, 1 / 60);
  assert.equal(player.dy, 170);
  assert.ok(player.y - startY < 2 * TILE);

  for (let i = 0; i < 12; i++) movePlayer(world, player, {}, 1 / 60);
  assert.ok(player.y - startY >= 4.5 * TILE);
  const earlyFallSpeed = player.dy;
  for (let i = 0; i < 10; i++) movePlayer(world, player, {}, 1 / 60);
  assert.ok(player.dy > earlyFallSpeed * 1.2);

  for (let i = 0; i < 30 && !player.grounded; i++) movePlayer(world, player, {}, 1 / 60);
  assert.equal(player.grounded, true);
  assert.equal(player.dy, 0);
  assert.ok(Math.abs(player.y - SPAWN.y) < 0.02);
  assert.equal(collides(world, player.x, player.y), false);
});

test('hard landings apply damage once, scale with distance, and can be fatal', () => {
  for (const [x, y, expectedDamage] of [
    [SPAWN.x, SPAWN.y - 8 * TILE, 0],
    [SPAWN.x, SPAWN.y - 10 * TILE, 8],
    [3000 + (WEST_EXTENSION - 108) * TILE, 2665, 48],
    [3000 + (WEST_EXTENSION - 108) * TILE, 2385, 100],
  ]) {
    const game = createGame();
    const { world, player } = game;
    world.mobs = [];
    world.caveTraps = [];
    Object.assign(player, { x, y });
    let note;
    for (let i = 0; i < 150 && !player.grounded; i++) {
      note = stepGame(game, {}, 1 / 60);
    }

    assert.equal(player.grounded, true);
    assert.equal(player.health, 100 - expectedDamage);
    if (expectedDamage === 100) {
      assert.match(note, /Fatal fall/);
      assert.notEqual(game.player, player);
      assert.equal(game.player.x, SPAWN.x);
      assert.equal(game.player.health, 100);
    } else {
      assert.equal(note, expectedDamage ? `Hard landing. −${expectedDamage} health` : undefined);
      assert.equal(stepGame(game, {}, 1 / 60), undefined);
      assert.equal(player.health, 100 - expectedDamage);
    }
  }
});

test('landing in swimmable water and grabbing a rope both break a long fall', () => {
  const game = createGame();
  const { world, player } = game;
  world.mobs = [];
  world.caveTraps = [];
  const oceanColumn = 2;
  assert.equal(editTile(world, oceanColumn, WATER_ROW + 1, MATERIAL.stone), true);
  Object.assign(player, { x: (oceanColumn + 0.5) * TILE, y: 0 });
  for (let i = 0; i < 120 && !player.grounded; i++) stepGame(game, {}, 1 / 60);
  assert.equal(player.grounded, true);
  assert.equal(playerInWater(world, player), true);
  assert.equal(player.health, 100);

  Object.assign(player, { x: SPAWN.x, y: 0, dy: 0, grounded: false });
  const rope = { tx: Math.floor(SPAWN.x / TILE), top: 8, bottom: 11, kind: 'rope' };
  world.caveClimbs = [rope];
  for (let i = 0; i < 50 && player.y < 8.5 * TILE; i++) stepGame(game, {}, 1 / 60);
  assert.ok(player.y >= 8.5 * TILE && !player.grounded);
  stepGame(game, { up: true }, 1 / 60);
  assert.equal(player.climb, rope);
  stepGame(game, { right: true }, 1 / 60);
  for (let i = 0; i < 60 && !player.grounded; i++) stepGame(game, {}, 1 / 60);
  assert.equal(player.grounded, true);
  assert.equal(player.health, 100);
});

test('a climbing character renders both hands and the equipped ring', () => {
  const { world, player } = createGame();
  const rope = world.caveClimbs.find(({ kind }) => kind === 'rope');
  Object.assign(player, { x: (rope.tx + .5) * TILE, y: (rope.top + 4) * TILE });
  movePlayer(world, player, { up: true }, 1 / 60);
  assert.equal(player.climb, rope);

  const colors = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, scale() {},
    fillRect() { colors.push(this.fillStyle); },
  };
  createCharacterRenderer(ctx)(player, player.appearance, { ring: true });
  assert.ok(colors.includes('#a8f184'));
});

test('God mode flies into solid terrain and exits safely without saving the flight position', () => {
  const game = createGame();
  const { world, player } = game;
  const before = encodeSave(game).player;
  const startY = player.y;

  assert.equal(toggleGodMode(world, player), true);
  for (let i = 0; i < 25; i++) stepGame(game, { down: true }, 1 / 60);
  assert.ok(player.y > startY + 5 * TILE);
  assert.ok(collides(world, player.x, player.y));
  assert.deepEqual(encodeSave(game).player, before);

  assert.equal(toggleGodMode(world, player), false);
  assert.equal(player.y, startY);
  assert.equal(collides(world, player.x, player.y), false);
  for (let i = 0; i < 25; i++) stepGame(game, { down: true }, 1 / 60);
  assert.ok(player.y < startY + TILE);

  toggleGodMode(world, player);
  stepGame(game, { up: true }, 1 / 60);
  const landingY = player.y;
  toggleGodMode(world, player);
  assert.equal(player.y, landingY);
});

test('God mode speed scales flight while preserving diagonal and normal movement', () => {
  const { world, player } = createGame();
  const normal = { ...player };
  movePlayer(world, player, { right: true, up: false, down: false, left: false, flightSpeedMultiplier: 8 }, 1 / 60);
  movePlayer(world, normal, { right: true, up: false, down: false, left: false }, 1 / 60);
  assert.deepEqual(player, normal);

  toggleGodMode(world, player);
  movePlayer(world, player, { right: true }, 1 / 60);
  const defaultSpeed = player.dx;
  movePlayer(world, player, { right: true, flightSpeedMultiplier: 8 }, 1 / 60);
  assert.equal(player.dx, defaultSpeed * 8);
  movePlayer(world, player, { right: true, flightSpeedMultiplier: 0.5 }, 1 / 60);
  assert.equal(player.dx, defaultSpeed / 2);
  movePlayer(world, player, { right: true, down: true, flightSpeedMultiplier: 8 }, 1 / 60);
  assert.ok(Math.abs(Math.hypot(player.dx, player.dy) - defaultSpeed * 8) < 1e-9);
});

test('God mode ignores enemy projectiles and oxygen loss while underwater', () => {
  const game = createGame();
  const { world, player } = game;
  player.x = TILE * 2.5;
  player.y = WATER + 2 * TILE;
  world.mobs = [];
  assert.ok(inWater(world, player.x, player.y + 5));
  world.projectiles.push({ x: player.x, y: player.y + 12, dx: 0, dy: 0, radius: 4, life: 1, phase: 0, color: '#a84' });
  const { health, oxygen } = player;

  toggleGodMode(world, player);
  stepGame(game, {}, 1 / 60);
  assert.equal(world.projectiles.length, 1);
  assert.equal(player.health, health);
  assert.equal(player.oxygen, oxygen);

  toggleGodMode(world, player);
  stepGame(game, {}, 1 / 60);
  assert.equal(world.projectiles.length, 0);
  assert.ok(player.health < health);
  assert.ok(player.oxygen < oxygen);
});

test('auto-generated cave system is deterministic, multi-tiered, and reachable from the ocean', () => {
  const world = createWorld();
  assert.equal(world.chunks.size, 0);

  let deepstone = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const material = tileAt(world, x, y);
      if (material === MATERIAL.deepstone) {
        assert.ok(y >= 80 && y < ROWS - 2);
        deepstone++;
      }
      if (groundAt(x) < WATER_ROW && y === groundAt(x)) {
        assert.notEqual(material, MATERIAL.air);
      }
    }
  }
  assert.ok(deepstone > 0);

  // Verify seed determinism and variation across seeds.
  assert.deepEqual(generateCaveSystem(61).chambers, CAVE_SYSTEM.chambers);
  assert.notDeepEqual(generateCaveSystem(99).chambers, CAVE_SYSTEM.chambers);

  // BFS from ocean surface to verify every cave tier and air vent is reachable by swimming.
  const visited = new Uint8Array(COLS * ROWS);
  const queue = [];
  for (let x = 0; x < COLS; x++) {
    if (waterTileAt(world, x, WATER_ROW)) {
      visited[WATER_ROW * COLS + x] = 1;
      queue.push(x, WATER_ROW);
    }
  }
  for (let head = 0; head < queue.length; head += 2) {
    const x = queue[head];
    const y = queue[head + 1];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || nx >= COLS || ny < WATER_ROW || ny >= ROWS - 2) continue;
      const idx = ny * COLS + nx;
      if (visited[idx] || !waterTileAt(world, nx, ny)) continue;
      visited[idx] = 1;
      queue.push(nx, ny);
    }
  }

  for (const tier of [0, 1, 2]) {
    const tierChambers = CAVE_SYSTEM.chambers.filter((c) => c.tier === tier);
    assert.ok(tierChambers.length >= 2);
    assert.ok(tierChambers.every((c) => {
      for (let y = c.minY; y <= c.maxY; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          if (visited[y * COLS + x]) return true;
        }
      }
      return false;
    }), `expected all tier ${tier} chambers to be reachable from the ocean`);
  }

  assert.ok(world.vents.length >= 5);
  for (const vent of world.vents) {
    const tx = Math.floor(vent.x / TILE);
    const ty = Math.floor((vent.y - TILE) / TILE);
    assert.equal(visited[ty * COLS + tx], 1);
  }

  for (const id of ['fish-cave', 'squid-deep']) {
    const mob = world.mobs.find((entry) => entry.id === id);
    assert.ok(mob, `expected ${id} mob`);
    assert.equal(inWater(world, mob.x, mob.y), true);
  }
});

test('the cave tiers stay dry outside the grove river and two marked waterways', () => {
  const world = createWorld();
  const center = WEST_EXTENSION + ISLAND_CAVE.center;
  const surface = groundAt(center);
  let ceiling = surface;
  while (tileAt(world, center, ceiling)) ceiling++;
  assert.equal(ceiling - surface, 16);

  const cells = [[center, ceiling]];
  const visited = new Set([ceiling * COLS + center]);
  let left = center, right = center, deepest = ceiling;
  const outlets = new Set();
  for (const [x, y] of cells) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    deepest = Math.max(deepest, y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        assert.ok(ty >= groundAt(tx), `cave too close to the surface at ${tx},${ty}`);
        if (waterTileAt(world, tx, ty) && !isGrovePool(tx - WEST_EXTENSION, ty)) {
          assert.ok(ty >= 612 && waterwayAt(tx, ty), `unintended flooded opening at ${tx},${ty}`);
          if (Math.abs(dx) + Math.abs(dy) === 1) outlets.add(tx - WEST_EXTENSION);
        }
        const key = ty * COLS + tx;
        if (Math.abs(dx) + Math.abs(dy) !== 1 || visited.has(key) || tileAt(world, tx, ty) || waterTileAt(world, tx, ty)) continue;
        visited.add(key);
        cells.push([tx, ty]);
      }
    }
  }
  assert.ok(right - left >= 180);
  assert.ok(ISLAND_DEEPSTONE_ROW - ceiling >= 300);
  assert.equal(deepest, 611);
  assert.ok(deepest - ISLAND_DEEPSTONE_ROW >= 280);
  for (const [x, y] of [[-24, 110], [139, 102], [43, 316], [123, 344], [-12, 427], [118, 557], [60, 611], [100, 611]]) {
    assert.ok(visited.has(y * COLS + x + WEST_EXTENSION), `${x},${y} is reachable`);
  }

  // The middle of Caves has playable chambers at several depths.
  for (const [x, floor, minHeadroom] of [[61, 65, 15], [54, 117, 18], [60, 161, 14],
    [55, 195, 16], [31, 242, 18], [57, 273, 14], [69, 318, 10]]) {
    for (let y = floor - minHeadroom; y < floor; y++) {
      assert.ok(visited.has(y * COLS + x + WEST_EXTENSION) || tileAt(world, x + WEST_EXTENSION, y),
        `chamber at ${x},${floor} is isolated`);
    }
    const open = cells.filter(([tx, y]) => tx === x + WEST_EXTENSION && y >= floor - minHeadroom && y < floor);
    assert.ok(open.length >= minHeadroom - 4, `chamber at ${x},${floor} needs more headroom`);
  }
  for (let x = left; x <= right; x++) {
    for (let y = ceiling; y <= deepest; y++) {
      if (isDryIslandCave(x - WEST_EXTENSION, y) && !tileAt(world, x, y)) {
        assert.ok(visited.has(y * COLS + x), `isolated cave space at ${x},${y}`);
      }
    }
  }

  const westMine = WEST_EXTENSION - 27;
  assert.ok(tileAt(world, westMine, 105), 'solid shelf between two levels of the west mine');
  assert.ok(isDungeonMasonry(74, 353), 'the crossover has a built room');
  assert.equal(isDungeonMasonry(57, 347), false, 'approach stays natural rock');
  assert.ok(tileAt(world, 61 + WEST_EXTENSION, 345), 'rock above the staggered crossover');
  assert.equal(tileAt(world, 61 + WEST_EXTENSION, 352), MATERIAL.air);

  assert.deepEqual([...outlets].sort((a, b) => a - b), [59, 60, 61, 62, 100, 101]);
  for (const item of world.items.filter(({ id }) => /^(island|underground|central-mine)-/.test(id))) {
    const x = Math.floor(item.x / TILE);
    const y = Math.floor(item.y / TILE);
    assert.ok(visited.has(y * COLS + x) && tileAt(world, x, y + 1), `${item.id} has a reachable floor`);
  }

  const submerged = [[60 + WEST_EXTENSION, 612]];
  const wetVisited = new Set();
  for (const [x, y] of submerged) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx;
      const ty = y + dy;
      const key = ty * COLS + tx;
      if (wetVisited.has(key) || !waterTileAt(world, tx, ty)) continue;
      wetVisited.add(key);
      submerged.push([tx, ty]);
    }
  }
  assert.ok(wetVisited.has(651 * COLS + 87 + WEST_EXTENSION));
  assert.ok(wetVisited.has(612 * COLS + 100 + WEST_EXTENSION));
  assert.ok(submerged.every(([x, y]) => waterwayAt(x, y)));

});

test('after digging in, the expanded island cave is walkable and the survey cache persists', () => {
  const game = createGame();
  const { world, player } = game;
  const center = WEST_EXTENSION + ISLAND_CAVE.center;
  const surface = groundAt(center);
  for (let y = surface; tileAt(world, center, y); y++) editTile(world, center, y, MATERIAL.air);
  player.x = (center + 0.5) * TILE;
  player.y = surface * TILE - player.height;

  function walkUntil(reached, { left = false, right = false, climb = false } = {}) {
    for (let frame = 0; frame < 1300 && !reached(); frame++) {
      const up = climb && (player.canShortenJump || (player.grounded && Math.abs(player.dx) < 1.5));
      movePlayer(world, player, { left, right, up, down: false, jump: up && player.grounded }, 1 / 60);
      assert.equal(playerInWater(world, player), false);
    }
    assert.ok(reached());
  }

  walkUntil(() => player.grounded && player.y > WATER);
  const cache = world.items.find(({ id }) => id === 'island-cave-cache');
  walkUntil(() => player.grounded && Math.abs(player.x - cache.x) < TILE / 4, { left: true });
  assert.equal(nearestItem(game), cache);
  assert.equal(chestAt(game, cache.x, cache.y), cache);
  assert.equal(moveInventoryStack(game, cache.id, { group: 'chest', index: 0 }, { group: 'backpack', index: 0 }), true);
  assert.equal(game.inventory.count('copper'), 2);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(nearestItem(restored)?.id, cache.id);
  assert.deepEqual(restored.chests.get(cache.id), Array(CHEST_SIZE).fill(null));
  assert.equal(restored.inventory.count('copper'), 2);
  assert.equal(buildCellFree(restored.world, Math.floor(cache.x / TILE), Math.floor(cache.y / TILE)), false);

  const chamberX = (column) => (column + WEST_EXTENSION + .5) * TILE;
  const restartAtSurvey = () => Object.assign(player, {
    x: (center + .5) * TILE, y: 33 * TILE - player.height, dx: 0, dy: 0,
  });
  restartAtSurvey();
  walkUntil(() => player.x <= chamberX(-26) && player.y > 107 * TILE, { left: true, climb: true });
  assert.ok(player.y < 112 * TILE);

  restartAtSurvey();
  walkUntil(() => player.x >= chamberX(140) && player.y > 100 * TILE, { right: true, climb: true });
  assert.ok(player.y < 105 * TILE);

  // Walk the central route continuously from the survey room into Underground.
  restartAtSurvey();
  for (const [column, direction, minFloor] of [
    [33, 'left', 55], [98, 'right', 108], [29, 'left', 116], [81, 'right', 154], [51, 'left', 184],
    [99, 'right', 225], [45, 'left', 270], [132, 'right', 313], [98.6, 'left', 333], [115, 'right', 343],
  ]) {
    const x = (column + WEST_EXTENSION) * TILE;
    walkUntil(() => direction === 'left' ? player.x <= x : player.x >= x, { [direction]: true, climb: true });
    if (minFloor === 55 && player.y + player.height < minFloor * TILE) {
      // The survey headframe now catches the descent. Drop through its deck.
      for (let frame = 0; frame < 40; frame++) movePlayer(world, player, { down: true }, 1 / 60);
    }
    assert.ok(player.y + player.height >= minFloor * TILE, `reached the room at row ${minFloor}`);
  }

  // The existing Underground crossover still connects the two entrance rooms.
  Object.assign(player, { x: chamberX(45), y: 345 * TILE - player.height, dx: 0, dy: 0 });
  walkUntil(() => player.x >= chamberX(105) && player.grounded, { right: true, climb: true });
  assert.ok(Math.abs(player.y + player.height - 346 * TILE) < 1);

});

test('grove moss spreads sideways while the refuge and water stay unchanged', () => {
  const { column, floor, wallMossReach } = ROOT_GROVE;
  const middle = floor - 9;
  assert.equal(groveDistance(column + 60, middle), 60);
  assert.ok(groveMossDistance(column + 100, middle) < wallMossReach);
  assert.ok(groveMossDistance(column, middle + 100) > wallMossReach);
  assert.ok(groveGroundGrowth(column + 90, middle) > groveGroundGrowth(column, middle + 90));
  assert.equal(inRootGrove(column + ROOT_GROVE.radius + 1, middle), false);
  assert.equal(isDryIslandCave(40, 168), false, 'the earlier roof enlargement was reverted');
  for (let x = GROVE_FLOOR_GAP.left; x <= GROVE_FLOOR_GAP.right; x++) {
    for (let y = GROVE_FLOOR_GAP.row; y < GROVE_FLOOR_GAP.row + 3; y++) {
      assert.equal(isDryIslandCave(x, y), true, `floor gap ${x},${y} is open`);
    }
    assert.equal(isDryIslandCave(x, GROVE_FLOOR_GAP.row + 3), true, 'gap connects to lower passage');
  }
  assert.equal(isDryIslandCave(GROVE_FLOOR_GAP.left - 1, GROVE_FLOOR_GAP.row), false);
  assert.equal(isDryIslandCave(GROVE_FLOOR_GAP.right + 1, GROVE_FLOOR_GAP.row), false);
});

test('the grove river sits one tile deep between dry banks and the satchel', () => {
  const { world, player } = createGame();
  const { approach, column, floor, bank, riverWest, riverEast } = ROOT_GROVE;
  const xAt = (x) => (x + WEST_EXTENSION + .5) * TILE;
  const chest = world.items.find(({ id }) => id === 'island-grove-relics');
  assert.equal(chest.x, xAt(riverWest - 1));
  assert.ok(chest.x < xAt(column));
  assert.equal(floor - bank, 6);
  for (let x = column - 17; x <= approach; x++) {
    const bed = groveFloor(x);
    const tx = x + WEST_EXTENSION;
    if (x >= GROVE_FLOOR_GAP.left && x <= GROVE_FLOOR_GAP.right) assert.equal(tileAt(world, tx, bed), MATERIAL.air);
    else assert.ok(tileAt(world, tx, bed));
    assert.ok(Math.abs(bed - groveFloor(x + 1)) <= 1);
    for (let row = bank - 1; row < bed; row++) {
      assert.equal(tileAt(world, tx, row), MATERIAL.air);
      assert.equal(waterTileAt(world, tx, row), row === floor - 1 && x >= riverWest && x <= riverEast);
    }
  }
  Object.assign(player, { x: xAt(approach), y: bank * TILE - player.height });
  for (let i = 0; i < 720 && player.x > xAt(column); i++) {
    const nearGap = player.x < xAt(GROVE_FLOOR_GAP.right + 1) && player.x > xAt(GROVE_FLOOR_GAP.left - 4);
    movePlayer(world, player, { left: true, up: nearGap, jump: nearGap }, 1 / 60);
  }
  assert.ok(player.x <= xAt(column));
  assert.equal(playerInWater(world, player), false);
  assert.ok(Math.abs(player.y + player.height - floor * TILE) < 1);
});

test('all headframe platforms take the player’s weight', () => {
  const { world, player } = createGame();
  const frame = world.mineDecks.find(({ tx, kind }) => tx === WEST_EXTENSION + 36 && kind === 'headframe');
  for (const { rise } of mineDecks.headframe) {
    const feet = frame.floor * TILE - rise;
    Object.assign(player, { x: (frame.tx + .5) * TILE + 17, y: feet - player.height - 4, dy: 0, dx: 0, climb: null });
    for (let tick = 0; tick < 12; tick++) movePlayer(world, player, {}, 1 / 60);
    assert.ok(player.grounded, 'deck at rise ' + rise);
    assert.ok(Math.abs(player.y + player.height - feet) < .01);
  }
});

test('the island has uneven soil, two small shallow veins, and denser deep iron', () => {
  const world = createWorld();
  const soilBottoms = new Set();
  let copper = 0;
  let iron = 0;
  let deepIron = 0;
  for (let x = 47 + WEST_EXTENSION; x <= 67 + WEST_EXTENSION; x++) {
    let lastSoil = 0;
    for (let y = 11; y <= 613; y++) {
      const material = tileAt(world, x, y);
      if (material === MATERIAL.soil && y < 22) lastSoil = y;
      if (material === MATERIAL.copper && y <= 25) copper++;
      if (material === MATERIAL.iron && y <= 25) iron++;
      if (material === MATERIAL.iron && y >= ISLAND_DEEPSTONE_ROW) deepIron++;
    }
    soilBottoms.add(lastSoil);
  }
  assert.ok(soilBottoms.size >= 4);
  assert.ok(copper >= 3 && copper <= 8);
  assert.ok(iron >= 3 && iron <= 8);
  assert.ok(deepIron > iron);
});

test('the ring casts without a target and recharges across reloads', () => {
  const game = createGame();
  game.progress.ring = 'root-ring';
  Object.assign(game.player, { x: (WEST_EXTENSION + 58.5) * TILE, y: 33 * TILE - game.player.height, facing: -1 });
  game.world.mobs = [];
  assert.equal(useRootRing(game), true);
  assert.equal(game.rootWave.facing, -1);
  assert.equal(game.rootWave.length, 0);
  assert.equal(useRootRing(game), undefined);
  for (let frame = 0; frame < 20; frame++) stepGame(game, {}, 1 / 60);
  assert.ok(game.rootWave.length > 0);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.rootWave, null);
  assert.equal(ringCooldown(restored), ringCooldown(game));
  assert.equal(useRootRing(restored), undefined);
});

test('the root wave stops at rock and damages the first enemy only after lifting it', () => {
  const game = createGame();
  const { player, world } = game;
  game.progress.ring = 'root-ring';
  Object.assign(player, { x: (WEST_EXTENSION + 55.5) * TILE, y: 33 * TILE - player.height, facing: 1 });
  const mob = world.mobs.find(({ kind }) => kind === 'miner');
  Object.assign(mob, { x: player.x + 54, y: 33 * TILE, hurt: 0 });
  world.mobs = [mob];
  const health = mob.health;
  const y = mob.y;
  const advance = (frames) => {
    for (let i = 0; i < frames; i++) stepGame(game, {}, 1 / 60);
  };

  const wall = Math.floor((player.x + 28) / TILE);
  editTile(world, wall, 32, MATERIAL.stone);
  assert.equal(useRootRing(game), true);
  advance(30);
  assert.equal(mob.health, health);
  assert.equal(mob.rooted ?? 0, 0);
  advance(1070);
  assert.equal(ringCooldown(game), 0);

  editTile(world, wall, 32, MATERIAL.air);
  assert.equal(useRootRing(game), true);
  advance(10);
  assert.equal(mob.health, health);
  advance(20);
  assert.equal(mob.health, health);
  assert.ok(mob.rooted > 2);
  assert.ok(mob.y < y - 2);
  advance(10);
  assert.equal(game.rootWave.fade, 1);
  assert.equal(mob.health, health);
  advance(10);
  const suspendedAt = mob.y;
  assert.ok(Math.abs(suspendedAt - (mob.rootBaseY - 20)) < .01);
  assert.equal(mob.health, health - 3);
  advance(210);
  assert.equal(mob.y, suspendedAt);
  assert.ok(mob.rooted > 0);
  assert.equal(game.rootWave, null);
  assert.equal(mob.health, health - 3);
  advance(60);
  assert.equal(mob.rooted, 0);
});

test('the root wave travels toward the mouse pointer even when the character faces away', () => {
  const game = createGame();
  const { player, world } = game;
  game.progress.ring = 'root-ring';
  Object.assign(player, { x: (WEST_EXTENSION + 56.5) * TILE, y: 33 * TILE - player.height, facing: 1 });
  const westMob = world.mobs.find(({ kind }) => kind === 'miner');
  const eastMob = world.mobs.find(({ kind }) => kind === 'spider');
  Object.assign(westMob, { x: player.x - 56, y: 33 * TILE, hurt: 0 });
  Object.assign(eastMob, { x: player.x + 56, y: 33 * TILE, hurt: 0 });
  world.mobs = [westMob, eastMob];
  const westHp = westMob.health;
  const eastHp = eastMob.health;

  // Player faces east (+1), aim pointer diagonally up-left toward westMob.
  assert.equal(useRootRing(game, westMob.x, westMob.y - 12), true);
  assert.equal(game.rootWave.facing, -1);
  assert.ok(game.rootWave.dirX < -0.9);
  for (let i = 0; i < 60; i++) stepGame(game, {}, 1 / 60);

  assert.equal(westMob.health, westHp - 3);
  assert.equal(eastMob.health, eastHp);
  assert.equal(player.facing, 1);
});

test('Root Ring hits high and low targets on its aimed path rather than its launch row', () => {
  for (const vertical of [-1, 1]) {
    const game = createGame();
    const { player, world } = game;
    game.progress.ring = 'root-ring';
    Object.assign(player, { x: (WEST_EXTENSION + 56.5) * TILE, y: 33 * TILE - player.height, facing: -1 });
    const mob = world.mobs.find(({ kind }) => kind === 'miner');
    const launchY = player.y + player.height * .66;
    const targetX = player.x + 5 * TILE;
    const targetY = launchY + vertical * 4 * TILE;
    Object.assign(mob, { x: targetX, y: targetY - caveEnemySpecs.miner.centerY, hurt: 0 });
    world.mobs = [mob];

    // Clear a narrow test corridor; the ray must pass the enemy on its actual y.
    for (let tx = Math.floor((player.x - TILE) / TILE); tx <= Math.ceil((targetX + TILE) / TILE); tx++) {
      for (let ty = Math.floor((Math.min(launchY, targetY) - TILE) / TILE);
        ty <= Math.ceil((Math.max(launchY, targetY) + TILE) / TILE); ty++) {
        editTile(world, tx, ty, MATERIAL.air);
      }
    }

    const health = mob.health;
    assert.equal(useRootRing(game, targetX, targetY), true);
    assert.equal(Math.sign(game.rootWave.dirY), vertical);
    for (let frame = 0; frame < 90 && !game.rootWave.finished; frame++) {
      stepRootWave(game, 1 / 60);
    }
    assert.equal(game.rootWave?.target, mob, 'diagonal cast must bind the target');
    assert.ok(mob.rooted > 0);
    assert.equal(mob.health, health, 'root lift starts before damage');

    // Simulate a completed lift, then check delayed damage.
    mob.rootLift = 0;
    for (let frame = 0; frame < 20; frame++) stepRootWave(game, 1 / 60);
    assert.equal(mob.health, health);
    for (let frame = 0; frame < 15; frame++) stepRootWave(game, 1 / 60);
    assert.equal(mob.health, health - 3);
  }
});

test('cave enemies start on dry floors and archer shots and venom can hurt the player', () => {
  const { player, world } = createGame();
  const foes = world.mobs.filter((mob) => caveEnemySpecs[mob.kind]);
  assert.equal(new Set(foes.map((mob) => mob.kind)).size, 7);
  for (const mob of foes) {
    const x = Math.floor(mob.x / TILE);
    const feet = mob.y / TILE;
    const spec = caveEnemySpecs[mob.kind];
    if (mob.kind !== 'blood-bat') assert.ok(tileAt(world, x, feet), mob.id);
    for (let y = feet - Math.ceil(spec.height / TILE); y < feet; y++) {
      assert.equal(tileAt(world, x, y), MATERIAL.air, mob.id);
      assert.equal(waterTileAt(world, x, y), false, mob.id);
    }
  }
  assert.ok(world.caveStructures.some((structure) => structure.kind === 'skeleton' && structure.floor === ISLAND_CAVE.campFloor));
  assert.ok(!foes.some((mob) => mob.y <= ISLAND_CAVE.campFloor * TILE));
  const archer = foes.find((mob) => mob.id === 'gatehouse-archer');
  Object.assign(player, { x: archer.x - 3 * TILE, y: archer.y - player.height, grounded: true });
  const effects = [];
  for (let i = 0; i < 200 && !world.projectiles.length; i++) stepCaveEnemy(world, player, archer, 1 / 60, effects);
  const [arrow] = world.projectiles;
  assert.equal(arrow?.kind, 'cave-arrow');
  for (let i = 0; i < 90 && stepCaveHazard(world, player, arrow, 1 / 60, effects); i++) {}
  assert.equal(player.health, 88);

  const scorpion = foes.find((mob) => mob.id === 'lower-scorpion');
  const venom = { kind: 'venom', x: scorpion.x, y: scorpion.y - 1, life: 4 };
  Object.assign(player, { x: scorpion.x, y: scorpion.y - player.height, hurt: 0 });
  assert.equal(stepCaveHazard(world, player, venom, 1 / 60, effects), true);
  assert.equal(player.health, 80);
});

test('first cave rock fades gradually into the Undergrounds without changing other biomes', () => {
  const world = createWorld();
  const columns = Array.from({ length: 181 }, (_, i) => WEST_EXTENSION - 30 + i);
  const levels = [300, 315, ISLAND_DEEPSTONE_ROW, 345, 360];
  const proportions = levels.map((row) => {
    let stone = 0;
    let deepstone = 0;
    for (const x of columns) {
      const tile = tileAt(world, x, row);
      if (tile === MATERIAL.stone) stone++;
      if (tile === MATERIAL.deepstone) deepstone++;
    }
    assert.ok(stone + deepstone > 20, `expected visible rock at depth ${row}`);
    return deepstone / (stone + deepstone);
  });

  assert.equal(proportions[0], 0, 'the upper cave stays ordinary stone');
  assert.ok(proportions[1] > 0 && proportions[1] < proportions[2]);
  assert.ok(proportions[2] > 0.2 && proportions[2] < 0.8, 'the old boundary is mixed, not a hard stripe');
  assert.ok(proportions[2] < proportions[3] && proportions[3] < proportions[4]);
  assert.equal(proportions[4], 1, 'the deep Undergrounds become entirely Deepstone');

  assert.equal(undergroundRockBlendAt(WEST_EXTENSION + 60, 300), 0);
  assert.equal(undergroundRockBlendAt(WEST_EXTENSION + 60, 330), 0.5);
  assert.equal(undergroundRockBlendAt(WEST_EXTENSION + 60, 360), 1);
  assert.equal(undergroundRockBlendAt(WEST_EXTENSION + 240, 330), null, 'other biomes use their original geology');
  assert.equal(isDeepstoneAt(WEST_EXTENSION + 240, 330), true);
});

test('Underground iron occurs in small contiguous veins', () => {
  const world = createWorld();
  const visited = new Set();
  let count = 0;
  for (let y = ISLAND_DEEPSTONE_ROW; y < 615; y++) {
    for (let x = WEST_EXTENSION - 28; x < WEST_EXTENSION + 159; x++) {
      if (visited.has(y * COLS + x) || tileAt(world, x, y) !== MATERIAL.iron) continue;
      const vein = [[x, y]];
      visited.add(y * COLS + x);
      for (const [tx, ty] of vein) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          const key = ny * COLS + nx;
          if (visited.has(key) || tileAt(world, nx, ny) !== MATERIAL.iron) continue;
          visited.add(key);
          vein.push([nx, ny]);
        }
      }
      assert.ok(vein.length >= 3 && vein.length <= 7, `vein at ${x},${y} contains ${vein.length}`);
      count++;
    }
  }
  assert.ok(count >= 20);
});

test('Underground ore seams show at floor level without protruding into the passages', () => {
  const world = createWorld();
  let westIron = 0;
  let eastIron = 0;
  const exposed = exposedUndergroundVeins.filter(Boolean);
  assert.ok(exposed.length >= 25, 'existing underground deposits should reach the cave floors');

  for (const cells of exposed) {
    const [surfaceX, surfaceY] = cells[0];
    const material = tileAt(world, surfaceX + WEST_EXTENSION, surfaceY);
    assert.ok([MATERIAL.iron, MATERIAL.copper, MATERIAL.cobalt].includes(material));
    assert.equal(isDryIslandCave(surfaceX, surfaceY - 1), true);
    assert.equal(tileAt(world, surfaceX + WEST_EXTENSION, surfaceY - 1), MATERIAL.air);
    for (const [x, y] of cells) {
      assert.ok(y >= surfaceY, 'ore cannot rise above the cave floor');
      assert.equal(isDryIslandCave(x, y), false, 'ore cannot fill walkable space');
      assert.equal(tileAt(world, x + WEST_EXTENSION, y), material);
    }
    if (material === MATERIAL.iron) {
      if (surfaceX < ISLAND_CAVE.center) westIron++;
      else eastIron++;
    }
  }

  assert.ok(westIron >= 8, 'iron should be visible on western Underground floors');
  assert.ok(eastIron >= 8, 'iron should be visible on eastern Underground floors');
});

test('bear traps can be baited, and both types can be mined and stay broken after reload', () => {
  const game = createGame();
  const { world, player, effects } = game;
  const jaw = world.caveTraps.find((trap) => trap.kind === 'jaws');
  const swing = world.caveTraps.find((trap) => trap.kind === 'swing');
  const x = (jaw.tx + .5) * TILE;
  const y = (jaw.ty + 1) * TILE;
  Object.assign(player, { x, y: y - player.height });
  const miner = world.mobs.find((mob) => mob.kind === 'miner');
  Object.assign(miner, { x, y });
  const hit = [];
  stepCaveTraps(world, player, 0, 1 / 60, effects, (mob) => hit.push(mob));
  assert.equal(jaw.state, 'springing');
  player.y -= 20;
  stepCaveTraps(world, player, .25, .25, effects, (mob) => hit.push(mob));
  assert.deepEqual(hit, [miner]);
  assert.equal(jaw.state, 'spent');
  assert.equal(player.health, 100);

  const head = swingHead(swing, 0);
  Object.assign(player, { x: head.x, y: head.y - player.height / 2 });
  stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
  assert.equal(player.health, 76);

  for (const trap of [jaw, swing]) {
    Object.assign(player, { x: (trap.tx + .5) * TILE, y: trap.ty * TILE });
    const target = targetTile(game, player.x, player.y);
    const result = advanceMining(game, target, null, 2);
    assert.ok(result.progress >= 1);
    commitTileAction(game, result.action);
    assert.equal(isTrapIntact(world, trap), false);
  }
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.ok(restored.world.caveTraps.slice(0, 2).every((trap) => !isTrapIntact(restored.world, trap)));
});

test('underwater caches are above a flooded floor with an air vent nearby', () => {
  const world = createWorld();
  for (const id of ['western-grotto-cache', 'deep-cave-cache']) {
    const cache = world.items.find((item) => item.id === id);
    const x = Math.floor(cache.x / TILE);
    const y = Math.floor(cache.y / TILE);
    assert.equal(waterTileAt(world, x, y), true);
    assert.equal(waterTileAt(world, x, y - 1), true);
    assert.notEqual(tileAt(world, x, y + 1), MATERIAL.air);
    assert.ok(world.vents.some((vent) => Math.hypot(vent.x - cache.x, vent.y - cache.y) <= TILE * 3));
  }
});

test('mining uses the strongest carried pickaxe without changing the selected slot', () => {
  const game = createGame();
  const target = targetTile(game, SPAWN.x, SPAWN.y + TILE * 2);
  const { tx, ty } = target;
  assert.equal(game.inventory.hotbar[0].id, BROKEN_PICKAXE.id);
  game.inventory.hotbar[2] = { id: SPEAR.id, count: 1 };
  editTile(game.world, tx, ty, MATERIAL.stone);
  const withSpear = advanceMining(game, target, null, 0.35, 2);
  assert.equal(withSpear.tool, BROKEN_PICKAXE.id);
  assert.equal(withSpear.progress, 0.5);
  assert.equal(advanceMining(game, target, withSpear, 0.35, 0).progress, 1);

  editTile(game.world, tx, ty, MATERIAL.copper);
  assert.ok(advanceMining(game, target, null, 0.85, 2).progress >= 1);
  const starter = game.inventory.hotbar[0];
  game.inventory.hotbar[0] = null;
  assert.match(advanceMining(game, target, null, 10, 2).blocked, /requires a pickaxe/);
  editTile(game.world, tx, ty, MATERIAL.stone);
  assert.equal(advanceMining(game, target, null, 3.6).progress, 1);
  assert.equal(advanceMining(game, target, null, 1).tool, undefined);
  game.inventory.hotbar[0] = starter;

  for (const material of [MATERIAL.deepstone, MATERIAL.cobalt]) {
    editTile(game.world, tx, ty, material);
    assert.match(advanceMining(game, target, null, 10, 0).blocked, /requires a Copper pickaxe/);
    assert.equal(tileAt(game.world, tx, ty), material);
  }
  assert.equal(craftItem(game, COPPER_PICKAXE, WORKBENCH.id), false);
  game.inventory.add('copper', 3);
  assert.equal(craftItem(game, COPPER_PICKAXE, WORKBENCH.id), true);
  assert.equal(game.inventory.count('copper'), 0);
  assert.equal(game.inventory.count('wood'), 1);
  assert.equal(game.inventory.move({ group: 'hotbar', index: 1 }, { group: 'backpack', index: 0 }), true);
  assert.equal(game.inventory.backpack[0].id, COPPER_PICKAXE.id);

  editTile(game.world, tx, ty, MATERIAL.deepstone);
  const mining = advanceMining(game, target, null, 1.7, 2);
  assert.equal(mining.tool, COPPER_PICKAXE.id);
  assert.ok(mining.progress >= 1);
  commitTileAction(game, mining.action);
  assert.equal(game.inventory.hotbar[2].id, SPEAR.id);
  assert.equal(game.inventory.count('stone'), 1);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(tileAt(restored.world, tx, ty), MATERIAL.air);
  assert.equal(restored.inventory.backpack[0].id, COPPER_PICKAXE.id);

  for (const [id, count] of Object.entries(IRON_PICKAXE.cost)) restored.inventory.add(id, count);
  assert.ok(craftItem(restored, IRON_PICKAXE, WORKBENCH.id));
  editTile(restored.world, tx, ty, MATERIAL.deepstone);
  const ironMining = advanceMining(restored, target, null, 0, 2);
  assert.equal(ironMining.tool, IRON_PICKAXE.id);
  assert.equal(ironMining.duration, mining.duration * 0.7);
});

test('old salvage tools migrate in place in the hotbar, backpack and chests', () => {
  const saved = encodeSave(createGame());
  saved.inventory.hotbar[0] = null;
  saved.inventory.hotbar[2] = { id: 'tool', count: 1 };
  saved.inventory.backpack[4] = { id: 'tool', count: 2 };
  saved.world.chests['wreck-cache'][3] = { id: 'tool', count: 1 };
  const game = createGame(decodeSave(saved));
  assert.deepEqual(game.inventory.hotbar[2], { id: BROKEN_PICKAXE.id, count: 1 });
  assert.deepEqual(game.inventory.backpack[4], { id: BROKEN_PICKAXE.id, count: 2 });
  assert.deepEqual(game.chests.get('wreck-cache')[3], { id: BROKEN_PICKAXE.id, count: 1 });
  assert.equal(game.inventory.hotbar[0], null);
});

test('legacy progress and edits on both sides of a chunk boundary migrate', () => {
  const legacy = {
    format: 1, x: SPAWN.x - WEST_EXTENSION * TILE, y: SPAWN.y, oxygen: 28, tank: true, completed: true,
    inventory: { wood: 11, sand: 3 },
    edits: [[32 * 224 + 19, 5], [32 * 224 + 20, 0], null, [4, 6]],
    harvested: ['wreck-cache', 'missing-id'],
  };
  const game = createGame(decodeSave(legacy));
  const saved = encodeSave(game);
  assert.equal(saved.format, 3);
  assert.deepEqual(saved.world.edits, [[19, 32, 'wood'], [20, 32, 'air']]);
  assert.deepEqual(saved.world.harvested, ['wreck-cache']);
  assert.deepEqual(saved.progress, { snorkel: null, classes: game.classes });
  assert.equal(saved.player.oxygen, 18);
  assert.equal(new Inventory(saved.inventory).count('wood'), 11);
  assert.deepEqual(encodeSave(createGame(decodeSave(saved))), saved);
  assert.deepEqual(encodeSave(game, false).world.edits, []);
  assert.equal(decodeSave({ ...saved, world: { ...saved.world, generator: 999 } }), null);
});

test('edits applied before a chunk is loaded survive a later cache load', () => {
  const world = createWorld();
  assert.equal(editTile(world, 63, 11, MATERIAL.wood), true);
  assert.equal(world.chunks.size, 0);
  assert.equal(tileAt(world, 63, 11), MATERIAL.wood);
  assert.equal(tileAt(world, 64, 11), MATERIAL.air);
});

test('fixed-step simulation supports mining, jumping and crafting without a browser', () => {
  const game = createGame();
  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  stepGame(game, neutral, 1 / 60);
  assert.equal(game.player.grounded, true);
  stepGame(game, { ...neutral, jump: true }, 1 / 60);
  assert.ok(game.player.y < SPAWN.y);
  const target = targetTile(game, (61 + WEST_EXTENSION) * 16 + 8, 11 * 16 + 8);
  let mining = advanceMining(game, target, null, 0.1);
  assert.ok(mining.progress < 1);
  assert.equal(game.inventory.count('sand'), 0);
  mining = advanceMining(game, target, mining, 0.3);
  assert.ok(mining.progress >= 1);
  commitTileAction(game, mining.action);
  assert.equal(tileAt(game.world, target.tx, target.ty), MATERIAL.air);
  assert.equal(game.inventory.count('sand'), 1);
  for (const [id, count] of Object.entries(COPPER_SNORKEL.cost)) game.inventory.add(id, count);
  assert.equal(craftItem(game, COPPER_SNORKEL), false);
  assert.equal(craftItem(game, COPPER_SNORKEL, WORKBENCH.id), true);
  assert.equal(game.inventory.count(COPPER_SNORKEL.id), 1);
});

test('kelp is mined from its stalk or its supporting block and stays harvested on reload', () => {
  const game = createGame();
  const plants = game.world.items.filter(({ kind }) => kind === 'kelp');
  for (const plant of plants) {
    assert.notEqual(tileAt(game.world, plant.tx, plant.ty), MATERIAL.air, plant.id);
    assert.equal(tileAt(game.world, plant.tx, plant.ty - 1), MATERIAL.air, plant.id);
  }
  const kelp = plants.find(({ id }) => id === 'kelp-34');
  const { x, y, tx, ty } = kelp;
  Object.assign(game.player, { x, y: y - game.player.height / 2 });
  const stalk = targetTile(game, x, y);
  const root = targetTile(game, x, (ty + .5) * TILE);
  assert.equal(nearestItem(game), undefined);
  const mining = advanceMining(game, stalk, null, 0.15);
  const tip = targetTile(game, x + 9, y - TILE);
  const finish = advanceMining(game, tip, mining, 0.15);
  assert.ok(finish.progress >= 1);
  commitTileAction(game, finish.action);
  assert.equal(game.inventory.count('kelp'), 1);
  assert.equal(tileAt(game.world, tx, ty), MATERIAL.sand);
  assert.equal(advanceMining(game, stalk, null, 1), null);

  const withRoot = createGame();
  commitTileAction(withRoot, advanceMining(withRoot, root, null, 1).action);
  assert.equal(tileAt(withRoot.world, tx, ty), MATERIAL.air);
  assert.equal(withRoot.inventory.count('sand'), 1);
  assert.equal(withRoot.inventory.count('kelp'), 1);
  applyTerrain(withRoot, tx, ty, MATERIAL.sand);
  const restored = createGame(decodeSave(encodeSave(withRoot)));
  assert.equal(advanceMining(restored, stalk, null, 1), null);
  assert.equal(restored.inventory.count('kelp'), 1);

  const peer = createGame();
  applyTerrain(peer, tx, ty, MATERIAL.air);
  assert.equal(advanceMining(peer, stalk, null, 1), null);
  assert.equal(peer.inventory.count('kelp'), 0);
});

test('palms survive mining their base across reloads and can still be chopped', () => {
  const migrated = createGame(decodeSave({ format: 1, harvested: ['palm-62'] }));
  assert.equal(migrated.world.harvested.has('palm-62'), true);

  let game = createGame();
  const tree = game.world.trees.find(({ id }) => id === 'palm-62');
  const base = targetTile(game, tree.x, (tree.ty + .5) * TILE);
  commitTileAction(game, advanceMining(game, base, null, 1).action);
  assert.equal(tileAt(game.world, tree.tx, tree.ty), MATERIAL.air);
  game = createGame(decodeSave(encodeSave(game)));
  assert.equal(isTreeStanding(game.world, tree), true);
  const target = targetTile(game, (62 + WEST_EXTENSION) * 16 + 8, 9 * 16 + 8);
  const mining = advanceMining(game, target, null, 0.5);
  assert.equal(mining.action.fixtureId, 'palm-62');
  assert.equal(mining.progress, 1);
  commitTileAction(game, mining.action);
  assert.equal(game.inventory.count('wood'), 6);
  assert.equal(advanceMining(game, target, null, 0.5), null);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.world.harvested.has('palm-62'), true);
  assert.equal(restored.inventory.count('wood'), 6);
});

test('the expanded-map save migrates western edits and ore inventory', () => {
  const saved = encodeSave(createGame(decodeSave({
    format: 2,
    x: 1016, y: 169, tank: true,
    inventory: { copper: 4, iron: 2 },
    edits: [[-10, 107, MATERIAL.air], [-9, 107, MATERIAL.iron]],
  })));
  assert.equal(saved.player.x, 1016);
  assert.equal(saved.world.generator, 2);
  assert.deepEqual(saved.world.edits, [[-10, 107, 'air'], [-9, 107, 'iron']]);
  assert.equal(new Inventory(saved.inventory).count('copper'), 4);
  assert.equal(new Inventory(saved.inventory).count('iron'), 2);
});

test('only the generated ocean and caverns supply water', () => {
  const world = createWorld();
  const shore = WEST_EXTENSION + 90;
  const shaft = WEST_EXTENSION + 63;
  const vent = world.vents.at(-1);
  assert.equal(waterTileAt(world, shore, WATER_ROW - 1), false);
  assert.equal(waterTileAt(world, shore, WATER_ROW), true);
  assert.equal(inWater(world, vent.x, vent.y - 18), true);

  editTile(world, shaft, WATER_ROW + 1, MATERIAL.air);
  assert.equal(tileAt(world, shaft, WATER_ROW + 1), MATERIAL.air);
  assert.equal(waterTileAt(world, shaft, WATER_ROW + 1), false);

  editTile(world, shore, WATER_ROW, MATERIAL.wood);
  assert.equal(waterTileAt(world, shore, WATER_ROW), false);
  editTile(world, shore, WATER_ROW, MATERIAL.air);
  assert.equal(waterTileAt(world, shore, WATER_ROW), true);
});

test('a saved shaft dug from the island remains breathable below sea level', () => {
  const x = 63;
  const edits = Array.from({ length: 19 }, (_, index) => [x, 11 + index, MATERIAL.air]);
  const snapshot = decodeSave({ format: 2, x: x * TILE + 8, y: 17 * TILE, oxygen: 9, edits });
  const game = createGame(snapshot);
  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  for (let i = 0; i < 120; i++) stepGame(game, neutral, 1 / 60);

  assert.ok(game.player.y > 28 * TILE);
  assert.equal(game.player.grounded, true);
  assert.equal(game.player.oxygen, 18);
  stepGame(game, { ...neutral, down: true }, 1 / 60);
  assert.equal(game.player.height, TILE);
});

test('crawling clears a one-block tunnel, survives a reload, and stands when there is room', () => {
  const game = createGame();
  const { world, player } = game;
  const start = Math.floor(player.x / TILE);
  const ground = (SPAWN.y + PLAYER_SIZE.height) / TILE;
  for (let x = start - 1; x <= start + 6; x++) {
    editTile(world, x, ground, MATERIAL.stone);
    editTile(world, x, ground - 1, MATERIAL.air);
    editTile(world, x, ground - 2, x > start && x <= start + 3 ? MATERIAL.stone : MATERIAL.air);
  }
  const right = { left: false, right: true, up: false, down: false, jump: false };
  for (let frame = 0; frame < 20; frame++) movePlayer(world, player, right, 1 / 60);
  assert.ok(player.x < (start + 1) * TILE);
  assert.equal(player.grounded, true);
  const feet = player.y + player.height;

  for (let frame = 0; frame < 30; frame++) movePlayer(world, player, { ...right, down: true }, 1 / 60);
  assert.equal(player.height, TILE);
  assert.ok(Math.abs(player.y + player.height - feet) < 0.01);
  assert.ok(player.x > (start + 1) * TILE);
  const tunnelTile = Math.floor(player.x / TILE);
  applyTerrain(game, tunnelTile, ground - 2, MATERIAL.wood);
  assert.equal(game.player, player);
  movePlayer(world, player, { ...right, right: false }, 1 / 60);
  assert.equal(player.height, TILE);

  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.player.height, TILE);
  assert.equal(restored.player.x, player.x);
  assert.equal(restored.player.y, player.y);
  for (let frame = 0; frame < 60; frame++) movePlayer(restored.world, restored.player, right, 1 / 60);
  assert.ok(restored.player.x > (start + 4) * TILE);
  assert.equal(restored.player.height, PLAYER_SIZE.height);
});

test('down still dives in water and exits the crawl posture when there is room', () => {
  const { world, player } = createGame();
  Object.assign(player, { x: (COLS - 4.5) * TILE, y: WATER + TILE, height: TILE, grounded: true });
  const depth = player.y + player.height;
  movePlayer(world, player, { left: false, right: false, up: false, down: true, jump: false }, 1 / 60);
  assert.equal(player.height, PLAYER_SIZE.height);
  assert.ok(player.y + player.height > depth);
  assert.ok(player.dy > 0);
});

test('mob generation and dynamic enemy spawns stay sparse across friendly and hostile types', () => {
  const game = createGame();
  const friendly = game.world.mobs.filter((mob) => mob.kind === 'crab' || (mob.kind === 'fish' && !mob.enemyType));
  const hostile = game.world.mobs.filter((mob) => mob.kind === 'jellyfish' || mob.kind === 'squid' || mob.kind === 'shark');
  assert.equal(friendly.length, 13);
  assert.equal(hostile.length, 7);
  assert.equal(game.enemies.spawnIn, 14);

  const player = { x: (100 + WEST_EXTENSION) * TILE, y: WATER + 4 * TILE };
  let peakDynamic = 0;
  for (let second = 0; second < 60; second++) {
    updateEnemySpawns(game.enemies, game.world.mobs, player, false, 1, (x, y) => y < WATER + 12 || tileAt(game.world, Math.floor(x / TILE), Math.floor(y / TILE)) !== MATERIAL.air);
    const dynamic = game.world.mobs.filter((mob) => mob.enemyType).length;
    peakDynamic = Math.max(peakDynamic, dynamic);
    assert.ok(dynamic <= 1);
  }
  assert.equal(peakDynamic, 1);
});

test('the wreck chest opens before equipping the snorkel and stays available after reload', () => {
  const game = createGame();
  assert.equal(oxygenCapacity(game), 18);

  const chest = game.world.items.find((item) => item.id === 'wreck-chest');
  const wreckCache = game.world.items.find((item) => item.id === 'wreck-cache');
  assert.ok(chest && wreckCache);
  assert.equal(chest.kind, 'chest');
  assert.ok(chest.y > WATER);
  const nearbyChests = game.world.items.filter((item) => item.kind === 'chest'
    && Math.abs(item.x - chest.x) <= 16 * TILE && Math.abs(item.y - chest.y) <= 8 * TILE);
  assert.deepEqual(nearbyChests, [chest]);
  const reefColumn = Math.floor(wreckCache.x / TILE);
  const reefFloor = Math.floor((wreckCache.y + 8) / TILE);
  assert.equal(tileAt(game.world, reefColumn, reefFloor - 1), MATERIAL.air);
  assert.notEqual(tileAt(game.world, reefColumn, reefFloor), MATERIAL.air);

  game.player.x = chest.x;
  game.player.y = chest.y + 8 - game.player.height;
  assert.equal(nearestItem(game), chest);
  assert.equal(oxygenCapacity(game), 18);
  const loot = { group: 'chest', index: 0 };
  const head = { group: 'head', index: 0 };
  const backpack = { group: 'backpack', index: 0 };
  assert.equal(game.chests.get(chest.id)[0].id, COPPER_SNORKEL.id);
  assert.equal(moveInventoryStack(game, chest.id, loot, backpack), true);
  assert.equal(moveInventoryStack(game, null, backpack, head), true);
  assert.equal(oxygenCapacity(game), 38);
  game.player.oxygen = 38;
  assert.equal(moveInventoryStack(game, null, head, { group: 'hotbar', index: 0 }), false);
  assert.equal(moveInventoryStack(game, null, head, backpack), true);
  assert.equal(game.player.oxygen, 18);
  assert.equal(game.inventory.count(COPPER_SNORKEL.id), 1);

  const reloaded = createGame(decodeSave(encodeSave(game)));
  assert.equal(reloaded.progress.snorkel, null);
  assert.equal(oxygenCapacity(reloaded), 18);
  assert.equal(nearestItem(reloaded)?.id, chest.id);
  assert.equal(reloaded.chests.get(chest.id)[0], null);
  assert.equal(moveInventoryStack(reloaded, null, backpack, head), true);
  assert.equal(reloaded.player.oxygen, 18);
  assert.equal(moveInventoryStack(reloaded, chest.id, head, loot), true);
  assert.equal(createGame(decodeSave(encodeSave(reloaded))).chests.get(chest.id)[0].id, COPPER_SNORKEL.id);
});

test('chest transfers, legacy loot, and room progress survive the appropriate save boundaries', () => {
  const fresh = encodeSave(createGame());
  delete fresh.world.chests;
  delete fresh.progress.snorkel;
  fresh.world.harvested = ['wreck-cache', 'wreck-chest'];
  const game = createGame(decodeSave(fresh));
  const id = 'wreck-cache';
  const chest = { group: 'chest', index: CHEST_SIZE - 1 };
  const wood = { group: 'hotbar', index: 3 };
  const tool = { group: 'hotbar', index: 0 };

  assert.deepEqual(game.chests.get(id), Array(CHEST_SIZE).fill(null));
  assert.equal(game.progress.snorkel, COPPER_SNORKEL.id);
  assert.equal(game.chests.get('wreck-chest')[0], null);
  assert.equal(chestAt(game, game.world.items.find((item) => item.id === id).x, 0), undefined);
  assert.equal(moveInventoryStack(game, id, wood, { group: 'chest', index: CHEST_SIZE }), false);
  assert.equal(moveInventoryStack(game, id, wood, chest), true);
  assert.equal(moveInventoryStack(game, id, tool, chest), true);
  assert.equal(game.inventory.hotbar[0].id, 'wood');
  assert.deepEqual(game.chests.get(id)[chest.index], { id: BROKEN_PICKAXE.id, count: 1 });

  const roomSnapshot = encodeSave(game, false);
  const restored = createGame(decodeSave(roomSnapshot));
  assert.deepEqual(encodeSave(restored, false), roomSnapshot);
  assert.equal(moveInventoryStack(restored, id, chest, wood), true);
  assert.equal(restored.inventory.hotbar[3].id, BROKEN_PICKAXE.id);
  assert.equal(restored.chests.get(id)[chest.index], null);
  const reset = resetRoomProgress(restored);
  assert.deepEqual(reset.chests.get(id)[0], { id: 'wood', count: 8 });
  assert.equal(reset.chests.get('wreck-chest')[0].id, COPPER_SNORKEL.id);
});

test('melee damages each mob once when the animated weapon reaches it', () => {
  const game = createGame();
  const { player, world } = game;
  toggleGodMode(world, player);
  const crab = world.mobs.find((mob) => mob.kind === 'crab');
  const targets = [
    { x: player.x - 26, y: player.y + 15 },
    { x: player.x - 72, y: player.y + 15 },
    { x: player.x + 10, y: player.y + 15 },
    { x: player.x - 24, y: player.y - 2 },
  ];
  world.mobs = targets.map((position) => ({ ...crab, ...position, health: 7, maxHealth: 7 }));
  game.inventory.hotbar[1] = { id: SPEAR.id, count: 1 };
  useWeapon(game, 1, targets[1].x, player.y + 12);
  assert.deepEqual(world.mobs.map((mob) => mob.health), [7, 7, 7, 7]);

  const step = 1 / 60;
  const spearFrames = Math.ceil(game.attack.duration / step) + 1;
  for (let i = 0; i < spearFrames; i++) {
    // Keep the targets in place so the front crab overlaps several frames of the thrust.
    world.mobs.forEach((mob, index) => Object.assign(mob, targets[index]));
    stepGame(game, {}, step);
  }
  assert.deepEqual(world.mobs.map((mob) => mob.health), [5, 7, 7, 7]);

  const arcTarget = { x: player.x + 11, y: player.y + 4 };
  world.mobs = [{ ...crab, ...arcTarget, health: 7, maxHealth: 7 }];
  useWeapon(game, 0, player.x + 72, player.y + 12);
  const pickaxeFrames = Math.ceil(game.attack.duration / step) + 1;
  for (let i = 0; i < pickaxeFrames; i++) {
    Object.assign(world.mobs[0], arcTarget);
    stepGame(game, {}, step);
  }
  assert.equal(world.mobs[0].health, 6);
});

test('craftable spears and bow with arrows damage and defeat sea enemies', () => {
  const game = createGame();
  game.inventory.add('wood', 6);
  game.inventory.add('stone', 2);
  game.inventory.add('kelp', 1);
  game.inventory.add('copper', 2);

  assert.equal(craftItem(game, SPEAR, WORKBENCH.id), true);
  assert.equal(craftItem(game, COPPER_SPEAR, WORKBENCH.id), true);
  assert.equal(craftItem(game, BOW), false, 'bow should no longer craft with kelp alone');
  game.inventory.add(STRING.id, 2);
  assert.equal(craftItem(game, BOW), true);
  assert.equal(craftItem(game, ARROW), true);
  assert.equal(game.inventory.count(ARROW.id), 4);

  const findItemSlot = (id) => {
    const hotbarIndex = game.inventory.hotbar.findIndex((stack) => stack?.id === id);
    if (hotbarIndex >= 0) return { group: 'hotbar', index: hotbarIndex };
    const backpackIndex = game.inventory.backpack.findIndex((stack) => stack?.id === id);
    return backpackIndex >= 0 ? { group: 'backpack', index: backpackIndex } : null;
  };
  const bowSlot = findItemSlot(BOW.id);
  assert.ok(bowSlot);
  if (bowSlot.group !== 'hotbar' || bowSlot.index !== 2) {
    assert.ok(game.inventory.move(bowSlot, { group: 'hotbar', index: 2 }));
  }
  assert.equal(game.inventory.hotbar[1].id, SPEAR.id);
  assert.equal(game.inventory.hotbar[2].id, BOW.id);

  const shark = game.world.mobs.find((mob) => mob.kind === 'shark');
  shark.x = game.player.x + 40;
  shark.y = game.player.y + 11;
  shark.homeX = shark.x;
  shark.homeY = shark.y;

  const thrust = useWeapon(game, 1, shark.x, shark.y);
  assert.equal(thrust.handled, true);
  assert.equal(game.attack.kind, SPEAR.id);
  assert.equal(shark.health, 7);

  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  for (let i = 0; i < 30; i++) stepGame(game, neutral, 1 / 60);
  assert.equal(shark.health, 5);
  assert.equal(game.attack, null);

  shark.x = game.player.x + 96;
  shark.y = game.player.y + 11;
  const shot = useWeapon(game, 2, shark.x, shark.y);
  assert.equal(shot.handled, true);
  assert.equal(shot.inventoryChanged, true);
  assert.equal(game.inventory.count(ARROW.id), 3);
  assert.equal(game.projectiles.length, 1);

  for (let i = 0; i < 30; i++) stepGame(game, neutral, 1 / 60);
  assert.equal(game.projectiles.length, 0);
  assert.equal(shark.health, 3);

  // The bow now has a longer recovery period before another weapon attack.
  while (game.attack) stepGame(game, neutral, 1 / 60);
  const copperSpearSlot = findItemSlot(COPPER_SPEAR.id);
  assert.ok(copperSpearSlot);
  assert.ok(game.inventory.move(copperSpearSlot, { group: 'hotbar', index: 1 }));
  shark.x = game.player.x + 40;
  shark.y = game.player.y + 11;
  useWeapon(game, 1, shark.x, shark.y);
  assert.equal(shark.health, 3);
  for (let i = 0; i < 30; i++) stepGame(game, neutral, 1 / 60);
  assert.equal(shark.health, 0);
  assert.ok(shark.respawn > 0);
  assert.ok(game.effects.some((effect) => effect.message === 'Defeated shark!'));

  game.inventory.spend(ARROW.id, 3);
  const dryFire = useWeapon(game, 2, shark.x, shark.y);
  assert.equal(dryFire.handled, true);
  assert.match(dryFire.message, /Out of arrows/);

  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.inventory.hotbar[1].id, COPPER_SPEAR.id);
  assert.equal(restored.inventory.hotbar[2].id, BOW.id);
});

test('the western wreck has flooded holds, mineable timber, skeletons and persistent distinct loot', () => {
  const game = createGame();
  const { world, player } = game;
  const startingWood = game.inventory.count('wood');
  const caches = world.items.filter(({ id }) => id.startsWith('western-wreck-'));
  assert.equal(caches.length, 3);
  const skeletons = world.caveStructures.filter(({ kind, tx, floor }) =>
    kind === 'skeleton' && isInsideShipwreck(tx - WEST_EXTENSION, floor - 1));
  assert.equal(skeletons.length, 2);
  for (const { tx, floor } of skeletons) {
    assert.ok(waterTileAt(world, tx, floor - 1));
    assert.equal(tileAt(world, tx, floor), MATERIAL.wood);
  }
  for (const cache of caches) {
    const tx = Math.floor(cache.x / TILE);
    const ty = Math.floor(cache.y / TILE);
    assert.ok(waterTileAt(world, tx, ty));
    assert.equal(tileAt(world, tx, ty + 1), MATERIAL.wood);
    player.x = cache.x;
    player.y = cache.y - player.height / 2;
    assert.equal(nearestItem(game), cache);
    const index = game.inventory.backpack.findIndex((stack) => !stack);
    assert.equal(moveInventoryStack(game, cache.id, { group: 'chest', index: 0 }, { group: 'backpack', index }), true);
  }
  assert.equal(game.inventory.count('wood'), startingWood + 76);

  const tx = WEST_EXTENSION - 84;
  const ty = 30;
  player.x = (tx + .5) * TILE;
  player.y = ty * TILE - player.height;
  const target = targetTile(game, player.x, (ty + .5) * TILE);
  const mine = advanceMining(game, target, null, 1);
  assert.ok(mine.progress >= 1);
  commitTileAction(game, mine.action);
  assert.ok(waterTileAt(world, tx, ty));
  assert.equal(game.inventory.count('wood'), startingWood + 77);

  const reloaded = createGame(decodeSave(encodeSave(game)));
  assert.ok(waterTileAt(reloaded.world, tx, ty));
  assert.equal(reloaded.inventory.count('wood'), startingWood + 77);
  assert.deepEqual(caches.map(({ id }) => reloaded.chests.get(id).filter(Boolean)), [
    [{ id: CAPTAINS_CUTLASS.id, count: 1 }],
    [{ id: BOW.id, count: 1 }, { id: ARROW.id, count: 8 }],
    [{ id: 'copper', count: 4 }, { id: KELP_DRESSING.id, count: 2 }],
  ]);
});

test('western wreck bonus loot arrives once and preserves a full chest from an older save', () => {
  const saved = encodeSave(createGame());
  delete saved.world.pendingWreckLoot;
  const id = 'western-wreck-deck';
  const stored = Array.from({ length: CHEST_SIZE }, (_, index) => ({ id: 'stone', count: index + 1 }));
  saved.world.chests[id] = stored;
  const game = createGame(decodeSave(saved));
  assert.deepEqual(game.chests.get(id), stored);

  for (const index of [0, 1]) {
    const backpack = game.inventory.backpack.findIndex((stack) => !stack);
    assert.ok(moveInventoryStack(game, id, { group: 'chest', index }, { group: 'backpack', index: backpack }));
  }
  let restored = createGame(decodeSave(encodeSave(game)));
  assert.deepEqual(restored.chests.get(id).slice(0, 2), [{ id: BOW.id, count: 1 }, { id: ARROW.id, count: 8 }]);
  assert.deepEqual(restored.chests.get(id).slice(2), stored.slice(2));

  const backpack = restored.inventory.backpack.findIndex((stack) => !stack);
  assert.ok(moveInventoryStack(restored, id, { group: 'chest', index: 0 }, { group: 'backpack', index: backpack }));
  restored = createGame(decodeSave(encodeSave(restored)));
  assert.equal(restored.chests.get(id)[0], null);
  assert.equal(restored.inventory.count(BOW.id), 1);
});

test('the captain haunts the wreck by default while the sailor still spawns rarely', (t) => {
  const game = createGame();
  const { world, player, effects } = game;
  const ghosts = world.mobs.filter((mob) => mob.kind === 'ghost');
  assert.equal(ghosts.length, 2);
  const [captain, sailor] = ghosts;
  assert.equal(captain.health, captain.maxHealth);
  assert.ok(inWater(world, captain.x, captain.y));
  assert.equal(sailor.health, 0);

  const random = t.mock.method(Math, 'random', () => 0);
  stepWreckGhost(world, player, captain, 43, 43, effects);
  stepWreckGhost(world, player, sailor, 43, 43, effects);
  assert.equal(captain.health, captain.maxHealth);
  assert.equal(random.mock.callCount(), 0);

  Object.assign(player, { x: captain.homeX, y: captain.homeY - player.height / 2 });
  random.mock.mockImplementationOnce(() => .9);
  stepWreckGhost(world, player, sailor, 1 / 60, 43, effects);
  assert.equal(sailor.health, 0);
  stepWreckGhost(world, player, sailor, 150, 193, effects);
  assert.equal(sailor.health, sailor.maxHealth);
  assert.ok(inWater(world, sailor.x, sailor.y));

  Object.assign(player, { x: sailor.x - 9, y: sailor.y - player.height / 2 });
  const oxygen = player.oxygen;
  const health = player.health;
  for (let frame = 1; frame <= 80; frame++) stepWreckGhost(world, player, sailor, 1 / 60, 193 + frame / 60, effects);
  assert.equal(player.oxygen, oxygen - 3);
  assert.equal(player.health, health - 18);
  stepWreckGhost(world, player, sailor, 43, 238, effects);
  assert.equal(sailor.health, 0);

  damageMob(world, captain, captain.maxHealth, 0, 0, effects);
  assert.equal(captain.health, 0);
  world.mobs = ghosts;
  game.enemies.spawnIn = 120;
  stepMobs(world, player, 44, 282, false, false, game.enemies, effects);
  assert.equal(captain.health, 0);
  stepMobs(world, player, 1, 283, false, false, game.enemies, effects);
  assert.equal(captain.health, captain.maxHealth);
  assert.equal(random.mock.callCount(), 2);
});

test('a crafted workbench can be placed, used, saved, and mined back into inventory', () => {
  const game = createGame();
  const materials = WORKBENCH.cost.wood;
  assert.equal(canCraftItem(game, WORKBENCH), false);
  game.inventory.add('wood', materials);
  const before = game.inventory.count('wood');
  assert.equal(craftItem(game, WORKBENCH), true);
  assert.equal(game.inventory.count('wood'), before - materials);

  assert.equal(game.inventory.hotbar[1]?.id, WORKBENCH.id);
  const tx = Math.floor(game.player.x / TILE) + 1;
  const ty = groundAt(tx) - 1;
  const target = targetTile(game, (tx + .5) * TILE, (ty + .5) * TILE);
  const plan = planTileAction(game, target, true, 1);
  assert.equal(plan.after, MATERIAL.workbench);
  commitTileAction(game, plan);
  assert.equal(game.inventory.count(WORKBENCH.id), 0);
  assert.equal(nearestItem(game)?.kind, WORKBENCH.id);

  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(tileAt(restored.world, tx, ty), MATERIAL.workbench);
  assert.equal(workbenchAt(restored, tx, ty)?.kind, WORKBENCH.id);
  const distant = createGame(decodeSave(encodeSave(game)));
  distant.player.x += 4 * TILE;
  assert.equal(workbenchAt(distant, tx, ty), undefined);

  const mining = advanceMining(restored, target, null, 1, 0);
  assert.ok(mining.progress >= 1);
  commitTileAction(restored, mining.action);
  assert.equal(restored.inventory.count(WORKBENCH.id), 1);
  assert.equal(workbenchAt(restored, tx, ty), undefined);
  assert.equal(tileAt(restored.world, tx, ty), MATERIAL.air);
});

test('crafting prefers an empty hotbar slot and falls back to backpack stacks', () => {
  const game = createGame();
  game.inventory.add('wood', 12);
  game.inventory.add(WOODEN_DOOR.id, 2);

  assert.equal(craftItem(game, WOODEN_DOOR), true);
  assert.deepEqual(game.inventory.hotbar[1], { id: WOODEN_DOOR.id, count: 1 });
  assert.deepEqual(game.inventory.backpack[0], { id: WOODEN_DOOR.id, count: 2 });
  assert.equal(craftItem(game, WOODEN_DOOR), true);
  assert.equal(game.inventory.hotbar[1].count, 2);

  assert.equal(game.inventory.move({ group: 'hotbar', index: 1 }, { group: 'backpack', index: 0 }), true);
  for (const filler of ['sand', 'stone', 'copper', 'iron', 'cobalt']) {
    if (game.inventory.hotbar.some((stack) => !stack)) game.inventory.add(filler, 1, { preferHotbar: true });
  }
  assert.equal(craftItem(game, WOODEN_DOOR), true);
  assert.equal(game.inventory.backpack[0].count, 5);
  assert.ok(game.inventory.hotbar.every((stack) => stack && stack.id !== WOODEN_DOOR.id));
});

test('items menu grants persist for both inventory stacks and equipped gear', () => {
  const game = createGame();
  assert.equal(grantItem(game, 'copper', 0), false);
  assert.equal(grantItem(game, 'unknown', 1), false);
  assert.equal(grantItem(game, 'copper', 12), true);
  assert.deepEqual(game.inventory.hotbar[1], { id: 'copper', count: 12 });
  assert.equal(grantItem(game, COBALT_SNORKEL.id, 1), true);
  assert.equal(grantItem(game, 'cobalt-breastplate', 1), true);
  assert.equal(game.chests.get(SNORKEL_CHEST_ID)[0]?.id, COPPER_SNORKEL.id);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.inventory.count('copper'), 12);
  assert.equal(restored.inventory.count(COBALT_SNORKEL.id), 1);
  assert.equal(restored.player.armor, 'cobalt-breastplate');
  assert.equal(restored.progress.snorkel, null);
  assert.equal(restored.chests.get(SNORKEL_CHEST_ID)[0]?.id, COPPER_SNORKEL.id);
});

test('spear and pickaxe recipes require a workbench without consuming materials in default crafting', () => {
  for (const recipe of [SPEAR, COPPER_SPEAR, COBALT_SPEAR, COPPER_PICKAXE, IRON_PICKAXE]) {
    const game = createGame();
    for (const [id, count] of Object.entries(recipe.cost)) game.inventory.add(id, count);
    const before = encodeSave(game).inventory;
    assert.equal(canCraftItem(game, recipe), false, recipe.id);
    assert.equal(craftItem(game, recipe), false, recipe.id);
    assert.deepEqual(encodeSave(game).inventory, before);
    assert.equal(canCraftItem(game, recipe, WORKBENCH.id), true, recipe.id);
    assert.equal(craftItem(game, recipe, WORKBENCH.id), true, recipe.id);
    assert.equal(game.inventory.count(recipe.id), 1, recipe.id);
  }
  assert.equal(canCraftItem(createGame(), WOODEN_DOOR), true);
});

test('snorkels require a workbench and upgrade copper into iron, then iron into cobalt', () => {
  const game = createGame();
  const head = { group: 'head', index: 0 };
  for (const [id, count] of Object.entries(COPPER_SNORKEL.cost)) game.inventory.add(id, count);
  game.inventory.add('iron', 4);
  game.inventory.add('cobalt', 2);
  for (const recipe of [COPPER_SNORKEL, IRON_SNORKEL, COBALT_SNORKEL]) assert.equal(craftItem(game, recipe), false);
  assert.equal(craftItem(game, IRON_SNORKEL, WORKBENCH.id), false);
  assert.equal(craftItem(game, COPPER_SNORKEL, WORKBENCH.id), true);
  assert.equal(craftItem(game, COBALT_SNORKEL, WORKBENCH.id), false);
  assert.equal(craftItem(game, IRON_SNORKEL, WORKBENCH.id), true);
  assert.equal(game.inventory.count(COPPER_SNORKEL.id), 0);
  assert.equal(game.inventory.count(IRON_SNORKEL.id), 1);
  assert.equal(oxygenCapacity(game), 18);
  const slots = [game.inventory.hotbar, game.inventory.backpack];
  const group = game.inventory.hotbar.some((stack) => stack?.id === IRON_SNORKEL.id) ? 'hotbar' : 'backpack';
  const index = slots[group === 'hotbar' ? 0 : 1].findIndex((stack) => stack?.id === IRON_SNORKEL.id);
  assert.equal(moveInventoryStack(game, null, { group, index }, head), true);
  assert.equal(oxygenCapacity(game), 46);
  assert.equal(craftItem(game, COBALT_SNORKEL, WORKBENCH.id), true);
  assert.equal(game.inventory.count(IRON_SNORKEL.id), 0);
  assert.equal(game.inventory.count(COBALT_SNORKEL.id), 0);
  assert.equal(game.progress.snorkel, COBALT_SNORKEL.id);
  assert.equal(oxygenCapacity(createGame(decodeSave(encodeSave(game)))), 54);
});

test('old helmet and snorkel IDs migrate to the new tiers without re-equipping removed gear', () => {
  const old = encodeSave(createGame());
  old.world.chests[SNORKEL_CHEST_ID][0].id = 'swimming-helmet';
  const unclaimed = createGame(decodeSave(old));
  assert.equal(unclaimed.chests.get(SNORKEL_CHEST_ID)[0].id, COPPER_SNORKEL.id);
  assert.equal(unclaimed.progress.snorkel, null);

  for (const [progress, snorkel, capacity] of [
    [{ 'air-tank': true, 'swimming-helmet': true }, COPPER_SNORKEL, 38],
    [{ snorkel: 'snorkel' }, COPPER_SNORKEL, 38],
    [{ 'reinforced-helmet': true }, COBALT_SNORKEL, 54],
    [{ snorkel: 'reinforced-snorkel' }, COBALT_SNORKEL, 54],
  ]) {
    old.progress = progress;
    old.player.oxygen = 70;
    const migrated = createGame(decodeSave(old));
    assert.equal(migrated.player.oxygen, capacity);
    assert.deepEqual(encodeSave(migrated).progress, { snorkel: snorkel.id, classes: migrated.classes });
  }
  old.world.harvested.push(SNORKEL_CHEST_ID);
  old.progress = { snorkel: null };
  assert.equal(createGame(decodeSave(old)).progress.snorkel, null);
});

test('breastplates upgrade in order, mitigate damage and survive respawn and reload', () => {
  const game = createGame();
  const [copper, iron, cobalt] = Object.values(ARMOR);
  for (const armor of [copper, iron, cobalt]) {
    for (const [id, count] of Object.entries(armor.cost)) game.inventory.add(id, count);
  }
  assert.equal(craftItem(game, iron, WORKBENCH.id), false);
  for (const [armor, expectedDamage] of [[copper, 17], [iron, 14], [cobalt, 12]]) {
    assert.equal(craftItem(game, armor, WORKBENCH.id), true);
    assert.equal(takeDamage(game.player, 20), expectedDamage);
  }
  assert.equal(craftItem(game, copper, WORKBENCH.id), false);
  game.player.health = 0;
  game.player.hurt = 1;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.player.armor, cobalt.id);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.player.armor, cobalt.id);
  assert.equal(oxygenCapacity(restored), 18);
});

test('blades hit through their swing arcs and cobalt spear reaches farther than copper', () => {
  const game = createGame();
  const { player, world } = game;
  toggleGodMode(world, player);
  const crab = world.mobs.find((mob) => mob.kind === 'crab');
  const cases = [
    [IRON_SWORD, { x: player.x + 12, y: player.y + 3 }, 5],
    [CAPTAINS_CUTLASS, { x: player.x + 12, y: player.y + 3 }, 4],
    [COPPER_SPEAR, { x: player.x + 42, y: player.y + 15 }, 0],
    [COBALT_SPEAR, { x: player.x + 42, y: player.y + 15 }, 6],
  ];
  for (const [weapon, position, damage] of cases) {
    const target = { ...crab, ...position, health: 10, maxHealth: 10 };
    world.mobs = [target];
    game.inventory.hotbar[1] = { id: weapon.id, count: 1 };
    useWeapon(game, 1, player.x + 72, player.y + 12);
    assert.equal(target.health, 10);
    const step = 1 / 60;
    const attackFrames = Math.ceil(game.attack.duration / step) + 1;
    for (let i = 0; i < attackFrames; i++) {
      Object.assign(target, position);
      stepGame(game, {}, step);
    }
    assert.equal(target.health, 10 - damage, weapon.id);
  }
});


test('squid shoots black ink bubbles that ink the player and fade out', () => {
  const game = createGame();
  const { world, player } = game;
  player.x = TILE * 3.5;
  player.y = WATER + 4 * TILE;
  world.projectiles.length = 0;
  const squid = {
    id: 'test-squid', kind: 'squid', x: player.x + 70, y: player.y + 12,
    homeX: player.x + 70, homeY: player.y + 12, span: 48, speed: 48, phase: 0,
    facing: -1, dx: 0, dy: 0, health: 4, maxHealth: 4, hurt: 0,
    flee: 0, cooldown: 0, attackTimer: 0.01, windup: 0, shock: 0, shockHit: false,
  };
  world.mobs = [squid];

  for (let i = 0; i < 60 && world.projectiles.length === 0; i++) stepGame(game, {}, 1 / 60);
  const bubbles = world.projectiles.filter((p) => p.kind === 'paint-bubble');
  assert.equal(bubbles.length, 3);
  for (const bubble of bubbles) {
    assert.ok(['#07080d', '#0d1017', '#141821'].includes(bubble.color));
  }

  world.mobs = [];
  world.projectiles = [{ kind: 'paint-bubble', x: player.x, y: player.y + 12, dx: 0, dy: 0, radius: 4, life: 1, phase: 0, color: '#0d1017' }];
  stepGame(game, {}, 1 / 60);
  const firstCount = player.inkSplats.length;
  assert.ok(firstCount >= 1);
  assert.ok(player.inkSplats[0].time > 2);

  for (let i = 0; i < 60; i++) stepGame(game, {}, 1 / 60);
  assert.equal(player.inkSplats.length, firstCount);
  world.projectiles = [{ kind: 'paint-bubble', x: player.x, y: player.y + 12, dx: 0, dy: 0, radius: 4, life: 1, phase: 0, color: '#0d1017' }];
  stepGame(game, {}, 1 / 60);
  assert.ok(player.inkSplats.length > firstCount);

  for (let i = 0; i < 600 && player.inkSplats.length > 0; i++) stepGame(game, {}, 1 / 60);
  assert.equal(player.inkSplats.length, 0);

  player.inkSplats = [{ nx: 0.5, ny: 0.5, scale: 1, angle: 0, seed: 1, time: 3, duration: 4.5 }];
  toggleGodMode(world, player);
  assert.equal(player.inkSplats.length, 0);
});


test('jellyfish shock stuns the player when inside its visual lightning area', () => {
  const game = createGame();
  const { world, player } = game;
  player.x = TILE * 3.5;
  player.y = WATER + 4 * TILE;
  player.hurt = 0.5;
  const jelly = {
    id: 'test-jelly', kind: 'jellyfish', x: player.x + 120, y: player.y + 12,
    homeX: player.x + 120, homeY: player.y + 12, span: 10, speed: 14, phase: 0,
    facing: -1, dx: 0, dy: 0, health: 3, maxHealth: 3, hurt: 0,
    flee: 0, cooldown: 0, attackTimer: 1, windup: 0, shock: 0.6, shockHit: false,
  };
  world.mobs = [jelly];

  stepGame(game, {}, 1 / 60);
  assert.equal(player.stun, 0);

  jelly.x = player.x + 40;
  jelly.homeX = jelly.x;
  assert.ok(40 <= jellyfishShockRadius(jelly.shock));
  stepGame(game, {}, 1 / 60);
  assert.ok(player.stun > 0);
  const shockEffect = game.effects.find((effect) => effect.shake);
  assert.deepEqual(shockEffect?.shake, { intensity: 11, duration: 0.75, frequency: 46 });
});


test('giant kraken blocks the far right edge at all depths and performs all three attacks', () => {
  const game = createGame();
  const { world, player } = game;
  const kraken = world.mobs.find((mob) => mob.kind === 'kraken');
  assert.ok(kraken);
  assert.equal(kraken.x, (KRAKEN_COLUMN + WEST_EXTENSION) * TILE);
  assert.ok(COLS > KRAKEN_COLUMN + WEST_EXTENSION + 64);
  const barrierX = krakenBarrierX(kraken);
  const startX = kraken.x;
  const startY = kraken.y;

  // Barrier blocks moving past the kraken in open water AND deep caves.
  for (const testY of [WATER + 4 * TILE, 140 * TILE]) {
    Object.assign(player, { x: barrierX - player.width / 2 - 2, y: testY, dx: 0, dy: 0, hurt: 0 });
    for (let i = 0; i < 30; i++) movePlayer(world, player, { right: true }, 1 / 60);
    assert.ok(player.x + player.width / 2 <= barrierX + 1e-6);
  }

  // Kraken remains static when damaged.
  damageMob(world, kraken, 5, 0, 150, game.effects);
  assert.equal(kraken.x, startX);
  assert.equal(kraken.y, startY);

  // Isolate kraken for deterministic attack testing.
  world.mobs = [kraken];
  Object.assign(player, { x: barrierX - 70, y: kraken.y - 4 * TILE, dx: 0, dy: 0, hurt: 0, health: 100 });

  // Primary attack: tentacle tackle.
  kraken.attackTimer = 0;
  kraken.attackIndex = 0;
  for (let i = 0; i < 70; i++) stepGame(game, {}, 1 / 60);
  assert.ok(player.health < 100);
  assert.ok(player.dx < 0 || player.x < barrierX - 70);

  // Secondary attack: spawns three squids.
  Object.assign(player, { x: barrierX - 90, y: kraken.y - 4 * TILE, dx: 0, dy: 0, hurt: 0 });
  kraken.attackMode = 'idle';
  kraken.windup = 0;
  kraken.actionTime = 0;
  kraken.attackTimer = 0;
  kraken.attackIndex = 1;
  for (let i = 0; i < 45; i++) stepGame(game, {}, 1 / 60);
  const minions = world.mobs.filter((mob) => mob.krakenMinion && mob.kind === 'squid');
  assert.equal(minions.length, 3);
  assert.ok(kraken.sonarTime > 0);

  // Tertiary attack: grabs the player and pulls them deeper underwater.
  world.mobs = [kraken];
  Object.assign(player, { x: barrierX - 65, y: WATER + 6 * TILE, dx: 0, dy: 0, hurt: 0, health: 100 });
  const beforeGrabY = player.y;
  kraken.attackMode = 'idle';
  kraken.windup = 0;
  kraken.actionTime = 0;
  kraken.attackTimer = 0;
  kraken.attackIndex = 2;
  for (let i = 0; i < 75; i++) stepGame(game, {}, 1 / 60);
  assert.ok(player.y > beforeGrabY);
  assert.equal(kraken.tentacleTarget.ox, kraken.x - 4);
  assert.equal(kraken.tentacleTarget.oy, kraken.y + 4);

  // Distant player automatically triggers the extended-reach tertiary grab attack.
  Object.assign(player, { x: barrierX - 280, y: WATER + 6 * TILE, dx: 0, dy: 0, hurt: 0, health: 100 });
  const beforeFarGrabY = player.y;
  kraken.attackMode = 'idle';
  kraken.windup = 0;
  kraken.actionTime = 0;
  kraken.attackTimer = 0;
  kraken.attackIndex = 0;
  for (let i = 0; i < 75; i++) stepGame(game, {}, 1 / 60);
  assert.equal(kraken.attackMode, 'grab');
  assert.ok(kraken.grabbing || player.health < 100);
  assert.ok(player.y > beforeFarGrabY);

  // Depth 4 or above favors grab over normal 1:1:1 proportion.
  world.mobs = [kraken];
  const shallowModes = [];
  for (let i = 0; i < 5; i++) {
    Object.assign(player, { x: barrierX - 75, y: WATER + 2 * TILE, dx: 0, dy: 0, hurt: 0, health: 100 });
    kraken.attackMode = 'idle';
    kraken.windup = 0;
    kraken.actionTime = 0;
    kraken.attackTimer = 0;
    kraken.attackIndex = i;
    stepGame(game, {}, 1 / 60);
    shallowModes.push(kraken.attackMode);
  }
  assert.equal(shallowModes.filter((m) => m === 'grab').length, 3);
  assert.equal(shallowModes.filter((m) => m === 'tackle').length, 1);
  assert.equal(shallowModes.filter((m) => m === 'summon').length, 1);
});


test('renderer draws visible friendly and hostile mobs including the kraken', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const noop = () => {};
    const grad = { addColorStop: noop };
    const translates = [];
    const fillStyles = [];
    const strokeStyles = [];
    const fillRects = [];
    const makeCtx = (track) => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fillRect(x, y, w, h) {
        if (track) {
          fillStyles.push(this.fillStyle);
          fillRects.push([x, y, w, h, this.fillStyle]);
        }
      },
      fill() { if (track) fillStyles.push(this.fillStyle); },
      stroke() { if (track) strokeStyles.push(this.strokeStyle); },
      createLinearGradient: () => grad, createRadialGradient: () => grad,
      translate(x, y) { if (track) translates.push([x, y]); },
    });
    const canvas = {
      width: 640,
      height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx(false) }) },
      getContext: () => makeCtx(true),
    };
    const renderer = createRenderer(canvas);
    const game = createGame();

    for (const kind of ['fish', 'crab', 'jellyfish', 'squid', 'shark', 'kraken']) {
      const mob = game.world.mobs.find((entry) => entry.kind === kind);
      assert.ok(mob, kind);
      translates.length = 0;
      fillStyles.length = 0;
      strokeStyles.length = 0;
      fillRects.length = 0;
      renderer.draw({
        world: game.world,
        player: game.player,
        snorkel: null,
        camera: { x: mob.x - 160, y: mob.y - 90, width: 320, height: 180 },
        time: 1,
        elapsed: 1,
        aim: null,
        mining: null,
        miningSwing: null,
        held: null,
        attack: null,
        hasArrow: false,
        playerArrows: [],
        targetMob: null,
        particles: [],
        reducedMotion: false,
        conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0,
        weatherSeed: 0,
        caveShadowsHidden: true,
        openChestId: null,
      });
      assert.ok(
        translates.some(([x, y]) => x === Math.round(mob.x) && y === Math.round(mob.y)),
        `${kind} was not rendered`,
      );
      if (kind === 'kraken') {
        assert.ok(fillStyles.includes('#491f3d'));
        assert.ok(fillStyles.includes('#7e4268'));
        assert.ok(fillStyles.includes('#da9292'));

        const renderAtPlayerY = (py) => {
          fillRects.length = 0;
          game.player.x = mob.x - 100;
          game.player.y = py;
          renderer.draw({
            world: game.world, player: game.player, snorkel: null,
            camera: { x: mob.x - 160, y: mob.y - 90, width: 320, height: 180 },
            time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
            held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
            particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
            worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
          });
          return fillRects.find(([, , w, h, color]) => w === 5 && h === 4 && color === '#192b3e');
        };
        const upPupil = renderAtPlayerY(mob.y - 120);
        const downPupil = renderAtPlayerY(mob.y + 120);
        assert.ok(upPupil && downPupil && downPupil[1] > upPupil[1]);

        fillRects.length = 0;
        mob.attackMode = 'tackle';
        mob.tacklePhase = 0.4;
        mob.tentacleReach = 0.9;
        mob.tentacleTarget = { x: mob.x - 140, y: mob.y, ox: mob.x - 4, oy: mob.y + 4 };
        renderer.draw({
          world: game.world, player: game.player, snorkel: null,
          camera: { x: mob.x - 180, y: mob.y - 90, width: 320, height: 180 },
          time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
          held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
          particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
          worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
        });
        assert.ok(fillRects.some(([, , w, h, color]) => w === 4 && h === 4 && color === '#f0c88b'));

        strokeStyles.length = 0;
        mob.attackMode = 'idle';
        mob.sonarTime = 0.7;
        renderer.draw({
          world: game.world, player: game.player, snorkel: null,
          camera: { x: mob.x - 180, y: mob.y - 120, width: 320, height: 180 },
          time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
          held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
          particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
          worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
        });
        assert.ok(strokeStyles.includes('#8bdfd0') && strokeStyles.includes('#da9292'));
      }
    }
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});



test('screen shake module decays impulses cleanly and respects reduced motion', () => {
  const shake = createScreenShake();
  shake.trigger({ intensity: 10, duration: 0.5, frequency: 40 });
  assert.equal(shake.activeCount(), 1);

  const offset = shake.step(1 / 60, 0.25, false);
  assert.ok(Math.hypot(offset.x, offset.y) > 0);

  const reduced = shake.step(1 / 60, 0.3, true);
  assert.deepEqual(reduced, { x: 0, y: 0 });

  for (let i = 0; i < 40; i++) shake.step(1 / 60, 0.3 + i / 60, false);
  assert.equal(shake.activeCount(), 0);
  assert.deepEqual(shake.step(1 / 60, 1, false), { x: 0, y: 0 });
});

test('kraken death plays head implosion with screen shake and tentacle disintegration', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const game = createGame();
    const { world } = game;
    const kraken = world.mobs.find((mob) => mob.kind === 'kraken');
    damageMob(world, kraken, kraken.maxHealth, 0, 0, game.effects);
    assert.equal(kraken.health, 0);
    assert.equal(kraken.deathTime, KRAKEN_DEATH_DURATION);

    let shakeEffect = null;
    for (let i = 0; i < 90; i++) {
      game.effects.length = 0;
      stepGame(game, {}, 1 / 60);
      const found = game.effects.find((effect) => effect.shake);
      if (found) shakeEffect = found;
      if (i === 20) assert.ok(kraken.deathTime > 0);
    }
    assert.ok(shakeEffect?.shake?.intensity > 0);
    assert.equal(kraken.deathImploded, true);

    const noop = () => {};
    const grad = { addColorStop: noop };
    const fillRects = [];
    const strokes = [];
    const makeCtx = (track) => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {},
      fillRect(x, y, w, h) { if (track) fillRects.push([x, y, w, h, this.fillStyle]); },
      stroke() { if (track) strokes.push(this.strokeStyle); },
      createLinearGradient: () => grad, createRadialGradient: () => grad,
      translate: noop,
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx(false) }) },
      getContext: () => makeCtx(true),
    };
    const renderer = createRenderer(canvas);
    const drawAt = (deathTime) => {
      fillRects.length = 0;
      strokes.length = 0;
      kraken.deathTime = deathTime;
      renderer.draw({
        world, player: game.player, snorkel: null,
        camera: { x: kraken.x - 180, y: kraken.y - 120, width: 320, height: 180 },
        time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
        held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
        particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
        shake: { x: 4, y: -3 },
      });
    };

    drawAt(KRAKEN_DEATH_DURATION * 0.75);
    assert.ok(fillRects.some(([, , , , color]) => color === '#ff9b80'));
    assert.ok(fillRects.some(([, y, , , color]) => y < -100 && (color === '#491f3d' || color === '#7e4268')));

    drawAt(KRAKEN_DEATH_DURATION * 0.52);
    assert.ok(!fillRects.some(([, , w, , color]) => color === '#f1f3e5' && w >= 10));

    drawAt(KRAKEN_DEATH_DURATION * 0.3);
    assert.ok(strokes.includes('#8bdfd0'));

    fillRects.length = 0;
    game.player.inkSplats = [{ nx: 0.4, ny: 0.5, scale: 1, angle: 0.5, seed: 42, color: '#0d1017', time: 5, duration: 7 }];
    renderer.draw({
      world, player: game.player, snorkel: null,
      camera: { x: game.player.x - 160, y: game.player.y - 90, width: 320, height: 180 },
      time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
    assert.ok(fillRects.some(([, , , , color]) => color === '#1e232e'));
    assert.ok(fillRects.some(([, , , , color]) => color === '#4b5263'));
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('defeating the kraken drops a chest with a blue diving fin that equips in feet and boosts swim speed', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const game = createGame();
    const { world } = game;
    assert.equal(world.items.some((item) => item.id === KRAKEN_CHEST_ID), false);

    const kraken = world.mobs.find((mob) => mob.kind === 'kraken');
    damageMob(world, kraken, kraken.maxHealth, 0, 0, game.effects);

    let dropNotice = false;
    for (let i = 0; i < 600; i++) {
      game.effects.length = 0;
      stepGame(game, {}, 1 / 60);
      if (game.effects.some((effect) => effect.message === 'The Kraken dropped a chest!')) dropNotice = true;
    }
    assert.equal(dropNotice, true);

    const bossChest = world.items.find((item) => item.id === KRAKEN_CHEST_ID);
    assert.ok(bossChest);
    assert.equal(bossChest.falling, false);
    assert.equal(game.chests.get(KRAKEN_CHEST_ID)?.[0]?.id, DIVING_FIN.id);
    assert.equal(tileAt(world, Math.floor(bossChest.x / TILE), Math.floor((bossChest.y + 8) / TILE)) !== MATERIAL.air, true);

    // Move player to the dropped chest, inspect it, and equip the diving fin in feet.
    game.player.x = bossChest.x;
    game.player.y = bossChest.y + 8 - game.player.height;
    assert.equal(nearestItem(game), bossChest);
    assert.equal(chestAt(game, bossChest.x, bossChest.y), bossChest);

    const chestSlot = { group: 'chest', index: 0 };
    // The boss's Greater Soul may already occupy backpack slot 0.
    const backpackSlot = { group: 'backpack', index: game.inventory.backpack.findIndex((stack) => stack === null) };
    const feetSlot = { group: 'feet', index: 0 };
    const headSlot = { group: 'head', index: 0 };
    assert.equal(moveInventoryStack(game, KRAKEN_CHEST_ID, { group: 'hotbar', index: 3 }, feetSlot), false);
    assert.equal(moveInventoryStack(game, KRAKEN_CHEST_ID, chestSlot, backpackSlot), true);
    assert.equal(moveInventoryStack(game, KRAKEN_CHEST_ID, backpackSlot, feetSlot), true);
    assert.equal(moveInventoryStack(game, null, feetSlot, headSlot), false);
    assert.equal(equippedFeet(game)?.id, DIVING_FIN.id);

    // Compare horizontal and vertical swimming speeds without vs with diving fin, plus land walking speed.
    const measureSwim = (feetId, input) => {
      const sim = createGame();
      sim.player.x = 24 * TILE;
      sim.player.y = WATER + 6 * TILE;
      sim.player.feet = feetId;
      const startX = sim.player.x;
      const startY = sim.player.y;
      for (let i = 0; i < 45; i++) movePlayer(sim.world, sim.player, input, 1 / 60);
      return { dx: sim.player.x - startX, dy: sim.player.y - startY };
    };
    const baseRight = measureSwim(null, { right: true });
    const finRight = measureSwim(DIVING_FIN.id, { right: true });
    assert.ok(finRight.dx > baseRight.dx * 1.35);

    const baseUp = measureSwim(null, { up: true });
    const finUp = measureSwim(DIVING_FIN.id, { up: true });
    assert.ok(finUp.dy < baseUp.dy * 1.35);

    const walkDist = (feetId) => {
      const sim = createGame();
      sim.player.feet = feetId;
      const startX = sim.player.x;
      for (let i = 0; i < 20; i++) movePlayer(sim.world, sim.player, { right: true }, 1 / 60);
      return sim.player.x - startX;
    };
    assert.equal(walkDist(DIVING_FIN.id), walkDist(null));

    // Respawn, save/reload, and room reset behavior.
    game.player.health = 0;
    game.player.hurt = 1;
    stepGame(game, {}, 1 / 60);
    assert.equal(game.player.feet, DIVING_FIN.id);

    const restored = createGame(decodeSave(encodeSave(game)));
    assert.equal(restored.player.feet, DIVING_FIN.id);
    assert.equal(equippedFeet(restored)?.id, DIVING_FIN.id);
    assert.ok(restored.world.items.some((item) => item.id === KRAKEN_CHEST_ID));
    assert.equal(restored.chests.get(KRAKEN_CHEST_ID)?.[0], null);

    // Blue diving fin renders on the character's feet.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const fillRects = [];
    const makeCtx = (track) => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect(x, y, w, h) { if (track) fillRects.push([x, y, w, h, this.fillStyle]); },
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx(false) }) },
      getContext: () => makeCtx(true),
    };
    const renderer = createRenderer(canvas);
    restored.player.x = 24 * TILE;
    restored.player.y = WATER + 6 * TILE;
    renderer.draw({
      world: restored.world, player: restored.player, snorkel: null,
      camera: { x: restored.player.x - 160, y: restored.player.y - 90, width: 320, height: 180 },
      time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
    assert.ok(fillRects.some(([, , , , color]) => color === DIVING_FIN.colors[1]));
    assert.ok(fillRects.some(([, , , , color]) => color === DIVING_FIN.colors[2]));

    const reset = resetRoomProgress(restored);
    assert.equal(reset.player.feet, null);
    assert.equal(reset.world.items.some((item) => item.id === KRAKEN_CHEST_ID), false);
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('map expands beyond the kraken and ocean fades from blue to jungle green water', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    assert.equal(COLS, ORIGINAL_COLS + WEST_EXTENSION + EAST_EXTENSION);

    const kraken = world.mobs.find((mob) => mob.kind === 'kraken');
    assert.ok(kraken);
    const eastWaterTx = ORIGINAL_COLS + WEST_EXTENSION + 64;
    assert.equal(waterTileAt(world, eastWaterTx, WATER_ROW + 2), true);
    const cache = world.items.find((item) => item.id === 'jungle-trench-cache');
    assert.ok(cache && cache.x > kraken.x);
    assert.ok(world.items.some((item) => item.kind === 'kelp' && item.x > kraken.x));

    // Defeating the kraken clears the passage into the expanded eastern ocean.
    damageMob(world, kraken, kraken.maxHealth, 0, 0, game.effects);
    player.x = kraken.x - 20;
    player.y = WATER + 6 * TILE;
    for (let i = 0; i < 60; i++) movePlayer(world, player, { right: true }, 1 / 60);
    assert.ok(player.x > kraken.x + 60);

    // Even if the kraken respawns later while the player is deep in the green ocean, movement stays free.
    kraken.respawn = 0;
    kraken.health = kraken.maxHealth;
    const farEastX = (JUNGLE_FADE_END_COLUMN + WEST_EXTENSION + 20) * TILE;
    player.x = farEastX;
    player.y = WATER + 6 * TILE;
    stepGame(game, { right: true }, 1 / 60);
    assert.ok(player.x >= farEastX);

    // Edits and player position in the expanded east survive save/reload.
    const editTx = eastWaterTx;
    const editTy = groundAt(editTx) - 1;
    assert.equal(editTile(world, editTx, editTy, MATERIAL.wood), true);
    const reloaded = createGame(decodeSave(encodeSave(game)));
    assert.equal(tileAt(reloaded.world, editTx, editTy), MATERIAL.wood);
    assert.ok(reloaded.player.x >= farEastX);

    // Renderer paints blue stops west of the fade, blended transition stops across it, and jungle green stops east of it.
    const noop = () => {};
    const collectStops = (camX) => {
      const stops = [];
      const makeGrad = () => {
        const g = { stops: [], addColorStop(pos, color) { this.stops.push([pos, color]); } };
        stops.push(g.stops);
        return g;
      };
      const makeCtx = (track) => ({
        save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
        fill() {}, stroke() {}, fillRect: noop,
        createLinearGradient: () => (track ? makeGrad() : { addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
      });
      const canvas = {
        width: 640, height: 360,
        ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx(false) }) },
        getContext: () => makeCtx(true),
      };
      const renderer = createRenderer(canvas);
      renderer.draw({
        world, player, snorkel: null,
        camera: { x: camX, y: WATER - 20, width: 320, height: 180 },
        time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
        held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
        particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
      });
      return stops.flat().map(([, color]) => color);
    };

    const blueColors = collectStops((JUNGLE_FADE_START_COLUMN + WEST_EXTENSION - 30) * TILE);
    assert.ok(blueColors.includes('#307e83'));
    assert.ok(!blueColors.includes('#2f8a57'));

    const transitionColors = collectStops((JUNGLE_FADE_START_COLUMN + WEST_EXTENSION + 10) * TILE);
    assert.ok(transitionColors.includes('#307e83'));
    assert.ok(transitionColors.includes('#2f8a57'));

    const jungleColors = collectStops((JUNGLE_FADE_END_COLUMN + WEST_EXTENSION + 10) * TILE);
    assert.ok(jungleColors.includes('#2f8a57'));
    assert.ok(jungleColors.includes('#1b5938'));
    assert.ok(jungleColors.includes('#081e15'));
    assert.ok(!jungleColors.includes('#307e83'));
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('sea monsters keep tracking and damaging a player holding up or hopping at the ocean surface', () => {
  const openOceanX = (140 + WEST_EXTENSION) * TILE + 8;

  // Holding up at the surface (even with Diving fin) floats without popping out of water.
  const game = createGame();
  const { world, player } = game;
  Object.assign(player, { x: openOceanX, y: WATER + 2 * TILE, dx: 0, dy: 0, feet: DIVING_FIN.id, health: 100 });
  const shark = world.mobs.find((mob) => mob.kind === 'shark');
  assert.ok(shark);
  Object.assign(shark, {
    x: openOceanX + 48,
    y: WATER + 20,
    homeX: openOceanX + 48,
    homeY: WATER + 20,
    span: 40,
    dx: 0,
    dy: 0,
    flee: 0,
    cooldown: 0,
    hurt: 0,
    respawn: 0,
    health: shark.maxHealth,
    attackTimer: 1.5,
    windup: 0,
    dash: 0,
  });
  world.mobs = [shark];

  for (let i = 0; i < 150; i++) {
    stepGame(game, { left: false, right: false, up: true, down: false, jump: i === 0 }, 1 / 60);
    if (i >= 45) {
      assert.equal(playerInWater(world, player), true);
      assert.equal(playerHeadInWater(world, player), false);
    }
  }
  assert.ok(player.health < 100, 'expected shark to damage surface-swimming player');

  // Enemy fish also target a player swimming at the surface with their head above water.
  const fishGame = createGame();
  Object.assign(fishGame.player, { x: openOceanX, y: WATER - 12, dx: 0, dy: 0, health: 100 });
  fishGame.world.mobs = [{
    kind: 'fish',
    enemyType: { name: 'Reef snapper', speed: 42, airLoss: 1.5, healthLoss: 10 },
    x: openOceanX + 18,
    y: WATER + 14,
    homeX: openOceanX + 18,
    homeY: WATER + 14,
    span: 40,
    speed: 42,
    facing: -1,
    dx: 0,
    dy: 0,
    flee: 0,
    phase: 0,
    remainingLife: 20,
    health: 2,
    maxHealth: 2,
    hurt: 0,
    respawn: 0,
  }];
  for (let i = 0; i < 60; i++) {
    stepGame(fishGame, { left: false, right: false, up: true, down: false, jump: false }, 1 / 60);
  }
  assert.ok(fishGame.player.health < 100, 'expected enemy fish to bite surface-swimming player');

  // Repeatedly tapping jump at the ocean surface does not break squid targeting.
  const squidGame = createGame();
  Object.assign(squidGame.player, { x: openOceanX, y: WATER - 13, dx: 0, dy: 0, health: 100 });
  const squid = squidGame.world.mobs.find((mob) => mob.kind === 'squid');
  assert.ok(squid);
  Object.assign(squid, {
    x: openOceanX + 70,
    y: WATER + 22,
    homeX: openOceanX + 70,
    homeY: WATER + 22,
    span: 40,
    dx: 0,
    dy: 0,
    flee: 0,
    cooldown: 0,
    hurt: 0,
    respawn: 0,
    health: squid.maxHealth,
    attackTimer: 0.2,
    windup: 0,
  });
  squidGame.world.mobs = [squid];
  let fired = false;
  for (let i = 0; i < 90; i++) {
    stepGame(squidGame, { left: false, right: false, up: true, down: false, jump: i % 18 === 0 }, 1 / 60);
    if (squidGame.world.projectiles.some((p) => p.kind === 'paint-bubble')) fired = true;
  }
  assert.equal(fired, true, 'expected squid to fire while player hops at the surface');
});

test('swimming player can exit water onto blocks at or above the waterline and stand safely above them', () => {
  const baseTx = 145 + WEST_EXTENSION;

  for (const blockRow of [WATER_ROW, WATER_ROW - 1, WATER_ROW - 2]) {
    const game = createGame();
    const { world, player } = game;
    assert.equal(editTile(world, baseTx, blockRow, MATERIAL.wood), true);
    Object.assign(player, {
      x: baseTx * TILE - 8,
      y: WATER - 13,
      dx: 0,
      dy: 0,
      grounded: false,
      waterJump: false,
    });
    const shark = world.mobs.find((mob) => mob.kind === 'shark');
    Object.assign(shark, {
      x: player.x - 45,
      y: WATER + 22,
      homeX: player.x - 45,
      homeY: WATER + 22,
      span: 40,
      dx: 0,
      dy: 0,
      flee: 0,
      cooldown: 0,
      hurt: 0,
      respawn: 0,
      health: shark.maxHealth,
      attackTimer: 1.5,
      windup: 0,
      dash: 0,
    });
    world.mobs = [shark];

    for (let i = 0; i < 90; i++) {
      const overBlock = Math.floor(player.x / TILE) === baseTx;
      stepGame(game, { left: false, right: !overBlock, up: true, down: false, jump: i === 0 }, 1 / 60);
      if (player.grounded && overBlock) break;
    }

    assert.equal(player.grounded, true, `expected player to land on block at row ${blockRow}`);
    assert.ok(player.y + player.height <= blockRow * TILE + 0.02);
    assert.equal(playerInWater(world, player), false);
    assert.equal(player.waterJump, false);

    // Once standing above the block out of water, nearby shark ignores the player.
    const healthOnBlock = player.health;
    for (let i = 0; i < 60; i++) {
      stepGame(game, { left: false, right: false, up: false, down: false, jump: false }, 1 / 60);
    }
    assert.equal(player.health, healthOnBlock);
  }

  // Fresh jump from the surface clears WATER_ROW so the player can place a block beneath themselves.
  const pillarGame = createGame();
  const { world: pillarWorld, player: pillarPlayer } = pillarGame;
  assert.equal(editTile(pillarWorld, baseTx + 1, WATER_ROW, MATERIAL.wood), true);
  Object.assign(pillarPlayer, { x: baseTx * TILE + 8, y: WATER - 13, dx: 0, dy: 0, grounded: false });
  let placed = false;
  for (let i = 0; i < 65; i++) {
    stepGame(pillarGame, { left: false, right: false, up: true, down: false, jump: i === 0 }, 1 / 60);
    if (!placed && pillarPlayer.y + pillarPlayer.height <= WATER) {
      placed = editTile(pillarWorld, baseTx, WATER_ROW, MATERIAL.wood);
    }
  }
  assert.equal(placed, true);
  assert.equal(pillarPlayer.grounded, true);
  assert.ok(pillarPlayer.y + pillarPlayer.height <= WATER + 0.02);
  assert.equal(playerInWater(pillarWorld, pillarPlayer), false);
});


test('jungle ocean biome contains a larger island with jungle trees and an indigenous village', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;

    // Compare above-water span of spawn island vs jungle island.
    let spawnDryCols = 0;
    for (let x = 20; x < 90; x++) {
      if (groundAt(x + WEST_EXTENSION) < WATER_ROW) spawnDryCols++;
    }
    let jungleDryCols = 0;
    for (let x = JUNGLE_FADE_END_COLUMN; x < COLS - WEST_EXTENSION; x++) {
      if (groundAt(x + WEST_EXTENSION) < WATER_ROW) jungleDryCols++;
    }
    assert.ok(jungleDryCols > spawnDryCols * 1.5, `expected jungle island (${jungleDryCols}) to be more extensive than spawn (${spawnDryCols})`);

    // Village structures and chest sit on solid dry ground on the jungle island.
    for (const [, , column, floor] of jungleVillageStructures) {
      const tx = column + WEST_EXTENSION;
      assert.ok(column > JUNGLE_FADE_END_COLUMN);
      assert.equal(groundAt(tx), floor);
      assert.ok(floor < WATER_ROW);
      assert.ok(tileAt(world, tx, floor));
      assert.equal(tileAt(world, tx, floor - 1), MATERIAL.air);
    }
    const villageChest = world.items.find((item) => item.id === 'jungle-village-cache');
    assert.ok(villageChest && villageChest.y < WATER);

    // Jungle trees exist on the island, can be chopped for wood, and stay harvested on reload.
    const jungleTrees = world.trees.filter((tree) => tree.kind === 'jungle');
    assert.ok(jungleTrees.length >= 6);
    const chopped = jungleTrees[0];
    assert.ok(chopped.x > (JUNGLE_FADE_END_COLUMN + WEST_EXTENSION) * TILE);
    player.x = chopped.x - 16;
    player.y = chopped.y - player.height;
    const action = planTileAction(game, { tx: chopped.tx, ty: chopped.ty - 1, reachable: true }, false, 0);
    assert.equal(action?.fixtureId, chopped.id);
    commitTileAction(game, action);
    const reloaded = createGame(decodeSave(encodeSave(game)));
    assert.equal(reloaded.world.harvested.has(chopped.id), true);

    // Renderer paints jungle trees and indigenous village structures.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const fillColors = [];
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      putImageData: noop, stroke: noop,
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      fill() { fillColors.push(this.fillStyle); },
      fillRect() { fillColors.push(this.fillStyle); },
      createLinearGradient: () => grad, createRadialGradient: () => grad,
      translate: noop,
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    };
    const renderer = createRenderer(canvas);
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: (JUNGLE_ISLAND.center + WEST_EXTENSION) * TILE - 180, y: 4 * TILE, width: 360, height: 200 },
      time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
    assert.ok(fillColors.includes('#1e4a35') && fillColors.includes('#68b064'));
    assert.ok(fillColors.includes('#876f3b') && fillColors.includes('#d95c48'));
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('jungle island hosts bow and spear cannibals that chase, attack, and render cleanly', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    const spearCannibals = world.mobs.filter((mob) => mob.kind === 'cannibal-spear');
    const bowCannibals = world.mobs.filter((mob) => mob.kind === 'cannibal-bow');
    assert.ok(spearCannibals.length >= 2);
    assert.ok(bowCannibals.length >= 2);

    for (const mob of [...spearCannibals, ...bowCannibals]) {
      const tx = Math.floor(mob.x / TILE);
      const floorRow = mob.y / TILE;
      assert.ok(mob.x > (JUNGLE_FADE_END_COLUMN + WEST_EXTENSION) * TILE);
      assert.ok(floorRow < WATER_ROW);
      assert.ok(tileAt(world, tx, floorRow), mob.id);
      assert.equal(tileAt(world, tx, floorRow - 1), MATERIAL.air, mob.id);
      assert.equal(tileAt(world, tx, floorRow - 2), MATERIAL.air, mob.id);
      assert.equal(waterTileAt(world, tx, floorRow - 1), false, mob.id);
    }

    // Spear cannibal sees the player on the island, runs toward them, and strikes.
    const spearMob = spearCannibals[0];
    world.mobs = [spearMob];
    spearMob.attackTimer = 0;
    const startMobX = spearMob.x;
    Object.assign(player, {
      x: startMobX + 6 * TILE,
      y: spearMob.y - player.height,
      dx: 0,
      dy: 0,
      grounded: true,
      hurt: 0,
      health: 100,
    });
    let maxRunSpeed = 0;
    for (let i = 0; i < 140 && player.health === 100; i++) {
      stepGame(game, { left: false, right: false, up: false, down: false, jump: false }, 1 / 60);
      maxRunSpeed = Math.max(maxRunSpeed, Math.abs(spearMob.dx));
    }
    assert.ok(maxRunSpeed >= 70, `expected spear cannibal to run, got max speed ${maxRunSpeed}`);
    assert.ok(spearMob.x > startMobX + 2 * TILE);
    assert.ok(player.health < 100, 'expected spear cannibal attack to damage player');

    // Bow cannibal aims and fires arrows at the player.
    const bowGame = createGame();
    const bowMob = bowGame.world.mobs.find((mob) => mob.kind === 'cannibal-bow' && mob.y === JUNGLE_ISLAND.floor * TILE);
    assert.ok(bowMob);
    bowGame.world.mobs = [bowMob];
    bowMob.attackTimer = 0;
    Object.assign(bowGame.player, {
      x: bowMob.x - 5 * TILE,
      y: bowMob.y - bowGame.player.height,
      dx: 0,
      dy: 0,
      grounded: true,
      hurt: 0,
      health: 100,
    });
    let sawArrow = false;
    for (let i = 0; i < 120 && bowGame.player.health === 100; i++) {
      stepGame(bowGame, { left: false, right: false, up: false, down: false, jump: false }, 1 / 60);
      if (bowGame.world.projectiles.some((p) => p.kind === 'cave-arrow')) sawArrow = true;
    }
    assert.equal(sawArrow, true);
    assert.ok(bowGame.player.health < 100, 'expected bow cannibal arrow to hit player');

    // Player can damage and defeat cannibals, and renderer draws both variants.
    const fullGame = createGame();
    const targetSpear = fullGame.world.mobs.find((mob) => mob.kind === 'cannibal-spear');
    const targetBow = fullGame.world.mobs.find((mob) => mob.kind === 'cannibal-bow');
    assert.ok(targetSpear && targetBow);
    damageMob(fullGame.world, targetSpear, 10, 0, 80, fullGame.effects);
    assert.equal(targetSpear.health, 0);
    assert.ok(targetSpear.respawn > 0);

    targetSpear.health = targetSpear.maxHealth;
    targetSpear.respawn = 0;
    targetSpear.spearThrust = 0.16;
    targetSpear.grounded = false;
    targetSpear.dy = -120;
    targetBow.windup = 0.25;
    const fillColors = [];
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      putImageData: noop, stroke: noop,
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      fill() { fillColors.push(this.fillStyle); },
      fillRect() { fillColors.push(this.fillStyle); },
      createLinearGradient: () => grad, createRadialGradient: () => grad,
      translate: noop,
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    };
    const renderer = createRenderer(canvas);
    renderer.draw({
      world: fullGame.world, player: fullGame.player, snorkel: null,
      camera: { x: (JUNGLE_ISLAND.center + WEST_EXTENSION) * TILE - 320, y: 2 * TILE, width: 640, height: 360 },
      time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
    assert.ok(fillColors.includes('#936044') && fillColors.includes('#3b7a4b'));
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('cannibals can jump over obstacles, pits, and toward elevated players without jumping into the ocean', () => {
  // 1. Spear cannibal jumps up a 2-tile-high barricade to reach an elevated player.
  const wallGame = createGame();
  const wallMob = wallGame.world.mobs.find((mob) => mob.kind === 'cannibal-spear' && mob.y === JUNGLE_ISLAND.floor * TILE);
  assert.ok(wallMob);
  wallGame.world.mobs = [wallMob];
  const mobTx = Math.floor(wallMob.x / TILE);
  const wallTx = mobTx + 2;
  editTile(wallGame.world, wallTx, JUNGLE_ISLAND.floor - 1, MATERIAL.wood);
  editTile(wallGame.world, wallTx, JUNGLE_ISLAND.floor - 2, MATERIAL.wood);
  Object.assign(wallGame.player, {
    x: (wallTx + 0.5) * TILE,
    y: (JUNGLE_ISLAND.floor - 2) * TILE - wallGame.player.height,
    dx: 0,
    dy: 0,
    grounded: true,
    hurt: 0,
    health: 100,
  });
  let jumped = false;
  for (let i = 0; i < 120; i++) {
    stepGame(wallGame, { left: false, right: false, up: false, down: false, jump: false }, 1 / 60);
    if (!wallMob.grounded && wallMob.dy < -50) jumped = true;
    if (wallMob.grounded && wallMob.y <= (JUNGLE_ISLAND.floor - 2) * TILE && Math.floor(wallMob.x / TILE) >= wallTx) break;
  }
  assert.equal(jumped, true);
  assert.ok(wallMob.y <= (JUNGLE_ISLAND.floor - 2) * TILE);
  assert.ok(Math.floor(wallMob.x / TILE) >= wallTx);

  // 2. Bow cannibal jumps across a dug pit in the village plateau.
  const gapGame = createGame();
  const gapMob = gapGame.world.mobs.find((mob) => mob.kind === 'cannibal-bow' && mob.y === JUNGLE_ISLAND.floor * TILE);
  assert.ok(gapMob);
  gapGame.world.mobs = [gapMob];
  const gapTx = Math.floor(gapMob.x / TILE) - 2;
  editTile(gapGame.world, gapTx, JUNGLE_ISLAND.floor, MATERIAL.air);
  editTile(gapGame.world, gapTx, JUNGLE_ISLAND.floor + 1, MATERIAL.air);
  Object.assign(gapGame.player, {
    x: (gapTx - 6) * TILE,
    y: JUNGLE_ISLAND.floor * TILE - gapGame.player.height,
    dx: 0,
    dy: 0,
    grounded: true,
  });
  let clearedGap = false;
  for (let i = 0; i < 140; i++) {
    stepGame(gapGame, { left: false, right: false, up: false, down: false, jump: false }, 1 / 60);
    if (Math.floor(gapMob.x / TILE) < gapTx && gapMob.y <= JUNGLE_ISLAND.floor * TILE) {
      clearedGap = true;
      break;
    }
  }
  assert.equal(clearedGap, true);

  // 3. Spear cannibal chasing toward the ocean shoreline stops dry and does not jump into the sea.
  const edgeGame = createGame();
  const edgeMob = edgeGame.world.mobs.find((mob) => mob.kind === 'cannibal-spear');
  assert.ok(edgeMob);
  edgeGame.world.mobs = [edgeMob];
  edgeMob.x = (JUNGLE_ISLAND.center - 24 + WEST_EXTENSION) * TILE + 8;
  edgeMob.homeX = edgeMob.x;
  edgeMob.y = groundAt(JUNGLE_ISLAND.center - 24 + WEST_EXTENSION) * TILE;
  edgeMob.homeY = edgeMob.y;
  Object.assign(edgeGame.player, {
    x: (JUNGLE_ISLAND.center - 31 + WEST_EXTENSION) * TILE,
    y: WATER - 13,
    dx: 0,
    dy: 0,
    grounded: false,
  });
  for (let i = 0; i < 150; i++) {
    stepGame(edgeGame, { left: false, right: false, up: true, down: false, jump: false }, 1 / 60);
    assert.equal(waterTileAt(edgeGame.world, Math.floor(edgeMob.x / TILE), Math.floor((edgeMob.y - 1) / TILE)), false);
  }
});

test('jungle island has a deep progressive cave ending in a Lovecraftian cult chamber', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const { world, player } = createGame();
    const startTx = JUNGLE_CAVE.entry + WEST_EXTENSION;
    const startTy = JUNGLE_CAVE.entryFloor - 1;
    const endTx = JUNGLE_CAVE.idolColumn + WEST_EXTENSION;
    const endTy = JUNGLE_CAVE.sanctuaryFloor - 1;
    assert.equal(tileAt(world, startTx, startTy), MATERIAL.air);
    assert.equal(waterTileAt(world, startTx, startTy), false);

    // Traverse dry jungle cave air tiles from upper entry down to bottom cult sanctuary.
    const startKey = startTx + ',' + startTy;
    const targetKey = endTx + ',' + endTy;
    const visited = new Set([startKey]);
    const queue = [[startTx, startTy]];
    let reachedSanctuary = false;
    let deepest = 0;
    while (queue.length) {
      const [cx, cy] = queue.shift();
      deepest = Math.max(deepest, cy);
      if (cx + ',' + cy === targetKey) {
        reachedSanctuary = true;
      }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const column = nx - WEST_EXTENSION;
        const key = nx + ',' + ny;
        if (visited.has(key) || !isDryJungleCave(column, ny)) continue;
        assert.equal(tileAt(world, nx, ny), MATERIAL.air);
        assert.equal(waterTileAt(world, nx, ny), false);
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
    assert.equal(reachedSanctuary, true);
    assert.ok(deepest >= JUNGLE_CAVE.sanctuaryFloor - 1);

    // Progressive features: normal cave top -> moss/scriptures -> statues/columns -> deepstone cult idol.
    assert.equal(tileAt(world, startTx, JUNGLE_CAVE.entryFloor), MATERIAL.stone);
    assert.equal(tileAt(world, endTx, JUNGLE_CAVE.sanctuaryFloor), MATERIAL.deepstone);
    assert.ok(visited.has((JUNGLE_ISLAND.center - 30 + WEST_EXTENSION) + ',' + 285), 'west branch is reachable');
    assert.ok(visited.has((JUNGLE_ISLAND.center + 36 + WEST_EXTENSION) + ',' + 283), 'east branch is reachable');
    assert.ok(jungleMossProgress(220) > jungleMossProgress(100));

    const kindsByFloor = (kind) => world.caveStructures.filter((s) => s.kind === kind).map((s) => s.floor);
    const torchFloors = kindsByFloor('native-torch');
    const boneFloors = kindsByFloor('bones');
    const scriptureFloors = kindsByFloor('scripture');
    const columnFloors = kindsByFloor('temple-column');
    const statueFloors = kindsByFloor('tentacle-statue');
    const idol = world.caveStructures.find((s) => s.kind === 'cult-idol');

    assert.ok(Math.min(...torchFloors) < 40);
    assert.ok(Math.min(...boneFloors) < 40);
    assert.ok(Math.min(...scriptureFloors) > 100);
    const firstStatueFloor = Math.min(...statueFloors);
    assert.ok(firstStatueFloor > 230 && firstStatueFloor < 290);
    assert.ok(Math.min(...columnFloors) > 230);
    assert.ok(idol && idol.floor === JUNGLE_CAVE.sanctuaryFloor);
    assert.ok(world.caveTraps.some((t) => t.kind === 'spike'));
    assert.ok(world.caveTraps.some((t) => t.kind === 'false-ground'));

    // Stepping onto a spike trap makes spikes emerge under the player and hurt them.
    const spikeTrap = world.caveTraps.find((t) => t.kind === 'spike');
    const spikeGame = createGame();
    spikeGame.world.mobs = [];
    Object.assign(spikeGame.player, {
      x: (spikeTrap.tx + 0.5) * TILE,
      y: (spikeTrap.ty + 1) * TILE - spikeGame.player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });
    const activeSpike = spikeGame.world.caveTraps.find((t) => t.tx === spikeTrap.tx && t.ty === spikeTrap.ty && t.kind === 'spike');
    for (let i = 0; i < 25; i++) stepGame(spikeGame, {}, 1 / 60);
    assert.equal(activeSpike.state, 'extended');
    assert.ok(spikeGame.player.health < 100);

    // Stepping onto a false-ground slab cracks and collapses it so the player falls into the pit below.
    const falseSlab = world.caveTraps.find((t) => t.kind === 'false-ground');
    const falseGame = createGame();
    falseGame.world.mobs = [];
    Object.assign(falseGame.player, {
      x: (falseSlab.tx + 0.5) * TILE,
      y: falseSlab.ty * TILE - falseGame.player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });
    const startFallY = falseGame.player.y;
    for (let i = 0; i < 35; i++) stepGame(falseGame, {}, 1 / 60);
    assert.equal(tileAt(falseGame.world, falseSlab.tx, falseSlab.ty), MATERIAL.air);
    assert.ok(falseGame.player.y > startFallY + TILE);

    // Render upper cave and sunken cult chamber without errors.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    };
    const renderer = createRenderer(canvas);
    for (const focus of [
      { x: startTx * TILE, y: (JUNGLE_CAVE.entryFloor - 2) * TILE },
      { x: endTx * TILE - 80, y: (JUNGLE_CAVE.sanctuaryFloor - 3) * TILE },
    ]) {
      player.x = focus.x;
      player.y = focus.y;
      renderer.draw({
        world, player, snorkel: null,
        camera: { x: focus.x - 160, y: focus.y - 90, width: 320, height: 180 },
        time: 1.5, elapsed: 1.5, aim: null, mining: null, miningSwing: null,
        held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
        particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
      });
    }
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});


test('frog cultists pray aligned toward the idol and all aggro to leap and claw-slash on proximity or attack', () => {
  // 1. Aligned prayer at distance & group aggro when one is attacked.
  const game = createGame();
  const frogs = game.world.mobs.filter((mob) => mob.kind === 'frog').sort((a, b) => a.x - b.x);
  assert.equal(JUNGLE_CAVE.idolColumn, JUNGLE_CAVE.sanctuaryCenter);
  assert.equal(frogs.length, 6);
  const idolX = (JUNGLE_CAVE.idolColumn + WEST_EXTENSION + 0.5) * TILE;
  for (const frog of frogs) {
    assert.equal(frog.praying, true);
    assert.equal(frog.facing, frog.x <= idolX ? 1 : -1);
  }
  const westOffsets = frogs.filter((f) => f.x < idolX).map((f) => Math.round(idolX - f.x)).sort((a, b) => a - b);
  const eastOffsets = frogs.filter((f) => f.x > idolX).map((f) => Math.round(f.x - idolX)).sort((a, b) => a - b);
  assert.deepEqual(westOffsets, eastOffsets);

  // Player standing beyond proximity stays safe and frogs keep praying.
  const westernmost = frogs.reduce((best, mob) => (mob.x < best.x ? mob : best));
  Object.assign(game.player, {
    x: westernmost.x - (FROG_PROXIMITY_RANGE + 48),
    y: JUNGLE_CAVE.sanctuaryFloor * TILE - game.player.height,
    dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
  });
  for (let i = 0; i < 30; i++) stepGame(game, {}, 1 / 60);
  assert.equal(game.world.jungleCultAggro, false);
  for (const frog of frogs) assert.equal(frog.praying, true);

  // Attacking a single frog alerts every frog in the chamber.
  damageMob(game.world, westernmost, 1, 0, 20, []);
  assert.equal(game.world.jungleCultAggro, true);
  stepGame(game, {}, 1 / 60);
  for (const frog of frogs) {
    assert.equal(frog.cultAggro, true);
    assert.equal(frog.praying, false);
  }

  // 2. Approaching too close without attacking aggros all frogs and triggers leap movement & claw-slashing attacks.
  const proxGame = createGame();
  const proxFrogs = proxGame.world.mobs.filter((mob) => mob.kind === 'frog');
  const firstFrog = proxFrogs.reduce((best, mob) => (mob.x < best.x ? mob : best));
  Object.assign(proxGame.player, {
    x: firstFrog.x - (FROG_PROXIMITY_RANGE - 16),
    y: JUNGLE_CAVE.sanctuaryFloor * TILE - proxGame.player.height,
    dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
  });
  let sawClawSlash = false;
  let sawLeap = false;
  let sawBiteDash = false;
  let playerHurt = false;
  for (let i = 0; i < 240; i++) {
    stepGame(proxGame, {}, 1 / 60);
    for (const frog of proxFrogs) {
      if (frog.clawSlash != null) sawClawSlash = true;
      if (!frog.grounded && frog.dy < -50 && Math.abs(frog.dx) >= 120) sawLeap = true;
      if (frog.dash > 0) sawBiteDash = true;
    }
    if (proxGame.player.health < 100) playerHurt = true;
    proxGame.player.oxygen = 100;
    if (proxGame.player.health < 60) proxGame.player.health = 90;
  }
  assert.equal(proxGame.world.jungleCultAggro, true);
  for (const frog of proxFrogs) assert.equal(frog.cultAggro, true);
  assert.equal(sawLeap, true);
  assert.equal(sawBiteDash, false);
  assert.equal(sawClawSlash, true);
  assert.equal(playerHurt, true);
});

test('jungle cave hosts a segmented Terraria-style worm that burrows through solid walls and damages or takes hits across segments', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    const worms = world.mobs.filter((mob) => mob.kind === 'worm');
    assert.ok(worms.length >= 2);
    const worm = worms[0];
    world.mobs = [worm];

    // Position player on the open Crossroads Vault floor (row 208) above the burrowing worm.
    Object.assign(player, {
      x: worm.x - 48,
      y: 208 * TILE - player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });

    let sawSolid = false;
    let sawAir = false;
    let hitPlayer = false;
    for (let i = 0; i < 360; i++) {
      stepGame(game, {}, 1 / 60);
      const tx = Math.floor(worm.x / TILE);
      const ty = Math.floor(worm.y / TILE);
      if (tileAt(world, tx, ty)) sawSolid = true;
      else sawAir = true;
      if (player.health < 100) {
        hitPlayer = true;
        player.health = 100;
      }
      player.oxygen = 100;
    }

    assert.equal(worm.segments?.length, 12);
    assert.equal(sawSolid, true, 'worm should burrow through solid cave blocks');
    assert.equal(sawAir, true, 'worm should emerge into cave background walls');
    assert.equal(hitPlayer, true, 'worm segments should damage the player on contact');

    // Verify segment spacing follows smoothly behind the head.
    for (let i = 1; i < worm.segments.length; i++) {
      const gap = Math.hypot(worm.segments[i - 1].x - worm.segments[i].x, worm.segments[i - 1].y - worm.segments[i].y);
      assert.ok(gap >= 9 && gap <= 12);
    }

    // Verify hovering or attacking a trailing tail segment targets and damages the worm.
    const tail = worm.segments[worm.segments.length - 1];
    Object.assign(player, { x: tail.x - 14, y: tail.y - player.height / 2, facing: 1 });
    assert.equal(targetMobAt(game, tail.x, tail.y), worm);
    grantItem(game, IRON_SWORD.id, 1);
    const swordSlot = game.inventory.hotbar.findIndex((s) => s?.id === IRON_SWORD.id);
    const prevHp = worm.health;
    worm.dx = 0;
    worm.dy = 0;
    useWeapon(game, swordSlot >= 0 ? swordSlot : 0, tail.x, tail.y);
    for (let i = 0; i < 20; i++) stepGame(game, {}, 1 / 60);
    assert.ok(worm.health < prevHp);

    // Render segmented worm clipped cleanly behind solid terrain without errors.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const canvas = {
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    };
    const renderer = createRenderer(canvas);
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: worm.x - 160, y: worm.y - 90, width: 320, height: 180 },
      time: 2, elapsed: 2, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: worm,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('jungle island cannibals transform into frog people at night and revert at day without affecting cave cultists', () => {
  const game = createGame();
  const { world, player } = game;
  const cannibals = world.mobs.filter((mob) => mob.kind === 'cannibal-spear' || mob.kind === 'cannibal-bow');
  const caveFrogs = world.mobs.filter((mob) => mob.kind === 'frog');
  assert.ok(cannibals.length >= 4);
  assert.equal(caveFrogs.length, 6);
  const originalKinds = new Map(cannibals.map((mob) => [mob.id, mob.kind]));

  // Position player near a surface cannibal on the Jungle Island.
  const target = cannibals[0];
  Object.assign(player, {
    x: target.x + 4 * TILE,
    y: target.y - player.height,
    dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
  });

  // Nightfall transforms surface cannibals into frogs, while cave cultists remain undisturbed frogs.
  stepGame(game, { night: true }, 1 / 60);
  for (const mob of cannibals) {
    assert.equal(mob.kind, 'frog');
    assert.equal(mob.praying, false);
    assert.equal(mob.maxHealth, 7);
    assert.equal(mob.health, 7);
  }
  assert.equal(world.jungleCultAggro ?? false, false);
  for (const caveFrog of caveFrogs) {
    assert.equal(caveFrog.kind, 'frog');
    assert.equal(caveFrog.praying, true);
  }

  // Transformed surface frogs leap toward the player and attacking them does not aggro cave cultists.
  let sawSurfaceLeap = false;
  for (let i = 0; i < 60; i++) {
    stepGame(game, { night: true }, 1 / 60);
    if (!target.grounded && target.dy < -50 && Math.abs(target.dx) >= 120) sawSurfaceLeap = true;
  }
  assert.equal(sawSurfaceLeap, true);
  damageMob(world, target, 3, 0, 20, []);
  assert.equal(target.health, 4);
  assert.equal(world.jungleCultAggro ?? false, false);

  // Daybreak reverts only the surface cannibals back to their original spear/bow forms (scaling HP), leaving cave frogs untouched.
  stepGame(game, { night: false }, 1 / 60);
  for (const mob of cannibals) {
    assert.equal(mob.kind, originalKinds.get(mob.id));
    assert.equal(mob.praying, false);
    assert.equal(mob.cultAggro, false);
  }
  assert.ok(target.health > 0 && target.health < target.maxHealth);
  for (const caveFrog of caveFrogs) {
    assert.equal(caveFrog.kind, 'frog');
    assert.equal(caveFrog.praying, true);
  }
});

test('grappling hook is found deep in the first island caves, equips to hands, persists, and follows Terraria hook physics', () => {
  const game = createGame();
  const { world, player } = game;

  // Deep dungeon vault chest contains the grappling hook and bonus iron ore.
  const gatehouseChest = world.items.find((item) => item.id === 'underground-cache');
  assert.ok(gatehouseChest);
  assert.equal(game.chests.get('underground-cache')[0]?.id, 'iron');
  assert.equal(game.chests.get('underground-cache')[0]?.count, 3);

  const deepChest = world.items.find((item) => item.id === 'underground-vault');
  assert.ok(deepChest);
  const deepCol = Math.floor(deepChest.x / TILE) - WEST_EXTENSION;
  const deepRow = Math.floor(deepChest.y / TILE);
  assert.ok(deepRow >= 500);
  assert.equal(isDungeonMasonry(deepCol, deepRow), true);
  const chestSlots = game.chests.get('underground-vault');
  assert.equal(chestSlots[0]?.id, GRAPPLING_HOOK.id);
  assert.equal(chestSlots[1]?.id, 'iron');
  assert.equal(chestSlots[1]?.count, 4);

  // Move from chest into off-hand slot and verify persistence across save/reload.
  assert.equal(moveInventoryStack(game, 'underground-vault', { group: 'chest', index: 0 }, { group: 'offhand', index: 0 }), true);
  assert.equal(equippedHook(game)?.id, GRAPPLING_HOOK.id);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(equippedHook(restored)?.id, GRAPPLING_HOOK.id);
  assert.equal(hasHook(restored)?.id, GRAPPLING_HOOK.id);

  // Clear a shaft above spawn with a solid ceiling tile to grapple onto.
  const tx = Math.floor(SPAWN.x / TILE);
  const ceilingTy = Math.floor(player.y / TILE) - 6;
  const floorTy = Math.floor((player.y + player.height) / TILE);
  for (let y = ceilingTy + 1; y <= floorTy - 1; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) editTile(restored.world, x, y, MATERIAL.air);
  }
  editTile(restored.world, tx - 2, ceilingTy, MATERIAL.stone);
  editTile(restored.world, tx - 1, ceilingTy, MATERIAL.stone);
  player.health = 100;
  Object.assign(restored.player, {
    x: (tx + 0.5) * TILE,
    y: floorTy * TILE - restored.player.height,
    dx: 0, dy: 0, grounded: true, facing: 1, fallDistance: 120, oxygen: 100, stun: 0,
  });

  // Shoot hook toward ceiling left of player (opposite facing) -> turns, latches, pulls up, resets fallDistance, and hangs.
  const targetX = (tx - 1.5) * TILE;
  const targetY = (ceilingTy + 0.5) * TILE;
  assert.equal(useGrapplingHook(restored, targetX, targetY), true);
  assert.equal(restored.player.facing, -1);
  assert.equal(restored.player.hook.state, 'extending');

  let sawLatched = false;
  for (let i = 0; i < 60; i++) {
    stepGame(restored, {}, 1 / 60);
    if (restored.player.hook?.state === 'latched') sawLatched = true;
  }
  assert.equal(sawLatched, true);
  assert.equal(restored.player.hook.state, 'latched');
  assert.equal(restored.player.fallDistance, 0);
  const hangY = restored.player.y;
  assert.ok(hangY < floorTy * TILE - restored.player.height - 20);

  // Remains suspended cleanly without falling while latched.
  for (let i = 0; i < 20; i++) stepGame(restored, {}, 1 / 60);
  assert.equal(restored.player.hook.state, 'latched');
  assert.ok(Math.abs(restored.player.y - hangY) < 0.5);

  // Render frame with active hook/chain without errors.
  const noop = () => {};
  const grad = { addColorStop: noop };
  const makeCtx = () => ({
    save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
    fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
    fillRect() {},
  });
  const renderer = createRenderer({
    width: 640, height: 360,
    ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
    getContext: makeCtx,
  });
  renderer.draw({
    world: restored.world, player: restored.player, snorkel: null,
    camera: { x: restored.player.x - 160, y: restored.player.y - 90, width: 320, height: 180 },
    time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
    held: null, attack: null, hasArrow: false, playerArrows: [], hook: restored.player.hook,
    targetMob: null, particles: [], reducedMotion: false,
    conditions: { darkness: 0, rain: 0, night: false }, worldTime: 0, weatherSeed: 0,
    caveShadowsHidden: true, openChestId: null,
  });

  // Mining away the latched tile releases the player cleanly.
  const latchedTx = restored.player.hook.tx;
  const latchedTy = restored.player.hook.ty;
  applyTerrain(restored, latchedTx, latchedTy, MATERIAL.air);
  stepGame(restored, {}, 1 / 60);
  assert.equal(restored.player.hook, null);

  // Latch onto stone ceiling, then pressing Jump releases from the ceiling;
  // Latching onto an open side wall and pressing Jump launches upward cleanly.
  editTile(restored.world, tx - 2, ceilingTy, MATERIAL.stone);
  const wallTy = floorTy - 3;
  editTile(restored.world, tx - 3, wallTy, MATERIAL.stone);
  restored.player.x = (tx + 0.5) * TILE;
  restored.player.y = floorTy * TILE - restored.player.height;
  restored.player.grounded = true;
  assert.equal(useGrapplingHook(restored, (tx - 2.5) * TILE, (wallTy + 0.5) * TILE), true);
  for (let i = 0; i < 40; i++) stepGame(restored, {}, 1 / 60);
  assert.equal(restored.player.hook?.state, 'latched');
  stepGame(restored, { jump: true, up: true }, 1 / 60);
  assert.equal(restored.player.hook, null);
  assert.ok(restored.player.dy < -100);

  // Shooting upward into open sky beyond max range extends then retracts and clears.
  for (let x = tx - 2; x <= tx + 2; x++) {
    for (let y = 0; y <= floorTy - 1; y++) editTile(restored.world, x, y, MATERIAL.air);
  }
  restored.player.x = (tx + 0.5) * TILE;
  restored.player.y = floorTy * TILE - restored.player.height;
  restored.player.grounded = true;
  assert.equal(useGrapplingHook(restored, restored.player.x, 0), true);
  let sawRetracting = false;
  for (let i = 0; i < 120; i++) {
    stepGame(restored, {}, 1 / 60);
    if (restored.player.hook?.state === 'retracting') sawRetracting = true;
  }
  assert.equal(sawRetracting, true);
  assert.equal(restored.player.hook, null);
});

test('jungle caves host native shamans shooting laughing skulls that invert player controls cleanly', () => {
  const game = createGame();
  const shamans = game.world.mobs.filter((mob) => mob.kind === 'shaman');
  assert.ok(shamans.length >= 2);
  for (const mob of game.world.mobs.filter((m) => m.kind === 'shaman' || m.kind === 'cave-frog' || m.kind === 'frog')) {
    const tx = Math.floor(mob.x / TILE);
    const ty = mob.y / TILE;
    assert.ok(tileAt(game.world, tx, ty), mob.id + ' stands on floor');
    assert.equal(tileAt(game.world, tx, ty - 1), MATERIAL.air, mob.id + ' has open body cell');
  }
  const shaman = shamans.find((s) => s.id === 'jungle-shaman-3') ?? shamans[0];
  game.world.mobs = [shaman];
  shaman.attackTimer = 0.05;

  Object.assign(game.player, {
    x: shaman.x + 4 * TILE,
    y: shaman.y - game.player.height,
    dx: 0, dy: 0, grounded: true, hurt: 0, confused: 0, health: 100, oxygen: 100,
  });

  let sawSkull = false;
  let hitConfused = false;
  for (let i = 0; i < 180; i++) {
    stepGame(game, {}, 1 / 60);
    if (game.world.projectiles.some((p) => p.kind === 'shaman-skull')) sawSkull = true;
    if ((game.player.confused ?? 0) > 0) {
      hitConfused = true;
      break;
    }
  }
  assert.equal(sawSkull, true);
  assert.equal(hitConfused, true);
  assert.ok(game.player.health < 100);

  // Verify confused control inversion: left -> right, right -> left, down -> jump, up -> crouch.
  game.world.mobs = [];
  game.world.projectiles.length = 0;
  Object.assign(game.player, { dx: 0, dy: 0, grounded: true, height: 23 });
  for (let i = 0; i < 5; i++) stepGame(game, { left: true }, 1 / 60);
  assert.ok(game.player.dx > 0, 'holding left should move right while confused');

  for (let i = 0; i < 5; i++) stepGame(game, { right: true }, 1 / 60);
  assert.ok(game.player.dx < 0, 'holding right should move left while confused');

  stepGame(game, { up: true, jump: true }, 1 / 60);
  assert.equal(game.player.height, 16, 'pressing jump/up should crouch while confused');

  stepGame(game, { down: true }, 1 / 60);
  assert.ok(game.player.dy < -100, 'pressing down should jump while confused');

  // Verify shaman jumps across a 2-tile pit and up a 2-tile wall without triggering traps.
  const jumpGame = createGame();
  const jumpShaman = jumpGame.world.mobs.find((mob) => mob.id === 'jungle-shaman-3');
  jumpGame.world.mobs = [jumpShaman];
  const sTx = Math.floor(jumpShaman.x / TILE);
  const sFloor = jumpShaman.y / TILE;
  // Dig a 2-tile pit at sTx + 2..3 with a spike trap at sTx + 1 and clear line of sight to player past the pit
  editTile(jumpGame.world, sTx + 2, sFloor, MATERIAL.air);
  editTile(jumpGame.world, sTx + 2, sFloor + 1, MATERIAL.air);
  editTile(jumpGame.world, sTx + 3, sFloor, MATERIAL.air);
  editTile(jumpGame.world, sTx + 3, sFloor + 1, MATERIAL.air);
  const spike = jumpGame.world.caveTraps.find((t) => t.kind === 'spike');
  spike.tx = sTx + 1;
  spike.ty = sFloor - 1;
  const shamanStartHp = jumpShaman.health;
  Object.assign(jumpGame.player, {
    x: (sTx + 6.5) * TILE,
    y: sFloor * TILE - jumpGame.player.height,
    dx: 0, dy: 0, grounded: true, hurt: 0, confused: 0, health: 100, oxygen: 100,
  });
  jumpShaman.attackTimer = 5;
  let shamanJumped = false;
  for (let i = 0; i < 120; i++) {
    stepGame(jumpGame, {}, 1 / 60);
    if (!jumpShaman.grounded && jumpShaman.dy < -60) shamanJumped = true;
    assert.equal(spike.state, 'armed', 'shaman should not trigger spike traps');
    assert.equal(jumpShaman.health, shamanStartHp, 'shaman should take no trap damage');
  }
  assert.equal(shamanJumped, true);
});

test('deep jungle caves host leaping giant frogs that grab, pull, and bite with their tongue', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const frogs = game.world.mobs.filter((mob) => mob.kind === 'cave-frog');
    assert.ok(frogs.length >= 2);
    const frog = frogs[0];
    game.world.mobs = [frog];
    frog.attackTimer = 0.05;

    // Place player across the flat temple floor at tongue-snare distance (84px)
    const startPlayerX = frog.x + 84;
    Object.assign(game.player, {
      x: startPlayerX,
      y: frog.y - game.player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });

    let sawTongue = false;
    let sawPullCloser = false;
    let sawBiteDamage = false;
    for (let i = 0; i < 180; i++) {
      stepGame(game, {}, 1 / 60);
      if (frog.tongue?.state === 'shoot' || frog.tongue?.state === 'pull') sawTongue = true;
      if (frog.tongue?.state === 'pull' && game.player.x < startPlayerX - 10) sawPullCloser = true;
      if (game.player.health < 100) sawBiteDamage = true;
    }
    assert.equal(sawTongue, true);
    assert.equal(sawPullCloser, true);
    assert.equal(sawBiteDamage, true);

    // Move player beyond tongue reach to verify leaping movement toward player
    const leapFrog = createGame();
    const jumper = leapFrog.world.mobs.find((mob) => mob.kind === 'cave-frog');
    leapFrog.world.mobs = [jumper];
    Object.assign(leapFrog.player, {
      x: jumper.x + 150,
      y: jumper.y - leapFrog.player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });
    let sawLeap = false;
    for (let i = 0; i < 90; i++) {
      stepGame(leapFrog, {}, 1 / 60);
      if (!jumper.grounded && jumper.dy < -60) {
        sawLeap = true;
        break;
      }
    }
    assert.equal(sawLeap, true);

    // Verify cave-frog is immune to traps (neither triggers nor takes damage from spikes/jaws)
    const trapFrogGame = createGame();
    const trapFrog = trapFrogGame.world.mobs.find((mob) => mob.kind === 'cave-frog');
    const trapCultist = trapFrogGame.world.mobs.find((mob) => mob.kind === 'frog');
    trapFrogGame.world.mobs = [trapFrog, trapCultist];
    const frogSpike = trapFrogGame.world.caveTraps.find((t) => t.kind === 'spike');
    frogSpike.tx = Math.floor(trapFrog.x / TILE);
    frogSpike.ty = trapFrog.y / TILE - 1;
    const jawsTrap = trapFrogGame.world.caveTraps.find((t) => t.kind === 'jaws');
    jawsTrap.tx = Math.floor(trapCultist.x / TILE);
    jawsTrap.ty = trapCultist.y / TILE - 1;
    const frogStartHp = trapFrog.health;
    const cultistStartHp = trapCultist.health;
    for (let i = 0; i < 30; i++) stepGame(trapFrogGame, {}, 1 / 60);
    assert.equal(frogSpike.state, 'armed');
    assert.equal(jawsTrap.state, 'armed');
    assert.equal(trapFrog.health, frogStartHp);
    assert.equal(trapCultist.health, cultistStartHp);

    // Verify shaman skull & frog tongue render without errors
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const renderer = createRenderer({
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    });
    game.world.mobs = [frog];
    frog.tongue = { state: 'shoot', tipX: frog.x + 48, tipY: frog.y - 10 };
    game.world.projectiles = [{ kind: 'shaman-skull', x: frog.x + 20, y: frog.y - 16, facing: 1 }];
    game.player.confused = 2;
    renderer.draw({
      world: game.world, player: game.player, snorkel: null,
      camera: { x: frog.x - 160, y: frog.y - 90, width: 320, height: 180 },
      time: 1.5, elapsed: 1.5, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('first island dungeon hosts mimic chests that look normal until attacked or opened, then leap and bite', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    const mimics = world.mobs.filter((mob) => mob.kind === 'mimic');
    assert.ok(mimics.length >= 3);
    for (const mob of mimics) {
      const col = Math.floor(mob.x / TILE) - WEST_EXTENSION;
      const row = Math.floor(mob.y / TILE);
      assert.equal(isDungeonMasonry(col, row - 1), true, 'mimic should sit in first island dungeon masonry');
      assert.equal(mob.awakened, false);
      assert.equal(mob.facing, 1);
    }

    // Isolate first mimic to test sleeping disguise, opening wake-up, leap & bite.
    const mimic = mimics[0];
    const otherMimic = mimics[1];
    world.mobs = [mimic, otherMimic];

    Object.assign(player, {
      x: mimic.x - 18,
      y: mimic.y - player.height,
      dx: 0, dy: 0, grounded: true, hurt: 0, health: 100, oxygen: 100,
    });

    // Walking nearby without opening or attacking leaves mimic dormant and detectable as an interactable chest.
    for (let i = 0; i < 20; i++) stepGame(game, {}, 1 / 60);
    assert.equal(mimic.awakened, false);
    assert.equal(mimic.x, mimic.homeX);
    assert.equal(mimic.y, mimic.homeY);
    assert.equal(player.health, 100);
    const nearby = nearestItem(game);
    assert.equal(nearby?.kind, 'mimic');
    assert.equal(chestAt(game, mimic.x, mimic.y - 8)?.kind, 'mimic');

    // Render dormant mimic before waking.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const renderer = createRenderer({
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    });
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: mimic.x - 160, y: mimic.y - 90, width: 320, height: 180 },
      time: 1, elapsed: 1, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: mimic,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });

    // Trying to open (interact) wakes the mimic up; chestAt/nearestItem stop treating it as a passive chest.
    assert.equal(wakeMimic(world, mimic, player, game.effects), true);
    assert.equal(mimic.awakened, true);
    assert.notEqual(chestAt(game, mimic.x, mimic.y - 8)?.kind, 'mimic');
    assert.notEqual(nearestItem(game)?.kind, 'mimic');

    // Awakened mimic leaps toward player and bites them.
    player.x = mimic.x - 42;
    let sawLeap = false;
    for (let i = 0; i < 150; i++) {
      player.hurt = i < 15 ? 0 : player.hurt;
      stepGame(game, {}, 1 / 60);
      if (!mimic.grounded && Math.abs(mimic.dx) > 50) sawLeap = true;
    }
    assert.equal(sawLeap, true);
    assert.ok(player.health < 100, 'awakened mimic should bite the player');

    // Attacking another dormant mimic wakes and damages it.
    damageMob(world, otherMimic, 3, 0, 30, game.effects);
    assert.equal(otherMimic.awakened, true);
    assert.equal(otherMimic.health, otherMimic.maxHealth - 3);

    // Render awakened mimic cleanly.
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: mimic.x - 160, y: mimic.y - 90, width: 320, height: 180 },
      time: 2, elapsed: 2, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: mimic,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('spike and bear traps inflict 10s bleeding without shock, while spiked pendulum confuses with orbiting stars and immobilizes until stars end', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player, effects } = game;
    world.mobs = [];

    // 1. Spike trap inflicts 10 seconds bleeding and no electric stun.
    const spike = world.caveTraps.find((t) => t.kind === 'spike');
    assert.ok(spike);
    const spikeX = (spike.tx + 0.5) * TILE;
    const spikeY = (spike.ty + 1) * TILE;
    Object.assign(player, { x: spikeX, y: spikeY - player.height, hurt: 0, stun: 0, bleed: 0, confused: 0, health: 100 });
    stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
    assert.equal(spike.state, 'springing');
    stepCaveTraps(world, player, 0.2, 0.2, effects, () => {});
    assert.equal(player.stun, 0, 'spike trap must not shock/stun');
    assert.equal(player.bleed, 10, 'spike trap must inflict 10 seconds bleeding');
    assert.equal(player.health, 80);

    // Move off trap and verify bleed ticks down health over 10s without passive healing.
    Object.assign(player, { x: SPAWN.x, y: SPAWN.y, grounded: true });
    for (let i = 0; i < 60 * 10 + 5; i++) {
      stepGame(game, {}, 1 / 60);
    }
    assert.equal(player.bleed, 0);
    assert.ok(player.health <= 72, `expected bleeding to lower health before expiring, got ${player.health}`);

    // 2. Bear trap (jaws) inflicts 10 seconds bleeding and no shock.
    const jaw = world.caveTraps.find((t) => t.kind === 'jaws');
    const jawX = (jaw.tx + 0.5) * TILE;
    const jawY = (jaw.ty + 1) * TILE;
    Object.assign(player, { x: jawX, y: jawY - player.height, hurt: 0, stun: 0, bleed: 0, health: 100 });
    stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
    stepCaveTraps(world, player, 0.3, 0.3, effects, () => {});
    assert.equal(player.stun, 0, 'bear trap must not shock/stun');
    assert.equal(player.bleed, 10, 'bear trap must inflict 10 seconds bleeding');
    assert.equal(player.health, 82);

    // 3. Moving spiked ball (swing) gives confusion/stars without electric shock, and immobilizes player until stars end.
    const swing = world.caveTraps.find((t) => t.kind === 'swing');
    const head = swingHead(swing, 0);
    Object.assign(player, { x: head.x, y: head.y - player.height / 2, hurt: 0, stun: 0, bleed: 0, confused: 0, confusedStyle: null, health: 100 });
    stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
    assert.equal(player.stun, 0, 'spiked ball must not electric-stun');
    assert.ok(player.confused > 0, 'spiked ball must confuse/daze the player');
    assert.equal(player.confusedStyle, 'stars');

    // Player cannot move while confused with floating stars.
    Object.assign(player, { x: SPAWN.x, y: SPAWN.y, dx: 0, dy: 0, grounded: true });
    const startX = player.x;
    for (let i = 0; i < 10; i++) stepGame(game, { left: true, jump: true, up: true }, 1 / 60);
    assert.equal(player.dx, 0, 'player cannot move horizontally while stunned by stars');
    assert.equal(player.x, startX, 'player position stays locked while stunned by stars');
    assert.equal(player.grounded, true, 'player cannot jump while stunned by stars');

    // Render orbiting stars and bleeding visuals without error.
    player.bleed = 5;
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const renderer = createRenderer({
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    });
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: player.x - 160, y: player.y - 90, width: 320, height: 180 },
      time: 1.2, elapsed: 1.2, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: null,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });

    // Clear after star confusion expires, confirm 1s post-confusion invincibility frames, then allow re-confusion.
    for (let i = 0; i < 200 && player.confused > 0; i++) stepGame(game, {}, 1 / 60);
    assert.equal(player.confused, 0);
    assert.equal(player.confusedStyle, null);
    assert.ok(player.confusedGrace > 0.95 && player.confusedGrace <= 1, '1s post-confusion invincibility grace starts when confusion ends');
    for (let i = 0; i < 5; i++) stepGame(game, { right: true }, 1 / 60);
    assert.ok(player.dx > 0, 'player can move again after stars expire');

    // During the 1s post-confusion grace window, spiked pendulum cannot re-confuse or hit the player.
    const hpBeforeGraceHit = player.health;
    Object.assign(player, { x: head.x, y: head.y - player.height / 2, hurt: 0 });
    stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
    assert.equal(player.confused, 0, 'cannot be re-confused during 1s invincibility grace');
    assert.equal(player.health, hpBeforeGraceHit, 'invincibility frames protect from pendulum hit');

    // Once the 1s grace expires, player can be confused again cleanly.
    Object.assign(player, { x: SPAWN.x, y: SPAWN.y, dx: 0, dy: 0, grounded: true });
    for (let i = 0; i < 62; i++) stepGame(game, {}, 1 / 60);
    assert.equal(player.confusedGrace, 0);
    Object.assign(player, { x: head.x, y: head.y - player.height / 2, hurt: 0 });
    stepCaveTraps(world, player, 0, 1 / 60, effects, () => {});
    assert.ok(player.confused > 0, 'can be hit with confusion again after 1s grace expires');

    // Verify playerStatusEffects reports all active effects with ceil durations.
    Object.assign(player, { bleed: 9.2, stun: 2.1, confused: 2.4, confusedStyle: 'stars', confusedGrace: 0, inkSplats: [{ time: 3.4 }] });
    let list = playerStatusEffects(player);
    assert.deepEqual(list.map((e) => [e.id, e.title, e.seconds]), [
      ['bleeding', 'Bleeding', 10],
      ['shock', 'Shocked', 3],
      ['confusion', 'Confusion', 3],
      ['inked', 'Inked', 4],
    ]);
    player.confusedStyle = null;
    player.confused = 4.1;
    player.confusedGrace = 0.8;
    list = playerStatusEffects(player);
    assert.ok(list.some((e) => e.id === 'cursed' && e.title === 'Cursed' && e.seconds === 5));
    assert.ok(list.some((e) => e.id === 'confused-grace' && e.title === 'Steadied' && e.seconds === 1));
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('lionfish spawn between 20m and 80m in the normal ocean, telegraph radial starbursts, bloom toxic clouds on rock, and slow swimming via neurotoxin', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    const lionfishList = world.mobs.filter((mob) => mob.kind === 'lionfish');
    assert.ok(lionfishList.length >= 5);

    for (const mob of lionfishList) {
      const depth = Math.floor((mob.y - WATER) / TILE);
      assert.ok(mob.x < (KRAKEN_COLUMN + WEST_EXTENSION) * TILE, `${mob.id} must be in normal ocean biome`);
      assert.ok(depth >= 20 && depth <= 80, `${mob.id} depth ${depth}m must be in 20m..80m`);
      const tx = Math.floor(mob.x / TILE);
      const ty = Math.floor(mob.y / TILE);
      assert.equal(waterTileAt(world, tx, ty), true, `${mob.id} must spawn in open ocean water`);
      assert.equal(tileAt(world, tx, ty), MATERIAL.air, `${mob.id} must not overlap solid rock`);
    }

    // Isolate a single lionfish in an open deep-water pocket beside a rock ceiling/wall.
    const lion = lionfishList[0];
    world.mobs = [lion];
    const lx = Math.floor(lion.x / TILE);
    const ly = Math.floor(lion.y / TILE);
    for (let x = lx - 8; x <= lx + 8; x++) {
      for (let y = ly - 5; y <= ly + 5; y++) editTile(world, x, y, MATERIAL.air);
    }
    // Place rock wall 3 tiles right of lionfish so the rightward spine impacts rock and blooms a cloud.
    editTile(world, lx + 3, ly, MATERIAL.stone);
    editTile(world, lx + 3, ly - 1, MATERIAL.stone);
    editTile(world, lx + 3, ly + 1, MATERIAL.stone);

    // Move player into a safe radial gap (~22.5 deg = pi/8, between 0° and 45° spines) inside aggro radius!
    const gapAngle = Math.PI / 8;
    const gapDist = 66;
    Object.assign(lion, { x: (lx + 0.5) * TILE, y: (ly + 0.5) * TILE, homeX: (lx + 0.5) * TILE, homeY: (ly + 0.5) * TILE, span: 12, attackTimer: 0, windup: 0, burstCount: 0 });
    Object.assign(player, {
      x: lion.x + Math.cos(gapAngle) * gapDist,
      y: lion.y + Math.sin(gapAngle) * gapDist - 11,
      dx: 0, dy: 0, hurt: 0, neurotoxin: 0, health: 100, oxygen: 100,
    });

    // Enters 1.0..1.2s warning windup without chasing the player.
    stepGame(game, {}, 1 / 60);
    assert.ok(lion.windup >= 1.0 && lion.windup <= 1.2, `expected 1.0-1.2s windup, got ${lion.windup}`);
    assert.equal(world.projectiles.length, 0);

    // Step until burst fires (8 radial spines at fixed 45° intervals).
    let firedSpines = [];
    for (let i = 0; i < 80; i++) {
      stepGame(game, {}, 1 / 60);
      const spines = world.projectiles.filter((p) => p.kind === 'lionfish-spine');
      if (spines.length && !firedSpines.length) {
        firedSpines = spines.map((s) => ({ ...s }));
      }
    }
    assert.equal(firedSpines.length, 8, 'first burst should fire 8 radial spines');
    assert.equal(player.health, 100, 'player positioned in radial gap should thread the needle');

    // Step slightly more so spines either hit rock (blooming neurotoxin-cloud) or dissolve after ~5-6 body lengths.
    for (let i = 0; i < 90; i++) stepGame(game, {}, 1 / 60);
    const clouds = world.projectiles.filter((p) => p.kind === 'neurotoxin-cloud');
    assert.ok(clouds.length >= 1, 'spine hitting rock wall must bloom into lingering neurotoxin cloud');
    assert.equal(world.projectiles.filter((p) => p.kind === 'lionfish-spine').length, 0, 'all open-water spines must dissolve after max range');
    const cloud = clouds[0];
    assert.ok(cloud.life >= 2.5 && cloud.maxLife >= 4 && cloud.maxLife <= 5);

    // Compare normal vs neurotoxin swimming speeds (both horizontal & vertical) in open water.
    const testGame = createGame();
    testGame.world.mobs = [];
    const tp = testGame.player;
    const swimX = (156 + WEST_EXTENSION) * TILE;
    const swimY = WATER + 6 * TILE;
    Object.assign(tp, { x: swimX, y: swimY, dx: 0, dy: 0, neurotoxin: 0, oxygen: 100, health: 100 });
    for (let i = 0; i < 20; i++) stepGame(testGame, { right: true, down: true }, 1 / 60);
    const normalDx = tp.dx;
    const normalDy = tp.dy;
    assert.ok(normalDx > 40 && normalDy > 40);

    Object.assign(tp, { x: swimX, y: swimY, dx: 0, dy: 0, neurotoxin: 2 });
    for (let i = 0; i < 20; i++) stepGame(testGame, { right: true, down: true }, 1 / 60);
    assert.ok(tp.dx < normalDx * 0.55, `neurotoxin must drastically cut horizontal swim speed (${tp.dx} vs ${normalDx})`);
    assert.ok(tp.dy < normalDy * 0.55, `neurotoxin must drastically cut vertical swim speed (${tp.dy} vs ${normalDy})`);
    assert.ok(playerStatusEffects(tp).some((e) => e.id === 'neurotoxin' && e.title === 'Neurotoxin'));

    // Next burst alternates to 6 radial spines (60° spacing).
    world.projectiles.length = 0;
    lion.attackTimer = 0;
    lion.windup = 0.02;
    stepGame(game, {}, 1 / 30);
    assert.equal(world.projectiles.filter((p) => p.kind === 'lionfish-spine').length, 6);

    // Render lionfish warning glow, flying spines, toxic clouds, and player neurotoxin cleanly.
    const noop = () => {};
    const grad = { addColorStop: noop };
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop, translate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill() {}, stroke() {}, createLinearGradient: () => grad, createRadialGradient: () => grad,
      fillRect() {},
    });
    const renderer = createRenderer({
      width: 640, height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: makeCtx }) },
      getContext: makeCtx,
    });
    lion.windup = 0.5;
    world.projectiles.push(cloud);
    player.neurotoxin = 2;
    renderer.draw({
      world, player, snorkel: null,
      camera: { x: lion.x - 160, y: lion.y - 90, width: 320, height: 180 },
      time: 1.5, elapsed: 1.5, aim: null, mining: null, miningSwing: null,
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: lion,
      particles: [], reducedMotion: false, conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0, weatherSeed: 0, caveShadowsHidden: true, openChestId: null,
    });
  } finally {
    if (prevPath2D === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = prevPath2D;
  }
});

test('player must jump to ascend a 1-tile block', () => {
  const game = createGame();
  const { world, player } = game;
  world.mobs = [];
  const baseCol = Math.floor(SPAWN.x / TILE);
  const floorRow = 12;
  for (let x = baseCol - 4; x <= baseCol + 10; x++) {
    for (let y = 5; y < floorRow; y++) editTile(world, x, y, MATERIAL.air);
    editTile(world, x, floorRow, MATERIAL.stone);
    if (x >= baseCol + 2) editTile(world, x, floorRow - 1, MATERIAL.stone);
  }
  Object.assign(player, {
    x: (baseCol + 0.5) * TILE,
    y: floorRow * TILE - player.height,
    dx: 0, dy: 0, grounded: true, health: 100, oxygen: 100,
  });
  for (let i = 0; i < 120; i++) stepGame(game, { right: true }, 1 / 60);
  assert.ok(player.x + player.width / 2 <= (baseCol + 2) * TILE + 0.02, 'walking must stop at the step');
  assert.ok(Math.abs(player.y + player.height - floorRow * TILE) < 0.02);
  assert.equal(player.grounded, true);

  for (let i = 0; i < 26; i++) stepGame(game, { right: true, jump: i === 0, up: true }, 1 / 60);
  for (let i = 0; i < 35; i++) stepGame(game, {}, 1 / 60);
  assert.ok(player.x >= (baseCol + 2) * TILE, 'jumping must clear the step');
  assert.ok(Math.abs(player.y + player.height - (floorRow - 1) * TILE) < 0.02);
  assert.equal(player.grounded, true);
});

test('renderer emits colored light gradients for cave lamps and orange/green jungle torches', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const noop = () => {};
    const stops = [];
    const makeGrad = () => ({
      addColorStop(_offset, color) { stops.push(color); },
    });
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fillRect: noop, fill: noop, stroke: noop, translate: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: makeGrad,
    });
    const canvas = {
      width: 640,
      height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    const game = createGame();

    const lamp = game.world.caveStructures.find((s) => s.kind === 'lamp');
    const orangeTorch = game.world.caveStructures.find((s) => s.kind === 'native-torch' && s.floor < 120);
    const greenTorch = game.world.caveStructures.find((s) => s.kind === 'native-torch' && s.floor >= 442);
    assert.ok(lamp && orangeTorch && greenTorch);

    const drawAround = (structure) => {
      stops.length = 0;
      game.player.x = (structure.tx + 0.5) * TILE;
      game.player.y = (structure.floor - 2) * TILE;
      renderer.draw({
        world: game.world,
        player: game.player,
        snorkel: null,
        camera: { x: (structure.tx + 0.5) * TILE - 160, y: structure.floor * TILE - 90, width: 320, height: 180 },
        time: 1,
        elapsed: 1,
        aim: null,
        mining: null,
        miningSwing: null,
        held: null,
        attack: null,
        hasArrow: false,
        playerArrows: [],
        targetMob: null,
        particles: [],
        reducedMotion: false,
        conditions: { darkness: 0, rain: 0, night: false },
        worldTime: 0,
        weatherSeed: 0,
        caveShadowsHidden: true,
        openChestId: null,
      });
    };

    drawAround(lamp);
    assert.ok(stops.some((c) => c.startsWith('rgba(240, 178, 105,')));

    drawAround(orangeTorch);
    assert.ok(stops.some((c) => c.startsWith('rgba(232, 141, 58,')));

    drawAround(greenTorch);
    assert.ok(stops.some((c) => c.startsWith('rgba(98, 217, 150,')));

    const fireTx = 95;
    const fireTy = 23;
    editTile(game.world, fireTx, fireTy + 1, MATERIAL.stone);
    editTile(game.world, fireTx, fireTy - 1, MATERIAL.air);
    editTile(game.world, fireTx, fireTy, MATERIAL.fireplace);
    game.world.caveStructures = [];
    stops.length = 0;
    game.player.x = (fireTx + 0.5) * TILE;
    game.player.y = (fireTy - 1) * TILE;
    renderer.draw({
      world: game.world,
      player: game.player,
      snorkel: null,
      camera: { x: (fireTx + 0.5) * TILE - 160, y: fireTy * TILE - 90, width: 320, height: 180 },
      time: 1.5,
      elapsed: 1.5,
      aim: null,
      mining: null,
      miningSwing: null,
      held: null,
      attack: null,
      hasArrow: false,
      playerArrows: [],
      targetMob: null,
      particles: [],
      reducedMotion: false,
      conditions: { darkness: 1, rain: 0, night: true },
      worldTime: 0.75,
      weatherSeed: 0,
      caveShadowsHidden: true,
      openChestId: null,
    });
    assert.ok(stops.some((c) => c.startsWith('rgba(244, 156, 68,')));
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});

test('deep cave lighting and caveStructureLight stay consistent across Clear Day, Storm, and Thunder', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const noop = () => {};
    const gradStops = [];
    const fillRectCalls = [];
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill: noop, stroke: noop, translate: noop,
      fillRect(x, y, w, h) { fillRectCalls.push({ x, y, w, h, fillStyle: this.fillStyle }); },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop(_offset, color) { gradStops.push(color); } }),
    });
    const canvas = {
      width: 640,
      height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    const game = createGame();
    const lamp = game.world.caveStructures.find((s) => s.kind === 'lamp' && s.floor >= 40);
    assert.ok(lamp);

    const drawWithConditions = (conditions, lightning = null) => {
      gradStops.length = 0;
      fillRectCalls.length = 0;
      game.player.x = (lamp.tx + 0.5) * TILE;
      game.player.y = (lamp.floor - 2) * TILE;
      renderer.draw({
        world: game.world,
        player: game.player,
        snorkel: null,
        camera: { x: (lamp.tx + 0.5) * TILE - 160, y: lamp.floor * TILE - 90, width: 320, height: 180 },
        time: 1,
        elapsed: 1,
        aim: null,
        mining: null,
        miningSwing: null,
        held: null,
        attack: null,
        hasArrow: false,
        playerArrows: [],
        targetMob: null,
        particles: [],
        reducedMotion: false,
        conditions,
        lightning,
        worldTime: 0,
        weatherSeed: 0,
        caveShadowsHidden: true,
        openChestId: null,
      });
      return {
        lampStops: gradStops.filter((c) => c.startsWith('rgba(240, 178, 105,')),
        nightCaveFills: fillRectCalls.filter((c) => typeof c.fillStyle === 'string' && c.fillStyle.startsWith('rgba(4, 8, 21,')),
      };
    };

    const clearDay = drawWithConditions({ darkness: 0, rain: 0, night: false, atmosphere: 'clear', dayAtmosphere: 'clear' });
    const storm = drawWithConditions({ darkness: 1, rain: 1, night: true, atmosphere: 'deep', dayAtmosphere: 'cloudy' });
    const thunder = drawWithConditions({ darkness: 1, rain: 1, night: true, atmosphere: 'deep', dayAtmosphere: 'cloudy' }, { flash: 1 });

    assert.ok(clearDay.lampStops.length > 0);
    assert.deepEqual(storm.lampStops, clearDay.lampStops);
    assert.deepEqual(thunder.lampStops, clearDay.lampStops);
    assert.equal(storm.nightCaveFills.length, 0);
    assert.equal(thunder.nightCaveFills.length, 0);
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});

test('pufferfish patrols idly, telegraphs inhale, inflates with melee bounce, poison, buoyancy, and jet-deflates', () => {
  const game = createGame();
  const { world, player } = game;
  const puffer = world.mobs.find((mob) => mob.kind === 'pufferfish');
  assert.ok(puffer, 'pufferfish should spawn in ocean');
  world.mobs = [puffer];

  // Clear open water pocket around pufferfish so ceiling/wall collisions don't interfere.
  const baseCol = Math.floor(puffer.x / TILE);
  const baseRow = Math.floor(puffer.y / TILE);
  for (let x = baseCol - 8; x <= baseCol + 8; x++) {
    for (let y = baseRow - 8; y <= baseRow + 6; y++) {
      editTile(world, x, y, MATERIAL.air);
    }
  }
  puffer.homeX = puffer.x;
  puffer.homeY = puffer.y;

  // Idle patrol far from player: stays uninflated and drifts.
  player.x = puffer.x - 160;
  player.y = puffer.y - 11;
  player.health = 100;
  player.oxygen = 100;
  const startX = puffer.x;
  const stepPuffer = (t) => stepMobs(world, player, 1 / 60, t, game.effects, { night: false }, game.enemies);
  for (let i = 0; i < 30; i++) stepPuffer(i / 60);
  assert.equal(puffer.pufferState, 'idle');
  assert.equal(puffer.inflateScale, 1);
  assert.notEqual(puffer.x, startX);

  // Proximity triggers wind-up telegraph.
  player.x = puffer.x - 36;
  player.y = puffer.y - 11;
  stepPuffer(1);
  assert.equal(puffer.pufferState, 'windup');

  // After ~0.75s wind-up, expands to 2.8x size (2.5x-3x), becomes buoyant, and bounces melee attacks.
  for (let i = 0; i < 55; i++) stepPuffer(1 + i / 60);
  assert.equal(puffer.pufferState, 'inflated');
  assert.ok(puffer.inflateScale >= 2.5 && puffer.inflateScale <= 3.0);
  assert.ok(puffer.dy < 0, 'inflated pufferfish should be buoyant and float upward');

  // Melee bounces off without reducing pufferfish health.
  const hpBeforeMelee = puffer.health;
  player.hurt = 0;
  const bounce = damageMob(world, puffer, 3, 0, 100, game.effects, { melee: true, attacker: player });
  assert.equal(bounce?.bounced, true);
  assert.equal(puffer.health, hpBeforeMelee);
  assert.ok(player.dx < -100, 'melee bounce pushes player backward');

  // Ranged/piercing attack still damages inflated pufferfish.
  damageMob(world, puffer, 1, 0, 50, game.effects);
  assert.equal(puffer.health, hpBeforeMelee - 1);

  // Contact while inflated deals heavy knockback, contact damage, and applies Poisoned status.
  player.hurt = 0;
  puffer.cooldown = 0;
  player.x = puffer.x - 14;
  player.y = puffer.y - 11;
  const hpBeforeContact = player.health;
  stepPuffer(2);
  assert.ok(player.health < hpBeforeContact);
  assert.ok(Math.abs(player.dx) > 150);
  assert.ok(player.poison > 0);
  assert.ok(playerStatusEffects(player).some((e) => e.id === 'poisoned'));

  // Move player away and advance through remaining ~3.5s inflated state into deflation jet dash & exhaustion.
  player.x = puffer.x - 200;
  for (let i = 0; i < 230; i++) {
    stepPuffer(2 + i / 60);
    if (puffer.pufferState === 'deflating') break;
  }
  assert.equal(puffer.pufferState, 'deflating');
  assert.ok(Math.abs(puffer.dx) > 80, 'deflation fires a jet propulsion dash');

  for (let i = 0; i < 60; i++) stepPuffer(6 + i / 60);
  assert.equal(puffer.pufferState, 'idle');
  assert.equal(puffer.inflateScale, 1);
  assert.ok(puffer.exhausted > 0, 'enters brief exhaustion window after deflating');
});

test('lionfish drops poison needles, crafts into poison arrows, poisons enemies green with overhead icon', () => {
  const game = createGame();
  const { world, player } = game;
  const lionfish = world.mobs.find((mob) => mob.kind === 'lionfish');
  assert.ok(lionfish);

  // Killing lionfish drops poison needles.
  const killEffect = damageMob(world, lionfish, lionfish.health, 0, 0, game.effects);
  assert.deepEqual(killEffect?.drop, { id: POISON_NEEDLE.id, count: 2 });
  game.inventory.add(killEffect.drop.id, killEffect.drop.count);

  // Crafting poison arrows consumes arrows + poison needle.
  game.inventory.add(ARROW.id, 4);
  game.inventory.add(BOW.id, 1);
  assert.equal(craftItem(game, POISON_ARROW), true);
  assert.equal(game.inventory.count(POISON_ARROW.id), 4);
  assert.equal(game.inventory.count(POISON_NEEDLE.id), 1);

  // Shooting a shark with a poison arrow applies mob.poison and ticks poison damage over time.
  const shark = world.mobs.find((mob) => mob.kind === 'shark');
  assert.ok(shark);
  world.mobs = [shark];
  player.x = shark.x - 30;
  player.y = shark.y - 11;
  let bowSlot = game.inventory.hotbar.findIndex((s) => s?.id === BOW.id);
  if (bowSlot < 0) {
    const bp = game.inventory.backpack.findIndex((s) => s?.id === BOW.id);
    assert.ok(bp >= 0);
    assert.equal(game.inventory.move({ group: 'backpack', index: bp }, { group: 'hotbar', index: 4 }), true);
    bowSlot = 4;
  }
  useWeapon(game, bowSlot, shark.x, shark.y);
  assert.ok(game.projectiles[0]?.poisonDuration > 0);

  const hpAfterHit = shark.health;
  for (let i = 0; i < 180; i++) {
    stepGame(game, {}, 1 / 60);
    if (shark.poison > 0) break;
  }
  assert.ok(shark.poison > 0, 'poison arrow should poison enemy');
  const hpOnPoisonStart = shark.health;
  assert.ok(hpOnPoisonStart <= hpAfterHit);

  for (let i = 0; i < 80; i++) stepGame(game, {}, 1 / 60);
  assert.ok(shark.health < hpOnPoisonStart, 'poison should tick damage over time on poisoned enemy');

  // Renderer applies green filter and draws poison droplet icon above poisoned enemy head.
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} };
  try {
    const noop = () => {};
    const filters = [];
    const fillColors = [];
    const makeCtx = () => {
      const stack = [];
      return {
        save() { stack.push(this.filter); },
        restore() { this.filter = stack.pop() ?? 'none'; },
        scale: noop, rotate: noop, setTransform: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
        quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
        fill: noop, stroke: noop, translate: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        fillRect() {
          if (this.filter && this.filter !== 'none') filters.push(this.filter);
          fillColors.push(this.fillStyle);
        },
        filter: 'none',
      };
    };
    const canvas = {
      width: 640,
      height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    renderer.draw({
      world,
      player,
      snorkel: null,
      camera: { x: shark.x - 160, y: shark.y - 90, width: 320, height: 180 },
      time: 1,
      elapsed: 1,
      aim: null,
      mining: null,
      miningSwing: null,
      held: null,
      attack: null,
      hasArrow: true,
      playerArrows: [],
      targetMob: null,
      particles: [],
      reducedMotion: false,
      conditions: { darkness: 0, rain: 0, night: false, skyProgress: 0.5, atmosphere: 'clear' },
      worldTime: 0,
      weatherSeed: 0,
      caveShadowsHidden: true,
      openChestId: null,
    });
    assert.ok(filters.some((f) => f.includes('hue-rotate(68deg)')), 'poisoned enemy renders green');
    assert.ok(fillColors.includes('#66cc4b') && fillColors.includes('#b8ff9c'), 'poison icon renders above poisoned enemy');

    // Poisoned Kraken only tints its head/mantle green, not its tentacles.
    const krakenGame = createGame();
    const kraken = krakenGame.world.mobs.find((m) => m.kind === 'kraken');
    assert.ok(kraken);
    kraken.poison = 4;
    filters.length = 0;
    fillColors.length = 0;
    renderer.draw({
      world: krakenGame.world,
      player: krakenGame.player,
      snorkel: null,
      camera: { x: kraken.x - 160, y: kraken.y - 140, width: 320, height: 240 },
      time: 1,
      elapsed: 1,
      aim: null,
      mining: null,
      miningSwing: null,
      held: null,
      attack: null,
      hasArrow: false,
      playerArrows: [],
      targetMob: null,
      particles: [],
      reducedMotion: false,
      conditions: { darkness: 0, rain: 0, night: false, skyProgress: 0.5, atmosphere: 'clear' },
      worldTime: 0,
      weatherSeed: 0,
      caveShadowsHidden: true,
      openChestId: null,
    });
    assert.ok(filters.length > 0 && filters.length < 40, `only Kraken head should be tinted, got ${filters.length} filtered rects`);
    assert.ok(fillColors.includes('#66cc4b'), 'poison icon renders above Kraken head');
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});

test('items menu divides items into tabs and opens on the All tab by default', () => {
  const prevDocument = globalThis.document;
  const makeEl = (tag, attrs = {}) => {
    const listeners = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      dataset: { ...attrs },
      attributes: new Map(),
      className: '',
      classList: { add() {} },
      style: {},
      hidden: false,
      value: '',
      valueAsNumber: 1,
      textContent: '',
      children,
      append(...nodes) { children.push(...nodes); },
      setAttribute(k, v) { this.attributes.set(k, String(v)); },
      getAttribute(k) { return this.attributes.get(k) ?? null; },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatch(type) { for (const fn of listeners.get(type) ?? []) fn(); },
      reportValidity: () => true,
      getContext: () => ({ fillRect() {} }),
      toDataURL: () => '',
    };
    return el;
  };
  globalThis.document = { createElement: (tag) => makeEl(tag) };
  try {
    const catalog = { ...ITEMS, ...EQUIPMENT_ITEMS };
    const counts = { weapons: 0, gear: 0, consumables: 0, blocks: 0, materials: 0 };
    for (const [id, item] of Object.entries(catalog)) {
      const cat = itemCategory(id, item);
      assert.ok(Object.hasOwn(counts, cat), `unexpected category ${cat} for ${id}`);
      counts[cat]++;
    }
    for (const [cat, count] of Object.entries(counts)) {
      assert.ok(count > 0, `expected non-empty category ${cat}`);
    }

    const grid = makeEl('div');
    const search = makeEl('input');
    const quantity = makeEl('input');
    const empty = makeEl('p');
    const status = makeEl('p');
    const tabButtons = ['all', 'weapons', 'gear', 'consumables', 'blocks', 'materials'].map((tab) => {
      const btn = makeEl('button', { tab });
      btn.setAttribute('aria-selected', tab === 'all' ? 'true' : 'false');
      return btn;
    });
    const panel = makeEl('dialog');
    panel.querySelector = (sel) => ({
      '#items-grid': grid,
      '#item-search': search,
      '#item-quantity': quantity,
      '#items-empty': empty,
      '#items-status': status,
    }[sel] ?? null);
    panel.querySelectorAll = (sel) => (sel === '#items-tabs [role="tab"]' ? tabButtons : []);

    const menu = createItemsMenu(panel, () => null);
    assert.equal(tabButtons[0].getAttribute('aria-selected'), 'true');
    assert.equal(grid.children.filter((b) => !b.hidden).length, Object.keys(catalog).length);

    tabButtons[1].dispatch('click');
    assert.equal(tabButtons[0].getAttribute('aria-selected'), 'false');
    assert.equal(tabButtons[1].getAttribute('aria-selected'), 'true');
    assert.equal(grid.children.filter((b) => !b.hidden).length, counts.weapons);

    panel.dispatch('close');
    assert.equal(tabButtons[0].getAttribute('aria-selected'), 'true');
    assert.equal(grid.children.filter((b) => !b.hidden).length, Object.keys(catalog).length);

    menu.selectTab('blocks');
    assert.equal(grid.children.filter((b) => !b.hidden).length, counts.blocks);
  } finally {
    globalThis.document = prevDocument;
  }
});

test('player does not naturally regenerate health on land, underwater, or at air vents', () => {
  const game = createGame();
  const { world, player } = game;
  world.mobs = [];
  player.health = 55;
  player.hurt = 0;
  player.bleed = 0;
  player.poison = 0;

  // On island surface (in air) for 3 seconds: oxygen fills, health stays 55.
  for (let i = 0; i < 180; i++) stepGame(game, {}, 1 / 60);
  assert.equal(player.health, 55);

  // Underwater (out of combat): oxygen drains, health stays 55.
  Object.assign(player, { x: (WEST_EXTENSION + 95) * TILE, y: (WATER_ROW + 4) * TILE, oxygen: 80 });
  for (let i = 0; i < 60; i++) updateOxygen(world, player, 1 / 60, 100);
  assert.equal(player.health, 55);

  // At an underwater air vent: oxygen fills, health stays 55.
  const [vent] = world.vents;
  Object.assign(player, { x: vent.x, y: vent.y - TILE - 5, oxygen: 40 });
  for (let i = 0; i < 60; i++) updateOxygen(world, player, 1 / 60, 100);
  assert.ok(player.oxygen > 40);
  assert.equal(player.health, 55);

  // Explicit healing item (kelp dressing) still heals cleanly.
  grantItem(game, KELP_DRESSING.id, 1);
  const slot = game.inventory.hotbar.findIndex((s) => s?.id === KELP_DRESSING.id);
  const healed = useDressing(game, slot);
  assert.ok(healed && player.health === 55 + KELP_DRESSING.heal);
});

test('cave and dungeon enemies step up 1-block heights and jump across gaps and 2-block walls', () => {
  const buildCaveLane = (world, baseCol, floorRow) => {
    for (let x = baseCol - 3; x <= baseCol + 14; x++) {
      for (let y = floorRow - 7; y < floorRow; y++) editTile(world, x, y, MATERIAL.air);
      editTile(world, x, floorRow, MATERIAL.deepstone);
    }
  };

  const baseCol = Math.floor(SPAWN.x / TILE) + 2;
  const floorRow = 12;

  // 1. Wide and narrow cave/dungeon enemies climb a 1-block staircase without getting stuck.
  for (const kind of ['spider', 'archer', 'miner', 'scorpion', 'hammer']) {
    const game = createGame();
    const { world, player } = game;
    buildCaveLane(world, baseCol, floorRow);
    editTile(world, baseCol + 3, floorRow - 1, MATERIAL.deepstone);
    editTile(world, baseCol + 4, floorRow - 1, MATERIAL.deepstone);
    editTile(world, baseCol + 4, floorRow - 2, MATERIAL.deepstone);
    editTile(world, baseCol + 5, floorRow - 1, MATERIAL.deepstone);
    editTile(world, baseCol + 5, floorRow - 2, MATERIAL.deepstone);

    const template = world.mobs.find((m) => m.kind === kind);
    assert.ok(template, `expected spawned ${kind}`);
    const mob = {
      ...template,
      x: (baseCol + 0.5) * TILE,
      y: floorRow * TILE,
      homeX: (baseCol + 5) * TILE,
      homeY: (floorRow - 2) * TILE,
      dx: 0,
      dy: 0,
      grounded: true,
      windup: 0,
      dash: kind === 'scorpion' ? 0.5 : 0,
      venomIn: 0,
      jumpCooldown: 0,
      attackTimer: 5,
    };
    world.mobs = [mob];
    Object.assign(player, {
      x: (baseCol + 30) * TILE,
      y: floorRow * TILE - player.height,
      dx: 0,
      dy: 0,
      grounded: true,
      health: 100,
      hurt: 0,
    });

    let steppedWithoutJump = true;
    for (let i = 0; i < 360; i++) {
      stepCaveEnemy(world, player, mob, 1 / 60, game.effects);
      if (!mob.grounded || mob.dy < -60) steppedWithoutJump = false;
      if (mob.y <= (floorRow - 2) * TILE && mob.x >= (baseCol + 4) * TILE) break;
    }
    assert.equal(steppedWithoutJump, true, `${kind} should step up 1-block staircase smoothly without jumping`);
    assert.ok(mob.y <= (floorRow - 2) * TILE, `${kind} should step up 1-block staircase, got y=${mob.y}`);
    assert.ok(mob.x >= (baseCol + 4) * TILE, `${kind} should advance across 1-block steps, got x=${mob.x}`);
  }

  // 2. Cave/dungeon enemies jump over a 2-block wall and across a 2-tile pit.
  for (const kind of ['spider', 'archer', 'miner', 'scorpion', 'hammer']) {
    const wallGame = createGame();
    buildCaveLane(wallGame.world, baseCol, floorRow);
    editTile(wallGame.world, baseCol + 2, floorRow - 1, MATERIAL.deepstone);
    editTile(wallGame.world, baseCol + 2, floorRow - 2, MATERIAL.deepstone);

    const wallMob = {
      ...wallGame.world.mobs.find((m) => m.kind === kind),
      x: (baseCol + 0.5) * TILE,
      y: floorRow * TILE,
      homeX: (baseCol + 0.5) * TILE,
      homeY: floorRow * TILE,
      dx: 0,
      dy: 0,
      grounded: true,
      windup: 0,
      dash: 0,
      jumpCooldown: 0,
      attackTimer: 5,
    };
    wallGame.world.mobs = [wallMob];
    // Position player beyond archer chaseDistance (90px) above the 2-block wall with clear sightline.
    Object.assign(wallGame.player, {
      x: (baseCol + 2.5) * TILE,
      y: (floorRow - 7) * TILE - wallGame.player.height,
      dx: 0,
      dy: 0,
      grounded: true,
    });

    let jumped = false;
    for (let i = 0; i < 240; i++) {
      stepCaveEnemy(wallGame.world, wallGame.player, wallMob, 1 / 60, wallGame.effects);
      if (!wallMob.grounded && wallMob.dy < -60) jumped = true;
      if (wallMob.grounded && wallMob.y <= (floorRow - 2) * TILE && wallMob.x >= (baseCol + 2) * TILE) break;
    }
    assert.equal(jumped, true, `${kind} should jump to clear 2-block wall`);
    assert.ok(wallMob.y <= (floorRow - 2) * TILE && wallMob.x >= (baseCol + 2) * TILE, `${kind} should land atop 2-block wall`);
  }

  // 3. Cave/dungeon gap jump test (archer chasing beyond reach crosses pit).
  const gapGame = createGame();
  buildCaveLane(gapGame.world, baseCol, floorRow);
  editTile(gapGame.world, baseCol + 2, floorRow, MATERIAL.air);
  editTile(gapGame.world, baseCol + 2, floorRow + 1, MATERIAL.air);
  const gapMob = {
    ...gapGame.world.mobs.find((m) => m.kind === 'miner'),
    x: (baseCol + 0.5) * TILE,
    y: floorRow * TILE,
    homeX: (baseCol + 0.5) * TILE,
    homeY: floorRow * TILE,
    dx: 0,
    dy: 0,
    grounded: true,
    windup: 0,
    jumpCooldown: 0,
  };
  gapGame.world.mobs = [gapMob];
  Object.assign(gapGame.player, {
    x: (baseCol + 6) * TILE,
    y: floorRow * TILE - gapGame.player.height,
    dx: 0,
    dy: 0,
    grounded: true,
  });
  let clearedGap = false;
  for (let i = 0; i < 240; i++) {
    stepCaveEnemy(gapGame.world, gapGame.player, gapMob, 1 / 60, gapGame.effects);
    if (Math.floor(gapMob.x / TILE) > baseCol + 2 && gapMob.y <= floorRow * TILE) {
      clearedGap = true;
      break;
    }
  }
  assert.equal(clearedGap, true, 'cave enemy should jump across cave floor gap');
});

test('defeated kraken boss never respawns over time, on player death, or after save and reload', () => {
  const game = createGame();
  const { world } = game;
  const kraken = world.mobs.find((mob) => mob.kind === 'kraken');
  assert.ok(kraken);

  damageMob(world, kraken, kraken.maxHealth, 0, 0, game.effects);
  assert.equal(world.krakenDefeated, true);
  assert.equal(kraken.respawn, 0);

  // Step through full death animation and well past the old 120s respawnDelay.
  for (let i = 0; i < 120; i++) stepGame(game, {}, 1 / 60);
  assert.equal(world.mobs.some((mob) => mob.kind === 'kraken'), false);

  for (let i = 0; i < 150; i++) stepMobs(world, game.player, 1, game.elapsed + i, false, false, game.enemies, game.effects);
  assert.equal(world.mobs.some((mob) => mob.kind === 'kraken'), false);

  // Player death / hostiles reset must not revive the kraken.
  resetHostiles(world);
  assert.equal(world.mobs.some((mob) => mob.kind === 'kraken'), false);

  // Save & reload preserves krakenDefeated and keeps the boss absent.
  const reloaded = createGame(decodeSave(encodeSave(game)));
  assert.equal(reloaded.world.krakenDefeated, true);
  assert.equal(reloaded.world.mobs.some((mob) => mob.kind === 'kraken'), false);

  // Room reset restores the boss for a new session.
  const reset = resetRoomProgress(reloaded);
  assert.equal(reset.world.krakenDefeated, false);
  assert.equal(reset.world.mobs.some((mob) => mob.kind === 'kraken'), true);
});

test('fish and crabs drop raw food that can be eaten with poison risk or cooked safely in a fireplace', () => {
  const game = createGame();
  const { world, player } = game;
  toggleGodMode(world, player);

  // Killing a fish grants raw-fish; killing a crab grants raw-crab.
  const fish = world.mobs.find((mob) => mob.kind === 'fish');
  const crab = world.mobs.find((mob) => mob.kind === 'crab');
  assert.ok(fish && crab);
  fish.x = player.x + 22;
  fish.y = player.y + 11;
  crab.x = player.x - 22;
  crab.y = player.y + 15;
  world.mobs = [fish, crab];

  game.inventory.hotbar[1] = { id: COBALT_SPEAR.id, count: 1 };
  useWeapon(game, 1, fish.x, fish.y);
  for (let i = 0; i < 40; i++) {
    fish.x = player.x + 22;
    fish.y = player.y + 11;
    stepGame(game, {}, 1 / 60);
  }
  useWeapon(game, 1, crab.x, crab.y);
  for (let i = 0; i < 40; i++) {
    crab.x = player.x - 22;
    crab.y = player.y + 15;
    stepGame(game, {}, 1 / 60);
  }
  assert.equal(game.inventory.count(RAW_FISH.id), 1);
  assert.equal(game.inventory.count(RAW_CRAB.id), 1);

  // Move raw drops from backpack to hotbar and verify eating behavior.
  const bpFish = game.inventory.backpack.findIndex((s) => s?.id === RAW_FISH.id);
  const bpCrab = game.inventory.backpack.findIndex((s) => s?.id === RAW_CRAB.id);
  assert.ok(bpFish >= 0 && bpCrab >= 0);
  assert.equal(moveInventoryStack(game, null, { group: 'backpack', index: bpFish }, { group: 'hotbar', index: 2 }), true);
  assert.equal(moveInventoryStack(game, null, { group: 'backpack', index: bpCrab }, { group: 'hotbar', index: 4 }), true);

  // Raw fish gives 5 oxygen and 10% chance of 5s poison.
  toggleGodMode(world, player);
  const rawFishSlot = 2;
  player.oxygen = 18;
  assert.equal(useFood(game, rawFishSlot, () => 0.05).message, 'Oxygen is already full.');
  assert.equal(game.inventory.count(RAW_FISH.id), 1);

  player.oxygen = 6;
  const safeFish = useFood(game, rawFishSlot, () => 0.5);
  assert.ok(safeFish.inventoryChanged && !safeFish.poisoned);
  assert.equal(player.oxygen, 11);
  assert.equal(player.poison, 0);

  grantItem(game, RAW_FISH.id, 1);
  const poisonFishSlot = game.inventory.hotbar.findIndex((s) => s?.id === RAW_FISH.id);
  const badFish = useFood(game, poisonFishSlot, () => 0.05);
  assert.equal(badFish.poisoned, true);
  assert.equal(player.oxygen, 16);
  assert.equal(player.poison, 5);
  player.poison = 0;

  // Raw crab gives 5 health and 10% chance of 5s poison.
  const rawCrabSlot = 4;
  player.health = 100;
  assert.equal(useFood(game, rawCrabSlot, () => 0.05).message, 'Health is already full.');
  assert.equal(game.inventory.count(RAW_CRAB.id), 1);

  player.health = 50;
  const safeCrab = useFood(game, rawCrabSlot, () => 0.5);
  assert.ok(safeCrab.inventoryChanged && !safeCrab.poisoned);
  assert.equal(player.health, 55);
  assert.equal(player.poison, 0);

  grantItem(game, RAW_CRAB.id, 1);
  const poisonCrabSlot = game.inventory.hotbar.findIndex((s) => s?.id === RAW_CRAB.id);
  const badCrab = useFood(game, poisonCrabSlot, () => 0.05);
  assert.equal(badCrab.poisoned, true);
  assert.equal(player.health, 60);
  assert.equal(player.poison, 5);
  player.poison = 0;

  // Cooking requires a fireplace (crafted/placed or village campfire) and transforms raw -> cooked safely.
  grantItem(game, RAW_FISH.id, 1);
  grantItem(game, RAW_CRAB.id, 1);
  assert.equal(canCraftItem(game, COOKED_FISH), false);
  assert.equal(craftItem(game, COOKED_FISH), false);
  assert.equal(canCraftItem(game, COOKED_CRAB), false);

  for (const [id, count] of Object.entries(FIREPLACE.cost)) grantItem(game, id, count);
  assert.equal(craftItem(game, FIREPLACE), true);
  const fpSlot = game.inventory.hotbar.findIndex((s) => s?.id === FIREPLACE.id);
  const tx = Math.floor(player.x / TILE) + 2;
  const ty = Math.floor((player.y + player.height) / TILE) - 1;
  editTile(world, tx, ty, MATERIAL.air);
  editTile(world, tx, ty + 1, MATERIAL.sand);
  const placePlan = planTileAction(game, targetTile(game, (tx + 0.5) * TILE, (ty + 0.5) * TILE), true, fpSlot);
  assert.equal(placePlan?.after, MATERIAL.fireplace);
  commitTileAction(game, placePlan);
  assert.equal(fireplaceAt(game, tx, ty)?.kind, FIREPLACE.id);
  assert.equal(nearestItem(game)?.kind, FIREPLACE.id);

  assert.equal(craftItem(game, COOKED_FISH, FIREPLACE.id), true);
  assert.equal(craftItem(game, COOKED_CRAB, FIREPLACE.id), true);
  assert.equal(game.inventory.count(RAW_FISH.id), 0);
  assert.equal(game.inventory.count(RAW_CRAB.id), 0);
  assert.equal(game.inventory.count(COOKED_FISH.id), 1);
  assert.equal(game.inventory.count(COOKED_CRAB.id), 1);

  // Cooked fish gives 15 oxygen with no poison; cooked crab gives 15 health with no poison.
  player.oxygen = 2;
  const cookedFishSlot = game.inventory.hotbar.findIndex((s) => s?.id === COOKED_FISH.id);
  const ateFish = useFood(game, cookedFishSlot, () => 0);
  assert.equal(ateFish.poisoned, false);
  assert.equal(player.oxygen, 17);
  assert.equal(player.poison, 0);

  player.health = 60;
  const cookedCrabSlot = game.inventory.hotbar.findIndex((s) => s?.id === COOKED_CRAB.id);
  const ateCrab = useFood(game, cookedCrabSlot, () => 0);
  assert.equal(ateCrab.poisoned, false);
  assert.equal(player.health, 75);
  assert.equal(player.poison, 0);

  // Placed fireplace survives save/reload, and jungle village campfire also works as a fireplace station.
  const reloaded = createGame(decodeSave(encodeSave(game)));
  assert.equal(tileAt(reloaded.world, tx, ty), MATERIAL.fireplace);
  assert.equal(fireplaceAt(reloaded, tx, ty)?.kind, FIREPLACE.id);

  const [, , vCol, vFloor] = jungleVillageStructures.find(([, kind]) => kind === 'campfire');
  const vtx = vCol + WEST_EXTENSION;
  reloaded.player.x = (vtx + 0.5) * TILE;
  reloaded.player.y = vFloor * TILE - reloaded.player.height;
  assert.equal(fireplaceAt(reloaded, vtx, vFloor - 1)?.kind, FIREPLACE.id);
});

test('skeleton archers shoot arrows along a parabolic trajectory matching player arrow gravity', () => {
  const { player, world, effects } = createGame();
  const baseCol = Math.floor(SPAWN.x / TILE) + 2;
  const floorRow = 12;
  for (let x = baseCol - 2; x <= baseCol + 14; x++) {
    for (let y = floorRow - 7; y < floorRow; y++) editTile(world, x, y, MATERIAL.air);
    editTile(world, x, floorRow, MATERIAL.deepstone);
  }

  const archer = {
    ...world.mobs.find((mob) => mob.kind === 'archer'),
    x: (baseCol + 1) * TILE,
    y: floorRow * TILE,
    homeX: (baseCol + 1) * TILE,
    homeY: floorRow * TILE,
    dx: 0,
    dy: 0,
    grounded: true,
    attackTimer: 0,
    windup: 0,
  };
  world.mobs = [archer];
  world.projectiles = [];
  Object.assign(player, {
    x: (baseCol + 7.5) * TILE,
    y: floorRow * TILE - player.height,
    dx: 0,
    dy: 0,
    grounded: true,
    health: 100,
    hurt: 0,
  });

  for (let i = 0; i < 120 && !world.projectiles.length; i++) {
    stepCaveEnemy(world, player, archer, 1 / 60, effects);
  }
  const [arrow] = world.projectiles;
  assert.equal(arrow?.kind, 'cave-arrow');
  const initialDy = arrow.dy;
  assert.ok(initialDy < -5, 'arrow should launch slightly upward to compensate for gravity along the arc');

  // Step the arrow and verify downward gravity (140 px/s^2) curves dy positive and lands on the player.
  let prevDy = initialDy;
  let hitPlayer = false;
  for (let i = 0; i < 90; i++) {
    const alive = stepCaveHazard(world, player, arrow, 1 / 60, effects);
    assert.ok(arrow.dy > prevDy, 'arrow vertical velocity should curve downward each frame');
    prevDy = arrow.dy;
    if (!alive) {
      hitPlayer = player.health < 100;
      break;
    }
  }
  assert.equal(hitPlayer, true, 'parabolic skeleton arrow should hit the player');
});

test('cave spiders drop string and crafting a bow requires 2 strings instead of kelp', () => {
  const game = createGame();
  const spider = game.world.mobs.find((mob) => mob.kind === 'spider');
  assert.ok(spider);
  const effects = [];
  const res = damageMob(game.world, spider, spider.maxHealth + 10, 0, 0, effects);
  assert.deepEqual(res?.drop, { id: STRING.id, count: 1 });
  assert.ok(effects.some((e) => e.drop?.id === STRING.id && e.drop?.count === 1));

  const craftGame = createGame();
  craftGame.inventory.add('wood', 3);
  craftGame.inventory.add('kelp', 5);
  craftGame.inventory.add(STRING.id, 1);
  assert.equal(craftItem(craftGame, BOW), false, '1 string is not enough to craft a bow');
  craftGame.inventory.add(STRING.id, 1);
  assert.equal(craftItem(craftGame, BOW), true, '3 wood and 2 strings craft a bow');
  assert.equal(craftGame.inventory.count(STRING.id), 0);
  assert.equal(craftGame.inventory.count('kelp'), 5);
});

test('dungeon blood bats fly in dark red, attack with 30% 10s blindness or 40% 5s bleeding, and render pitch-black FOV', () => {
  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class {
    rect() {}
    addPath() {}
  };
  try {
    const game = createGame();
    const { world, player } = game;
    const bats = world.mobs.filter((mob) => mob.kind === 'blood-bat');
    assert.ok(bats.length >= 4, 'dungeon should host blood bats');
    for (const bat of bats) {
      const col = Math.floor(bat.x / TILE) - WEST_EXTENSION;
      const row = Math.floor(bat.y / TILE);
      assert.equal(isDungeonMasonry(col, row), true, `${bat.id} should spawn inside dungeon masonry`);
    }

    const bat = bats[0];
    world.mobs = [bat];
    const startX = bat.x;
    const startY = bat.y;
    Object.assign(player, {
      x: startX + 36,
      y: startY - player.height / 2,
      dx: 0,
      dy: 0,
      hurt: 0,
      health: 100,
      blindness: 0,
      bleed: 0,
      bleedTick: 0,
    });

    // 1. Roll < 0.30 -> 10s blindness (no bleeding).
    bat.attackTimer = 0;
    bat.statusRoll = 0.15;
    for (let i = 0; i < 60 && player.health === 100; i++) {
      stepCaveEnemy(world, player, bat, 1 / 60, game.effects);
    }
    assert.ok(player.health < 100, 'blood bat should swoop and bite the player');
    assert.equal(player.blindness, 10);
    assert.equal(player.bleed, 0);
    assert.ok(playerStatusEffects(player).some((e) => e.id === 'blindness' && e.seconds === 10));

    // 2. Roll in [0.30, 0.70) -> 5s bleeding (no new blindness).
    player.blindness = 0;
    player.hurt = 0;
    player.health = 100;
    bat.x = startX;
    bat.y = startY;
    bat.attackTimer = 0;
    bat.statusRoll = 0.5;
    for (let i = 0; i < 60 && player.health === 100; i++) {
      stepCaveEnemy(world, player, bat, 1 / 60, game.effects);
    }
    assert.ok(player.health < 100);
    assert.equal(player.bleed, 5);
    assert.equal(player.blindness, 0);
    assert.ok(playerStatusEffects(player).some((e) => e.id === 'bleeding' && e.seconds === 5));

    // 3. Roll >= 0.70 -> normal hit without blindness or bleeding.
    player.bleed = 0;
    player.hurt = 0;
    player.health = 100;
    bat.x = startX;
    bat.y = startY;
    bat.attackTimer = 0;
    bat.statusRoll = 0.85;
    for (let i = 0; i < 60 && player.health === 100; i++) {
      stepCaveEnemy(world, player, bat, 1 / 60, game.effects);
    }
    assert.ok(player.health < 100);
    assert.equal(player.bleed, 0);
    assert.equal(player.blindness, 0);

    // 4. Verify dark-red bat sprite and pitch-black radial blindness overlay render cleanly.
    player.blindness = 10;
    const fillColors = [];
    let radialGradCalls = 0;
    const noop = () => {};
    const grad = { addColorStop: noop };
    const ctx = {
      save: noop, restore: noop, scale: noop, rotate: noop, translate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      putImageData: noop, stroke: noop,
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      fill() { fillColors.push(this.fillStyle); },
      fillRect() { fillColors.push(this.fillStyle); },
      clearRect: noop,
      createLinearGradient: () => grad,
      createRadialGradient() {
        radialGradCalls++;
        return grad;
      },
    };
    const renderer = createRenderer({
      width: 320,
      height: 180,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
      getContext: () => ctx,
    });
    renderer.draw({
      world,
      player,
      snorkel: null,
      camera: { x: bat.x - 160, y: bat.y - 90, width: 320, height: 180 },
      time: 1, elapsed: 1, effects: [], particles: [],
      held: null, attack: null, hasArrow: false, playerArrows: [], targetMob: bat,
      aim: null, mining: null, miningSwing: null,
      conditions: { ambient: 1, darkness: 0.5, rain: 0, night: false, sky: '#000', skyLow: '#000' },
      overview: false, reducedMotion: false,
    });
    assert.ok(fillColors.includes('#7d1826') && fillColors.includes('#470a14'), 'blood bat should render in dark red');
    assert.ok(radialGradCalls > 0, 'blindness effect should draw pitch-black radial FOV vignette');
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});
