const spawnIcons = new Map();

export function drawSpawnHead(rect, kind) {
  switch (kind) {
    case 'crab':
      rect(3, 5, 10, 6, '#c85a42');
      rect(4, 4, 8, 5, '#e87d56');
      rect(1, 3, 3, 3, '#e87d56');
      rect(12, 3, 3, 3, '#e87d56');
      rect(5, 3, 2, 2, '#192b3e');
      rect(9, 3, 2, 2, '#192b3e');
      return;
    case 'fish':
      rect(2, 6, 3, 4, '#d99e4c');
      rect(4, 4, 9, 8, '#e8b964');
      rect(5, 5, 7, 3, '#f6db96');
      rect(10, 6, 2, 2, '#192b3e');
      return;
    case 'reef-snapper':
      rect(2, 6, 3, 4, '#6a3938');
      rect(4, 4, 9, 8, '#a96250');
      rect(5, 5, 7, 3, '#e1aa78');
      rect(10, 6, 2, 2, '#192b3e');
      return;
    case 'lanternfish':
      rect(2, 6, 3, 4, '#3b3064');
      rect(4, 4, 8, 8, '#745597');
      rect(12, 3, 2, 2, '#a9f3ca');
      rect(9, 6, 2, 2, '#192b3e');
      return;
    case 'jellyfish':
      rect(4, 2, 8, 6, '#d99db8');
      rect(5, 3, 6, 3, '#f4c7db');
      rect(5, 8, 1, 5, '#b87a98');
      rect(8, 8, 1, 6, '#b87a98');
      rect(10, 8, 1, 5, '#b87a98');
      return;
    case 'squid':
      rect(4, 2, 8, 8, '#96445f');
      rect(5, 3, 6, 5, '#c96f89');
      rect(5, 10, 2, 4, '#753149');
      rect(9, 10, 2, 4, '#753149');
      rect(6, 6, 1, 2, '#f8dca5');
      rect(9, 6, 1, 2, '#f8dca5');
      return;
    case 'shark':
      rect(2, 5, 11, 6, '#4c616e');
      rect(6, 2, 3, 3, '#384a54');
      rect(3, 8, 10, 3, '#cfd8dc');
      rect(9, 9, 1, 2, '#ffffff');
      rect(11, 9, 1, 2, '#ffffff');
      rect(9, 6, 2, 2, '#192b3e');
      return;
    case 'lionfish':
      rect(4, 1, 2, 4, '#b552e6');
      rect(9, 1, 2, 4, '#b552e6');
      rect(4, 11, 2, 4, '#b552e6');
      rect(9, 11, 2, 4, '#b552e6');
      rect(3, 4, 10, 8, '#c73c4a');
      rect(5, 4, 2, 8, '#f0dec2');
      rect(9, 4, 2, 8, '#f0dec2');
      rect(10, 6, 2, 2, '#ffe066');
      return;
    case 'pufferfish':
      rect(7, 1, 2, 2, '#9bd959');
      rect(7, 13, 2, 2, '#9bd959');
      rect(1, 7, 2, 2, '#9bd959');
      rect(13, 7, 2, 2, '#9bd959');
      rect(3, 3, 10, 10, '#c99c4c');
      rect(4, 8, 8, 4, '#f2e2b8');
      rect(8, 5, 3, 3, '#fffdf0');
      rect(9, 6, 1, 2, '#192b3e');
      return;
    case 'kraken':
      rect(3, 2, 10, 11, '#491f3d');
      rect(4, 3, 8, 8, '#7e4268');
      rect(5, 4, 6, 5, '#b0667d');
      rect(5, 8, 2, 2, '#f0c88b');
      rect(9, 8, 2, 2, '#f0c88b');
      rect(4, 12, 2, 3, '#7e4268');
      rect(10, 12, 2, 3, '#7e4268');
      return;
    case 'spider':
    case 'ambient-spider':
      rect(2, 5, 2, 6, '#36263d');
      rect(12, 5, 2, 6, '#36263d');
      rect(4, 4, 8, 8, '#26182c');
      rect(5, 6, 2, 2, '#e84855');
      rect(9, 6, 2, 2, '#e84855');
      return;
    case 'archer':
      rect(4, 3, 8, 10, '#3a4b52');
      rect(5, 5, 6, 7, '#cfd8dc');
      rect(6, 7, 1, 2, '#192b3e');
      rect(9, 7, 1, 2, '#192b3e');
      return;
    case 'miner':
      rect(3, 3, 10, 4, '#e0b24c');
      rect(7, 3, 2, 2, '#fff5b8');
      rect(4, 7, 8, 6, '#cfd8dc');
      rect(5, 9, 2, 2, '#192b3e');
      rect(9, 9, 2, 2, '#192b3e');
      return;
    case 'hammer':
      rect(4, 3, 8, 4, '#6d7f88');
      rect(4, 7, 8, 6, '#d6dee2');
      rect(5, 9, 2, 2, '#ff7357');
      rect(9, 9, 2, 2, '#ff7357');
      return;
    case 'scorpion':
      rect(3, 5, 10, 7, '#8f522d');
      rect(4, 6, 8, 5, '#c47b43');
      rect(10, 2, 3, 4, '#e8a85a');
      rect(5, 8, 2, 2, '#192b3e');
      return;
    case 'mimic':
      rect(2, 4, 12, 9, '#7a4d30');
      rect(3, 5, 10, 3, '#9c6642');
      rect(3, 8, 10, 2, '#ffffff');
      rect(4, 8, 2, 2, '#7a4d30');
      rect(8, 8, 2, 2, '#7a4d30');
      rect(7, 6, 2, 2, '#f0c869');
      return;
    case 'blood-bat':
    case 'ambient-bat':
      rect(1, 5, 4, 5, kind === 'blood-bat' ? '#7a1f2d' : '#43384d');
      rect(11, 5, 4, 5, kind === 'blood-bat' ? '#7a1f2d' : '#43384d');
      rect(5, 4, 6, 7, kind === 'blood-bat' ? '#a62c3d' : '#5e506b');
      rect(6, 6, 1, 2, '#ffe066');
      rect(9, 6, 1, 2, '#ffe066');
      return;
    case 'cannibal-spear':
    case 'cannibal-bow':
      rect(4, 2, 8, 3, kind === 'cannibal-bow' ? '#4f9e52' : '#c94c38');
      rect(4, 5, 8, 8, '#8a593c');
      rect(5, 7, 2, 2, '#f2e8cf');
      rect(9, 7, 2, 2, '#f2e8cf');
      rect(6, 10, 4, 2, '#d9cbb3');
      return;
    case 'shaman':
      rect(3, 2, 2, 4, '#d9cbb3');
      rect(11, 2, 2, 4, '#d9cbb3');
      rect(4, 4, 8, 9, '#e6dec8');
      rect(5, 7, 2, 2, '#62d996');
      rect(9, 7, 2, 2, '#62d996');
      return;
    case 'cave-frog':
    case 'frog':
      rect(3, 5, 10, 8, kind === 'cave-frog' ? '#497d3b' : '#5e9649');
      rect(4, 3, 3, 3, '#f0c869');
      rect(9, 3, 3, 3, '#f0c869');
      rect(5, 4, 1, 2, '#192b3e');
      rect(10, 4, 1, 2, '#192b3e');
      rect(5, 10, 6, 2, '#a3c977');
      return;
    case 'worm':
      rect(3, 4, 10, 9, '#4c7a45');
      rect(4, 5, 8, 7, '#75ad5e');
      rect(5, 10, 2, 3, '#d9cbb3');
      rect(9, 10, 2, 3, '#d9cbb3');
      rect(5, 7, 2, 2, '#192b3e');
      rect(9, 7, 2, 2, '#192b3e');
      return;
    case 'ghost':
      rect(4, 3, 8, 10, '#9ce0d5');
      rect(5, 4, 6, 6, '#ccf2df');
      rect(5, 6, 2, 2, '#26485c');
      rect(9, 6, 2, 2, '#26485c');
      return;
    case 'ambient-ant':
      rect(3, 6, 3, 4, '#593327');
      rect(6, 5, 4, 5, '#7a4635');
      rect(10, 5, 3, 4, '#593327');
      return;
    default:
      rect(4, 4, 8, 8, '#7ebcb0');
      rect(5, 6, 2, 2, '#192b3e');
      rect(9, 6, 2, 2, '#192b3e');
  }
}

/** Generate a cached pixel-art creature head icon URL for a spawn item. */
export function spawnCreatureIcon(kind) {
  if (!spawnIcons.has(kind)) {
    const sprite = document.createElement('canvas');
    sprite.width = 16;
    sprite.height = 16;
    const ctx = sprite.getContext('2d');
    drawSpawnHead((x, y, width, height, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    }, kind);
    spawnIcons.set(kind, 'url("' + sprite.toDataURL() + '")');
  }
  return spawnIcons.get(kind);
}
