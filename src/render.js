import { drawRootGrove } from './root-grove-art.js';
import { drawRootBind, drawRootTrail, rootBindPose } from './root-ring-art.js';
import { drawCaveStructure } from "./cave-structure-art.js";
import { JUNGLE_CAVE_STRUCTURE_KINDS, drawJungleWallGlyphs, jungleStructureBounds } from "./jungle-cave-art.js";
import { drawCannibal, drawJungleVillageStructure, drawNativeShaman } from "./jungle-village-art.js";
import { JUNGLE_CAVE, JUNGLE_DEEPSTONE_ROW, isDryJungleCave, jungleMossProgress, jungleScriptureProgress } from "./world/jungle-cave.js";
import { jungleVillageStructures } from "./world/jungle-village.js";
import { isTrapIntact, swingHead } from "./gameplay/cave-traps.js";
import {
  ISLAND_DEEPSTONE_ROW, ROOT_GROVE, groveMossDistance, groveGroundGrowth, inRootGrove, isGrovePool,
  isDryIslandCave,
  isDungeonMasonry,
} from "./world/island-cave.js";
import { drawCaveEnemy } from "./cave-enemy-art.js";
import { drawCaveAmbienceMob } from './cave-ambient-art.js';
import { createCharacterRenderer } from "./character.js";
import { MATERIAL, ORE_MATERIALS } from "./content.js";
import { jellyfishShockRadius } from "./gameplay/enemies/jellyfish.js";
import { KRAKEN_DEATH_DURATION } from "./gameplay/enemies/kraken.js";
import { caveEnemySpecs, jungleEnemySpecs, mobSpec } from "./gameplay/mobs.js";
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
  JUNGLE_FADE_END_COLUMN,
  JUNGLE_FADE_START_COLUMN,
  ROWS,
  TILE,
  WATER,
  WATER_ROW,
  WEST_EXTENSION,
  clamp,
  isDeepstoneAt,
  firstCaveRockVariant,
  undergroundRockVariant,
  undergroundRockBlendAt,
  groundAt,
  noise,
} from "./world/generation.js";
import { createShipwreckArt } from "./shipwreck-art.js";
import { birdFlightAt } from "./world/birds.js";
import { HELMET_WRECK_COLUMN } from "./world/shipwreck.js";
import { createSurfaceLight } from "./world/lighting.js";
import {
  caveStructureLight,
  createUndergroundLight as createCaveLight,
  fireplaceLightSources,
  undergroundAmbientAt,
} from "./world/underground-lighting.js";
import { atmosphereTint, auroraWorldX, auroraBloomWorldX, hasBackgroundWall, nightShadeAlpha } from "./world/atmosphere.js";
import { lightningAt, lightningAnchor, distantThunderAt } from "./lightning.js";

const woodPalette = ["#85604c", "#bc8b62", "#513a3b", "#e3ae72"];

const palettes = {
  [MATERIAL.sand]: ["#c6a56e", "#e0be84", "#9c7a56", "#f0c88b"],
  [MATERIAL.stone]: ["#2f4858", "#3e5b63", "#263b51", "#6d8884"],
  [MATERIAL.deepstone]: ["#262b45", "#42465f", "#1c2138", "#666987"],
  [MATERIAL.reef]: ["#436b6e", "#608781", "#315563", "#8eb096"],
  [MATERIAL.wood]: woodPalette,
  [MATERIAL.workbench]: woodPalette,
  [MATERIAL.fireplace]: ["#414f55", "#627379", "#2b363b", "#f09c46"],
  [MATERIAL.bedrock]: ["#192b3e", "#24374a", "#111d2f", "#35485a"],
  [MATERIAL.copper]: ["#35464d", "#bc7659", "#704d4b", "#efae7c"],
  [MATERIAL.iron]: ["#38484f", "#9baaa4", "#586970", "#dde3c9"],
  [MATERIAL.cobalt]: ["#262e52", "#788ae9", "#434f99", "#bdceff"],
  [MATERIAL.soil]: ["#6f594e", "#8e6b51", "#513f46", "#ab8056"],
};

const firstCaveTilePalettes = {
  slate: ["#293c49", "#4a626a", "#1c2f40", "#7a8d90"],
  gravel: ["#49585a", "#79847c", "#35454c", "#a1aaa0"],
  earth: ["#514b43", "#766356", "#373e41", "#a18a6b"],
};
// Keep the slate variant in foreground rock, but never paint dark slate squares
// on background walls. The remaining wall patches stay close to base stone.
const firstCaveWallPalettes = {
  gravel: [colorPair("#30383c", "#344e3d"), colorPair("#252f35", "#293f32"), colorPair("#424d4e", "#566d4b")],
  earth: [colorPair("#35383a", "#374b3b"), colorPair("#2a2e35", "#2b3d31"), colorPair("#484b4d", "#5e6b4c")],
};
const undergroundTilePalettes = {
  shale: ["#283147", "#455066", "#20283c", "#65768a"],
  strata: ["#2c2d46", "#49495f", "#24243b", "#6a6b84"],
};
const undergroundWallPalettes = {
  shale: ["#282b3c", "#222334", "#3b4050"],
  strata: ["#2b293c", "#252235", "#41394f"],
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

const JUNGLE_FADE_START_X = (JUNGLE_FADE_START_COLUMN + WEST_EXTENSION) * TILE;
const JUNGLE_FADE_END_X = (JUNGLE_FADE_END_COLUMN + WEST_EXTENSION) * TILE;
const OCEAN_BLUE_STOPS = [
  [0, "#307e83"],
  [0.1, "#236a77"],
  [0.24, "#1a4b65"],
  [0.49, "#12364e"],
  [1, "#081927"],
];
const OCEAN_JUNGLE_STOPS = [
  [0, "#2f8a57"],
  [0.1, "#257348"],
  [0.24, "#1b5938"],
  [0.49, "#123e28"],
  [1, "#081e15"],
];
const TINT_BLUE_STOPS = [
  [0, "#183d4e07"],
  [0.36, "#0a30422b"],
  [1, "#06152666"],
];
const TINT_JUNGLE_STOPS = [
  [0, "#184f2c08"],
  [0.36, "#0d3c222e"],
  [1, "#061f1266"],
];

function parseHexColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) : 255;
  return [r, g, b, a];
}

