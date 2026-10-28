import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pcmFloatToWav,createLocalSpeechClient} from '../lib/local-speech.mjs';

test('converts browser float PCM to correctly signed 16 kHz mono WAV',()=>{
 const pcm=Buffer.alloc(20);[-1,-.5,0,.5,1].forEach((v,i)=>pcm.writeFloatLE(v,i*4));
 const wav=pcmFloatToWav(pcm);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt16LE(22),1);
 assert.deepEqual(Array.from({length:5},(_,i)=>wav.readInt16LE(44+i*2)),[-32768,-16384,0,16384,32767]);
 const bad=Buffer.alloc(4);bad.writeFloatLE(NaN);assert.throws(()=>pcmFloatToWav(bad),e=>e.status===400);
 assert.throws(()=>pcmFloatToWav(Buffer.alloc(3)),e=>e.status===400);
});
test('local speech configuration cannot send audio to a public provider',()=>{
 for(const url of ['https://127.0.0.1:8910','http://external.example','http://user:secret@localhost'])assert.throws(()=>createLocalSpeechClient({url}));
});
test('uses the existing multipart API and validates its transcript',async()=>{
 let form;
 const client=createLocalSpeechClient({fetchImpl:async(_url,options)=>{form=options.body;return Response.json({text:' Hello, tomorrow at ten. '});}});
 const result=await client.transcribe(Buffer.alloc(1600));assert.equal(result.text,'Hello, tomorrow at ten.');
 assert.equal(form.get('response_format'),'json');assert.equal(form.get('file').type,'audio/wav');assert.equal(form.get('file').name,'capture.wav');
 const broken=createLocalSpeechClient({fetchImpl:async()=>Response.json({error:'invalid'})});
 await assert.rejects(broken.transcribe(Buffer.alloc(1600)),e=>e.status===502);
});
test('VoiceClaude mode works through the same PCM route used by the browser',async t=>{
 let receivedWav=false;
 const provider=http.createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/health'){res.end(JSON.stringify({status:'ok'}));return;}
  const chunks=[];for await(const c of req)chunks.push(c);
  receivedWav=Buffer.concat(chunks).includes(Buffer.from('RIFF'));
  res.end(JSON.stringify({text:'Yes, the Camry is available.'}));
 });provider.listen(0,'127.0.0.1');await once(provider,'listening');t.after(()=>new Promise(resolve=>provider.close(resolve)));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOSTED:'0',VERCEL:'0',BIND_HOST:'127.0.0.1',TRANSCRIBE:'voiceclaude',VOICECLAUDE_URL:'http://127.0.0.1:'+provider.address().port},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
 const base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Server startup timed out')),5000);child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/running at http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'));});});
 const ready=await fetch(base+'/api/speech/health');assert.equal(ready.status,200);assert.equal((await ready.json()).ready,true);
 const response=await fetch(base+'/api/transcribe',{method:'POST',headers:{'content-type':'application/octet-stream'},body:Buffer.alloc(1600)});
 assert.equal(response.status,200);assert.equal((await response.json()).text,'Yes, the Camry is available.');assert.equal(receivedWav,true);
});
test('GPU-first mode sends raw int16 and returns without contacting local fallback',async()=>{
 const paths=[];
 const client=createLocalSpeechClient({gpuUrl:'http://127.0.0.1:47212',fetchImpl:async(url,options)=>{
  paths.push(new URL(url).pathname);assert.equal(options.body.length,800);assert.equal(options.headers['Content-Type'],'application/octet-stream');
  return Response.json({text:' GPU transcript ',model:'large-v3-turbo',transcribe_ms:280});
 }});
 const result=await client.transcribe(Buffer.alloc(1600));assert.equal(result.speech_backend,'gpu');assert.equal(result.text,'GPU transcript');assert.deepEqual(paths,['/transcribe']);
});
test('a busy GPU falls back immediately and respects its cooldown',async()=>{
 let clock=1000,gpuCalls=0,localCalls=0;
 const client=createLocalSpeechClient({gpuUrl:'http://127.0.0.1:47212',now:()=>clock,fetchImpl:async(url)=>{
  if(new URL(url).port==='47212'){gpuCalls++;return Response.json({error:'busy'},{status:429});}
  localCalls++;return Response.json({text:'Local transcript'});
 }});
 const first=await client.transcribe(Buffer.alloc(1600));assert.equal(first.speech_backend,'local');assert.equal(first.fallback_reason,'gpu_busy');
 const second=await client.transcribe(Buffer.alloc(1600));assert.equal(second.fallback_reason,'gpu_cooldown');assert.equal(gpuCalls,1);assert.equal(localCalls,2);
 clock+=2001;await client.transcribe(Buffer.alloc(1600));assert.equal(gpuCalls,2);
});
test('GPU connection failure falls back without exposing the native error',async()=>{
 const client=createLocalSpeechClient({gpuUrl:'http://127.0.0.1:47212',fetchImpl:async(url)=>{
  if(new URL(url).port==='47212')throw new Error('private native details');return Response.json({text:'Recovered'});
 }});
 const result=await client.transcribe(Buffer.alloc(1600));assert.equal(result.text,'Recovered');assert.equal(result.fallback_reason,'gpu_unavailable');
});
