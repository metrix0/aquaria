import { isTrapIntact, stepCaveTraps, swingHead } from '../src/gameplay/cave-traps.js';
import { ISLAND_DEEPSTONE_ROW, isDryIslandCave, isDungeonMasonry } from '../src/world/island-cave.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMOR, ARROW, BOW, BROKEN_PICKAXE, CAPTAINS_CUTLASS, CHEST_SIZE, COBALT_SNORKEL, COBALT_SPEAR, COPPER_PICKAXE, COPPER_SNORKEL, COPPER_SPEAR, DIVING_FIN, IRON_PICKAXE, IRON_SNORKEL, IRON_SWORD, KELP_DRESSING, KRAKEN_CHEST_ID, MATERIAL, SNORKEL_CHEST_ID, SPEAR, WOODEN_DOOR, WORKBENCH } from '../src/content.js';
import { updateEnemySpawns } from '../src/gameplay/enemies/enemy-fish.js';
import { caveEnemySpecs, damageMob, jellyfishShockRadius, stepCaveEnemy, stepCaveHazard, stepMobs } from '../src/gameplay/mobs.js';
import { KRAKEN_DEATH_DURATION, krakenBarrierX } from '../src/gameplay/enemies/kraken.js';
import { createScreenShake } from '../src/gameplay/screen-shake.js';
import { stepWreckGhost } from '../src/gameplay/enemies/wreck-ghost.js';
import { isInsideShipwreck } from '../src/world/shipwreck.js';
import { collides, movePlayer, playerHeadInWater, playerInWater, PLAYER_SIZE, takeDamage, toggleGodMode } from '../src/gameplay/player.js';
import { Inventory } from '../src/inventory.js';
import { advanceMining, applyTerrain, canCraftItem, chestAt, commitTileAction, createGame, craftItem, equippedFeet, grantItem, moveInventoryStack, nearestItem, oxygenCapacity, planTileAction, resetRoomProgress, stepGame, targetTile, useWeapon, workbenchAt } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { createRenderer } from '../src/render.js';
import { CHUNK_SIZE, buildCellFree, createWorld, editTile, inWater, isTreeStanding, tileAt, waterTileAt } from '../src/world.js';
import { CAVE_SYSTEM, COLS, EAST_EXTENSION, ISLAND_CAVE, JUNGLE_FADE_END_COLUMN, JUNGLE_FADE_START_COLUMN, KRAKEN_COLUMN, ORIGINAL_COLS, ROWS, SPAWN, TILE, WATER, WATER_ROW, WEST_EXTENSION, generateCaveSystem, groundAt, waterwayAt } from '../src/world/generation.js';

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
    assert.ok(tierChambers.length >= 4);
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

test('both cave tiers stay dry up to the two marked waterways', () => {
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
        if (waterTileAt(world, tx, ty)) {
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
  for (const [x, y] of [[-25, 110], [139, 102], [43, 316], [123, 344], [-12, 427], [118, 557], [60, 611], [100, 611]]) {
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
      if (isDryIslandCave(x - WEST_EXTENSION, y)) {
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
    assert.ok(player.y + player.height >= minFloor * TILE, `reached the room at row ${minFloor}`);
  }

  // The existing Underground crossover still connects the two entrance rooms.
  Object.assign(player, { x: chamberX(45), y: 345 * TILE - player.height, dx: 0, dy: 0 });
  walkUntil(() => player.x >= chamberX(105) && player.grounded, { right: true, climb: true });
  assert.ok(Math.abs(player.y + player.height - 346 * TILE) < 1);

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

test('cave enemies start on dry floors and archer shots and venom can hurt the player', () => {
  const { player, world } = createGame();
  const foes = world.mobs.filter((mob) => caveEnemySpecs[mob.kind]);
  assert.equal(new Set(foes.map((mob) => mob.kind)).size, 5);
  for (const mob of foes) {
    const x = Math.floor(mob.x / TILE);
    const feet = mob.y / TILE;
    const spec = caveEnemySpecs[mob.kind];
    assert.ok(tileAt(world, x, feet), mob.id);
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

test('Underground iron occurs in small contiguous veins', () => {
  const world = createWorld();
  const visited = new Set();
  let count = 0;
  for (let y = ISLAND_DEEPSTONE_ROW; y < 615; y++) {
    for (let x = 80; x < 267; x++) {
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
  assert.deepEqual(saved.progress, { snorkel: null });
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
  assert.equal(craftItem(game, BOW), true);
  assert.equal(craftItem(game, ARROW), true);
  assert.equal(game.inventory.count(ARROW.id), 4);

  const bowSlot = game.inventory.backpack.findIndex((stack) => stack?.id === BOW.id);
  assert.ok(bowSlot >= 0);
  assert.ok(game.inventory.move({ group: 'backpack', index: bowSlot }, { group: 'hotbar', index: 2 }));
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

  const copperSpearSlot = game.inventory.backpack.findIndex((stack) => stack?.id === COPPER_SPEAR.id);
  assert.ok(game.inventory.move({ group: 'backpack', index: copperSpearSlot }, { group: 'hotbar', index: 1 }));
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
  game.inventory.add('sand', 1);
  game.inventory.add('stone', 1);
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
    assert.deepEqual(encodeSave(migrated).progress, { snorkel: snorkel.id });
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
  Object.assign(player, { x: barrierX - 70, y: WATER + 12 * TILE, dx: 0, dy: 0, hurt: 0, health: 100 });

  // Primary attack: tentacle tackle.
  kraken.attackTimer = 0;
  kraken.attackIndex = 0;
  for (let i = 0; i < 70; i++) stepGame(game, {}, 1 / 60);
  assert.ok(player.health < 100);
  assert.ok(player.dx < 0 || player.x < barrierX - 70);

  // Secondary attack: spawns three squids.
  Object.assign(player, { x: barrierX - 90, y: WATER + 12 * TILE, dx: 0, dy: 0, hurt: 0 });
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
    for (let i = 0; i < 240; i++) {
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
    const backpackSlot = { group: 'backpack', index: 0 };
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
