import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveCallFollower} from '../public/live-call.js';
test('switching calls discards a late snapshot from the previous call',async()=>{
 let resolveOld;const old=new Promise(resolve=>{resolveOld=resolve;});const seen=[];
 const follower=createLiveCallFollower({fetchImpl:url=>url.endsWith('old')?old:Promise.resolve(Response.json({revision:1,ended:true,session_id:'new'})),onUpdate:s=>seen.push(s.session_id)});
 follower.start('old');follower.start('new');
 await new Promise(r=>setTimeout(r,0));
 resolveOld(Response.json({revision:1,ended:true,session_id:'old'}));
 await new Promise(r=>setTimeout(r,0));follower.stop();
 assert.deepEqual(seen,['new']);
});
