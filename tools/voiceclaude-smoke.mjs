// Replay synthetic PCM through the browser client module and real VoiceClaude route.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live')){console.error('Use --live with a synthetic 16 kHz float32 .f32 file.');process.exit(1);}
const file=process.argv.find(arg=>arg.endsWith('.f32'));if(!file)throw new Error('Provide a synthetic .f32 audio fixture.');
const base='http://127.0.0.1:'+(process.env.PORT||3137),realFetch=globalThis.fetch;
const requests=[];
globalThis.fetch=async(path,options)=>{requests.push(path);return realFetch(new URL(path,base),options);};
globalThis.Worker=class{constructor(){throw new Error('Browser ASR worker must not be used in VoiceClaude mode.');}};
const {prepareSpeech,transcribe}=await import('../public/transcriber.js');
const health=await fetch('/api/health').then(r=>r.json());assert.equal(health.transcribe,'voiceclaude');
const speech=await fetch('/api/speech/health').then(r=>r.json());assert.equal(speech.ready,true);
await prepareSpeech();
const bytes=await readFile(file),pcm=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const started=performance.now(),result=await transcribe(pcm),elapsed=Math.round(performance.now()-started);
assert.match(result.text,/camry/i);assert.match(result.text,/(?:23,?800|twenty.three thousand eight hundred)/i);assert.match(result.text,/(?:ten|10)/i);
console.log('VoiceClaude via actual browser PCM route:',result.text);
const response=await fetch('/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'automotive',demo_scenario:'visit',turns:[{speaker:'customer',text:'Is the Camry available and what is the full total? I want a test drive.'},{speaker:'rep',text:result.text}]})});
assert.equal(response.status,200);const data=await response.json();assert.equal(data.answers.rep_response_quality.choice,'clear');
const report={checked_at:new Date().toISOString(),passed:true,scope:'Synthetic PCM through the actual browser transcriber module, demo HTTP route, existing VoiceClaude model, and Jev. Browser worker deliberately unavailable. Physical microphone/AudioWorklet not exercised.',provider:speech.provider,backend:result.speech_backend,speech_model:speech.model,recognition_server_ms:result.latency_ms,audio_ready_to_coaching_ms:Math.round(performance.now()-started),recognized_text:result.text,audio_route_ms:elapsed,browser_worker_used:false,requests,jev_model:data.model,jev_latency_ms:data.latency_ms,reply_quality:data.answers.rep_response_quality.choice,trace:data.trace};
await writeFile(new URL('../docs/voiceclaude-smoke.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('PASS VoiceClaude → browser client → Jev, '+elapsed+' ms recognition route.');
