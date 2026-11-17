import { COLS, ROWS, TILE, WATER, WEST_EXTENSION, MATERIAL, clamp, isTreeStanding, noise, tileAt } from './world.js';

const palettes = {
  [MATERIAL.sand]: ['#c6a56e', '#e0be84', '#9c7a56', '#f0c88b'],
  [MATERIAL.stone]: ['#2f4858', '#3e5b63', '#263b51', '#6d8884'],
  [MATERIAL.reef]: ['#436b6e', '#608781', '#315563', '#8eb096'],
  [MATERIAL.wood]: ['#85604c', '#bc8b62', '#513a3b', '#e3ae72'],
  [MATERIAL.bedrock]: ['#192b3e', '#24374a', '#111d2f', '#35485a'],
  [MATERIAL.copper]: ['#35464d', '#bc7659', '#704d4b', '#efae7c'],
  [MATERIAL.iron]: ['#38484f', '#9baaa4', '#586970', '#dde3c9'],
  [MATERIAL.cobalt]: ['#262e52', '#788ae9', '#434f99', '#bdceff'],
  [MATERIAL.soil]: ['#6f594e', '#8e6b51', '#513f46', '#ab8056'],
};

const oreMaterials = new Set([MATERIAL.copper, MATERIAL.iron, MATERIAL.cobalt]);

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

  function sky(camera, surface, time) {
    if (surface <= 0) return;
    const { width } = camera;
    gradient(0, 0, width, surface, [[0, '#35536a'], [.43, '#62848a'], [.77, '#a9a28e'], [1, '#ebbf8c']], -camera.y, surface);
    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    const sunX = Math.round(width * 0.76 - (horizontalOffset - 550) * 0.12);
    const sunY = Math.round(WATER - 112 - camera.y);
    const glow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 130);
    for (const [position, color] of [[0, '#ffdea4aa'], [.31, '#ffcb8e36'], [1, '#ffca8600']]) glow.addColorStop(position, color);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, surface);
    for (let row = -24; row < 24; row += 2) {
      const radius = Math.floor(Math.sqrt(24 * 24 - row * row));
      rect(sunX - radius, sunY + row, radius * 2, 2, row < 6 ? '#f8dca5' : '#efc692');
    }
    for (let i = -2; i < 18; i++) {
      const span = Math.max(960, width + 260);
      const raw = i * 81 + noise(i, 12) * 240 - horizontalOffset * 0.085 + time * (i % 2 ? 0.8 : 1.6);
      const x = ((raw % span) + span) % span - 130;
      const y = 44 + noise(i, 19) * 153 - camera.y;
      const length = 32 + Math.floor(noise(i, 18) * 115);
      rect(x, y, length, 2, '#f2c9a06e');
      rect(x + length * 0.14, y - 3, length * 0.67, 3, '#e7c4a474');
      rect(x + length * 0.24, y - 6, length * 0.43, 3, '#e7c4a449');
      rect(x + length * 0.28, y + 4, length * 0.79, 1, '#ebc3a33f');
    }
    for (let x = -5; x < width + 10; x += 4) {
      const wx = x + horizontalOffset * 0.21;
      const y = surface - 8 - Math.pow(Math.max(0, Math.sin(wx * .0128) * Math.sin(wx * .0049 + 1)), 2) * 30;
      rect(x, y, 4, surface - y + 1, '#5f778067');
      const closer = surface - 3 - Math.pow(Math.max(0, Math.sin(wx * .017 + 1) * Math.cos(wx * .008 + 1)), 2) * 20;
      rect(x, closer, 4, surface - closer + 1, '#425e6c9c');
    }
  }

  function ocean(camera, surface, time) {
    const { width, height } = camera;
    if (surface >= height) return;
    gradient(0, Math.max(0, surface), width, height - Math.max(0, surface),
      [[0, '#307e83'], [.10, '#236a77'], [.24, '#1a4b65'], [.49, '#12364e'], [1, '#081927']], surface, surface + 850);

    const horizontalOffset = camera.x - WEST_EXTENSION * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(0, surface), width, height);
    ctx.clip();
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
      for (let i = -2; i < 10; i++) {
        const span = Math.max(width + 190, 900);
        const shift = (i * 124 - horizontalOffset * .37 + Math.sin(time * .5 + i) * 15) % span;
        const x = shift + (shift < -170 ? span : 0) - 45;
        polygon([[x, surface], [x + 16 + noise(i, 5) * 21, surface], [x - 57, surface + 224], [x - 112, surface + 210]], '#b0d8ad12');
        polygon([[x + 6, surface], [x + 13, surface], [x - 49, surface + 182], [x - 73, surface + 189]], '#b2dad015');
      }
      gradient(0, Math.max(0, surface), width, 33, [[0, '#8ed6c15e'], [1, '#56a5a100']], surface, surface + 33);
      rect(0, surface + 2, width, 2, '#7cc4b1');
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

  function drawTile(world, tx, ty, material) {
    const x = tx * TILE;
    const y = ty * TILE;
    const [base, light, dark, bright] = palettes[material];
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
      rect(x + sx, y + sy, 1 + Math.floor(noise(seed, ty, i + 51) * 3), i % 3 ? 1 : 2, i % 2 && !oreMaterials.has(material) ? light : dark);
    }
    if (oreMaterials.has(material)) {
      for (let i = 0; i < 3; i++) {
        const px = x + 2 + i * 4;
        const py = y + 3 + Math.floor(noise(seed, ty, 85 + i) * 8);
        const size = i === 1 ? 5 : 4;
        polygon([[px, py + 2], [px + 2, py], [px + size, py + 1], [px + size - 1, py + 4], [px + 1, py + 5]], light);
        rect(px + 2, py + 1, size - 2, 1, bright);
        rect(px + 1, py + 4, size - 2, 1, dark);
      }
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
    const abyss = ty >= 113;
    const [base, shadow, grain] = abyss ? ['#21253c', '#1d2134', '#313553'] : ['#233644', '#1f303d', '#304653'];
    rect(x, y, TILE, TILE, base);
    rect(x + Math.floor(detail * 8), y + 3, 6, 1, grain);
    rect(x + 2, y + 10 + Math.floor(detail * 3), 9, 2, shadow);

    if (detail > 0.69 && tileAt(world, tx, ty - 1)) {
      const length = 4 + Math.floor(detail * 13);
      polygon([[x + 2, y], [x + 12, y], [x + 8, y + length]], shadow);
      polygon([[x + 2, y], [x + 6, y], [x + 8, y + length]], grain);
    }
    if (abyss && detail > 0.78 && tileAt(world, tx, ty + 1)) {
      const floor = y + TILE;
      polygon([[x + 2, floor], [x + 5, floor - 8], [x + 8, floor], [x + 10, floor - 13], [x + 14, floor]], '#55568e');
      polygon([[x + 8, floor], [x + 10, floor - 13], [x + 11, floor - 6]], '#96a5db');
      rect(x + 4, floor - 6, 1, 3, '#a7b2e5');
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

  function terrain(world, camera, time) {
    const left = Math.max(0, Math.floor(camera.x / TILE) - 1);
    const right = Math.min(COLS, Math.ceil((camera.x + camera.width) / TILE) + 1);
    const top = Math.max(0, Math.floor(camera.y / TILE) - 1);
    const bottom = Math.min(ROWS, Math.ceil((camera.y + camera.height) / TILE) + 1);
    for (let x = left; x < right; x++) {
      for (let y = top; y < bottom; y++) {
        const material = tileAt(world, x, y);
        if (material) drawTile(world, x, y, material);
        else if (y >= world.ground[x]) caveWall(world, x, y);
      }
    }

    for (let x = left; x < right; x++) {
      const y = world.ground[x];
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
    const wreckY = world.ground[wreckColumn] * TILE;
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
    const shelterY = world.ground[shelterColumn] * TILE;
    if (tileAt(world, shelterColumn, world.ground[shelterColumn])) {
      polygon([[shelterX - 13, shelterY], [shelterX + 8, shelterY - 28], [shelterX + 25, shelterY], [shelterX + 13, shelterY - 1]], '#536e69');
      polygon([[shelterX - 13, shelterY], [shelterX + 8, shelterY - 28], [shelterX + 5, shelterY], [shelterX - 4, shelterY]], '#7d9690');
      polygon([[shelterX + 6, shelterY], [shelterX + 10, shelterY - 17], [shelterX + 18, shelterY]], '#243a42');
      rect(shelterX + 7, shelterY - 30, 2, 3, '#8d6c52');
    }

    for (const vent of world.vents) {
      if (vent.x >= camera.x - TILE && vent.x <= camera.x + camera.width + TILE &&
          vent.y >= camera.y && vent.y <= camera.y + camera.height + 60) airVent(vent, time);
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
      } else if (item.kind === 'cache') {
        const size = 19;
        const highlight = '#efd089';
        rect(x - size / 2, y - 5, size, 10, '#302d34');
        rect(x - size / 2 + 1, y - 4, size - 2, 8, '#9f7858');
        rect(x - size / 2, y - 5, size, 2, highlight);
        rect(x - size / 2 + 3, y - 3, 2, 7, '#655449');
        rect(x + size / 2 - 5, y - 3, 2, 7, '#655449');
        rect(x - 1, y - 1, 3, 3, highlight);
        rect(x, y - 12, 1, 5, '#f1dca4');
        rect(x - 2, y - 10, 5, 1, '#f1dca4');
      }
    }
  }

  function miningArm(targetX, targetY, tilt, phase) {
    const angle = clamp(Math.atan2(targetY - 12, targetX), -1.05, 1.15);
    const swing = 0.52 * (1 - Math.cos(phase * 2 * Math.PI));
    ctx.save();
    ctx.translate(2, 12);
    ctx.rotate(angle - tilt - swing);
    rect(-1, -2, 3, 4, '#df9b6b');
    rect(1, -1, 6, 3, '#e8b57b');
    rect(5, 0, 3, 2, '#e9ad81');
    rect(7, -1, 7, 2, '#85604c');
    rect(8, -1, 5, 1, '#d29c65');
    rect(12, -4, 3, 8, '#6e888a');
    rect(13, -3, 2, 6, '#b5c6bd');
    rect(12, -4, 2, 1, '#d9e1cf');
    ctx.restore();
  }

  function mobs(world, camera, time) {
    for (const mob of world.mobs ?? []) {
      if (mob.x < camera.x - 24 || mob.x > camera.x + camera.width + 24) continue;
      if (mob.y < camera.y - 24 || mob.y > camera.y + camera.height + 24) continue;
      ctx.save();
      ctx.translate(Math.round(mob.x), Math.round(mob.y));

      if (mob.kind === 'fish') {
        const [dark, mid, light, stripe] = fishColors[mob.variant % fishColors.length];
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
      }

      ctx.restore();
    }
  }

  function diver(player, tank, time, mining, reducedMotion) {
    const swimming = player.y + 11 > WATER;
    const stride = Math.abs(player.dx) > 9 ? Math.round(Math.sin(time * (swimming ? 13 : 24)) * 2) : 0;
    const targetX = mining ? (mining.tx + 0.5) * TILE - player.x : 0;
    const facing = Math.sign(targetX) || player.facing;
    const tilt = swimming ? clamp(player.dy * .0018, -.23, .23) * facing : 0;
    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    ctx.scale(facing, 1);
    if (swimming) ctx.rotate(tilt);
    rect(-4, 1, 9, 7, '#392e36');
    rect(-3, 0, 7, 3, '#56403c');
    rect(-2, 4, 7, 5, '#dcb484');
    rect(4, 5, 2, 3, '#dcb484');
    rect(2, 5, 2, 1, '#463d3e');
    rect(-3, 8, 8, 3, '#d8aa6e');
    rect(-4, 10, 9, 7, swimming ? '#a76e59' : '#bc775a');
    rect(-4, 10, 8, 2, '#df9b6b');
    if (!mining) {
      rect(1, 12, 3, 4, '#e8b57b');
      rect(3 + (swimming ? 2 : 0), 13, 3, 3, '#e9ad81');
    }
    rect(-4, 17, 8, 2, '#483d42');
    rect(-4, 18, 3, 4 + stride, '#344956');
    rect(1, 18, 3, 4 - stride, '#52616a');
    rect(-4 - Number(swimming), 21 + stride, 4, 2, '#242f40');
    rect(1, 21 - stride, 4 + Number(swimming), 2, '#242f40');
    if (tank) {
      rect(-7, 9, 3, 10, '#7ebcb0');
      rect(-7, 10, 1, 6, '#bed8ba');
      rect(-6, 8, 2, 1, '#d2a673');
    }
    if (mining) {
      const targetY = (mining.ty + 0.5) * TILE - player.y;
      const swings = Math.round(mining.duration / 0.26);
      miningArm(Math.abs(targetX), targetY, tilt, reducedMotion ? 0 : mining.progress * swings);
    }
    if (swimming) {
      for (let i = 0; i < 3; i++) {
        const rise = (time * 18 + i * 9) % 27;
        const dx = 6 + Math.sin(rise * .27 + i) * 3;
        rect(dx, 5 - rise, 2, 1, '#a1d9cb');
        rect(dx - 1, 6 - rise, 1, 1, '#7ebdbb');
      }
    }
    ctx.restore();
  }

  function surfaceLine(width, y, xOffset, time) {
    for (let x = 0; x < width; x += 3) {
      const dy = Math.round(Math.sin((x + xOffset) * .062 + time * 1.8) * 1.6 + Math.sin((x + xOffset) * .026 - time * 1.4) * 1.4);
      rect(x, y + dy, 3, 1, '#c3e3c7b9');
      if (noise(Math.floor((x + xOffset) / 5), 9) > .68) rect(x, y + dy + 4, 3, 1, '#a0d5bc93');
    }
  }

  function draw({ world, player, tank, camera, time, aim, mining, particles, reducedMotion }) {
    const surface = Math.round(WATER - camera.y);
    rect(0, 0, camera.width, camera.height, '#101f33');
    sky(camera, surface, time);
    ocean(camera, surface, time);
    if (surface > -5 && surface < camera.height + 5) surfaceLine(camera.width, surface, Math.round(camera.x) - WEST_EXTENSION * TILE, time);

    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    terrain(world, camera, time);
    mobs(world, camera, time);
    for (const bit of particles) {
      rect(bit.x, bit.y, 2, 2, palettes[bit.material][1]);
    }
    diver(player, tank, time, mining, reducedMotion);
    if (aim?.reachable) {
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

    if (surface < camera.height) {
      const start = Math.max(0, surface);
      gradient(0, start, camera.width, camera.height - start, [[0, '#183d4e07'], [.36, '#0a30422b'], [1, '#06152666']], surface, surface + 980);
    }
  }

  return { draw };
}
