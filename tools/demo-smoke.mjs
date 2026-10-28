import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {SCENARIOS,createDemoPlayer} from '../public/demo-session.js';
import {PLAYBOOK} from '../public/modes/automotive/playbook.js';
import {decide,createMemory,DEFAULT_CONFIG} from '../public/decide.js';
if(!process.argv.includes('--live')){console.error('Use --live to run synthetic demo turns through the local server and real Jev.');process.exit(1);}
const base='http://127.0.0.1:'+(process.env.PORT||3137);
const page=await fetch(base);assert.equal(page.status,200);assert.ok((await page.text()).includes('/sales-desk.js'));
const results=[];
for(const [id,scenario] of Object.entries(SCENARIOS)){
 const turns=[],memory=createMemory(),readings=[];
 const player=createDemoPlayer({delayMs:0,onTurn:async turn=>{
  turns.push(turn);if(!turns.some(t=>t.speaker==='customer'))return;
  const response=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'automotive',demo_scenario:id,turns})});
  assert.equal(response.status,200);const data=await response.json();
  const result=decide(data.answers,PLAYBOOK,memory,Date.now(),{...DEFAULT_CONFIG,...PLAYBOOK.config});
  readings.push({after_line:turns.length,action:result.action||'listen',model:data.model,latency_ms:data.latency_ms,trace:data.trace});
 }});
 player.load(scenario);await player.play();
 assert.equal(turns.length,scenario.turns.length);assert.equal(player.state().finished,true);
 results.push({scenario:id,lines:turns.length,passed:true,readings});
 console.log('PASS '+id+': '+turns.length+' lines, '+readings.length+' real coaching responses');
}
await writeFile(new URL('../docs/demo-smoke.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),scope:'Synthetic playback controller and actual local HTTP/Jev path. No visual browser or real call acceptance claimed.',results},null,2)+'\n');
