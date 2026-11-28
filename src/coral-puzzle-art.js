// The same engraved pixel glyphs appear on the ruins and the four dials.
const GLYPHS = [
  [],
  ['00100','01010','10001','01010','00100'], // diamond
  ['00000','11000','00111','11000','00111'], // waves
  ['10001','10001','10101','01110','00100'], // trident
  ['01110','10001','10101','10001','01110'], // eye
];
function glyph(rect, x, y, mark, scale, color) {
  const rows = GLYPHS[mark] ?? [];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '1') rect(x + (dx - 2.5) * scale, y + (dy - 2.5) * scale, scale, scale, color);
    }
  });
}
function block(rect, x, y, w, h) {
  rect(x, y, w, h, '#263f4a');
  rect(x + 2, y + 1, w - 4, h - 3, '#52716c');
  rect(x + 2, y + 1, w - 4, 2, '#77918a');
  if (h > 5) rect(x + w - 3, y + 3, 1, h - 5, '#354d51');
}
export function drawCoralRuin(rect, { x, y, floorY, mark, variant }) {
  block(rect, x - 32, floorY - 6, 64, 6);
  block(rect, x - 25, floorY - 11, 50, 5);
  const leftHeight = variant === 1 ? 27 : 45;
  const rightHeight = variant === 2 ? 28 : 45;
  for (const [dx, height] of [[-26, leftHeight], [17, rightHeight]]) {
    for (let dy = 10; dy < height; dy += 9) block(rect, x + dx, floorY - dy - 8, 9, 9);
    block(rect, x + dx - 3, floorY - height - 7, 15, 6);
  }
  if (variant === 0) {
    block(rect, x - 30, floorY - 52, 60, 7);
    block(rect, x - 15, floorY - 57, 30, 5);
  } else {
    block(rect, x + (variant === 1 ? 8 : -30), floorY - 51, 22, 6);
  }
  block(rect, x - 12, y - 14, 24, 30);
  rect(x - 8, y - 10, 16, 20, '#263f4a');
  if (mark) glyph(rect, x, y, mark, 2, '#c2efe1');
  // Broken stone and algae at the base.
  block(rect, x - 39, floorY - 5, 8, 5);
  rect(x + 15, floorY - 12, 5, 3, '#557e70');
}
export function drawCoralDial(rect, { x, y, floorY, slot }, mark, solved) {
  for (let py = y + 11; py < floorY; py += 9) {
    const height = Math.min(9, floorY - py);
    if (height >= 5) block(rect, x - 7, py, 14, height);
  }
  block(rect, x - 13, y - 15, 26, 28);
  rect(x - 10, y - 11, 20, 18, solved ? '#244f4b' : '#20343e');
  glyph(rect, x, y - 2, mark, 2, solved ? '#93ffd7' : '#c2efe1');
  for (let i = 0; i <= slot; i++) rect(x - slot * 2 + i * 4 - 1, y + 9, 2, 2, '#aabdb1');
}
