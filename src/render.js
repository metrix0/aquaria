import { drawCaveStructure } from "./cave-structure-art.js";
import { isTrapIntact, swingHead } from "./gameplay/cave-traps.js";
import {
  ISLAND_DEEPSTONE_ROW,
  isDryIslandCave,
  isDungeonMasonry,
} from "./world/island-cave.js";
import { drawCaveEnemy } from "./cave-enemy-art.js";
import { createCharacterRenderer } from "./character.js";
import { MATERIAL, ORE_MATERIALS } from "./content.js";
import { jellyfishShockRadius } from "./gameplay/enemies/jellyfish.js";
import { playerHeadInWater, playerInWater } from "./gameplay/player.js";
import { createHelmetWreckArt } from "./helmet-wreck-art.js";
import { ITEMS } from "./inventory.js";
import {
  TILE_NEIGHBORS,
  hasExposedCaveFloor,
  hasOpenFace,
  isDoorOpen,
  isTreeStanding,
  tileAt,
  waterTileAt,
} from "./world.js";
import {
  COLS,
  ROWS,
  TILE,
  WATER,
  WATER_ROW,
  WEST_EXTENSION,
  clamp,
  deepstoneStartAt,
  groundAt,
  noise,
} from "./world/generation.js";
import { createShipwreckArt } from "./shipwreck-art.js";
import { birdFlightAt } from "./world/birds.js";
import { HELMET_WRECK_COLUMN } from "./world/shipwreck.js";
import {
  caveAmbientAt,
  createCaveLight,
  createSurfaceLight,
} from "./world/lighting.js";

const woodPalette = ["#85604c", "#bc8b62", "#513a3b", "#e3ae72"];

const palettes = {
  [MATERIAL.sand]: ["#c6a56e", "#e0be84", "#9c7a56", "#f0c88b"],
  [MATERIAL.stone]: ["#2f4858", "#3e5b63", "#263b51", "#6d8884"],
  [MATERIAL.deepstone]: ["#262b45", "#42465f", "#1c2138", "#666987"],
  [MATERIAL.reef]: ["#436b6e", "#608781", "#315563", "#8eb096"],
  [MATERIAL.wood]: woodPalette,
  [MATERIAL.workbench]: woodPalette,
  [MATERIAL.bedrock]: ["#192b3e", "#24374a", "#111d2f", "#35485a"],
  [MATERIAL.copper]: ["#35464d", "#bc7659", "#704d4b", "#efae7c"],
  [MATERIAL.iron]: ["#38484f", "#9baaa4", "#586970", "#dde3c9"],
  [MATERIAL.cobalt]: ["#262e52", "#788ae9", "#434f99", "#bdceff"],
  [MATERIAL.soil]: ["#6f594e", "#8e6b51", "#513f46", "#ab8056"],
};

const caveWallFadeDepth = 10;
const firstCaveRows = Array.from({ length: COLS }, (_, x) => {
  const ground = groundAt(x);
  return ground < WATER_ROW ? ground + 1 : ground;
});

const glowCoralBranches = [
  [
    [0, 0],
    [-1, -10],
    [1, -19],
    [-1, -29],
    [2, -40],
    [0, -48],
  ],
  [
    [-1, -8],
    [-10, -13],
    [-14, -22],
    [-13, -30],
  ],
  [
    [-10, -13],
    [-19, -17],
    [-22, -24],
  ],
  [
    [1, -14],
    [10, -19],
    [15, -27],
    [15, -36],
  ],
  [
    [10, -19],
    [21, -22],
    [23, -29],
  ],
  [
    [-1, -27],
    [-8, -33],
    [-9, -41],
  ],
  [
    [1, -36],
    [8, -41],
    [9, -46],
  ],
];

const coralColors = [
  ["#7e4268", "#b0667d", "#da9292"],
  ["#39797e", "#64a394", "#97c7ab"],
  ["#786080", "#a68aa0", "#d3a8a4"],
  ["#74674e", "#a08a61", "#d5ab78"],
];

const fishColors = [
  ["#9c7a56", "#d5ab78", "#f0c88b", "#39797e"],
  ["#315563", "#64a394", "#97c7ab", "#efc27e"],
  ["#7e4268", "#b0667d", "#da9292", "#f0c88b"],
  ["#263b51", "#436b6e", "#8bdfd0", "#f8dca5"],
];