function toHexByte(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function colorPair(blueHex, jungleHex) {
  return {
    blueHex,
    jungleHex,
    blue: parseHexColor(blueHex),
    jungle: parseHexColor(jungleHex),
  };
}

function mixPair({ blueHex, jungleHex, blue, jungle }, t) {
  if (t <= 0) return blueHex;
  if (t >= 1) return jungleHex;
  const r = toHexByte(blue[0] + (jungle[0] - blue[0]) * t);
  const g = toHexByte(blue[1] + (jungle[1] - blue[1]) * t);
  const b = toHexByte(blue[2] + (jungle[2] - blue[2]) * t);
  if (blue[3] === 255 && jungle[3] === 255) return `#${r}${g}${b}`;
  const a = toHexByte(blue[3] + (jungle[3] - blue[3]) * t);
  return `#${r}${g}${b}${a}`;
}

// Cache the gradient palettes once; terrain tiles reuse these during rendering.
const ROCK_GRADIENT_STEPS = 48;
const rockGradientPalettes = Array.from({ length: ROCK_GRADIENT_STEPS + 1 }, (_, index) =>
  palettes[MATERIAL.stone].map((hex, part) =>
    mixPair(colorPair(hex, palettes[MATERIAL.deepstone][part]), index / ROCK_GRADIENT_STEPS)));
const rockRimGradient = colorPair("#657a7d", "#6a587d");

function jungleMixAt(worldX) {
  const raw = clamp((worldX - JUNGLE_FADE_START_X) / (JUNGLE_FADE_END_X - JUNGLE_FADE_START_X), 0, 1);
  return raw * raw * (3 - 2 * raw);
}

const BAND_COLOR_PAIRS = [
  colorPair("#2c7180a8", "#297a4ca8"),
  colorPair("#245e72aa", "#20643faa"),
  colorPair("#1b4b62ae", "#174e32ae"),
];
const SUNBEAM_WIDE_PAIR = colorPair("#b0d8ad12", "#b8e39a14");
const SUNBEAM_THIN_PAIR = colorPair("#b2dad015", "#a6db9e16");
const SURFACE_GLOW_BLUE = [[0, "#8ed6c15e"], [1, "#56a5a100"]];
const SURFACE_GLOW_JUNGLE = [[0, "#8fe09b5e"], [1, "#489c6300"]];
const SURFACE_TRIM_PAIR = colorPair("#7cc4b1", "#76c786");
const SURFACE_LINE_MAIN_PAIR = colorPair("#c3e3c7b9", "#c4e8b7b9");
const SURFACE_LINE_FOAM_PAIR = colorPair("#a0d5bc93", "#8fd19693");
const MOTE_DIM_PAIR = colorPair("#a3cfb558", "#9fd49958");
const MOTE_BRIGHT_PAIR = colorPair("#d5e8c7ac", "#d3edc0ac");
const FISH_SILHOUETTE_BRIGHT_PAIR = colorPair("#92bba793", "#85bf8e93");
const FISH_SILHOUETTE_DIM_PAIR = colorPair("#6da3a385", "#5b996f85");
const WET_CAVE_PAIRS = [
  colorPair("#233644", "#203830"),
  colorPair("#1f303d", "#1b3029"),
  colorPair("#304653", "#2c493e"),
];
const ABYSS_CAVE_PAIRS = [
  colorPair("#21253c", "#1b2b27"),
  colorPair("#1d2134", "#162420"),
  colorPair("#313553", "#293e37"),
];

const DAY_SKIES = {
  clear: [[0, "#267799"], [.43, "#69aeba"], [.77, "#b7cfb7"], [1, "#f3cf9c"]],
  sunny: [[0, "#168bb9"], [.43, "#59bfd1"], [.77, "#bbdfc5"], [1, "#ffe6a7"]],
  cloudy: [[0, "#3b5468"], [.43, "#607781"], [.77, "#8d9692"], [1, "#b9b2a1"]],
  rose: [[0, "#544e7c"], [.43, "#ac7b91"], [.77, "#d39a8c"], [1, "#f4ba83"]],
};
const NIGHT_SKIES = {
  moonlit: [[0, "#10182e"], [.6, "#202f4b"], [1, "#455675"]],
  starry: [[0, "#0a142c"], [.6, "#1a3154"], [1, "#354e72"]],
  deep: [[0, "#080d1f"], [.6, "#141e37"], [1, "#283350"]],
  aurora: [[0, "#0b1730"], [.6, "#202c4d"], [1, "#334563"]],
  meteors: [[0, "#0b1833"], [.6, "#202f58"], [1, "#344864"]],
};

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
  const colorLightCanvas = canvas.ownerDocument.createElement("canvas");
  const colorLightCtx = colorLightCanvas.getContext("2d");
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
  let colorLightPixels;
  let activeLightningAnchor = null;
  let activeDistantAnchor = null;

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

  function sky(camera, surface, time, { darkness, night, skyProgress, rain, atmosphere, dayAtmosphere, sunIntensity = 1 }, reducedMotion = false) {
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
      DAY_SKIES[dayAtmosphere] ?? DAY_SKIES.clear,
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
        NIGHT_SKIES[atmosphere] ?? NIGHT_SKIES.moonlit,
        -camera.y,
        surface,
      );
      if (atmosphere === "aurora") {
        // Four world-anchored sky washes in overlay blend mode, behind terrain.
        const colors = [
          ["rgba(116,174,255,.78)", "rgba(116,174,255,0)"], // blue
          ["rgba(197,146,255,.80)", "rgba(197,146,255,0)"], // violet
          ["rgba(107,225,238,.77)", "rgba(107,225,238,0)"], // cyan
          ["rgba(145,219,171,.52)", "rgba(145,219,171,0)"], // soft green
        ];
        const worldStart = auroraWorldX(0, camera.x);
        const spacing = 420;
        const radius = 330;
        const y = 95 - camera.y;
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = darkness * (1 - rain * .7) * .64;
        const first = Math.floor((worldStart - radius) / spacing);
        const last = Math.ceil((worldStart + width + radius) / spacing);
        for (let i = first; i <= last; i++) {
          const x = i * spacing - worldStart;
          const [inner, outer] = colors[((i % colors.length) + colors.length) % colors.length];
          const tint = ctx.createRadialGradient(x, y, 0, x, y, radius);
          tint.addColorStop(0, inner);
          tint.addColorStop(1, outer);
          ctx.fillStyle = tint;
          ctx.fillRect(x - radius, 0, radius * 2, surface);
        }
        ctx.restore();
      }
      const stars = atmosphere === "starry" ? 320
        : atmosphere === "meteors" ? 160
        : atmosphere === "deep" ? 36 : 75;
      for (let i = 0; i < stars; i++) {
        const span = width + 12;
        const offset = noise(i, 312) * span - horizontalOffset * 0.12;
        const x = (((offset % span) + span) % span) - 6;
        const y = noise(i, 313) * (WATER - 35) - camera.y;
        const bright = atmosphere === "starry" && i % 79 === 0;
        const twinkle = atmosphere === "starry"
          ? reducedMotion ? .88
            : .76 + .24 * Math.sin(time * (1 + noise(i, 314) * 1.5) + noise(i, 315) * Math.PI * 2)
          : 1;
        ctx.globalAlpha = darkness * (1 - rain * .65) * (bright ? 1 : .83) * twinkle;
        const size = bright || i % (atmosphere === "starry" ? 29 : 9) === 0 ? 2 : 1;
        rect(x, y, size, size, bright ? "#ffffff" : i % 4 === 0 ? "#eaf4ff" : "#c0d5f0");
      }
      if (atmosphere === "aurora") {
        // Layered, slow-moving curtains stay anchored to the sky as the camera pans.
        // Give each curtain its own hue all the way to transparency; a
        // shared green end-stop made even violet/blue curtains turn green.
        const ribbons = [
          ["#7cdcc779", "#7cdcc700"], // a single restrained seafoam curtain
          ["#85b8f584", "#85b8f500"],
          ["#c1a2f48b", "#c1a2f400"],
          ["#80c9e478", "#80c9e400"],
        ];
        ctx.globalAlpha = darkness * (1 - rain * .7);
        for (let band = 0; band < ribbons.length; band++) {
          for (let x = -12; x < width + 12; x += 6) {
            const worldX = auroraWorldX(x, camera.x);
            const wave = Math.sin(worldX * .012 + time * .075 + band * 1.4);
            const ripple = Math.sin(worldX * .032 - time * .045 + band * 2) * 6;
            const y = 32 + band * 20 + wave * (13 + band * 3) + ripple - camera.y;
            const tail = 62 + band * 12 + Math.sin(worldX * .021 + time * .08) * 12;
            gradient(x, y, 6, tail,
              [[0, ribbons[band][0]], [.2, ribbons[band][0]], [1, ribbons[band][1]]], y, y + tail);
          }
        }
      } else if (atmosphere === "meteors") {
        ctx.globalAlpha = darkness * (1 - rain * .7);
        for (let i = 0; i < 5; i++) {
          const span = width + 300;
          const x = (((noise(i, 847) * span + time * (28 + i * 8)) % span) + span) % span - 150;
          const y = 24 + noise(i, 848) * 110 + (x * .17) % 60 - camera.y * .1;
          polygon([[x, y], [x - 33, y - 12], [x - 24, y - 6], [x + 3, y + 2]], "#c6e8ff72");
          rect(x, y, 3, 2, "#ffffff");
        }
      }
    }

    const bodyX = Math.round(width * (0.86 - 0.72 * skyProgress));
    if (night) {
      const moonY = Math.round(surface + 12 - 159 * altitude);
      ctx.globalAlpha = darkness * (1 - rain * 0.58) * (atmosphere === "deep" ? .25 : 1);
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
      ctx.globalAlpha = (1 - rain * 0.66) * (1 - darkness * .85);
      ctx.globalAlpha *= clamp(.65 + sunIntensity * .35, .55, 1.15);
      const glow = ctx.createRadialGradient(bodyX, sunY, 5, bodyX, sunY, 130 * sunIntensity);
      for (const [position, color] of [
        [0, "#ffdea4aa"],
        [0.31, "#ffcb8e36"],
        [1, "#ffca8600"],
      ])
        glow.addColorStop(position, color);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, surface);
      for (let row = -24; row < 24; row += 2) {
        const radius = Math.floor(Math.sqrt(24 * 24 - row * row));
        rect(
          bodyX - radius,
          sunY + row,
          radius * 2,
          2,
          row < 6 ? "#f8dca5" : "#efc692",
        );
      }
    }

    ctx.globalAlpha = (1 - darkness * 0.65) * (atmosphere === "sunny" ? .35 : atmosphere === "cloudy" ? 1.3 : .85);
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

  function makeVerticalGradient(stops, from, to) {
    const color = ctx.createLinearGradient(0, from, 0, Math.max(from + 1, to));
    for (const [position, value] of stops) color.addColorStop(position, value);
    return color;
  }

  function horizontalOceanFadeBounds(camera) {
    return {
      fadeLeft: clamp(JUNGLE_FADE_START_X - camera.x, 0, camera.width),
      fadeRight: clamp(JUNGLE_FADE_END_X - camera.x, 0, camera.width),
    };
  }

  function tintWater(camera, surface, clip) {
    if (!clip) return;
    ctx.save();
    ctx.clip(clip);
    const start = Math.max(0, surface);
    const spanY = camera.height - start;
    const { fadeLeft, fadeRight } = horizontalOceanFadeBounds(camera);
    if (fadeLeft > 0) {
      gradient(0, start, fadeLeft, spanY, TINT_BLUE_STOPS, surface, surface + 980);
    }
    if (fadeRight < camera.width) {
      gradient(fadeRight, start, camera.width - fadeRight, spanY, TINT_JUNGLE_STOPS, surface, surface + 980);
    }
    if (fadeRight > fadeLeft && spanY > 0) {
      const blueGrad = makeVerticalGradient(TINT_BLUE_STOPS, surface, surface + 980);
      const jungleGrad = makeVerticalGradient(TINT_JUNGLE_STOPS, surface, surface + 980);
      const step = 4;
      for (let x = fadeLeft; x < fadeRight; x += step) {
        const w = Math.min(step, fadeRight - x);
        const t = jungleMixAt(camera.x + x + w * 0.5);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = blueGrad;
        ctx.fillRect(x, start, w, spanY);
        ctx.globalAlpha = t;
        ctx.fillStyle = jungleGrad;
        ctx.fillRect(x, start, w, spanY);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function ocean(camera, surface, time, conditions, water) {
    const { width, height } = camera;
    if (!water) return;
    ctx.save();
    ctx.clip(water);
    const start = Math.max(0, surface);
    const spanY = height - start;
    const { fadeLeft, fadeRight } = horizontalOceanFadeBounds(camera);
    if (fadeLeft > 0) {
      gradient(0, start, fadeLeft, spanY, OCEAN_BLUE_STOPS, surface, surface + 850);
    }
    if (fadeRight < width) {
      gradient(fadeRight, start, width - fadeRight, spanY, OCEAN_JUNGLE_STOPS, surface, surface + 850);
    }
    if (fadeRight > fadeLeft && spanY > 0) {
      gradient(fadeLeft, start, fadeRight - fadeLeft, spanY, OCEAN_BLUE_STOPS, surface, surface + 850);
      ctx.fillStyle = makeVerticalGradient(OCEAN_JUNGLE_STOPS, surface, surface + 850);
      const step = 4;
      for (let x = fadeLeft; x < fadeRight; x += step) {
        const w = Math.min(step, fadeRight - x);
        ctx.globalAlpha = jungleMixAt(camera.x + x + w * 0.5);
        ctx.fillRect(x, start, w, spanY);
      }
      ctx.globalAlpha = 1;
    }

    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    for (let band = 0; band < 3; band++) {
      const shift = horizontalOffset * (0.17 + band * 0.17);
      const yShift = surface + 65 + band * 59;
      const pair = BAND_COLOR_PAIRS[band];
      for (let x = 0; x < width; x += 5) {
        const p = x + shift;
        const y = Math.max(
          0,
          yShift +
            Math.sin(p * 0.015 + band * 1.5) * (18 + band * 9) +
            Math.sin(p * 0.047) * 10,
        );
        if (y < height) {
          const color = mixPair(pair, jungleMixAt(camera.x + x + 2.5));
          rect(x, y, 5, height - y, color);
        }
      }
    }
    if (surface > -200) {
      const daylightAlpha =
        1 -
        conditions.darkness * 0.8 -
        conditions.rain * (1 - conditions.darkness) * 0.65;
      ctx.globalAlpha = daylightAlpha;
      for (let i = -2; i < 10; i++) {
        const span = Math.max(width + 190, 900);
        const shift =
          (i * 124 - horizontalOffset * 0.37 + Math.sin(time * 0.5 + i) * 15) %
          span;
        const x = shift + (shift < -170 ? span : 0) - 45;
        const mix = jungleMixAt(camera.x + x);
        polygon(
          [
            [x, surface],
            [x + 16 + noise(i, 5) * 21, surface],
            [x - 57, surface + 224],
            [x - 112, surface + 210],
          ],
          mixPair(SUNBEAM_WIDE_PAIR, mix),
        );
        polygon(
          [
            [x + 6, surface],
            [x + 13, surface],
            [x - 49, surface + 182],
            [x - 73, surface + 189],
          ],
          mixPair(SUNBEAM_THIN_PAIR, mix),
        );
      }
      if (fadeLeft > 0) {
        ctx.globalAlpha = daylightAlpha;
        gradient(0, start, fadeLeft, 33, SURFACE_GLOW_BLUE, surface, surface + 33);
      }
      if (fadeRight < width) {
        ctx.globalAlpha = daylightAlpha;
        gradient(fadeRight, start, width - fadeRight, 33, SURFACE_GLOW_JUNGLE, surface, surface + 33);
      }
      if (fadeRight > fadeLeft) {
        const blueGlow = makeVerticalGradient(SURFACE_GLOW_BLUE, surface, surface + 33);
        const jungleGlow = makeVerticalGradient(SURFACE_GLOW_JUNGLE, surface, surface + 33);
        const step = 4;
        for (let x = fadeLeft; x < fadeRight; x += step) {
          const w = Math.min(step, fadeRight - x);
          const t = jungleMixAt(camera.x + x + w * 0.5);
          ctx.globalAlpha = daylightAlpha * (1 - t);
          ctx.fillStyle = blueGlow;
          ctx.fillRect(x, start, w, 33);
          ctx.globalAlpha = daylightAlpha * t;
          ctx.fillStyle = jungleGlow;
          ctx.fillRect(x, start, w, 33);
        }
      }
      ctx.globalAlpha = daylightAlpha;
      if (fadeRight > fadeLeft) {
        const trim = ctx.createLinearGradient(fadeLeft, 0, fadeRight, 0);
        trim.addColorStop(0, SURFACE_TRIM_PAIR.blueHex);
        trim.addColorStop(1, SURFACE_TRIM_PAIR.jungleHex);
        ctx.fillStyle = trim;
        ctx.fillRect(0, surface + 2, width, 2);
      } else {
        rect(0, surface + 2, width, 2, fadeLeft > 0 ? SURFACE_TRIM_PAIR.blueHex : SURFACE_TRIM_PAIR.jungleHex);
      }
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
      const color = mixPair(i % 5 ? MOTE_DIM_PAIR : MOTE_BRIGHT_PAIR, jungleMixAt(camera.x + x));
      rect(x, y, 1 + (i % 9 === 0), 1, color);
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
      const color = mixPair(
        i % 5 === 0 ? FISH_SILHOUETTE_BRIGHT_PAIR : FISH_SILHOUETTE_DIM_PAIR,
        jungleMixAt(camera.x + x),
      );
      rect(x, y, 5 * size, 2, color);
      rect(x + 1, y - 1, 3 * size, 4, color);
      rect(x - direction * 2, y - 1, 2 * size, 4, color);
    }
    ctx.restore();
  }

  function drawTile(world, tx, ty, material, oreOpacity, overview, time = 0) {
    const x = tx * TILE;
    const y = ty * TILE;
    if (material === MATERIAL.fireplace) {
      rect(x + 1, y + 12, 14, 4, "#2b363b");
      rect(x + 2, y + 11, 12, 3, "#414f55");
      rect(x + 3, y + 11, 10, 1, "#627379");
      rect(x + 3, y + 9, 10, 2, "#4d3324");
      rect(x + 4, y + 8, 8, 2, "#734b34");
      const flicker = Math.round(Math.sin(time * 13 + x) * 1.5);
      rect(x + 4, y + 4 - Math.max(0, flicker), 8, 6 + Math.max(0, flicker), "#d95c48");
      rect(x + 5, y + 2 + Math.min(0, flicker), 6, 7, "#f09c46");
      rect(x + 6, y + 5, 4, 4, "#ffe17d");
      return;
    }
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
      ? isDeepstoneAt(tx, ty)
        ? MATERIAL.deepstone
        : MATERIAL.stone
      : material;
    const rockBlend = undergroundRockBlendAt(tx, ty);
    const mixedRock = rockBlend !== null && (rock === MATERIAL.stone || rock === MATERIAL.deepstone);
    const texture = material === MATERIAL.stone && !(rockBlend > 0)
      ? firstCaveRockVariant(tx, ty) : null;
    const deepTexture = material === MATERIAL.deepstone && rockBlend === 1
      ? undergroundRockVariant(tx, ty) : null;
    const palette = firstCaveTilePalettes[texture] ?? undergroundTilePalettes[deepTexture] ??
      (mixedRock
        ? rockGradientPalettes[Math.round(clamp(rockBlend + (rock === MATERIAL.deepstone ? .035 : -.035), 0, 1) * ROCK_GRADIENT_STEPS)]
        : palettes[rock]);
    const [base, light, dark, bright] = palette;
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
    if (texture === "gravel") {
      for (let i = 0; i < 6; i++) {
        const px = 1 + Math.floor(noise(seed, ty, 151 + i) * 12);
        const py = 2 + Math.floor(noise(seed, ty, 171 + i) * 11);
        rect(x + px, y + py + 1, 3, 2, dark);
        rect(x + px, y + py, 2, 1, i % 3 ? light : bright);
      }
    } else if (texture === "earth") {
      for (let i = 0; i < 3; i++) {
        const px = 1 + Math.floor(noise(seed, ty, 191 + i) * 7);
        const py = 3 + i * 4 + Math.floor(noise(seed, ty, 201 + i) * 2);
        rect(x + px, y + py, 5 + i % 3, 1, i === 1 ? light : dark);
      }
    } else if (texture === "slate") {
      rect(x + 1, y + 5 + Math.floor(variation * 4), 11, 1, dark);
      rect(x + 4, y + 6 + Math.floor(variation * 4), 8, 1, light);
    } else if (deepTexture === "strata" && variation > 0.3) {
      // Thin, subdued deep-rock layers; the ore glints remain much brighter.
      rect(x + 1, y + 5 + Math.floor(variation * 4), 9, 1, dark);
      rect(x + 6, y + 6 + Math.floor(variation * 4), 5, 1, light);
    } else if (deepTexture === "shale" && variation > 0.65) {
      rect(x + 3, y + 4, 6, 1, dark);
      rect(x + 6, y + 5, 5, 1, light);
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
        const rim = mixedRock ? mixPair(rockRimGradient, rockBlend) : rock === MATERIAL.deepstone ? "#6a587d" : "#657a7d";
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

  function jungleTree(tree) {
    for (const [i, strip] of tree.trunk.entries()) {
      rect(
        strip.x,
        strip.y,
        strip.width,
        2,
        i % 5 === 0 ? "#4a3529" : "#6b4c35",
      );
      rect(strip.x + 1, strip.y, 2, 2, "#8a6445");
      if (i % 7 === 0) rect(strip.x, strip.y, 1, 2, "#3c6e47");
    }
    const topStrip = tree.trunk[tree.trunk.length - 1];
    const topX = topStrip ? topStrip.x + Math.floor(topStrip.width / 2) : tree.x;
    const topY = tree.y - tree.height;

    // Hanging jungle vines & wide layered tropical canopy.
    for (const [vx, vlen] of [[-22, 16], [-11, 22], [12, 19], [23, 14]]) {
      rect(topX + vx, topY + 4, 2, vlen, "#2d6a47");
      rect(topX + vx, topY + 6, 1, Math.max(4, vlen - 4), "#438a55");
    }
    for (const [ox, oy, w, h, color] of [
      [-28, -8, 56, 16, "#1e4a35"],
      [-24, -18, 48, 16, "#2d6a47"],
      [-16, -24, 32, 12, "#2d6a47"],
      [-22, -14, 44, 10, "#438a55"],
      [-14, -21, 28, 9, "#438a55"],
      [-10, -23, 20, 5, "#68b064"],
      [-20, -14, 12, 4, "#68b064"],
      [10, -13, 11, 4, "#68b064"],
    ]) {
      rect(topX + ox, topY + oy, w, h, color);
    }
    // Tropical canopy blossoms / fruits.
    rect(topX - 15, topY - 12, 3, 3, "#e07b53");
    rect(topX + 9, topY - 16, 3, 3, "#f0c88b");
    rect(topX - 2, topY - 8, 3, 3, "#e07b53");
  }

  function outsideCaveWall(tx, ty) {
    return ty < firstCaveRows[tx];
  }

  const groveWallColors = [
    colorPair("#2b343a", "#304b3a"),
    colorPair("#232d35", "#263d31"),
    colorPair("#3a474b", "#526b48"),
  ];
  const undergroundWallGradient = [
    colorPair("#2b343a", "#27253a"),
    colorPair("#232d35", "#211e32"),
    colorPair("#3a474b", "#3a334d"),
  ];

  function caveWall(world, tx, ty, overview, time = 0) {
    const x = tx * TILE;
    const y = ty * TILE;
    const detail = noise(tx, ty, 91);
    const wet = waterTileAt(world, tx, ty);
    const abyss = ty >= 113;
    const jungleMix = wet ? jungleMixAt(x + TILE * 0.5) : 0;
    const palette = (abyss ? ABYSS_CAVE_PAIRS : WET_CAVE_PAIRS).map((pair) => mixPair(pair, jungleMix));
    const column = tx - WEST_EXTENSION;
    const jungleCave = !wet && isDryJungleCave(column, ty);
    const underground = !wet && !jungleCave && ty >= ISLAND_DEEPSTONE_ROW;
    const caveRock = !wet && !jungleCave && !underground
      ? firstCaveRockVariant(tx, ty) : null;
    const undergroundBlend = !wet && !jungleCave ? undergroundRockBlendAt(tx, ty) : null;
    const deepTexture = underground && undergroundBlend === 1
      ? undergroundRockVariant(tx, ty) : null;
    const masonry = underground && isDungeonMasonry(column, ty);
    const jungleMoss = jungleCave ? jungleMossProgress(ty) : 0;
    const jungleScripture = jungleCave ? jungleScriptureProgress(ty) : 0;
    const jungleDeep = jungleCave && ty >= JUNGLE_DEEPSTONE_ROW;
    const pool = wet && isGrovePool(column, ty);
    const moss = !underground && !jungleCave && (!wet || pool) && ty > 36
      ? Math.max(0, 1 - groveMossDistance(column, ty) / ROOT_GROVE.wallMossReach) : 0;
    // Broad patches follow the stone grain. Their coverage falls away before the foreground moss does.
    const patch = noise(Math.floor(column / 4), Math.floor(ty / 3), 119) * .7 + detail * .3;
    const tint = moss * (moss > .66 || patch < moss ** 1.5 ? 1 : .18);
    const [base, shadow, grain] = wet && !pool
      ? palette
      : masonry
        ? ["#342941", "#261e34", "#4b3c59"]
        : undergroundBlend !== null && undergroundBlend > 0
          ? (undergroundWallPalettes[deepTexture] ??
            undergroundWallGradient.map((colors) => mixPair(colors, undergroundBlend)))
          : underground
            ? ["#27253a", "#211e32", "#3a334d"]
            : jungleCave
            ? (jungleMoss > 0.36 && detail < 0.25 + jungleMoss * 0.55
              ? (jungleDeep ? ["#213831", "#182924", "#375a47"] : ["#283f33", "#1f322a", "#3f5f45"])
              : jungleDeep
                ? ["#243033", "#192225", "#344748"]
                : ["#2d3337", "#23292e", "#3d4649"])
            : (firstCaveWallPalettes[caveRock] ?? groveWallColors).map((colors) => mixPair(colors, tint));
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
      // Background geology is deliberately muted: it should not compete with ore.
      const firstCaveBackdrop = caveRock !== null;
      context.save();
      if (firstCaveBackdrop) context.globalAlpha *= 0.55;
      const band =
        Math.sin(tx * 0.47 + ty * 0.51) + Math.sin(tx * 0.15 - ty * 0.27);
      const seam = 5 + Math.round(band * 2);
      if (band > (firstCaveBackdrop ? 0.15 : -0.5)) {
        rect(tileX, tileY + seam, 7 + Math.floor(detail * 8),
          firstCaveBackdrop ? 1 : 3, shadow, context);
        rect(tileX + 3, tileY + seam - 1, 4 + Math.floor(detail * 6),
          1, grain, context);
      }
      if (detail > (firstCaveBackdrop ? 0.74 : 0.47)) {
        const fleck = Math.floor(detail * 12);
        rect(tileX + fleck, tileY + 10, firstCaveBackdrop ? 3 : 5,
          firstCaveBackdrop ? 1 : 3, shadow, context);
        rect(tileX + fleck + 2, tileY + 9, 3, 1, grain, context);
      }
      if (caveRock === "gravel") {
        for (let i = 0; i < 3; i++) {
          const px = 2 + Math.floor(noise(tx, ty, 251 + i) * 10);
          const py = 2 + Math.floor(noise(tx, ty, 261 + i) * 11);
          rect(tileX + px, tileY + py + 1, 2, 1, shadow, context);
          rect(tileX + px, tileY + py, 2, 1, grain, context);
        }
      } else if (caveRock === "earth") {
        rect(tileX + 2, tileY + 3 + Math.floor(detail * 3), 8, 1, shadow, context);
        rect(tileX + 5, tileY + 11, 6, 1, grain, context);
      } else if (deepTexture === "strata" && detail > 0.3) {
        rect(tileX + 2, tileY + 4 + Math.floor(detail * 4), 10, 1, shadow, context);
        rect(tileX + 7, tileY + 10, 5, 1, grain, context);
      } else if (deepTexture === "shale" && detail > 0.55) {
        rect(tileX + 3, tileY + 6, 7, 1, shadow, context);
      }
      context.restore();
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

    if (jungleCave && ty >= JUNGLE_CAVE.scriptureStartRow && !masonry && !exposedEdges &&
        noise(Math.floor(tx / 2), ty, 313) < 0.11 && noise(tx, ty, 319) < 0.72) {
      drawJungleWallGlyphs(rect, x, y, tx, ty, 0.36 + jungleScripture * 0.34, overview ? 0 : time);
    }

    if (!masonry && detail > 0.69 && tileAt(world, tx, ty - 1)) {
      const width = 3 + Math.floor(noise(tx, ty, 93) * 10);
      const variation = noise(tx, ty, 94);
      const length = 4 + Math.floor(variation ** 2 * (tileAt(world, tx, ty + 1) ? 11 : 36));
      polygon(
        [
          [x + 2, y],
          [x + 2 + width, y],
          [x + 2 + width * .62, y + length],
        ],
        shadow,
      );
      polygon(
        [
          [x + 2, y],
          [x + 2 + width * .34, y],
          [x + 2 + width * .62, y + length],
        ],
        grain,
      );
    }
    if (!wet && !underground && detail < .085 && !inRootGrove(tx - WEST_EXTENSION, ty) &&
        tileAt(world, tx, ty - 1) && tileAt(world, tx + 1, ty)) {
      polygon([[x+1,y+1],[x+15,y+1],[x+15,y+14],[x+12,y+8],[x+7,y+7]], '#a4aeb36c');
      polygon([[x+2,y+1],[x+12,y+5],[x+15,y+12],[x+14,y+5]], '#d4ddd7ad');
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

  function shadeUnderground(world, player, { left, right, top, bottom }, overview, darkness = 0) {
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
      colorLightCanvas.width = width;
      colorLightCanvas.height = height;
      colorLightPixels = colorLightCtx.createImageData(width, height);
      const { data } = lightPixels;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 7;
        data[i + 1] = 12;
        data[i + 2] = 22;
      }
    }
    for (let x = left; x < right; x++) {
      let pixel = (x - left) * 4;
      for (let y = top; y < bottom; y++, pixel += width * 4) {
        const naturalLight = surfaceLight.at(x, y) * (hasBackgroundWall(x, y) ? .22 : 1) * (tileAt(world, x, y) ? 1 - clamp(darkness, 0, 1) * .68 : 1);
        const light = Math.max(naturalLight, caveLight.at(x, y));
        let ambient = 0;
        if (light < 1)
          ambient = overview
            ? tileAt(world, x, y)
              ? 0
              : 0.34
            : undergroundAmbientAt(world, player, x, y);
        const color = caveLight.colorAt(x, y);
        const shadowTint = color.strength * 0.45;
        lightPixels.data[pixel] = Math.round(7 + (color.r - 7) * shadowTint);
        lightPixels.data[pixel + 1] = Math.round(12 + (color.g - 12) * shadowTint);
        lightPixels.data[pixel + 2] = Math.round(22 + (color.b - 22) * shadowTint);
        lightPixels.data[pixel + 3] = (1 - light) * (1 - ambient) * 218;
        colorLightPixels.data[pixel] = color.r;
        colorLightPixels.data[pixel + 1] = color.g;
        colorLightPixels.data[pixel + 2] = color.b;
        colorLightPixels.data[pixel + 3] = Math.round(color.strength * 135);
      }
    }
    lightCtx.putImageData(lightPixels, 0, 0);
    colorLightCtx.putImageData(colorLightPixels, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      lightCanvas,
      left * TILE,
      top * TILE,
      width * TILE,
      height * TILE,
    );
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(
      colorLightCanvas,
      left * TILE,
      top * TILE,
      width * TILE,
      height * TILE,
    );
    ctx.restore();
  }

  function drawCaveStructureLights(world, { left, right, top, bottom }, time, overview, reducedMotion) {
    const lightTime = overview || reducedMotion ? 0 : time;
    const structures = world.caveStructures ?? [];
    const fireplaces = fireplaceLightSources(world, lightTime);
    if (!structures.length && !fireplaces.length) return;
    const margin = 8;
    const drawStructureGlow = (tx, floor, emitter) => {
      if (
        tx < left - margin ||
        tx >= right + margin ||
        floor < top - margin ||
        floor > bottom + margin
      ) {
        return;
      }
      const cx = (tx + 0.5) * TILE + emitter.offsetX;
      const cy = floor * TILE + emitter.offsetY;
      const flicker = overview || reducedMotion
        ? 1
        : 0.94 + Math.sin(time * 8.3 + tx * 1.7 + floor * 0.9) * 0.06;
      const radius = emitter.radius * flicker;
      const inBfsGrid =
        caveLight.colorAt(tx, Math.max(0, floor - 2)).strength > 0 ||
        caveLight.colorAt(tx, Math.max(0, floor - 1)).strength > 0;
      const reachTiles = Math.ceil(radius / TILE);
      ctx.save();
      ctx.beginPath();
      for (let sx = tx - reachTiles; sx <= tx + reachTiles; sx++) {
        if (sx < 0 || sx >= COLS) continue;
        for (let sy = floor - reachTiles - 2; sy <= floor + reachTiles - 1; sy++) {
          if (sy < 0 || sy >= ROWS) continue;
          if (tileAt(world, sx, sy) && !hasOpenFace(world, sx, sy)) continue;
          if (inBfsGrid && caveLight.colorAt(sx, sy).strength <= 0) continue;
          ctx.rect(sx * TILE, sy * TILE, TILE, TILE);
        }
      }
      ctx.clip();
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      glow.addColorStop(0, `rgba(${emitter.r}, ${emitter.g}, ${emitter.b}, ${(emitter.alpha * flicker).toFixed(3)})`);
      glow.addColorStop(0.35, `rgba(${emitter.r}, ${emitter.g}, ${emitter.b}, ${(emitter.alpha * 0.45 * flicker).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${emitter.r}, ${emitter.g}, ${emitter.b}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const structure of structures) {
      const emitter = caveStructureLight(structure, lightTime);
      if (!emitter || !hasExposedCaveFloor(world, structure)) continue;
      drawStructureGlow(structure.tx, structure.floor, emitter);
    }
    for (const fire of fireplaces) {
      drawStructureGlow(fire.tx, fire.floor, fire.emitter);
    }
    ctx.restore();
  }

  function fillAtmosphereBand(left, width, fadeTop, fadeBottom, height, r, g, b, alpha) {
    if (alpha <= 0 || fadeBottom <= 0) return;
    if (fadeTop >= height) {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(left, 0, width, height);
      return;
    }
    if (fadeTop > 0) {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(left, 0, width, fadeTop);
    }
    const start = Math.max(0, fadeTop);
    const end = Math.min(height, fadeBottom);
    if (end > start) {
      const grad = ctx.createLinearGradient(0, fadeTop, 0, fadeBottom);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(left, start, width, end - start);
    }
  }

  function shadeAtmosphere(camera, conditions, time, flash = 0) {
    // Release the entire scene from its storm grade and darkness during a flash.
    const gradeStrength = 1 - clamp(flash, 0, 1) * .46;
    if (gradeStrength <= 0) return;
    const first = Math.floor(camera.x / TILE);
    const last = Math.ceil((camera.x + camera.width) / TILE);
    const nightAlpha = nightShadeAlpha(conditions) * gradeStrength;
    // Grade open sky, surface terrain, and water while fading out at the underground wall boundary
    // so deep caves and caveStructureLight stay consistent across day, night, storm, and thunder.
    ctx.save();
    for (let tx = first; tx <= last; tx++) {
      const ground = groundAt(clamp(tx, 0, COLS - 1));
      const wallStartRow = ground + (ground < WATER_ROW ? 1 : 0);
      const fadeTop = Math.round(wallStartRow * TILE - camera.y);
      const fadeBottom = fadeTop + TILE * 2;
      if (fadeBottom <= 0) continue;
      const left = Math.round(tx * TILE - camera.x);
      const width = Math.round((tx + 1) * TILE - camera.x) - left;
      const tint = atmosphereTint(conditions, jungleMixAt((tx + .5) * TILE), time);
      if (tint.alpha > 0) {
        ctx.globalCompositeOperation = "overlay";
        fillAtmosphereBand(left, width, fadeTop, fadeBottom, camera.height, tint.r, tint.g, tint.b, tint.alpha * gradeStrength);
      }
      if (nightAlpha > 0) {
        ctx.globalCompositeOperation = "source-over";
        fillAtmosphereBand(left, width, fadeTop, fadeBottom, camera.height, 4, 8, 21, nightAlpha);
      }
    }
    ctx.restore();
  }


  // Sparkles belong to the sky layer, before ocean, terrain and characters:
  // they must never be painted over solid blocks or foreground scenery.
  function starlight(camera, surface, time, conditions, reducedMotion) {
    if (conditions.atmosphere !== "starry" || conditions.darkness <= 0 || surface <= 0) return;
    const { width, height } = camera;
    const span = width + 12;
    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, Math.min(surface, height));
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 320; i += 79) {
      const offset = noise(i, 312) * span - horizontalOffset * .12;
      const x = (((offset % span) + span) % span) - 6;
      const y = noise(i, 313) * (WATER - 35) - camera.y;
      if (y < -14 || y > Math.min(surface, height) + 14) continue;
      const pulse = reducedMotion ? .83
        : .72 + .28 * Math.sin(time * (1 + noise(i, 314) * 1.5) + noise(i, 315) * Math.PI * 2);
      ctx.globalAlpha = conditions.darkness * (1 - conditions.rain * .65) * pulse;
      const large = i % 158 === 0;
      const radius = large ? 6 : 4;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
      halo.addColorStop(0, "#ffffffbd");
      halo.addColorStop(.24, "#d4eaff65");
      halo.addColorStop(1, "#9bbfff00");
      ctx.fillStyle = halo;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      const arm = large ? 2 : 1;
      rect(x - arm, y, arm * 2 + 1, 1, "#e4f2ff");
      rect(x, y - arm, 1, arm * 2 + 1, "#e4f2ff");
      rect(x, y, 1, 1, "#ffffff");
    }
    ctx.restore();
  }

  // Aurora illumination is composited after night shading, reaching nearby
  // surface terrain and the player without brightening deep underground caves.
  function auroraLight(camera, surface, time, conditions) {
    if (conditions.atmosphere !== "aurora" || conditions.darkness <= 0 || surface < -60) return;
    const { width, height } = camera;
    const reach = Math.min(height, surface + 135);
    if (reach <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, reach);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = conditions.darkness * (1 - conditions.rain * .7)
      * (.70 + Math.sin(time * .07) * .06);
    const colors = [
      ["rgba(117,180,250,.24)", "rgba(104,170,237,.08)", "rgba(103,161,231,0)"],
      ["rgba(178,151,255,.26)", "rgba(150,138,239,.09)", "rgba(134,119,234,0)"],
      ["rgba(112,210,210,.25)", "rgba(92,180,216,.08)", "rgba(87,174,224,0)"],
      ["rgba(125,213,167,.12)", "rgba(107,187,159,.04)", "rgba(98,178,149,0)"],
    ];
    const worldStart = auroraWorldX(0, camera.x);
    const spacing = 420;
    const radius = 260;
    const y = 95 - camera.y;
    const first = Math.floor((worldStart - radius - 24) / spacing);
    const last = Math.ceil((worldStart + width + radius + 24) / spacing);
    for (let i = first; i <= last; i++) {
      const x = auroraBloomWorldX(i, time) - worldStart;
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius);
      if (right <= left) continue;
      const [inner, middle, outer] = colors[((i % colors.length) + colors.length) % colors.length];
      const bloom = ctx.createRadialGradient(x, y, 0, x, y, radius);
      bloom.addColorStop(0, inner);
      bloom.addColorStop(.46, middle);
      bloom.addColorStop(1, outer);
      ctx.fillStyle = bloom;
      ctx.fillRect(left, 0, right - left, reach);
    }
    ctx.restore();
  }

  // Clip post-darkness lightning to the actual sky silhouette. This keeps
  // the bolt brilliant without painting through islands, players or sea.
  function clipStormSky(camera) {
    const left = Math.floor(camera.x / TILE) - 1;
    const right = Math.ceil((camera.x + camera.width) / TILE) + 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(camera.width, 0);
    for (let tx = right; tx >= left; tx--) {
      const y = clamp(Math.min(WATER, groundAt(tx) * TILE) - camera.y, 0, camera.height);
      ctx.lineTo((tx + 1) * TILE - camera.x, y);
      ctx.lineTo(tx * TILE - camera.x, y);
    }
    ctx.closePath();
    ctx.clip();
  }

  // Distant sheet lightning: an independent, dim blue flash with no bolt.
  function drawDistantThunder(camera, distant, anchor) {
    if (!distant?.flash || !anchor || WATER - camera.y < 60) return;
    const x = anchor.worldX - camera.x;
    const y = clamp(anchor.worldTop + 40 - camera.y, 0, camera.height);
    const radius = Math.max(170, Math.min(440, camera.width * .53));
    ctx.save();
    clipStormSky(camera);
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, "rgba(193,219,255,.67)");
    glow.addColorStop(.34, "rgba(143,177,228,.37)");
    glow.addColorStop(1, "rgba(103,135,192,0)");
    ctx.globalAlpha = distant.flash;
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  // Visible strokes are rendered AFTER night grading but masked to open sky.
  // Their anchor remains in world coordinates even when the camera moves.
  function drawStormLightning(camera, strike, anchor, seed) {
    if (!strike?.flash || !anchor || WATER - camera.y < 60) return;
    const x = anchor.worldX - camera.x;
    const top = anchor.worldTop - camera.y;
    const bottom = anchor.worldBottom - camera.y;
    if (bottom - top < 45) return;
    ctx.save();
    clipStormSky(camera);
    ctx.globalCompositeOperation = "screen";
    const centerY = clamp((top + bottom) * .5, 0, camera.height);
    const radius = Math.max(115, Math.min(270, camera.width * .32));
    const glow = ctx.createRadialGradient(x, centerY, 0, x, centerY, radius);
    glow.addColorStop(0, "rgba(225,242,255,.79)");
    glow.addColorStop(.28, "rgba(145,192,245,.35)");
    glow.addColorStop(1, "rgba(99,158,225,0)");
    ctx.globalAlpha = strike.flash * (.7 + strike.distance * .22);
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, centerY - radius, radius * 2, radius * 2);

    if (strike.bolt > 0) {
      const points = [];
      const drift = (noise(strike.event, 864, seed) - .5) * 35;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const jag = (noise(strike.event * 47 + i, 865, seed) - .5) * 26;
        points.push([x + drift * t + jag * Math.sin(Math.PI * t),
          top + (bottom - top) * t]);
      }
      const trace = (path, width, color, blur) => {
        ctx.beginPath();
        ctx.moveTo(...path[0]);
        for (let i = 1; i < path.length; i++) ctx.lineTo(...path[i]);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.shadowColor = "#9dcfff";
        ctx.shadowBlur = blur;
        ctx.stroke();
      };
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = strike.bolt * (.85 + strike.distance * .15);
      trace(points, 10, "rgba(98,164,240,.29)", 20);
      trace(points, 4.4, "rgba(167,216,255,.9)", 11);
      trace(points, 2, "#ffffff", 5);
      for (const [start, direction] of [[3, -1], [6, 1], [9, -1]]) {
        const fork = [points[start]];
        for (let i = 1; i <= 3; i++) {
          const p = points[start + i];
          fork.push([p[0] + direction * i *
            (6 + noise(strike.event + start + i, 866, seed) * 7), p[1] - i * 3]);
        }
        trace(fork, 2.1, "rgba(173,214,255,.72)", 6);
        trace(fork, 1, "#e9f6ff", 3);
      }
    }
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
        if (overview && material && !ore && material !== MATERIAL.workbench && material !== MATERIAL.fireplace) {
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
            drawTile(world, x, y, material, oreOpacity, overview, time);
          if (ore && !overview && (player.addons?.chest === 'prospectors-brooch' || (player.skillBonuses?.ore ?? 0) > 0) &&
              Math.hypot(x + .5 - player.x / TILE,
                y + .5 - (player.y + player.height / 2) / TILE) <= Math.max(player.addons?.chest === 'prospectors-brooch' ? 12 : 0, player.skillBonuses?.ore ?? 0)) {
            const pulse = 0.4 + Math.sin(time * 2 + x * .7 + y * .6) * .15;
            ctx.save();
            ctx.globalAlpha = pulse;
            const glint = material === MATERIAL.copper ? '#ffcf89'
              : material === MATERIAL.iron ? '#c4f1f4' : '#b2c5ff';
            rect(x * TILE + 5, y * TILE + 5, 4, 2, glint);
            rect(x * TILE + 7, y * TILE + 3, 1, 6, glint);
            ctx.restore();
          }
          const column = x - WEST_EXTENSION;
          if (y > 36 && y < ISLAND_DEEPSTONE_ROW && Math.abs(column - ROOT_GROVE.column) < ROOT_GROVE.mossReach &&
              TILE_NEIGHBORS.some(([dx, dy]) => isDryIslandCave(column + dx, y + dy) && !tileAt(world, x + dx, y + dy))) {
            const moss = groveGroundGrowth(column, y);
            if (moss > .06 && noise(column, y, 173) < moss) {
              rect(x * TILE, y * TILE, TILE, TILE, moss > .77 ? '#5ea55483' : moss > .55 ? '#5d954b51' : '#5f7d402e');
            }
          } else if (y >= JUNGLE_CAVE.mossStartRow &&
              TILE_NEIGHBORS.some(([dx, dy]) => isDryJungleCave(column + dx, y + dy) && !tileAt(world, x + dx, y + dy))) {
            const moss = jungleMossProgress(y);
            if (moss > .08 && noise(column, y, 277) < 0.14 + moss * 0.72) {
              rect(x * TILE, y * TILE, TILE, TILE, moss > .62 ? '#4d8a4966' : '#5382463d');
            }
          }
        } else if (y >= firstCaveRows[x]) caveWall(world, x, y, overview, time);
      }
    }

    for (const { tx, top: start, bottom: end, kind } of world.caveClimbs ?? []) {
      if (tx < left || tx >= right || start >= bottom || end < top) continue;
      const x = (tx + .5) * TILE;
      for (let row = Math.max(top, start); row <= Math.min(end, bottom - 1); row++) {
        if (tileAt(world, tx, row)) continue;
        const y = row * TILE;
        if (kind === 'ladder') {
          rect(x - 5, y, 2, TILE, '#987457');
          rect(x + 4, y, 2, TILE, '#987457');
          rect(x - 5, y + 4, 11, 2, '#bc9467');
          rect(x - 5, y + 12, 11, 2, '#bc9467');
        } else {
          rect(x - 1, y, 3, TILE, '#8c6c53');
          rect(x - 1, y + 2, 2, 2, '#d0ad7b');
          rect(x, y + 10, 2, 2, '#b59368');
        }
        if (row === start) {
          // Anchor the line to the adjacent solid ledge, not to thin air.
          const leftLedge = tileAt(world, tx - 1, row) || tileAt(world, tx - 1, row + 1);
          const rightLedge = tileAt(world, tx + 1, row) || tileAt(world, tx + 1, row + 1);
          const anchorX = leftLedge ? x - TILE : rightLedge ? x - 1 : x - 8;
          rect(anchorX, y, leftLedge || rightLedge ? TILE + 2 : 16, 3, '#a17b58');
        }
      }
    }
    const treeX = (WEST_EXTENSION + ROOT_GROVE.column + .5) * TILE;
    const treeY = ROOT_GROVE.floor * TILE;
    const treeTile = WEST_EXTENSION + ROOT_GROVE.column;
    if (treeX + 235 > camera.x && treeX - 235 < camera.x + camera.width &&
        treeY + 115 >= camera.y && treeY - 375 < camera.y + camera.height) {
      ctx.save();
      ctx.beginPath();
      for (let tx = Math.max(left, treeTile - 15); tx < Math.min(right, treeTile + 16); tx++) {
        for (let row = Math.max(top, ROOT_GROVE.floor - 24); row < Math.min(bottom, ROOT_GROVE.floor + 8); row++) {
          if (!tileAt(world, tx, row)) ctx.rect(tx * TILE, row * TILE, TILE, TILE);
        }
      }
      ctx.clip();
      drawRootGrove(rect, polygon, noise, treeX, treeY, time);
      ctx.restore();
    }

    const river = ROOT_GROVE.floor - 1;
    if (river >= top && river < bottom) {
      const y = river * TILE;
      for (let tx = Math.max(left, WEST_EXTENSION + ROOT_GROVE.riverWest);
        tx < Math.min(right, WEST_EXTENSION + ROOT_GROVE.riverEast + 1); tx++) {
        if (!waterTileAt(world, tx, river)) continue;
        const x = tx * TILE;
        rect(x, y, TILE, TILE, '#3c656b68');
        rect(x, y, TILE, 1, '#7eaa98');
        if (!overview) {
          const drift = Math.round(Math.sin(time * 1.2 + tx * .8) * 2);
          rect(x + drift + 3, y + 4 + tx % 5, 4 + tx % 5, 1, '#9bb7af59');
        }
      }
    }

    for (let tx = Math.max(left, treeTile - ROOT_GROVE.mossReach);
      tx < Math.min(right, treeTile + ROOT_GROVE.mossReach); tx++) {
      const column = tx - WEST_EXTENSION;
      for (let row = Math.max(top, 36); row < Math.min(bottom, ISLAND_DEEPSTONE_ROW); row++) {
        if (!isDryIslandCave(column, row - 1) || tileAt(world, tx, row - 1) || !tileAt(world, tx, row)) continue;
        const density = groveGroundGrowth(column, row);
        const lush = inRootGrove(column, row);
        if (density <= 0 || (!lush && noise(column, row, 141) > density ** 1.6)) continue;
        const x = tx * TILE;
        const y = row * TILE;
        rect(x, y, TILE, lush ? 4 : density > .6 ? 3 : 1, lush ? '#6da04e' : density > .45 ? '#547845' : '#455641');
        const blades = overview ? 2 : lush ? 9 : 5;
        for (let i = 0; i < blades; i++) {
          const bx = x + (i + .4) * TILE / blades;
          const reach = 1 + Math.round((4 + noise(tx, row, i + 91) * (lush ? 32 : 17)) * density);
          const near = Math.hypot(player.x - bx, player.y + player.height - y);
          const motion = Math.sin(time * 1.6 + bx * .13) * 2 * density +
            Math.max(0, 1 - near / 28) * Math.max(-8, Math.min(8, player.dx * .09));
          polygon([[bx - 1, y], [bx + 1, y], [bx + motion, y - reach]],
            (lush ? ['#83ac48', '#a4bf58', '#47794a', '#658e43'] : ['#638b4c', '#82a25b', '#456a42'])[i % (lush ? 4 : 3)]);
        }
      }
    }

    for (let tx = Math.max(left, WEST_EXTENSION + JUNGLE_CAVE.center - 38);
      tx < Math.min(right, WEST_EXTENSION + JUNGLE_CAVE.center + 42); tx++) {
      const column = tx - WEST_EXTENSION;
      for (let row = Math.max(top, JUNGLE_CAVE.mossStartRow); row < Math.min(bottom, JUNGLE_CAVE.sanctuaryFloor + 4); row++) {
        const density = jungleMossProgress(row);
        if (density <= 0 || !tileAt(world, tx, row)) continue;
        if (isDryJungleCave(column, row - 1) && !tileAt(world, tx, row - 1) && noise(column, row, 241) < 0.22 + density * 0.65) {
          const x = tx * TILE;
          const y = row * TILE;
          rect(x, y, TILE, density > .55 ? 3 : 2, density > .55 ? '#548847' : '#3d693e');
          const tufts = overview ? 2 : density > .5 ? 6 : 3;
          for (let i = 0; i < tufts; i++) {
            const bx = x + (i + .5) * TILE / tufts;
            const reach = 2 + Math.round((3 + noise(tx, row, i + 211) * 11) * density);
            polygon([[bx - 1, y], [bx + 1, y], [bx, y - reach]],
              ['#4f8347', '#6da154', '#39633c'][i % 3]);
          }
        }
        if (isDryJungleCave(column, row + 1) && !tileAt(world, tx, row + 1) && noise(column, row, 257) < 0.14 + density * 0.55) {
          const x = tx * TILE;
          const y = (row + 1) * TILE;
          const tendrils = overview ? 1 : 3;
          for (let i = 0; i < tendrils; i++) {
            const bx = x + 3 + i * 5;
            const drop = 3 + Math.round((4 + noise(tx, row, i + 269) * 14) * density);
            rect(bx, y, 2, drop, i % 2 ? '#3e7242' : '#588c4b');
          }
        }
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
      const jungle = column >= JUNGLE_FADE_START_COLUMN;
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
      } else if (y < WATER_ROW - 1 && seed > (jungle ? 0.2 : 0.6)) {
        for (let i = 0; i < 4; i++) {
          const bx = x * TILE + 2 + i * 3;
          const h = (jungle ? 4 : 2) + Math.floor(noise(column, i, 8) * (jungle ? 6 : 3));
          rect(bx, y * TILE - h, 1, h, jungle ? (i % 2 ? "#2f6b47" : "#488f57") : (i % 2 ? "#667654" : "#87915f"));
        }
        if (jungle && seed > 0.72) {
          rect(x * TILE + 6, y * TILE - 7, 2, 2, seed > 0.86 ? "#e57866" : "#f0c88b");
        }
      }
    }
    for (const tree of world.trees) {
      if (
        tree.tx >= left - 4 &&
        tree.tx <= right + 4 &&
        isTreeStanding(world, tree)
      )
        if (tree.kind === "jungle") jungleTree(tree);
        else palm(tree);
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

    for (const [, kind, column, floor] of jungleVillageStructures) {
      const tx = column + WEST_EXTENSION;
      if (tx < left - 4 || tx > right + 4 || !tileAt(world, tx, floor)) continue;
      drawJungleVillageStructure(rect, polygon, kind, (tx + 0.5) * TILE, floor * TILE, time);
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
      const { tx, floor, kind } = structure;
      const jungleBounds = JUNGLE_CAVE_STRUCTURE_KINDS.has(kind) ? jungleStructureBounds(kind) : null;
      const side = jungleBounds ? jungleBounds.side : kind === "headframe" ? 5 : 2;
      const height = jungleBounds ? jungleBounds.height : kind === "headframe" ? 8 : 4;
      const under = jungleBounds ? jungleBounds.under : kind === "headframe" ? 12 : 1;
      if (
        tx < left - side - 1 ||
        tx >= right + side + 1 ||
        floor + under <= top ||
        floor > bottom + height
      )
        continue;
      if (!hasExposedCaveFloor(world, structure)) continue;
      const postFeet = kind === "headframe" ? [-4, 4].map((offset) => {
        let depth = 0;
        while (depth < under && !tileAt(world, tx + offset, floor + depth)) depth++;
        return depth * TILE;
      }) : undefined;
      ctx.save();
      ctx.beginPath();
      for (let sx = tx - side; sx <= tx + side; sx++) {
        for (let sy = floor - height; sy <= floor + under; sy++) {
          if (!tileAt(world, sx, sy))
            ctx.rect(sx * TILE, sy * TILE, TILE, TILE);
        }
      }
      ctx.clip();
      drawCaveStructure(
        rect,
        polygon,
        postFeet ? { ...structure, postFeet } : structure,
        (tx + 0.5) * TILE,
        floor * TILE,
        overview ? 0 : time,
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
      const poisoned = (arrow.poisonDuration ?? 0) > 0;
      rect(-7, -2, 3, 1, poisoned ? "#9be667" : "#bed8ba");
      rect(-7, 1, 3, 1, poisoned ? "#59ab46" : "#7ebcb0");
      polygon(
        [
          [3, -3],
          [8, 0],
          [3, 3],
        ],
        poisoned ? "#3f8c30" : "#6e888a",
      );
      polygon(
        [
          [4, -2],
          [7, 0],
          [4, 1],
        ],
        poisoned ? "#9be667" : "#d9e1cf",
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
      } else if (trap.kind === "false-ground") {
        const leftX = trap.tx * TILE;
        const topY = trap.ty * TILE;
        const shaking = trap.state === "cracking";
        rect(leftX + 2, topY + 2, 5, shaking ? 2 : 1, shaking ? "#1a2024" : "#283136");
        rect(leftX + 9, topY + 6, 5, shaking ? 2 : 1, shaking ? "#1a2024" : "#283136");
        rect(leftX + 4, topY + 11, 8, shaking ? 2 : 1, "#1e2529");
        if (shaking) rect(leftX + 6, topY, 3, 14, "#67767d");
      } else if (trap.kind === "spike") {
        rect(x - 7, y - 2, 14, 2, "#2f383b");
        const rise = trap.state === "extended" ? 15 : trap.state === "springing" ? 6 : 2;
        for (const offset of [-4, 0, 4]) {
          const tip = offset === 0 ? rise : Math.max(2, rise - 2);
          polygon([[x + offset - 2, y - 1], [x + offset, y - tip], [x + offset + 2, y - 1]], "#6f7b7e");
          polygon([[x + offset, y - 1], [x + offset, y - tip], [x + offset + 1, y - 1]], "#cfd6d0");
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

  function drawRootWave(wave, player) {
    if (!wave?.length) return;
    ctx.save();
    ctx.globalAlpha *= wave.finished ? wave.fade : 1;
    drawRootTrail(polygon, wave, player);
    ctx.restore();
  }

  function drawHook(hook, player) {
    if (!hook) return;
    const ox = Math.round(player.x);
    const oy = Math.round(player.y + player.height * 0.5);
    const hx = Math.round(hook.x);
    const hy = Math.round(hook.y);
    const dx = hx - ox;
    const dy = hy - oy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) || hook.angle || 0;
    const step = 4;
    const count = Math.floor(dist / step);
    for (let i = 1; i < count; i++) {
      const t = i / Math.max(1, count);
      const lx = Math.round(ox + dx * t);
      const ly = Math.round(oy + dy * t);
      rect(lx - 1, ly - 1, 2, 2, i % 2 ? '#23313d' : '#8da3a8');
      if (i % 2 === 0) rect(lx - 1, ly - 1, 1, 1, '#dce5dc');
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);
    rect(-4, -1, 7, 2, '#374a57');
    rect(-3, -1, 5, 1, '#9fb3b8');
    rect(-1, -4, 3, 2, '#69808a');
    rect(1, -5, 3, 2, '#dce5dc');
    rect(-1, 2, 3, 2, '#69808a');
    rect(1, 3, 3, 2, '#dce5dc');
    rect(2, -1, 4, 2, '#dce5dc');
    ctx.restore();
  }

  function mobs(world, camera, time, targetMob, player, reducedMotion) {
    for (const mob of world.mobs ?? []) {
      const caveEnemy = Boolean(caveEnemySpecs[mob.kind] || jungleEnemySpecs[mob.kind]);
      const dyingKraken = mob.kind === "kraken" && (mob.deathTime ?? 0) > 0;
      if (!dyingKraken && (mob.health <= 0 || mob.respawn > 0)) continue;
      const marginX = mob.kind === "kraken" ? 480 : mob.kind === "worm" || mob.kind === "cave-frog" ? 150 : 32;
      const marginY = mob.kind === "kraken" ? 2000 : mob.kind === "worm" || mob.kind === "cave-frog" ? 150 : 32;
      if (mob.x < camera.x - marginX || mob.x > camera.x + camera.width + marginX) continue;
      if (mob.y < camera.y - marginY || mob.y > camera.y + camera.height + marginY)
        continue;
      ctx.save();
      ctx.translate(Math.round(mob.x), Math.round(mob.y));
      const roots = mob.rooted > 0 ? rootBindPose(mob, mobSpec(mob), reducedMotion) : null;
      if (roots) drawRootBind(polygon, roots, false);
      ctx.save();
      if (roots) ctx.scale(1 - roots.grip * .17, 1);
      if (mob.hurt > 0 && Math.floor(mob.hurt * 18) % 2 === 0)
        ctx.globalAlpha = 0.6;
      if ((mob.poison ?? 0) > 0 && mob.kind !== "kraken" && "filter" in ctx) {
        ctx.filter = "sepia(1) hue-rotate(68deg) saturate(2.6) brightness(0.95)";
      }

      if (mob.kind === 'ambient-ant' || mob.kind === 'ambient-spider' || mob.kind === 'ambient-bat' || mob.kind === 'blood-bat') {
        drawCaveAmbienceMob(ctx, mob, time, reducedMotion);
      } else if (mob.kind === "ghost") {
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
      } else if (mob.kind === "worm") {
        // Faint burrowing silhouette through lit rock, full vivid body across open cave walls.
        ctx.save();
        ctx.globalAlpha *= 0.24;
        drawCaveEnemy(ctx, rect, polygon, mob, time);
        ctx.restore();

        const segs = mob.segments?.length ? mob.segments : [mob];
        let minX = mob.x;
        let maxX = mob.x;
        let minY = mob.y;
        let maxY = mob.y;
        for (const seg of segs) {
          if (seg.x < minX) minX = seg.x;
          if (seg.x > maxX) maxX = seg.x;
          if (seg.y < minY) minY = seg.y;
          if (seg.y > maxY) maxY = seg.y;
        }
        const leftTx = Math.floor((minX - 18) / TILE);
        const rightTx = Math.floor((maxX + 18) / TILE);
        const topTy = Math.floor((minY - 18) / TILE);
        const bottomTy = Math.floor((maxY + 18) / TILE);
        ctx.save();
        ctx.beginPath();
        for (let sx = leftTx; sx <= rightTx; sx++) {
          for (let sy = topTy; sy <= bottomTy; sy++) {
            if (!tileAt(world, sx, sy)) {
              ctx.rect(sx * TILE - Math.round(mob.x), sy * TILE - Math.round(mob.y), TILE, TILE);
            }
          }
        }
        ctx.clip();
        drawCaveEnemy(ctx, rect, polygon, mob, time);
        ctx.restore();
      } else if (mob.kind === "cannibal-spear" || mob.kind === "cannibal-bow") {
        drawCannibal(ctx, rect, polygon, mob, time);
      } else if (mob.kind === "shaman") {
        drawNativeShaman(ctx, rect, polygon, mob, time);
      } else if (mob.kind === "lionfish") {
        const charging = (mob.windup ?? 0) > 0;
        const flash = charging && Math.floor(time * 16) % 2 === 0;
        const puff = charging ? 3 : 0;
        const bob = charging ? 0 : Math.round(Math.sin(time * 3.4 + mob.phase) * 1);
        ctx.scale(mob.facing, 1);
        if (charging) {
          ctx.save();
          ctx.globalAlpha *= 0.38 + Math.abs(Math.sin(time * 18)) * 0.28;
          const haloColor = flash ? "#ff3b6b" : "#b84cff";
          for (let r = 0; r < 12; r++) {
            const a = (r / 12) * Math.PI * 2 + time * 4;
            const d = 12 + puff + (r % 2) * 2;
            rect(Math.cos(a) * d - 1, Math.sin(a) * d - 1 + bob, 3, 3, haloColor);
          }
          ctx.restore();
        }
        const dark = flash ? "#9c1942" : "#5e1830";
        const red = flash ? "#ff426b" : "#c73c4a";
        const cream = flash ? "#f2b8ff" : "#f0dec2";
        const tip = charging ? (flash ? "#ffe375" : "#d96bff") : "#b552e6";
        // Fanning dorsal & pectoral spine plumes
        for (let s = -2; s <= 2; s++) {
          const spreadX = s * (3 + puff * 0.6);
          const dorsalTop = -11 - puff + Math.abs(s);
          polygon([[s * 2, -2 + bob], [spreadX - 1, dorsalTop + bob], [spreadX + 1, dorsalTop + bob]], s % 2 ? cream : red);
          rect(spreadX, dorsalTop - 1 + bob, 2, 2, tip);
          const pectoralBot = 9 + puff - Math.abs(s);
          polygon([[s * 2, 2 + bob], [spreadX - 2, pectoralBot + bob], [spreadX + 1, pectoralBot + bob]], s % 2 ? dark : cream);
          rect(spreadX - 1, pectoralBot + bob, 2, 2, tip);
        }
        // Tail fin
        const wag = Math.round(Math.sin(time * 6 + mob.phase) * 1.4);
        polygon([[-7, -2 + bob], [-12, -5 + wag + bob], [-11, 0 + bob], [-12, 5 + wag + bob], [-7, 2 + bob]], "#8f2744");
        rect(-12, -3 + wag + bob, 2, 2, cream);
        rect(-12, 2 + wag + bob, 2, 2, cream);
        // Striped oval body
        rect(-7, -4 + bob, 14, 8 + puff * 0.5, dark);
        rect(-6, -3 + bob, 12, 6, red);
        rect(-5, -3 + bob, 2, 6, cream);
        rect(-1, -3 + bob, 2, 6, cream);
        rect(3, -3 + bob, 2, 6, cream);
        rect(-3, -3 + bob, 2, 6, "#2c1125");
        rect(1, -3 + bob, 2, 6, "#2c1125");
        // Snout & eye
        rect(5, -2 + bob, 4, 4, red);
        rect(4, -2 + bob, 2, 2, "#ffe066");
        rect(5, -2 + bob, 1, 2, "#191528");
      } else if (mob.kind === "pufferfish") {
        const state = mob.pufferState ?? "idle";
        const scale = mob.inflateScale ?? 1;
        const jitter = state === "windup" ? Math.round(Math.sin(time * 28) * 0.7) : 0;
        const bob = state === "idle" ? Math.round(Math.sin(time * 3.1 + mob.phase) * 1) : 0;
        const wag = Math.round(Math.sin(time * (state === "deflating" ? 16 : 6.5) + mob.phase) * 1.4);
        ctx.scale(mob.facing, 1);
        ctx.translate(jitter, bob);
        // Radiating sharp spines when inflated
        if (scale > 1.35) {
          const spineCount = 12;
          const innerR = 5.2 * scale;
          const outerR = 7.4 * scale;
          for (let i = 0; i < spineCount; i++) {
            const a = (i / spineCount) * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            const pX = -s * 1.4;
            const pY = c * 1.4;
            polygon(
              [
                [c * innerR + pX, s * innerR + pY],
                [c * outerR, s * outerR],
                [c * innerR - pX, s * innerR - pY],
              ],
              "#e8d79b",
            );
            rect(c * outerR - 1, s * outerR - 1, 2, 2, "#9bd959");
          }
        }
        ctx.save();
        ctx.scale(scale, scale);
        // Tail fin
        polygon([[-5, -1], [-9, -3 + wag], [-8, 0], [-9, 3 + wag], [-5, 1]], "#8a6128");
        rect(-8, -2 + wag, 2, 1, "#e8cd82");
        rect(-8, 1 + wag, 2, 1, "#e8cd82");
        // Rounded spotted body
        rect(-5, -4, 10, 8, "#8a6128");
        rect(-4, -3, 8, 6, "#c99c4c");
        rect(-4, 0, 8, 3, "#f2e2b8");
        rect(4, -2, 2, 4, "#c99c4c");
        rect(4, 0, 2, 2, "#f2e2b8");
        // Spots & top fin
        rect(-3, -3, 2, 1, "#5c3f18");
        rect(0, -2, 2, 1, "#5c3f18");
        rect(-2, -1, 1, 1, "#5c3f18");
        rect(-1, -5, 3, 1, "#8a6128");
        // Pectoral fin
        rect(-2, Math.trunc(wag * 0.4), 3, 2, "#e8cd82");
        if (state === "windup") {
          // Widened startled eye & inhaling mouth
          rect(1, -3, 4, 4, "#fffdf0");
          rect(3, -2, 1, 2, "#192b3e");
          rect(5, 0, 2, 2, "#5c3f18");
          rect(8 + Math.round(Math.sin(time * 22)), 0, 1, 1, "#a8e6ff");
        } else if (state === "inflated") {
          rect(1, -2, 3, 3, "#fffdf0");
          rect(2, -1, 1, 2, "#192b3e");
          rect(5, 0, 1, 1, "#5c3f18");
        } else if (state === "deflating") {
          rect(1, -1, 3, 1, "#192b3e");
          rect(5, -1, 2, 2, "#7ec8e3");
          rect(7, -1, 4, 2, "#a8e6ff");
        } else {
          rect(2, -2, 2, 2, "#fffdf0");
          rect(3, -2, 1, 1, "#192b3e");
        }
        ctx.restore();
      } else if (caveEnemy) {
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
          const pixelBolt = (x0, y0, x1, y1, color, coreColor) => {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const steps = Math.max(2, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
            for (let s = 0; s <= steps; s++) {
              const bx = Math.round(x0 + (dx * s) / steps);
              const by = Math.round(y0 + (dy * s) / steps);
              rect(bx - 1, by - 1, 2, 2, color);
              if (coreColor && s % 2 === 0) rect(bx, by, 1, 1, coreColor);
            }
          };

          ctx.save();
          ctx.globalAlpha *= 0.24;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + time * 6;
            const d = radius * (0.28 + ((i * 37) % 10) * 0.06);
            rect(Math.round(Math.cos(a) * d) - 2, Math.round(Math.sin(a) * d) - 2, 4, 4, i % 2 ? "#38bdf8" : "#ffe44d");
          }
          ctx.restore();

          const ringSteps = 32;
          for (let i = 0; i < ringSteps; i++) {
            const angle = (i / ringSteps) * Math.PI * 2 + time * 4;
            const jitter = Math.round(Math.sin(i * 4.7 + time * 36) * 2);
            const px = Math.round(Math.cos(angle) * (radius + jitter));
            const py = Math.round(Math.sin(angle) * (radius + jitter));
            rect(px - 1, py - 1, 2, 2, i % 2 ? "#38bdf8" : "#ffe44d");
            if (i % 4 === 0) rect(px, py, 1, 1, i % 8 === 0 ? "#fff4a3" : "#7dd3fc");
          }

          const bolts = 8;
          for (let b = 0; b < bolts; b++) {
            const baseAngle = (b / bolts) * Math.PI * 2 + Math.floor(time * 22) * 0.45 + mob.phase;
            const cos = Math.cos(baseAngle);
            const sin = Math.sin(baseAngle);
            const perpX = -sin;
            const perpY = cos;
            const isBlue = b % 2 === 1;
            const color = isBlue ? "#38bdf8" : "#ffe44d";
            const core = isBlue ? "#7dd3fc" : "#fff4a3";
            let prevX = Math.round(cos * 5);
            let prevY = Math.round(sin * 5);
            const segments = 4;
            for (let s = 1; s <= segments; s++) {
              const dist = 5 + ((radius - 5) * s) / segments;
              const zig = s === segments ? 0 : Math.round(Math.sin(time * 48 + b * 2.3 + s * 3.1) * 5);
              const nextX = Math.round(cos * dist + perpX * zig);
              const nextY = Math.round(sin * dist + perpY * zig);
              pixelBolt(prevX, prevY, nextX, nextY, color, core);
              prevX = nextX;
              prevY = nextY;
            }
          }
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
      } else if (mob.kind === "kraken" && dyingKraken) {
        const progress = clamp(1 - mob.deathTime / KRAKEN_DEATH_DURATION, 0, 1);
        const headY = -44;
        // Disintegrate vertical and upper tentacles into shrinking drifting pixel ash.
        ctx.save();
        ctx.globalAlpha *= Math.max(0, 1 - progress * 1.05);
        for (let t = 0; t < 4; t++) {
          const baseX = -36 + t * 11;
          const width = 9 - t;
          for (let y = 26; y <= 2200; y += 8) {
            const roll = noise(t * 31, y, 71);
            if (roll < progress * 1.15) continue;
            const sway = Math.round(Math.sin(time * 2.1 + t * 1.4 + y * 0.025) * 4);
            const driftX = Math.round((roll - 0.5) * progress * 48);
            const driftY = Math.round((noise(y, t, 73) - 0.35) * progress * 32);
            const shrink = Math.max(2, Math.round(width * (1 - progress * 0.75)));
            const tx = baseX + sway + driftX;
            const ty = y + driftY;
            rect(tx, ty, shrink, Math.max(2, Math.round(8 * (1 - progress * 0.6))), t % 2 ? "#491f3d" : "#7e4268");
            if (y % 24 === 2 && progress < 0.7) rect(tx + 1, ty + 2, 2, 2, "#da9292");
          }
        }
        const topReach = Math.round(WATER - mob.y + 4);
        for (let t = 0; t < 2; t++) {
          const baseX = -32 + t * 15;
          const sway = Math.round(Math.sin(time * 2.5 + t * 2.1) * 5);
          const x0 = baseX;
          const y0 = -62;
          const cx = baseX - 8 + sway;
          const cy = Math.round(topReach * 0.5);
          const x1 = baseX - 10 - sway;
          const y1 = topReach;
          const steps = Math.max(8, Math.ceil(Math.abs(topReach - y0) / 6));
          for (let i = 0; i <= steps; i++) {
            const roll = noise(t * 19 + 5, i, 79);
            if (roll < progress * 1.15) continue;
            const u = i / steps;
            const mu = 1 - u;
            const px = Math.round(mu * mu * x0 + 2 * mu * u * cx + u * u * x1 + (roll - 0.5) * progress * 42);
            const py = Math.round(mu * mu * y0 + 2 * mu * u * cy + u * u * y1 - noise(i, t, 83) * progress * 24);
            const s = Math.max(2, Math.round((9 - 4 * u) * (1 - progress * 0.75)));
            const half = Math.floor(s / 2);
            rect(px - half, py - half, s, s, i % 3 === 0 ? "#491f3d" : "#7e4268");
            if (i % 3 === 1 && progress < 0.7) rect(px - half + 1, py + half - 2, 2, 2, "#da9292");
          }
        }
        ctx.restore();

        if (progress < 0.42) {
          // Stage 1: violent trembling, inward gravitational suction, and glowing fissures as head collapses.
          const collapse = progress / 0.42;
          const scale = Math.max(0.14, 1 - collapse * 0.82);
          const jx = Math.round(Math.sin(time * 70) * (2 + collapse * 5));
          const jy = Math.round(Math.cos(time * 58) * (1 + collapse * 4));
          for (let s = 0; s < 14; s++) {
            const a = (s / 14) * Math.PI * 2 + collapse * 3.2;
            const r = (1 - collapse) * (68 + (s % 3) * 18);
            rect(Math.round(Math.cos(a) * r) - 2, Math.round(headY + Math.sin(a) * r) - 2, 4, 4, s % 2 ? "#da9292" : "#8bdfd0");
          }
          ctx.save();
          ctx.translate(jx, headY + jy);
          ctx.scale(scale, scale);
          ctx.translate(0, -headY);
          polygon([[-32, -38], [-22, -96], [2, -118], [34, -114], [48, -74], [44, 24], [-40, 28]], "#192b3e");
          rect(-28, -90, 68, 56, "#491f3d");
          rect(-18, -110, 52, 24, "#491f3d");
          rect(-22, -88, 56, 52, "#7e4268");
          rect(-42, -40, 82, 64, "#2d1429");
          rect(-38, -36, 74, 56, "#491f3d");
          rect(-34, -32, 64, 48, "#7e4268");
          rect(-32, -18, 16, 14, "#111d2f");
          rect(-30, -16, 12, 10, "#ff9b80");
          rect(-28, -14, 8, 6, "#f8dca5");
          // Glowing fracture cracks slicing inward across the imploding skull.
          for (let c = 0; c < 5; c++) {
            const cy = -88 + c * 22;
            rect(-28 + (c % 2) * 10, cy, Math.round(24 + collapse * 36), 3, c % 2 ? "#f8dca5" : "#8bdfd0");
          }
          ctx.restore();
        } else {
          // Stage 2: singularity flash, shockwave rings, and scattering pixel debris.
          const burst = (progress - 0.42) / 0.58;
          if (burst < 0.28) {
            const coreR = Math.max(2, Math.round((1 - burst / 0.28) * 18));
            ctx.fillStyle = "#2d1429";
            ctx.beginPath();
            ctx.arc(0, headY, coreR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#8bdfd0";
            ctx.beginPath();
            ctx.arc(0, headY, Math.max(1, Math.round(coreR * 0.55)), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.save();
          ctx.globalAlpha *= Math.max(0, 1 - burst);
          const ringR = Math.round(8 + burst * 145);
          ctx.strokeStyle = "#8bdfd0";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, headY, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "#f8dca5";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, headY, Math.max(2, Math.round(ringR * 0.68)), 0, Math.PI * 2);
          ctx.stroke();
          for (let d = 0; d < 18; d++) {
            const a = (d / 18) * Math.PI * 2 + 0.3;
            const dist = Math.round(burst * (45 + (d % 4) * 28));
            const px = Math.round(Math.cos(a) * dist);
            const py = Math.round(headY + Math.sin(a) * dist);
            const sz = Math.max(2, Math.round((1 - burst) * 6));
            rect(px - 2, py - 2, sz, sz, d % 3 === 0 ? "#da9292" : d % 3 === 1 ? "#7e4268" : "#f8dca5");
          }
          ctx.restore();
        }
      } else if (mob.kind === "kraken") {
        const rage = (mob.windup ?? 0) > 0 || (mob.actionTime ?? 0) > 0;
        const breathe = Math.round(Math.sin(time * 2.1) * 2);
        const pixelTentacle = (x0, y0, cx, cy, x1, y1, s0, s1, dark, mid, cup) => {
          const dist = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(cx - x0, cy - y0);
          const steps = Math.max(4, Math.ceil(dist / 5));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const px = Math.round(mt * mt * x0 + 2 * mt * t * cx + t * t * x1);
            const py = Math.round(mt * mt * y0 + 2 * mt * t * cy + t * t * y1);
            const s = Math.max(3, Math.round(s0 + (s1 - s0) * t));
            const half = Math.floor(s / 2);
            rect(px - half - 1, py - half - 1, s + 2, s + 2, "#2d1429");
            rect(px - half, py - half, s, s, i % 3 === 0 ? dark : mid);
            if (s >= 5) rect(px - half, py - half, Math.max(2, s - 3), 2, "#b0667d");
            if (cup && i % 3 === 1) rect(px - half + 1, py + half - 2, 2, 2, cup);
          }
        };
        const whipTentacle = (x0, y0, x1, y1, whipPhase, swingDir, s0, s1) => {
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const swingAmp = Math.cos(whipPhase * Math.PI) * 44 * swingDir;
          const waveAmp = Math.sin(whipPhase * Math.PI) * 22 * swingDir;
          const steps = Math.max(6, Math.ceil(len / 5));
          let tipX = x1;
          let tipY = y1;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const swing = swingAmp * Math.sin(t * Math.PI * 0.72);
            const wave = Math.sin(t * Math.PI * 2.4 - whipPhase * Math.PI * 4) * waveAmp * (1 - t * 0.2);
            const offset = swing + wave;
            const px = Math.round(x0 + dx * t + nx * offset);
            const py = Math.round(y0 + dy * t + ny * offset);
            const s = Math.max(3, Math.round(s0 + (s1 - s0) * t));
            const half = Math.floor(s / 2);
            rect(px - half - 1, py - half - 1, s + 2, s + 2, "#2d1429");
            rect(px - half, py - half, s, s, i % 3 === 0 ? "#491f3d" : "#7e4268");
            if (s >= 5) rect(px - half, py - half, Math.max(2, s - 3), 2, "#b0667d");
            if (i % 3 === 1) rect(px - half + 1, py + half - 2, 2, 2, "#da9292");
            tipX = px;
            tipY = py;
          }
          rect(tipX - 4, tipY - 4, 8, 8, "#b0667d");
          rect(tipX - 2, tipY - 2, 4, 4, "#f0c88b");
        };

        // Pixel-stepped vertical barrier tentacles from surface down through seabed/caves.
        for (let t = 0; t < 4; t++) {
          const baseX = -36 + t * 11;
          const width = 9 - t;
          const dark = t % 2 ? "#491f3d" : "#7e4268";
          const light = t % 2 ? "#7e4268" : "#b0667d";
          for (let y = 26; y <= 2200; y += 8) {
            const sway = Math.round(Math.sin(time * 2.1 + t * 1.4 + y * 0.025) * 4);
            const tx = baseX + sway;
            rect(tx - 1, y, width + 2, 9, "#2d1429");
            rect(tx, y, width, 8, dark);
            rect(tx, y, 2, 8, light);
            if (y % 24 === 2) rect(tx + 1, y + 2, 2, 2, "#da9292");
          }
        }
        const topReach = Math.round(WATER - mob.y + 4);
        for (let t = 0; t < 2; t++) {
          const baseX = -32 + t * 15;
          const sway = Math.round(Math.sin(time * 2.5 + t * 2.1) * 5);
          pixelTentacle(baseX, -62, baseX - 8 + sway, Math.round(topReach * 0.5), baseX - 10 - sway, topReach, 9, 5, "#491f3d", "#7e4268", "#da9292");
        }

        // Pixel-stepped tackle / grab attack tentacles.
        const reach = mob.tentacleReach ?? 0;
        const headVisible = mob.y + 28 >= camera.y && mob.y - 118 <= camera.y + camera.height;
        if (mob.attackMode === "tackle" && (mob.windup ?? 0) > 0) {
          const coil = Math.min(1, 1 - mob.windup / 0.52);
          const ox = headVisible ? -4 : -24;
          const oy = headVisible ? 4 : Math.round((mob.tentacleTarget?.y ?? mob.y) - mob.y);
          for (const dir of [-1, 1]) {
            pixelTentacle(ox, oy + dir * 8, ox - 28, oy + dir * (28 + Math.round(coil * 14)), ox - 44, oy + dir * (12 + Math.round(coil * 10)), 10, 5, "#491f3d", "#7e4268", "#da9292");
          }
        } else if (reach > 0 && mob.tentacleTarget) {
          const ox = headVisible ? -4 : Math.round((mob.tentacleTarget.ox ?? mob.x - 4) - mob.x);
          const oy = headVisible ? 4 : Math.round((mob.tentacleTarget.oy ?? mob.y + 4) - mob.y);
          const tx = Math.round(ox + (mob.tentacleTarget.x - mob.x - ox) * reach);
          const ty = Math.round(oy + (mob.tentacleTarget.y - mob.y - oy) * reach);
          if (mob.attackMode === "tackle") {
            const whipPhase = mob.tacklePhase ?? (1 - (mob.actionTime ?? 0) / 0.6);
            whipTentacle(ox, oy - 10, tx, ty - 4, whipPhase, -1, 10, 4);
            whipTentacle(ox, oy + 10, tx, ty + 4, whipPhase, 1, 10, 4);
          } else if (mob.attackMode === "grab") {
            const midX = Math.round((ox + tx) * 0.5);
            const midY = Math.round(oy + (ty - oy) * 0.5 - 14);
            pixelTentacle(ox, oy, midX, midY, tx, ty, 9, 5, "#491f3d", "#7e4268", "#da9292");
            if (mob.grabbing) {
              rect(tx - 11, ty - 11, 22, 4, "#2d1429");
              rect(tx - 10, ty - 10, 20, 3, "#b0667d");
              rect(tx - 11, ty + 7, 22, 4, "#2d1429");
              rect(tx - 10, ty + 8, 20, 3, "#b0667d");
              rect(tx - 11, ty - 8, 4, 16, "#7e4268");
              rect(tx + 7, ty - 8, 4, 16, "#7e4268");
            } else {
              rect(tx - 4, ty - 4, 8, 8, "#da9292");
            }
          }
        }

        // Larger pixel-art Kraken mantle & head matching Aquaria cephalopod style.
        ctx.save();
        if ((mob.poison ?? 0) > 0 && "filter" in ctx) {
          ctx.filter = "sepia(1) hue-rotate(68deg) saturate(2.6) brightness(0.95)";
        }
        polygon([[-32, -38], [-22, -96 + breathe], [2, -118 + breathe], [34, -114 + breathe], [48, -74 + breathe], [44, 24], [-40, 28]], "#192b3e");
        polygon([[24, -108 + breathe], [54, -92 + breathe], [44, -64 + breathe]], "#491f3d");
        polygon([[28, -102 + breathe], [48, -90 + breathe], [42, -70 + breathe]], "#7e4268");
        polygon([[-26, -78 + breathe], [-46, -62 + breathe], [-34, -42]], "#491f3d");
        polygon([[-26, -72 + breathe], [-40, -61 + breathe], [-32, -48]], "#7e4268");
        rect(-28, -90 + breathe, 68, 56, "#491f3d");
        rect(-18, -110 + breathe, 52, 24, "#491f3d");
        rect(-10, -114 + breathe, 36, 12, "#7e4268");
        rect(-22, -88 + breathe, 56, 52, "#7e4268");
        rect(-14, -104 + breathe, 42, 20, "#7e4268");
        rect(-14, -96 + breathe, 36, 36, "#b0667d");
        rect(-8, -110 + breathe, 24, 3, "#da9292");
        rect(-16, -92 + breathe, 3, 28, "#da9292");
        rect(8, -82 + breathe, 8, 6, "#da9292");
        rect(20, -64 + breathe, 6, 6, "#da9292");
        rect(0, -66 + breathe, 6, 4, "#f0c88b");
        rect(14, -94 + breathe, 5, 4, "#f0c88b");
        rect(-42, -40, 82, 64, "#2d1429");
        rect(-38, -36, 74, 56, "#491f3d");
        rect(-34, -32, 64, 48, "#7e4268");
        rect(-28, -26, 46, 34, "#b0667d");
        rect(-32, -32, 48, 3, "#da9292");
        const eyeDx = (player?.x ?? mob.x - 100) - (mob.x - 24);
        const eyeDy = (player ? player.y + 11 : mob.y - 11) - (mob.y - 11);
        const eyeDist = Math.hypot(eyeDx, eyeDy) || 1;
        const lookX = Math.round(clamp((eyeDx / eyeDist) * 2.4, -2, 2));
        const lookY = Math.round(clamp((eyeDy / eyeDist) * 2.2, -2, 2));
        rect(-36, -24, 24, 6, "#2d1429");
        rect(-34, -22, 20, 3, "#491f3d");
        rect(-32, -18, 16, 14, "#111d2f");
        rect(-30, -16, 12, 10, rage ? "#ff9b80" : "#f1f3e5");
        rect(-28 + lookX, -14 + lookY, 8, 6, rage ? "#f8dca5" : "#efc27e");
        rect(-27 + lookX, -13 + lookY, 5, 4, "#192b3e");
        rect(-25 + lookX, -14 + lookY, 2, 2, "#f1f3e5");
        rect(-6, 4, 6, 4, "#f0c88b");
        rect(6, -6, 6, 4, "#f0c88b");
        rect(-44, 6, 14, 14, "#2d1429");
        rect(-42, 8, 10, 10, "#491f3d");
        rect(-40, 10, 6, 6, "#7e4268");
        ctx.restore();
        if ((mob.sonarTime ?? 0) > 0) {
          const elapsed = 1.2 - mob.sonarTime;
          const headY = -58 + breathe;
          ctx.save();
          for (let r = 0; r < 3; r++) {
            const ringPhase = (elapsed - r * 0.22) / 0.72;
            if (ringPhase <= 0 || ringPhase >= 1) continue;
            const radius = Math.round(18 + ringPhase * 150);
            ctx.globalAlpha = Math.sin(ringPhase * Math.PI) * 0.9;
            ctx.strokeStyle = r % 2 === 0 ? "#8bdfd0" : "#f8dca5";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, headY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "#da9292";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, headY, Math.max(4, radius - 3), 0, Math.PI * 2);
            ctx.stroke();
            for (let p = 0; p < 8; p++) {
              const a = (p / 8) * Math.PI * 2 + ringPhase * 1.2;
              rect(Math.cos(a) * radius - 1, headY + Math.sin(a) * radius - 1, 2, 2, "#f1f3e5");
            }
          }
          ctx.restore();
        }
      }
      ctx.restore();

      if (roots) drawRootBind(polygon, roots, true);
      const barY = mob.kind === "kraken"
        ? -128
        : mob.kind === "worm" || mob.kind === "lionfish"
          ? -16
          : mob.kind === "pufferfish"
            ? Math.round(-12 * (mob.inflateScale ?? 1)) - 4
            : mob.kind === "ghost"
              ? -21
              : caveEnemy
                ? mob.kind === "spider"
                  ? -15
                  : mob.kind === "cave-frog" || mob.kind === "mimic"
                    ? -24
                    : -31
                : mob.kind === "crab" || mob.kind === "jellyfish"
                  ? -13
                  : mob.kind === "shark"
                    ? -14
                    : -10;
      const showHealthBar = Boolean(
        !dyingKraken &&
        !(mob.kind === "mimic" && !mob.awakened) &&
        mob.maxHealth &&
        (mob.health < mob.maxHealth || mob.hurt > 0 || mob === targetMob),
      );
      if (showHealthBar) {
        const barWidth = mob.kind === "kraken" ? 64 : mob.maxHealth >= 7 ? 20 : mob.maxHealth >= 4 ? 14 : 10;
        const barX = -Math.floor(barWidth / 2);
        const ghost = mob.kind === "ghost";
        const hostile = Boolean(
          ghost ||
          caveEnemy ||
          mob.enemyType ||
          mob.kind === "jellyfish" ||
          mob.kind === "squid" ||
          mob.kind === "shark" ||
          mob.kind === "lionfish" ||
          mob.kind === "pufferfish" ||
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
      if (!dyingKraken && (mob.poison ?? 0) > 0) {
        const bob = reducedMotion ? 0 : Math.round(Math.sin(time * 5 + (mob.phase ?? 0)) * 1);
        const iy = barY - (showHealthBar ? 7 : 3) + bob;
        // Poison droplet icon above enemy head
        rect(-2, iy - 3, 5, 5, "#264d1c");
        rect(-1, iy - 4, 3, 1, "#264d1c");
        rect(-1, iy - 2, 3, 3, "#66cc4b");
        rect(0, iy - 3, 1, 1, "#b8ff9c");
        rect(-1, iy - 2, 1, 1, "#b8ff9c");
        rect(-3, iy - 5 + (bob ? 0 : -1), 1, 1, "#a8f078");
        rect(3, iy - 4, 1, 1, "#79d956");
      }

      ctx.restore();
    }
  }

  function projectiles(world, camera, time) {
    arrows(
      world.projectiles.filter((entry) => entry.kind === "cave-arrow"),
      camera,
    );
    for (const bubble of world.projectiles) {
      if (bubble.kind === "cave-arrow") continue;
      const margin = bubble.kind === "neurotoxin-cloud" ? 32 : 16;
      if (bubble.x < camera.x - margin || bubble.x > camera.x + camera.width + margin)
        continue;
      if (bubble.y < camera.y - margin || bubble.y > camera.y + camera.height + margin)
        continue;
      if (bubble.kind === "lionfish-spine") {
        ctx.save();
        ctx.translate(Math.round(bubble.x), Math.round(bubble.y));
        ctx.rotate(bubble.angle ?? 0);
        rect(-5, -1, 10, 2, "#3a142d");
        rect(-4, -1, 3, 2, "#c73c4a");
        rect(-1, -1, 2, 2, "#f0dec2");
        rect(1, -1, 3, 2, "#c85cff");
        rect(4, 0, 2, 1, "#f4b8ff");
        ctx.restore();
        continue;
      }
      if (bubble.kind === "neurotoxin-cloud") {
        const lifeFrac = clamp(bubble.life / (bubble.maxLife || 4.5), 0, 1);
        const expand = Math.min(1, 0.4 + ((bubble.maxLife - bubble.life) / 0.25) * 0.6);
        const r = bubble.radius * expand;
        const fade = lifeFrac < 0.22 ? lifeFrac / 0.22 : 1;
        ctx.save();
        ctx.globalAlpha *= 0.62 * fade;
        // Billowing toxic hazard puffs around the embedded spine
        for (let p = 0; p < 7; p++) {
          const a = p * 0.9 + time * 1.1 + (bubble.phase ?? 0);
          const dist = p === 0 ? 0 : r * (0.34 + (p % 2) * 0.26);
          const px = Math.round(bubble.x + Math.cos(a) * dist);
          const py = Math.round(bubble.y + Math.sin(a) * dist);
          const pr = Math.round(r * (p === 0 ? 0.52 : 0.36));
          rect(px - pr, py - pr, pr * 2, pr * 2, p % 3 === 0 ? "#8538ba" : p % 2 ? "#62267d" : "#9bd959");
        }
        // Embedded lionfish needle pinned into the wall/rock
        ctx.globalAlpha = fade;
        ctx.translate(Math.round(bubble.anchorX ?? bubble.x), Math.round(bubble.anchorY ?? bubble.y));
        ctx.rotate(bubble.angle ?? 0);
        rect(-7, -1, 7, 2, "#3a142d");
        rect(-6, -1, 3, 2, "#f0dec2");
        rect(-3, -1, 3, 2, "#c85cff");
        ctx.restore();
        continue;
      }
      if (bubble.kind === "shaman-skull") {
        const x = Math.round(bubble.x);
        const y = Math.round(bubble.y);
        const chomp = Math.round(Math.abs(Math.sin(time * 24 + x * 0.1)) * 3);
        const flicker = Math.round(Math.sin(time * 18 + y * 0.2) * 1.5);
        ctx.save();
        // Green mystical flame aura & flickering wisps around the skull
        rect(x - 8, y - 9 - Math.max(0, flicker), 16, 17 + Math.max(0, flicker), "#39b86440");
        polygon([[x - 6, y - 4], [x - 2, y - 12 - Math.abs(flicker)], [x + 2, y - 11], [x + 6, y - 4]], "#46d973");
        polygon([[x - 4, y - 4], [x, y - 10 - Math.abs(flicker)], [x + 4, y - 4]], "#a8ff9f");
        rect(x - 7 - (bubble.facing > 0 ? 3 : -1), y - 3 + flicker, 4, 4, "#46d973");
        // Pale skull cranium
        rect(x - 5, y - 5, 10, 7, "#b5ab92");
        rect(x - 4, y - 6, 8, 7, "#ece3c8");
        rect(x - 3, y - 3, 2, 2, "#17211d");
        rect(x + 1, y - 3, 2, 2, "#17211d");
        rect(x - 2, y - 3, 1, 1, "#8eff94");
        rect(x + 2, y - 3, 1, 1, "#8eff94");
        // Hinged cackling jawbone bobbing up & down
        rect(x - 3, y + 1 + chomp, 6, 3, "#d4cbb0");
        rect(x - 2, y + 1 + chomp, 1, 1, "#2a2024");
        rect(x, y + 1 + chomp, 1, 1, "#2a2024");
        rect(x + 2, y + 1 + chomp, 1, 1, "#2a2024");
        ctx.restore();
        continue;
      }
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
        const mix = jungleMixAt(x + xOffset + width * 0.5);
        rect(x, y + dy, width, 1, mixPair(SURFACE_LINE_MAIN_PAIR, mix));
        if (noise(Math.floor(phase / 5), 9) > 0.68)
          rect(x, y + dy + 4, width, 1, mixPair(SURFACE_LINE_FOAM_PAIR, mix));
      }
      x += width;
    }
  }

  function drawInkSplat(cx, cy, baseR, splat) {
    const step = Math.max(2, Math.round(baseR / 13));
    const snap = (v) => Math.round(v / step) * step;
    const ox = snap(cx);
    const oy = snap(cy);
    const maxCells = Math.ceil((baseR * 1.35) / step);

    ctx.beginPath();
    // Pixel-stepped organic star-splatter body.
    for (let gy = -maxCells; gy <= maxCells; gy++) {
      for (let gx = -maxCells; gx <= maxCells; gx++) {
        const px = gx * step;
        const py = gy * step;
        const dist = Math.hypot(px, py);
        const ang = Math.atan2(py, px) - splat.angle;
        const lobe =
          0.62 +
          0.26 * Math.sin(ang * 5 + noise(1, splat.seed) * 6) +
          0.18 * Math.cos(ang * 3 - noise(2, splat.seed) * 6) +
          0.12 * (noise(gx + 20, gy + 20, splat.seed) - 0.5);
        if (dist <= baseR * lobe) {
          ctx.rect(ox + px, oy + py, step, step);
        }
      }
    }

    // Pixel-stepped radiating splatter streaks and flung droplets.
    for (let k = 0; k < 6; k++) {
      const ang = splat.angle + k * 1.05 + noise(k, splat.seed + 7) * 0.6;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const start = baseR * 0.5;
      const len = baseR * (1.25 + noise(k + 10, splat.seed) * 0.9);
      for (let d = start; d <= len; d += step) {
        const sx = ox + snap(cos * d);
        const sy = oy + snap(sin * d);
        const w = d < start + (len - start) * 0.45 ? step * 2 : step;
        ctx.rect(sx, sy, w, w);
      }
      const dropDist = len + baseR * (0.24 + noise(k + 17, splat.seed) * 0.28);
      const dropS = noise(k + 21, splat.seed) > 0.5 ? step * 2 : step;
      ctx.rect(ox + snap(cos * dropDist), oy + snap(sin * dropDist), dropS, dropS);
    }

    // Pixel-stepped vertical ink drips.
    const age = Math.max(0, (splat.duration ?? 7) - splat.time);
    for (let d = 0; d < 3; d++) {
      const dripX = ox + snap((noise(d, splat.seed + 23) - 0.5) * baseR * 1.0);
      const dripTop = oy + snap(baseR * (0.28 + noise(d + 5, splat.seed) * 0.2));
      const dripLen = snap(
        baseR * (0.55 + noise(d + 9, splat.seed) * 0.6) + Math.min(age, 3) * baseR * 0.16,
      );
      for (let y = 0; y < dripLen; y += step) {
        ctx.rect(dripX, dripTop + y, step, step);
      }
      ctx.rect(dripX - Math.floor(step / 2), dripTop + dripLen, step * 2, step * 2);
    }

    ctx.fill();

    // Wet-ink pixel sheen highlights matching the squid ink bubbles (drawn without outer shadow).
    ctx.save();
    ctx.shadowColor = "transparent";
    const sheenX = ox - snap(baseR * 0.3);
    const sheenY = oy - snap(baseR * 0.3);
    ctx.fillStyle = "#1e232e";
    ctx.fillRect(sheenX, sheenY, step * 3, step);
    ctx.fillRect(sheenX, sheenY + step, step, step * 2);
    ctx.fillStyle = "#4b5263";
    ctx.fillRect(sheenX, sheenY, step, step);
    ctx.restore();
  }

  function inkOverlay(camera, player) {
    const splats = player?.inkSplats;
    if (!splats?.length) return;
    const span = Math.min(camera.width, camera.height);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = Math.max(6, Math.round(canvas.height * 0.018));
    ctx.shadowOffsetX = Math.max(2, Math.round(canvas.height * 0.006));
    ctx.shadowOffsetY = Math.max(3, Math.round(canvas.height * 0.008));
    for (const splat of splats) {
      const fade = Math.min(1, splat.time / 2);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * 0.95;
      ctx.fillStyle = splat.color ?? "#040508";
      drawInkSplat(
        splat.nx * camera.width,
        splat.ny * camera.height,
        span * 0.18 * (splat.scale ?? 1),
        splat,
      );
    }
    ctx.restore();
  }

  function blindnessOverlay(camera, player) {
    const remaining = player?.blindness ?? 0;
    if (!(remaining > 0) || player?.flightOrigin) return;
    const px = player.x - camera.x;
    const py = player.y + player.height / 2 - camera.y;
    const fade = Math.min(1, remaining / 0.6);
    const shade = ctx.createRadialGradient(px, py, 24, px, py, 68);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(0.55, "rgba(0, 0, 0, 0.6)");
    shade.addColorStop(0.85, "rgba(0, 0, 0, 0.95)");
    shade.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, camera.width, camera.height);
    ctx.restore();
  }

  function breathBubble({ x, y, bubbleRadius: r, life }) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 4);
    rect(x - r + 1, y - r, r * 2 - 1, 1, "#a5dae5");
    rect(x - r, y - r + 1, 1, r * 2 - 1, "#a5dae5");
    rect(x - r + 1, y + r, r * 2 - 1, 1, "#5191a6");
    rect(x + r, y - r + 1, 1, r * 2 - 1, "#5191a6");
    rect(x - r + 1, y - r + 1, 1, 1, "#e4ffff");
    ctx.restore();
  }

  function drowningVignette({ width, height }, strength) {
    if (strength <= 0) return;
    ctx.save();
    ctx.scale(width, height);
    const shade = ctx.createRadialGradient(0.5, 0.5, 0.25, 0.5, 0.5, 0.71);
    shade.addColorStop(0, "#0208140c");
    shade.addColorStop(0.6, "#02081440");
    shade.addColorStop(1, "#02081480");
    ctx.globalAlpha = strength;
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 1, 1);
    ctx.restore();
  }

  function draw({
    world,
    player,
    snorkel,
    ring,
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
    rootWave,
    hook,
    targetMob,
    particles,
    reducedMotion,
    conditions,
    worldTime,
    weatherSeed,
    caveShadowsHidden,
    openChestId,
    drowning = 0,
    shake = { x: 0, y: 0 },
    peers = [],
  }) {
    const scale = canvas.width / camera.width;
    const overview = scale <= 0.25;
    ctx.setTransform(scale, 0, 0, canvas.height / camera.height, 0, 0);
    const surface = WATER - Math.round(camera.y);
    const { water, shore, backdrop } = waterClips(world, camera, overview);
    const bounds = tileBounds(camera);
    caveLight.update(world, player, bounds, overview || reducedMotion ? 0 : time);
    surfaceLight.update(world, player, bounds);
    rect(-32, -32, camera.width + 64, camera.height + 64, "#101f33");
    ctx.save();
    ctx.translate(shake.x, shake.y);
    sky(camera, surface, time, conditions, reducedMotion);
    // Keep star halos behind every world layer so they cannot shine through blocks.
    starlight(camera, surface, time, conditions, reducedMotion);
    const lightning = lightningAt(worldTime, weatherSeed, conditions, reducedMotion);
    const distantThunder = distantThunderAt(worldTime, weatherSeed, conditions, reducedMotion);
    if (lightning) {
      activeLightningAnchor = lightningAnchor(lightning, weatherSeed, camera, activeLightningAnchor);
    }
    if (distantThunder) {
      // Keep the separate far-off glow fixed to the landscape too.
      activeDistantAnchor = lightningAnchor(
        { event: distantThunder.event + 100000 }, weatherSeed, camera, activeDistantAnchor,
      );
    }
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
    drawRootWave(rootWave, player);
    drawHook(hook, player);
    mobs(world, camera, time, targetMob, player, reducedMotion);
    projectiles(world, camera, time);
    arrows(playerArrows, camera);
    for (const bit of particles) {
      if (!bit.bubbleRadius) rect(bit.x, bit.y, 2, 2, bit.color ?? palettes[bit.material][1]);
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
      ring,
      time,
      miningSwing,
      held,
      attack,
      hasArrow,
      reducedMotion,
      swimming: playerInWater(world, player),
    });
    if ((player.confused ?? 0) > 0) {
      if (player.confusedStyle === "stars") {
        for (let i = 0; i < 4; i++) {
          const angle = (reducedMotion ? 0 : time * 5.2) + (i * Math.PI * 2) / 4;
          const sx = Math.round(player.x + Math.cos(angle) * 9);
          const sy = Math.round(player.y - 7 + Math.sin(angle) * 3.5);
          rect(sx - 2, sy, 5, 1, "#ffe875");
          rect(sx, sy - 2, 1, 5, "#ffe875");
          rect(sx, sy, 1, 1, "#fffbe0");
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const angle = (reducedMotion ? 0 : time * 4.5) + (i * Math.PI * 2) / 3;
          const sx = Math.round(player.x + Math.cos(angle) * 8);
          const sy = Math.round(player.y - 6 + Math.sin(angle) * 3);
          rect(sx - 1, sy - 1, 3, 3, i % 2 ? "#7df594" : "#d8f5a8");
        }
      }
    }
    if ((player.bleed ?? 0) > 0) {
      for (let i = 0; i < 3; i++) {
        const cycle = reducedMotion ? i * 0.3 : (time * 1.9 + i * 0.37) % 1;
        const bx = Math.round(player.x + (i - 1) * 4 + Math.sin(i * 2.1) * 1.5);
        const by = Math.round(player.y + 8 + cycle * 14);
        rect(bx, by, 2, 2, "#9c1b29");
        rect(bx, by, 1, 1, "#e34a58");
      }
    }
    if ((player.neurotoxin ?? 0) > 0) {
      for (let i = 0; i < 3; i++) {
        const a = (reducedMotion ? 0 : time * 2.4) + (i * Math.PI * 2) / 3;
        const nx = Math.round(player.x + Math.cos(a) * 8);
        const ny = Math.round(player.y + 8 + Math.sin(a * 1.5) * 6);
        rect(nx - 1, ny - 1, 3, 3, i % 2 ? "#b054eb" : "#9bd959");
      }
    }
    for (const bit of particles) {
      if (bit.bubbleRadius) breathBubble(bit);
    }
    if (!caveShadowsHidden) shadeUnderground(world, player, bounds, overview, conditions.darkness);
    ctx.restore();

    rain(world, camera, surface, time, conditions);
    shadeAtmosphere(camera, conditions, time,
      (lightning?.flash ?? 0) + (distantThunder?.flash ?? 0) * .3);
    auroraLight(camera, surface, time, conditions);
    drawDistantThunder(camera, distantThunder, activeDistantAnchor);
    drawStormLightning(camera, lightning, activeLightningAnchor, weatherSeed);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawCaveStructureLights(world, bounds, time, overview, reducedMotion);
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
    blindnessOverlay(camera, player);
    if ((player.confused ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = player.confusedStyle === "stars"
        ? Math.min(0.08, player.confused * 0.025)
        : Math.min(0.14, player.confused * 0.04);
      rect(0, 0, camera.width, camera.height, player.confusedStyle === "stars" ? "#f7d06b" : "#4fd979");
      ctx.restore();
    }
    if ((player.bleed ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.08 + (reducedMotion ? 0 : Math.abs(Math.sin(time * 4)) * 0.06);
      rect(0, 0, camera.width, camera.height, "#b92534");
      ctx.restore();
    }
    ctx.restore();
    drowningVignette(camera, drowning);
  }

  return { draw };
}
