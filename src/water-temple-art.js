import { MATERIAL } from './content.js';
import { tileAt } from './world.js';
import { TILE, WEST_EXTENSION, noise } from './world/generation.js';
import {
  WATER_TEMPLE,
  waterTempleBraziers,
  waterTempleDoorBounds,
  waterTempleFoundationTop,
  waterTemplePuzzleDoorBounds,
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
  const puzzleDoor = waterTemplePuzzleDoorBounds(WEST_EXTENSION);

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
    const width = 176;
    const wallX = towardCenter > 0 ? sideX : sideX - width;
    const wallH = 336;
    drawAshlarWall(wallX, wingY - wallH, width, wallH);
    // Arch niche carved into the wing wall
    const nicheCenter = wallX + width / 2;
    rect(nicheCenter - 18, wingY - 82, 36, 82, PALETTE.deepSlate);
    rect(nicheCenter - 13, wingY - 76, 26, 76, '#0d1d26');
    rect(nicheCenter - 20, wingY - 86, 40, 4, PALETTE.carvedHi);
    // Wing cornice and flanking columns
    rect(wallX - 4, wingY - wallH - 10, width + 8, 10, PALETTE.wallLight);
    rect(wallX - 4, wingY - wallH - 10, width + 8, 2, PALETTE.carvedPale);
    drawFlutedPillar(wallX + 18, wingY, wallH, 18, false);
    drawFlutedPillar(wallX + width - 18, wingY, 282, 22, true);
    for (let tier = 0; tier < 3; tier++) {
      const inset = 16 + tier * 18;
      const roofY = wingY - wallH - 10 - (tier + 1) * 32;
      drawAshlarWall(wallX + inset, roofY, width - 2 * inset, 32);
      rect(wallX + inset - 3, roofY, width - 2 * inset + 6, 4, PALETTE.carvedHi);
    }
    if (!overview) {
      for (let i = 0; i < 5; i++) {
        const kx = wallX + 20 + i * 24;
        const drop = 12 + Math.round(noise(Math.floor(kx), wingY, 709) * 18);
        rect(kx, wingY - wallH, 3, drop, PALETTE.moss);
        rect(kx + 1, wingY - wallH + 2, 1, Math.max(2, drop - 4), PALETTE.mossBright);
      }
    }
  }

  function drawCrossingAndPuzzleWing(bodyRight, time, overview) {
    const colX = column => (column + WEST_EXTENSION) * TILE;
    const landingY = WATER_TEMPLE.approachRow * TILE;
    // Monumental terraced processional arcade descending west to the main entrance.
    for (let column = -381; column < WATER_TEMPLE.approachWest; column += 4) {
      const x = colX(column);
      const floor = waterTempleFoundationTop(column) * TILE;
      const nextFloor = waterTempleFoundationTop(Math.min(column + 3, WATER_TEMPLE.approachWest)) * TILE;
      const roof = nextFloor - 3 * TILE;
      drawAshlarWall(x, roof, 4 * TILE, floor - roof);
      rect(x - 3, roof, 4 * TILE + 6, 5, PALETTE.carvedHi);
      rect(x + 15, roof + 14, 34, Math.max(12, nextFloor - roof - 14), PALETTE.deepSlate);
      drawFlutedPillar(x + 7, floor, floor - roof, 14);
    }
    // Raised landing at the coral wall. The actual staircase is solid world masonry.
    const landingLeft = colX(WATER_TEMPLE.approachWest);
    const landingRight = colX(WATER_TEMPLE.approachEast + 1);
    rect(landingLeft, landingY - 7, landingRight - landingLeft, 7, PALETTE.wallLight);
    rect(landingLeft, landingY - 7, landingRight - landingLeft, 2, PALETTE.carvedPale);
    // A low ancient shrine frames the four interactive mark dials in the foreground.
    const pavX = puzzleDoor.x - 32;
    const pavW = puzzleDoor.width + 64;
    const pavH = 104;
    drawAshlarWall(pavX, landingY - pavH, pavW, pavH);
    rect(pavX - 5, landingY - pavH - 7, pavW + 10, 7, PALETTE.carvedHi);
    rect(pavX - 5, landingY - pavH - 7, pavW + 10, 2, PALETTE.carvedPale);
    drawFlutedPillar(pavX + 8, landingY, pavH, 14);
    drawFlutedPillar(pavX + pavW - 8, landingY, pavH, 14);
    // Ruined balustrade posts trace the eastern stair without blocking swimming.
    for (let column = WATER_TEMPLE.approachEast + 2; column <= WATER_TEMPLE.right; column += 4) {
      const x = colX(column) + TILE / 2;
      const floor = waterTempleFoundationTop(column) * TILE;
      drawFlutedPillar(x, floor, 34, 12, true);
    }

    // Smaller Puzzle Door on the right side of the coral wall
    const { x, y, width, height } = puzzleDoor;
    const midX = x + width / 2;
    const midY = y + height / 2;
    const pulse = overview ? 0.75 : 0.72 + Math.sin(time * 2.8 + 1.1) * 0.28;
    rect(x - 8, y - 10, width + 16, height + 10, PALETTE.deepSlate);
    rect(x - 6, y - 8, width + 12, height + 8, PALETTE.wallLight);
    rect(x - 4, y - 6, width + 8, height + 6, PALETTE.carvedHi);
    rect(x - 8, y - 10, width + 16, 2, PALETTE.carvedPale);
    rect(x, y, width, height, PALETTE.doorLeafDark);
    rect(x + 2, y + 2, width - 4, height - 3, PALETTE.doorLeafMid);
    rect(x + 5, y + 7, width - 10, height - 16, PALETTE.doorLeafDark);
    rect(midX - 1, y, 2, height, '#09141b');
    ctx.beginPath();
    ctx.arc(midX, midY, 8, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.bronzeTrim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(midX, midY, 5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.doorLeafDark;
    ctx.fill();
    if (!overview) {
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(midX, midY, 3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.aquaCore;
      ctx.fill();
      ctx.restore();
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

    // Main sanctuary body spanning 60 tiles wide and rising high below the ocean surface
    const bodyHalfW = 30 * TILE;
    const bodyH = 37 * TILE;
    const bodyLeft = centerX - bodyHalfW;
    const bodyTop = deckY - bodyH;

    // Outer left colonnade wing + eastern crossing causeway & puzzle wing across the coral wall
    drawWing(bodyLeft + 72, -1, overview);
    drawCrossingAndPuzzleWing(bodyLeft + bodyHalfW * 2 - 8, time, overview);

    // Main central temple facade wall
    drawAshlarWall(bodyLeft, bodyTop, bodyHalfW * 2, bodyH);

    // Upper colonnade gallery tier inside the monumental sanctuary
    const galleryY = bodyTop + 15 * TILE;
    rect(bodyLeft + 10, galleryY - 8, bodyHalfW * 2 - 20, 8, PALETTE.carvedHi);
    rect(bodyLeft + 10, galleryY - 8, bodyHalfW * 2 - 20, 2, PALETTE.carvedPale);
    for (const gx of [-23, -15, -7, 0, 7, 15, 23]) {
      const nx = centerX + gx * TILE;
      const nicheTop = bodyTop + 26;
      const nicheBottom = galleryY - 14;
      poly([[nx - 30, nicheBottom], [nx - 30, nicheTop + 35], [nx - 17, nicheTop + 12], [nx, nicheTop], [nx + 17, nicheTop + 12], [nx + 30, nicheTop + 35], [nx + 30, nicheBottom]], PALETTE.carvedHi);
      poly([[nx - 23, nicheBottom], [nx - 23, nicheTop + 38], [nx, nicheTop + 10], [nx + 23, nicheTop + 38], [nx + 23, nicheBottom]], PALETTE.deepSlate);
      rect(nx - 3, nicheTop + 51, 6, 32, PALETTE.aquaGlow);
    }

    // Deep shadowed lower portico alcove behind the main columns
    rect(centerX - 13 * TILE, galleryY + 4, 26 * TILE, deckY - galleryY - 4, PALETTE.deepSlate);
    drawAshlarWall(centerX - 12.5 * TILE, galleryY + 10, 25 * TILE, deckY - galleryY - 10);

    // Massive Central Big Door on the main left-side sanctuary
    drawBigDoor(time, overview);

    // Six monumental fluted sanctuary pillars
    for (const offset of [-26, -19, -12, -5.6, 5.6, 12, 19, 26]) {
      drawFlutedPillar(centerX + offset * TILE, deckY, bodyH, 34, false);
    }

    // Carved Architrave & Glyph Frieze above the pillars
    const entY = bodyTop - 5 * TILE;
    rect(bodyLeft - 14, bodyTop - 8, bodyHalfW * 2 + 28, 8, PALETTE.carvedHi);
    rect(bodyLeft - 14, bodyTop - 8, bodyHalfW * 2 + 28, 2, PALETTE.carvedPale);
    rect(bodyLeft - 8, entY + 16, bodyHalfW * 2 + 16, 56, PALETTE.wallMid);
    rect(bodyLeft - 16, entY, bodyHalfW * 2 + 32, 16, PALETTE.wallLight);
    rect(bodyLeft - 16, entY, bodyHalfW * 2 + 32, 3, PALETTE.carvedPale);
    // Recessed wave-glyph blocks along the frieze
    for (let gx = centerX - 27.5 * TILE; gx <= centerX + 26.5 * TILE; gx += 38) {
      rect(gx, entY + 26, 24, 30, PALETTE.deepSlate);
      rect(gx + 4, entY + 31, 16, 3, PALETTE.carvedHi);
      rect(gx + 6, entY + 40, 12, 6, PALETTE.aquaGlow);
    }

    // Six massive terraced sanctuary levels and a trident crown.
    const tierWidths = [53, 45, 36, 28, 19, 10];
    const tierHeight = 96;
    tierWidths.forEach((tilesWide, idx) => {
      const w = tilesWide * TILE;
      const ty = entY - (idx + 1) * tierHeight;
      const tx = centerX - w / 2;
      drawAshlarWall(tx, ty, w, tierHeight);
      rect(tx - 4, ty, w + 8, 6, PALETTE.carvedPale);
      rect(tx - 4, ty + 6, w + 8, 5, PALETTE.wallLight);
      // Repeated vaulted reliefs and buttresses make every terrace read at overview scale.
      for (let nx = tx + 40; nx < tx + w - 24; nx += 72) {
        poly([[nx - 17, ty + 81], [nx - 17, ty + 42], [nx, ty + 20], [nx + 17, ty + 42], [nx + 17, ty + 81]], PALETTE.deepSlate);
        rect(nx - 2, ty + 42, 4, 20, PALETTE.aquaGlow);
        drawFlutedPillar(nx + 28, ty + tierHeight, 80, 12);
      }
    });
    // Monumental Crown trident crest at apex
    const apexY = entY - tierWidths.length * tierHeight;
    rect(centerX - 18, apexY - 22, 36, 22, PALETTE.carvedHi);
    rect(centerX - 4, apexY - 48, 8, 48, PALETTE.carvedPale);
    rect(centerX - 18, apexY - 40, 5, 18, PALETTE.carvedPale);
    rect(centerX + 13, apexY - 40, 5, 18, PALETTE.carvedPale);
    rect(centerX - 18, apexY - 25, 36, 5, PALETTE.carvedHi);
    ctx.beginPath();
    ctx.arc(centerX, apexY - 12, 5, 0, Math.PI * 2);
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
