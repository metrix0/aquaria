import assert from 'node:assert/strict';
import test from 'node:test';
import { atmosphereTint, auroraWorldX, auroraBloomWorldX, hasBackgroundWall, nightShadeAlpha } from '../src/world/atmosphere.js';
import { WEATHER_MODES, worldConditions } from '../src/environment.js';
import { lightningAt, lightningAnchor, distantThunderAt, stormBurstAt, LIGHTNING_NEAR_RADIUS } from '../src/lightning.js';
import { WEST_EXTENSION, groundAt } from '../src/world/generation.js';

test('full-scene weather tint ignores background-wall presence', () => {
  const tx = WEST_EXTENSION + 56;
  assert.equal(hasBackgroundWall(tx, groundAt(tx) + 3), true);
  const storm = worldConditions(360, 42, 'storm');
  assert.ok(atmosphereTint(storm).alpha > 0);
  assert.ok(nightShadeAlpha(storm) > 0);
});

test('daytime overlay colors are visibly distinct across modes', () => {
  const clear = atmosphereTint(worldConditions(360, 42, 'day'));
  const sunny = atmosphereTint(worldConditions(360, 42, 'sunny'));
  const cloudy = atmosphereTint(worldConditions(360, 42, 'cloudy'));
  const pink = atmosphereTint(worldConditions(360, 42, 'rose'), 0, 0);
  const amber = atmosphereTint(worldConditions(360, 42, 'rose'), 0, 15);
  const rain = atmosphereTint(worldConditions(360, 42, 'rain'));
  assert.ok(sunny.alpha > pink.alpha - .03);
  assert.ok(pink.alpha > clear.alpha && clear.alpha > cloudy.alpha);
  assert.ok(cloudy.b > cloudy.r);
  assert.ok(sunny.r > sunny.b);
  assert.ok(rain.b > rain.r);
  assert.ok(rain.alpha > .45);
  assert.notDeepEqual([pink.g, pink.b], [amber.g, amber.b]);
});

test('night uses stronger raw darkening, with distinct intensities', () => {
  const day = worldConditions(360, 42, 'day');
  const moonlit = worldConditions(360, 42, 'night');
  const starry = worldConditions(360, 42, 'starry');
  const deep = worldConditions(360, 42, 'deep-night');
  const aurora = worldConditions(360, 42, 'aurora');
  const storm = worldConditions(360, 42, 'storm');
  assert.equal(nightShadeAlpha(day), 0);
  assert.equal(atmosphereTint(deep).alpha, 0);
  assert.ok(nightShadeAlpha(moonlit) > .4);
  assert.ok(nightShadeAlpha(starry) > nightShadeAlpha(moonlit));
  assert.ok(nightShadeAlpha(deep) > nightShadeAlpha(starry));
  assert.ok(nightShadeAlpha(storm) > nightShadeAlpha(deep));
  assert.ok(nightShadeAlpha(aurora) > nightShadeAlpha(moonlit));
  assert.ok(nightShadeAlpha(storm) < .80);
  const dusk = worldConditions(360, 42, 'dusk');
  assert.ok(nightShadeAlpha(dusk) < nightShadeAlpha(moonlit) / 3);
});

test('all weather presets produce a grade without losing biome transitions', () => {
  for (const entry of WEATHER_MODES) {
    const conditions = worldConditions(360, 42, entry.id);
    const grade = atmosphereTint(conditions, 0);
    const swamp = atmosphereTint(conditions, 1);
    const dark = nightShadeAlpha(conditions);
    assert.ok(Number.isFinite(grade.alpha) && Number.isFinite(dark), entry.id);
    assert.ok(grade.alpha >= 0 && grade.alpha <= .70, entry.id);
    assert.ok(dark >= 0 && dark <= .76, entry.id);
    assert.ok(swamp.alpha > grade.alpha || swamp.alpha === .70, entry.id);
  }
});

test('storm bursts vary between zero and four strokes, with unpredictable spacing', () => {
  const counts = new Set();
  const gaps = new Set();
  for (let w = 0; w < 240; w++) {
    const times = stormBurstAt(w, 17);
    assert.deepEqual(times, stormBurstAt(w, 17));
    counts.add(times.length);
    for (const t of times) assert.ok(t >= w * 25 && t < (w + 1) * 25);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      assert.ok(gap >= .85 && gap <= 2.11);
      gaps.add(gap.toFixed(2));
    }
  }
  assert.deepEqual([...counts].sort(), [0, 1, 2, 3, 4]);
  assert.ok(gaps.size > 12);
});

