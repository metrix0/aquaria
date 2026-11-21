import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('ring is on the left and off-hand on the right, without shifting the centered six-slot hotbar', () => {
  assert.match(html, /<div class="hotbar-row">\s*<div class="hotbar-abilities hotbar-abilities--ring"/);
  assert.match(html, /id="cast-ring"[\s\S]*?<div id="hotbar-slots" class="slots"><\/div>\s*<div class="hotbar-abilities hotbar-abilities--offhand"/);
  assert.match(html, /id="use-hook"[^>]*hidden/);
  assert.match(html, /id="cast-ring"[^>]*hidden/);
  assert.match(css, /\.hotbar-row\s*\{[^}]*position:\s*relative;[^}]*width:\s*max-content;/);
  assert.match(css, /\.hotbar-abilities--ring\s*\{[^}]*right:\s*calc\(100%\s*\+\s*7px\)/);
  assert.match(css, /\.hotbar-abilities--offhand\s*\{[^}]*left:\s*calc\(100%\s*\+\s*7px\)/);
});

test('narrow layouts keep the centered six-slot strip independent of the two abilities', () => {
  assert.match(css, /@media\s*\(max-width:\s*670px\)[\s\S]*?\.inventory\s*\{[^}]*--hotbar-slot-width:\s*clamp\(25px,\s*8vw,\s*44px\)/);
  assert.match(css, /\.inventory \.hotbar-abilities \.slot\s*\{[^}]*width:\s*clamp\(29px,\s*8\.8vw,\s*44px\)/);
});
