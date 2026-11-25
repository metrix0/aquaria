import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformanceStats } from '../src/performance-stats.js';

test('performance stats publish frame intervals and CPU costs twice per second', () => {
  const fields = Object.fromEntries(['fps', 'frame', 'p95', 'update', 'draw'].map(key => [key, { dataset: { perf: key }, textContent: '--' }]));
  const stats = createPerformanceStats({ querySelectorAll: () => Object.values(fields) });
  stats.sample(0, 3, 4);
  for (let i = 1; i < 25; i++) stats.sample(i * 20, 3, 4);
  assert.equal(fields.fps.textContent, '--');
  stats.sample(500, 3, 4);
  assert.deepEqual(Object.values(fields).map(field => field.textContent), ['50', '20.0', '20.0', '3.0', '4.0']);
  stats.reset();
  stats.sample(10000, 3, 4);
  assert.equal(fields.fps.textContent, '--');
});

test('performance stats report slow frame intervals in p95', () => {
  const fields = ['fps', 'frame', 'p95', 'update', 'draw'].map(key => ({ dataset: { perf: key }, textContent: '--' }));
  const stats = createPerformanceStats({ querySelectorAll: () => fields });
  stats.sample(0, 0, 0);
  for (let i = 1; i <= 20; i++) stats.sample(i * 20, 1, 2);
  stats.sample(450, 1, 2);
  stats.sample(500, 1, 2);
  assert.equal(fields[2].textContent, '50.0');
});
