import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequest } from '../public/latest-request.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };
test('a late response cannot replace newer speech even if fetch ignores abort', async () => {
  const first = deferred(), second = deferred(); let calls = 0;
  const busy = [];
  const request = createLatestRequest({fetchImpl:() => (++calls === 1 ? first.promise : second.promise),onBusy:b => busy.push(b)});
  const old = request.run({turns:['old']});
  const fresh = request.run({turns:['new']});
  first.resolve(Response.json({advice:'old'}));
  assert.equal(await old, null);
  assert.equal(busy.at(-1), true, 'old finally must not clear the new busy state');
  second.resolve(Response.json({advice:'new'}));
  assert.deepEqual(await fresh, {advice:'new'}); assert.equal(busy.at(-1), false);
});
test('reset invalidates both late successes and late errors', async () => {
  for (const response of [Response.json({advice:'old'}),Response.json({error:'old error'},{status:502})]) {
    const d = deferred(); const request = createLatestRequest({fetchImpl:() => d.promise});
    const result = request.run({}); request.invalidate(); d.resolve(response);
    assert.equal(await result, null);
  }
});
test('current provider errors reach the screen', async () => {
  const request = createLatestRequest({fetchImpl:async () => Response.json({error:'No credits'},{status:502})});
  await assert.rejects(request.run({}), /No credits/);
});
