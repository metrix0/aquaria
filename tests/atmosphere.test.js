import assert from 'node:assert/strict';
import test from 'node:test';
import { atmosphereTint, hasBackgroundWall, nightShadeAlpha } from '../src/world/atmosphere.js';
import { WEATHER_MODES, worldConditions } from '../src/environment.js';
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
