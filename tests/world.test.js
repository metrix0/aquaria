import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW, BOW, COPPER_PICKAXE, COPPER_SPEAR, MATERIAL, SPEAR } from '../src/content.js';
import { updateEnemySpawns } from '../src/enemies.js';
import { collides, movePlayer, playerInWater, PLAYER_SIZE, toggleGodMode } from '../src/gameplay/player.js';
import { Inventory } from '../src/inventory.js';
import { advanceMining, applyTerrain, collectItem, commitTileAction, createGame, craftItem, craftTank, nearestItem, oxygenCapacity, stepGame, targetTile, useWeapon } from '../src/gameplay/simulation.js';
import { decodeSave, encodeSave } from '../src/save.js';
import { CHUNK_SIZE, createWorld, editTile, inWater, tileAt, waterTileAt } from '../src/world.js';
import { CAVE_SYSTEM, COLS, ISLAND_CAVE, ROWS, SPAWN, TILE, WATER, WATER_ROW, WEST_EXTENSION, generateCaveSystem, groundAt } from '../src/world/generation.js';

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
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (visited[(c.y + dy) * COLS + (c.tx + dx)]) return true;
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

test('the island cave expands below the surface with solid rock separating it from the ocean', () => {
  const world = createWorld();
  const center = WEST_EXTENSION + ISLAND_CAVE.center;
  const surface = groundAt(center);
  let ceiling = surface;
  while (tileAt(world, center, ceiling)) ceiling++;
  assert.equal(ceiling - surface, 11);

  const cells = [[center, ceiling]];
  const visited = new Set([ceiling * COLS + center]);
  let left = center, right = center, deepest = ceiling;
  for (const [x, y] of cells) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    deepest = Math.max(deepest, y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        assert.ok(ty >= groundAt(tx), `cave too close to the surface at ${tx},${ty}`);
        assert.equal(waterTileAt(world, tx, ty), false, `cave too close to water at ${tx},${ty}`);
        const key = ty * COLS + tx;
        if (Math.abs(dx) + Math.abs(dy) !== 1 || visited.has(key) || tileAt(world, tx, ty)) continue;
        visited.add(key);
        cells.push([tx, ty]);
      }
    }
  }
  assert.ok(left <= center - 16 && right >= center + 16);
  assert.equal(deepest, 79);
  assert.ok(cells.length > 700);
  for (let x = WEST_EXTENSION + 42; x <= WEST_EXTENSION + 74; x++) {
    for (let y = 43; y <= 57; y++) {
      assert.equal(waterTileAt(world, x, y), false, `old flooded chamber remains at ${x},${y}`);
    }
  }
});

