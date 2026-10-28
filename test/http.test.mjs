import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('HTTP transcript → redacted Jev request → typed coaching; access checks block cross-site spend',async t=>{
 let observed;
 const provider=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  observed=JSON.parse(Buffer.concat(chunks));
  const answers={};
  for(const [id,q] of Object.entries(observed.questions)){
   if(q.type==='noul')answers[id]={type:'noul',noul:.05};
   else if(q.type==='choice'){
    const keys=Object.keys(q.criteria),choice=id==='next_best_action'?'verify_vehicle':keys.at(-1);
    answers[id]={type:'choice',choice,confidence:1,probabilities:Object.fromEntries(keys.map(k=>[k,k===choice?1:0]))};
   }else answers[id]={type:'score',score:1,confidence:1,probabilities:Object.fromEntries(q.criteria.map((_,i)=>[String(i),i===1?1:0]))};
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({model:'mock-jev',answers,usage:{input_tokens:100,output_tokens:20}}));
 });
 provider.listen(0,'127.0.0.1');await once(provider,'listening');
 t.after(()=>new Promise(resolve=>provider.close(resolve)));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',BIND_HOST:'127.0.0.1',HOSTED:'0',VERCEL:'0',TRANSCRIBE:'off',TYPESAFE_API_KEY:'synthetic-key',AMD_LIVE_STT_INGEST_TOKEN:'synthetic-ingest',TYPESAFE_ENDPOINT:'http://127.0.0.1:'+provider.address().port},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
 const base=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(new Error('Server startup deadline exceeded.')),5000);
  child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/running at http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});
  child.once('error',err=>{clearTimeout(timer);reject(err);});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited before startup.'));});
 });
 const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/health')).status,200);
 const reboundStatus=await new Promise((resolve,reject)=>http.get(base+'/',{headers:{Host:'rebound.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
 assert.equal(reboundStatus,403);
 assert.equal((await post('/api/evaluate',{}, {Origin:'https://external.example'})).status,403);
 const start={kind:'session_start',session_id:'synthetic',call_id:'synthetic-call',at:1000};
 assert.equal((await post('/api/internal/live-stt/events',{events:[start]})).status,401);
 const headers={authorization:'Bearer synthetic-ingest','x-amd-intent':'live-stt-ingest-v1'};
 const segment={kind:'segment',session_id:'synthetic',call_id:'synthetic-call',speaker:'customer',seq:1,final:true,text:'Is the SUV available? Email sam@example.test.',audio_ms:2000,at:1001};
 const ingested=await post('/api/internal/live-stt/events',{events:[start,segment]},headers);
 assert.equal(ingested.status,200);assert.deepEqual(await ingested.json(),{ok:true});
 const session=await fetch(base+'/api/live/sessions/synthetic').then(r=>r.json());
 assert.equal(session.segments.length,1);assert.ok(!session.segments[0].text.includes('sam@'));
 const response=await post('/api/evaluate',{mode:'automotive',turns:session.segments.map(s=>({speaker:s.speaker==='staff'?'rep':'customer',text:s.text}))});
 assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.answers.next_best_action.choice,'verify_vehicle');assert.equal(result.trace.contract_hash.length,64);
 assert.ok(!JSON.stringify(observed.state).includes('sam@'));
});
