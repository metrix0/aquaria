import assert from 'node:assert/strict';
import test from 'node:test';
import { atmosphereTint, hasBackgroundWall } from '../src/world/atmosphere.js';
import { WEST_EXTENSION, groundAt } from '../src/world/generation.js';

test('the full-screen grade is independent of background walls', () => {
  const tx = WEST_EXTENSION + 56;
  assert.equal(hasBackgroundWall(tx, groundAt(tx) + 3), true);
  for (const [mode, conditions] of Object.entries({
    night: { darkness: 1, rain: 0, atmosphere: 'moonlit' },
    dawn: { darkness: .2, rain: 0, atmosphere: 'rose' },
    storm: { darkness: 1, rain: 1, atmosphere: 'deep' },
  })) assert.ok(atmosphereTint(conditions).alpha > 0, mode);
});

test('overlay blends with reduced opacity across day, night and storm', () => {
  const clear = atmosphereTint({ atmosphere: 'clear', darkness: 0, rain: 0 });
  const sunny = atmosphereTint({ atmosphere: 'sunny', darkness: 0, rain: 0 });
  const cloudy = atmosphereTint({ atmosphere: 'cloudy', darkness: 0, rain: 0 });
  const pink = atmosphereTint({ atmosphere: 'rose', darkness: 0, rain: 0 }, 0, 0);
  const amber = atmosphereTint({ atmosphere: 'rose', darkness: 0, rain: 0 }, 0, 15);
  const night = atmosphereTint({ atmosphere: 'moonlit', darkness: 1, rain: 0 });
  const storm = atmosphereTint({ atmosphere: 'deep', darkness: 1, rain: 1 });
  assert.ok(sunny.alpha > clear.alpha && clear.alpha > cloudy.alpha);
  assert.ok(pink.alpha > .15 && pink.alpha < .30);
  assert.notDeepEqual([pink.g, pink.b], [amber.g, amber.b]);
  assert.ok(night.alpha > pink.alpha && night.alpha < .40);
  assert.ok(storm.alpha > night.alpha && storm.alpha <= .45);
  assert.ok(night.b > night.r);
});

test('swamp grading remains part of the full-scene overlay', () => {
  const state = { darkness: .2, rain: .25, atmosphere: 'clear' };
  const dry = atmosphereTint(state, 0);
  const swamp = atmosphereTint(state, 1);
  assert.ok(swamp.alpha > dry.alpha);
  assert.ok(swamp.g > dry.g || swamp.b < dry.b);
});
