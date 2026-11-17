export const TILE = 16;
export const WEST_EXTENSION = 44;
export const COLS = 224 + WEST_EXTENSION;
export const ROWS = 176;
export const WATER_ROW = 16;
export const WATER = WATER_ROW * TILE;
export const SPAWN = { x: (63 + WEST_EXTENSION) * TILE + 8, y: 12 * TILE - 23 };
export const SLOT_NAMES = ['Salvage tool', 'Sand', 'Stone', 'Wood'];
// Tile ID 4 was used for scrap. Keep it reserved for older saves.
export const MATERIAL = Object.freeze({
  air: 0, sand: 1, stone: 2, reef: 3, wood: 5, bedrock: 6, soil: 7,
  copper: 8, iron: 9, cobalt: 10,
});
export const SLOT_MATERIAL = [MATERIAL.air, MATERIAL.sand, MATERIAL.stone, MATERIAL.wood];

export function noise(x, y = 0, seed = 0) {
  let value = Math.imul(x + 171, 1597334677) ^ Math.imul(y + 313, 3812015801) ^ Math.imul(seed, 122949829);
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function islandSurface(x) {
  const distance = Math.abs(x - 56);
  if (distance < 7) return 11;
  if (distance < 10) return 12;
  if (distance < 12) return 13;
  return 14 + Math.floor((distance - 12) * 0.85);
}

function oceanFloor(x) {
  if (x < 0) {
    const shelf = 46 + 19 * Math.sin(-x / WEST_EXTENSION * Math.PI * 0.83);
    return Math.round(shelf + 2 * Math.sin(x * 0.35) + noise(x, 7) * 2);
  }
  const depth = 30 + 16 * Math.min(1, Math.abs(x - 56) / 85) + 6 * Math.sin(x * 0.098) + 3 * Math.sin(x * 0.27);
  return Math.min(islandSurface(x), Math.round(depth + noise(x, 7) * 2));
}

const caverns = [
  [-7, 93, 25, 14],
  [46, 117, 29, 14],
  [91, 145, 29, 19],
  [139, 153, 26, 15],
  [190, 124, 28, 17],
  [202, 156, 16, 11],
];

const passages = [
  [[-10, 48, 3], [-14, 73, 3], [-7, 93, 4], [14, 94, 3], [26, 113, 4], [46, 117, 5]],
  [[46, 117, 4], [60, 130, 4], [72, 127, 4], [91, 145, 5], [115, 148, 4], [139, 153, 5]],
  [[120, 39, 3], [122, 55, 4], [110, 64, 4], [124, 85, 4], [133, 97, 3], [128, 119, 4], [139, 153, 5]],
  [[124, 85, 3], [147, 89, 4], [167, 104, 3], [190, 124, 5], [200, 141, 4], [202, 156, 4]],
  [[139, 153, 5], [156, 153, 4], [172, 139, 4], [190, 124, 5]],
];

const oreLayers = [
  { material: MATERIAL.copper, top: 27, bottom: 58, step: 11, seed: 71 },
  { material: MATERIAL.iron, top: 62, bottom: 108, step: 13, seed: 72 },
  { material: MATERIAL.cobalt, top: 115, bottom: ROWS - 2, step: 16, seed: 73 },
];

function stamp(cx, cy, rx, ry, seed, visit) {
  const left = Math.max(0, Math.ceil(cx - rx));
  const right = Math.min(COLS - 1, Math.floor(cx + rx));
  const top = Math.max(0, Math.ceil(cy - ry));
  const bottom = Math.min(ROWS - 3, Math.floor(cy + ry));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (distance < 0.82 + noise(x - WEST_EXTENSION, y, seed) * 0.24) visit(x, y);
    }
  }
}

function trace(points, seed, visit) {
  for (let i = 1; i < points.length; i++) {
    const [fromX, fromY, fromR] = points[i - 1];
    const [toX, toY, toR] = points[i];
    const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const radius = fromR + (toR - fromR) * t;
      stamp(WEST_EXTENSION + fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, radius, radius, seed, visit);
    }
  }
}

