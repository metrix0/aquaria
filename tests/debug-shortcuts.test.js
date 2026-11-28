import test from 'node:test';
import assert from 'node:assert/strict';
import { bindInput } from '../src/input.js';

test('God Mode and zoom shortcuts use Shift without toggling flight or repeating', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const handlers = new Map();
  const node = { addEventListener() {} };
  globalThis.window = { addEventListener: (type, fn) => handlers.set(type, fn) };
  globalThis.document = { querySelectorAll: () => [], getElementById: () => node };
  try {
    const calls = [];
    let panel = null;
    bindInput(node, {}, {
      blocked: () => panel,
      toggleGodMode: () => calls.push('toggle'),
      cycleFlightSpeed: () => calls.push('speed'),
      zoomBy: delta => calls.push(delta),
    });
    const key = (code, options = {}) => handlers.get('keydown')({ code, preventDefault() {}, ...options });
    key('KeyG');
    key('KeyG', { shiftKey: true });
    key('KeyZ');
    key('KeyZ', { shiftKey: true });
    key('KeyG', { shiftKey: true, repeat: true });
    key('KeyZ', { repeat: true });
    key('KeyZ', { ctrlKey: true });
    panel = 'backpack-panel';
    key('KeyZ');
    key('KeyG', { shiftKey: true });
    assert.deepEqual(calls, ['toggle', 'speed', -1, 1]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
