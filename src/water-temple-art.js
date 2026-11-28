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
  gold: '#ad9272',
  goldLight: '#dfc59a',
  abyss: '#0c202b',
  patina: '#6ca99b',
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
  const topY = (WATER_TEMPLE.topRow - 2) * TILE;
  const door = waterTempleDoorBounds(WEST_EXTENSION);
  const puzzleDoor = waterTemplePuzzleDoorBounds(WEST_EXTENSION);

  let view = null;
  function visible(x, y, width, height) {
    return !view || (x + width >= view.left && x <= view.right && y + height >= view.top && y <= view.bottom);
  }

  function rect(x, y, width, height, color) {
    if (!visible(x, y, width, height)) return;
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
    if (!visible(x, y, width, height)) return;
    rect(x, y, width, height, PALETTE.wallDark);
    const courseHeight = 12;
    const rows = Math.ceil(height / courseHeight);
    const firstRow = view ? Math.max(0, Math.floor((view.top - y) / courseHeight)) : 0;
    const lastRow = view ? Math.min(rows, Math.ceil((view.bottom - y) / courseHeight) + 1) : rows;
    for (let r = firstRow; r < lastRow; r++) {
      const cy = y + r * courseHeight;
      const ch = Math.min(courseHeight, y + height - cy);
      rect(x, cy + ch - 1, width, 1, PALETTE.deepSlate);
      const offset = r % 2 ? 14 : 0;
      const blockW = 28;
      const origin = x - offset;
      const firstBlock = view ? Math.max(0, Math.floor((view.left - origin) / blockW)) : 0;
      for (let bx = origin + firstBlock * blockW; bx < x + width && (!view || bx <= view.right); bx += blockW) {
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

  // The same architectural vocabulary runs from the stair foot to the high sanctum.
  const colX = column => (column + WEST_EXTENSION + .5) * TILE;
  const S = PALETTE;
  function cornice(x, y, w, h = 14) {
    rect(x - 5, y, w + 10, h, S.deepSlate);
    rect(x - 8, y, w + 16, 4, S.carvedPale);
    rect(x - 3, y + 4, w + 6, Math.max(1, h - 7), S.wallLight);
    rect(x, y + h - 3, w, 3, S.gold);
  }

  // Pointed, stepped arches are actual negative spaces in the painted facade.
  function arch(cx, base, width, height, trim = 9) {
    if (!visible(cx - width / 2, base - height, width, height)) return;
    const half = width / 2, top = base - height, spring = top + width * .54;
    const shape = (inset, color) => {
      const l = cx - half + inset, r = cx + half - inset, t = top + inset * 1.4;
      poly([[l, base], [l, spring + inset], [l + width * .13, t + width * .26],
        [cx, t], [r - width * .13, t + width * .26], [r, spring + inset], [r, base]], color);
    };
    shape(0, S.carvedHi);
    shape(trim, S.deepSlate);
    shape(trim + 5, S.abyss);
    rect(cx - 4, top + 7, 8, 15, S.goldLight);
    for (const side of [-1, 1]) {
      rect(cx + side * (half - 4) - 2, spring + 6, 4, Math.max(1, base - spring - 6), S.carvedPale);
    }
  }

  function jewel(cx, cy, r) {
    if (!visible(cx-r-8, cy-r-8, r*2+16, r*2+16)) return;
    poly([[cx, cy-r-7], [cx+r+7, cy], [cx, cy+r+7], [cx-r-7, cy]], S.deepSlate);
    poly([[cx, cy-r], [cx+r, cy], [cx, cy+r], [cx-r, cy]], S.gold);
    poly([[cx, cy-r+4], [cx+r-4, cy], [cx, cy+r-4], [cx-r+4, cy]], S.aquaGlow);
    poly([[cx, cy-r+5], [cx+2, cy], [cx, cy+r-5], [cx-r+5, cy]], S.aquaCore);
  }

  function dome(cx, base, half, height, gilded = false) {
    if (!visible(cx-half-16, base-height-30, half*2+32, height+35)) return;
    const top = base-height;
    // Thick segmented ribs on an onion-shaped crown, with a carved crest.
    const outline = [[cx-half,base],[cx-half,base-height*.17],[cx-half*.82,base-height*.47],
      [cx-half*.48,base-height*.73],[cx-half*.18,base-height*.91],[cx,top],
      [cx+half*.18,base-height*.91],[cx+half*.48,base-height*.73],[cx+half*.82,base-height*.47],
      [cx+half,base-height*.17],[cx+half,base]];
    poly(outline, S.deepSlate);
    poly(outline.map(([x,y])=>[cx+(x-cx)*.94,base+(y-base)*.96]), S.wallLight);
    for (const f of [-.78,-.52,-.26,0,.26,.52,.78]) {
      const rib = f * half;
      poly([[cx+rib-3,base-8],[cx+rib*.94-3,base-height*.26],
        [cx+rib*.61-2,base-height*.58],[cx+rib*.24,base-height*.83],[cx,top+4],
        [cx+rib*.24+4,base-height*.83],[cx+rib*.61+5,base-height*.58],
        [cx+rib*.94+5,base-height*.26],[cx+rib+5,base-8]], gilded ? S.gold : S.carvedHi);
    }
    cornice(cx-half,base-6,half*2,15);
    rect(cx-4,top-20,8,21,S.goldLight);
    jewel(cx,top-13,7);
  }

  function tower(cx, floor, width, height, variant = 0) {
    const x = cx-width/2, top = floor-height;
    if (!visible(x-20,top-110,width+40,height+120)) return;
    drawAshlarWall(x,top,width,height);
    rect(x+4,top,width*.18,height,S.wallLight);
    rect(x+width*.81,top,width*.15,height,S.deepSlate);
    for (const side of [-1,1]) drawFlutedPillar(cx+side*(width/2-10),floor,height,19);
    const levels = variant === 1 ? 3 : 2;
    for (let i=0;i<levels;i++) {
      const y = floor-((i+.2)*height/levels);
      arch(cx,y,width*.52,Math.min(height/levels*.68,width*1.45),5);
      cornice(x,y+3,width,12);
      jewel(cx,y-height/levels*.38,6);
    }
    cornice(x,top,width,16);
    dome(cx,top-4,width*.58,Math.min(112,width*.8),true);
  }

  function guardian(cx, floor, scale, facing) {
    // Ancient crowned sea-king carved in stone, clutching a monumental trident.
    const u = scale, X = n => cx+n*u*facing, Y = n => floor+n*u;
    const P = (pts,color) => poly(pts.map(([x,y])=>[X(x),Y(y)]),color);
    const R = (x,y,w,h,color) => rect(Math.min(X(x),X(x+w)),Y(y),w*u,h*u,color);
    if (!visible(cx-32*u,floor-90*u,64*u,90*u)) return;
    R(-24,-5,48,5,S.deepSlate); R(-20,-10,40,5,S.carvedHi);
    R(-15,-15,30,5,S.wallLight);
    P([[-14,-15],[-12,-35],[-18,-51],[-15,-62],[-8,-66],[8,-66],[16,-61],[18,-50],[12,-35],[15,-15]],S.deepSlate);
    P([[-11,-17],[-8,-35],[-14,-49],[-10,-60],[0,-63],[10,-60],[14,-49],[8,-35],[11,-17]],S.wallLight);
    P([[-10,-60],[0,-54],[10,-60],[5,-47],[0,-43],[-5,-47]],S.gold);
    P([[-13,-50],[-22,-42],[-26,-48],[-22,-61],[-16,-60]],S.wallMid);
    P([[13,-55],[22,-48],[28,-55],[27,-60],[20,-56],[15,-64]],S.carvedHi);
    R(-7,-76,14,13,S.wallLight); R(-5,-75,10,8,S.carvedHi);
    R(-5,-71,3,1,S.aquaCore); R(2,-71,3,1,S.aquaCore);
    P([[-6,-68],[0,-60],[6,-68],[4,-64],[0,-62],[-4,-64]],S.deepSlate);
    P([[-9,-76],[-11,-84],[-4,-80],[0,-87],[4,-80],[11,-84],[9,-76]],S.goldLight);
    R(25,-82,3,67,S.gold); R(18,-82,17,3,S.goldLight);
    R(18,-89,3,9,S.goldLight); R(25,-94,3,14,S.goldLight); R(32,-89,3,9,S.goldLight);
    for (const d of [-7,0,7]) R(d,-40,2,22,S.deepSlate);
    R(-11,-34,22,3,S.gold);
  }

  function processionalHall(cx, floor, width, height) {
    const x=cx-width/2, y=floor-height;
    drawAshlarWall(x,y,width,height);
    for (let px=x+45;px<x+width-30;px+=90) {
      arch(px,floor,68,height-22,7);
      drawFlutedPillar(px-39,floor,height,19);
    }
    drawFlutedPillar(x+width-7,floor,height,18);
    cornice(x,y,width,17);
  }

  function drawCrossingAndPuzzleWing(time, overview) {
    const landingY = WATER_TEMPLE.approachRow*TILE;
    const gateX = (puzzleDoor.x+puzzleDoor.width/2);
    // The eastern shore stair is itself the temple: giant gateway, colonnade
    // and repeated ceremonial gates on the climb. No detached little hut.
    const gateW=250, gateH=390;
    processionalHall(gateX,landingY,gateW,gateH*.64);
    drawAshlarWall(gateX-93,landingY-gateH,186,gateH*.47);
    arch(gateX,landingY,154,gateH-24,14);
    for (const side of [-1,1]) {
      tower(gateX+side*107,landingY,70,gateH-55,0);
      guardian(gateX+side*60,landingY,1.12,side);
    }
    cornice(gateX-104,landingY-gateH,208,19);
    dome(gateX,landingY-gateH-4,96,104,true);
    jewel(gateX,landingY-gateH+44,14);
    // Ascending eastern staircase begins at the distant entry pylons.
    for (let column=WATER_TEMPLE.approachEast+3;column<=WATER_TEMPLE.right-2;column+=6) {
      const cx=colX(column), floor=waterTempleFoundationTop(column)*TILE;
      const first=column>=WATER_TEMPLE.right-8;
      const height=first?170:90;
      drawFlutedPillar(cx,floor,height,24, !first && column%3===0);
      if(first) {
        cornice(cx-25,floor-height,50,12);
        jewel(cx,floor-height-14,9);
      } else {
        rect(cx-13,floor-9,26,7,S.gold);
        jewel(cx,floor-height+12,5);
      }
      const next=Math.min(column+3,WATER_TEMPLE.right);
      const ny=waterTempleFoundationTop(next)*TILE;
      poly([[cx,floor-25],[colX(next),ny-25],[colX(next),ny-16],[cx,floor-16]],S.wallLight);
    }
    // Giant freestanding guardians welcome the player at the stair foot.
    const foot=WATER_TEMPLE.right-3;
    guardian(colX(foot),waterTempleFoundationTop(foot)*TILE,2.2,-1);
    // The gate's west arcade climbs onto the same platform; coral still blocks passage.
    for (let column=WATER_TEMPLE.approachWest-22;column<WATER_TEMPLE.approachWest;column+=4) {
      const cx=colX(column+1.5), floor=waterTempleFoundationTop(column)*TILE;
      const roof=waterTempleFoundationTop(Math.min(column+3,WATER_TEMPLE.approachWest))*TILE-110;
      processionalHall(cx,floor,66,Math.max(110,floor-roof));
    }
    // Preserve the smaller original seal and its precise interaction-aligned bounds.
    const {x,y,width,height}=puzzleDoor;
    rect(x-7,y-9,width+14,height+9,S.carvedHi);
    rect(x,y,width,height,S.doorLeafDark);
    rect(x+4,y+4,width-8,height-5,S.doorLeafMid);
    rect(x+width/2-1,y,2,height,S.deepSlate);
    ctx.beginPath(); ctx.arc(x+width/2,y+height/2,8,0,Math.PI*2);
    ctx.fillStyle=S.gold; ctx.fill();
    jewel(x+width/2,y+height/2,5);
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

    view = { left: left * TILE - TILE, right: (right + 1) * TILE + TILE, top: top * TILE - TILE, bottom: (bottom + 1) * TILE + TILE };

    // Lost ocean capital: a layered basilica, not a uniform stepped pyramid.
    // All buildings share carved teal stone, bronze ornament and luminous sea gems.
    const bodyW=58*TILE, bodyX=centerX-bodyW/2;
    const lowRoof=deckY-30*TILE;
    const highRoof=deckY-61*TILE;
    drawCrossingAndPuzzleWing(time,overview);

    // Distant buttressed side sanctuaries extend the silhouette on both flanks.
    processionalHall(centerX-27*TILE,deckY+TILE,20*TILE,29*TILE);
    processionalHall(centerX+26*TILE,deckY,15*TILE,34*TILE);
    tower(centerX-28*TILE,deckY,116,45*TILE,1);
    tower(centerX+28*TILE,deckY,128,49*TILE,1);

    // Great hall, with a raised sanctum above and a huge central rose seal.
    processionalHall(centerX,deckY,bodyW,30*TILE);
    const upperW=30*TILE;
    drawAshlarWall(centerX-upperW/2,highRoof,upperW,lowRoof-highRoof);
    for(const side of [-1,1]) {
      tower(centerX+side*17*TILE,lowRoof,118,25*TILE,1);
      arch(centerX+side*9*TILE,lowRoof-22,104,25*TILE,10);
      jewel(centerX+side*9*TILE,highRoof+75,14);
    }
    cornice(centerX-upperW/2,highRoof,upperW,24);
    const domeBase=highRoof-4;
    // Wide central crown instead of tiny repeating roof tiers.
    dome(centerX,domeBase,190,205,true);

    // Giant circular ancient ocean seal dominates the central upper wall.
    const sealY=highRoof+185;
    for(const [radius,color] of [[100,S.deepSlate],[93,S.gold],[86,S.wallLight],[74,S.abyss],[65,S.carvedHi],[59,S.deepSlate]]) {
      ctx.beginPath(); ctx.arc(centerX,sealY,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
    }
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6;
      jewel(centerX+Math.cos(angle)*80,sealY+Math.sin(angle)*80,4);
    }
    poly([[centerX-32,sealY-24],[centerX-22,sealY-24],[centerX-22,sealY+2],
      [centerX-5,sealY+14],[centerX-5,sealY-38],[centerX+5,sealY-38],[centerX+5,sealY+14],
      [centerX+22,sealY+2],[centerX+22,sealY-24],[centerX+32,sealY-24],
      [centerX+32,sealY+9],[centerX+5,sealY+27],[centerX+5,sealY+43],
      [centerX-5,sealY+43],[centerX-5,sealY+27],[centerX-32,sealY+9]],S.goldLight);

    // Monumental entrance arch and colossal carved sea-kings.
    arch(centerX,deckY,260,29*TILE-30,14);
    for(const side of [-1,1]) {
      guardian(centerX+side*13*TILE,deckY,3.8,side);
      drawFlutedPillar(centerX+side*8.7*TILE,deckY,30*TILE,42);
    }
    drawBigDoor(time,overview);
    // More architectural rhythm: ornamental buttresses and suspended gems.
    for(const side of [-1,1]) {
      for(const distance of [20,24]) {
        const cx=centerX+side*distance*TILE;
        drawFlutedPillar(cx,deckY,30*TILE,30);
        jewel(cx,lowRoof+44,10);
      }
    }
    cornice(bodyX,lowRoof,bodyW,18);
    for(let x=bodyX+24;x<bodyX+bodyW-16;x+=48) {
      rect(x,lowRoof+20,20,4,S.gold);
    }

    // Temple braziers along portico deck and side wings
    for (const brazier of waterTempleBraziers) {
      const bx = (brazier.column + WEST_EXTENSION + 0.5) * TILE;
      const by = brazier.floor * TILE;
      drawBrazier(bx, by, brazier.main, time, overview);
    }
    view = null;
  }

  function masonry(world, tx, ty, material, overview) {
    if (material !== MATERIAL.stone) return false;
    const column = tx - WEST_EXTENSION;
    if (!waterTempleStoneAt(column, ty)) return false;
    const x = tx * TILE;
    const y = ty * TILE;
    const tone = waterTempleTone(column, ty);
    const floor = waterTempleFoundationTop(column);
    const depth = ty - floor;
    const approach = column >= WATER_TEMPLE.approachWest - 22;
    // Architectural cladding follows the real stairs all the way to their foot.
    rect(x,y,TILE,TILE,depth < 3 ? (tone>.65?'#547b83':'#385b69') : tone>.65?S.wallLight:S.wallMid);
    if (approach && depth >= 3 && depth % 6 === 0) rect(x,y,TILE,3,S.gold);
    if (approach && (column - WATER_TEMPLE.approachEast) % 6 === 0 && depth > 2) rect(x,y,3,TILE,S.carvedHi);
    if (overview && depth > 2) return true;
    // Preserve visible masonry in overview, especially the actual stair treads.
    rect(x, y + TILE - 1, TILE, 1, PALETTE.deepSlate);
    if ((tx + ty) % 2 === 0) rect(x + 7, y, 1, TILE, PALETTE.deepSlate);
    else rect(x + 15, y, 1, TILE, PALETTE.deepSlate);
    // Beveled carved top rim when exposed to ocean water
    if (!tileAt(world, tx, ty - 1)) {
      rect(x, y, TILE, 4, PALETTE.carvedHi);
      rect(x, y, TILE, 2, PALETTE.goldLight);
      if (tone > 0.72) rect(x + 3, y + 2, 5, 2, PALETTE.mossBright);
    }
    return true;
  }

  return { backdrop, masonry };
}