function generateCaves(tiles, ground) {
  const carve = (x, y) => { tiles[y * COLS + x] = MATERIAL.air; };
  for (const [x, y, rx, ry] of caverns) stamp(x + WEST_EXTENSION, y, rx, ry, 61, carve);
  for (const passage of passages) trace(passage, 62, carve);

  // Stone columns break up the larger chambers and leave swimming room on both sides.
  for (const [x, y, rx, ry] of [[-15, 97, 3, 9], [40, 122, 3, 9], [98, 154, 4, 12], [147, 161, 3, 8], [194, 132, 4, 10]]) {
    stamp(x + WEST_EXTENSION, y, rx, ry, 63, (tx, ty) => {
      tiles[ty * COLS + tx] = MATERIAL.stone;
    });
  }

  const vents = [];
  for (const [x, y] of [[-1, 88], [50, 109], [111, 59], [129, 107], [91, 143], [138, 150], [185, 118], [202, 151]]) {
    const column = x + WEST_EXTENSION;
    let floor = y;
    while (floor < ROWS - 2 && tiles[floor * COLS + column] === MATERIAL.air) floor++;
    if (floor >= y + 3 && floor > ground[column]) {
      vents.push({ x: column * TILE + TILE / 2, y: floor * TILE });
    }
  }
  return vents;
}

function generateOres(tiles) {
  for (const { material, top, bottom, step, seed } of oreLayers) {
    for (let row = top; row < bottom; row += step) {
      for (let column = 0; column < COLS; column += step) {
        const x = column + noise(column, row, seed) * step;
        const y = row + noise(column, row, seed + 1) * step;
        const width = 2 + noise(column, row, seed + 2) * 3;
        const height = 1.5 + noise(column, row, seed + 3) * 2;
        stamp(x, y, width, height, seed, (tx, ty) => {
          const index = ty * COLS + tx;
          if (ty >= top && ty < bottom && tiles[index] === MATERIAL.stone) tiles[index] = material;
        });
      }
    }
  }

  // The exposed western vein is the one place shallow swimmers can find iron.
  const mineralize = (x, y) => {
    const index = y * COLS + x;
    const mineral = noise(x, y, 79);
    if (tiles[index] === MATERIAL.air || mineral > 0.36) {
      const seam = Math.sin(x * 0.86 + y * 0.32) + Math.cos(y * 0.51) * 0.65;
      tiles[index] = mineral < 0.22 ? MATERIAL.stone : seam > 0.05 ? MATERIAL.copper : MATERIAL.iron;
    }
  };
  trace([[-25, 70, 7], [-27, 58, 6], [-33, 48, 5], [-31, 37, 4], [-25, 29, 3], [-25, 22, 1.5]], 77, mineralize);
  trace([[-31, 42, 4], [-37, 39, 3], [-40, 32, 1.5]], 77, mineralize);
  trace([[-28, 35, 3], [-20, 32, 2.5], [-16, 26, 1.5]], 77, mineralize);
}

