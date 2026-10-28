import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveTranscriptStore,authorizeLiveIngest} from '../lib/live-transcript.mjs';
const start={kind:'session_start',session_id:'session-a',call_id:'call-a',staff_account:'synthetic-staff',customer_endpoint:'telnyx',at:1000};
const segment=(speaker='customer',seq=1,text='Is this SUV available?')=>({kind:'segment',session_id:'session-a',call_id:'call-a',speaker,seq,final:true,text,audio_ms:1000,confidence:.9,at:1001});
const ingest=(store,...events)=>store.ingest({events});
test('ingest requires the separate producer token and exact protocol intent',()=>{
 const h=n=>({'authorization':'Bearer synthetic','x-amd-intent':'live-stt-ingest-v1'})[n];
 assert.doesNotThrow(()=>authorizeLiveIngest(h,'synthetic'));
 assert.throws(()=>authorizeLiveIngest(h,''),e=>e.status===503);
 assert.throws(()=>authorizeLiveIngest(h,'other'),e=>e.status===401);
 assert.throws(()=>authorizeLiveIngest(()=>undefined,'synthetic'),e=>e.status===401);
});
test('interims never become turns; duplicate finals do not repeat advice',()=>{
 const store=createLiveTranscriptStore();ingest(store,start);
 ingest(store,{...segment(),final:false,confidence:0});assert.equal(store.get('session-a').segments.length,0);
 ingest(store,segment(),segment());assert.equal(store.get('session-a').segments.length,1);
 assert.equal(store.get('session-a').revision,1);
 ingest(store,{...segment(),final:false,text:'late interim'});assert.equal(store.get('session-a').revision,1);
});
test('binds both roles to exact call and session, and refuses unknown roles',()=>{
 const store=createLiveTranscriptStore();ingest(store,start,segment(),segment('staff',1,'I will check the current inventory.'));
 assert.deepEqual(store.get('session-a').segments.map(s=>s.speaker),['customer','staff']);
 assert.throws(()=>ingest(store,{...start,call_id:'different'}),e=>e.status===409);
 assert.throws(()=>ingest(store,{...segment(),call_id:'different'}),e=>e.status===409);
 assert.throws(()=>ingest(store,segment('unknown',2)),e=>e.status===400);
 assert.throws(()=>ingest(store,segment('customer',1,'conflicting final')),e=>e.status===409);
});
test('a rejected event batch cannot partially create or modify a session',()=>{
 const store=createLiveTranscriptStore();
 assert.throws(()=>ingest(store,start,segment('unknown')));assert.equal(store.list().length,0);
 ingest(store,start);
 assert.throws(()=>ingest(store,segment(),segment('unknown',2)));assert.equal(store.get('session-a').revision,0);
});
test('sequence gaps and producer end flags remain visible as incomplete coverage',()=>{
 const store=createLiveTranscriptStore();ingest(store,start,segment('customer',3));
 assert.equal(store.get('session-a').sequence_gaps,2);assert.equal(store.get('session-a').incomplete,true);
 ingest(store,{kind:'session_end',session_id:'session-a',call_id:'call-a',incomplete:true,at:1002});
 assert.equal(store.get('session-a').ended,true);
 assert.throws(()=>ingest(store,segment('customer',4)),e=>e.status===409);
});
test('session memory is bounded and expires, without retaining customer endpoint in views',()=>{
 let clock=0;const store=createLiveTranscriptStore({now:()=>clock,maxSessions:1,maxSegments:1,ttlMs:100});
 ingest(store,start,segment(),segment('customer',2,'What is the total price?'));
 const session=store.get('session-a');assert.equal(session.segments.length,1);assert.equal(session.truncated,true);
 assert.equal(session.customer_endpoint,undefined);assert.equal(session.binding,undefined);
 assert.throws(()=>ingest(store,{...start,session_id:'session-b'}),e=>e.status===429);
 clock=101;assert.equal(store.get('session-a'),null);
});
test('redacts contacts before storing and rejects clear transcription loops',()=>{
 const store=createLiveTranscriptStore();ingest(store,start,segment('customer',1,'Email sam@example.test about the SUV.'));
 assert.equal(store.get('session-a').segments[0].text,'Email [email] about the SUV.');
 assert.throws(()=>ingest(store,segment('customer',2,'thank you '.repeat(15))),e=>e.status===422);
});