const crabColors = [
  ["#7e4268", "#bc775a", "#df9b6b"],
  ["#85604c", "#c09662", "#e3ae72"],
  ["#513a3b", "#b0667d", "#da9292"],
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const drawCharacter = createCharacterRenderer(ctx);
  const shipwreckArt = createShipwreckArt(canvas, ctx);
  const helmetWreckArt = createHelmetWreckArt(canvas, ctx);
  const glowCoral = makeGlowCoral();
  const caveLight = createCaveLight();
  const surfaceLight = createSurfaceLight();
  const lightCanvas = canvas.ownerDocument.createElement("canvas");
  const lightCtx = lightCanvas.getContext("2d");
  const tileCanvas = canvas.ownerDocument.createElement("canvas");
  tileCanvas.width = tileCanvas.height = TILE;
  const tileCtx = tileCanvas.getContext("2d");
  const caveWallEdges = TILE_NEIGHBORS.map(([dx, dy], index) => {
    const x = dx > 0 ? TILE : 0;
    const y = dy > 0 ? TILE : 0;
    const fade = tileCtx.createLinearGradient(
      x,
      y,
      x - dx * caveWallFadeDepth,
      y - dy * caveWallFadeDepth,
    );
    fade.addColorStop(0.05, "#000f");
    fade.addColorStop(0.45, "#0005");
    fade.addColorStop(1, "#0000");
    return { dx, dy, fade, bit: 1 << index };
  });
  let lightPixels;

  function rect(x, y, w, h, color, context = ctx) {
    context.fillStyle = color;
    context.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function polygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
    for (const [x, y] of points.slice(1))
      ctx.lineTo(Math.round(x), Math.round(y));
    ctx.closePath();
    ctx.fill();
  }

  function gradient(x, y, w, h, stops, from = y, to = y + h) {
    if (w <= 0 || h <= 0) return;
    const color = ctx.createLinearGradient(0, from, 0, Math.max(from + 1, to));
    for (const [position, value] of stops) color.addColorStop(position, value);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function sky(camera, surface, time, { darkness, night, skyProgress, rain }) {
    if (surface <= 0) return;
    const { width } = camera;
    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    const altitude = Math.sin(Math.PI * skyProgress);
    const twilight = clamp(1 - altitude * 3, 0, 1) * (1 - darkness);
    gradient(
      0,
      0,
      width,
      surface,
      [
        [0, "#30485e"],
        [0.43, "#4d6d7a"],
        [0.77, "#788783"],
        [1, "#b0a387"],
      ],
      -camera.y,
      surface,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, surface);
    ctx.clip();
    if (twilight > 0) {
      ctx.globalAlpha = twilight;
      gradient(
        0,
        0,
        width,
        surface,
        [
          [0, "#37465d"],
          [0.56, "#665e71"],
          [0.82, "#a27568"],
          [1, "#c19175"],
        ],
        -camera.y,
        surface,
      );
    }
    if (darkness > 0) {
      ctx.globalAlpha = darkness;
      gradient(
        0,
        0,
        width,
        surface,
        [
          [0, "#10182e"],
          [0.6, "#202f4b"],
          [1, "#455675"],
        ],
        -camera.y,
        surface,
      );
      for (let i = 0; i < 75; i++) {
        const span = width + 12;
        const offset = noise(i, 312) * span - horizontalOffset * 0.12;
        const x = (((offset % span) + span) % span) - 6;
        const y = noise(i, 313) * (WATER - 35) - camera.y;
        const size = i % 9 === 0 ? 2 : 1;
        rect(x, y, size, size, i % 4 === 0 ? "#e0e9dd" : "#9baed5ad");
      }
    }

    const bodyX = Math.round(width * (0.86 - 0.72 * skyProgress));
    if (night) {
      const moonY = Math.round(surface + 12 - 159 * altitude);
      ctx.globalAlpha = darkness * (1 - rain * 0.58);
      for (let row = -12; row < 12; row++) {
        const radius = Math.floor(Math.sqrt(144 - row * row));
        rect(
          bodyX - radius,
          moonY + row,
          radius * 2,
          1,
          row < 5 ? "#e1e7d8" : "#c4d2d0",
        );
      }
      rect(bodyX - 6, moonY - 4, 4, 2, "#b3c3c5");
      rect(bodyX + 3, moonY + 3, 4, 3, "#b3c3c5");
    } else {
      const sunY = Math.round(surface + 20 - 178 * altitude);
      ctx.globalAlpha = 1 - rain * 0.66;
      const glow = ctx.createRadialGradient(bodyX, sunY, 5, bodyX, sunY, 94);
      for (const [position, color] of [
        [0, "#f6cf9299"],
        [0.34, "#eeb87c3c"],
        [1, "#eeb87c00"],
      ])
        glow.addColorStop(position, color);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, surface);
      for (let row = -20; row < 20; row += 2) {
        const radius = Math.floor(Math.sqrt(400 - row * row));
        rect(
          bodyX - radius,
          sunY + row,
          radius * 2,
          2,
          row < 6 ? "#f5d5a3" : "#e8bb8d",
        );
      }
    }

    ctx.globalAlpha = 1 - darkness * 0.65;
    for (let i = -2; i < 18; i++) {
      const span = Math.max(960, width + 260);
      const raw =
        i * 81 +
        noise(i, 12) * 240 -
        horizontalOffset * 0.085 +
        time * (i % 2 ? 0.8 : 1.6);
      const x = (((raw % span) + span) % span) - 130;
      const y = 44 + noise(i, 19) * 153 - camera.y;
      const length = 32 + Math.floor(noise(i, 18) * 115);
      rect(x, y, length, 2, "#d5beaa5e");
      rect(x + length * 0.14, y - 3, length * 0.67, 3, "#c9b6a964");
      rect(x + length * 0.24, y - 6, length * 0.43, 3, "#c9b6a93d");
      rect(x + length * 0.28, y + 4, length * 0.79, 1, "#cdb8a631");
    }
    for (let x = -5; x < width + 10; x += 4) {
      const wx = x + horizontalOffset * 0.21;
      const y =
        surface -
        8 -
        Math.pow(
          Math.max(0, Math.sin(wx * 0.0128) * Math.sin(wx * 0.0049 + 1)),
          2,
        ) *
          30;
      rect(x, y, 4, surface - y + 1, "#5f778067");
      const closer =
        surface -
        3 -
        Math.pow(
          Math.max(0, Math.sin(wx * 0.017 + 1) * Math.cos(wx * 0.008 + 1)),
          2,
        ) *
          20;
      rect(x, closer, 4, surface - closer + 1, "#425e6c9c");
    }
    ctx.restore();
  }

  function surfaceWave(x, time) {
    return Math.round(
      Math.sin(x * 0.062 + time * 1.8) * 1.6 +
        Math.sin(x * 0.026 - time * 1.4) * 1.4,
    );
  }

  function skyBird(camera, flight, opacity) {
    if (!flight || opacity <= 0) return;
    const { age, facing, seagull } = flight;
    const x = Math.round(flight.x) - Math.round(camera.x);
    const y = Math.round(flight.y) - Math.round(camera.y);
    if (x < -12 || x > camera.width + 12 || y < -9 || y > camera.height + 9)
      return;

    const pixel = (dx, dy, width, height, color) =>
      rect(x + (facing < 0 ? -dx - width : dx), y + dy, width, height, color);
    const beat = Math.sin(age * (seagull ? 15 : 28));
    const lift =
      seagull && age % 2.7 > 0.9 ? 2 : Math.round(beat * (seagull ? 5 : 3));
    ctx.save();
    ctx.globalAlpha = flight.opacity * opacity;
    if (seagull) {
      pixel(-6, -2 - Math.round(lift / 2), 8, 2, "#a3adab");
      pixel(-9, 0, 5, 2, "#ccd3c9");
      pixel(-6, -1, 11, 3, "#eeead6");
      pixel(2, -3, 5, 3, "#f6efdb");
      pixel(7, -1, 3, 1, "#d8a45b");
      pixel(5, -2, 1, 1, "#293344");
      pixel(-5, -1 + Math.round(lift / 2), 7, 2, "#bbc5bf");
      pixel(-8, -1 + lift, 6, 2, "#9faeaf");
      pixel(-10, -1 + lift, 3, 2, "#354452");
    } else {
      pixel(-6, 0, 4, 1, "#3e333b");
      pixel(-3, -1, 7, 3, "#644b47");
      pixel(2, -2, 3, 2, "#463943");
      pixel(4, 0, 2, 1, "#c6a174");
      pixel(0, 1, 3, 1, "#b78b6e");
      pixel(-4, -1 + Math.round(lift / 2), 5, 2, "#513e46");
      pixel(-5, -1 + lift, 3, 2, "#3e333b");
    }
    ctx.restore();
  }

  function rainSplashes(impacts, camera, time, intensity) {
    const offset = Math.round(camera.x);
    ctx.save();
    ctx.strokeStyle = "#c3e5e9";
    ctx.lineWidth = 1;
    for (const { tx, y, water } of impacts) {
      const interval = 0.58 + noise(tx, 281) * 0.62;
      const elapsed = time + noise(tx, 282) * interval;
      const strike = Math.floor(elapsed / interval);
      const age = elapsed - strike * interval;
      if (age >= 0.36) continue;

      const x = tx * TILE + 4 + Math.floor(noise(tx, strike, 283) * 8);
      const screenX = x - offset;
      if (screenX < -7 || screenX > camera.width + 7) continue;
      const progress = age / 0.36;
      const spread = 1 + progress * (3 + noise(tx, strike, 284) * 3);
      const rise = Math.sin(progress * Math.PI) * 5;
      const surfaceY = water
        ? y + surfaceWave(x - WEST_EXTENSION * TILE, time)
        : y;
      ctx.globalAlpha = intensity * (1 - progress) * 0.88;
      if (water) {
        ctx.beginPath();
        ctx.ellipse(
          screenX,
          surfaceY,
          spread,
          0.8 + progress,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      rect(screenX - spread, surfaceY - 1 - rise, 1, 2, "#d0e8eb");
      rect(screenX + spread, surfaceY - 1 - rise * 0.7, 1, 2, "#d0e8eb");
    }
    ctx.restore();
  }

  function rain(
    world,
    camera,
    surface,
    time,
    { rain: intensity, rainSlope: slope },
  ) {
    if (intensity <= 0 || surface <= 0) return;
    const { width } = camera;
    const xOffset = Math.round(camera.x);
    const yOffset = Math.round(camera.y);
    const left = Math.floor(xOffset / TILE);
    const right = Math.min(COLS, Math.ceil((xOffset + width) / TILE));
    const impacts = [];
    const bottom = Math.min(
      ROWS,
      Math.ceil((camera.y + camera.height + 5) / TILE),
    );
    let rainBottom = 0;
    ctx.save();
    ctx.beginPath();
    for (let tx = left; tx < right; tx++) {
      let ty = 0;
      while (
        ty <= bottom &&
        !tileAt(world, tx, ty) &&
        !waterTileAt(world, tx, ty)
      )
        ty++;
      const height = ty * TILE - yOffset;
      if (height <= 0) continue;
      ctx.rect(tx * TILE - xOffset, 0, TILE, height);
      rainBottom = Math.max(rainBottom, height);
      if (height <= camera.height + 5)
        impacts.push({ tx, y: height, water: waterTileAt(world, tx, ty) });
    }
    ctx.clip();
    ctx.globalAlpha = intensity * 0.74;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#bed9e0";
    ctx.beginPath();
    // Keep the rain pattern in world coordinates so camera motion only changes what is visible.
    const bandWidth = 64;
    const dropsPerBand = 13;
    const fall = WATER + 28;
    const streakHeight = 12;
    const cutoff = Math.min(rainBottom, camera.height) + streakHeight;
    const topShift = (yOffset - streakHeight) * slope;
    const bottomShift = (yOffset + cutoff) * slope;
    const firstBand = Math.floor(
      (xOffset - Math.max(topShift, bottomShift)) / bandWidth,
    );
    const endBand = Math.ceil(
      (xOffset + width - Math.min(topShift, bottomShift)) / bandWidth,
    );
    for (let band = firstBand; band < endBand; band++) {
      for (let drop = 0; drop < dropsPerBand; drop++) {
        const i = band * dropsPerBand + drop;
        const trackX = (band + noise(i, 271)) * bandWidth - xOffset;
        const speed = 140 + noise(i, 272) * 75;
        const phase = (noise(i, 273) * fall + time * speed) % fall;
        const firstY =
          phase + Math.ceil((yOffset - phase) / fall) * fall - yOffset;
        for (let y = firstY; y < cutoff; y += fall) {
          const x = trackX + (y + yOffset) * slope;
          ctx.moveTo(x - streakHeight * slope, y - streakHeight);
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
    rainSplashes(impacts, camera, time, intensity);
  }

  function waterClips(world, camera, overview) {
    let water, shore;
    const x = Math.round(camera.x);
    const y = Math.round(camera.y);
    const left = Math.floor(x / TILE);
    const right = Math.min(COLS, Math.ceil((x + camera.width) / TILE));
    const top = Math.max(WATER_ROW, Math.floor(y / TILE));
    const bottom = Math.min(ROWS, Math.ceil((y + camera.height) / TILE));
    for (let ty = top; ty < bottom; ty++) {
      let tx = left;
      while (tx < right) {
        if (!waterTileAt(world, tx, ty)) {
          // Give exposed background walls the ocean behind their transparent edges.
          if (
            !overview &&
            ty >= firstCaveRows[tx] &&
            TILE_NEIGHBORS.some(
              ([dx, dy]) =>
                outsideCaveWall(tx + dx, ty + dy) &&
                waterTileAt(world, tx + dx, ty + dy),
            ) &&
            !tileAt(world, tx, ty)
          ) {
            shore ??= new Path2D();
            shore.rect(tx * TILE - x, ty * TILE - y, TILE, TILE);
          }
          tx++;
          continue;
        }
        const start = tx++;
        while (tx < right && waterTileAt(world, tx, ty)) tx++;
        water ??= new Path2D();
        water.rect(start * TILE - x, ty * TILE - y, (tx - start) * TILE, TILE);
      }
    }
    const backdrop = shore ? new Path2D(shore) : water;
    if (shore && water) backdrop.addPath(water);
    return { water, shore, backdrop };
  }

  function tintWater(camera, surface, clip) {
    if (!clip) return;
    ctx.save();
    ctx.clip(clip);
    const start = Math.max(0, surface);
    gradient(
      0,
      start,
      camera.width,
      camera.height - start,
      [
        [0, "#183d4e07"],
        [0.36, "#0a30422b"],
        [1, "#06152666"],
      ],
      surface,
      surface + 980,
    );
    ctx.restore();
  }

  function ocean(camera, surface, time, conditions, water) {
    const { width, height } = camera;
    if (!water) return;
    ctx.save();
    ctx.clip(water);
    gradient(
      0,
      Math.max(0, surface),
      width,
      height - Math.max(0, surface),
      [
        [0, "#307e83"],
        [0.1, "#236a77"],
        [0.24, "#1a4b65"],
        [0.49, "#12364e"],
        [1, "#081927"],
      ],
      surface,
      surface + 850,
    );

    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    for (let band = 0; band < 3; band++) {
      const shift = horizontalOffset * (0.17 + band * 0.17);
      const yShift = surface + 65 + band * 59;
      const color = ["#2c7180a8", "#245e72aa", "#1b4b62ae"][band];
      for (let x = 0; x < width; x += 5) {
        const p = x + shift;
        const y = Math.max(
          0,
          yShift +
            Math.sin(p * 0.015 + band * 1.5) * (18 + band * 9) +
            Math.sin(p * 0.047) * 10,
        );
        if (y < height) rect(x, y, 5, height - y, color);
      }
    }
    if (surface > -200) {
      ctx.globalAlpha =
        1 -
        conditions.darkness * 0.8 -
        conditions.rain * (1 - conditions.darkness) * 0.65;
      for (let i = -2; i < 10; i++) {
        const span = Math.max(width + 190, 900);
        const shift =
          (i * 124 - horizontalOffset * 0.37 + Math.sin(time * 0.5 + i) * 15) %
          span;
        const x = shift + (shift < -170 ? span : 0) - 45;
        polygon(
          [
            [x, surface],
            [x + 16 + noise(i, 5) * 21, surface],
            [x - 57, surface + 224],
            [x - 112, surface + 210],
          ],
          "#b0d8ad12",
        );
        polygon(
          [
            [x + 6, surface],
            [x + 13, surface],
            [x - 49, surface + 182],
            [x - 73, surface + 189],
          ],
          "#b2dad015",
        );
      }
      gradient(
        0,
        Math.max(0, surface),
        width,
        33,
        [
          [0, "#8ed6c15e"],
          [1, "#56a5a100"],
        ],
        surface,
        surface + 33,
      );
      rect(0, surface + 2, width, 2, "#7cc4b1");
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 85; i++) {
      const px = noise(i, 141) * (width + 55);
      const py = noise(i, 128) * (height + 40);
      const x =
        ((((px - horizontalOffset * 0.43 + time * (1 + noise(i, 55) * 4)) %
          (width + 55)) +
          width +
          55) %
          (width + 55)) -
        15;
      const y =
        (((py - camera.y * 0.66 - time * (1 + noise(i, 11) * 2)) %
          (height + 40)) +
          height +
          40) %
        (height + 40);
      rect(x, y, 1 + (i % 9 === 0), 1, i % 5 ? "#a3cfb558" : "#d5e8c7ac");
    }
    for (let i = 0; i < 27; i++) {
      const span = width + 180;
      const x =
        ((((i * 73 - horizontalOffset * 0.55 + time * (i % 2 ? 14 : -11)) %
          span) +
          span) %
          span) -
        90;
      const y =
        surface + 35 + noise(i, 12) * 410 + Math.sin(time * 1.9 + i) * 2;
      if (y < 0 || y > height) continue;
      const size = i % 5 === 0 ? 1.4 : 0.8;
      const direction = i % 2 ? 1 : -1;
      const color = i % 5 === 0 ? "#92bba793" : "#6da3a385";
      rect(x, y, 5 * size, 2, color);
      rect(x + 1, y - 1, 3 * size, 4, color);
      rect(x - direction * 2, y - 1, 2 * size, 4, color);
    }
    ctx.restore();
  }

  function drawTile(world, tx, ty, material, oreOpacity, overview) {
    const x = tx * TILE;
    const y = ty * TILE;
    if (material === MATERIAL.workbench) {
      const [wood, rim, shadow, highlight] = woodPalette;
      rect(x + 2, y + 7, 3, 9, shadow);
      rect(x + 11, y + 7, 3, 9, shadow);
      rect(x + 3, y + 8, 1, 7, rim);
      rect(x + 12, y + 8, 1, 7, rim);
      rect(x + 4, y + 11, 8, 2, wood);
      rect(x, y + 3, 16, 6, shadow);
      rect(x + 1, y + 4, 14, 3, rim);
      rect(x + 2, y + 4, 12, 1, highlight);
      rect(x + 2, y + 7, 12, 1, wood);
      return;
    }
    const ore = ORE_MATERIALS.has(material);
    const rock = ore
      ? ty >= deepstoneStartAt(tx, ty)
        ? MATERIAL.deepstone
        : MATERIAL.stone
      : material;
    const [base, light, dark, bright] = palettes[rock];
    if (overview) {
      rect(x, y, TILE, TILE, oreOpacity > 0.5 ? palettes[material][1] : base);
      return;
    }
    const seed = tx - WEST_EXTENSION;
    const variation = noise(seed, ty, 9);
    const top = !tileAt(world, tx, ty - 1);
    const left = !tileAt(world, tx - 1, ty);
    const right = !tileAt(world, tx + 1, ty);
    rect(x, y, TILE, TILE, base);
    if (material === MATERIAL.wood) {
      rect(x, y + 1, 16, 1, light);
      rect(x, y + 5, 16, 1, dark);
      rect(x, y + 11, 16, 2, dark);
      rect(x + 3, y + 3, 8, 1, bright);
      rect(x + 11, y + 8, 2, 3, dark);
      return;
    }
    for (let i = 0; i < 5; i++) {
      const sx = 1 + Math.floor(noise(seed, ty, i * 2 + 31) * 12);
      const sy = 2 + Math.floor(noise(seed, ty, i * 2 + 32) * 12);
      rect(
        x + sx,
        y + sy,
        1 + Math.floor(noise(seed, ty, i + 51) * 3),
        i % 3 ? 1 : 2,
        i % 2 ? light : dark,
      );
    }
    if (variation < 0.29 && material !== MATERIAL.sand) {
      const h = 3 + Math.floor(variation * 25);
      rect(x + 2, y + h, 9, 1, dark);
      rect(x + 7, y + h + 1, 6, 1, dark);
    }
    if (top) {
      rect(x, y, 16, 2, light);
      rect(
        x + Math.floor(variation * 6),
        y,
        5 + Math.floor(variation * 5),
        1,
        bright,
      );
    }
    if (left) rect(x, y + 2, 1, 14, light);
    if (right) rect(x + 14, y + 2, 2, 14, dark);
    if (rock === MATERIAL.stone || rock === MATERIAL.deepstone) {
      const dryAbove = top && isDryIslandCave(seed, ty - 1);
      const dryBelow = isDryIslandCave(seed, ty + 1);
      if (dryAbove || dryBelow) {
        const rim = rock === MATERIAL.deepstone ? "#6a587d" : "#657a7d";
        const width = 5 + Math.floor(variation * 11);
        const offset = variation < 0.5 ? 0 : TILE - width;
        if (dryAbove) {
          rect(x + offset, y, width, 1, rim);
          rect(x + offset + 2, y + 2, width - 3, 2, light);
        }
        if (dryBelow) {
          rect(x + offset, y + 14, width, 2, light);
          rect(x + offset + 1, y + 15, width - 2, 1, rim);
        }
      }
    }
    if (oreOpacity > 0) {
      const [, mineral, shadow, glint] = palettes[material];
      ctx.globalAlpha = oreOpacity;
      for (let i = 0; i < 3; i++) {
        const px = x + 2 + i * 4;
        const py = y + 3 + Math.floor(noise(seed, ty, 85 + i) * 8);
        const size = i === 1 ? 5 : 4;
        polygon(
          [
            [px, py + 2],
            [px + 2, py],
            [px + size, py + 1],
            [px + size - 1, py + 4],
            [px + 1, py + 5],
          ],
          mineral,
        );
        rect(px + 2, py + 1, size - 2, 1, glint);
        rect(px + 1, py + 4, size - 2, 1, shadow);
      }
      ctx.globalAlpha = 1;
    }
  }

  function coral(x, y, seed) {
    const [shade, mid, tip] =
      coralColors[Math.floor(noise(seed, 2) * coralColors.length)];
    const tall = 8 + Math.floor(noise(seed, 3) * 23);
    rect(x - 4, y - 2, 10, 2, shade);
    rect(x - 1, y - tall, 3, tall, mid);
    rect(x + 1, y - tall + 1, 1, tall - 1, shade);
    rect(x - 1, y - tall - 2, 3, 2, tip);
    for (let i = 0; i < 4; i++) {
      const direction = i % 2 ? 1 : -1;
      const by = y - 5 - Math.floor((i / 5) * tall);
      const width = 3 + Math.floor(noise(seed, i + 4) * 5);
      const height = 3 + Math.floor(noise(seed, i + 9) * 7);
      const bx = direction < 0 ? x - width : x + 1;
      rect(bx, by, width + 1, 2, mid);
      rect(
        bx + (direction > 0 ? width - 1 : 0),
        by - height,
        2,
        height + 1,
        mid,
      );
      rect(bx + (direction > 0 ? width - 1 : 0), by - height, 2, 1, tip);
    }
  }

  function makeGlowCoral() {
    const sprite = canvas.ownerDocument.createElement("canvas");
    sprite.width = 84;
    sprite.height = 84;
    const art = sprite.getContext("2d");
    const glow = art.createRadialGradient(42, 36, 5, 42, 36, 41);
    glow.addColorStop(0, "#46f9ba55");
    glow.addColorStop(0.53, "#2cdfa82d");
    glow.addColorStop(1, "#2cdfa800");
    art.fillStyle = glow;
    art.fillRect(0, 0, sprite.width, sprite.height);
    art.translate(42, 62);
    rect(-8, -3, 16, 3, "#285c5d", art);
    art.lineJoin = "bevel";

    for (const [width, color, offset] of [
      [6, "#245e61", 0],
      [4, "#39af90", 0],
      [1, "#9cf4c8", -1],
    ]) {
      art.lineWidth = width;
      art.strokeStyle = color;
      for (const branch of glowCoralBranches) {
        art.beginPath();
        art.moveTo(branch[0][0] + offset, branch[0][1]);
        for (const [x, y] of branch.slice(1)) art.lineTo(x + offset, y);
        art.stroke();
      }
    }
    for (const branch of glowCoralBranches) {
      const [x, y] = branch.at(-1);
      rect(x - 3, y - 2, 7, 4, "#5bdfae", art);
      rect(x - 2, y - 3, 4, 3, "#d4ffcb", art);
    }
    return sprite;
  }

  function drawGlowCoral(x, y, mirrored) {
    ctx.save();
    ctx.translate(x, y);
    if (mirrored) ctx.scale(-1, 1);
    ctx.drawImage(glowCoral, -42, -62);
    ctx.restore();
  }

  function palm(tree) {
    for (const [i, strip] of tree.trunk.entries()) {
      rect(
        strip.x,
        strip.y,
        strip.width,
        2,
        i % 4 === 0 ? "#7f5b4a" : "#9d7557",
      );
      rect(strip.x, strip.y, 2, 2, "#cca177");
    }
    const topX = tree.x + tree.direction * 14;
    const topY = tree.y - tree.height + 1;
    const paths = [
      [-31, -5, -13],
      [-28, 11, -4],
      [-19, -15, -18],
      [14, -17, -18],
      [31, -5, -11],
      [32, 13, -2],
      [9, 18, 1],
    ];
    for (const [dx, dy, arc] of paths) {
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const px = topX + dx * t;
        const py = topY + dy * t + Math.sin(Math.PI * t) * arc * 0.63;
        rect(px, py, 5 - t * 3, 5 - t * 3, i % 3 ? "#315e52" : "#50795a");
        if (i < 9)
          rect(px + (dx > 0 ? 1 : -1), py + 3, 3, 4 - t * 2, "#294d4a");
      }
    }
    rect(topX - 3, topY, 6, 4, "#745747");
  }

  function outsideCaveWall(tx, ty) {
    return ty < firstCaveRows[tx];
  }

  function caveWall(world, tx, ty, overview) {
    const x = tx * TILE;
    const y = ty * TILE;
    const detail = noise(tx, ty, 91);
    const wet = waterTileAt(world, tx, ty);
    const abyss = ty >= 113;
    const palette = abyss
      ? ["#21253c", "#1d2134", "#313553"]
      : ["#233644", "#1f303d", "#304653"];
    const underground = !wet && ty >= ISLAND_DEEPSTONE_ROW;
    const masonry = underground && isDungeonMasonry(tx - WEST_EXTENSION, ty);
    const [base, shadow, grain] = wet
      ? palette
      : masonry
        ? ["#342941", "#261e34", "#4b3c59"]
        : underground
          ? ["#27253a", "#211e32", "#3a334d"]
          : ["#2b343a", "#232d35", "#3a474b"];
    if (overview) {
      rect(x, y, TILE, TILE, base);
      return;
    }
    let exposedEdges = 0;
    for (const { dx, dy, bit } of caveWallEdges) {
      const neighborX = tx + dx;
      const neighborY = ty + dy;
      // Air below the surface can still have a cave wall behind it.
      if (
        outsideCaveWall(neighborX, neighborY) &&
        !tileAt(world, neighborX, neighborY)
      )
        exposedEdges |= bit;
    }
    const context = exposedEdges ? tileCtx : ctx;
    const tileX = exposedEdges ? 0 : x;
    const tileY = exposedEdges ? 0 : y;
    rect(tileX, tileY, TILE, TILE, base, context);
    if (masonry) {
      // Broken courses have wide blocks and uneven joints.
      const stagger = ty % 2 ? 6 : 13;
      rect(tileX, tileY + 14, TILE, 2, shadow, context);
      if ((tx + ty) % 2 === 0) {
        rect(tileX + stagger, tileY, 2, 15, shadow, context);
        rect(tileX + stagger + 2, tileY + 1, 1, 9, grain, context);
      }
      rect(
        tileX + Math.floor(detail * 7),
        tileY + 2,
        5 + Math.floor(detail * 5),
        2,
        grain,
        context,
      );
      if (detail > 0.77) {
        rect(tileX + 7, tileY + 6, 7, 3, shadow, context);
        rect(tileX + 11, tileY + 9, 3, 2, shadow, context);
      }
    } else if (wet) {
      rect(tileX + Math.floor(detail * 8), tileY + 3, 6, 1, grain, context);
      rect(
        tileX + 2,
        tileY + 10 + Math.floor(detail * 3),
        9,
        2,
        shadow,
        context,
      );
    } else {
      const band =
        Math.sin(tx * 0.47 + ty * 0.51) + Math.sin(tx * 0.15 - ty * 0.27);
      const seam = 5 + Math.round(band * 2);
      if (band > -0.5) {
        rect(
          tileX,
          tileY + seam,
          7 + Math.floor(detail * 8),
          3,
          shadow,
          context,
        );
        rect(
          tileX + 3,
          tileY + seam - 1,
          4 + Math.floor(detail * 6),
          1,
          grain,
          context,
        );
      }
      if (detail > 0.47) {
        const fleck = Math.floor(detail * 12);
        rect(tileX + fleck, tileY + 10, 5, 3, shadow, context);
        rect(tileX + fleck + 2, tileY + 9, 3, 1, grain, context);
      }
    }
    if (exposedEdges) {
      tileCtx.globalCompositeOperation = "destination-out";
      for (const { fade, bit } of caveWallEdges) {
        if (!(exposedEdges & bit)) continue;
        tileCtx.fillStyle = fade;
        tileCtx.fillRect(0, 0, TILE, TILE);
      }
      tileCtx.globalCompositeOperation = "source-over";
      ctx.drawImage(tileCanvas, x, y);
    }

    if (!masonry && detail > 0.69 && tileAt(world, tx, ty - 1)) {
      const length = 4 + Math.floor(detail * 13);
      polygon(
        [
          [x + 2, y],
          [x + 12, y],
          [x + 8, y + length],
        ],
        shadow,
      );
      polygon(
        [
          [x + 2, y],
          [x + 6, y],
          [x + 8, y + length],
        ],
        grain,
      );
    }
    if (detail < 0.72 || !tileAt(world, tx, ty + 1)) return;
    const floor = y + TILE;
    if ((wet && abyss) || (underground && !masonry && detail > 0.94)) {
      polygon(
        [
          [x + 2, floor],
          [x + 5, floor - 8],
          [x + 8, floor],
          [x + 10, floor - 13],
          [x + 14, floor],
        ],
        "#55568e",
      );
      polygon(
        [
          [x + 8, floor],
          [x + 10, floor - 13],
          [x + 11, floor - 6],
        ],
        "#96a5db",
      );
      rect(x + 4, floor - 6, 1, 3, "#a7b2e5");
    } else if (wet) {
      polygon(
        [
          [x + 7, floor],
          [x + 2, floor - 7],
          [x + 4, floor - 11],
          [x + 8, floor - 8],
          [x + 12, floor - 12],
          [x + 15, floor - 8],
          [x + 10, floor],
        ],
        "#406e71",
      );
      rect(x + 3, floor - 9, 2, 2, "#86c4b0");
      rect(x + 11, floor - 10, 2, 3, "#86c4b0");
    } else if (!underground && detail > 0.985) {
      rect(x + 4, floor - 5, 2, 5, "#a98465");
      rect(x + 9, floor - 3, 2, 3, "#a98465");
      rect(x + 2, floor - 7, 6, 3, "#b97658");
      rect(x + 8, floor - 5, 5, 3, "#d7a172");
      rect(x + 4, floor - 7, 2, 1, "#e4ad78");
    }
  }

  function airVent({ x, y }, time) {
    rect(x - 8, y - 4, 16, 4, "#243840");
    rect(x - 5, y - 10, 10, 6, "#395a63");
    rect(x - 7, y - 12, 14, 3, "#64aa9f");
    rect(x - 4, y - 12, 8, 1, "#a4d5b9");
    for (let i = 0; i < 8; i++) {
      const rise = (time * (14 + (i % 3) * 2) + i * 6) % 43;
      const offset = Math.sin(rise * 0.17 + i) * (2 + rise * 0.14);
      const size = (i % 3) + 2;
      rect(x + offset, y - 14 - rise, size, size / 2, "#ade8cc");
      rect(x + offset + size - 1, y - 13 - rise, 1, size / 2, "#61bcae");
    }
  }

  function tileBounds(camera) {
    return {
      left: Math.max(0, Math.floor(camera.x / TILE) - 1),
      right: Math.min(COLS, Math.ceil((camera.x + camera.width) / TILE) + 1),
      top: Math.max(0, Math.floor(camera.y / TILE) - 1),
      bottom: Math.min(ROWS, Math.ceil((camera.y + camera.height) / TILE) + 1),
    };
  }

  function oreOpacityAt(world, player, tx, ty) {
    if (surfaceLight.at(tx, ty) === 1 && hasOpenFace(world, tx, ty, player))
      return 1;
    return clamp((caveLight.at(tx, ty) - 0.1) / 0.45, 0, 1);
  }

  function shadeCaves(world, player, { left, right, top, bottom }, overview) {
    const width = right - left;
    const height = bottom - top;
    if (
      !lightPixels ||
      lightPixels.width !== width ||
      lightPixels.height !== height
    ) {
      lightCanvas.width = width;
      lightCanvas.height = height;
      lightPixels = lightCtx.createImageData(width, height);
      const { data } = lightPixels;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 9;
        data[i + 1] = 16;
        data[i + 2] = 27;
      }
    }
    for (let x = left; x < right; x++) {
      let alpha = (x - left) * 4 + 3;
      for (let y = top; y < bottom; y++, alpha += width * 4) {
        const light = Math.max(surfaceLight.at(x, y), caveLight.at(x, y));
        let ambient = 0;
        if (light < 1)
          ambient = overview
            ? tileAt(world, x, y)
              ? 0
              : 0.34
            : caveAmbientAt(world, player, x, y);
        lightPixels.data[alpha] = (1 - light) * (1 - ambient) * 210;
      }
    }
    lightCtx.putImageData(lightPixels, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      lightCanvas,
      left * TILE,
      top * TILE,
      width * TILE,
      height * TILE,
    );
    ctx.restore();
  }

  function terrain(world, player, camera, time, bounds, openChestId, overview) {
    const { left, right, top, bottom } = bounds;
    shipwreckArt.backdrop(world, bounds);
    helmetWreckArt(bounds);
    for (let x = left; x < right; x++) {
      for (let y = top; y < bottom; y++) {
        const material = tileAt(world, x, y);
        const ore = ORE_MATERIALS.has(material);
        if (overview && material && !ore && material !== MATERIAL.workbench) {
          // At this scale each tile is only a few pixels wide. Paint continuous rock in one pass.
          const start = y;
          while (y + 1 < bottom && tileAt(world, x, y + 1) === material) y++;
          rect(
            x * TILE,
            start * TILE,
            TILE,
            (y - start + 1) * TILE,
            palettes[material][0],
          );
          continue;
        }
        const oreOpacity = ore ? oreOpacityAt(world, player, x, y) : 0;
        if (material) {
          if (overview || !shipwreckArt.timber(world, x, y, material))
            drawTile(world, x, y, material, oreOpacity, overview);
        } else if (y >= firstCaveRows[x]) caveWall(world, x, y, overview);
      }
    }

    shipwreckArt.fittings(world, bounds);
    // Scan beyond the viewport edge so tall colonies and their halos never pop in.
    for (let x = Math.max(0, left - 2); x < Math.min(COLS, right + 2); x++) {
      const y = groundAt(x);
      if (
        y < top - 2 ||
        y > bottom + 4 ||
        !tileAt(world, x, y) ||
        tileAt(world, x, y - 1)
      )
        continue;
      const column = x - WEST_EXTENSION;
      const seed = noise(column, 44);
      const fromChest = column - HELMET_WRECK_COLUMN;
      if (fromChest === -2 || fromChest === 3) {
        drawGlowCoral((x + 0.5) * TILE, y * TILE, fromChest < 0);
      } else if (
        y >= WATER_ROW + 4 &&
        Math.abs(fromChest) > 10 &&
        noise(column, 184) > 0.995
      ) {
        drawGlowCoral((x + 0.5) * TILE, y * TILE, seed > 0.5);
      } else if (y >= WATER_ROW + 1 && seed > 0.79 && Math.abs(fromChest) > 5) {
        coral(x * TILE + 4 + seed * 8, y * TILE, column);
      } else if (y < WATER_ROW - 1 && seed > 0.2) {
        for (let i = 0; i < 4; i++) {
          const bx = x * TILE + 2 + i * 3;
          const h = 2 + Math.floor(noise(column, i, 8) * 5);
          rect(bx, y * TILE - h, 1, h, i % 2 ? "#667654" : "#87915f");
        }
      }
    }
    for (const tree of world.trees) {
      if (
        tree.tx >= left - 2 &&
        tree.tx <= right + 2 &&
        isTreeStanding(world, tree)
      )
        palm(tree);
    }

    const shelterColumn = 53 + WEST_EXTENSION;
    const shelterX = shelterColumn * TILE;
    const shelterY = groundAt(shelterColumn) * TILE;
    if (tileAt(world, shelterColumn, groundAt(shelterColumn))) {
      polygon(
        [
          [shelterX - 13, shelterY],
          [shelterX + 8, shelterY - 28],
          [shelterX + 25, shelterY],
          [shelterX + 13, shelterY - 1],
        ],
        "#536e69",
      );
      polygon(
        [
          [shelterX - 13, shelterY],
          [shelterX + 8, shelterY - 28],
          [shelterX + 5, shelterY],
          [shelterX - 4, shelterY],
        ],
        "#7d9690",
      );
      polygon(
        [
          [shelterX + 6, shelterY],
          [shelterX + 10, shelterY - 17],
          [shelterX + 18, shelterY],
        ],
        "#243a42",
      );
      rect(shelterX + 7, shelterY - 30, 2, 3, "#8d6c52");
    }

    for (const vent of world.vents) {
      if (
        vent.x >= camera.x - TILE &&
        vent.x <= camera.x + camera.width + TILE &&
        vent.y >= camera.y &&
        vent.y <= camera.y + camera.height + 60
      )
        airVent(vent, time);
    }

    for (const structure of world.caveStructures) {
      const { tx, floor } = structure;
      if (
        tx < left - 3 ||
        tx >= right + 3 ||
        floor <= top ||
        floor > bottom + 4
      )
        continue;
      if (!hasExposedCaveFloor(world, structure)) continue;
      ctx.save();
      ctx.beginPath();
      for (let sx = tx - 2; sx <= tx + 2; sx++) {
        for (let sy = floor - 4; sy <= floor + 1; sy++) {
          if (!tileAt(world, sx, sy))
            ctx.rect(sx * TILE, sy * TILE, TILE, TILE);
        }
      }
      ctx.clip();
      drawCaveStructure(
        rect,
        polygon,
        structure,
        (tx + 0.5) * TILE,
        floor * TILE,
      );
      ctx.restore();
    }

    for (const mushroom of world.caveMushrooms) {
      const { tx, floor } = mushroom;
      if (
        tx < left ||
        tx >= right ||
        floor <= top ||
        floor > bottom ||
        !hasExposedCaveFloor(world, mushroom)
      )
        continue;
      const x = (tx + 0.5) * TILE;
      const y = floor * TILE;
      rect(x - 2, y - 8, 3, 8, "#48787a");
      rect(x - 4, y - 11, 7, 2, "#97dced");
      rect(x - 6, y - 9, 11, 2, "#53b9bc");
      rect(x - 5, y - 7, 9, 1, "#b5f6de");
      rect(x + 4, y - 4, 2, 4, "#48787a");
      rect(x + 3, y - 5, 5, 2, "#97dced");
      rect(x - 3, y - 10, 2, 1, "#e2ffee");
    }

    for (const item of world.items) {
      if (item.kind !== "chest" && world.harvested.has(item.id)) continue;
      if (item.x < camera.x - 24 || item.x > camera.x + camera.width + 24)
        continue;
      const { x, y } = item;
      if (item.kind === "kelp") {
        for (let leaf = 0; leaf < 3; leaf++) {
          const stemHeight =
            17 + Math.floor(noise(Math.round(x), leaf, 19) * 14);
          for (let j = 0; j < stemHeight; j += 2) {
            const sway =
              Math.sin(time * 1.25 + j * 0.14 + x * 0.07 + leaf) * j * 0.16;
            const sx = x + (leaf - 1) * j * 0.24 + sway;
            rect(sx, y + 12 - j, 2, 2, leaf % 2 ? "#72a78a" : "#4f947b");
            if (j % 6 === 0 && j > 3) rect(sx - 2, y + 11 - j, 5, 2, "#8fb39a");
          }
        }
      } else if (item.kind === "chest") {
        drawChest(x, y, item.id === openChestId);
      }
    }
  }

  function drawChest(x, y, open) {
    const frame = "#332c30";
    const iron = "#716f65";
    const edge = "#b5aa87";
    if (open) {
      rect(x - 10, y - 11, 20, 11, frame);
      rect(x - 8, y - 9, 16, 8, "#744c3a");
      rect(x - 8, y - 9, 16, 2, "#b38051");
      rect(x - 6, y - 8, 12, 6, "#392a2b");
      rect(x - 11, y - 3, 22, 4, "#2c262b");
      rect(x - 10, y - 3, 20, 1, "#bb8656");
    } else {
      rect(x - 9, y - 8, 18, 2, frame);
      rect(x - 11, y - 6, 22, 7, frame);
      rect(x - 9, y - 6, 18, 5, "#ac7649");
      rect(x - 8, y - 6, 16, 2, "#d0a06a");
      rect(x - 8, y - 2, 16, 1, "#81513d");
      rect(x - 8, y - 6, 2, 5, iron);
      rect(x + 6, y - 6, 2, 5, iron);
    }
    rect(x - 11, y, 22, 8, frame);
    rect(x - 9, y + 1, 18, 6, "#935c3e");
    rect(x - 9, y + 1, 18, 2, "#b27b4c");
    rect(x - 9, y + 5, 18, 1, "#784532");
    for (const band of [-8, 6]) {
      rect(x + band, y + 1, 2, 6, iron);
      rect(x + band, y + 2, 1, 1, edge);
    }
    rect(x - 2, y - 1, 4, 5, "#bc8b56");
    rect(x - 1, y, 2, 1, "#edd09a");
    rect(x, y + 2, 1, 1, frame);
  }

  function arrows(projectiles, camera) {
    for (const arrow of projectiles ?? []) {
      if (arrow.x < camera.x - 16 || arrow.x > camera.x + camera.width + 16)
        continue;
      if (arrow.y < camera.y - 16 || arrow.y > camera.y + camera.height + 16)
        continue;
      ctx.save();
      ctx.translate(Math.round(arrow.x), Math.round(arrow.y));
      ctx.rotate(Math.atan2(arrow.dy, arrow.dx));
      rect(-6, -1, 10, 2, "#85604c");
      rect(-5, -1, 8, 1, "#d29c65");
      rect(-7, -2, 3, 1, "#bed8ba");
      rect(-7, 1, 3, 1, "#7ebcb0");
      polygon(
        [
          [3, -3],
          [8, 0],
          [3, 3],
        ],
        "#6e888a",
      );
      polygon(
        [
          [4, -2],
          [7, 0],
          [4, 1],
        ],
        "#d9e1cf",
      );
      ctx.restore();
    }
  }

  function caveTraps(world, camera, elapsed) {
    for (const trap of world.caveTraps) {
      const x = (trap.tx + 0.5) * TILE;
      const y = (trap.ty + 1) * TILE;
      if (
        x < camera.x - 60 ||
        x > camera.x + camera.width + 60 ||
        y < camera.y - 60 ||
        y > camera.y + camera.height + 60 ||
        !isTrapIntact(world, trap)
      )
        continue;
      if (trap.kind === "swing") {
        const floor = y + 2 * TILE;
        for (const support of [-48, 45]) {
          rect(x + support, y - 16, 4, floor - y + 16, "#5e4e64");
          rect(x + support - 2, floor - 3, 8, 3, "#817287");
        }
        rect(x - 48, y - 16, 97, 4, "#70607b");
        const head = swingHead(trap, elapsed);
        rect(head.anchorX - 7, head.anchorY - 3, 14, 5, "#76617b");
        rect(head.anchorX - 3, head.anchorY - 1, 6, 4, "#b0907e");
        for (let link = 1; link < 11; link++) {
          const t = link / 11;
          rect(
            head.anchorX + (head.x - head.anchorX) * t - 1,
            head.anchorY + (head.y - head.anchorY) * t - 2,
            3,
            4,
            link % 2 ? "#a5979b" : "#5c505d",
          );
        }
        rect(head.x - 5, head.y - 5, 10, 10, "#847482");
        for (const side of [-1, 1]) {
          polygon(
            [
              [head.x, head.y + side * 9],
              [head.x - 3, head.y + side * 4],
              [head.x + 3, head.y + side * 4],
            ],
            "#c2a5a2",
          );
          polygon(
            [
              [head.x + side * 9, head.y],
              [head.x + side * 4, head.y - 3],
              [head.x + side * 4, head.y + 3],
            ],
            "#c2a5a2",
          );
        }
      } else {
        const color = trap.state === "springing" ? "#ed9e6d" : "#9c8b8b";
        rect(x - 10, y - 3, 20, 3, "#514252");
        rect(x - 5, y - 4, 10, 1, "#b09184");
        for (const side of [-1, 1]) {
          const tip = x + side * (trap.state === "spent" ? 2 : 9);
          polygon(
            [
              [x, y - 2],
              [tip, y - 8],
              [tip + side, y - 5],
              [x + side * 6, y - 1],
            ],
            color,
          );
        }
      }
    }
  }

  function mobs(world, camera, time, targetMob) {
    for (const mob of world.mobs ?? []) {
      if (mob.health <= 0 || mob.respawn > 0) continue;
      const marginX = mob.kind === "kraken" ? 480 : 32;
      const marginY = mob.kind === "kraken" ? 2000 : 32;
      if (mob.x < camera.x - marginX || mob.x > camera.x + camera.width + marginX) continue;
      if (mob.y < camera.y - marginY || mob.y > camera.y + camera.height + marginY)
        continue;
      ctx.save();
      ctx.translate(Math.round(mob.x), Math.round(mob.y));
      ctx.save();
      if (mob.hurt > 0 && Math.floor(mob.hurt * 18) % 2 === 0)
        ctx.globalAlpha = 0.6;

      if (mob.kind === "ghost") {
        ctx.scale(mob.facing, 1);
        ctx.globalAlpha *= mob.resident
          ? 0.82
          : Math.min(0.82, mob.remainingLife * 0.45);
        const drift = Math.round(Math.sin(time * 4 + mob.phase) * 3);
        const tail = [
          [-7, -3],
          [-4, 6],
          [-10, 12 + drift],
          [-3, 11],
          [1, 5],
          [6, 1],
          [6, -5],
        ];
        polygon(
          [
            [-9, -8],
            [-4, -14],
            [5, -14],
            [10, -7],
            [8, 4],
            [-2, 15],
            [-12, 15],
          ],
          "#67b8c035",
        );
        polygon(tail, "#64adb3");
        polygon(
          [
            [-6, 1],
            [-2, 5],
            [-9, 12 + drift],
            [-5, 11],
            [3, 5],
            [6, 0],
          ],
          "#97ded1",
        );
        rect(-5, -10, 9, 13, "#9ce0d5");
        rect(-3, -12, 7, 3, "#ccf2df");
        rect(4, -8, 3, 6, "#d5f9e7");
        rect(0, -7, 2, 3, "#26485c");
        rect(4, -7, 2, 3, "#26485c");
        rect(2, -2, 3, 1, "#477f8d");
        rect(-10, 1, 2, 1, "#afeee1");
        rect(-12, 6 + drift, 1, 1, "#a6e9df");
        if (mob.id === "captains-ghost") {
          polygon(
            [
              [-9, -9],
              [-6, -12],
              [-4, -16],
              [4, -16],
              [7, -11],
              [10, -10],
              [6, -8],
              [-5, -8],
            ],
            "#416b79",
          );
          rect(-6, -10, 12, 1, "#b3ede0");
        }
      } else if (mob.kind !== "kraken" && mob.respawnDelay) {
        drawCaveEnemy(ctx, rect, polygon, mob, time);
      } else if (mob.kind === "fish") {
        const [dark, mid, light, stripe] =
          mob.enemyType?.colors ?? fishColors[mob.variant % fishColors.length];
        if (mob.enemyType) ctx.globalAlpha = clamp(mob.remainingLife / 2, 0, 1);
        const swish = Math.round(
          Math.sin(time * (mob.flee > 0 ? 14 : 7.5) + mob.phase) * 1.4,
        );
        ctx.scale(mob.facing, 1);
        ctx.rotate(clamp(mob.dy * 0.003, -0.22, 0.22) * mob.facing);
        rect(-7, -3 + swish, 2, 2, dark);
        rect(-7, 1 + swish, 2, 2, dark);
        rect(-5, -1 + Math.trunc(swish * 0.5), 2, 3, mid);
        rect(-2, -4, 4, 1, dark);
        rect(-1, -3, 4, 1, light);
        rect(-1, 3, 3, 1, dark);
        rect(-3, -2, 8, 5, mid);
        rect(4, -1, 2, 3, mid);
        rect(-2, -2, 6, 1, light);
        rect(-2, 0, 5, 1, stripe);
        rect(-1, 1, 5, 1, light);
        rect(3, -1, 2, 2, "#f1f3e5");
        rect(4, -1, 1, 1, "#192b3e");
        if (mob.enemyType) rect(4, 1, 3, 1, dark);
      } else if (mob.kind === "crab") {
        const [dark, mid, light] = crabColors[mob.variant % crabColors.length];
        const moving = Math.abs(mob.dx) > 2;
        const step = moving
          ? Math.round(Math.sin(time * (mob.flee > 0 ? 22 : 15) + mob.phase))
          : 0;
        const bob = moving ? Math.abs(step) : 0;
        const pinch = Math.sin(time * 2.8 + mob.phase) > 0.65 ? 1 : 0;
        rect(-6, -3 + step, 2, 2, dark);
        rect(-7, -2 - step, 1, 2, dark);
        rect(-5, -2 - step, 1, 2, dark);
        rect(4, -3 - step, 2, 2, dark);
        rect(6, -2 + step, 1, 2, dark);
        rect(4, -2 + step, 1, 2, dark);
        rect(-6 * mob.facing - 1, -6 - bob, 2, 2, mid);
        rect(-7 * mob.facing - 1, -7 - bob + pinch, 2, 1, light);
        rect(5 * mob.facing - 1, -6 - bob, 3, 2, mid);
        rect(6 * mob.facing - 1, -8 - bob + pinch, 2, 2, light);
        rect(-4, -5 - bob, 8, 3, dark);
        rect(-3, -6 - bob, 6, 4, mid);
        rect(-2, -6 - bob, 4, 1, light);
        rect(-3, -2 - bob, 6, 1, "#d8aa6e");
        rect(-2, -8 - bob, 1, 2, "#192b3e");
        rect(1, -8 - bob, 1, 2, "#192b3e");
        rect(-2, -8 - bob, 1, 1, "#f1f3e5");
        rect(1, -8 - bob, 1, 1, "#f1f3e5");
      } else if (mob.kind === "jellyfish") {
        const pulse = Math.round(Math.sin(time * 3.1 + mob.phase));
        const charging = (mob.windup ?? 0) > 0;
        const shocking = (mob.shock ?? 0) > 0;
        if (shocking) {
          const radius = jellyfishShockRadius(mob.shock);
          ctx.save();
          ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 228, 77, 0.14)";
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
          ctx.fill();

          const ringSteps = 24;
          for (let i = 0; i < ringSteps; i++) {
            const a0 = (i / ringSteps) * Math.PI * 2 + time * 4;
            const a1 = ((i + 1) / ringSteps) * Math.PI * 2 + time * 4;
            const r0 = radius + Math.sin(i * 4.7 + time * 36) * 2.5;
            const r1 = radius + Math.sin((i + 1) * 4.7 + time * 36) * 2.5;
            ctx.strokeStyle = i % 2 ? "#38bdf8" : "#ffe44d";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
            ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
            ctx.stroke();
          }

          const bolts = 8;
          for (let b = 0; b < bolts; b++) {
            const baseAngle = (b / bolts) * Math.PI * 2 + Math.floor(time * 22) * 0.45 + mob.phase;
            const cos = Math.cos(baseAngle);
            const sin = Math.sin(baseAngle);
            const px = -sin;
            const py = cos;
            ctx.strokeStyle = b % 2 ? "#38bdf8" : "#ffe44d";
            ctx.lineWidth = b % 2 ? 1.5 : 1.8;
            ctx.beginPath();
            ctx.moveTo(cos * 5, sin * 5);
            const segments = 4;
            for (let s = 1; s <= segments; s++) {
              const dist = 5 + ((radius - 5) * s) / segments;
              const zig = s === segments ? 0 : Math.sin(time * 48 + b * 2.3 + s * 3.1) * 5;
              ctx.lineTo(cos * dist + px * zig, sin * dist + py * zig);
            }
            ctx.stroke();
            if (b % 2 === 0) {
              ctx.strokeStyle = "#fff4a3";
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
          ctx.restore();
        } else if (charging) {
          for (let s = 0; s < 6; s++) {
            const a = (s / 6) * Math.PI * 2 + time * 12;
            const r = 9 + (Math.sin(time * 32 + s) + 1) * 2.5;
            rect(Math.cos(a) * r - 1, Math.sin(a) * r - 1, 2, 2, s % 2 ? "#38bdf8" : "#ffe44d");
          }
        }
        for (let i = 0; i < 4; i++) {
          const baseX = -5 + i * 3;
          const length = 9 + (i % 2) * 3;
          for (let j = 0; j < length; j += 2) {
            const sway = Math.round(
              Math.sin(time * 3.8 + mob.phase + j * 0.42 + i) * 1.6,
            );
            rect(
              baseX + sway,
              2 + j,
              1,
              2,
              charging && (i + j) % 2
                ? (i + j) % 2 ? "#38bdf8" : "#ffe44d"
                : (i + j) % 2
                  ? "#a68aa0"
                  : "#d3a8a4",
            );
          }
        }
        rect(-4, -8, 8, 2, charging || shocking ? (Math.floor(time * 18) % 2 ? "#ffe44d" : "#38bdf8") : "#d3a8a4");
        rect(
          -6 - Math.max(0, pulse),
          -6,
          12 + Math.max(0, pulse) * 2,
          4,
          charging ? "#d3a8a4" : "#a68aa0",
        );
        rect(-7 - pulse, -2, 14 + pulse * 2, 3, "#786080");
        rect(
          -3,
          -5,
          6,
          3,
          charging && Math.floor(time * 16) % 2 ? "#ffe44d" : "#f2c9a0",
        );
        rect(-4, -6, 4, 1, "#f8dca5");
        rect(-6, 1, 3, 1, "#d3a8a4");
        rect(-1, 1, 3, 1, "#d3a8a4");
        rect(4, 1, 3, 1, "#d3a8a4");
        if (charging) {
          for (let i = 0; i < 4; i++) {
            const spark = time * 18 + i * 1.6;
            rect(
              Math.cos(spark) * 10,
              Math.sin(spark) * 8 - 2,
              2,
              2,
              i % 2 ? "#f8dca5" : "#8bdfd0",
            );
          }
        }
      } else if (mob.kind === "squid") {
        ctx.scale(mob.facing, 1);
        ctx.rotate(clamp(mob.dy * 0.0035, -0.25, 0.25) * mob.facing);
        const pulse = Math.sin(time * 5.4 + mob.phase);
        const charging = (mob.windup ?? 0) > 0;
        for (let i = 0; i < 4; i++) {
          const ty = -4 + i * 2;
          const len = i === 1 || i === 2 ? 9 : 7;
          for (let j = 0; j < len; j += 2) {
            const wave = Math.round(
              Math.sin(time * 6.2 + mob.phase + j * 0.5 + i) *
                (1 - pulse * 0.35),
            );
            rect(-4 - j, ty + wave, 2, 1, i % 2 ? "#b0667d" : "#da9292");
          }
        }
        polygon(
          [
            [4, -3],
            [8, -7],
            [10, -2],
          ],
          "#7e4268",
        );
        polygon(
          [
            [4, 3],
            [8, 7],
            [10, 2],
          ],
          "#7e4268",
        );
        rect(-3, -4, 11, 8, "#7e4268");
        rect(-2, -3, 10, 5, "#b0667d");
        rect(7, -2, 4, 4, "#b0667d");
        rect(10, -1, 2, 2, "#da9292");
        rect(0, -3, 6, 1, "#da9292");
        rect(3, -1, 2, 1, "#f0c88b");
        rect(-2, -2, 2, 2, "#f1f3e5");
        rect(-2, -1, 1, 1, "#192b3e");
        if (charging) {
          rect(11, -2, 4, 4, "#b0667d");
          rect(12, -1, 2, 2, "#f8dca5");
        }
      } else if (mob.kind === "shark") {
        ctx.scale(mob.facing, 1);
        ctx.rotate(clamp(mob.dy * 0.0022, -0.18, 0.18) * mob.facing);
        const dashing = (mob.dash ?? 0) > 0;
        const lunging = dashing || (mob.windup ?? 0) > 0;
        const swish = Math.round(
          Math.sin(time * (dashing ? 16 : 6.4) + mob.phase) * 2,
        );
        if (dashing) {
          rect(-23, -3, 6, 1, "#a1d9cb");
          rect(-26, 1, 8, 1, "#a1d9cb");
        }
        polygon(
          [
            [-2, -4],
            [2, -10],
            [5, -4],
          ],
          "#263b51",
        );
        rect(1, -8, 2, 4, "#3e5b63");
        rect(-13, -2 + Math.trunc(swish * 0.5), 4, 4, "#2f4858");
        polygon(
          [
            [-13, -1 + swish],
            [-19, -7 + swish],
            [-15, swish],
          ],
          "#263b51",
        );
        polygon(
          [
            [-13, 1 + swish],
            [-18, 6 + swish],
            [-15, 1 + swish],
          ],
          "#3e5b63",
        );
        rect(-9, -4, 20, 5, "#2f4858");
        rect(11, -3, 4, 3, "#2f4858");
        rect(-6, -4, 16, 1, "#6d8884");
        rect(-7, 1, 18, 3, "#a5bfb9");
        if (lunging) {
          rect(8, 0, 6, 2, "#111d2f");
          rect(8, 2, 5, 2, "#a5bfb9");
          rect(9, 0, 1, 1, "#f1f3e5");
          rect(11, 0, 1, 1, "#f1f3e5");
          rect(10, 1, 1, 1, "#f1f3e5");
          rect(12, 1, 1, 1, "#f1f3e5");
        } else {
          rect(8, 1, 5, 1, "#192b3e");
          rect(9, 1, 1, 1, "#f1f3e5");
          rect(11, 1, 1, 1, "#f1f3e5");
        }
        rect(9, -2, 2, 2, "#111d2f");
        rect(10, -2, 1, 1, lunging ? "#ff9b80" : "#efc27e");
        rect(4, -2, 1, 3, "#192b3e");
        rect(6, -2, 1, 3, "#192b3e");
        polygon(
          [
            [1, 2],
            [-3, 7],
            [4, 3],
          ],
          "#263b51",
        );
      } else if (mob.kind === "kraken") {
        const rage = (mob.windup ?? 0) > 0 || (mob.actionTime ?? 0) > 0;
        const breathe = Math.sin(time * 2.1) * 2;
        const strokeTentacle = (points, width, color) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let p = 1; p < points.length; p++) ctx.lineTo(points[p][0], points[p][1]);
          ctx.stroke();
        };

        // Massive vertical tentacle wall stretching up to surface and down through the seabed/caves.
        ctx.save();
        for (let t = 0; t < 4; t++) {
          const baseX = -30 + t * 9;
          const pts = [[baseX, 16]];
          for (let y = 70; y <= 2200; y += 70) {
            const sway = Math.sin(time * 2.1 + t * 1.4 + y * 0.025) * 6;
            pts.push([baseX + sway, y]);
          }
          strokeTentacle(pts, 9 - t, t % 2 ? "#3d1b36" : "#5a274d");
          for (let i = 1; i < pts.length; i += 2) {
            rect(pts[i][0] - 3, pts[i][1] - 1, 2, 2, "#c9839b");
          }
        }
        const topReach = WATER - mob.y + 4;
        for (let t = 0; t < 2; t++) {
          const baseX = -26 + t * 14;
          const sway = Math.sin(time * 2.6 + t * 2.1) * 6;
          const pts = [
            [baseX, -36],
            [baseX - 6 + sway, topReach * 0.5],
            [baseX - 10 - sway * 0.5, topReach],
          ];
          strokeTentacle(pts, 7, t ? "#491f3d" : "#703156");
        }

        // Dynamic tackle / grab tentacles.
        const reach = mob.tentacleReach ?? 0;
        if (reach > 0 && mob.tentacleTarget) {
          const oy = (mob.tentacleTarget.oy ?? mob.y) - mob.y;
          const tx = -22 + (mob.tentacleTarget.x - mob.x + 22) * reach;
          const ty = oy + (mob.tentacleTarget.y - mob.y - oy) * reach;
          if (mob.attackMode === "tackle") {
            for (const offset of [-10, 10]) {
              const midX = (-22 + tx) * 0.5;
              const midY = oy + (ty - oy) * 0.5 + Math.sin(time * 18 + offset) * 8;
              strokeTentacle([[-22, oy + offset], [midX, midY], [tx, ty + offset * 0.35]], 8, "#491f3d");
              strokeTentacle([[-22, oy + offset], [midX, midY], [tx, ty + offset * 0.35]], 4, "#984b70");
              rect(tx - 3, ty + offset * 0.35 - 3, 6, 6, "#c9839b");
            }
          } else if (mob.attackMode === "grab") {
            const midX = (-22 + tx) * 0.5;
            const midY = oy + (ty - oy) * 0.5 - 12;
            strokeTentacle([[-22, oy], [midX, midY], [tx, ty]], 7, "#3d1b36");
            strokeTentacle([[-22, oy], [midX, midY], [tx, ty]], 3.5, "#833c66");
            if (mob.grabbing) {
              ctx.strokeStyle = "#984b70";
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(tx, ty, 12, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        ctx.restore();

        // Giant kraken head & bulbous mantle.
        polygon([[-18, -32], [-6, -74 + breathe], [22, -74 + breathe], [34, -44], [28, 12], [-22, 16]], "#2d1429");
        polygon([[-14, -28], [-2, -68 + breathe], [18, -68 + breathe], [28, -40], [24, 8], [-18, 12]], "#491f3d");
        polygon([[-8, -32], [2, -60 + breathe], [14, -56 + breathe], [18, -28], [-8, -16]], "#703156");
        polygon([[16, -68 + breathe], [36, -60 + breathe], [30, -44]], "#5a274d");
        polygon([[-26, -38], [-14, -54 + breathe], [-10, -34]], "#5a274d");
        rect(-26, -24, 50, 44, "#491f3d");
        rect(-24, -18, 42, 34, "#703156");
        rect(-16, -12, 26, 18, "#833c66");
        // Glowing eyes and brow ridge.
        rect(-22, -16, 14, 4, "#2d1429");
        rect(-19, -12, 8, 7, "#111d2f");
        rect(-18, -11, 6, 5, rage ? "#ff6b57" : "#f7c96b");
        rect(-17, -10, 2, 3, "#192b3e");
        // Siphon & summon ink flare.
        rect(-30, 2, 10, 10, "#3d1b36");
        if (mob.attackMode === "summon" && (mob.windup ?? 0) > 0) {
          rect(-36, 0, 8, 14, "#0d1017");
          rect(-34, 3, 4, 8, "#833c66");
        }
        // Upper mantle spots.
        rect(4, -50 + breathe, 4, 4, "#984b70");
        rect(12, -38 + breathe, 5, 4, "#984b70");
        rect(-4, -36 + breathe, 3, 3, "#984b70");
      }
      ctx.restore();

      if (
        mob.maxHealth &&
        (mob.health < mob.maxHealth || mob.hurt > 0 || mob === targetMob)
      ) {
        const barWidth = mob.kind === "kraken" ? 56 : mob.maxHealth >= 7 ? 20 : mob.maxHealth >= 4 ? 14 : 10;
        const barX = -Math.floor(barWidth / 2);
        const ghost = mob.kind === "ghost";
        const barY = mob.kind === "kraken"
          ? -82
          : ghost
          ? -21
          : mob.respawnDelay
            ? mob.kind === "spider"
              ? -15
              : -31
            : mob.kind === "crab"
              ? -13
              : mob.kind === "jellyfish"
                ? -13
                : mob.kind === "shark"
                  ? -14
                  : -10;
        const hostile = Boolean(
          ghost ||
          mob.respawnDelay ||
          mob.enemyType ||
          mob.kind === "jellyfish" ||
          mob.kind === "squid" ||
          mob.kind === "shark" ||
          mob.kind === "kraken",
        );
        rect(barX - 1, barY - 1, barWidth + 2, 4, "#111d2f");
        rect(barX, barY, barWidth, 2, "#283c44");
        rect(
          barX,
          barY,
          Math.ceil(barWidth * (mob.health / mob.maxHealth)),
          2,
          hostile ? "#e57866" : "#efc27e",
        );
      }

      ctx.restore();
    }
  }

  function projectiles(world, camera) {
    arrows(
      world.projectiles.filter((entry) => entry.kind === "cave-arrow"),
      camera,
    );
    for (const bubble of world.projectiles) {
      if (bubble.kind === "cave-arrow") continue;
      if (bubble.x < camera.x - 16 || bubble.x > camera.x + camera.width + 16)
        continue;
      if (bubble.y < camera.y - 16 || bubble.y > camera.y + camera.height + 16)
        continue;
      if (bubble.kind === "venom") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, bubble.life * 2);
        rect(bubble.x - 7, bubble.y - 1, 14, 2, "#687745");
        rect(bubble.x - 4, bubble.y - 2, 9, 1, "#b2cc79");
        ctx.restore();
        continue;
      }
      const r = bubble.radius;
      const x = Math.round(bubble.x);
      const y = Math.round(bubble.y);
      rect(x - r - 1, y - r, r * 2 + 2, r * 2, "#040508");
      rect(x - r, y - r - 1, r * 2, r * 2 + 2, "#040508");
      rect(x - r, y - r, r * 2, r * 2, bubble.color);
      rect(x - r + 1, y - r + 1, Math.max(2, r), Math.max(2, r), "#1e232e");
      rect(x - r + 1, y - r + 1, 1, 1, "#4b5263");
    }
  }

  function doors(world, player, camera) {
    const [wood, light, dark, brass] = palettes[MATERIAL.wood];
    for (const door of world.doors.values()) {
      const x = door.tx * TILE;
      const y = (door.ty - 1) * TILE;
      const height = 2 * TILE;
      if (
        x + TILE < camera.x ||
        x > camera.x + camera.width ||
        y + height < camera.y ||
        y > camera.y + camera.height
      )
        continue;
      const open = isDoorOpen(door, player.x, player.y, player.height);
      rect(x, y, TILE, 2, dark);
      rect(x, y + 2, 2, height - 2, dark);
      rect(x + TILE - 2, y + 2, 2, height - 2, dark);
      rect(x + 1, y, TILE - 2, 1, light);
      rect(x + 2, y + 2, open ? 3 : TILE - 4, height - 2, wood);
      rect(x + 2, y + 3, 1, height - 4, light);
      if (!open) {
        rect(x + 6, y + 3, 1, height - 4, dark);
        rect(x + 10, y + 3, 1, height - 4, light);
        rect(x + 2, y + 8, TILE - 4, 2, dark);
        rect(x + 2, y + 23, TILE - 4, 2, dark);
        rect(x + 11, y + 16, 2, 2, brass);
      }
    }
  }

  function surfaceLine(world, camera, y, time) {
    const xOffset = Math.round(camera.x);
    for (let x = 0; x < camera.width; ) {
      const tx = Math.floor((x + xOffset) / TILE);
      const width = Math.min(3, (tx + 1) * TILE - (x + xOffset));
      if (waterTileAt(world, tx, WATER_ROW)) {
        const phase = x + xOffset - WEST_EXTENSION * TILE;
        const dy = surfaceWave(phase, time);
        rect(x, y + dy, width, 1, "#c3e3c7b9");
        if (noise(Math.floor(phase / 5), 9) > 0.68)
          rect(x, y + dy + 4, width, 1, "#a0d5bc93");
      }
      x += width;
    }
  }

  function drawInkSplat(cx, cy, baseR, splat) {
    const lobes = 10;
    const points = [];
    for (let i = 0; i < lobes; i++) {
      const a0 = splat.angle + (i / lobes) * Math.PI * 2;
      const aMid = a0 + Math.PI / lobes;
      const armR = baseR * (0.72 + noise(i * 3, splat.seed) * 0.78);
      const valleyR = baseR * (0.34 + noise(i * 3 + 1, splat.seed) * 0.24);
      points.push({
        ax: cx + Math.cos(a0) * armR,
        ay: cy + Math.sin(a0) * armR,
        vx: cx + Math.cos(aMid) * valleyR,
        vy: cy + Math.sin(aMid) * valleyR,
      });
    }

    ctx.beginPath();
    const last = points[points.length - 1];
    ctx.moveTo((last.vx + points[0].ax) * 0.5, (last.vy + points[0].ay) * 0.5);
    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(curr.ax, curr.ay, curr.vx, curr.vy);
      ctx.quadraticCurveTo(
        curr.vx,
        curr.vy,
        (curr.vx + next.ax) * 0.5,
        (curr.vy + next.ay) * 0.5,
      );
    }
    ctx.closePath();

    for (let k = 0; k < 6; k++) {
      const ang = splat.angle + k * 1.05 + noise(k, splat.seed + 7) * 0.6;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const px = -sin;
      const py = cos;
      const start = baseR * 0.45;
      const len = baseR * (1.2 + noise(k + 10, splat.seed) * 0.95);
      const w0 = baseR * 0.14;
      const w1 = baseR * 0.035;
      ctx.moveTo(cx + cos * start + px * w0, cy + sin * start + py * w0);
      ctx.lineTo(cx + cos * len + px * w1, cy + sin * len + py * w1);
      ctx.arc(
        cx + cos * len,
        cy + sin * len,
        w1,
        ang - Math.PI / 2,
        ang + Math.PI / 2,
      );
      ctx.lineTo(cx + cos * start - px * w0, cy + sin * start - py * w0);
      ctx.closePath();

      const dropDist = len + baseR * (0.22 + noise(k + 17, splat.seed) * 0.25);
      const dropR = baseR * (0.055 + noise(k + 21, splat.seed) * 0.055);
      const dx = cx + cos * dropDist;
      const dy = cy + sin * dropDist;
      ctx.moveTo(dx + dropR, dy);
      ctx.arc(dx, dy, dropR, 0, Math.PI * 2);
    }

    const age = Math.max(0, (splat.duration ?? 4.5) - splat.time);
    for (let d = 0; d < 3; d++) {
      const dripX = cx + (noise(d, splat.seed + 23) - 0.5) * baseR * 1.05;
      const dripTop = cy + baseR * (0.22 + noise(d + 5, splat.seed) * 0.25);
      const dripLen =
        baseR * (0.55 + noise(d + 9, splat.seed) * 0.65) +
        Math.min(age, 3) * baseR * 0.16;
      const stemW = baseR * 0.045;
      const tipR = baseR * (0.085 + noise(d + 13, splat.seed) * 0.04);
      const tipY = dripTop + dripLen;
      ctx.moveTo(dripX - stemW, dripTop);
      ctx.lineTo(dripX + stemW, dripTop);
      ctx.lineTo(dripX + stemW * 0.7, tipY);
      ctx.lineTo(dripX - stemW * 0.7, tipY);
      ctx.closePath();
      ctx.moveTo(dripX + tipR, tipY);
      ctx.arc(dripX, tipY, tipR, 0, Math.PI * 2);
    }

    ctx.fill();
  }

  function inkOverlay(camera, player) {
    const splats = player?.inkSplats;
    if (!splats?.length) return;
    const span = Math.min(camera.width, camera.height);
    ctx.save();
    ctx.fillStyle = "#040508";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = Math.max(25, Math.round(canvas.height * 0.065));

    // Increased offset so the shadow sticks out further
    ctx.shadowOffsetX = Math.max(25, Math.round(canvas.height * 0.024));
    ctx.shadowOffsetY = Math.max(14, Math.round(canvas.height * 0.036));
    for (const splat of splats) {
      const fade = Math.min(1, splat.time / 2);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * 0.95;
      drawInkSplat(
        splat.nx * camera.width,
        splat.ny * camera.height,
        span * 0.18 * (splat.scale ?? 1),
        splat,
      );
    }
    ctx.restore();
  }

  function draw({
    world,
    player,
    snorkel,
    camera,
    time,
    elapsed,
    aim,
    mining,
    miningSwing,
    held,
    attack,
    hasArrow,
    playerArrows,
    targetMob,
    particles,
    reducedMotion,
    conditions,
    worldTime,
    weatherSeed,
    caveShadowsHidden,
    openChestId,
    peers = [],
  }) {
    const scale = canvas.width / camera.width;
    const overview = scale <= 0.25;
    ctx.setTransform(scale, 0, 0, canvas.height / camera.height, 0, 0);
    const surface = WATER - Math.round(camera.y);
    const { water, shore, backdrop } = waterClips(world, camera, overview);
    const bounds = tileBounds(camera);
    caveLight.update(world, player);
    surfaceLight.update(world, player, bounds);
    rect(0, 0, camera.width, camera.height, "#101f33");
    sky(camera, surface, time, conditions);
    if (
      !reducedMotion &&
      surface > 0 &&
      !conditions.night &&
      conditions.rain < 1
    ) {
      skyBird(
        camera,
        birdFlightAt(worldTime, weatherSeed),
        (1 - conditions.darkness) * (1 - conditions.rain),
      );
    }
    ocean(camera, surface, time, conditions, backdrop);
    tintWater(camera, surface, shore);
    if (surface > -5 && surface < camera.height + 5)
      surfaceLine(world, camera, surface, time);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    terrain(world, player, camera, time, bounds, openChestId, overview);
    doors(world, player, camera);
    caveTraps(world, camera, elapsed);
    mobs(world, camera, time, targetMob);
    projectiles(world, camera);
    arrows(playerArrows, camera);
    for (const bit of particles) {
      rect(bit.x, bit.y, 2, 2, bit.color ?? palettes[bit.material][1]);
    }
    for (const remote of peers) {
      if (
        remote.x < camera.x - 16 ||
        remote.x > camera.x + camera.width + 16 ||
        remote.y < camera.y - 25 ||
        remote.y > camera.y + camera.height + 25
      )
        continue;
      drawCharacter(remote, remote.appearance, {
        snorkel: playerHeadInWater(world, remote) ? remote.snorkel : null,
        time,
        reducedMotion,
        swimming: playerInWater(world, remote),
      });
      polygon(
        [
          [remote.x, remote.y - 9],
          [remote.x + 3, remote.y - 6],
          [remote.x, remote.y - 3],
          [remote.x - 3, remote.y - 6],
        ],
        "#a6eee0",
      );
    }
    drawCharacter(player, player.appearance, {
      snorkel: playerHeadInWater(world, player) ? snorkel : null,
      time,
      miningSwing,
      held,
      attack,
      hasArrow,
      reducedMotion,
      swimming: playerInWater(world, player),
    });
    if (!caveShadowsHidden) shadeCaves(world, player, bounds, overview);
    ctx.restore();

    const shade = conditions.darkness * 0.48 + conditions.rain * 0.21;
    if (shade > 0) {
      ctx.save();
      ctx.globalAlpha = shade;
      rect(0, 0, camera.width, camera.height, "#111933");
      ctx.restore();
    }
    rain(world, camera, surface, time, conditions);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    if (aim?.reachable && (mining || !ITEMS[held]?.weapon)) {
      ctx.strokeStyle = "#f4d4a5ad";
      ctx.lineWidth = Math.max(1, 0.75 / scale);
      ctx.strokeRect(
        aim.tx * TILE + 0.5,
        aim.ty * TILE + 0.5,
        TILE - 1,
        TILE - 1,
      );
    }
    if (mining) {
      const x = mining.tx * TILE + 2;
      const y = (mining.ty + 1) * TILE - 5;
      const width = TILE - 4;
      rect(x - 1, y - 1, width + 2, 4, "#1b2733");
      rect(x, y, Math.ceil(width * mining.progress), 2, "#f4d4a5");
    }
    ctx.restore();

    tintWater(camera, surface, water);
    inkOverlay(camera, player);
  }

  return { draw };
}
