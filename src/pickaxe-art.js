export function drawPickaxe(rect, tier) {
  rect(7, -1, 7, 2, '#85604c');
  rect(8, -1, 5, 1, '#d29c65');
  rect(12, -4, 3, 8, tier === 2 ? '#a35646' : '#6e888a');
  rect(13, -3, 2, 6, tier === 2 ? '#e09b71' : '#b5c6bd');
  rect(12, -4, 2, 1, tier === 2 ? '#ffd3a0' : '#d9e1cf');
}
