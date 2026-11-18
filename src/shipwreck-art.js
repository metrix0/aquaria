import { MATERIAL } from './content.js';
import { tileAt } from './world.js';
import { TILE, WEST_EXTENSION, noise } from './world/generation.js';
import { shipwreckOrigin, shipwreckTimberAt } from './world/shipwreck.js';

const originX = (shipwreckOrigin.column + WEST_EXTENSION) * TILE;
const originY = shipwreckOrigin.row * TILE;
const hull = [
  [0, 16], [1, 17.7], [5.4, 17.5], [6.2, 20.4], [12.2, 20.9], [15.5, 21.7],
  [20.6, 21.4], [22.2, 23.9], [21.5, 25.4], [24.4, 24], [23.6, 22.7],
  [25.5, 22.1], [35.6, 22], [39.7, 19.9], [43.5, 16.8], [45.7, 14.4],
  [43.5, 18.7], [39.8, 23.8], [35.5, 27.4], [30.3, 31.5], [25.2, 34.3],
  [19.8, 35.9], [15.3, 35.9], [10.7, 34.1], [7.4, 31], [3.2, 27.3], [.4, 22.5],
];
const framing = [[1, 19], [1, 23], [3, 27], [9, 32], [14, 35], [19, 35], [24, 32], [27, 30], [35, 26], [38, 23], [41, 18], [44, 15]];
const mastJoints = [
  [[14, 8], [15, 9]], [[15, 15], [16, 16]], [[16, 22], [17, 23]],
];
const sails = [
  {
    anchor: [14, 3],
    sheet: [[10.3, 3.8], [15.1, 3.7], [18.8, 3.9], [19.5, 6.1], [21.5, 8.1], [19.9, 8.4], [20.6, 10.7], [19.2, 10], [18.5, 12.2], [16.7, 11.2], [13.4, 13.2], [13.1, 11.7], [11.2, 13.5], [8.7, 14.2], [9.3, 12.1], [7.6, 13.2], [8.7, 10.2], [9.3, 7.4]],
    folds: [[[12, 3.8], [12.1, 6.7], [11.2, 10.9], [9.8, 13.5]], [[15.6, 3.8], [16.9, 7.3], [16.6, 11.3], [15, 13]], [[18, 3.8], [19.5, 7.5], [20.3, 10.6]]],
    tears: [[[10.7, 9.5], [12.3, 8.8], [12.1, 9.8], [11.3, 10.9], [11.4, 9.9]], [[16.9, 6.5], [18.1, 6.1], [17.8, 6.8], [18.7, 7.4], [17.5, 7.3]]],
    rigging: [[[14.4, 1.4], [10.7, 8.6], [6.1, 19.8]], [[14.4, 1.4], [19.7, 6.5], [25.7, 18.4]]],
  },
  {
    anchor: [31, 10],
    sheet: [[28.2, 10.8], [34.9, 10.7], [34.8, 12.5], [36.7, 15.1], [35.2, 14.8], [35.9, 16.9], [34.1, 16.3], [33.7, 17.8], [31.9, 16.8], [29.6, 18.8], [29.8, 17.1], [27.1, 18.4], [27.3, 16.7], [25.9, 17], [27.2, 13.7]],
    folds: [[[30.1, 10.7], [29.9, 13.6], [28.3, 17.9]], [[33.1, 10.7], [34.4, 14.3], [34.1, 16.8]]],
    tears: [[[29.9, 14.2], [31.9, 13.4], [31.4, 14.2], [30.3, 15.1]]],
    rigging: [[[31.5, 8.6], [34.7, 13], [39.9, 19.9]], [[31.5, 8.6], [27.4, 12.1], [23.1, 19.7]]],
  },
];

function tracedPath(ctx, points, closed = true) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](Math.round(x * TILE), Math.round(y * TILE));
  }
  if (closed) ctx.closePath();
}

