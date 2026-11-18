const icons = new Map();

export function drawPickaxe(rect, tier) {
  rect(5, -2, 10, 4, '#443638');
  rect(6, -1, 9, 2, '#aa7650');
  rect(7, -1, 7, 1, '#d8a26e');
  rect(6, -2, 1, 4, '#7b5444');
  rect(8, -2, 1, 3, '#7b5444');

  if (tier === 1) {
    rect(13, -5, 3, 1, '#4a5962');
    rect(11, -4, 5, 3, '#4a5962');
    rect(12, -1, 4, 3, '#4a5962');
    rect(14, 2, 2, 2, '#4a5962');
    rect(13, -4, 2, 2, '#a7c1bc');
    rect(12, -3, 2, 1, '#d4ded2');
    rect(12, -2, 3, 1, '#879d9a');
    rect(13, 0, 2, 2, '#879d9a');
    rect(15, 2, 1, 1, '#879d9a');
  } else {
    rect(15, -5, 3, 2, '#79483f');
    rect(12, -4, 5, 2, '#79483f');
    rect(11, -2, 5, 5, '#79483f');
    rect(12, 3, 5, 2, '#79483f');
    rect(15, 5, 3, 1, '#79483f');
    rect(15, -4, 2, 1, '#ffd396');
    rect(13, -3, 3, 1, '#ffb778');
    rect(12, -2, 3, 5, '#ce835b');
    rect(12, -1, 1, 3, '#ffd396');
    rect(14, 3, 2, 1, '#ffb778');
    rect(16, 4, 1, 1, '#ffb778');
  }
}

export function pickaxeIcon(tier) {
  if (!icons.has(tier)) {
    const sprite = document.createElement('canvas');
    sprite.width = 14;
    sprite.height = 12;
    const ctx = sprite.getContext('2d');
    drawPickaxe((x, y, width, height, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - 5, y + 5, width, height);
    }, tier);
    icons.set(tier, 'url("' + sprite.toDataURL() + '")');
  }
  return icons.get(tier);
}