export function createWorld() {
  const tiles = new Uint8Array(COLS * ROWS);
  const ground = Array.from({ length: COLS }, (_, x) => oceanFloor(x - WEST_EXTENSION));

  for (let x = 0; x < COLS; x++) {
    const originalX = x - WEST_EXTENSION;
    for (let y = ground[x]; y < ROWS; y++) {
      let material = MATERIAL.stone;
      const depth = y - ground[x];
      if (y >= ROWS - 2) {
        material = MATERIAL.bedrock;
      } else if (y > 34 && depth > 3 && originalX > 75 && originalX < 198 && (
        Math.pow((originalX - 99) / 26, 2) + Math.pow((y - 56) / 10, 2) < 1 ||
        Math.pow((originalX - 153) / 26, 2) + Math.pow((y - 69) / 13, 2) < 1 ||
        (originalX > 124 && originalX < 139 && Math.abs(y - (57 + (originalX - 124) * 0.6)) < 3)
      )) {
        material = MATERIAL.air;
      } else if (depth < 2) {
        material = ground[x] < WATER_ROW || noise(originalX, 2) > 0.3 ? MATERIAL.sand : MATERIAL.reef;
      } else if (ground[x] < WATER_ROW && y < WATER_ROW + 1) {
        material = MATERIAL.soil;
      }
      tiles[y * COLS + x] = material;
    }
  }

  const vents = generateCaves(tiles, ground);
  generateOres(tiles);

  const wreckColumn = 111 + WEST_EXTENSION;
  const items = [
    { id: 'wreck-cache', kind: 'cache', x: wreckColumn * TILE + 8, y: ground[wreckColumn] * TILE - 9 },
  ];
  for (const x of [34, 41, 76, 79, 84, 91, 96, 104, 114, 127, 132, 144]) {
    const column = x + WEST_EXTENSION;
    items.push({ id: 'kelp-' + x, kind: 'kelp', amount: 1, x: column * TILE + 8, y: ground[column] * TILE - 12 });
  }

  const trees = [[49, 61, -1], [52, 46, 1], [58, 69, 1], [62, 48, -1]].map(([column, height, direction]) => {
    const tx = column + WEST_EXTENSION;
    const ty = ground[tx];
    const x = tx * TILE + 7;
    const y = ty * TILE;
    const trunk = [];
    for (let rise = 0; rise < height; rise += 2) {
      const lean = Math.floor(Math.pow(rise / height, 1.7) * 14) * direction;
      trunk.push({ x: x + lean - 3, y: y - rise - 2, width: rise > height * .68 ? 4 : 6 });
    }
    return { id: 'palm-' + column, tx, ty, x, y, height, direction, trunk };
  });

  const mobs = [
    { id: 'crab-island-west', kind: 'crab', x: 50 * TILE + 8, span: 48, speed: 22, variant: 0, phase: 0.4 },
    { id: 'crab-island-east', kind: 'crab', x: 61 * TILE + 8, span: 44, speed: 24, variant: 1, phase: 1.7 },
    { id: 'crab-shore-west', kind: 'crab', x: 40 * TILE + 8, span: 56, speed: 23, variant: 2, phase: 2.8 },
    { id: 'crab-shore-east', kind: 'crab', x: 71 * TILE + 8, span: 56, speed: 25, variant: 0, phase: 3.9 },
    { id: 'crab-west-floor', kind: 'crab', x: 34 * TILE + 8, span: 52, speed: 21, variant: 1, phase: 0.9 },
    { id: 'crab-reef-west', kind: 'crab', x: 76 * TILE + 8, span: 56, speed: 23, variant: 2, phase: 2.1 },
    { id: 'crab-reef-east', kind: 'crab', x: 88 * TILE + 8, span: 60, speed: 24, variant: 0, phase: 3.4 },
    { id: 'crab-channel', kind: 'crab', x: 102 * TILE + 8, span: 54, speed: 22, variant: 1, phase: 4.6 },
    { id: 'crab-wreck', kind: 'crab', x: 116 * TILE + 8, span: 58, speed: 25, variant: 2, phase: 5.3 },
    { id: 'crab-deep', kind: 'crab', x: 135 * TILE + 8, span: 64, speed: 23, variant: 0, phase: 1.2 },
    { id: 'fish-west-shallows', kind: 'fish', x: 35 * TILE, y: 18 * TILE, span: 42, speed: 34, variant: 0, phase: 0.3 },
    { id: 'fish-west-reef', kind: 'fish', x: 30 * TILE, y: 23 * TILE, span: 56, speed: 38, variant: 1, phase: 1.8 },
    { id: 'fish-west-deep', kind: 'fish', x: 22 * TILE, y: 27 * TILE, span: 64, speed: 32, variant: 2, phase: 3.1 },
    { id: 'fish-reef-shallows', kind: 'fish', x: 77 * TILE, y: 18 * TILE, span: 38, speed: 35, variant: 0, phase: 0.7 },
    { id: 'fish-reef-upper', kind: 'fish', x: 83 * TILE, y: 20 * TILE, span: 52, speed: 40, variant: 1, phase: 2.2 },
    { id: 'fish-reef-mid', kind: 'fish', x: 89 * TILE, y: 24 * TILE, span: 58, speed: 36, variant: 2, phase: 3.6 },
    { id: 'fish-reef-kelp', kind: 'fish', x: 95 * TILE, y: 21 * TILE, span: 54, speed: 42, variant: 3, phase: 4.9 },
    { id: 'fish-channel-upper', kind: 'fish', x: 104 * TILE, y: 22 * TILE, span: 62, speed: 39, variant: 0, phase: 1.4 },
    { id: 'fish-wreck-bow', kind: 'fish', x: 110 * TILE, y: 28 * TILE, span: 56, speed: 35, variant: 2, phase: 2.9 },
    { id: 'fish-wreck-stern', kind: 'fish', x: 119 * TILE, y: 25 * TILE, span: 64, speed: 41, variant: 1, phase: 4.3 },
    { id: 'fish-deep-slope', kind: 'fish', x: 132 * TILE, y: 31 * TILE, span: 70, speed: 37, variant: 3, phase: 5.5 },
    { id: 'fish-cave-west', kind: 'fish', x: 99 * TILE, y: 56 * TILE, span: 46, speed: 31, variant: 3, phase: 1.9 },
    { id: 'fish-cave-east', kind: 'fish', x: 153 * TILE, y: 69 * TILE, span: 52, speed: 33, variant: 1, phase: 3.7 },
    { id: 'jelly-west', kind: 'jellyfish', x: 32 * TILE, y: (ground[32 + WEST_EXTENSION] - 4) * TILE, span: 22, speed: 14, phase: 0.4 },
    { id: 'jelly-reef', kind: 'jellyfish', x: 81 * TILE, y: (ground[81 + WEST_EXTENSION] - 4) * TILE, span: 22, speed: 12, phase: 1.7 },
    { id: 'jelly-channel', kind: 'jellyfish', x: 96 * TILE, y: 27 * TILE, span: 30, speed: 15, phase: 3.1 },
    { id: 'jelly-wreck', kind: 'jellyfish', x: 118 * TILE, y: 30 * TILE, span: 32, speed: 14, phase: 4.5 },
    { id: 'jelly-cave', kind: 'jellyfish', x: 101 * TILE, y: 55 * TILE, span: 24, speed: 13, phase: 2.3 },
    { id: 'squid-west', kind: 'squid', x: 25 * TILE, y: (ground[25 + WEST_EXTENSION] - 5) * TILE, span: 48, speed: 46, phase: 0.9 },
    { id: 'squid-reef', kind: 'squid', x: 88 * TILE, y: 24 * TILE, span: 56, speed: 48, phase: 2.2 },
    { id: 'squid-wreck', kind: 'squid', x: 108 * TILE, y: 26 * TILE, span: 64, speed: 52, phase: 3.8 },
    { id: 'squid-deep', kind: 'squid', x: 149 * TILE, y: 66 * TILE, span: 68, speed: 54, phase: 5.1 },
    { id: 'shark-west', kind: 'shark', x: 19 * TILE, y: 23 * TILE, span: 84, speed: 58, phase: 0.2 },
    { id: 'shark-channel', kind: 'shark', x: 95 * TILE, y: 22 * TILE, span: 82, speed: 62, phase: 1.5 },
    { id: 'shark-wreck', kind: 'shark', x: 124 * TILE, y: 28 * TILE, span: 104, speed: 66, phase: 2.9 },
    { id: 'shark-deep', kind: 'shark', x: 158 * TILE, y: 35 * TILE, span: 112, speed: 70, phase: 4.2 },
  ].map((mob, index) => {
    const x = mob.x + WEST_EXTENSION * TILE;
    const y = mob.kind === 'crab' ? ground[Math.floor(x / TILE)] * TILE : mob.y;
    return {
      ...mob,
      x,
      y,
      homeX: x,
      homeY: y,
      dx: 0,
      dy: 0,
      facing: index % 2 ? -1 : 1,
      grounded: mob.kind === 'crab',
      flee: 0,
      cooldown: 0,
    };
  });

  return { tiles, ground, items, trees, mobs, vents, edits: new Map(), harvested: new Set() };
}

export function tileAt(world, tx, ty) {
  if (tx < 0 || tx >= COLS || ty >= ROWS) return MATERIAL.bedrock;
  return ty < 0 ? MATERIAL.air : world.tiles[ty * COLS + tx];
}

export function isTreeStanding(world, tree) {
  const { tx, ty, id } = tree;
  return !world.harvested.has(id) && tileAt(world, tx, ty) && !tileAt(world, tx, ty - 1);
}

export function treeAt(world, tx, ty) {
  const x = tx * TILE;
  const y = ty * TILE;
  return world.trees.find((tree) => isTreeStanding(world, tree) && tree.trunk.some((strip) =>
    strip.x < x + TILE && strip.x + strip.width > x && strip.y < y + TILE && strip.y + 2 > y
  ));
}

export function editTile(world, tx, ty, material) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS - 2) return;
  const index = ty * COLS + tx;
  world.tiles[index] = material;
  world.edits.set(index, material);
}
