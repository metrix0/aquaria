import { ROOT_GROVE } from "./island-cave.js";
import { JUNGLE_CAVE } from "./jungle-cave.js";
import { hasBackgroundWall } from "./atmosphere.js";
import {
  hasOpenFace,
  hasExposedCaveFloor,
  solidAt,
  TILE_NEIGHBORS,
} from "../world.js";
import { COLS, ROWS, TILE, WEST_EXTENSION, clamp } from "./generation.js";

const source = 72;
const playerLight = 36;
const glowshroomPlayerLight = 68;
const mushroomLight = 46;
const openFalloff = 3;
const colorOpenFalloff = 6;
const rockFalloff = 10;
const colorRockFalloff = 12;
const reach = Math.ceil(source / openFalloff);
const size = reach * 2 + 1;
const NO_COLOR = Object.freeze({ r: 0, g: 0, b: 0, strength: 0 });

const MUSHROOM_LIGHT = Object.freeze({
  level: mushroomLight,
  r: 83,
  g: 185,
  b: 188,
  color: "#53b9bc",
});
const GROVE_SHAFT_LIGHT = Object.freeze({
  level: source,
  r: 155,
  g: 224,
  b: 176,
  color: "#9be0b0",
});
const GLOWSHROOM_TORCH_LIGHT = Object.freeze({
  level: 56,
  r: 107,
  g: 227,
  b: 220,
  color: "#6be3dc",
});

const LAMP_LIGHT = Object.freeze({
  level: 46,
  r: 240,
  g: 178,
  b: 105,
  color: "#f0b269",
  offsetX: -7,
  offsetY: -20,
  radius: TILE * 4.5,
  alpha: 0.22,
});
const JUNGLE_TORCH_LIGHT = Object.freeze({
  level: 48,
  r: 232,
  g: 141,
  b: 58,
  color: "#e88d3a",
  offsetX: 0,
  offsetY: -29,
  radius: TILE * 5,
  alpha: 0.24,
});
const CULT_TORCH_LIGHT = Object.freeze({
  level: 52,
  r: 98,
  g: 217,
  b: 150,
  color: "#62d996",
  offsetX: 0,
  offsetY: -29,
  radius: TILE * 5.5,
  alpha: 0.26,
});
const CULT_IDOL_LIGHT = Object.freeze({
  level: 68,
  r: 110,
  g: 244,
  b: 178,
  color: "#6ef4b2",
  offsetX: 0,
  offsetY: -43,
  radius: TILE * 7.5,
  alpha: 0.32,
});

function withTorchFlicker(base, structure, time) {
  if (!time) return base;
  const seed = (structure.tx ?? 0) * 1.7 + (structure.floor ?? 0) * 2.3;
  const wave =
    Math.sin(time * 9.5 + seed) * 0.65 +
    Math.sin(time * 17.3 + seed * 1.9) * 0.35;
  return {
    ...base,
    level: Math.max(1, Math.round(base.level + wave * 2.5)),
    radius: base.radius * (1 + wave * 0.05),
    alpha: Math.max(0.05, base.alpha + wave * 0.025),
  };
}

/** Describe emitted cave light color and halo metadata for a cave structure. */
export function caveStructureLight(structure, time = 0) {
  if (!structure) return null;
  if (structure.kind === "lamp") return LAMP_LIGHT;
  if (structure.kind === "native-torch") {
    const base =
      (structure.floor ?? 0) >= JUNGLE_CAVE.sanctuaryFloor - 10
        ? CULT_TORCH_LIGHT
        : JUNGLE_TORCH_LIGHT;
    return withTorchFlicker(base, structure, time);
  }
  if (structure.kind === "cult-idol") return CULT_IDOL_LIGHT;
  return null;
}

export function caveAmbientAt(world, player, tx, ty) {
  if (!solidAt(world, tx, ty, player)) return 0.34;
  return hasOpenFace(world, tx, ty, player) ? 0.19 : 0;
}

/** Subterranean ambient visibility that deepens smoothly below upper cave tiers. */
export function undergroundAmbientAt(world, player, tx, ty) {
  const base = caveAmbientAt(world, player, tx, ty);
  if (base <= 0) return 0;
  const depthFactor = clamp((ty - 60) / 180, 0, 1);
  return base * (1 - depthFactor * 0.55);
}

