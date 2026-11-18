import { TILE, WEST_EXTENSION, groundAt } from './world/generation.js';
import { HELMET_WRECK_COLUMN } from './world/shipwreck.js';

const width = 204;
const height = 142;
const column = HELMET_WRECK_COLUMN + WEST_EXTENSION;
const x = (column + .5) * TILE - 98;
const y = groundAt(column) * TILE - 121;

export function createHelmetWreckArt(canvas, context) {
  const sprite = canvas.ownerDocument.createElement('canvas');
  sprite.width = width;
  sprite.height = height;
  const ctx = sprite.getContext('2d');

  function path(points) {
    ctx.beginPath();
    for (const [i, [px, py]] of points.entries()) {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }

  function fill(points, color) {
    path(points);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function line(points, color, weight = 1) {
    path(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.stroke();
  }

  // Broken rigging and the ragged sail sit behind the fractured deck.
  line([[58, 20], [41, 49], [24, 76]], '#75938b', 1);
  line([[60, 23], [99, 40], [113, 67], [113, 74]], '#527674', 1);
  line([[62, 56], [47, 66], [30, 82]], '#345653', 2);
  const sail = [[47, 32], [92, 38], [101, 47], [100, 56], [92, 53], [92, 61],
    [84, 57], [78, 67], [77, 58], [68, 61], [69, 52], [58, 57], [59, 50], [47, 54], [50, 44]];
  fill(sail, '#73958a');
  fill([[50, 34], [60, 35], [56, 47], [50, 52], [53, 43]], '#b4b397');
  fill([[72, 37], [81, 38], [84, 47], [81, 55], [78, 64], [77, 54], [73, 51]], '#496c65');
  fill([[88, 45], [94, 45], [91, 48], [94, 51], [87, 50]], '#264950');
  line([[48, 32], [92, 39], [103, 42]], '#b9a180', 2);
  fill([[77, 88], [61, 16], [57, 21], [53, 17], [55, 31], [68, 93]], '#483a39');
  line([[58, 24], [72, 82]], '#a18a67', 3);
  line([[60, 34], [65, 33]], '#cad0a5', 2);

  // The keel broke in two. The opening frames the helmet chest on the sand below.
  const sections = [
    [[7, 60], [15, 62], [19, 69], [34, 72], [41, 77], [66, 80], [84, 78],
      [79, 85], [89, 85], [83, 91], [93, 95], [86, 98], [89, 105], [77, 111],
      [70, 125], [43, 122], [24, 107], [13, 87]],
    [[123, 88], [135, 86], [132, 81], [158, 84], [178, 78], [191, 69], [197, 71],
      [191, 88], [179, 105], [161, 120], [138, 132], [118, 134], [121, 127],
      [112, 123], [122, 115], [117, 110], [128, 103], [120, 96], [130, 95]],
  ];
  for (const [i, hull] of sections.entries()) {
    fill(hull, '#2d3236');
    ctx.save();
    path(hull);
    ctx.closePath();
    ctx.clip();
    for (let j = 0; j < 8; j++) {
      const row = 68 + j * 8;
      const plank = i === 0 ? [[6, row - 9], [32, row + 4], [59, row + 11], [96, row + 12]]
        : [[111, row + 23], [142, row + 17], [171, row + 9], [197, row - 6]];
      line(plank, ['#655349', '#81654d', '#51463f'][j % 3], 6);
      line(plank.map(([px, py]) => [px, py - 2]), '#a589685e');
    }
    for (const rib of (i === 0 ? [18, 34, 53, 71] : [129, 150, 170, 185])) {
      const curve = [[rib, 66], [rib - 1, 93], [rib + (i === 0 ? 15 : -12), 131]];
      line(curve, '#3a3937', 5);
      line(curve.map(([px, py]) => [px + 2, py]), '#a1876266');
    }
    ctx.restore();
    line(hull.slice(0, i === 0 ? 12 : 8), '#ad8d67', 2);
  }

  // Exposed grain on snapped edges, lost boards, and iron porthole rims.
  line([[81, 88], [88, 86], [84, 94], [91, 96]], '#d2ac77', 2);
  line([[132, 82], [132, 88], [125, 89], [129, 95], [121, 97], [128, 103]], '#c3a071', 2);
  for (const [px, py] of [[33, 87], [50, 93], [160, 97], [174, 90]]) {
    fill([[px, py], [px + 5, py - 1], [px + 8, py + 1], [px + 8, py + 6],
      [px + 3, py + 8], [px, py + 5]], '#b4976e');
    ctx.fillStyle = '#233b41';
    ctx.fillRect(px + 2, py + 1, 4, 5);
  }
  fill([[8, 105], [30, 116], [32, 120], [19, 115], [16, 117], [5, 109]], '#765e4b');
  line([[6, 105], [22, 113], [28, 114]], '#ad8d67');
  fill([[164, 125], [188, 110], [192, 111], [181, 120], [181, 123], [164, 129]], '#715e4d');
  line([[168, 124], [187, 112]], '#a68865');

  return ({ left, right, top, bottom }) => {
    if (left * TILE < x + width && right * TILE > x && top * TILE < y + height && bottom * TILE > y) {
      context.drawImage(sprite, x, y);
    }
  };
}
