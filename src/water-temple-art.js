import { MATERIAL } from './content.js';
import { tileAt } from './world.js';
import { TILE, WEST_EXTENSION, noise } from './world/generation.js';
import {
  WATER_TEMPLE,
  waterTempleBraziers,
  waterTempleDoorBounds,
  waterTempleStoneAt,
  waterTempleTone,
} from './world/water-temple.js';

const PALETTE = Object.freeze({
  deepSlate: '#132732',
  wallDark: '#1b3542',
  wallMid: '#244656',
  wallLight: '#315d6e',
  carvedHi: '#4f8996',
  carvedPale: '#7cb5bc',
  moss: '#2f5d54',
  mossBright: '#49826f',
  doorLeafDark: '#193138',
  doorLeafMid: '#264952',
  doorFrame: '#45767d',
  bronzeTrim: '#6c9d95',
  bronzeHi: '#9ec9bc',
  aquaCore: '#6df5e5',
  aquaGlow: '#39bfb4',
});

/** Create cached/bounds-culled artwork renderer for the sunken Water Temple and its central big door. */
export function createWaterTempleArt(ctx) {
  const deckY = WATER_TEMPLE.deckRow * TILE;
  const centerX = (WATER_TEMPLE.center + WEST_EXTENSION + 0.5) * TILE;
  const leftX = (WATER_TEMPLE.left + WEST_EXTENSION) * TILE;
  const rightX = (WATER_TEMPLE.right + WEST_EXTENSION + 1) * TILE;
  const topY = WATER_TEMPLE.topRow * TILE;
  const door = waterTempleDoorBounds(WEST_EXTENSION);

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function poly(points, color) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      if (i === 0) ctx.moveTo(Math.round(px), Math.round(py));
      else ctx.lineTo(Math.round(px), Math.round(py));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawAshlarWall(x, y, width, height) {
    rect(x, y, width, height, PALETTE.wallDark);
    const courseHeight = 12;
    const rows = Math.ceil(height / courseHeight);
    for (let r = 0; r < rows; r++) {
      const cy = y + r * courseHeight;
      const ch = Math.min(courseHeight, y + height - cy);
      rect(x, cy + ch - 1, width, 1, PALETTE.deepSlate);
      const offset = r % 2 ? 14 : 0;
      const blockW = 28;
      for (let bx = x - offset; bx < x + width; bx += blockW) {
        const left = Math.max(x, bx);
        const right = Math.min(x + width, bx + blockW - 1);
        const bw = right - left;
        if (bw <= 1) continue;
        const tone = noise(Math.floor(bx / 16), Math.floor(cy / 12), 701);
        const fill = tone > 0.68 ? PALETTE.wallLight : tone > 0.34 ? PALETTE.wallMid : PALETTE.wallDark;
        rect(left, cy, bw, ch - 1, fill);
        if (tone > 0.78) rect(left + 1, cy + 1, Math.max(1, bw - 3), 1, PALETTE.carvedHi);
        if (right < x + width) rect(right, cy, 1, ch, PALETTE.deepSlate);
      }
    }
  }

  function drawFlutedPillar(px, baseY, height, width, ruined = false) {
    const half = Math.floor(width / 2);
    const capH = 10;
    const plinthH = 10;
    const shaftH = height - plinthH - (ruined ? 0 : capH);
    const topY = baseY - height;
    // Stepped stone plinth
    rect(px - half - 4, baseY - 5, width + 8, 5, PALETTE.wallLight);
    rect(px - half - 2, baseY - plinthH, width + 4, 5, PALETTE.carvedHi);
    rect(px - half - 4, baseY - 5, width + 8, 1, PALETTE.carvedPale);
    // Fluted column shaft
    const shaftY = topY + (ruined ? 0 : capH);
    rect(px - half, shaftY, width, shaftH, PALETTE.wallMid);
    rect(px - half + 2, shaftY, width - 4, shaftH, PALETTE.wallLight);
    for (let f = -half + 3; f <= half - 3; f += 4) {
      rect(px + f, shaftY + 2, 1, Math.max(2, shaftH - 4), PALETTE.deepSlate);
      rect(px + f + 1, shaftY + 2, 1, Math.max(2, shaftH - 4), PALETTE.carvedHi);
    }
    rect(px - half, shaftY, 2, shaftH, PALETTE.deepSlate);
    if (ruined) {
      poly([
        [px - half, topY + 6],
        [px - half + 5, topY],
        [px + 2, topY + 5],
        [px + half, topY + 1],
        [px + half, topY + 8],
        [px - half, topY + 8],
      ], PALETTE.carvedHi);
      return;
    }
    // Carved capital
    rect(px - half - 3, topY, width + 6, 4, PALETTE.carvedHi);
    rect(px - half - 3, topY, width + 6, 1, PALETTE.carvedPale);
    rect(px - half - 1, topY + 4, width + 2, 6, PALETTE.wallLight);
    rect(px - half - 1, topY + 9, width + 2, 1, PALETTE.deepSlate);
  }

  function drawWing(sideX, towardCenter, overview) {
    // Wing colonnade rests one tier below main portico on deckRow + 1.
    const wingY = (WATER_TEMPLE.deckRow + 1) * TILE;
    const width = 112;
    const wallX = towardCenter > 0 ? sideX : sideX - width;
    const wallH = 98;
    drawAshlarWall(wallX, wingY - wallH, width, wallH);
    // Arch niche carved into the wing wall
    const nicheCenter = wallX + width / 2;
    rect(nicheCenter - 15, wingY - 58, 30, 58, PALETTE.deepSlate);
    rect(nicheCenter - 11, wingY - 54, 22, 54, '#0d1d26');
    rect(nicheCenter - 17, wingY - 62, 34, 4, PALETTE.carvedHi);
    // Wing cornice and broken/full flanking columns
    rect(wallX - 4, wingY - wallH - 8, width + 8, 8, PALETTE.wallLight);
    rect(wallX - 4, wingY - wallH - 8, width + 8, 2, PALETTE.carvedPale);
    drawFlutedPillar(wallX + 14, wingY, 98, 16, false);
    drawFlutedPillar(wallX + width - 14, wingY, 72, 16, true);
    if (!overview) {
      for (let i = 0; i < 4; i++) {
        const kx = wallX + 18 + i * 24;
        const drop = 10 + Math.round(noise(Math.floor(kx), wingY, 709) * 14);
        rect(kx, wingY - wallH, 3, drop, PALETTE.moss);
        rect(kx + 1, wingY - wallH + 2, 1, Math.max(2, drop - 4), PALETTE.mossBright);
      }
    }
  }

  function drawBigDoor(time, overview) {
    const pulse = overview ? 0.75 : 0.72 + Math.sin(time * 2.4) * 0.28;
    const { x, y, width, height } = door;
    const midX = x + width / 2;
    const midY = y + height / 2;

    // Monumental stepped portal surround around the 4x6 tile doorway
    rect(x - 14, y - 18, width + 28, height + 18, PALETTE.deepSlate);
    rect(x - 12, y - 16, width + 24, height + 16, PALETTE.wallLight);
    rect(x - 8, y - 12, width + 16, height + 12, PALETTE.carvedHi);
    rect(x - 14, y - 18, width + 28, 3, PALETTE.carvedPale);
    // Carved keystone lintel
    rect(midX - 10, y - 22, 20, 14, PALETTE.carvedHi);
    rect(midX - 10, y - 22, 20, 2, PALETTE.carvedPale);
    rect(midX - 4, y - 18, 8, 6, PALETTE.aquaGlow);

    // Recessed threshold shadow inside portal frame
    rect(x - 3, y - 3, width + 6, height + 3, PALETTE.deepSlate);

    // Twin heavy stone-and-bronze door leaves
    const leafW = width / 2 - 1;
    for (const lx of [x, midX + 1]) {
      rect(lx, y, leafW, height, PALETTE.doorLeafDark);
      rect(lx + 2, y + 2, leafW - 4, height - 3, PALETTE.doorLeafMid);
      // Recessed upper & lower carved panels on each leaf
      rect(lx + 5, y + 7, leafW - 10, 32, PALETTE.doorLeafDark);
      rect(lx + 6, y + 8, leafW - 12, 1, PALETTE.doorFrame);
      rect(lx + 5, y + 48, leafW - 10, 38, PALETTE.doorLeafDark);
      rect(lx + 6, y + 49, leafW - 12, 1, PALETTE.doorFrame);
      // Bronze strap bands & rivets
      for (const bandY of [y + 18, y + 66]) {
        rect(lx, bandY, leafW, 5, PALETTE.bronzeTrim);
        rect(lx, bandY, leafW, 1, PALETTE.bronzeHi);
        rect(lx + 3, bandY + 2, 2, 2, PALETTE.deepSlate);
        rect(lx + leafW - 5, bandY + 2, 2, 2, PALETTE.deepSlate);
      }
    }
    // Center meeting seam
    rect(midX - 1, y, 2, height, '#09141b');

    // Grand circular seal medallion straddling the double doors
    ctx.beginPath();
    ctx.arc(midX, midY - 2, 13, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.deepSlate;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(midX, midY - 2, 11, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.bronzeTrim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(midX, midY - 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.doorLeafDark;
    ctx.fill();
    if (!overview) {
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(midX, midY - 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.aquaCore;
      ctx.fill();
      rect(midX - 1, midY - 12, 2, 4, PALETTE.aquaGlow);
      rect(midX - 1, midY + 4, 2, 4, PALETTE.aquaGlow);
      rect(midX - 10, midY - 3, 4, 2, PALETTE.aquaGlow);
      rect(midX + 6, midY - 3, 4, 2, PALETTE.aquaGlow);
      ctx.restore();
    }
  }

  function drawBrazier(bx, by, main, time, overview) {
    const scale = main ? 1 : 0.8;
    const w = Math.round(14 * scale);
    const h = Math.round(16 * scale);
    rect(bx - w / 2, by - 4, w, 4, PALETTE.carvedHi);
    rect(bx - w / 2 + 2, by - h + 4, w - 4, h - 8, PALETTE.wallMid);
    rect(bx - w / 2 - 1, by - h, w + 2, 5, PALETTE.carvedPale);
    // Glowing cyan aqua crystal flame
    const bob = overview ? 0 : Math.sin(time * 3.1 + bx * 0.2) * 1.4;
    const flameTop = by - h - (main ? 10 : 7) + bob;
    poly([
      [bx - w / 2 + 2, by - h],
      [bx, flameTop],
      [bx + w / 2 - 2, by - h],
    ], PALETTE.aquaGlow);
    poly([
      [bx - 2, by - h],
      [bx, flameTop + 3],
      [bx + 2, by - h],
    ], PALETTE.aquaCore);
  }

  function backdrop(world, { left, right, top, bottom }, time = 0, overview = false) {
    if (right * TILE < leftX - 32 || left * TILE > rightX + 32 ||
        bottom * TILE < topY - 16 || top * TILE > (WATER_TEMPLE.seabedRow + 4) * TILE) {
      return;
    }

    // Back sanctuary body spanning columns center-13 .. center+13
    const bodyHalfW = 13 * TILE;
    const bodyH = 10 * TILE;
    const bodyLeft = centerX - bodyHalfW;
    const bodyTop = deckY - bodyH;

    // Outer colonnade wings framing left and right flanks
    drawWing(bodyLeft + 4, -1, overview);
    drawWing(bodyLeft + bodyHalfW * 2 - 4, 1, overview);

    // Main central temple facade wall
    drawAshlarWall(bodyLeft, bodyTop, bodyHalfW * 2, bodyH);

    // Subtle shadowed portico alcove behind the main columns
    rect(centerX - 8.5 * TILE, bodyTop + 12, 17 * TILE, bodyH - 12, PALETTE.deepSlate);
    drawAshlarWall(centerX - 8 * TILE, bodyTop + 16, 16 * TILE, bodyH - 16);

    // Massive Central Big Door on the main part of the temple
    drawBigDoor(time, overview);

    // Four monumental fluted sanctuary pillars
    for (const offset of [-10.2, -4.4, 4.4, 10.2]) {
      drawFlutedPillar(centerX + offset * TILE, deckY, bodyH, 20, false);
    }

    // Carved Architrave & Glyph Frieze above the pillars
    const entY = bodyTop - 3 * TILE;
    rect(bodyLeft - 10, bodyTop - 6, bodyHalfW * 2 + 20, 6, PALETTE.carvedHi);
    rect(bodyLeft - 10, bodyTop - 6, bodyHalfW * 2 + 20, 2, PALETTE.carvedPale);
    rect(bodyLeft - 6, entY + 12, bodyHalfW * 2 + 12, 30, PALETTE.wallMid);
    rect(bodyLeft - 12, entY, bodyHalfW * 2 + 24, 12, PALETTE.wallLight);
    rect(bodyLeft - 12, entY, bodyHalfW * 2 + 24, 2, PALETTE.carvedPale);
    // Recessed wave-glyph blocks along the frieze
    for (let gx = centerX - 11.5 * TILE; gx <= centerX + 10.5 * TILE; gx += 32) {
      rect(gx, entY + 18, 18, 16, PALETTE.deepSlate);
      rect(gx + 3, entY + 21, 12, 2, PALETTE.carvedHi);
      rect(gx + 5, entY + 26, 8, 3, PALETTE.aquaGlow);
    }

    // Stepped Pyramid Pediment & Sanctuary Crown rising to topY
    const tierWidths = [22, 16, 10, 4];
    tierWidths.forEach((tilesWide, idx) => {
      const w = tilesWide * TILE;
      const th = 20;
      const ty = entY - (idx + 1) * th;
      const tx = centerX - w / 2;
      drawAshlarWall(tx, ty, w, th);
      rect(tx - 3, ty, w + 6, 3, PALETTE.carvedPale);
    });
    // Crown trident crest at apex
    const apexY = entY - tierWidths.length * 20;
    rect(centerX - 10, apexY - 12, 20, 12, PALETTE.carvedHi);
    rect(centerX - 2, apexY - 26, 4, 26, PALETTE.carvedPale);
    rect(centerX - 9, apexY - 22, 3, 12, PALETTE.carvedPale);
    rect(centerX + 6, apexY - 22, 3, 12, PALETTE.carvedPale);
    rect(centerX - 9, apexY - 13, 18, 3, PALETTE.carvedHi);
    ctx.beginPath();
    ctx.arc(centerX, apexY - 6, 3, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.aquaCore;
    ctx.fill();

    // Temple braziers along portico deck and side wings
    for (const brazier of waterTempleBraziers) {
      const bx = (brazier.column + WEST_EXTENSION + 0.5) * TILE;
      const by = brazier.floor * TILE;
      drawBrazier(bx, by, brazier.main, time, overview);
    }
  }

  function masonry(world, tx, ty, material, overview) {
    if (material !== MATERIAL.stone) return false;
    const column = tx - WEST_EXTENSION;
    if (!waterTempleStoneAt(column, ty)) return false;
    const x = tx * TILE;
    const y = ty * TILE;
    const tone = waterTempleTone(column, ty);
    rect(x, y, TILE, TILE, tone > 0.65 ? PALETTE.wallLight : tone > 0.28 ? PALETTE.wallMid : PALETTE.wallDark);
    if (overview) return true;
    // Carved ashlar stone joints
    rect(x, y + TILE - 1, TILE, 1, PALETTE.deepSlate);
    if ((tx + ty) % 2 === 0) rect(x + 7, y, 1, TILE, PALETTE.deepSlate);
    else rect(x + 15, y, 1, TILE, PALETTE.deepSlate);
    // Beveled carved top rim when exposed to ocean water
    if (!tileAt(world, tx, ty - 1)) {
      rect(x, y, TILE, 3, PALETTE.carvedHi);
      rect(x, y, TILE, 1, PALETTE.carvedPale);
      if (tone > 0.72) rect(x + 3, y + 2, 5, 2, PALETTE.mossBright);
    }
    return true;
  }

  return { backdrop, masonry };
}
