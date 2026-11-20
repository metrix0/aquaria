import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queueNewGame, consumeNewGame } from '../src/start-flow.js';

test('new game choice is normalized and consumed only once', () => {
  const saved = globalThis.sessionStorage;
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  try {
    assert.equal(queueNewGame({ hair: 2, skin: 3, shirt: 300 }), true);
    const choice = consumeNewGame();
    assert.equal(choice.hair, 2);
    assert.equal(choice.skin, 3);
    assert.equal(choice.shirt, 0);
    assert.equal(consumeNewGame(), null);
  } finally {
    globalThis.sessionStorage = saved;
  }
});
