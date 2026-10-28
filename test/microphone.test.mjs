import test from 'node:test';
import assert from 'node:assert/strict';
import { createMicrophoneSelection } from '../public/microphone.js';
test('device removal stops an active selected input; labels stay in page memory', async t => {
  const previous = globalThis.Option;
  globalThis.Option = class { constructor(label, value) { this.label = label; this.value = value; } };
  t.after(() => { globalThis.Option = previous; });
  let inputs = [{ kind: 'audioinput', deviceId: 'private-id', label: 'Private headset' }], stopped = 0, changed, active = false;
  const media = { enumerateDevices: async () => inputs, addEventListener() {} };
  const select = { value: '', addEventListener: (_event, callback) => { changed = callback; }, replaceChildren(...options) { this.options = options; } };
  const selection = createMicrophoneSelection({ media, select, isActive: () => active, onDisconnected: async () => { stopped++; } });
  await selection.refresh();select.value = 'private-id';changed();assert.equal(selection.selected(), 'private-id');active = true;
  inputs = [];await selection.refresh();assert.equal(stopped, 1);assert.equal(selection.selected(), '');assert.equal(select.value, '');
});
