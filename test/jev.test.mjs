import test from 'node:test';
import assert from 'node:assert/strict';
import { createJevClient, validateAnswers } from '../lib/jev.mjs';

const mode = { transcript: { key: 'call' }, schema: {
  action: { type: 'choice', criteria: { ask: 'Ask', wait: 'Wait' } },
  stage: { type: 'score', criteria: ['Early', 'Ready'] },
  objection: { type: 'noul' },
} };
const valid = () => ({ model: 'test', answers: {
  action: { type: 'choice', choice: 'ask', confidence: 0.6, probabilities: { ask: 0.8, wait: 0.2 } },
  stage: { type: 'score', score: 0.3, confidence: 0.4, probabilities: { 0: 0.7, 1: 0.3 } },
  objection: { type: 'noul', noul: 0.1 },
} });
const client = (fetchImpl, options = {}) => createJevClient({ endpoint: 'https://example.invalid', model: 'test', fetchImpl, ...options });
const ask = (c, signal) => c([{speaker:'customer',text:'Synthetic'}], mode, 'test-key', signal);

test('accepts typed responses; rejects missing, nonfinite, wrong-type and unknown-option answers', () => {
  assert.equal(validateAnswers(valid(), mode.schema).model, 'test');
  const mutations = [
    d => delete d.answers.objection,
    d => d.answers.objection.noul = NaN,
    d => d.answers.stage.score = 2,
    d => d.answers.action.choice = 'invented',
    d => d.answers.action.probabilities.ask = -1,
    d => d.answers.action.probabilities = { ask: 0.8 },
    d => d.answers.action.confidence = 2,
    d => d.answers.stage.type = 'choice',
    d => d.answers.action.probabilities = { ask: 0.1, wait: 0.1 },
  ];
  for (const mutate of mutations) { const d = valid(); mutate(d); assert.throws(() => validateAnswers(d, mode.schema)); }
});
test('retries transient errors and reports attempts', async () => {
  let calls = 0;
  const c = client(async () => ++calls === 1 ? new Response('', {status:529,headers:{'retry-after':'0'}}) : Response.json(valid()));
  assert.equal((await ask(c)).attempts, 2);
});
test('does not wait or retry before a long Retry-After expires', async () => {
  let calls = 0;
  const c = client(async () => { calls++; return new Response('', {status:429,headers:{'retry-after':'120'}}); });
  assert.equal((await ask(c)).status, 429);
  assert.equal(calls, 1);
});
test('authentication errors do not retry or leak upstream content', async () => {
  let calls = 0;
  const c = client(async () => { calls++; return new Response('sensitive provider error', {status:401}); });
  const r = await ask(c);
  assert.equal(r.status, 401); assert.deepEqual(r.data, {}); assert.equal(calls, 1);
});
test('network failures are sanitized', async () => {
  await assert.rejects(ask(client(async () => { throw new Error('test-key private'); })), e => e.status === 502 && !e.message.includes('test-key'));
});
test('deadline covers the response body as well as headers', async () => {
  const c = client(async (_, {signal}) => ({ status:200, json:() => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true})) }), {timeoutMs:25});
  const keepAlive = setInterval(() => {}, 100);
  try { await assert.rejects(ask(c), e => e.status === 504); } finally { clearInterval(keepAlive); }
});
test('cancellation stops upstream work', async () => {
  const controller = new AbortController(); controller.abort();
  let called = false;
  await assert.rejects(ask(client(async () => { called = true; }), controller.signal), e => e.status === 499);
  assert.equal(called, false);
});
test('successful HTTP status with invalid JSON fails closed', async () => {
  await assert.rejects(ask(client(async () => new Response('not-json'))), e => e.status === 502);
});
