import { createWildChest } from './wild-chest.js';

// Hand-placed silhouettes with swimmable gaps. Coordinates are anchored to the
// original island, not screen pixels, so chunk boundaries and saves are stable.
const WEST = [
  [-145,'reef'],[-195,'ruin'],[-241,'bones'],[-284,'kelp'],[-332,'ruin'],
  [-390,'reef'],[-443,'bones'],[-492,'ruin'],[-550,'kelp'],[-602,'ruin'],
  [-655,'bones'],[-677,'reef'],[-750,'ruin'],
];
const EAST = [
  [185,'reef'],[245,'ruin'],[300,'bones'],[350,'kelp'],[408,'ruin'],
  [465,'reef'],[518,'bones'],[572,'ruin'],[628,'kelp'],[682,'ruin'],
  [738,'bones'],[789,'reef'],[820,'ruin'],
];
export const oceanVentColumns = Object.freeze([
  -178,-245,-320,-400,-480,-560,-640,-720,-780,
  200,265,335,405,475,545,615,685,755,825,
]);

export function oceanLandmarks({ groundAt, westExtension, tile }) {
  const result = [];
  for (const [side, sites] of [['west', WEST], ['east', EAST]]) {
    sites.forEach(([column, style], index) => {
      const id = 'ocean-' + side + '-' + index;
      const tx = column + westExtension;
      const radius = style === 'bones' ? 180 : style === 'ruin' ? 134 : 112;
      const height = style === 'bones' ? 145 : style === 'ruin' ? 180 : 140;
      // Anchor the silhouette to the shallowest ground under its footprint;
      // individual foundations extend down into the changing seabed.
      const floor = Math.min(...Array.from({length: 9}, (_, i) => groundAt(tx + i - 4)));
      const x = (tx + .5) * tile;
      const y = floor * tile;
      result.push({ id, kind: 'ocean-landmark', style, variant: index % 3,
        x, y, radius, height });
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
