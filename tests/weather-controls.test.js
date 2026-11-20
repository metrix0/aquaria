import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('weather selector is independent of God Mode and is never hidden', () => {
  const html = read('index.html');
  const ui = read('src/ui.js');
  const game = read('src/game.js');
  assert.match(html, /id="weather-control"[^>]*aria-label="Weather"/);
  assert.doesNotMatch(html, /id="weather-control"[^>]*hidden/);
  assert.doesNotMatch(ui, /weatherControl\.hidden/);
  assert.doesNotMatch(game, /adjustWeather\(step\) \{\s*if \(!game\.player\.flightOrigin\)/);
});

test('weather selection and flight speed cannot reflow the footer', () => {
  const html = read('index.html');
  const css = read('style.css');
  assert.match(html, /class="god-mode-anchor"/);
  assert.match(css, /\.god-mode-anchor \.flight-speed \{ position: absolute;/);
  assert.match(css, /\.weather-control \{ width: 190px; flex: 0 0 190px;/);
});
