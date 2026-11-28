import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIAL } from '../src/content.js';
import { createGame } from '../src/gameplay/simulation.js';
import { createRenderer } from '../src/render.js';
import { createWorld, tileAt, waterTileAt } from '../src/world.js';
import { TILE, WATER_ROW, WEST_EXTENSION, groundAt } from '../src/world/generation.js';
import { CORAL_COLUMN, CORAL_OPEN_ID, CORAL_SOLUTION, CORAL_DIALS, cycleCoralMark } from '../src/world/ocean-layout.js';
import { WATER_TEMPLE_LIGHT, createUndergroundLight, waterTempleLightSources } from '../src/world/lighting.js';
import {
  WATER_TEMPLE,
  WATER_TEMPLE_DOOR,
  WATER_TEMPLE_PUZZLE_DOOR,
  protectsWaterTemple,
  waterTempleDoorBounds,
  waterTemplePuzzleDoorBounds,
  waterTempleStoneAt,
  waterTempleFoundationTop,
} from '../src/world/water-temple.js';

test('water temple spans across the coral wall, stays below surface, and hosts big west door and smaller east puzzle door', () => {
  const world = createWorld();
  assert.ok(WATER_TEMPLE.left < CORAL_COLUMN - 2 && WATER_TEMPLE.right > CORAL_COLUMN + 2, 'temple crosses the coral wall');
  assert.ok(WATER_TEMPLE.topRow > WATER_ROW + 10, 'enlarged temple stays well below the ocean surface');
  assert.ok(WATER_TEMPLE_DOOR.column < CORAL_COLUMN - 2, 'main door stands on the left side of the coral wall');
  assert.ok(WATER_TEMPLE_PUZZLE_DOOR.column > CORAL_COLUMN + 2, 'smaller puzzle door stands on the right side of the coral wall');

  // Blocked by coral wall until the four ancient marks align.
  const coralWallTx = CORAL_COLUMN + WEST_EXTENSION;
  assert.equal(waterTileAt(world, coralWallTx, 40), false);
  for (const [slot, mark] of CORAL_SOLUTION.entries()) {
    for (let i = 0; i < mark; i++) cycleCoralMark(world, slot);
  }
  assert.ok(world.harvested.has(CORAL_OPEN_ID));
  assert.equal(waterTileAt(world, coralWallTx, 40), true);

  // Level seabed foundation with clean stepped stone plinth up to deckRow.
  assert.equal(groundAt(WATER_TEMPLE.center + WEST_EXTENSION), WATER_TEMPLE.seabedRow);
  const door = waterTempleDoorBounds(WEST_EXTENSION);
  const puzzleDoor = waterTemplePuzzleDoorBounds(WEST_EXTENSION);
  assert.equal(WATER_TEMPLE_DOOR.widthTiles, 6);
  assert.equal(WATER_TEMPLE_DOOR.heightTiles, 9);
  assert.ok(puzzleDoor.width < door.width && puzzleDoor.height < door.height, 'east puzzle door is smaller than main door');
  assert.equal(door.floor, WATER_TEMPLE.deckRow);

  // All sanctuary steps are uninterrupted carved stone and open doorway in front is swimmable water.
  for (let col = WATER_TEMPLE.left; col <= WATER_TEMPLE.right; col++) {
    const tx = col + WEST_EXTENSION;
    assert.equal(tileAt(world, tx, WATER_TEMPLE.seabedRow), MATERIAL.stone);
    const top = waterTempleFoundationTop(col);
    assert.equal(tileAt(world, tx, top), MATERIAL.stone);
    assert.equal(waterTileAt(world, tx, top - 1), true, `stairs above column ${col} must stay open water`);
  }
  for (let col = WATER_TEMPLE.center - 3; col <= WATER_TEMPLE.center + 3; col++) {
    const tx = col + WEST_EXTENSION;
    assert.equal(tileAt(world, tx, WATER_TEMPLE.deckRow), MATERIAL.stone);
    assert.equal(waterTempleStoneAt(col, WATER_TEMPLE.deckRow), true);
    for (let row = WATER_TEMPLE.deckRow - 9; row < WATER_TEMPLE.deckRow; row++) {
      assert.equal(waterTileAt(world, tx, row), true, `big door space at (${col}, ${row}) must stay flooded open water`);
    }
  }
  assert.equal(tileAt(world, WATER_TEMPLE_PUZZLE_DOOR.column + WEST_EXTENSION, WATER_TEMPLE_PUZZLE_DOOR.floor), MATERIAL.stone);
  assert.equal(protectsWaterTemple(WATER_TEMPLE.center, WATER_TEMPLE.seabedRow), true);

  // The four existing dials sit on the elevated landing, above solid stairs.
  for (const dial of CORAL_DIALS) {
    assert.equal(waterTempleFoundationTop(dial.column), WATER_TEMPLE.approachRow);
    assert.equal(waterTileAt(world, dial.column + WEST_EXTENSION, dial.row), true);
  }
  for (let col = WATER_TEMPLE.approachEast + 1; col <= WATER_TEMPLE.right; col++) {
    const rise = waterTempleFoundationTop(col) - waterTempleFoundationTop(col - 1);
    assert.ok(rise >= 0 && rise <= 2, 'eastern stairs descend toward the ocean floor');
  }

  // Neighboring breathing vents stay unobstructed.
  for (const ventCol of [-330, -452]) {
    const vent = world.vents.find((v) => Math.floor(v.x / TILE) === ventCol + WEST_EXTENSION);
    assert.ok(vent, `west vent at ${ventCol} remains available`);
    assert.equal(tileAt(world, ventCol + WEST_EXTENSION, groundAt(ventCol + WEST_EXTENSION) - 1), MATERIAL.air);
  }
});

