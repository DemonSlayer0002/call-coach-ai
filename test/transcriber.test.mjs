import test from 'node:test';
import assert from 'node:assert/strict';
let serial=0;
async function setup(t){
 const previous={fetch:globalThis.fetch,Worker:globalThis.Worker};const workers=[];
 globalThis.fetch=async()=>({json:async()=>({transcribe:'browser'})});
 globalThis.Worker=class{
  constructor(){workers.push(this);this.messages=[];}
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  reply(message){this.onmessage({data:message});}
 };
 t.after(()=>{globalThis.fetch=previous.fetch;globalThis.Worker=previous.Worker;});
 const api=await import('../public/transcriber.js?unit='+serial++);
 return{api,workers};
}
test('speech warmup completes before recognition and uses the accuracy-first default',async t=>{
 const {api,workers}=await setup(t);const warming=api.prepareSpeech();await new Promise(r=>setTimeout(r,0));
 const worker=workers[0],load=worker.messages[0];assert.equal(load.type,'load');assert.equal(load.model,'onnx-community/whisper-base.en');
 worker.reply({id:load.id,text:''});await warming;
 const recognizing=api.transcribe(new Float32Array(160));await new Promise(r=>setTimeout(r,0));
 const request=worker.messages[1];worker.reply({id:request.id,text:'Yes, tomorrow at ten.'});
 assert.deepEqual(await recognizing,{text:'Yes, tomorrow at ten.'});
});
test('stopping warmup rejects its wait and ignores a late result',async t=>{
 const {api,workers}=await setup(t);const controller=new AbortController();const warming=api.prepareSpeech({signal:controller.signal});
 await new Promise(r=>setTimeout(r,0));controller.abort();await assert.rejects(warming,e=>e.name==='AbortError');
 const worker=workers[0];worker.reply({id:worker.messages[0].id,text:''});
});
test('worker failure releases all waits and a retry starts a fresh worker',async t=>{
 const {api,workers}=await setup(t);const first=api.prepareSpeech();await new Promise(r=>setTimeout(r,0));
 workers[0].onerror({message:'Worker failed'});await assert.rejects(first,/Worker failed/);assert.equal(workers[0].terminated,true);
 const retry=api.prepareSpeech();await new Promise(r=>setTimeout(r,0));assert.equal(workers.length,2);
 workers[1].reply({id:workers[1].messages[0].id,text:''});await retry;
});
