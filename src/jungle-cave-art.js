import { TILE } from './world/generation.js';
import { JUNGLE_CAVE } from './world/jungle-cave.js';

export const JUNGLE_CAVE_STRUCTURE_KINDS = new Set([
  'native-torch',
  'bones',
  'scripture',
  'temple-column',
  'tentacle-statue',
  'cult-idol',
]);

export function jungleStructureBounds(kind) {
  if (kind === 'cult-idol') return { side: 3, height: 6, under: 1 };
  if (kind === 'tentacle-statue' || kind === 'temple-column') return { side: 2, height: 6, under: 1 };
  if (kind === 'scripture') return { side: 2, height: 4, under: 1 };
  return { side: 2, height: 3, under: 1 };
}

export function drawJungleWallGlyphs(rect, x, y, tx, ty, level, time = 0) {
  const variant = ((tx * 37 + ty * 73) & 7);
  const ink = level > 0.65 ? '#59826d' : '#4a5d58';
  const dim = '#253132';
  const glow = level > 0.72 && ((tx + ty) % 3 === 0);
  // Deterministic cryptic strokes: dots, hooks, tridents, rings (non-linguistic alien symbols)
  if (variant === 0) {
    rect(x + 3, y + 3, 9, 2, dim);
    rect(x + 3, y + 3, 9, 1, ink);
    rect(x + 7, y + 5, 2, 7, ink);
    rect(x + 4, y + 9, 8, 1, ink);
    rect(x + 6, y + 12, 4, 2, glow ? '#5cc494' : ink);
  } else if (variant === 1) {
    rect(x + 3, y + 4, 10, 8, dim);
    rect(x + 3, y + 4, 10, 1, ink);
    rect(x + 3, y + 11, 10, 1, ink);
    rect(x + 6, y + 7, 4, 2, glow ? '#67d4a0' : ink);
  } else if (variant === 2) {
    rect(x + 4, y + 2, 2, 11, ink);
    rect(x + 10, y + 4, 2, 9, ink);
    rect(x + 4, y + 6, 8, 2, ink);
    rect(x + 2, y + 12, 4, 1, ink);
  } else if (variant === 3) {
    rect(x + 5, y + 3, 6, 2, ink);
    rect(x + 3, y + 5, 2, 4, ink);
    rect(x + 11, y + 5, 2, 4, ink);
    rect(x + 7, y + 6, 2, 7, glow ? '#5dc493' : ink);
    rect(x + 4, y + 11, 8, 1, ink);
  } else if (variant === 4) {
    rect(x + 2, y + 5, 11, 1, ink);
    rect(x + 5, y + 2, 1, 11, ink);
    rect(x + 10, y + 2, 1, 9, ink);
    rect(x + 2, y + 10, 5, 2, ink);
  } else if (variant === 5) {
    rect(x + 4, y + 3, 8, 1, ink);
    rect(x + 4, y + 3, 2, 5, ink);
    rect(x + 4, y + 7, 8, 1, ink);
    rect(x + 10, y + 7, 2, 5, ink);
    rect(x + 4, y + 12, 8, 1, glow ? '#66cf9c' : ink);
  } else if (variant === 6) {
    rect(x + 3, y + 3, 2, 8, ink);
    rect(x + 7, y + 4, 2, 9, ink);
    rect(x + 11, y + 2, 2, 9, ink);
    rect(x + 2, y + 12, 12, 1, ink);
  } else {
    rect(x + 6, y + 2, 4, 4, ink);
    rect(x + 3, y + 7, 10, 2, ink);
    rect(x + 4, y + 10, 2, 4, ink);
    rect(x + 10, y + 10, 2, 4, ink);
  }
  if (glow && time > 0) {
    const pulse = 0.22 + 0.16 * Math.sin(time * 2.2 + tx * 0.7 + ty * 0.4);
    rect(x + 6, y + 7, 4, 2, `rgba(98, 224, 166, ${pulse.toFixed(2)})`);
  }
}

