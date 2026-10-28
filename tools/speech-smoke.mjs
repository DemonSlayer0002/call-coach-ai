// Optional CPU speech check. Input must be synthetic 16 kHz mono float32 PCM.
import {pipeline,env} from '@huggingface/transformers';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live')){console.error('Pass --live and a synthetic PCM file to test speech plus Jev.');process.exit(1);}
const file=process.argv.find(arg=>arg.endsWith('.f32'));
if(!file)throw new Error('Provide a synthetic 16 kHz mono .f32 PCM file.');
env.cacheDir='/tmp/call-coach-speech-check/models';
const bytes=await readFile(file);
const pcm=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const model='onnx-community/whisper-base.en';
const started=performance.now();console.log('Loading actual speech recognizer for synthetic audio...');
const asr=await pipeline('automatic-speech-recognition',model,{device:'cpu',dtype:'q8',session_options:{intraOpNumThreads:4}});
const warm=performance.now();const result=await asr(pcm);const latency=Math.round(performance.now()-warm);
console.log('Recognized synthetic speech:',result.text);
assert.match(result.text,/camry/i);assert.match(result.text,/tomorrow/i);assert.match(result.text,/(?:ten|10)/i);
const response=await fetch('http://127.0.0.1:3137/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'automotive',demo_scenario:'visit',turns:[{speaker:'customer',text:'Is the 2022 Camry available, and what is the total price? I want to come drive it.'},{speaker:'rep',text:result.text}]})});
assert.equal(response.status,200);const data=await response.json();
assert.equal(data.answers.rep_response_quality.choice,'clear');assert.ok(data.answers.rep_asked_for_visit.noul>=.7);
const report={checked_at:new Date().toISOString(),scope:'Locally synthesized speech through actual CPU Whisper-base recognizer and real Jev HTTP inference. Not physical microphone, browser/WebGPU, or acoustic acceptance.',passed:true,speech_model:model,device:'cpu',dtype:'q8',audio_seconds:pcm.length/16000,model_load_ms:Math.round(warm-started),asr_ms:latency,recognized_text:result.text,jev_model:data.model,jev_latency_ms:data.latency_ms,reply_quality:data.answers.rep_response_quality.choice,visit_ask_probability:data.answers.rep_asked_for_visit.noul,trace:data.trace};
await writeFile(new URL('../docs/speech-smoke.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('Speech-to-coach synthetic check passed.');
