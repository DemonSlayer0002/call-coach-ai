import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { replay, readSamples } from '../tools/replay-segmentation.mjs';
function tone(ms, level = .1) {
  return Float32Array.from({ length: 16000 * ms / 1000 }, (_, i) => level * Math.sin(i * 2 * Math.PI * 220 / 16000));
}
test('silence and a brief click do not produce a transcript segment', () => {
  for (const audio of [new Float32Array(32000), tone(30)]) assert.equal(replay(audio).filter(event => event.type === 'segment').length, 0);
});
test('worklet preserves synthetic phrase samples and reports actual endpoint wait', async () => {
  const samples = readSamples(await readFile(new URL('../public/demo-audio/price-0.wav', import.meta.url)));
  const messages = replay(samples); const segments = messages.filter(event => event.type === 'segment');
  assert.equal(segments.length, 1); assert.ok(segments[0].pcm.length > samples.length * .9);
  assert.equal(segments[0].endpoint_ms, 690); // 23 actual frames, rather than treating ASR time as the whole journey.
  assert.ok(messages.some(event => event.type === 'level' && event.level > .004));
});
test('an internal pause inside numbers is retained, long replies continue in order', () => {
  const audio = new Float32Array(16000 * 3); audio.set(tone(600)); audio.set(tone(600), 16000);
  assert.equal(replay(audio).filter(event => event.type === 'segment').length, 1);
  const long = replay(tone(26000)).filter(event => event.type === 'segment');
  assert.equal(long.length, 3); assert.ok(long.every((event, i) => !i || event.startFrame >= long[i - 1].endFrame));
});
test('short subthreshold speech remains a measured limitation, not a claimed accuracy fix', () => {
  // DSP-only tone probes characterize the 240 ms guard. Human short-word evaluation is still required.
  assert.equal(replay(tone(180)).filter(event => event.type === 'segment').length, 0);
  assert.equal(replay(tone(300)).filter(event => event.type === 'segment').length, 1);
});
