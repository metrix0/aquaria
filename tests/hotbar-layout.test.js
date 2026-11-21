import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('equipped abilities do not enter the centered six-slot hotbar layout', () => {
  assert.match(html, /<div class="hotbar-row">\s*<div id="hotbar-slots" class="slots"><\/div>\s*<div class="hotbar-abilities"/);
  assert.match(css, /\.hotbar-row\s*\{[^}]*position:\s*relative;[^}]*width:\s*max-content;/);
  assert.match(css, /\.hotbar-abilities\s*\{[^}]*position:\s*absolute;[^}]*left:\s*calc\(100%\s*\+\s*7px\)/);
  for (const id of ['cast-ring', 'use-hook']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*hidden'));
  }
});

test('narrow layouts keep the centered six-slot strip independent of abilities', () => {
  assert.match(css, /@media\s*\(max-width:\s*670px\)[\s\S]*?\.inventory\s*\{[^}]*--hotbar-slot-width:\s*clamp\(25px,\s*8vw,\s*44px\)/);
  assert.match(css, /\.inventory \.hotbar-abilities \.slot\s*\{[^}]*width:\s*clamp\(29px,\s*8\.8vw,\s*44px\)/);
});
