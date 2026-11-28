import { MATERIAL } from './content.js';
import { tileAt } from './world.js';
import { TILE, WEST_EXTENSION, noise } from './world/generation.js';
import { shipwreckBlueprintHullRows, shipwreckHullRows, shipwreckOrigin, shipwreckTimberAt, WRECK_SCALE_X, WRECK_SCALE_Y, WRECK_WIDTH, WRECK_HEIGHT, wreckColumn, wreckRow } from './world/shipwreck.js';

const originX = (shipwreckOrigin.column + WEST_EXTENSION) * TILE;
const originY = shipwreckOrigin.row * TILE;
const weatherDeck = [
  [0, 18.5], [5.5, 18.5], [5.5, 21.45], [12.5, 21.45], [13.5, 22.48], [19.55, 22.48],
  [20.4, 23.4], [20.05, 24.4], [21.7, 25.5], [21.4, 26.2], [23.3, 24.9], [24.45, 23.35],
  [25.5, 22.48], [35.45, 22.47], [36.65, 21.5], [39.4, 21.45], [39.65, 20.5],
  [40.6, 19.53], [41.54, 18.55], [42.5, 17.55], [43.5, 16.55], [44.52, 15.55],
  [45.54, 14.5], [46, 14.25], [46, 36], [0, 36],
];
const rigging = [
  [[14.5, 1.43], [9.15, 8.35], [5.5, 21.44]],
  [[14.5, 1.43], [21.7, 9.05], [25.5, 22.46]],
  [[31.5, 8.49], [29.75, 14.9], [28.6, 22.45]],
  [[31.5, 8.49], [37.1, 12.0], [41.54, 18.55]],
];
const framing = [[1, 19], [1, 23], [3, 27], [9, 32], [14, 35], [19, 35], [24, 32], [27, 30], [35, 26], [38, 23], [41, 18], [44, 15]];
const mastJoints = [
  [[14, 8], [15, 9]], [[15, 15], [16, 16]], [[16, 22], [17, 23]],
];
const sails = [
  {
    yard: [[10, 3], [18, 3]],
    sheet: [[10.3, 3.8], [15.1, 3.7], [18.8, 3.9], [19.5, 6.1], [21.5, 8.1], [19.9, 8.4], [20.6, 10.7], [19.2, 10], [18.5, 12.2], [16.7, 11.2], [13.4, 13.2], [13.1, 11.7], [11.2, 13.5], [8.7, 14.2], [9.3, 12.1], [7.6, 13.2], [8.7, 10.2], [9.3, 7.4]],
    folds: [[[12, 3.8], [12.1, 6.7], [11.2, 10.9], [9.8, 13.5]], [[15.6, 3.8], [16.9, 7.3], [16.6, 11.3], [15, 13]], [[18, 3.8], [19.5, 7.5], [20.3, 10.6]]],
    tears: [[[10.7, 9.5], [12.3, 8.8], [12.1, 9.8], [11.3, 10.9], [11.4, 9.9]], [[16.9, 6.5], [18.1, 6.1], [17.8, 6.8], [18.7, 7.4], [17.5, 7.3]]],
  },
  {
    yard: [[28, 10], [34, 10]],
    sheet: [[28.2, 10.8], [34.9, 10.7], [34.8, 12.5], [36.7, 15.1], [35.2, 14.8], [35.9, 16.9], [34.1, 16.3], [33.7, 17.8], [31.9, 16.8], [29.6, 18.8], [29.8, 17.1], [27.1, 18.4], [27.3, 16.7], [25.9, 17], [27.2, 13.7]],
    folds: [[[30.1, 10.7], [29.9, 13.6], [28.3, 17.9]], [[33.1, 10.7], [34.4, 14.3], [34.1, 16.8]]],
    tears: [[[29.9, 14.2], [31.9, 13.4], [31.4, 14.2], [30.3, 15.1]]],
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
  ctx.beginPath();
  for (const { row, stern, bow } of shipwreckBlueprintHullRows) {
    ctx.rect(stern * TILE, row * TILE, (bow - stern + 1) * TILE, TILE);
  }
  ctx.clip();
  tracedPath(ctx, weatherDeck);
  ctx.clip();
  const shade = ctx.createLinearGradient(0, 16 * TILE, 0, 36 * TILE);
  shade.addColorStop(0, '#786c55');
  shade.addColorStop(.22, '#4e5248');
  shade.addColorStop(.58, '#35484a');
  shade.addColorStop(1, '#253943');
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

  // A row of deep-set gunports, rusty hinges, and remnants of the gilded wale.
  for (const [x,y] of [[5,24],[9,24.4],[14,25],[19,25.1],[26,25.2],[31,24.6],[36,23.6],[40,21.8]]) {
    fill(ctx, [[x-.8,y-.7],[x+.8,y-.7],[x+.8,y+.7],[x-.8,y+.7]], '#26383a');
    fill(ctx, [[x-.67,y-.58],[x+.67,y-.58],[x+.67,y+.57],[x-.67,y+.57]], '#967e59');
    fill(ctx, [[x-.49,y-.39],[x+.49,y-.39],[x+.49,y+.41],[x-.49,y+.41]], '#122b34');
    stroke(ctx, [[x-.54,y+.48],[x+.58,y+.48]], '#a99a72',2);
    for(const dx of [-.62,.62]) {
      ctx.fillStyle='#bcc2a0';
      ctx.fillRect(Math.round((x+dx)*TILE),Math.round((y-.46)*TILE),2,2);
    }
  }
  const lowerWale=[[2,27],[9,30],[17,32.5],[24,32],[32,28.3],[40,24]];
  stroke(ctx,lowerWale,'#263b3c',8);
  stroke(ctx,lowerWale.map(([x,y])=>[x,y+.17]),'#847452',2);
  // Waterlogged grain, rusty bolt heads and pale barnacle clusters.
  for(let i=0;i<240;i++) {
    const x=noise(i,23,173)*46, y=18+noise(i,71,174)*18;
    const px=Math.floor(x*TILE),py=Math.floor(y*TILE);
    ctx.fillStyle=i%4===0?'#a4946e66':i%3===0?'#1b303a88':'#60766455';
    ctx.fillRect(px,py,2+Math.floor(noise(i,17,175)*12),1);
    if(i%13===0) {
      ctx.fillStyle='#aab69b77';ctx.fillRect(px,py,3,3);
      ctx.fillStyle='#526e64';ctx.fillRect(px+2,py+2,2,2);
    }
  }
  const deckEdge = weatherDeck.slice(0, -3);
  stroke(ctx, deckEdge.slice(0, 6).map(([x, y]) => [x, y + .17]), '#8a8766', 3);
  stroke(ctx, deckEdge.slice(12).map(([x, y]) => [x, y + .17]), '#8a8766', 3);

  // A jagged opening in the side shows ocean behind the broken ribs.
  ctx.globalCompositeOperation = 'destination-out';
  fill(ctx, [[11.4, 29.1], [12.7, 28.6], [12.4, 30], [14.5, 28.9], [14.1, 30],
    [15.3, 30.2], [14.1, 31.6], [14.5, 33], [13, 32.3], [12.3, 33.8], [11.8, 31.9], [10.4, 31.6]], '#000');
  fill(ctx, [[22.2, 23.6], [23.3, 23.5], [22.9, 25], [24.2, 25.3], [23.4, 26.8], [23.1, 28.3],
    [22.5, 27.2], [21.2, 27.6], [22, 26], [21, 25]], '#000');
  ctx.restore();
}

function paintSail(ctx, { sheet, folds, tears }) {
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

function paintRope(ctx, [[x1, y1], [cx, cy], [x2, y2]]) {
  ctx.beginPath();
  ctx.moveTo(x1 * TILE, y1 * TILE);
  ctx.quadraticCurveTo(cx * TILE, cy * TILE, x2 * TILE, y2 * TILE);
  ctx.strokeStyle = '#1f323b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#9d9a78';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function createShipwreckArt(canvas, context) {
  function layer(paint) {
    const sprite = canvas.ownerDocument.createElement('canvas');
    sprite.width = WRECK_WIDTH * TILE;
    sprite.height = WRECK_HEIGHT * TILE;
    const art = sprite.getContext('2d');
    art.scale(WRECK_SCALE_X, WRECK_SCALE_Y);
    paint(art);
    return sprite;
  }

  const hullArt = layer(paintHull);
  const sailArt = sails.map((sail) => ({ yard: sail.yard, sprite: layer((ctx) => paintSail(ctx, sail)) }));
  const standing = (world, x, y) => tileAt(world, WEST_EXTENSION + wreckColumn(x), wreckRow(y)) === MATERIAL.wood;

  const secured = (world, [start, , end]) =>
    standing(world, Math.floor(start[0]), Math.floor(start[1])) &&
    standing(world, Math.floor(end[0]), Math.floor(end[1]));

  function backdrop(world, { left, right, top, bottom }) {
    if (right * TILE <= originX || left * TILE >= originX + hullArt.width ||
        bottom * TILE <= originY || top * TILE >= originY + hullArt.height) return;
    context.save();
    context.translate(originX, originY);
    context.save();
    context.scale(WRECK_SCALE_X, WRECK_SCALE_Y);
    for (const rope of rigging) {
      if (secured(world, rope)) paintRope(context, rope);
    }
    // Raised stern gallery, with cracked window frames and carved corner brackets.
    if (standing(world, 1, 12) && standing(world, 9, 12)) {
      fill(context, [[1.2,13],[8.9,13],[8.9,18],[1.2,18]], '#344747');
      stroke(context, [[.75,12.2],[9.25,12.2]], '#a88b5f',4);
      stroke(context, [[1.1,17.85],[9.3,17.85]], '#998360',3);
      for(const x of [2,4,6,8]) {
        fill(context, [[x-.52,14],[x,13.65],[x+.52,14],[x+.52,16.65],[x-.52,16.65]], '#9b8b66');
        fill(context, [[x-.35,14.15],[x,13.9],[x+.35,14.15],[x+.35,16.5],[x-.35,16.5]], '#203e46');
        stroke(context, [[x,14],[x,16.5]], '#797f67',1);
        stroke(context, [[x-.35,15.3],[x+.35,15.3]], '#797f67',1);
      }
    }
    context.restore();
    for (const { yard, sprite } of sailArt) {
      if (yard.every(([x, y]) => standing(world, x, y))) context.drawImage(sprite, 0, 0);
    }
    // When the wreck is stripped, the far side fades with the remaining framing.
    context.globalAlpha = framing.filter(([x, y]) => standing(world, x, y)).length / framing.length;
    context.drawImage(hullArt, 0, 0);
    context.restore();
  }

  function fittings(world, { left, right, top, bottom }) {
    if (right * TILE <= originX || left * TILE >= originX + 50 * TILE * WRECK_SCALE_X ||
        bottom * TILE <= originY || top * TILE >= originY + WRECK_HEIGHT * TILE) return;
    context.save();
    context.translate(originX, originY);
    context.scale(WRECK_SCALE_X, WRECK_SCALE_Y);
    for (const [[x1, y1], [x2, y2]] of mastJoints) {
      if (!standing(world, x1, y1) || !standing(world, x2, y2)) continue;
      const bend = [[x1 + .5, y1 + .58], [x1 + .55, y1 + .94], [x2 + .44, y2 + .38]];
      stroke(context, bend, '#554436', 9);
      stroke(context, bend.map(([x, y]) => [x - .18, y]), '#a88a60', 2);
    }
    for (const rope of rigging) {
      if (!secured(world, rope)) continue;
      for (const [x, y] of [rope[0], rope[2]]) {
        stroke(context, [[x - .12, y - .075], [x + .12, y + .075]], '#352f2a', 6);
        stroke(context, [[x - .12, y - .075], [x + .12, y + .075]], '#c1a17a', 3);
      }
    }
    for (const { yard: [[start, y], [end]] } of sailArt) {
      if (!standing(world, start, y) || !standing(world, end, y)) continue;
      for (let x = start; x <= end; x += 2) {
        if (!standing(world, x, y)) continue;
        stroke(context, [[x + .42, y + .62], [x + .48, y + .99]], '#493e32', 4);
        stroke(context, [[x + .42, y + .62], [x + .48, y + .99]], '#a6926e', 2);
      }
    }
    if (standing(world, 45, 14)) {
      const spar = [[44.8, 15.2], [46.75, 13.75], [48.9, 12.7], [49.05, 12.9]];
      stroke(context, spar, '#564334', 7);
      stroke(context, spar.map(([x, y]) => [x, y - .13]), '#a38761', 2);
      stroke(context, [[47, 13.5], [46.9, 13.9]], '#879888', 3);
      if (standing(world, 43, 16)) {
        paintRope(context, [[47.01, 13.57], [46.4, 15.75], [43.52, 16.56]]);
        stroke(context, [[43.42, 16.48], [43.62, 16.64]], '#b09a72', 3);
      }
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
    const vertical = row < 22 * WRECK_SCALE_Y && (above || below) && !left && !right;
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
      const edge = shipwreckHullRows[row - Math.round(16 * WRECK_SCALE_Y)];
      if (edge && (col === edge.stern || col === edge.bow)) {
        const inset = col === edge.stern ? 0 : 13;
        rect(inset, 0, 3, TILE, '#483b31');
        rect(inset + (inset ? 0 : 2), 0, 1, TILE, '#9c7d59');
      }
      rect(0, 6, TILE, 4, '#57473c');
      rect(0, 10, TILE, 4, '#695440');
      rect(0, 5, TILE, 1, '#4d3f36');
      rect(0, 14, TILE, 2, '#3b3b36');
      if (tileAt(world, tx, ty - 1) !== MATERIAL.wood) {
        rect(0, 0, TILE, 3, '#9e8964');
        rect(0, 3, TILE, 1, '#bc9b71');
      }
      rect(2 + Math.floor(tone * 5), 8, 6, 1, '#80664c');
      rect(1, 4, 2, 2, '#333c39');
      rect(1, 4, 1, 1, '#a49b7d');
      if (tone > .55) rect(7, 11, 4, 1, '#9a805c');
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
