import { createCharacterRenderer } from './character.js';
import { MATERIAL, ORE_MATERIALS } from './content.js';
import { playerInWater } from './gameplay/player.js';
import { ITEMS } from './inventory.js';
import { hasOpenFace, isDoorOpen, isTreeStanding, tileAt, waterTileAt } from './world.js';
import { COLS, ISLAND_CAVE, ROWS, TILE, WATER, WATER_ROW, WEST_EXTENSION, clamp, deepstoneStartAt, groundAt, noise } from './world/generation.js';
import { caveAmbientAt, createCaveLight, createSurfaceLight } from './world/lighting.js';

const palettes = {
  [MATERIAL.sand]: ['#c6a56e', '#e0be84', '#9c7a56', '#f0c88b'],
  [MATERIAL.stone]: ['#2f4858', '#3e5b63', '#263b51', '#6d8884'],
  [MATERIAL.deepstone]: ['#262b45', '#42465f', '#1c2138', '#666987'],
  [MATERIAL.reef]: ['#436b6e', '#608781', '#315563', '#8eb096'],
  [MATERIAL.wood]: ['#85604c', '#bc8b62', '#513a3b', '#e3ae72'],
  [MATERIAL.bedrock]: ['#192b3e', '#24374a', '#111d2f', '#35485a'],
  [MATERIAL.copper]: ['#35464d', '#bc7659', '#704d4b', '#efae7c'],
  [MATERIAL.iron]: ['#38484f', '#9baaa4', '#586970', '#dde3c9'],
  [MATERIAL.cobalt]: ['#262e52', '#788ae9', '#434f99', '#bdceff'],
  [MATERIAL.soil]: ['#6f594e', '#8e6b51', '#513f46', '#ab8056'],
};

const coralColors = [
  ['#7e4268', '#b0667d', '#da9292'],
  ['#39797e', '#64a394', '#97c7ab'],
  ['#786080', '#a68aa0', '#d3a8a4'],
  ['#74674e', '#a08a61', '#d5ab78'],
];

const fishColors = [
  ['#9c7a56', '#d5ab78', '#f0c88b', '#39797e'],
  ['#315563', '#64a394', '#97c7ab', '#efc27e'],
  ['#7e4268', '#b0667d', '#da9292', '#f0c88b'],
  ['#263b51', '#436b6e', '#8bdfd0', '#f8dca5'],
];

