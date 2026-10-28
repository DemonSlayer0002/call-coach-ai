import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoicePractice} from '../public/voice-practice.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{resolve,promise};};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(overrides={}){
 const track={enabled:true,stopped:false,stop(){this.stopped=true;}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const turns=[],states=[],errors=[];let callbacks;
 const voice=createVoicePractice({getMic:async()=>stream,prepareSpeech:async()=>{},speak:async()=>true,
  startSession:async(_sources,handlers)=>{callbacks=handlers;return{stop:async()=>{track.stop();}};},
  onTurn:async turn=>turns.push(turn),onState:state=>states.push(state),onError:error=>errors.push(error),...overrides});
 return{voice,track,stream,turns,states,errors,callbacks:()=>callbacks};
}
test('voice practice speaks the customer with mic muted, then accepts the rep and tracks progress',async()=>{
 const spoken=deferred();const f=fixture({speak:()=>spoken.promise});
 const starting=f.voice.start(['Is this available?','What is the total?']);await flush();
 assert.equal(f.turns[0].speaker,'customer');assert.equal(f.track.enabled,false);
 assert.equal(f.states.at(-1).phase,'customer');
 spoken.resolve(true);await starting;assert.equal(f.track.enabled,true);assert.equal(f.states.at(-1).phase,'listening');
 await f.callbacks().onText('rep','Yes, I have checked the exact vehicle.');
 assert.equal(f.turns[1].speaker,'rep');assert.equal(f.states.at(-1).canAdvance,true);
 await f.voice.next();assert.equal(f.turns[2].text,'What is the total?');assert.equal(f.states.at(-1).canAdvance,false);
 await f.voice.stop();assert.equal(f.track.stopped,true);
});
test('cannot advance before an answer or while the user is speaking',async()=>{
 const f=fixture();await f.voice.start(['First?','Second?']);await f.voice.next();assert.equal(f.turns.length,1);
 await f.callbacks().onText('rep','My answer');f.callbacks().onVoice('rep',true);
 await f.voice.next();assert.equal(f.turns.length,2);assert.equal(f.states.at(-1).canAdvance,false);
 f.callbacks().onVoice('rep',false);await f.voice.next();assert.equal(f.turns.length,2);
 await f.callbacks().onText('rep','Added answer');await f.voice.next();assert.equal(f.turns[3].text,'Second?');await f.voice.stop();
});
test('cancel during microphone permission closes a late stream and never starts capture',async()=>{
 const mic=deferred();let starts=0;const f=fixture({getMic:()=>mic.promise,startSession:async()=>{starts++;}});
 const starting=f.voice.start(['Hello?']);await flush();await f.voice.stop();mic.resolve(f.stream);await starting;
 assert.equal(f.track.stopped,true);assert.equal(starts,0);assert.deepEqual(f.turns,[]);
});
test('stale speech and callbacks cannot update a replacement practice',async()=>{
 const f=fixture();await f.voice.start(['Old?']);const old=f.callbacks();await f.voice.stop();
 await f.voice.start(['New?']);await old.onText('rep','Stale words');old.onEnded();
 assert.equal(f.voice.isActive(),true);assert.deepEqual(f.turns.map(t=>t.text),['Old?','New?']);await f.voice.stop();
});
test('missing browser voice is explicit and still allows microphone response',async()=>{
 const f=fixture({speak:async()=>false});await f.voice.start(['Read me']);
 assert.equal(f.states.at(-1).spoken,false);assert.equal(f.track.enabled,true);await f.voice.stop();
});
test('microphone or model setup failure closes acquired audio',async()=>{
 const f=fixture({prepareSpeech:async()=>{throw new Error('Model unavailable');}});await f.voice.start(['Question']);
 assert.equal(f.track.stopped,true);assert.equal(f.voice.isActive(),false);assert.deepEqual(f.errors,['Model unavailable']);
});

test('late text from an earlier utterance cannot mark new pending speech ready',async()=>{
 const first=deferred();let repTurns=0;
 const f=fixture({onTurn:async turn=>{if(turn.speaker==='rep'&&++repTurns===1)await first.promise;}});
 await f.voice.start(['First?','Second?']);
 f.callbacks().onVoice('rep',true);f.callbacks().onSegment('rep',1);f.callbacks().onVoice('rep',false);
 const pending=f.callbacks().onText('rep','First part',{sequence:1});
 f.callbacks().onVoice('rep',true);f.callbacks().onSegment('rep',2);f.callbacks().onVoice('rep',false);
 first.resolve();await pending;
 assert.equal(f.states.at(-1).canAdvance,false);
 await f.voice.next();assert.equal(f.states.at(-1).index,0);
 await f.callbacks().onText('rep','The added part',{sequence:2});
 assert.equal(f.states.at(-1).canAdvance,true);
 await f.voice.next();assert.equal(f.states.at(-1).index,1);await f.voice.stop();
});
test('unclear speech keeps the question open and permits another reply',async()=>{
 const f=fixture();await f.voice.start(['Question?']);
 f.callbacks().onVoice('rep',true);f.callbacks().onVoice('rep',false);f.callbacks().onDrop('rep','noise');
 assert.equal(f.states.at(-1).phase,'unclear');assert.equal(f.states.at(-1).canAdvance,false);
 await f.callbacks().onText('rep','A clear answer');assert.equal(f.states.at(-1).canAdvance,true);await f.voice.stop();
});
test('permission denial gives a specific recovery and stopping during speech setup closes the mic',async()=>{
 const denied=fixture({getMic:async()=>{throw Object.assign(new Error('native private'),{name:'NotAllowedError'});}});
 await denied.voice.start(['Question?']);assert.match(denied.errors[0],/site permissions/);assert.doesNotMatch(denied.errors[0],/native private/);
 const pending=deferred();let starts=0;
 const f=fixture({prepareSpeech:()=>pending.promise,startSession:async()=>{starts++;}});
 const starting=f.voice.start(['Question?']);await flush();await f.voice.stop();assert.equal(f.track.stopped,true);
 pending.resolve({backend:'gpu'});await starting;assert.equal(starts,0);assert.equal(f.voice.isActive(),false);
});
