import { isTrapIntact, stepCaveTraps, swingHead } from '../src/gameplay/cave-traps.js';
import { ISLAND_DEEPSTONE_ROW } from '../src/world/island-cave.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMOR, ARROW, BOW, BROKEN_PICKAXE, CHEST_SIZE, COBALT_SPEAR, COPPER_PICKAXE, COPPER_SPEAR, IRON_PICKAXE, IRON_SWORD, MATERIAL, REINFORCED_HELMET, SPEAR, SWIMMING_HELMET, WOODEN_DOOR, WORKBENCH } from '../src/content.js';
import { caveEnemySpecs, stepCaveEnemy, stepCaveHazard } from '../src/gameplay/cave-enemies.js';
import { updateEnemySpawns } from '../src/enemies.js';
import { collides, movePlayer, playerInWater, PLAYER_SIZE, takeDamage, toggleGodMode } from '../src/gameplay/player.js';
import { Inventory } from '../src/inventory.js';
import { advanceMining, applyTerrain, canCraftItem, chestAt, commitTileAction, createGame, craftItem, craftTank, equipChestLoot, moveChestStack, nearestItem, oxygenCapacity, planTileAction, resetRoomProgress, stepGame, targetTile, useWeapon, workbenchAt } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { CHUNK_SIZE, buildCellFree, createWorld, editTile, inWater, isTreeStanding, tileAt, waterTileAt } from '../src/world.js';
import { CAVE_SYSTEM, COLS, ISLAND_CAVE, ROWS, SPAWN, TILE, WATER, WATER_ROW, WEST_EXTENSION, generateCaveSystem, groundAt, waterwayAt } from '../src/world/generation.js';

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
  for (const [x, y] of [[-24, 119], [142, 102], [55, 311], [130, 337], [-12, 455], [141, 559], [48, 611], [108, 611]]) {
    assert.ok(visited.has(y * COLS + x + WEST_EXTENSION), `${x},${y} is reachable`);
  }
  assert.ok(cells.length >= 14000 && cells.length <= 18000);
  const junction = WEST_EXTENSION + 80;
  const passage = WEST_EXTENSION + 70;
  assert.equal(tileAt(world, passage, 33), MATERIAL.stone);
  assert.equal(tileAt(world, junction, 49), MATERIAL.air);
  for (const [column, low, high] of [[12, 335, 337], [64, 393, 396], [6, 450, 454], [17, 500, 503]]) {
    const x = column + WEST_EXTENSION;
    assert.ok(tileAt(world, x, low), 'chamber neck has a low ceiling');
    assert.ok(tileAt(world, x, high), 'rooms narrow into a stone lintel');
    assert.equal(tileAt(world, x, high + 1), MATERIAL.air, 'the passage stays walkable');
  }
  assert.ok(outlets.has(48) && outlets.has(108));
  assert.ok([...outlets].every((x) => x >= 46 && x <= 54 || x >= 100 && x <= 110));

  const submerged = [[48 + WEST_EXTENSION, 612]];
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
  assert.ok(wetVisited.has(612 * COLS + 108 + WEST_EXTENSION));
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

  function walkUntil(reached, { left = false, right = false, up = false } = {}) {
    for (let frame = 0; frame < 1300 && !reached(); frame++) {
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
  assert.equal(moveChestStack(game, cache.id, { group: 'chest', index: 0 }, { group: 'backpack', index: 0 }), true);
  assert.equal(game.inventory.count('copper'), 2);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(nearestItem(restored)?.id, cache.id);
  assert.deepEqual(restored.chests.get(cache.id), Array(CHEST_SIZE).fill(null));
  assert.equal(restored.inventory.count('copper'), 2);
  assert.equal(buildCellFree(restored.world, Math.floor(cache.x / TILE), Math.floor(cache.y / TILE)), false);

  const chamberX = (column) => (column + WEST_EXTENSION + .5) * TILE;
  const restartAtFoyer = () => Object.assign(player, {
    x: (center + .5) * TILE, y: 33 * TILE - player.height, dx: 0, dy: 0,
  });
  restartAtFoyer();
  walkUntil(() => player.x >= chamberX(78.5), { right: true });
  walkUntil(() => player.x <= chamberX(-30.5), { left: true });
  assert.ok(player.y >= 116 * TILE);
  walkUntil(() => player.x >= chamberX(56.5), { right: true });
  walkUntil(() => player.x <= chamberX(-32.5), { left: true });
  walkUntil(() => player.x >= chamberX(117), { right: true });
  assert.ok(player.y >= ISLAND_DEEPSTONE_ROW * TILE);

  restartAtFoyer();
  walkUntil(() => player.x >= chamberX(155.25), { right: true });
  walkUntil(() => player.x <= chamberX(141.5), { left: true });
  assert.ok(player.y > 100 * TILE);
  walkUntil(() => player.x >= chamberX(153), { right: true });
  walkUntil(() => player.x <= chamberX(84.5), { left: true });
  walkUntil(() => player.x >= chamberX(151), { right: true });
  walkUntil(() => player.x <= chamberX(80.5), { left: true });
  walkUntil(() => player.x >= chamberX(131), { right: true });
  assert.ok(player.y >= ISLAND_DEEPSTONE_ROW * TILE);

  Object.assign(player, { x: chamberX(20), y: 342 * TILE - player.height, dx: 0, dy: 0 });
  walkUntil(() => player.x >= chamberX(100), { right: true });
  assert.ok(Math.abs(player.y + player.height - 342 * TILE) < 1);

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
  assert.equal(craftItem(game, COPPER_PICKAXE), false);
  game.inventory.add('copper', 3);
  assert.equal(craftItem(game, COPPER_PICKAXE), true);
  assert.equal(game.inventory.count('copper'), 0);
  assert.equal(game.inventory.count('wood'), 1);
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
  assert.deepEqual(saved.progress, { 'air-tank': true });
  assert.equal(saved.player.oxygen, 28);
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
  game.inventory.add('stone', 3);
  game.inventory.add('kelp', 2);
  assert.equal(craftTank(game), true);
  assert.equal(game.player.oxygen, 42);
  assert.equal(craftTank(game), false);
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

test('the wreck chest opens before equipping the swimming helmet and stays available after reload', () => {
  const game = createGame();
  assert.equal(oxygenCapacity(game), 18);

  const chest = game.world.items.find((item) => item.id === 'wreck-chest');
  const wreckCache = game.world.items.find((item) => item.id === 'wreck-cache');
  assert.ok(chest && wreckCache);
  assert.equal(chest.kind, 'chest');
  assert.ok(chest.y > WATER);
  assert.ok(Math.abs(chest.x - wreckCache.x) <= 5 * TILE);
  assert.ok(Math.hypot(chest.x - wreckCache.x, chest.y - wreckCache.y) >= 35);

  game.player.x = chest.x;
  game.player.y = chest.y + 8 - game.player.height;
  assert.equal(nearestItem(game), chest);
  assert.equal(oxygenCapacity(game), 18);
  assert.equal(game.chests.get(chest.id)[0].id, SWIMMING_HELMET.id);
  assert.equal(moveChestStack(game, chest.id, { group: 'chest', index: 0 }, { group: 'backpack', index: 0 }), false);
  assert.equal(equipChestLoot(game, chest.id, 0), 'Swimming helmet equipped. +14s oxygen');
  assert.equal(game.progress.swimmingHelmet, true);
  assert.equal(oxygenCapacity(game), 32);
  assert.equal(game.player.oxygen, 32);

  const reloaded = decodeSave(encodeSave(game));
  assert.equal(reloaded.progress.swimmingHelmet, true);
  assert.ok(reloaded.world.harvested.includes('wreck-chest'));

  const reloadedGame = createGame(reloaded);
  assert.equal(reloadedGame.progress.swimmingHelmet, true);
  assert.equal(oxygenCapacity(reloadedGame), 32);
  assert.ok(reloadedGame.world.harvested.has('wreck-chest'));
  assert.equal(nearestItem(reloadedGame)?.id, chest.id);
  assert.equal(reloadedGame.chests.get(chest.id)[0], null);
  assert.equal(equipChestLoot(reloadedGame, chest.id, 0), undefined);
});

test('chest transfers, legacy loot, and room progress survive the appropriate save boundaries', () => {
  const fresh = encodeSave(createGame());
  delete fresh.world.chests;
  fresh.world.harvested = ['wreck-cache', 'wreck-chest'];
  const game = createGame(decodeSave(fresh));
  const id = 'wreck-cache';
  const chest = { group: 'chest', index: CHEST_SIZE - 1 };
  const wood = { group: 'hotbar', index: 3 };
  const tool = { group: 'hotbar', index: 0 };

  assert.deepEqual(game.chests.get(id), Array(CHEST_SIZE).fill(null));
  assert.equal(game.progress.swimmingHelmet, true);
  assert.equal(game.chests.get('wreck-chest')[0], null);
  assert.equal(chestAt(game, game.world.items.find((item) => item.id === id).x, 0), undefined);
  assert.equal(moveChestStack(game, id, wood, { group: 'chest', index: CHEST_SIZE }), false);
  assert.equal(moveChestStack(game, id, wood, chest), true);
  assert.equal(moveChestStack(game, id, tool, chest), true);
  assert.equal(game.inventory.hotbar[0].id, 'wood');
  assert.deepEqual(game.chests.get(id)[chest.index], { id: BROKEN_PICKAXE.id, count: 1 });

  const roomSnapshot = encodeSave(game, false);
  const restored = createGame(decodeSave(roomSnapshot));
  assert.deepEqual(encodeSave(restored, false), roomSnapshot);
  assert.equal(moveChestStack(restored, id, chest, wood), true);
  assert.equal(restored.inventory.hotbar[3].id, BROKEN_PICKAXE.id);
  assert.equal(restored.chests.get(id)[chest.index], null);
  const reset = resetRoomProgress(restored);
  assert.deepEqual(reset.chests.get(id)[0], { id: 'wood', count: 8 });
  assert.equal(reset.chests.get('wreck-chest')[0].id, SWIMMING_HELMET.id);
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

  for (let i = 0; i < 24; i++) {
    // Keep the targets in place so the front crab overlaps several frames of the thrust.
    world.mobs.forEach((mob, index) => Object.assign(mob, targets[index]));
    stepGame(game, {}, 1 / 60);
  }
  assert.deepEqual(world.mobs.map((mob) => mob.health), [5, 7, 7, 7]);

  const arcTarget = { x: player.x + 11, y: player.y + 4 };
  world.mobs = [{ ...crab, ...arcTarget, health: 7, maxHealth: 7 }];
  useWeapon(game, 0, player.x + 72, player.y + 12);
  for (let i = 0; i < 18; i++) {
    Object.assign(world.mobs[0], arcTarget);
    stepGame(game, {}, 1 / 60);
  }
  assert.equal(world.mobs[0].health, 6);
});

test('craftable spears and bow with arrows damage and defeat sea enemies', () => {
  const game = createGame();
  game.inventory.add('wood', 6);
  game.inventory.add('stone', 2);
  game.inventory.add('kelp', 1);
  game.inventory.add('copper', 2);

  assert.equal(craftItem(game, SPEAR), true);
  assert.equal(craftItem(game, COPPER_SPEAR), true);
  assert.equal(craftItem(game, BOW), true);
  assert.equal(craftItem(game, ARROW), true);
  assert.equal(game.inventory.count(ARROW.id), 4);

  const spearSlot = game.inventory.backpack.findIndex((stack) => stack?.id === SPEAR.id);
  const bowSlot = game.inventory.backpack.findIndex((stack) => stack?.id === BOW.id);
  assert.ok(spearSlot >= 0);
  assert.ok(bowSlot >= 0);
  assert.ok(game.inventory.move({ group: 'backpack', index: spearSlot }, { group: 'hotbar', index: 1 }));
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

test('the western wreck has flooded holds, mineable timber and three persistent wood caches', () => {
  const game = createGame();
  const { world, player } = game;
  const startingWood = game.inventory.count('wood');
  const caches = world.items.filter(({ id }) => id.startsWith('western-wreck-'));
  assert.equal(caches.length, 3);
  for (const cache of caches) {
    const tx = Math.floor(cache.x / TILE);
    const ty = Math.floor(cache.y / TILE);
    assert.ok(waterTileAt(world, tx, ty));
    assert.equal(tileAt(world, tx, ty + 1), MATERIAL.wood);
    player.x = cache.x;
    player.y = cache.y - player.height / 2;
    assert.equal(nearestItem(game), cache);
    const index = game.inventory.backpack.findIndex((stack) => !stack);
    assert.equal(moveChestStack(game, cache.id, { group: 'chest', index: 0 }, { group: 'backpack', index }), true);
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
  assert.ok(caches.every(({ id }) => reloaded.chests.get(id).every((stack) => !stack)));
});

test('a crafted workbench can be placed, used, saved, and mined back into inventory', () => {
  const game = createGame();
  const materials = WORKBENCH.cost.wood;
  assert.equal(canCraftItem(game, WORKBENCH), false);
  game.inventory.add('wood', materials);
  const before = game.inventory.count('wood');
  assert.equal(craftItem(game, WORKBENCH), true);
  assert.equal(game.inventory.count('wood'), before - materials);

  const slot = game.inventory.backpack.findIndex((stack) => stack?.id === WORKBENCH.id);
  assert.equal(game.inventory.move({ group: 'backpack', index: slot }, { group: 'hotbar', index: 1 }), true);
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

test('bench recipe requirements are enforced when checking and crafting', () => {
  const game = createGame();
  const benchRecipe = { ...WOODEN_DOOR, station: WORKBENCH.id };
  assert.equal(canCraftItem(game, WOODEN_DOOR), true);
  assert.equal(canCraftItem(game, benchRecipe), false);
  assert.equal(craftItem(game, benchRecipe), false);
  assert.equal(game.inventory.count('wood'), WOODEN_DOOR.cost.wood);
  assert.equal(canCraftItem(game, benchRecipe, WORKBENCH.id), true);
  assert.equal(craftItem(game, benchRecipe, WORKBENCH.id), true);
  assert.equal(game.inventory.count(WOODEN_DOOR.id), 1);
});

test('breathing helmet upgrades require the wreck helmet and stack with the air tank across saves', () => {
  const game = createGame();
  for (const [id, count] of Object.entries(REINFORCED_HELMET.cost)) game.inventory.add(id, count);
  assert.equal(craftItem(game, REINFORCED_HELMET, WORKBENCH.id), false);
  assert.equal(oxygenCapacity(game), 18);
  equipChestLoot(game, SWIMMING_HELMET.chestId, 0);
  assert.equal(oxygenCapacity(game), 32);
  assert.equal(craftItem(game, REINFORCED_HELMET), false);
  assert.equal(craftItem(game, REINFORCED_HELMET, WORKBENCH.id), true);
  assert.equal(oxygenCapacity(game), 46);
  assert.equal(game.player.oxygen, 46);
  game.inventory.add('kelp', 2);
  game.inventory.add('stone', 3);
  assert.equal(craftTank(game), true);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(oxygenCapacity(restored), 70);
  assert.equal(restored.player.oxygen, 70);
  assert.equal(canCraftItem(restored, REINFORCED_HELMET, WORKBENCH.id), false);
  assert.equal(restored.chests.get(SWIMMING_HELMET.chestId)[0], null);
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

test('iron sword hits through its swing arc and cobalt spear reaches farther than copper', () => {
  const game = createGame();
  const { player, world } = game;
  toggleGodMode(world, player);
  const crab = world.mobs.find((mob) => mob.kind === 'crab');
  const cases = [
    [IRON_SWORD, { x: player.x + 12, y: player.y + 3 }, 5],
    [COPPER_SPEAR, { x: player.x + 42, y: player.y + 15 }, 0],
    [COBALT_SPEAR, { x: player.x + 42, y: player.y + 15 }, 6],
  ];
  for (const [weapon, position, damage] of cases) {
    const target = { ...crab, ...position, health: 10, maxHealth: 10 };
    world.mobs = [target];
    game.inventory.hotbar[1] = { id: weapon.id, count: 1 };
    useWeapon(game, 1, player.x + 72, player.y + 12);
    assert.equal(target.health, 10);
    for (let i = 0; i < 30; i++) {
      Object.assign(target, position);
      stepGame(game, {}, 1 / 60);
    }
    assert.equal(target.health, 10 - damage, weapon.id);
  }
});