/** Dedicated cave and underground BFS lightmap tracking both brightness and RGB color. */
export function createUndergroundLight() {
  let width = size;
  let height = size;
  let levels = new Uint8Array(size * size);
  let cells = new Uint8Array(levels.length);
  let queued = new Uint8Array(levels.length);
  let colorLevels = new Uint8Array(levels.length);
  let colorR = new Float32Array(levels.length);
  let colorG = new Float32Array(levels.length);
  let colorB = new Float32Array(levels.length);
  let colorWeight = new Float32Array(levels.length);
  let emitterLevels = new Uint8Array(levels.length);
  let emitterStamp = new Uint16Array(levels.length);
  let emitterInBfs = new Uint8Array(levels.length);
  const colorQueue = [];
  const colorBfs = [];
  const queue = [];
  let stamp = 0;
  let left = 0;
  let top = 0;

  function ensureCapacity(area) {
    if (area <= levels.length) return;
    levels = new Uint8Array(area);
    cells = new Uint8Array(area);
    queued = new Uint8Array(area);
    colorLevels = new Uint8Array(area);
    colorR = new Float32Array(area);
    colorG = new Float32Array(area);
    colorB = new Float32Array(area);
    colorWeight = new Float32Array(area);
    emitterLevels = new Uint8Array(area);
    emitterStamp = new Uint16Array(area);
    emitterInBfs = new Uint8Array(area);
    stamp = 0;
  }

  function isSolid(world, player, index) {
    if (!cells[index]) {
      const tx = left + (index % width);
      const ty = top + Math.floor(index / width);
      cells[index] = solidAt(world, tx, ty, player) ? 2 : 1;
    }
    return cells[index] === 2;
  }

  function lightCell(index, level) {
    if (level <= levels[index]) return;
    levels[index] = level;
    if (!queued[index]) {
      queue.push(index);
      queued[index] = 1;
    }
  }

  function propagateColoredLight(world, player, startIndex, emitter) {
    stamp += 1;
    if (stamp >= 65535) {
      emitterStamp.fill(0);
      stamp = 1;
    }
    colorQueue.length = 0;
    colorBfs.length = 0;
    emitterStamp[startIndex] = stamp;
    emitterLevels[startIndex] = emitter.level;
    emitterInBfs[startIndex] = 1;
    colorQueue.push(startIndex);
    colorBfs.push(startIndex);

    for (let head = 0; head < colorBfs.length; head++) {
      const index = colorBfs[head];
      emitterInBfs[index] = 0;
      const level = emitterLevels[index];
      if (level <= colorOpenFalloff) continue;
      const fromRock = isSolid(world, player, index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height)
          continue;
        const neighbor = index + dy * width + dx;
        const intoRock = isSolid(world, player, neighbor);
        if (fromRock && !intoRock) continue;
        const next = level - (intoRock ? colorRockFalloff : colorOpenFalloff);
        if (next <= 0) continue;
        if (emitterStamp[neighbor] !== stamp) {
          emitterStamp[neighbor] = stamp;
          emitterLevels[neighbor] = next;
          emitterInBfs[neighbor] = 1;
          colorQueue.push(neighbor);
          colorBfs.push(neighbor);
        } else if (next > emitterLevels[neighbor]) {
          emitterLevels[neighbor] = next;
          if (!emitterInBfs[neighbor]) {
            emitterInBfs[neighbor] = 1;
            colorBfs.push(neighbor);
          }
        }
      }
    }

    for (const index of colorQueue) {
      const level = emitterLevels[index];
      if (level > colorLevels[index]) colorLevels[index] = level;
      const weight = level * level;
      colorR[index] += emitter.r * weight;
      colorG[index] += emitter.g * weight;
      colorB[index] += emitter.b * weight;
      colorWeight[index] += weight;
    }
  }

  function update(world, player, bounds = null, time = 0) {
    const px = player.x / TILE;
    const py = (player.y + player.height / 2) / TILE;
    const playerTx = Math.floor(px);
    const playerTy = Math.floor(py);
    if (bounds) {
      const margin = 12;
      left = Math.max(0, bounds.left - margin);
      top = Math.max(0, bounds.top - margin);
      const right = Math.min(COLS, bounds.right + margin);
      const bottom = Math.min(ROWS, bounds.bottom + margin);
      width = Math.max(1, right - left);
      height = Math.max(1, bottom - top);
    } else {
      left = playerTx - reach;
      top = playerTy - reach;
      width = size;
      height = size;
    }
    const area = width * height;
    ensureCapacity(area);
    const centerX = playerTx - left;
    const centerY = playerTy - top;
    const playerFalloff = player.glowSeconds > 0 ? 2 : openFalloff;
    levels.fill(0, 0, area);
    cells.fill(0, 0, area);
    colorLevels.fill(0, 0, area);
    colorR.fill(0, 0, area);
    colorG.fill(0, 0, area);
    colorB.fill(0, 0, area);
    colorWeight.fill(0, 0, area);
    queue.length = 0;
    const offsetX = px - playerTx - 0.5;
    const offsetY = py - playerTy - 0.5;
    const dx = offsetX < 0 ? -1 : 1;
    const dy = offsetY < 0 ? -1 : 1;
    const playerSource =
      player.glowSeconds > 0 ? glowshroomPlayerLight : playerLight;
    const seed = (x, y) => {
      const sx = centerX + x;
      const sy = centerY + y;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return;
      lightCell(
        sy * width + sx,
        playerSource -
          Math.round(
            playerFalloff * (Math.abs(offsetX - x) + Math.abs(offsetY - y)),
          ),
      );
    };
    // The player's underground illumination activates behind background walls or
    // beneath a physical roof so it does not shine across open surface islands.
    const inShelter =
      hasBackgroundWall(playerTx, playerTy) ||
      solidAt(world, playerTx, playerTy - 1, player);
    if (inShelter && centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
      const center = centerY * width + centerX;
      seed(0, 0);
      const openX =
        centerX + dx >= 0 &&
        centerX + dx < width &&
        !isSolid(world, player, center + dx);
      const openY =
        centerY + dy >= 0 &&
        centerY + dy < height &&
        !isSolid(world, player, center + dy * width);
      if (openX) seed(dx, 0);
      if (openY) seed(0, dy);
      if (
        (openX || openY) &&
        centerX + dx >= 0 &&
        centerX + dx < width &&
        centerY + dy >= 0 &&
        centerY + dy < height &&
        !isSolid(world, player, center + dx + dy * width)
      ) {
        seed(dx, dy);
      }
      if (player.glowSeconds > 0 && !isSolid(world, player, center)) {
        propagateColoredLight(world, player, center, GLOWSHROOM_TORCH_LIGHT);
      }
    }

    for (const mushroom of world.caveMushrooms) {
      const x = mushroom.tx - left;
      const y = mushroom.floor - 1 - top;
      if (
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height ||
        !hasExposedCaveFloor(world, mushroom)
      )
        continue;
      const startIndex = y * width + x;
      lightCell(startIndex, mushroomLight);
      if (!isSolid(world, player, startIndex)) {
        propagateColoredLight(world, player, startIndex, MUSHROOM_LIGHT);
      }
    }

    for (const lamp of world.caveStructures ?? []) {
      const emitter = caveStructureLight(lamp, time);
      if (!emitter) continue;
      const x = lamp.tx - left;
      if (x < 0 || x >= width || !hasExposedCaveFloor(world, lamp)) continue;
      let y = lamp.floor - 2 - top;
      if (y < 0 || y >= height || isSolid(world, player, y * width + x)) {
        const lower = lamp.floor - 1 - top;
        if (
          lower < 0 ||
          lower >= height ||
          isSolid(world, player, lower * width + x)
        )
          continue;
        y = lower;
      }
      const startIndex = y * width + x;
      lightCell(startIndex, emitter.level);
      propagateColoredLight(world, player, startIndex, emitter);
    }

    for (const [dx, rise] of [
      [-11, 6],
      [-7, 13],
      [-3, 4],
      [0, 19],
      [4, 10],
      [9, 15],
      [12, 4],
    ]) {
      const x = ROOT_GROVE.column + WEST_EXTENSION + dx - left;
      const y = ROOT_GROVE.floor - rise - top;
      if (
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height ||
        isSolid(world, player, y * width + x)
      )
        continue;
      const startIndex = y * width + x;
      lightCell(startIndex, source);
      propagateColoredLight(world, player, startIndex, GROVE_SHAFT_LIGHT);
    }

    for (let start = 0; start < queue.length; start++) {
      const index = queue[start];
      queued[index] = 0;
      const level = levels[index];
      if (level <= playerFalloff) continue;
      const fromRock = isSolid(world, player, index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of TILE_NEIGHBORS) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height)
          continue;
        const neighbor = index + dy * width + dx;
        const intoRock = isSolid(world, player, neighbor);
        // Rock carries a soft glow without lighting a disconnected chamber on its far side.
        if (!fromRock || intoRock)
          lightCell(neighbor, level - (intoRock ? rockFalloff : playerFalloff));
      }
    }
  }

  function at(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    const level = levels[y * width + x] / source;
    return level * level * (3 - 2 * level);
  }

  function colorAt(tx, ty) {
    const x = tx - left;
    const y = ty - top;
    if (x < 0 || x >= width || y < 0 || y >= height) return NO_COLOR;
    const index = y * width + x;
    const weight = colorWeight[index];
    if (!weight) return NO_COLOR;
    const level = colorLevels[index] / source;
    return {
      r: Math.round(colorR[index] / weight),
      g: Math.round(colorG[index] / weight),
      b: Math.round(colorB[index] / weight),
      strength: level * level * (3 - 2 * level),
    };
  }

  return { update, at, colorAt };
}