function drawNativeTorch(rect, x, y, floor, time) {
  const cultTorch = floor >= JUNGLE_CAVE.sanctuaryFloor - 10;
  // Charred wooden stake wrapped with cord & small bone/feather binding
  rect(x - 2, y - 22, 4, 22, '#4f3526');
  rect(x - 1, y - 22, 2, 21, '#734f38');
  rect(x - 3, y - 16, 6, 2, cultTorch ? '#543b61' : '#b84b39');
  rect(x - 3, y - 20, 6, 3, '#3b2b23');
  rect(x - 4, y - 23, 8, 3, '#634a3c');
  rect(x - 2, y - 13, 4, 2, '#d8cfb8');

  const flicker = Math.round(Math.sin(time * 12 + x * 0.3) * 1.6);
  const rise = Math.round(((time * 16 + x) % 10));
  if (cultTorch) {
    rect(x - 5, y - 34, 10, 11, '#44b87c26');
    rect(x - 4, y - 31 - Math.max(0, flicker), 8, 8 + Math.max(0, flicker), '#2f8f66');
    rect(x - 3, y - 33 + Math.min(0, flicker), 6, 9, '#62d996');
    rect(x - 1, y - 29, 3, 5, '#d6ffca');
    rect(x + flicker - 1, y - 35 - rise, 2, 2, '#9cf5b8');
  } else {
    rect(x - 5, y - 34, 10, 11, '#f0944624');
    rect(x - 4, y - 31 - Math.max(0, flicker), 8, 8 + Math.max(0, flicker), '#d4553b');
    rect(x - 3, y - 33 + Math.min(0, flicker), 6, 9, '#f09a43');
    rect(x - 2, y - 29, 4, 5, '#ffe388');
    rect(x + flicker, y - 35 - rise, 2, 2, '#ffe388');
  }
}

function drawBones(rect, x, y) {
  // Cracked skulls and scattered bones on cavern stones
  rect(x - 10, y - 3, 18, 2, '#998e78');
  rect(x - 11, y - 2, 6, 2, '#cbbda4');
  rect(x - 2, y - 4, 11, 2, '#dfd3b9');
  rect(x + 4, y - 2, 7, 2, '#b6aa92');
  // Skull silhouette
  rect(x - 7, y - 10, 9, 7, '#b9ad95');
  rect(x - 6, y - 11, 7, 7, '#e2d7be');
  rect(x - 5, y - 8, 2, 2, '#2d2528');
  rect(x - 1, y - 8, 2, 2, '#2d2528');
  rect(x - 5, y - 5, 5, 2, '#8b7e69');
  // Rib / femur fragments
  rect(x + 4, y - 8, 2, 6, '#d8ccb2');
  rect(x + 3, y - 9, 4, 2, '#e2d7be');
}

function drawScriptureTablet(rect, x, y, floor, time) {
  const mossLevel = Math.max(0.15, Math.min(1, (floor - JUNGLE_CAVE.scriptureStartRow) / 180));
  const deep = floor >= JUNGLE_CAVE.deepstoneRow;
  const body = deep ? '#29373a' : '#3a4648';
  const bevel = deep ? '#3f5456' : '#536262';
  const groove = deep ? '#192224' : '#252e30';
  const glyph = deep ? '#5ec696' : '#738e83';

  rect(x - 13, y - 44, 26, 44, groove);
  rect(x - 12, y - 43, 24, 43, body);
  rect(x - 11, y - 45, 22, 3, bevel);
  rect(x - 12, y - 42, 2, 41, bevel);

  // Carved rows of meaningless alien symbols
  for (let row = 0; row < 4; row++) {
    const ry = y - 38 + row * 9;
    rect(x - 9, ry, 18, 6, groove);
    drawJungleWallGlyphs(rect, x - 9, ry - 4, Math.floor(x / TILE) + row, floor + row, mossLevel, time);
    rect(x - 7, ry + 2, 4, 1, glyph);
    rect(x + 1, ry + 1, 5, 2, glyph);
  }

  // Creeping cave moss along edges
  if (mossLevel > 0.2) {
    rect(x - 13, y - 45, 9, 4, '#3d6e43');
    rect(x - 12, y - 41, 4, 9, '#4f854b');
    rect(x + 6, y - 28, 7, 5, '#3b673f');
    rect(x - 13, y - 6, 12, 6, '#39653d');
  }
}

