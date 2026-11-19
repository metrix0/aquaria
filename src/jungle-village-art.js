function drawHut(rect, polygon, x, y, chief) {
  const halfW = chief ? 26 : 19;
  const wallH = chief ? 24 : 19;
  const roofH = chief ? 20 : 15;
  const stiltH = 4;
  const wallTop = y - stiltH - wallH;

  // Timber stilts & deck platform.
  rect(x - halfW + 2, y - stiltH, 3, stiltH, '#4f3626');
  rect(x + halfW - 5, y - stiltH, 3, stiltH, '#4f3626');
  rect(x - 2, y - stiltH, 4, stiltH, '#5e402d');
  rect(x - halfW - 1, y - stiltH - 2, halfW * 2 + 2, 3, '#6b4c35');
  rect(x - halfW, y - stiltH - 2, halfW * 2, 1, '#9d7557');

  // Woven bamboo hut walls.
  rect(x - halfW + 3, wallTop, (halfW - 3) * 2, wallH, '#7d5f3e');
  for (let row = wallTop + 3; row < y - stiltH - 2; row += 4) {
    rect(x - halfW + 3, row, (halfW - 3) * 2, 1, '#5d442b');
  }
  rect(x - halfW + 3, wallTop, 3, wallH, '#553a24');
  rect(x + halfW - 6, wallTop, 3, wallH, '#553a24');

  // Dark arched doorway.
  const doorW = chief ? 12 : 9;
  const doorH = chief ? 16 : 13;
  rect(x - Math.floor(doorW / 2) - 1, y - stiltH - 2 - doorH - 1, doorW + 2, doorH + 1, '#4a3220');
  rect(x - Math.floor(doorW / 2), y - stiltH - 2 - doorH, doorW, doorH, '#161b20');

  // Steep layered palm-thatch roof.
  const peakY = wallTop - roofH;
  polygon(
    [
      [x - halfW - 6, wallTop + 3],
      [x, peakY],
      [x + halfW + 6, wallTop + 3],
    ],
    '#5e4e2a',
  );
  polygon(
    [
      [x - halfW - 4, wallTop + 1],
      [x, peakY + 2],
      [x + halfW + 4, wallTop + 1],
    ],
    '#876f3b',
  );
  polygon(
    [
      [x - halfW - 2, wallTop - 1],
      [x, peakY + 3],
      [x + 2, wallTop - 1],
    ],
    '#a98d4b',
  );
  // Crossed ridge poles & tribal mask emblem on chief hut.
  rect(x - 4, peakY - 4, 2, 6, '#6b4c35');
  rect(x + 2, peakY - 4, 2, 6, '#6b4c35');
  rect(x - 1, peakY - 6, 2, 5, '#d95c48');
  if (chief) {
    rect(x - 3, wallTop + 3, 6, 5, '#b84839');
    rect(x - 2, wallTop + 4, 2, 2, '#f1f3e5');
    rect(x + 1, wallTop + 4, 2, 2, '#f1f3e5');
  }
}

function drawTotem(rect, x, y) {
  rect(x - 5, y - 34, 10, 34, '#543828');
  rect(x - 4, y - 34, 8, 34, '#745038');
  rect(x - 3, y - 33, 2, 32, '#946a49');
  // Top feathered crest & carved faces.
  rect(x - 7, y - 37, 14, 3, '#c8503c');
  rect(x - 4, y - 40, 8, 3, '#e6b86a');
  rect(x - 5, y - 30, 10, 7, '#3c261b');
  rect(x - 4, y - 28, 3, 2, '#f1f3e5');
  rect(x + 1, y - 28, 3, 2, '#f1f3e5');
  rect(x - 2, y - 25, 4, 2, '#d95c48');
  rect(x - 5, y - 18, 10, 7, '#3c261b');
  rect(x - 4, y - 16, 3, 2, '#f0c88b');
  rect(x + 1, y - 16, 3, 2, '#f0c88b');
  rect(x - 3, y - 13, 6, 2, '#c8503c');
}

function drawSpearRack(rect, x, y) {
  rect(x - 8, y - 16, 2, 16, '#5e402d');
  rect(x + 6, y - 16, 2, 16, '#5e402d');
  rect(x - 9, y - 12, 18, 2, '#855b42');
  for (const sx of [-5, 0, 5]) {
    rect(x + sx, y - 22, 1, 21, '#9d7557');
    rect(x + sx - 1, y - 25, 3, 3, '#b8c4c7');
    rect(x + sx, y - 27, 1, 2, '#e2e9eb');
  }
}

function drawCampfire(rect, x, y, time) {
  // Stone pit ring & crossed logs.
  rect(x - 8, y - 3, 16, 3, '#414f55');
  rect(x - 6, y - 4, 12, 2, '#627379');
  rect(x - 6, y - 5, 12, 2, '#4d3324');
  rect(x - 4, y - 6, 8, 2, '#734b34');
  // Flickering flames & ember sparks.
  const flicker = Math.round(Math.sin(time * 13 + x) * 2);
  const rise = Math.round((time * 18) % 12);
  rect(x - 4, y - 12 - Math.max(0, flicker), 8, 7 + Math.max(0, flicker), '#d95c48');
  rect(x - 3, y - 14 + Math.min(0, flicker), 6, 8, '#f09c46');
  rect(x - 2, y - 10, 4, 5, '#ffe17d');
  rect(x - 1 + flicker, y - 16 - rise, 2, 2, '#ffe17d');
  rect(x + 2 - flicker, y - 20 - ((rise + 5) % 12), 2, 2, '#8b9ca355');
}

export function drawJungleVillageStructure(rect, polygon, kind, x, y, time) {
  if (kind === 'chief-hut') drawHut(rect, polygon, x, y, true);
  else if (kind === 'hut') drawHut(rect, polygon, x, y, false);
  else if (kind === 'totem') drawTotem(rect, x, y);
  else if (kind === 'spear-rack') drawSpearRack(rect, x, y);
  else if (kind === 'campfire') drawCampfire(rect, x, y, time);
}
