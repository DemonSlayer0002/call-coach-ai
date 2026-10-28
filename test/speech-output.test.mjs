import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSpeaker} from '../public/speech-output.js';
test('bundled customer audio works when no browser voices are installed',async()=>{
 let used;
 class Audio {constructor(url){used=url;}play(){queueMicrotask(()=>this.onended());return Promise.resolve();}pause(){}removeAttribute(){}load(){}}
 const speak=createBrowserSpeaker({synth:{getVoices:()=>[]},Utterance:class{},AudioCtor:Audio,fallbackFor:()=>'/demo-audio/price-0.wav'});
 assert.equal(await speak('Question'),true);assert.equal(used,'/demo-audio/price-0.wav');
});
test('ending practice aborts customer playback and releases its audio source',async()=>{
 let paused=false,cleared=false;
 class Audio {play(){return Promise.resolve();}pause(){paused=true;}removeAttribute(){cleared=true;}load(){}}
 const speak=createBrowserSpeaker({synth:null,Utterance:null,AudioCtor:Audio,fallbackFor:()=>'/demo-audio/price-0.wav'});
 const controller=new AbortController();const speaking=speak('Question',controller.signal);controller.abort();
 assert.equal(await speaking,false);assert.equal(paused,true);assert.equal(cleared,true);
});