function drawTempleColumn(rect, x, y, floor) {
  const deep = floor >= JUNGLE_CAVE.deepstoneRow;
  const stone = deep ? '#354147' : '#4a5557';
  const dark = deep ? '#20282e' : '#2f383b';
  const light = deep ? '#54686b' : '#6e7b7a';

  // Stepped pedestal plinth
  rect(x - 13, y - 6, 26, 6, dark);
  rect(x - 12, y - 6, 24, 2, light);
  rect(x - 10, y - 11, 20, 5, stone);
  rect(x - 10, y - 11, 20, 1, light);

  // Fluted ancient shaft with fractures
  rect(x - 8, y - 68, 16, 57, stone);
  rect(x - 8, y - 68, 3, 57, light);
  rect(x + 4, y - 68, 4, 57, dark);
  rect(x - 3, y - 66, 2, 53, dark);
  rect(x + 1, y - 66, 2, 53, dark);
  for (const band of [y - 26, y - 42, y - 56]) {
    rect(x - 8, band, 16, 2, dark);
  }

  // Carved Lovecraftian lotus/tentacle capital
  rect(x - 11, y - 74, 22, 6, dark);
  rect(x - 12, y - 78, 24, 5, stone);
  rect(x - 12, y - 78, 24, 2, light);
  // Hanging vines & cave moss
  rect(x - 9, y - 78, 7, 8, '#3f7344');
  rect(x - 8, y - 70, 2, 12, '#4e884b');
  rect(x + 5, y - 52, 4, 11, '#39673d');
  rect(x - 11, y - 9, 8, 5, '#467a48');
}

function drawTentacleStatue(rect, polygon, x, y, time) {
  const shade = '#273236';
  const stone = '#3b4a4c';
  const edge = '#5c716d';
  const moss = '#427446';

  // Moss-grown stone base
  rect(x - 16, y - 7, 32, 7, shade);
  rect(x - 15, y - 7, 30, 2, edge);
  rect(x - 12, y - 13, 24, 6, stone);

  // Robed humanoid torso & stone rib-folds
  rect(x - 10, y - 52, 20, 39, stone);
  rect(x - 10, y - 52, 4, 39, edge);
  rect(x + 5, y - 52, 5, 39, shade);
  rect(x - 14, y - 54, 28, 8, stone);
  rect(x - 14, y - 54, 28, 2, edge);

  // Extended clawed stone arms
  polygon([[x - 14, y - 50], [x - 21, y - 41], [x - 18, y - 34], [x - 10, y - 42]], stone);
  polygon([[x + 14, y - 50], [x + 21, y - 41], [x + 18, y - 34], [x + 10, y - 42]], stone);
  rect(x - 21, y - 36, 5, 3, edge);
  rect(x + 16, y - 36, 5, 3, edge);

  // Bulbous cephalopod/octopus-like humanoid head
  rect(x - 9, y - 76, 18, 22, shade);
  rect(x - 8, y - 77, 16, 20, stone);
  rect(x - 6, y - 78, 12, 4, edge);
  // Slit elder eyes
  const pulse = 0.45 + 0.25 * Math.sin(time * 2.1 + x * 0.2);
  const eyeColor = `rgba(92, 218, 162, ${pulse.toFixed(2)})`;
  rect(x - 6, y - 66, 4, 2, '#182022');
  rect(x + 2, y - 66, 4, 2, '#182022');
  rect(x - 5, y - 66, 2, 1, eyeColor);
  rect(x + 3, y - 66, 2, 1, eyeColor);

  // Writhing sculpted face tentacles & base tendrils
  for (const [dx, len, curve] of [[-7, 22, -2], [-3, 27, -1], [2, 26, 1], [6, 21, 2]]) {
    polygon([
      [x + dx, y - 59],
      [x + dx + 3, y - 59],
      [x + dx + 3 + curve, y - 59 + Math.floor(len * 0.6)],
      [x + dx + curve * 2, y - 59 + len],
      [x + dx - 1 + curve, y - 59 + Math.floor(len * 0.6)],
    ], dx % 2 === 0 ? edge : stone);
  }

  // Moss drapery over shoulders and plinth
  rect(x - 9, y - 77, 7, 5, moss);
  rect(x - 14, y - 55, 8, 5, moss);
  rect(x + 6, y - 16, 9, 6, moss);
}