const crabColors = [
  ['#7e4268', '#bc775a', '#df9b6b'],
  ['#85604c', '#c09662', '#e3ae72'],
  ['#513a3b', '#b0667d', '#da9292'],
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const drawCharacter = createCharacterRenderer(ctx);
  const caveLight = createCaveLight();
  const surfaceLight = createSurfaceLight();
  const lightCanvas = canvas.ownerDocument.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');
  let lightPixels;

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function polygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
    for (const [x, y] of points.slice(1)) ctx.lineTo(Math.round(x), Math.round(y));
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
    gradient(0, 0, width, surface, [[0, '#30485e'], [.43, '#4d6d7a'], [.77, '#788783'], [1, '#b0a387']], -camera.y, surface);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, surface);
    ctx.clip();
    if (twilight > 0) {
      ctx.globalAlpha = twilight;
      gradient(0, 0, width, surface, [[0, '#37465d'], [.56, '#665e71'], [.82, '#a27568'], [1, '#c19175']], -camera.y, surface);
    }
    if (darkness > 0) {
      ctx.globalAlpha = darkness;
      gradient(0, 0, width, surface, [[0, '#10182e'], [.6, '#202f4b'], [1, '#455675']], -camera.y, surface);
      for (let i = 0; i < 75; i++) {
        const span = width + 12;
        const offset = noise(i, 312) * span - horizontalOffset * 0.12;
        const x = ((offset % span) + span) % span - 6;
        const y = noise(i, 313) * (WATER - 35) - camera.y;
        const size = i % 9 === 0 ? 2 : 1;
        rect(x, y, size, size, i % 4 === 0 ? '#e0e9dd' : '#9baed5ad');
      }
    }

    const bodyX = Math.round(width * (0.86 - 0.72 * skyProgress));
    if (night) {
      const moonY = Math.round(surface + 12 - 159 * altitude);
      ctx.globalAlpha = darkness * (1 - rain * .58);
      for (let row = -12; row < 12; row++) {
        const radius = Math.floor(Math.sqrt(144 - row * row));
        rect(bodyX - radius, moonY + row, radius * 2, 1, row < 5 ? '#e1e7d8' : '#c4d2d0');
      }
      rect(bodyX - 6, moonY - 4, 4, 2, '#b3c3c5');
      rect(bodyX + 3, moonY + 3, 4, 3, '#b3c3c5');
    } else {
      const sunY = Math.round(surface + 20 - 178 * altitude);
      ctx.globalAlpha = 1 - rain * .66;
      const glow = ctx.createRadialGradient(bodyX, sunY, 5, bodyX, sunY, 94);
      for (const [position, color] of [[0, '#f6cf9299'], [.34, '#eeb87c3c'], [1, '#eeb87c00']]) glow.addColorStop(position, color);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, surface);
      for (let row = -20; row < 20; row += 2) {
        const radius = Math.floor(Math.sqrt(400 - row * row));
        rect(bodyX - radius, sunY + row, radius * 2, 2, row < 6 ? '#f5d5a3' : '#e8bb8d');
      }
    }

    ctx.globalAlpha = 1 - darkness * .65;
    for (let i = -2; i < 18; i++) {
      const span = Math.max(960, width + 260);
      const raw = i * 81 + noise(i, 12) * 240 - horizontalOffset * 0.085 + time * (i % 2 ? 0.8 : 1.6);
      const x = ((raw % span) + span) % span - 130;
      const y = 44 + noise(i, 19) * 153 - camera.y;
      const length = 32 + Math.floor(noise(i, 18) * 115);
      rect(x, y, length, 2, '#d5beaa5e');
      rect(x + length * 0.14, y - 3, length * 0.67, 3, '#c9b6a964');
      rect(x + length * 0.24, y - 6, length * 0.43, 3, '#c9b6a93d');
      rect(x + length * 0.28, y + 4, length * 0.79, 1, '#cdb8a631');
    }
    for (let x = -5; x < width + 10; x += 4) {
      const wx = x + horizontalOffset * 0.21;
      const y = surface - 8 - Math.pow(Math.max(0, Math.sin(wx * .0128) * Math.sin(wx * .0049 + 1)), 2) * 30;
      rect(x, y, 4, surface - y + 1, '#5f778067');
      const closer = surface - 3 - Math.pow(Math.max(0, Math.sin(wx * .017 + 1) * Math.cos(wx * .008 + 1)), 2) * 20;
      rect(x, closer, 4, surface - closer + 1, '#425e6c9c');
    }
    ctx.restore();
  }

  function surfaceWave(x, time) {
    return Math.round(Math.sin(x * .062 + time * 1.8) * 1.6 + Math.sin(x * .026 - time * 1.4) * 1.4);
  }

  function rainSplashes(impacts, camera, time, intensity) {
    const offset = Math.round(camera.x);
    ctx.save();
    ctx.strokeStyle = '#c3e5e9';
    ctx.lineWidth = 1;
    for (const { tx, y, water } of impacts) {
      const interval = .58 + noise(tx, 281) * .62;
      const elapsed = time + noise(tx, 282) * interval;
      const strike = Math.floor(elapsed / interval);
      const age = elapsed - strike * interval;
      if (age >= .36) continue;

      const x = tx * TILE + 4 + Math.floor(noise(tx, strike, 283) * 8);
      const screenX = x - offset;
      if (screenX < -7 || screenX > camera.width + 7) continue;
      const progress = age / .36;
      const spread = 1 + progress * (3 + noise(tx, strike, 284) * 3);
      const rise = Math.sin(progress * Math.PI) * 5;
      const surfaceY = water ? y + surfaceWave(x - WEST_EXTENSION * TILE, time) : y;
      ctx.globalAlpha = intensity * (1 - progress) * .88;
      if (water) {
        ctx.beginPath();
        ctx.ellipse(screenX, surfaceY, spread, .8 + progress, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      rect(screenX - spread, surfaceY - 1 - rise, 1, 2, '#d0e8eb');
      rect(screenX + spread, surfaceY - 1 - rise * .7, 1, 2, '#d0e8eb');
    }
    ctx.restore();
  }

  function rain(world, camera, surface, time, intensity) {
    if (intensity <= 0 || surface <= 0) return;
    const { width } = camera;
    const xOffset = Math.round(camera.x);
    const yOffset = Math.round(camera.y);
    const left = Math.floor(xOffset / TILE);
    const right = Math.min(COLS, Math.ceil((xOffset + width) / TILE));
    const impacts = [];
    const bottom = Math.min(ROWS, Math.ceil((camera.y + camera.height + 5) / TILE));
    let rainBottom = 0;
    ctx.save();
    ctx.beginPath();
    for (let tx = left; tx < right; tx++) {
      let ty = 0;
      while (ty <= bottom && !tileAt(world, tx, ty) && !waterTileAt(world, tx, ty)) ty++;
      const height = ty * TILE - yOffset;
      if (height <= 0) continue;
      ctx.rect(tx * TILE - xOffset, 0, TILE, height);
      rainBottom = Math.max(rainBottom, height);
      if (height <= camera.height + 5) impacts.push({ tx, y: height, water: waterTileAt(world, tx, ty) });
    }
    ctx.clip();
    ctx.globalAlpha = intensity * 0.74;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#bed9e0';
    ctx.beginPath();
    // Keep the rain pattern in world coordinates so camera motion only changes what is visible.
    const bandWidth = 64;
    const dropsPerBand = 13;
    const fall = WATER + 28;
    const wind = time * 33;
    const firstBand = Math.floor((xOffset + wind) / bandWidth);
    const endBand = Math.ceil((xOffset + width + 4 + wind) / bandWidth);
    const cutoff = Math.min(rainBottom, camera.height) + 12;
    for (let band = firstBand; band < endBand; band++) {
      for (let drop = 0; drop < dropsPerBand; drop++) {
        const i = band * dropsPerBand + drop;
        const x = (band + noise(i, 271)) * bandWidth - wind - xOffset;
        const speed = 140 + noise(i, 272) * 75;
        const phase = (noise(i, 273) * fall + time * speed) % fall;
        const firstY = phase + Math.ceil((yOffset - phase) / fall) * fall - yOffset;
        for (let y = firstY; y < cutoff; y += fall) {
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x - 4, y);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
    rainSplashes(impacts, camera, time, intensity);
  }

  function waterClip(world, camera) {
    let path;
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
          tx++;
          continue;
        }
        const start = tx++;
        while (tx < right && waterTileAt(world, tx, ty)) tx++;
        path ??= new Path2D();
        path.rect(start * TILE - x, ty * TILE - y, (tx - start) * TILE, TILE);
      }
    }
    return path;
  }

  function ocean(camera, surface, time, conditions, water) {
    const { width, height } = camera;
    if (!water) return;
    ctx.save();
    ctx.clip(water);
    gradient(0, Math.max(0, surface), width, height - Math.max(0, surface),
      [[0, '#307e83'], [.10, '#236a77'], [.24, '#1a4b65'], [.49, '#12364e'], [1, '#081927']], surface, surface + 850);

    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    for (let band = 0; band < 3; band++) {
      const shift = horizontalOffset * (0.17 + band * 0.17);
      const yShift = surface + 65 + band * 59;
      const color = ['#2c7180a8', '#245e72aa', '#1b4b62ae'][band];
      for (let x = 0; x < width; x += 5) {
        const p = x + shift;
        const y = Math.max(0, yShift + Math.sin(p * 0.015 + band * 1.5) * (18 + band * 9) + Math.sin(p * 0.047) * 10);
        if (y < height) rect(x, y, 5, height - y, color);
      }
    }
    if (surface > -200) {
      ctx.globalAlpha = 1 - conditions.darkness * .8 - conditions.rain * (1 - conditions.darkness) * .65;
      for (let i = -2; i < 10; i++) {
        const span = Math.max(width + 190, 900);
        const shift = (i * 124 - horizontalOffset * .37 + Math.sin(time * .5 + i) * 15) % span;
        const x = shift + (shift < -170 ? span : 0) - 45;
        polygon([[x, surface], [x + 16 + noise(i, 5) * 21, surface], [x - 57, surface + 224], [x - 112, surface + 210]], '#b0d8ad12');
        polygon([[x + 6, surface], [x + 13, surface], [x - 49, surface + 182], [x - 73, surface + 189]], '#b2dad015');
      }
      gradient(0, Math.max(0, surface), width, 33, [[0, '#8ed6c15e'], [1, '#56a5a100']], surface, surface + 33);
      rect(0, surface + 2, width, 2, '#7cc4b1');
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 85; i++) {
      const px = noise(i, 141) * (width + 55);
      const py = noise(i, 128) * (height + 40);
      const x = ((px - horizontalOffset * .43 + time * (1 + noise(i, 55) * 4)) % (width + 55) + width + 55) % (width + 55) - 15;
      const y = ((py - camera.y * .66 - time * (1 + noise(i, 11) * 2)) % (height + 40) + height + 40) % (height + 40);
      rect(x, y, 1 + (i % 9 === 0), 1, i % 5 ? '#a3cfb558' : '#d5e8c7ac');
    }
    for (let i = 0; i < 27; i++) {
      const span = width + 180;
      const x = (((i * 73 - horizontalOffset * .55 + time * (i % 2 ? 14 : -11)) % span + span) % span) - 90;
      const y = surface + 35 + noise(i, 12) * 410 + Math.sin(time * 1.9 + i) * 2;
      if (y < 0 || y > height) continue;
      const size = i % 5 === 0 ? 1.4 : 0.8;
      const direction = i % 2 ? 1 : -1;
      const color = i % 5 === 0 ? '#92bba793' : '#6da3a385';
      rect(x, y, 5 * size, 2, color);
      rect(x + 1, y - 1, 3 * size, 4, color);
      rect(x - direction * 2, y - 1, 2 * size, 4, color);
    }
    ctx.restore();
  }

  function drawTile(world, tx, ty, material, oreOpacity) {
    const x = tx * TILE;
    const y = ty * TILE;
    const ore = ORE_MATERIALS.has(material);
    const rock = ore ? (ty >= deepstoneStartAt(tx) ? MATERIAL.deepstone : MATERIAL.stone) : material;
    const [base, light, dark, bright] = palettes[rock];
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
      rect(x + sx, y + sy, 1 + Math.floor(noise(seed, ty, i + 51) * 3), i % 3 ? 1 : 2, i % 2 ? light : dark);
    }
    if (variation < .29 && material !== MATERIAL.sand) {
      const h = 3 + Math.floor(variation * 25);
      rect(x + 2, y + h, 9, 1, dark);
      rect(x + 7, y + h + 1, 6, 1, dark);
    }
    if (top) {
      rect(x, y, 16, 2, light);
      rect(x + Math.floor(variation * 6), y, 5 + Math.floor(variation * 5), 1, bright);
    }
    if (left) rect(x, y + 2, 1, 14, light);
    if (right) rect(x + 14, y + 2, 2, 14, dark);
    if (oreOpacity > 0) {
      const [, mineral, shadow, glint] = palettes[material];
      ctx.globalAlpha = oreOpacity;
      for (let i = 0; i < 3; i++) {
        const px = x + 2 + i * 4;
        const py = y + 3 + Math.floor(noise(seed, ty, 85 + i) * 8);
        const size = i === 1 ? 5 : 4;
        polygon([[px, py + 2], [px + 2, py], [px + size, py + 1], [px + size - 1, py + 4], [px + 1, py + 5]], mineral);
        rect(px + 2, py + 1, size - 2, 1, glint);
        rect(px + 1, py + 4, size - 2, 1, shadow);
      }
      ctx.globalAlpha = 1;
    }
  }

  function coral(x, y, seed) {
    const [shade, mid, tip] = coralColors[Math.floor(noise(seed, 2) * coralColors.length)];
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
      rect(bx + (direction > 0 ? width - 1 : 0), by - height, 2, height + 1, mid);
      rect(bx + (direction > 0 ? width - 1 : 0), by - height, 2, 1, tip);
    }
  }

  function palm(tree) {
    for (const [i, strip] of tree.trunk.entries()) {
      rect(strip.x, strip.y, strip.width, 2, i % 4 === 0 ? '#7f5b4a' : '#9d7557');
      rect(strip.x, strip.y, 2, 2, '#cca177');
    }
    const topX = tree.x + tree.direction * 14;
    const topY = tree.y - tree.height + 1;
    const paths = [[-31, -5, -13], [-28, 11, -4], [-19, -15, -18], [14, -17, -18], [31, -5, -11], [32, 13, -2], [9, 18, 1]];
    for (const [dx, dy, arc] of paths) {
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const px = topX + dx * t;
        const py = topY + dy * t + Math.sin(Math.PI * t) * arc * .63;
        rect(px, py, 5 - t * 3, 5 - t * 3, i % 3 ? '#315e52' : '#50795a');
        if (i < 9) rect(px + (dx > 0 ? 1 : -1), py + 3, 3, 4 - t * 2, '#294d4a');
      }
    }
    rect(topX - 3, topY, 6, 4, '#745747');
  }

  function caveWall(world, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const detail = noise(tx, ty, 91);
    const wet = waterTileAt(world, tx, ty);
    const abyss = ty >= 113;
    const palette = abyss ? ['#21253c', '#1d2134', '#313553'] : ['#233644', '#1f303d', '#304653'];
    const [base, shadow, grain] = wet ? palette : ['#332d2d', '#28262c', '#45383a'];
    rect(x, y, TILE, TILE, base);
    rect(x + Math.floor(detail * 8), y + 3, 6, 1, grain);
    rect(x + 2, y + 10 + Math.floor(detail * 3), 9, 2, shadow);

    if (detail > 0.69 && tileAt(world, tx, ty - 1)) {
      const length = 4 + Math.floor(detail * 13);
      polygon([[x + 2, y], [x + 12, y], [x + 8, y + length]], shadow);
      polygon([[x + 2, y], [x + 6, y], [x + 8, y + length]], grain);
    }
    if (detail < 0.72 || !tileAt(world, tx, ty + 1)) return;
    const floor = y + TILE;
    if (abyss) {
      polygon([[x + 2, floor], [x + 5, floor - 8], [x + 8, floor], [x + 10, floor - 13], [x + 14, floor]], '#55568e');
      polygon([[x + 8, floor], [x + 10, floor - 13], [x + 11, floor - 6]], '#96a5db');
      rect(x + 4, floor - 6, 1, 3, '#a7b2e5');
    } else if (wet) {
      polygon([[x + 7, floor], [x + 2, floor - 7], [x + 4, floor - 11], [x + 8, floor - 8], [x + 12, floor - 12], [x + 15, floor - 8], [x + 10, floor]], '#406e71');
      rect(x + 3, floor - 9, 2, 2, '#86c4b0');
      rect(x + 11, floor - 10, 2, 3, '#86c4b0');
    } else {
      rect(x + 4, floor - 5, 2, 5, '#a98465');
      rect(x + 9, floor - 3, 2, 3, '#a98465');
      rect(x + 2, floor - 7, 6, 3, '#b97658');
      rect(x + 8, floor - 5, 5, 3, '#d7a172');
      rect(x + 4, floor - 7, 2, 1, '#e4ad78');
    }
  }

  function airVent({ x, y }, time) {
    rect(x - 8, y - 4, 16, 4, '#243840');
    rect(x - 5, y - 10, 10, 6, '#395a63');
    rect(x - 7, y - 12, 14, 3, '#64aa9f');
    rect(x - 4, y - 12, 8, 1, '#a4d5b9');
    for (let i = 0; i < 8; i++) {
      const rise = (time * (14 + i % 3 * 2) + i * 6) % 43;
      const offset = Math.sin(rise * 0.17 + i) * (2 + rise * 0.14);
      const size = i % 3 + 2;
      rect(x + offset, y - 14 - rise, size, size / 2, '#ade8cc');
      rect(x + offset + size - 1, y - 13 - rise, 1, size / 2, '#61bcae');
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
    if (surfaceLight.at(tx, ty) === 1 && hasOpenFace(world, tx, ty, player)) return 1;
    return clamp((caveLight.at(tx, ty) - .1) / .45, 0, 1);
  }

  function shadeCaves(world, player, { left, right, top, bottom }) {
    const width = right - left;
    const height = bottom - top;
    if (!lightPixels || lightPixels.width !== width || lightPixels.height !== height) {
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
        const ambient = light < 1 ? caveAmbientAt(world, player, x, y) : 0;
        lightPixels.data[alpha] = (1 - light) * (1 - ambient) * 210;
      }
    }
    lightCtx.putImageData(lightPixels, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightCanvas, left * TILE, top * TILE, width * TILE, height * TILE);
    ctx.restore();
  }

  function terrain(world, player, camera, time, { left, right, top, bottom }) {
    for (let x = left; x < right; x++) {
      const ground = groundAt(x);
      const firstCaveRow = ground < WATER_ROW ? ground + 1 : ground;
      for (let y = top; y < bottom; y++) {
        const material = tileAt(world, x, y);
        const oreOpacity = ORE_MATERIALS.has(material) ? oreOpacityAt(world, player, x, y) : 0;
        if (material) drawTile(world, x, y, material, oreOpacity);
        else if (y >= firstCaveRow) caveWall(world, x, y);
      }
    }

    for (let x = left; x < right; x++) {
      const y = groundAt(x);
      if (y < top - 2 || y > bottom + 2 || !tileAt(world, x, y) || tileAt(world, x, y - 1)) continue;
      const seed = noise(x - WEST_EXTENSION, 44);
      if (y >= 17 && seed > .27) {
        coral(x * TILE + 4 + seed * 8, y * TILE, x - WEST_EXTENSION);
        if (seed > .76) rect(x * TILE + 3, y * TILE - 3, 3, 2, '#d3a9a0');
      } else if (y < 15 && seed > .2) {
        for (let i = 0; i < 4; i++) {
          const bx = x * TILE + 2 + i * 3;
          const h = 2 + Math.floor(noise(x - WEST_EXTENSION, i, 8) * 5);
          rect(bx, y * TILE - h, 1, h, i % 2 ? '#667654' : '#87915f');
        }
      }
    }
    for (const tree of world.trees) {
      if (tree.tx >= left - 2 && tree.tx <= right + 2 && isTreeStanding(world, tree)) palm(tree);
    }

    const wreckColumn = 111 + WEST_EXTENSION;
    const wreckX = wreckColumn * TILE + 8;
    const wreckY = groundAt(wreckColumn) * TILE;
    if (wreckX > camera.x - 120 && wreckX < camera.x + camera.width + 120) {
      polygon([[wreckX - 61, wreckY - 44], [wreckX + 73, wreckY - 34], [wreckX + 53, wreckY - 10], [wreckX - 34, wreckY - 6]], '#213b48');
      polygon([[wreckX - 53, wreckY - 39], [wreckX + 61, wreckY - 30], [wreckX + 50, wreckY - 22], [wreckX - 43, wreckY - 22]], '#4d5450');
      for (let i = 0; i < 7; i++) {
        rect(wreckX - 40 + i * 14, wreckY - 27, 2, 12, '#77745e');
      }
      polygon([[wreckX - 13, wreckY - 34], [wreckX - 21, wreckY - 86], [wreckX - 17, wreckY - 87], [wreckX - 6, wreckY - 34]], '#675b50');
      polygon([[wreckX - 17, wreckY - 84], [wreckX + 21, wreckY - 70], [wreckX - 3, wreckY - 57]], '#527777');
      rect(wreckX - 52, wreckY - 40, 25, 2, '#8a7e62');
    }
    const shelterColumn = 53 + WEST_EXTENSION;
    const shelterX = shelterColumn * TILE;
    const shelterY = groundAt(shelterColumn) * TILE;
    if (tileAt(world, shelterColumn, groundAt(shelterColumn))) {
      polygon([[shelterX - 13, shelterY], [shelterX + 8, shelterY - 28], [shelterX + 25, shelterY], [shelterX + 13, shelterY - 1]], '#536e69');
      polygon([[shelterX - 13, shelterY], [shelterX + 8, shelterY - 28], [shelterX + 5, shelterY], [shelterX - 4, shelterY]], '#7d9690');
      polygon([[shelterX + 6, shelterY], [shelterX + 10, shelterY - 17], [shelterX + 18, shelterY]], '#243a42');
      rect(shelterX + 7, shelterY - 30, 2, 3, '#8d6c52');
    }

    for (const vent of world.vents) {
      if (vent.x >= camera.x - TILE && vent.x <= camera.x + camera.width + TILE &&
          vent.y >= camera.y && vent.y <= camera.y + camera.height + 60) airVent(vent, time);
    }

    const camp = WEST_EXTENSION + ISLAND_CAVE.camp;
    const floor = ISLAND_CAVE.campFloor;
    if (camp >= left && camp < right && floor >= top && floor <= bottom &&
        tileAt(world, camp, floor) && !tileAt(world, camp, floor - 1)) {
      const x = (camp + .5) * TILE;
      const y = floor * TILE;
      rect(x - 1, y - 17, 3, 17, '#664b43');
      rect(x - 6, y - 17, 9, 2, '#956749');
      rect(x - 12, y - 20, 14, 14, '#efb16430');
      rect(x - 8, y - 16, 6, 8, '#5f4d49');
      rect(x - 7, y - 15, 4, 5, '#f5be76');
      rect(x - 6, y - 15, 2, 3, '#ffe3a3');
      rect(x + 4, y - 4, 11, 4, '#71513e');
      rect(x + 5, y - 4, 9, 1, '#b58259');
    }

    for (const item of world.items) {
      if (world.harvested.has(item.id)) continue;
      if (item.x < camera.x - 24 || item.x > camera.x + camera.width + 24) continue;
      const { x, y } = item;
      if (item.kind === 'kelp') {
        for (let leaf = 0; leaf < 3; leaf++) {
          const stemHeight = 17 + Math.floor(noise(Math.round(x), leaf, 19) * 14);
          for (let j = 0; j < stemHeight; j += 2) {
            const sway = Math.sin(time * 1.25 + j * .14 + x * .07 + leaf) * j * .16;
            const sx = x + (leaf - 1) * j * .24 + sway;
            rect(sx, y + 12 - j, 2, 2, leaf % 2 ? '#72a78a' : '#4f947b');
            if (j % 6 === 0 && j > 3) rect(sx - 2, y + 11 - j, 5, 2, '#8fb39a');
          }
        }
      } else if (item.kind === 'cache' || item.kind === 'helmet') {
        const cache = item.kind === 'cache';
        const size = cache ? 19 : 17;
        const base = cache ? '#9f7858' : '#8c6d53';
        const highlight = '#efd089';
        rect(x - size / 2, y - 5, size, 10, '#302d34');
        rect(x - size / 2 + 1, y - 4, size - 2, 8, base);
        rect(x - size / 2, y - 5, size, 2, highlight);
        rect(x - size / 2 + 3, y - 3, 2, 7, '#655449');
        rect(x + size / 2 - 5, y - 3, 2, 7, '#655449');
        rect(x - 1, y - 1, 3, 3, cache ? highlight : '#8bdfd0');
        rect(x, y - 12, 1, 5, '#f1dca4');
        rect(x - 2, y - 10, 5, 1, '#f1dca4');
      }
    }
  }

  function arrows(projectiles, camera) {
    for (const arrow of projectiles ?? []) {
      if (arrow.x < camera.x - 16 || arrow.x > camera.x + camera.width + 16) continue;
      if (arrow.y < camera.y - 16 || arrow.y > camera.y + camera.height + 16) continue;
      ctx.save();
      ctx.translate(Math.round(arrow.x), Math.round(arrow.y));
      ctx.rotate(Math.atan2(arrow.dy, arrow.dx));
      rect(-6, -1, 10, 2, '#85604c');
      rect(-5, -1, 8, 1, '#d29c65');
      rect(-7, -2, 3, 1, '#bed8ba');
      rect(-7, 1, 3, 1, '#7ebcb0');
      polygon([[3, -3], [8, 0], [3, 3]], '#6e888a');
      polygon([[4, -2], [7, 0], [4, 1]], '#d9e1cf');
      ctx.restore();
    }
  }

  function mobs(world, camera, time, targetMob) {
    for (const mob of world.mobs ?? []) {
      if (mob.health <= 0 || mob.respawn > 0) continue;
      if (mob.x < camera.x - 32 || mob.x > camera.x + camera.width + 32) continue;
      if (mob.y < camera.y - 32 || mob.y > camera.y + camera.height + 32) continue;
      ctx.save();
      ctx.translate(Math.round(mob.x), Math.round(mob.y));
      ctx.save();
      if (mob.hurt > 0 && Math.floor(mob.hurt * 18) % 2 === 0) ctx.globalAlpha = 0.6;

      if (mob.kind === 'fish') {
        const [dark, mid, light, stripe] = mob.enemyType?.colors ?? fishColors[mob.variant % fishColors.length];
        if (mob.enemyType) ctx.globalAlpha = clamp(mob.remainingLife / 2, 0, 1);
        const swish = Math.round(Math.sin(time * (mob.flee > 0 ? 14 : 7.5) + mob.phase) * 1.4);
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
        rect(3, -1, 2, 2, '#f1f3e5');
        rect(4, -1, 1, 1, '#192b3e');
        if (mob.enemyType) rect(4, 1, 3, 1, dark);
      } else if (mob.kind === 'crab') {
        const [dark, mid, light] = crabColors[mob.variant % crabColors.length];
        const moving = Math.abs(mob.dx) > 2;
        const step = moving ? Math.round(Math.sin(time * (mob.flee > 0 ? 22 : 15) + mob.phase)) : 0;
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
        rect(-3, -2 - bob, 6, 1, '#d8aa6e');
        rect(-2, -8 - bob, 1, 2, '#192b3e');
        rect(1, -8 - bob, 1, 2, '#192b3e');
        rect(-2, -8 - bob, 1, 1, '#f1f3e5');
        rect(1, -8 - bob, 1, 1, '#f1f3e5');
      } else if (mob.kind === 'jellyfish') {
        const pulse = Math.round(Math.sin(time * 3.1 + mob.phase));
        const charging = (mob.windup ?? 0) > 0;
        const shocking = (mob.shock ?? 0) > 0;
        if (shocking) {
          const radius = 14 + (1 - mob.shock / 0.45) * 44;
          const steps = 28;
          for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2 + time * 5;
            const jitter = Math.sin(i * 3.1 + time * 30) * 2;
            const px = Math.cos(angle) * (radius + jitter);
            const py = Math.sin(angle) * (radius + jitter);
            rect(px - 1, py - 1, 2, 2, i % 2 ? '#8bdfd0' : '#f8dca5');
            if (i % 4 === 0) rect(px * 0.85, py * 0.85, 2, 2, '#d3a8a4');
          }
        }
        for (let i = 0; i < 4; i++) {
          const baseX = -5 + i * 3;
          const length = 9 + (i % 2) * 3;
          for (let j = 0; j < length; j += 2) {
            const sway = Math.round(Math.sin(time * 3.8 + mob.phase + j * 0.42 + i) * 1.6);
            rect(baseX + sway, 2 + j, 1, 2, charging && (i + j) % 2 ? '#8bdfd0' : (i + j) % 2 ? '#a68aa0' : '#d3a8a4');
          }
        }
        rect(-4, -8, 8, 2, charging ? '#8bdfd0' : '#d3a8a4');
        rect(-6 - Math.max(0, pulse), -6, 12 + Math.max(0, pulse) * 2, 4, charging ? '#d3a8a4' : '#a68aa0');
        rect(-7 - pulse, -2, 14 + pulse * 2, 3, '#786080');
        rect(-3, -5, 6, 3, charging && Math.floor(time * 16) % 2 ? '#8bdfd0' : '#f2c9a0');
        rect(-4, -6, 4, 1, '#f8dca5');
        rect(-6, 1, 3, 1, '#d3a8a4');
        rect(-1, 1, 3, 1, '#d3a8a4');
        rect(4, 1, 3, 1, '#d3a8a4');
        if (charging) {
          for (let i = 0; i < 4; i++) {
            const spark = time * 18 + i * 1.6;
            rect(Math.cos(spark) * 10, Math.sin(spark) * 8 - 2, 2, 2, i % 2 ? '#f8dca5' : '#8bdfd0');
          }
        }
      } else if (mob.kind === 'squid') {
        ctx.scale(mob.facing, 1);
        ctx.rotate(clamp(mob.dy * 0.0035, -0.25, 0.25) * mob.facing);
        const pulse = Math.sin(time * 5.4 + mob.phase);
        const charging = (mob.windup ?? 0) > 0;
        for (let i = 0; i < 4; i++) {
          const ty = -4 + i * 2;
          const len = i === 1 || i === 2 ? 9 : 7;
          for (let j = 0; j < len; j += 2) {
            const wave = Math.round(Math.sin(time * 6.2 + mob.phase + j * 0.5 + i) * (1 - pulse * 0.35));
            rect(-4 - j, ty + wave, 2, 1, i % 2 ? '#b0667d' : '#da9292');
          }
        }
        polygon([[4, -3], [8, -7], [10, -2]], '#7e4268');
        polygon([[4, 3], [8, 7], [10, 2]], '#7e4268');
        rect(-3, -4, 11, 8, '#7e4268');
        rect(-2, -3, 10, 5, '#b0667d');
        rect(7, -2, 4, 4, '#b0667d');
        rect(10, -1, 2, 2, '#da9292');
        rect(0, -3, 6, 1, '#da9292');
        rect(3, -1, 2, 1, '#f0c88b');
        rect(-2, -2, 2, 2, '#f1f3e5');
        rect(-2, -1, 1, 1, '#192b3e');
        if (charging) {
          rect(11, -2, 4, 4, '#b0667d');
          rect(12, -1, 2, 2, '#f8dca5');
        }
      } else if (mob.kind === 'shark') {
        ctx.scale(mob.facing, 1);
        ctx.rotate(clamp(mob.dy * 0.0022, -0.18, 0.18) * mob.facing);
        const dashing = (mob.dash ?? 0) > 0;
        const lunging = dashing || (mob.windup ?? 0) > 0;
        const swish = Math.round(Math.sin(time * (dashing ? 16 : 6.4) + mob.phase) * 2);
        if (dashing) {
          rect(-23, -3, 6, 1, '#a1d9cb');
          rect(-26, 1, 8, 1, '#a1d9cb');
        }
        polygon([[-2, -4], [2, -10], [5, -4]], '#263b51');
        rect(1, -8, 2, 4, '#3e5b63');
        rect(-13, -2 + Math.trunc(swish * 0.5), 4, 4, '#2f4858');
        polygon([[-13, -1 + swish], [-19, -7 + swish], [-15, swish]], '#263b51');
        polygon([[-13, 1 + swish], [-18, 6 + swish], [-15, 1 + swish]], '#3e5b63');
        rect(-9, -4, 20, 5, '#2f4858');
        rect(11, -3, 4, 3, '#2f4858');
        rect(-6, -4, 16, 1, '#6d8884');
        rect(-7, 1, 18, 3, '#a5bfb9');
        if (lunging) {
          rect(8, 0, 6, 2, '#111d2f');
          rect(8, 2, 5, 2, '#a5bfb9');
          rect(9, 0, 1, 1, '#f1f3e5');
          rect(11, 0, 1, 1, '#f1f3e5');
          rect(10, 1, 1, 1, '#f1f3e5');
          rect(12, 1, 1, 1, '#f1f3e5');
        } else {
          rect(8, 1, 5, 1, '#192b3e');
          rect(9, 1, 1, 1, '#f1f3e5');
          rect(11, 1, 1, 1, '#f1f3e5');
        }
        rect(9, -2, 2, 2, '#111d2f');
        rect(10, -2, 1, 1, lunging ? '#ff9b80' : '#efc27e');
        rect(4, -2, 1, 3, '#192b3e');
        rect(6, -2, 1, 3, '#192b3e');
        polygon([[1, 2], [-3, 7], [4, 3]], '#263b51');
      }
      ctx.restore();

      if (mob.maxHealth && (mob.health < mob.maxHealth || mob.hurt > 0 || mob === targetMob)) {
        const barWidth = mob.maxHealth >= 7 ? 20 : mob.maxHealth >= 4 ? 14 : 10;
        const barX = -Math.floor(barWidth / 2);
        const barY = mob.kind === 'crab' ? -13 : mob.kind === 'jellyfish' ? -13 : mob.kind === 'shark' ? -14 : -10;
        const hostile = Boolean(mob.enemyType || mob.kind === 'jellyfish' || mob.kind === 'squid' || mob.kind === 'shark');
        rect(barX - 1, barY - 1, barWidth + 2, 4, '#111d2f');
        rect(barX, barY, barWidth, 2, '#283c44');
        rect(barX, barY, Math.ceil(barWidth * (mob.health / mob.maxHealth)), 2, hostile ? '#e57866' : '#efc27e');
      }

      ctx.restore();
    }
  }

  function projectiles(world, camera) {
    for (const bubble of world.projectiles ?? []) {
      if (bubble.x < camera.x - 16 || bubble.x > camera.x + camera.width + 16) continue;
      if (bubble.y < camera.y - 16 || bubble.y > camera.y + camera.height + 16) continue;
      const r = bubble.radius;
      const x = Math.round(bubble.x);
      const y = Math.round(bubble.y);
      rect(x - r - 1, y - r, r * 2 + 2, r * 2, '#252b3b');
      rect(x - r, y - r - 1, r * 2, r * 2 + 2, '#252b3b');
      rect(x - r, y - r, r * 2, r * 2, bubble.color);
      rect(x - r + 1, y - r + 1, Math.max(2, r), Math.max(2, r), '#da9292');
      rect(x - r + 1, y - r + 1, 1, 1, '#f1f3e5');
    }
  }

  function doors(world, player, camera) {
    const [wood, light, dark, brass] = palettes[MATERIAL.wood];
    for (const door of world.doors.values()) {
      const x = door.tx * TILE;
      const y = (door.ty - 1) * TILE;
      const height = 2 * TILE;
      if (x + TILE < camera.x || x > camera.x + camera.width || y + height < camera.y || y > camera.y + camera.height) continue;
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
    for (let x = 0; x < camera.width;) {
      const tx = Math.floor((x + xOffset) / TILE);
      const width = Math.min(3, (tx + 1) * TILE - (x + xOffset));
      if (waterTileAt(world, tx, WATER_ROW)) {
        const phase = x + xOffset - WEST_EXTENSION * TILE;
        const dy = surfaceWave(phase, time);
        rect(x, y + dy, width, 1, '#c3e3c7b9');
        if (noise(Math.floor(phase / 5), 9) > .68) rect(x, y + dy + 4, width, 1, '#a0d5bc93');
      }
      x += width;
    }
  }

  function draw({ world, player, tank, helmet, camera, time, aim, mining, attackSwing, held, attack, hasArrow, playerArrows, targetMob, particles, reducedMotion, conditions, caveShadowsHidden, peers = [] }) {
    const surface = WATER - Math.round(camera.y);
    const water = waterClip(world, camera);
    const bounds = tileBounds(camera);
    caveLight.update(world, player);
    surfaceLight.update(world, player, bounds);
    rect(0, 0, camera.width, camera.height, '#101f33');
    sky(camera, surface, time, conditions);
    ocean(camera, surface, time, conditions, water);
    if (surface > -5 && surface < camera.height + 5) surfaceLine(world, camera, surface, time);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    terrain(world, player, camera, time, bounds);
    doors(world, player, camera);
    mobs(world, camera, time, targetMob);
    projectiles(world, camera);
    arrows(playerArrows, camera);
    for (const bit of particles) {
      rect(bit.x, bit.y, 2, 2, bit.color ?? palettes[bit.material][1]);
    }
    for (const remote of peers) {
      if (remote.x < camera.x - 16 || remote.x > camera.x + camera.width + 16 ||
          remote.y < camera.y - 25 || remote.y > camera.y + camera.height + 25) continue;
      drawCharacter(remote, remote.appearance, { tank: remote.tank, helmet: remote.helmet, time, reducedMotion, swimming: playerInWater(world, remote) });
      polygon([[remote.x, remote.y - 9], [remote.x + 3, remote.y - 6],
        [remote.x, remote.y - 3], [remote.x - 3, remote.y - 6]], '#a6eee0');
    }
    drawCharacter(player, player.appearance, { tank, helmet, time, mining, attackSwing, held, attack, hasArrow, reducedMotion, swimming: playerInWater(world, player) });
    if (!caveShadowsHidden) shadeCaves(world, player, bounds);
    ctx.restore();

    const shade = conditions.darkness * 0.48 + conditions.rain * 0.21;
    if (shade > 0) {
      ctx.save();
      ctx.globalAlpha = shade;
      rect(0, 0, camera.width, camera.height, '#111933');
      ctx.restore();
    }
    rain(world, camera, surface, time, conditions.rain);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    if (aim?.reachable && !ITEMS[held]?.weapon) {
      ctx.strokeStyle = '#f4d4a5ad';
      ctx.lineWidth = 1;
      ctx.strokeRect(aim.tx * TILE + .5, aim.ty * TILE + .5, TILE - 1, TILE - 1);
    }
    if (mining) {
      const x = mining.tx * TILE + 2;
      const y = (mining.ty + 1) * TILE - 5;
      const width = TILE - 4;
      rect(x - 1, y - 1, width + 2, 4, '#1b2733');
      rect(x, y, Math.ceil(width * mining.progress), 2, '#f4d4a5');
    }
    ctx.restore();

    if (water) {
      ctx.save();
      ctx.clip(water);
      const start = Math.max(0, surface);
      gradient(0, start, camera.width, camera.height - start, [[0, '#183d4e07'], [.36, '#0a30422b'], [1, '#06152666']], surface, surface + 980);
      ctx.restore();
    }
  }

  function projectiles(world, camera) {
    for (const bubble of world.projectiles ?? []) {
      if (bubble.x < camera.x - 16 || bubble.x > camera.x + camera.width + 16) continue;
      if (bubble.y < camera.y - 16 || bubble.y > camera.y + camera.height + 16) continue;
      const r = bubble.radius;
      const x = Math.round(bubble.x);
      const y = Math.round(bubble.y);
      rect(x - r - 1, y - r, r * 2 + 2, r * 2, '#252b3b');
      rect(x - r, y - r - 1, r * 2, r * 2 + 2, '#252b3b');
      rect(x - r, y - r, r * 2, r * 2, bubble.color);
      rect(x - r + 1, y - r + 1, Math.max(2, r), Math.max(2, r), '#da9292');
      rect(x - r + 1, y - r + 1, 1, 1, '#f1f3e5');
    }
  }

  return { draw };
}
