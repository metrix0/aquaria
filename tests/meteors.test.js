import assert from 'node:assert/strict';
import test from 'node:test';
import { meteorAt, visibleMeteors } from '../src/world/meteors.js';

test('meteors travel in a straight line matching their trail, with invisible lifecycle resets', () => {
  let resets = 0;
  for (let lane = -10; lane <= 10; lane++) {
    let prev = meteorAt(lane, 0);
    for (let t = .01; t < 30; t += .01) {
      const next = meteorAt(lane, t);
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      if (dx < 0 || Math.abs(dx) > .61 || dy < 0) {
        assert.ok(prev.alpha < .002 && next.alpha < .002, 'reset must be invisible');
        resets++;
      } else {
        assert.ok(dx >= .279 && dx <= .601);
        assert.ok(Math.abs(dy / dx - .36) < 1e-8);
        assert.ok(Math.abs((next.y - next.tailY) / (next.x - next.tailX) - dy / dx) < 1e-8);
      }
      assert.ok(next.alpha >= 0 && next.alpha <= 1);
      assert.ok(Math.abs(next.alpha - prev.alpha) < .04);
      prev = next;
    }
  }
  assert.ok(resets > 100);
});

test('panning and resizing project the same meteor positions, including their tails', () => {
  const camera = { x: 10000, y: 0, width: 650 };
  const original = visibleMeteors(camera, 8);
  const resized = visibleMeteors({ ...camera, width: 900 }, 8);
  assert.ok(original.length >= 2);
  for (const m of original) assert.ok(resized.some(n => n.x === m.x && n.y === m.y && n.alpha === m.alpha));
  const shifted = visibleMeteors({ ...camera, x: camera.x + 20, y: 10 }, 8);
  for (const m of original.filter(m => m.x > 10 && m.tailX < 630)) {
    assert.ok(shifted.some(n => Math.abs(n.x - m.x + 2.4) < 1e-8 && n.y === m.y - 10 && n.alpha === m.alpha));
  }
});

test('meteor sizes, tail lengths and brightness vary between streaks but stay stable during flight', () => {
  const sizes = new Set();
  const lengths = new Set();
  const brightnesses = new Set();
  for (let lane = -20; lane <= 20; lane++) {
    const m = meteorAt(lane, 8);
    sizes.add(m.size);
    lengths.add(m.x - m.tailX);
    brightnesses.add(m.brightness);
    assert.ok(m.size >= 1.2 && m.size <= 4.5);
    assert.ok(m.x - m.tailX >= 20 && m.x - m.tailX <= 72);
    const next = meteorAt(lane, 8.01);
    if (m.alpha > .001 && next.alpha > .001) {
      assert.equal(next.size, m.size);
      assert.equal(next.brightness, m.brightness);
      assert.ok(Math.abs((next.x - next.tailX) - (m.x - m.tailX)) < 1e-8);
    }
  }
  assert.ok(sizes.size > 30 && lengths.size > 30 && brightnesses.size > 30);
});

test('meteor opacity fades gently over many frames', () => {
  for (let lane = 0; lane < 20; lane++) {
    let previous = meteorAt(lane, 0);
    let transitions = 0;
    for (let t = .05; t < 20; t += .05) {
      const next = meteorAt(lane, t);
      assert.ok(Math.abs(next.alpha - previous.alpha) < .075);
      if (next.alpha > .05 && next.alpha < .95) transitions++;
      previous = next;
    }
    assert.ok(transitions > 130);
  }
});