function stroke(ctx, points, color, width) {
  tracedPath(ctx, points, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function fill(ctx, points, color) {
  tracedPath(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
}

function paintHull(ctx) {
  ctx.save();
  tracedPath(ctx, hull);
  ctx.clip();
  const shade = ctx.createLinearGradient(0, 16 * TILE, 0, 36 * TILE);
  shade.addColorStop(0, '#536461');
  shade.addColorStop(.38, '#354c50');
  shade.addColorStop(1, '#233744');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 16 * TILE, 46 * TILE, 20 * TILE);

  // Long runs of planking follow the sheer of the hull instead of the tile grid.
  for (let i = 0; i < 21; i++) {
    const row = 16 + i * .91;
    const seam = [[0, row - 1.2], [7, row - .35], [16, row + .35], [23, row + .45],
      [32, row + .05], [40, row - .7], [46, row - 2.3]];
    stroke(ctx, seam, '#172d38', 2);
    stroke(ctx, seam.map(([x, y]) => [x, y + .14]), '#67817b53', 1);
    for (let x = 1 + i % 4; x < 46; x += 5.6) {
      const y = row + (x < 7 ? (x - 7) * .12 : x > 34 ? (34 - x) * .12 : .28);
      stroke(ctx, [[x, y + .12], [x - .08, y + .66]], '#172d386b', 1);
    }
  }

  for (const [head, foot] of [[3, 8], [8, 12], [14, 16], [21, 20], [28, 24], [35, 28], [40, 31]]) {
    const rib = [[head, 21], [(head * 2 + foot) / 3, 27], [foot, 36]];
    stroke(ctx, rib, '#233641', 7);
    stroke(ctx, rib.map(([x, y]) => [x + .21, y]), '#66776b6b', 2);
  }

  const wale = [[0, 22.6], [7, 24.3], [14, 24.8], [24, 25.25], [32, 24.5], [39, 22.8], [46, 18.7]];
  stroke(ctx, wale, '#243941', 7);
  stroke(ctx, wale.map(([x, y]) => [x, y + .18]), '#7c8064', 2);
  for (const x of [2.3, 4.3, 6.3, 8.3]) {
    fill(ctx, [[x, 20.15], [x + .55, 19.9], [x + 1.1, 20.24], [x + 1.1, 21.85], [x, 21.72]], '#7a8061');
    fill(ctx, [[x + .14, 20.28], [x + .55, 20.1], [x + .96, 20.37], [x + .96, 21.62], [x + .14, 21.55]], '#203841');
    stroke(ctx, [[x + .55, 20.2], [x + .55, 21.66]], '#95a286', 1);
    stroke(ctx, [[x + .16, 20.92], [x + .95, 21.02]], '#788775', 1);
  }

  // A jagged opening in the side shows ocean behind the broken ribs.
  ctx.globalCompositeOperation = 'destination-out';
  fill(ctx, [[11.4, 29.1], [12.7, 28.6], [12.4, 30], [14.5, 28.9], [14.1, 30],
    [15.3, 30.2], [14.1, 31.6], [14.5, 33], [13, 32.3], [12.3, 33.8], [11.8, 31.9], [10.4, 31.6]], '#000');
  fill(ctx, [[22.2, 23.6], [23.3, 23.5], [22.9, 25], [24.2, 25.3], [23.4, 26.8], [23.1, 28.3],
    [22.5, 27.2], [21.2, 27.6], [22, 26], [21, 25]], '#000');
  ctx.restore();
}

function paintSail(ctx, { sheet, folds, tears, rigging }) {
  for (const rope of rigging) {
    stroke(ctx, rope, '#182e3bc9', 3);
    stroke(ctx, rope.map(([x, y]) => [x + .06, y]), '#788d7da8', 1);
  }
  const slope = ctx.createLinearGradient(0, sheet[0][1] * TILE, 0, (sheet[0][1] + 10) * TILE);
  slope.addColorStop(0, '#a1aa8d');
  slope.addColorStop(.5, '#808d77');
  slope.addColorStop(1, '#556f67');
  fill(ctx, sheet, slope);
  ctx.save();
  tracedPath(ctx, sheet);
  ctx.clip();
  for (const fold of folds) {
    stroke(ctx, fold, '#314e51', 5);
    stroke(ctx, fold.map(([x, y]) => [x + .22, y]), '#c8c7a366', 2);
  }
  stroke(ctx, sheet.concat([sheet[0]]), '#ced0a6aa', 3);
  const [[x, y]] = sheet;
  for (let i = 0; i < 33; i++) {
    ctx.fillStyle = i % 2 ? '#c3c8a152' : '#25474c52';
    ctx.fillRect(Math.round((x - 3.5 + noise(i, y, 110) * 14) * TILE),
      Math.round((y + noise(i, x, 111) * 10) * TILE), 2 + i % 5, 1);
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const tear of tears) fill(ctx, tear, '#000');
  ctx.restore();
}

export function createShipwreckArt(canvas, context) {
  function layer(paint) {
    const sprite = canvas.ownerDocument.createElement('canvas');
    sprite.width = 46 * TILE;
    sprite.height = 36 * TILE;
    paint(sprite.getContext('2d'));
    return sprite;
  }

  const hullArt = layer(paintHull);
  const sailArt = sails.map((sail) => ({ anchor: sail.anchor, sprite: layer((ctx) => paintSail(ctx, sail)) }));
  const standing = (world, x, y) => tileAt(world, originX / TILE + x, originY / TILE + y) === MATERIAL.wood;

  function backdrop(world, { left, right, top, bottom }) {
    if (right * TILE <= originX || left * TILE >= originX + hullArt.width ||
        bottom * TILE <= originY || top * TILE >= originY + hullArt.height) return;
    context.save();
    for (const { anchor: [x, y], sprite } of sailArt) {
      if (standing(world, x, y)) context.drawImage(sprite, originX, originY);
    }
    // When the wreck is stripped, the far side fades with the remaining framing.
    context.globalAlpha = framing.filter(([x, y]) => standing(world, x, y)).length / framing.length;
    context.drawImage(hullArt, originX, originY);
    context.restore();
  }

  function fittings(world, { left, right, top, bottom }) {
    if (right * TILE <= originX || left * TILE >= originX + 50 * TILE ||
        bottom * TILE <= originY || top * TILE >= originY + 36 * TILE) return;
    context.save();
    context.translate(originX, originY);
    for (const [[x1, y1], [x2, y2]] of mastJoints) {
      if (!standing(world, x1, y1) || !standing(world, x2, y2)) continue;
      const bend = [[x1 + .5, y1 + .58], [x1 + .55, y1 + .94], [x2 + .44, y2 + .38]];
      stroke(context, bend, '#554436', 9);
      stroke(context, bend.map(([x, y]) => [x - .18, y]), '#a88a60', 2);
    }
    if (standing(world, 45, 14)) {
      const spar = [[44.8, 15.2], [46.75, 13.75], [48.9, 12.7], [49.05, 12.9]];
      stroke(context, spar, '#564334', 7);
      stroke(context, spar.map(([x, y]) => [x, y - .13]), '#a38761', 2);
      stroke(context, [[47, 13.5], [46.9, 13.9]], '#879888', 3);
      stroke(context, [[47.05, 13.6], [46.6, 15.8], [45.8, 17.5]], '#374b4c', 2);
    }
    if (standing(world, 0, 17)) {
      stroke(context, [[.5, 17.8], [-.28, 17.9], [-.25, 18.55]], '#4b5146', 3);
      fill(context, [[-.52, 18.55], [.01, 18.53], [.13, 18.77], [.03, 19.35], [-.49, 19.39], [-.59, 18.8]], '#6f725a');
      fill(context, [[-.36, 18.73], [-.13, 18.72], [-.08, 19.17], [-.36, 19.2]], '#b59c6e');
    }
    context.restore();
  }

  function timber(world, tx, ty, material) {
    if (material !== MATERIAL.wood || !shipwreckTimberAt(tx - WEST_EXTENSION, ty)) return false;
    const x = tx * TILE;
    const y = ty * TILE;
    const row = (y - originY) / TILE;
    const col = (x - originX) / TILE;
    const tone = noise(col, row, 48);
    const above = shipwreckTimberAt(tx - WEST_EXTENSION, ty - 1);
    const below = shipwreckTimberAt(tx - WEST_EXTENSION, ty + 1);
    const left = shipwreckTimberAt(tx - WEST_EXTENSION - 1, ty);
    const right = shipwreckTimberAt(tx - WEST_EXTENSION + 1, ty);
    const vertical = row < 22 && (above || below) && !left && !right;
    const rect = (dx, dy, width, height, color) => {
      context.fillStyle = color;
      context.fillRect(x + dx, y + dy, width, height);
    };
    if (vertical) {
      rect(0, 0, TILE, TILE, '#513e36');
      rect(2, 0, 11, TILE, '#7a5d46');
      rect(4, 0, 2, TILE, '#ac8b64');
      rect(10, 0, 1, TILE, '#59493c');
      rect(7, 2 + Math.floor(tone * 5), 1, 7, '#8e7152');
      if (row % 4 === 1) {
        rect(0, 5, TILE, 4, '#35494a');
        rect(0, 5, TILE, 1, '#819085');
      }
    } else {
      rect(0, 0, TILE, TILE, tone > .5 ? '#66503f' : '#705743');
      rect(0, 6, TILE, 4, '#57473c');
      rect(0, 10, TILE, 4, '#695440');
      rect(0, 5, TILE, 1, '#4d3f36');
      rect(0, 14, TILE, 2, '#3b3b36');
      if (tileAt(world, tx, ty - 1) !== MATERIAL.wood) {
        rect(0, 0, TILE, 3, '#9e8964');
        rect(0, 3, TILE, 1, '#bc9b71');
      }
      rect(2 + Math.floor(tone * 5), 8, 6, 1, '#80664c');
      rect(4, 12, 2, 2, '#434b42');
      if (tone > .77) {
        rect(0, 9, 5, 2, '#577362');
        rect(0, 10, 2, 2, '#7b9275');
      }
    }
    return true;
  }

  return { backdrop, fittings, timber };
}