test('storm flashes remain seeded, weather-gated and reduced-motion friendly', () => {
  const seed = 17;
  const w = Array.from({ length: 50 }, (_, i) => i)
    .find(i => stormBurstAt(i, seed).length);
  const t = stormBurstAt(w, seed)[0];
  const storm = worldConditions(t, seed, 'storm');
  const rain = worldConditions(t, seed, 'rain');
  assert.equal(lightningAt(t + .01, seed, rain), null);
  assert.equal(lightningAt(t - .01, seed, storm), null);
  assert.equal(lightningAt(t + .47, seed, storm), null);
  const first = lightningAt(t + .01, seed, storm);
  const lull = lightningAt(t + .10, seed, storm);
  assert.ok(first.flash > .7 && first.bolt > 0);
  assert.ok(lull.flash < first.flash && lull.bolt === 0);
  assert.ok(first.distance >= .55 && first.distance <= .9);
  assert.deepEqual(lightningAt(t + .01, seed, storm), first);
  const reduced = lightningAt(t + .01, seed, storm, true);
  assert.ok(reduced.flash < first.flash && reduced.bolt < first.bolt);
});

test('lightning remains fixed in world coordinates while the camera moves or zooms', () => {
  const seed = 17;
  const firstCamera = { x: 1400, y: 0, width: 640, height: 380 };
  const movingCamera = { x: 1535, y: 28, width: 640, height: 380 };
  const zoomedCamera = { x: 1650, y: 0, width: 950, height: 420 };
  const strike = { event: 39, flash: 1 };
  const characters = [{ x: 1650, y: 200 }];
  const anchor = lightningAnchor(strike, seed, firstCamera, null, characters);
  assert.equal(lightningAnchor(strike, seed, movingCamera, anchor, characters), anchor);
  assert.equal(lightningAnchor(strike, seed, zoomedCamera, anchor, characters), anchor);
  assert.equal(
    (anchor.worldX - movingCamera.x) - (anchor.worldX - firstCamera.x),
    -(movingCamera.x - firstCamera.x),
  );
  assert.equal(
    (anchor.worldTop - movingCamera.y) - (anchor.worldTop - firstCamera.y),
    -(movingCamera.y - firstCamera.y),
  );
  assert.ok(anchor.worldBottom > anchor.worldTop);
  assert.equal(anchor.worldBottom < 256, true);
  assert.notEqual(lightningAnchor({ event: 40, flash: 1 }, seed, movingCamera, anchor, characters), anchor);
});

test('aurora remains in the world as the camera pans', () => {
  const cameraA = 1400;
  const cameraB = 1710;
  const screenA = 250;
  const screenB = screenA - (cameraB - cameraA);
  assert.equal(auroraWorldX(screenA, cameraA), auroraWorldX(screenB, cameraB));
  const worldBloom = auroraBloomWorldX(4, 55);
  assert.equal(
    (worldBloom - auroraWorldX(0, cameraB)) - (worldBloom - auroraWorldX(0, cameraA)),
    -(cameraB - cameraA),
  );
  assert.equal(auroraBloomWorldX(4, 55), worldBloom);
  assert.notEqual(auroraBloomWorldX(4, 58), worldBloom);
});

test('world-anchored lightning is inside visible sky at its first frame', () => {
  for (const camera of [
    { x: 1400, y: 0, width: 640, height: 380 },
    { x: 1800, y: 12, width: 300, height: 480 },
    { x: 2600, y: 0, width: 920, height: 380 },
  ]) {
    for (let event = 0; event < 40; event++) {
      const strike = { event, flash: 1 };
      const character = { x: camera.x + camera.width * .42, y: 200 };
      const anchor = lightningAnchor(strike, 17, camera, null, [character]);
      const projectedX = anchor.worldX - camera.x;
      const projectedTop = anchor.worldTop - camera.y;
      assert.ok(projectedX >= 0 && projectedX <= camera.width);
      assert.ok(Math.abs(anchor.worldX - character.x) <= LIGHTNING_NEAR_RADIUS);
      assert.ok(projectedTop > 0);
      assert.ok(anchor.worldBottom > anchor.worldTop + 45);
      assert.equal(lightningAnchor(strike, 17,
        { ...camera, x: camera.x + 100, y: camera.y + 20 }, anchor, [character]), anchor);
    }
  }
});