function drawCultIdol(rect, polygon, x, y, time) {
  const pulse = 0.55 + 0.35 * Math.sin(time * 2.8);
  const orbGlow = `rgba(110, 244, 178, ${pulse.toFixed(2)})`;

  // Grand three-tier stepped stone pedestal with ceremonial cloth & cryptic runes
  rect(x - 24, y - 7, 48, 7, '#222a2e');
  rect(x - 23, y - 7, 46, 2, '#4c5e61');
  rect(x - 19, y - 15, 38, 8, '#2d393d');
  rect(x - 18, y - 15, 36, 2, '#5c7273');
  rect(x - 13, y - 26, 26, 11, '#36464a');
  rect(x - 14, y - 28, 28, 3, '#637a78');

  // Ceremonial purple cult cloth draped down pedestal center
  rect(x - 6, y - 26, 12, 19, '#57325c');
  rect(x - 4, y - 25, 8, 17, '#754478');
  rect(x - 2, y - 22, 4, 11, '#c69e59');

  // Eldritch jade-gold Lovecraftian idol seated upon the pedestal
  // Glow halo
  rect(x - 18, y - 72, 36, 38, 'rgba(72, 204, 148, 0.14)');
  // Folded dark wings behind idol
  polygon([[x - 5, y - 52], [x - 18, y - 66], [x - 14, y - 40]], '#2b4d44');
  polygon([[x + 5, y - 52], [x + 18, y - 66], [x + 14, y - 40]], '#2b4d44');
  // Squat horned-jade body
  rect(x - 9, y - 53, 18, 25, '#3b6e5c');
  rect(x - 8, y - 52, 16, 22, '#529177');
  rect(x - 6, y - 34, 12, 6, '#3b6e5c');
  // Idol head & radiant triple-slit eyes
  rect(x - 7, y - 69, 14, 17, '#3f7662');
  rect(x - 6, y - 71, 12, 15, '#62a889');
  rect(x - 5, y - 65, 3, 2, '#d8ffd2');
  rect(x + 2, y - 65, 3, 2, '#d8ffd2');
  rect(x - 1, y - 68, 2, 2, orbGlow);
  // Curling golden-jade idol tentacles
  for (const [dx, drop, sway] of [[-6, 14, -2], [-2, 17, -1], [2, 17, 1], [6, 14, 2]]) {
    polygon([
      [x + dx - 1, y - 56],
      [x + dx + 2, y - 56],
      [x + dx + 1 + sway, y - 56 + drop],
      [x + dx - 1 + sway, y - 56 + drop],
    ], '#c8b062');
  }
  // Pulsing eldritch orb held in claws
  rect(x - 4, y - 46, 8, 8, '#3f9c73');
  rect(x - 3, y - 45, 6, 6, orbGlow);
  rect(x - 1, y - 43, 2, 2, '#f2fff5');
}

export function drawJungleCaveStructure(rect, polygon, structure, x, y, time = 0) {
  switch (structure.kind) {
    case 'native-torch':
      drawNativeTorch(rect, x, y, structure.floor, time);
      break;
    case 'bones':
      drawBones(rect, x, y);
      break;
    case 'scripture':
      drawScriptureTablet(rect, x, y, structure.floor, time);
      break;
    case 'temple-column':
      drawTempleColumn(rect, x, y, structure.floor);
      break;
    case 'tentacle-statue':
      drawTentacleStatue(rect, polygon, x, y, time);
      break;
    case 'cult-idol':
      drawCultIdol(rect, polygon, x, y, time);
      break;
  }
}
