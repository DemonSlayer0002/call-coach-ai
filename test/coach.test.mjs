import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../lib/coach.mjs';
const evaluateBody = body => evaluate({header:n => n === 'x-typesafe-key' ? 'synthetic-test-key' : undefined, ip:'test', readJson:async () => body});
test('malformed payloads fail before contacting the provider', async () => {
  for (const body of [null, [], 'text', 42]) assert.equal((await evaluateBody(body))[0], 400);
  assert.equal((await evaluateBody({turns:[{speaker:'unknown',text:'Hello'}]}))[0],400);
  assert.equal((await evaluateBody({mode:'missing',turns:[]}))[0],400);
  assert.equal((await evaluateBody({coach:{transcript:{key:'call',rep:'rep',other:'customer'},schema:{a:{type:'choice',instructions:'Select',criteria:[]}}}}))[0],400);
});