test('distant lightning is independently scheduled, bolt-free and faint', () => {
  const seed = 22;
  const storm = worldConditions(400, seed, 'storm');
  const rain = worldConditions(400, seed, 'rain');
  const far = [];
  const near = [];
  for (let i = 0; i < 2400; i++) {
    const time = i / 10;
    const distant = distantThunderAt(time, seed, storm);
    const bolt = lightningAt(time, seed, storm);
    if (distant?.flash) {
      far.push([time, distant]);
      assert.ok(distant.flash <= .44 && distant.flash > 0);
      assert.equal(distantThunderAt(time, seed, rain), null);
      assert.ok(distantThunderAt(time, seed, storm, true).flash <= distant.flash);
    }
    if (bolt?.bolt) near.push(time);
  }
  assert.ok(far.length > 20 && near.length > 0);
  assert.ok(far.some(([time]) => !lightningAt(time, seed, storm)?.bolt));
  assert.ok(near.some(time => !distantThunderAt(time, seed, storm)?.flash));
});

test('lightning stays close to visible characters in open sky', () => {
  const camera = { x: 0, y: 0, width: 8000, height: 400 };
  const characters = [{ x: 2200, y: 200 }, { x: 6500, y: 200 },
    { x: 4000, y: 900 }, { x: 9500, y: 200 }];
  const targets = new Set();
  for (let event = 0; event < 100; event++) {
    const anchor = lightningAnchor({ event }, 17, camera, null, characters);
    const target = characters.slice(0, 2).find(c =>
      Math.abs(anchor.worldX - c.x) <= LIGHTNING_NEAR_RADIUS);
    assert.ok(target, 'strike must be close to a visible character');
    targets.add(target.x);
  }
  assert.equal(targets.size, 2, 'both visible players can anchor strikes');
  assert.deepEqual(lightningAnchor({ event: 0 }, 17, camera, null, characters.slice(2)),
    lightningAnchor({ event: 0 }, 17, camera));
});

test('lightning uses the available side on narrow or edge-aligned views', () => {
  for (const camera of [{ x: 0, y: 0, width: 100, height: 400 },
    { x: 2000, y: 0, width: 300, height: 400 }]) {
    for (const x of [camera.x, camera.x + camera.width]) {
      for (let event = 0; event < 30; event++) {
        const anchor = lightningAnchor({ event }, 17, camera, null, [{ x, y: 200 }]);
        assert.ok(anchor.worldX >= camera.x && anchor.worldX <= camera.x + camera.width);
        assert.ok(Math.abs(anchor.worldX - x) <= LIGHTNING_NEAR_RADIUS);
      }
    }
  }
});

test('relocating a scheduled strike preserves its exact original size and never drops it', () => {
  for (const camera of [
    { x: 1400, y: 0, width: 640, height: 380 },
    { x: 1800, y: 12, width: 300, height: 480 },
    { x: 100, y: 190, width: 800, height: 380 },
    { x: 0, y: 0, width: 8000, height: 400 },
  ]) {
    for (let event = 0; event < 100; event++) {
      const strike = { event };
      const original = lightningAnchor(strike, 17, camera);
      for (const characters of [[], [{ x: camera.x + camera.width * .42, y: camera.y + 100 }]]) {
        const moved = lightningAnchor(strike, 17, camera, null, characters);
        assert.equal(moved.worldTop, original.worldTop);
        assert.equal(moved.worldBottom, original.worldBottom);
        assert.equal(moved.event, original.event);
      }
    }
  }
});

test('aurora sky layers pan at distinct fractions of camera movement', () => {
  for (const depth of [.18, .32, .48]) {
    const a = auroraWorldX(0, 1400, depth);
    const b = auroraWorldX(0, 1700, depth);
    assert.ok(Math.abs(b - a - 300 * depth) < 1e-9);
    assert.ok(Math.abs(auroraWorldX(250, 1400, depth) - auroraWorldX(250 - 300 * depth, 1700, depth)) < 1e-9);
  }
});
