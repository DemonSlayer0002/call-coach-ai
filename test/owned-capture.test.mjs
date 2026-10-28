import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnedCapture} from '../public/owned-capture.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{resolve,promise};};
test('switching sources while worklet startup is pending stops the eventual capture',async()=>{
 const pending=deferred();let stopped=0;const callbacks=[];
 const capture=createOwnedCapture(async(_,handlers)=>{callbacks.push(handlers);return pending.promise;});
 const received=[];const start=capture.start([],{onText:t=>received.push(t)});
 await capture.stop();pending.resolve({stop:async()=>{stopped++;}});
 assert.equal(await start,null);callbacks[0].onText('stale');
 assert.equal(stopped,1);assert.deepEqual(received,[]);
});
test('late flushed words and ended callbacks cannot affect a later capture',async()=>{
 const callbacks=[];const capture=createOwnedCapture(async(_,handlers)=>{callbacks.push(handlers);return{stop:async()=>{}};});
 const received=[];
 await capture.start([],{onText:t=>received.push(t),onEnded:()=>received.push('old ended')});
 await capture.stop();
 await capture.start([],{onText:t=>received.push(t),onEnded:()=>received.push('new ended')});
 callbacks[0].onText('old words');callbacks[0].onEnded();callbacks[1].onText('current words');
 assert.deepEqual(received,['current words']);await capture.stop();
});