test('after digging in, the expanded island cave is walkable and the survey cache stays collected', () => {
  const game = createGame();
  const { world, player } = game;
  const center = WEST_EXTENSION + ISLAND_CAVE.center;
  const surface = groundAt(center);
  for (let y = surface; tileAt(world, center, y); y++) editTile(world, center, y, MATERIAL.air);
  player.x = (center + 0.5) * TILE;
  player.y = surface * TILE - player.height;

  function walkUntil(reached, { left = false, right = false, up = false } = {}) {
    for (let frame = 0; frame < 1000 && !reached(); frame++) {
      movePlayer(world, player, { left, right, up, down: false, jump: up && player.grounded }, 1 / 60);
      assert.equal(playerInWater(world, player), false);
    }
    assert.ok(reached());
  }

  walkUntil(() => player.grounded && player.y > WATER);
  const cache = world.items.find(({ id }) => id === 'island-cave-cache');
  walkUntil(() => player.grounded && Math.abs(player.x - cache.x) < TILE / 4, { left: true });
  assert.match(collectItem(game), /Survey cache recovered/);
  assert.equal(game.inventory.count('copper'), 2);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(collectItem(restored), undefined);
  assert.equal(restored.inventory.count('copper'), 2);

  walkUntil(() => player.x >= center * TILE, { right: true, up: true });
  const eastLanding = (center + 17.5) * TILE;
  walkUntil(() => player.x >= eastLanding && player.grounded, { right: true, up: true });
  walkUntil(() => player.x <= (center - 22.5) * TILE && player.grounded, { left: true });
  assert.ok(player.y >= 78 * TILE);
  walkUntil(() => player.x >= eastLanding && player.grounded, { right: true, up: true });
  walkUntil(() => player.x <= (center + 0.5) * TILE && player.grounded && player.y < 28 * TILE, { left: true, up: true });
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

test('the selected pickaxe controls mining speed and unlocks deeper rock', () => {
  const game = createGame();
  const target = targetTile(game, SPAWN.x, SPAWN.y + TILE * 2);
  const { tx, ty } = target;
  editTile(game.world, tx, ty, MATERIAL.sand);
  assert.ok(advanceMining(game, target, null, 0.45, 2).progress >= 1);

  editTile(game.world, tx, ty, MATERIAL.stone);
  const byHand = advanceMining(game, target, null, 0.7, 2);
  assert.ok(byHand.progress < 0.25);
  assert.equal(advanceMining(game, target, byHand, 0.35, 0).progress, 0.5);

  for (const material of [MATERIAL.deepstone, MATERIAL.cobalt]) {
    editTile(game.world, tx, ty, material);
    assert.match(advanceMining(game, target, null, 10, 0).blocked, /requires a Copper pickaxe/);
    assert.equal(tileAt(game.world, tx, ty), material);
  }
  editTile(game.world, tx, ty, MATERIAL.copper);
  assert.match(advanceMining(game, target, null, 10, 2).blocked, /requires a pickaxe/);
  assert.ok(advanceMining(game, target, null, 0.85, 0).progress >= 1);

  assert.equal(craftItem(game, COPPER_PICKAXE), false);
  game.inventory.add('copper', 3);
  assert.equal(craftItem(game, COPPER_PICKAXE), true);
  assert.equal(game.inventory.count('copper'), 0);
  assert.equal(game.inventory.count('wood'), 1);
  assert.ok(game.inventory.move({ group: 'backpack', index: 0 }, { group: 'hotbar', index: 2 }));
  editTile(game.world, tx, ty, MATERIAL.deepstone);
  const mining = advanceMining(game, target, null, 1.7, 2);
  assert.ok(mining.progress >= 1);
  commitTileAction(game, mining.action);
  assert.equal(game.inventory.count('stone'), 1);
  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(tileAt(restored.world, tx, ty), MATERIAL.air);
  assert.equal(restored.inventory.hotbar[2].id, COPPER_PICKAXE.id);
});

test('legacy progress and edits on both sides of a chunk boundary migrate', () => {
  const legacy = {
    format: 1, x: SPAWN.x - WEST_EXTENSION * TILE, y: SPAWN.y, oxygen: 28, tank: true, completed: true,
    inventory: { wood: 11, sand: 3 },
    edits: [[32 * 224 + 2 * CHUNK_SIZE - WEST_EXTENSION - 1, 5], [32 * 224 + 2 * CHUNK_SIZE - WEST_EXTENSION, 0], null, [4, 6]],
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

test('harvested palms migrate from the previous save and stay removed on reload', () => {
  const migrated = createGame(decodeSave({ format: 1, harvested: ['palm-62'] }));
  assert.equal(migrated.world.harvested.has('palm-62'), true);

  const game = createGame();
  const target = targetTile(game, (62 + WEST_EXTENSION) * 16 + 8, 9 * 16 + 8);
  const mining = advanceMining(game, target, null, 0.5);
  assert.equal(mining.action.treeId, 'palm-62');
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
  assert.equal(friendly.length, 12);
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

test('the wreck chest grants a swimming helmet that extends oxygen capacity', () => {
  const game = createGame();
  assert.equal(oxygenCapacity(game), 18);

  const chest = game.world.items.find((item) => item.id === 'wreck-chest');
  const wreckCache = game.world.items.find((item) => item.id === 'wreck-cache');
  assert.ok(chest && wreckCache);
  assert.equal(chest.kind, 'helmet');
  assert.ok(chest.y > WATER);
  assert.ok(Math.abs(chest.x - wreckCache.x) <= 5 * TILE);
  assert.ok(Math.hypot(chest.x - wreckCache.x, chest.y - wreckCache.y) >= 35);

  game.player.x = chest.x;
  game.player.y = chest.y - Math.ceil(game.player.height / 2);
  assert.equal(collectItem(game), 'Swimming helmet equipped. +14s oxygen');
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
  assert.equal(nearestItem(reloadedGame), undefined);
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
  shark.x = game.player.x + 48;
  shark.y = game.player.y + 11;
  shark.homeX = shark.x;
  shark.homeY = shark.y;

  const thrust = useWeapon(game, 1, shark.x, shark.y);
  assert.equal(thrust.handled, true);
  assert.equal(game.attack.kind, SPEAR.id);
  assert.equal(shark.health, 5);

  const neutral = { left: false, right: false, up: false, down: false, jump: false };
  for (let i = 0; i < 30; i++) stepGame(game, neutral, 1 / 60);
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
  shark.x = game.player.x + 56;
  shark.y = game.player.y + 11;
  useWeapon(game, 1, shark.x, shark.y);
  assert.equal(shark.health, 0);
  assert.ok(shark.respawn > 0);
  assert.ok(game.effects.some((effect) => effect.message === 'Defeated shark!'));

  for (let i = 0; i < 30; i++) stepGame(game, neutral, 1 / 60);
  game.inventory.spend(ARROW.id, 3);
  const dryFire = useWeapon(game, 2, shark.x, shark.y);
  assert.equal(dryFire.handled, true);
  assert.match(dryFire.message, /Out of arrows/);

  const restored = createGame(decodeSave(encodeSave(game)));
  assert.equal(restored.inventory.hotbar[1].id, COPPER_SPEAR.id);
  assert.equal(restored.inventory.hotbar[2].id, BOW.id);
});
