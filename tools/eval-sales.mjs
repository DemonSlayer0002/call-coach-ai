// Paid provider requests are explicit: npm run eval:live. Uses only synthetic fixtures.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluate } from '../lib/coach.mjs';
import { decide, createMemory, DEFAULT_CONFIG } from '../public/decide.js';
if (!process.argv.includes('--live')) {
  console.error('Use --live to explicitly authorize one Jev request per synthetic case.'); process.exit(1);
}
if (!process.env.TYPESAFE_API_KEY) { console.error('Set TYPESAFE_API_KEY in your private .env.'); process.exit(1); }
const cases = JSON.parse(await readFile(new URL('../test/fixtures/sales-cases.json',import.meta.url),'utf8'));
const results=[];
for (const c of cases) {
  const dir = new URL(`../public/modes/${c.mode}/`,import.meta.url);
  const meta = JSON.parse(await readFile(new URL('mode.json',dir),'utf8'));
  const source = await readFile(new URL('playbook.js',dir),'utf8');
  const {PLAYBOOK} = await import('data:text/javascript,'+encodeURIComponent(source));
  const config={...DEFAULT_CONFIG,...PLAYBOOK.config};
  const policyHash=createHash('sha256').update(source+JSON.stringify(config)).digest('hex');
  const [status,data]=await evaluate({header:()=>undefined,ip:'synthetic-evaluation',readJson:async()=>({mode:c.mode,turns:c.turns})});
  if (status!==200) {
    results.push({id:c.id,mode:c.mode,passed:false,status,error:data.error});
    console.log(`FAIL ${c.id}: HTTP ${status}`); continue;
  }
  const decision=decide(data.answers,{...PLAYBOOK,questions:meta.questions},createMemory(),0,config);
  const action=decision.status==='act'?decision.action:'no_action';
  const objection=data.answers.objection_type;
  const actionMatch=c.expected_actions.includes(action);
  const objectionMatch=!c.expected_objection||objection?.choice===c.expected_objection;
  const row={id:c.id,mode:c.mode,passed:actionMatch&&objectionMatch,action_match:actionMatch,objection_match:objectionMatch,
    expected_actions:c.expected_actions,action,raw_action:data.answers.next_best_action.choice,
    abstained:decision.status==='listen',objection:objection?.choice,expected_objection:c.expected_objection,
    model:data.model,trace:data.trace,policy_hash:policyHash,latency_ms:data.latency_ms,attempts:data.attempts,usage:data.usage,
    action_probabilities:data.answers.next_best_action.probabilities,action_confidence:data.answers.next_best_action.confidence};
  results.push(row); console.log(`${row.passed?'PASS':'FAIL'} ${c.id}: ${action}, objection=${row.objection}, ${row.latency_ms} ms`);
}
const latencies=results.map(r=>r.latency_ms).filter(Number.isFinite).sort((a,b)=>a-b);
const report={generated_at:new Date().toISOString(),scope:'Authored synthetic regression cases. Not independent human evaluation or real-call accuracy.',
  total:results.length,passed:results.filter(r=>r.passed).length,
  action_matches:results.filter(r=>r.action_match).length,objection_matches:results.filter(r=>r.objection_match).length,
  abstentions:results.filter(r=>r.abstained).length,
  latency_ms:{p50:latencies[Math.ceil(latencies.length*.5)-1],p95:latencies[Math.ceil(latencies.length*.95)-1]},
  usage:results.reduce((u,r)=>({input_tokens:u.input_tokens+(r.usage?.input_tokens||0),output_tokens:u.output_tokens+(r.usage?.output_tokens||0)}),{input_tokens:0,output_tokens:0}),results};
const out=new URL('../docs/synthetic-evaluation.json',import.meta.url);
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,latency_ms:report.latency_ms,usage:report.usage}));
if(report.passed!==report.total)process.exitCode=1;
