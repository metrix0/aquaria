export function drawRootGrove(rect, polygon, noise, x, ground, time) {
  const form = (points, color) => polygon(points.map(([dx, dy]) => [x + dx, ground + dy]), color);
  for (let i = 0; i < 32; i++) {
    const dx = (noise(i, 5) - .5) * 230;
    const dy = -137 - noise(i, 8) * 48 + Math.abs(dx) * .26;
    const radius = 13 + noise(i, 13) * 19;
    const canopy = [[dx - radius, dy], [dx - radius * .5, dy - radius * .7], [dx + radius * .5, dy - radius * .83],
      [dx + radius, dy - 3], [dx + radius * .65, dy + radius * .5], [dx - radius * .7, dy + radius * .7]];
    form(canopy, ['#294f40', '#325b47', '#406c49', '#4c7852', '#60885a'][i % 5]);
  }
  form([[-66, 0], [-32, -11], [-15, -33], [-17, -84], [-27, -110], [-72, -148], [-83, -153],
    [-60, -150], [-24, -132], [-13, -115], [-3, -165], [6, -181], [3, -137],
    [12, -113], [42, -139], [87, -149], [46, -129], [19, -91], [13, -41],
    [29, -14], [64, 0], [22, -4], [0, -17], [-18, -5]], '#614b42');
  form([[-39, -3], [-22, -14], [-9, -36], [-9, -81], [-16, -103], [-38, -128],
    [-12, -112], [1, -90], [4, -46], [-2, -20], [-17, -8]], '#907055');
  form([[3, -43], [6, -85], [12, -107], [45, -134], [29, -104], [15, -82], [11, -28]], '#463e38');
  form([[-37, -5], [-15, -17], [4, -13], [21, -8], [43, -3], [17, -5], [2, -9], [-17, -8]], '#59753f');
  for (let i = 0; i < 29; i++) {
    const dx = (noise(i, 19) - .5) * 254;
    const y = -195 + noise(i, 23) * 173;
    const flyX = x + dx + Math.sin(time * .81 + i * 3) * 13;
    const flyY = ground + y + Math.cos(time * .93 + i) * 10;
    if (Math.sin(time * 1.9 + i * 3) > -.33) {
      rect(flyX - 3, flyY - 3, 7, 7, '#d4eda21e');
      rect(flyX, flyY, i % 3 ? 1 : 2, 1, '#eaf6ae');
    }
  }
}
