export function drawRootGrove(rect, polygon, noise, x, ground, time) {
  const scale = 1.55;
  const form = (points, color) => polygon(points.map(([dx, dy]) => [x + dx * scale, ground + dy * scale]), color);
  for (const [width, height, color] of [[218, 292, '#8ccb7311'], [178, 258, '#a9de7c14'], [135, 217, '#d5e89a10']]) {
    polygon([[x - width, ground], [x + width, ground], [x + 48, ground - height],
      [x - 31, ground - height - 37]], color);
  }
  // Several long roots snake below the ledge to the lower gallery.
  for (const [dx, lean, depth] of [[-34, -36, 64], [-19, -14, 73], [8, 30, 61], [28, 48, 45]]) {
    form([[dx - 4, -5], [dx - 3, 22], [dx + lean * .45, depth * .64],
      [dx + lean, depth], [dx + lean * .6, depth * .6], [dx + 5, 22], [dx + 6, -7]], '#4e5537');
    form([[dx - 2, 9], [dx, 22], [dx + lean * .45, depth * .64],
      [dx + lean * .54, depth * .61], [dx + 2, 20]], '#727a46');
  }
  for (let i = 0; i < 57; i++) {
    const dx = (noise(i, 5) - .5) * 246;
    const dy = -137 - noise(i, 8) * 68 + Math.abs(dx) * .26;
    const radius = 13 + noise(i, 13) * 19;
    const canopy = [[dx - radius, dy], [dx - radius * .5, dy - radius * .7], [dx + radius * .5, dy - radius * .83],
      [dx + radius, dy - 3], [dx + radius * .65, dy + radius * .5], [dx - radius * .7, dy + radius * .7]];
    form(canopy, ['#264d38', '#325f41', '#42724a', '#54824e', '#699750'][i % 5]);
  }
  form([[-66, 0], [-32, -11], [-15, -33], [-17, -84], [-27, -110], [-72, -148], [-83, -153],
    [-60, -150], [-24, -132], [-13, -115], [-3, -165], [6, -181], [3, -137],
    [12, -113], [42, -139], [87, -149], [46, -129], [19, -91], [13, -41],
    [29, -14], [64, 0], [22, -4], [0, -17], [-18, -5]], '#614b42');
  form([[-39, -3], [-22, -14], [-9, -36], [-9, -81], [-16, -103], [-38, -128],
    [-12, -112], [1, -90], [4, -46], [-2, -20], [-17, -8]], '#907055');
  form([[3, -43], [6, -85], [12, -107], [45, -134], [29, -104], [15, -82], [11, -28]], '#463e38');
  form([[-37, -5], [-15, -17], [4, -13], [21, -8], [43, -3], [17, -5], [2, -9], [-17, -8]], '#59753f');
  for (let i = 0; i < 43; i++) {
    const dx = (noise(i, 48) - .5) * 236;
    const dy = -131 - noise(i, 50) * 62 + Math.abs(dx) * .27;
    const reach = 3 + noise(i, 53) * 15;
    const bend = Math.sin(time * 1.05 + i) * 1.4;
    form([[dx, dy - 2], [dx + 3, dy], [dx + bend + 1, dy + reach], [dx + bend - 1, dy + reach]],
      ['#507842', '#759d50', '#93af5c'][i % 3]);
  }
  for (let i = 0; i < 46; i++) {
    const dx = (noise(i, 19) - .5) * 390;
    const y = -295 + noise(i, 23) * 276;
    const flyX = x + dx + Math.sin(time * .81 + i * 3) * 13;
    const flyY = ground + y + Math.cos(time * .93 + i) * 10;
    if (Math.sin(time * 1.9 + i * 3) > -.33) {
      rect(flyX - 3, flyY - 3, 7, 7, '#d4eda21e');
      rect(flyX, flyY, i % 3 ? 1 : 2, 1, '#eaf6ae');
    }
  }
}