test('water temple braziers emit aqua sanctuary glow and renderer draws the temple and big door', () => {
  const game = createGame();
  const { world } = game;
  const underground = createUndergroundLight();
  const centerTx = WATER_TEMPLE.center + WEST_EXTENSION;
  const deckY = WATER_TEMPLE.deckRow;

  const sources = waterTempleLightSources(world, 1.0);
  assert.equal(sources.length, 6);
  const player = { x: (centerTx + 0.5) * TILE, y: (deckY - 2) * TILE, height: TILE, glowSeconds: 0 };
  const bounds = { left: centerTx - 26, right: centerTx + 26, top: WATER_TEMPLE.topRow - 4, bottom: WATER_TEMPLE.seabedRow + 6 };
  underground.update(world, player, bounds, 1.0);
  const glow = underground.colorAt(centerTx - 8, deckY - 1);
  assert.ok(glow.strength > 0.4);
  assert.equal(glow.r, WATER_TEMPLE_LIGHT.r);
  assert.equal(glow.g, WATER_TEMPLE_LIGHT.g);
  assert.equal(glow.b, WATER_TEMPLE_LIGHT.b);

  const prevPath2D = globalThis.Path2D;
  globalThis.Path2D = class { rect() {} addPath() {} };
  try {
    const noop = () => {};
    const fills = [];
    const arcs = [];
    const gradStops = [];
    const makeCtx = () => ({
      save: noop, restore: noop, scale: noop, rotate: noop, setTransform: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
      quadraticCurveTo: noop, rect: noop, strokeRect: noop, clip: noop, drawImage: noop,
      fill: noop, stroke: noop, translate: noop,
      fillStyle: '#000',
      fillRect(x, y, w, h) { fills.push({ x, y, w, h, fillStyle: this.fillStyle }); },
      arc(x, y, r) { arcs.push({ x, y, r, fillStyle: this.fillStyle }); },
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop(_o, color) { gradStops.push(color); } }),
    });
    const canvas = {
      width: 640,
      height: 360,
      ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) },
      getContext: () => makeCtx(),
    };
    const renderer = createRenderer(canvas);
    game.player.x = (centerTx + 0.5) * TILE;
    game.player.y = (deckY - 2) * TILE;
    const frame = {
      world,
      player: game.player,
      snorkel: null,
      camera: { x: (centerTx + 0.5) * TILE - 320, y: (deckY - 6) * TILE - 180, width: 640, height: 360 },
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
      conditions: { darkness: 0, rain: 0, night: false },
      worldTime: 0.25,
      weatherSeed: 0,
      caveShadowsHidden: true,
      openChestId: null,
    };
    renderer.draw(frame);

    const door = waterTempleDoorBounds(WEST_EXTENSION);
    const doorMidX = door.x + door.width / 2;
    const doorMidY = door.y + door.height / 2;
    assert.ok(arcs.some((a) => Math.abs(a.x - doorMidX) < 1 && Math.abs(a.y - (doorMidY - 2)) < 1 && a.r >= 10), 'renders big door central seal medallion');
    assert.ok(fills.some((f) => f.fillStyle === '#6c9d95' && f.w >= 20), 'renders ornate bronze door cross-bands');
    assert.ok(fills.some((f) => f.fillStyle === '#244656'), 'renders carved temple stone masonry');
    assert.ok(gradStops.some((c) => c.startsWith('rgba(167, 241, 234,')), 'renders aqua brazier light');

    renderer.draw({ ...frame, overview: true });

    // Also render east puzzle wing & smaller puzzle door on the right side of the coral wall.
    const puzzleDoor = waterTemplePuzzleDoorBounds(WEST_EXTENSION);
    const puzzleMidX = puzzleDoor.x + puzzleDoor.width / 2;
    const puzzleMidY = puzzleDoor.y + puzzleDoor.height / 2;
    arcs.length = 0;
    renderer.draw({
      ...frame,
      camera: { x: puzzleMidX - 320, y: puzzleMidY - 180, width: 640, height: 360 },
    });
    assert.ok(arcs.some((a) => Math.abs(a.x - puzzleMidX) < 1 && Math.abs(a.y - puzzleMidY) < 1 && a.r >= 7), 'renders smaller east puzzle door medallion');
  } finally {
    globalThis.Path2D = prevPath2D;
  }
});
