import { mineDecks } from './world/island-cave.js';

export function drawCaveStructure(rect, polygon, { kind, postFeet = [0, 0] }, x, y) {
  if (kind === 'skeleton') {
    polygon([[x - 19, y - 4], [x - 14, y - 7], [x - 9, y - 6], [x - 2, y - 1], [x - 15, y - 1]], '#72645b');
    rect(x + 7, y - 9, 9, 7, '#c7b393');
    rect(x + 12, y - 6, 2, 2, '#423b42');
    rect(x + 7, y - 4, 7, 3, '#aa987f');
    rect(x - 4, y - 4, 11, 2, '#d2bda1');
    for (let i = 0; i < 3; i++) rect(x - 4 + i * 3, y - 6, 1, 5, '#ad9b83');
    rect(x - 20, y - 1, 11, 1, '#9c8c7a');
  } else if (kind === 'lamp') {
    rect(x - 1, y - 23, 3, 23, '#664b43');
    rect(x - 7, y - 24, 9, 2, '#956749');
    rect(x - 14, y - 27, 14, 15, '#efb16426');
    rect(x - 10, y - 23, 7, 9, '#5f4d49');
    rect(x - 9, y - 22, 5, 6, '#f5be76');
    rect(x - 8, y - 21, 2, 3, '#ffe3a3');
  } else if (kind === 'cart') {
    // Broken rails and a tipped ore truck sit beside the fork.
    rect(x - 31, y - 2, 49, 1, '#665958');
    rect(x + 21, y - 3, 7, 1, '#675756');
    for (const tie of [-27, -17, -7, 4, 14, 24]) rect(x + tie, y - 2, 4, 2, '#8a674d');
    polygon([[x - 18, y - 14], [x + 6, y - 18], [x + 3, y - 6], [x - 11, y - 4]], '#484148');
    polygon([[x - 16, y - 13], [x + 3, y - 16], [x + 1, y - 8], [x - 10, y - 6]], '#76584a');
    rect(x - 14, y - 12, 12, 1, '#a37c58');
    rect(x - 9, y - 6, 4, 4, '#423a40');
    rect(x, y - 7, 5, 5, '#423a40');
    rect(x + 2, y - 5, 1, 1, '#8c7671');
    polygon([[x + 10, y - 2], [x + 14, y - 6], [x + 19, y - 4], [x + 17, y - 1]], '#907261');
  } else if (kind === 'trestle') {
    rect(x - 33, y - 6, 67, 6, '#523d3d');
    rect(x - 33, y - 6, 67, 2, '#bd8c5d');
    for (const offset of [-28, -5, 19]) {
      rect(x + offset, y, 3, 23, '#62484a');
      polygon([[x + offset, y + 3], [x + offset + 3, y + 3],
        [x + offset + 20, y + 18], [x + offset + 17, y + 20]], '#78564c');
      rect(x + offset, y - 5, 2, 2, '#493535');
    }
  } else if (kind === 'headframe') {
    for (const [i, side] of [-60, 54].entries()) {
      const base = postFeet[i];
      rect(x + side, y - 116, 6, 116 + base, '#4d3635');
      rect(x + side + 1, y - 113, 2, 110 + base, '#936945');
      rect(x + side - 4, y + base - 6, 14, 6, '#664743');
    }
    for (const { rise } of mineDecks.headframe.slice(1)) {
      rect(x - 66, y - rise, 132, 5, '#76533f');
      rect(x - 63, y - rise, 126, 1, '#b48552');
      if (rise > 47) {
        const braceEnd = rise === 116 ? 83 : 47;
        for (const side of [-1, 1]) {
          const beam = x + side * 57;
          polygon([[beam, y - rise + 5], [x + side * 24, y - braceEnd],
            [x + side * 33, y - braceEnd], [beam, y - rise + 12]], '#63453b');
        }
      }
    }
    rect(x - 25, y - 84, 2, 64, '#967c60');
    rect(x + 22, y - 84, 2, 64, '#967c60');
    rect(x - 26, y - 22, 52, 4, '#684841');
    rect(x - 25, y - 23, 50, 1, '#ab8455');
    const climbHeight = mineDecks.headframe.at(-1).rise;
    for (const rail of [-11, 8]) rect(x + rail, y - climbHeight, 2, climbHeight, '#805c48');
    for (let rung = 4; rung < climbHeight; rung += 8) rect(x - 10, y - rung, 20, 2, '#a37956');
  } else if (kind === 'shaft' || kind === 'worksite') {
    for (const side of [-29, 24]) {
      rect(x + side, y - 48, 5, 48, '#665048');
      rect(x + side, y - 47, 1, 46, '#a98762');
    }
    rect(x - 35, y - 49, 69, 5, '#8b684f');
    rect(x - 34, y - 48, 66, 1, '#b4895b');
    polygon([[x - 29, y - 35], [x - 19, y - 46], [x - 14, y - 46], [x - 29, y - 30]], '#856654');
    polygon([[x + 25, y - 35], [x + 14, y - 46], [x + 10, y - 46], [x + 25, y - 30]], '#856654');
    if (kind === 'shaft') {
      rect(x - 8, y - 43, 2, 43, '#9b7957');
      rect(x + 6, y - 43, 2, 43, '#9b7957');
      for (let i = 3; i < 44; i += 7) rect(x - 7, y - i, 14, 2, '#846950');
    } else {
      rect(x - 14, y - 8, 24, 5, '#866350');
      rect(x - 10, y - 5, 2, 5, '#654a42');
      rect(x + 5, y - 5, 2, 5, '#654a42');
      rect(x + 15, y - 10, 8, 10, '#a17b53');
      rect(x + 15, y - 3, 8, 1, '#766260');
    }
  } else {
    const arch = kind === 'arch' || kind === 'gate';
    if (kind === 'gate') {
      rect(x - 19, y - 45, 38, 45, '#211b2d');
      for (let bar = -16; bar <= 16; bar += 8) {
        rect(x + bar, y - 45, 3, 38 + Math.abs(bar) % 7, '#423a56');
        rect(x + bar, y - 43, 1, 31, '#62506e');
      }
      rect(x - 19, y - 26, 18, 3, '#76627a');
      rect(x + 6, y - 24, 13, 3, '#58516b');
    }
    for (const offset of arch ? [-25, 17] : [-5]) {
      rect(x + offset - 2, y - 47, 13, 5, '#625875');
      for (let sy = -42; sy < 0; sy += 7) {
        rect(x + offset, y + sy, 10, 6, '#504660');
        rect(x + offset, y + sy, 1, 5, '#706583');
        rect(x + offset + 8, y + sy + 1, 2, 4, '#3d3650');
      }
      rect(x + offset - 3, y - 3, 16, 3, '#70627d');
    }
    if (arch) {
      polygon([[x - 27, y - 46], [x - 19, y - 58], [x - 8, y - 62], [x + 10, y - 62],
        [x + 22, y - 55], [x + 28, y - 46], [x + 18, y - 47], [x + 10, y - 54],
        [x - 8, y - 54], [x - 17, y - 47]], '#675a77');
      rect(x - 3, y - 63, 7, 10, '#9380a0');
      rect(x - 2, y - 62, 5, 1, '#b29eb3');
    }
  }
}
