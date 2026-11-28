import { createWildChest } from './wild-chest.js';

// Hand-placed silhouettes with swimmable gaps. Coordinates are anchored to the
// original island, not screen pixels, so chunk boundaries and saves are stable.
const WEST = [
  [-213,'reef'],[-260,'ruin',0.8,2],[-241,'bones',.66,0],[-284,'kelp'],[-332,'ruin',1.45,0],
  [-390,'reef'],[-443,'bones',2.85,1],[-492,'ruin',1.1,2],[-550,'kelp'],[-602,'ruin',2.1,1],
  [-655,'bones',1.45,2],[-677,'reef'],[-750,'ruin',1.35,0],
];
const EAST = [
  [185,'reef'],[245,'ruin',0.8,2],[300,'bones',1.05,2],[350,'kelp'],[408,'ruin',1.6,0],
  [465,'reef'],[518,'bones',1.8,0],[572,'ruin',1.15,1],[628,'kelp'],[682,'ruin',1.8,2],
  [738,'bones',3.2,1],[789,'reef'],[820,'ruin',1.35,0],
];
export const oceanVentColumns = Object.freeze([
  -178,-245,-320,-400,-480,-560,-640,-720,-780,
  200,265,335,405,475,545,615,685,755,825,
]);

export function oceanLandmarks({ groundAt, westExtension, tile }) {
  const result = [];
  for (const [side, sites] of [['west', WEST], ['east', EAST]]) {
    sites.forEach(([column, style, scale = 1, form], index) => {
      const id = 'ocean-' + side + '-' + index;
      const tx = column + westExtension;
      const radius = Math.ceil((style === 'bones' ? 205 : style === 'ruin' ? 158 : 125) * scale);
      const nominalHeight = (style === 'bones' ? 170 : style === 'ruin' ? 222 : 148) * scale;
      const extent = Math.ceil(radius / tile) + 2;
      const floorStart = tx - extent;
      const floorProfile = Array.from({length: extent * 2 + 1}, (_, i) => groundAt(floorStart + i) * tile);
      const x = (tx + .5) * tile;
      const y = groundAt(tx) * tile;
      const topY = Math.min(...floorProfile) - nominalHeight;
      const bottomY = Math.max(...floorProfile);
      result.push({ id, kind: 'ocean-landmark', style, variant: form ?? index % 3,
        x, y, radius, scale, height: y - topY, topY, bottomY,
        floorStart, floorProfile, tile });
      if (style === 'ruin') {
        result.push(createWildChest({ id: id + '-chest', name: 'Sunken ruin chest',
          x, y: groundAt(tx) * tile - 8, lootTable: 'sunken-ruins' }));
      }
      // Harvestable kelp at the fringes of the scenery, kept away from chests.
      if (style === 'kelp' || style === 'reef') {
        for (const dx of [-5,-2,2,5]) {
          const kx = tx + dx, ty = groundAt(kx);
          result.push({id: id + '-kelp-' + dx, kind:'kelp', amount:1, tx:kx, ty,
            x:(kx + .5)*tile, y:ty*tile - 12});
        }
      }
    });
  }
  // All scenery is rendered before loot, keeping the chest in the foreground.
  return result;
}
