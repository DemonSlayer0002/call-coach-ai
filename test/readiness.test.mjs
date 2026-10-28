import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSpeechReadiness, wavToFloat } from '../lib/speech-readiness.mjs';
import { createDiagnostics, microphoneError } from '../public/diagnostics.js';
const fixture = () => readFile(new URL('../public/demo-audio/price-0.wav', import.meta.url));
test('warmup exercises real synthetic speech, deduplicates concurrent requests and expires', async () => {
  let time = 100, calls = 0;
  const client = { status: async () => ({ ready: true, backend: 'gpu', model: 'turbo' }), transcribe: async pcm => {
    calls++; assert.ok(pcm.length > 16000); assert.ok(pcm.some(value => value !== 0));
    return { text: 'A real phrase', speech_backend: 'gpu', speech_model: 'turbo', latency_ms: 12 };
  } };
  const readiness = createSpeechReadiness({ client, loadFixture: fixture, now: () => time });
  const [first, second] = await Promise.all([readiness.prepare(), readiness.prepare()]);
  assert.equal(calls, 1); assert.equal(first.warmed, true); assert.deepEqual(first, second);
  assert.equal((await readiness.prepare()).cached, true); assert.equal(calls, 1);
  time += 60001; await readiness.prepare(); assert.equal(calls, 2);
  client.status = async () => ({ ready: true, backend: 'local', model: 'turbo' });
  await readiness.prepare(); assert.equal(calls, 3);
});
test('busy service is distinct from warm proof; empty warmup never marks ready', async () => {
  let calls = 0;
  const client = { status: async () => ({ ready: true, busy: true, backend: 'gpu' }), transcribe: async () => { calls++; return { text: '' }; } };
  const readiness = createSpeechReadiness({ client, loadFixture: fixture });
  assert.equal((await readiness.prepare()).warmed, false); assert.equal(calls, 0);
  client.status = async () => ({ ready: true, backend: 'gpu' });
  await assert.rejects(readiness.prepare(), /without recognizing/);
  await assert.rejects(readiness.prepare(), /without recognizing/); assert.equal(calls, 2);
});
test('malformed fixture cannot reach recognition', async () => {
  assert.throws(() => wavToFloat(Buffer.from('not audio')), /Invalid/);
  const wav = Buffer.from(await fixture()); wav.writeUInt32LE(48000, 24);
  assert.throws(() => wavToFloat(wav), /16 kHz/);
});
test('diagnostics contain only allowlisted metadata and use bounded monotonic history', () => {
  let clock = 50;
  const diagnostics = createDiagnostics({ clock: () => clock, id: () => 'test-session' });
  clock += 25;
  diagnostics.record('asr_end', { sequence: 2, backend: 'gpu', duration_ms: 20, text: 'PRIVATE', key: 'SECRET', device: 'NAME' });
  diagnostics.record('transcript', { text: 'PRIVATE' }); diagnostics.state('feedback');
  const snapshot = diagnostics.snapshot();
  assert.deepEqual(snapshot.events, [{ stage: 'asr_end', at_ms: 25, sequence: 2, duration_ms: 20, backend: 'gpu' }]);
  snapshot.events[0].backend = 'tampered'; assert.equal(diagnostics.snapshot().events[0].backend, 'gpu');
  for (let i = 0; i < 310; i++) diagnostics.record('segment', { sequence: i });
  assert.equal(diagnostics.snapshot().events.length, 300);
  diagnostics.reset(); assert.equal(diagnostics.snapshot().phase, 'idle'); assert.equal(diagnostics.snapshot().events.length, 0);
  assert.equal(microphoneError({ name: 'NotAllowedError', message: 'private' }).code, 'permission_denied');
  assert.equal(microphoneError({ name: 'NotFoundError' }).code, 'device_missing');
  assert.equal(microphoneError({ name: 'NotReadableError' }).code, 'device_busy');
});
