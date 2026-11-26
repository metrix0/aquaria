import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('equipment is left of the centered hotbar and the two class slots are on the right', () => {
  assert.match(html, /hotbar-abilities--equipment[\s\S]*?id="cast-ring"[\s\S]*?id="use-hook"[\s\S]*?id="hotbar-slots"[\s\S]*?hotbar-abilities--skills/);
  assert.match(html, /id="use-hook"[^>]*hidden/);
  assert.match(html, /id="cast-ring"[^>]*hidden/);
  assert.match(html, /data-skill-slot="0" aria-keyshortcuts="Q" hidden/);
  assert.match(html, /data-skill-slot="1" aria-keyshortcuts="R" hidden/);
  assert.equal((html.match(/data-skill-slot=/g) ?? []).length, 2);
  assert.match(css, /\.hotbar-row\s*\{[^}]*position:\s*relative;[^}]*width:\s*max-content;/);
  assert.match(css, /\.hotbar-abilities--equipment\s*\{[^}]*right:\s*calc\(100%\s*\+\s*7px\)/);
  assert.match(css, /\.hotbar-abilities--skills\s*\{[^}]*left:\s*calc\(100%\s*\+\s*7px\)/);
});
test('narrow layouts give all ten slots the responsive hotbar width', () => {
  assert.match(css, /--hotbar-slot-width:\s*clamp\(20px,\s*8vw,\s*44px\)/);
  assert.match(css, /\.inventory \.hotbar-abilities \.slot\s*\{[^}]*width:\s*var\(--hotbar-slot-width\)/);
});
