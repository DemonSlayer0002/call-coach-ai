// Explicit real-API checks of spoken-practice feedback using synthetic text.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
if(!process.argv.includes('--live')){console.error('Pass --live to test synthetic practice replies through Jev.');process.exit(1);}
const cases=[
 {id:'verified-price-and-introduction',scenario:'price',customer:'Is the 2021 RAV4 available, and what is the total price?',rep:'Hi, this is Sam at American Dream Motors. I have checked the RAV4: it is available, and the full out-the-door total is twenty-four thousand five hundred dollars.',quality:'clear',signals:{rep_introduced:true,rep_addressed_question:true}},
 {id:'invented-price',scenario:'price',customer:'What is the complete total?',rep:'The complete total is nineteen thousand dollars.',quality:'unsupported'},
 {id:'unverified-accident-claim',scenario:'history',customer:'Has the CR-V ever had structural damage?',rep:'I guarantee this CR-V has never been in any accident or had structural damage.',quality:'unsupported'},
 {id:'honest-history-verification',scenario:'history',customer:'Has the CR-V ever had structural damage?',rep:'I do not have verified structural history yet. I will check the available history and inspection records before answering that.',quality:'clear',signals:{rep_addressed_question:true}},
 {id:'unverified-finance-guarantee',scenario:'visit',customer:'Can you guarantee financing approval even with my credit?',rep:'Yes. I guarantee that you are approved with a zero percent rate.',quality:'unsupported',signals:{approval_promised:true}},
 {id:'invitation-is-not-booking',scenario:'visit',customer:'I want to test drive the Camry.',rep:'Would you like to come drive the Camry tomorrow at ten in the morning or two in the afternoon?',quality:'clear',signals:{rep_asked_for_visit:true,appointment_agreed:false}},
 {id:'request-is-not-agreement',scenario:'visit',turns:[['customer','Could I come tomorrow at ten to drive the Camry?']],signals:{appointment_agreed:false}},
 {id:'both-sides-agree',scenario:'visit',turns:[['rep','Would you like to test drive the 2022 Camry tomorrow at ten in the morning?'],['customer','Yes, tomorrow at ten works. My partner and I will come.']],signals:{appointment_agreed:true,rep_asked_for_visit:true}},
 {id:'rep-confirms-request',scenario:'visit',turns:[['customer','Ten tomorrow morning works for my partner and me. Can you confirm?'],['rep','Yes, we have agreed on a visit for the 2022 Toyota Camry tomorrow at ten in the morning.']],quality:'clear',signals:{appointment_agreed:true}}
];
const results=[];const base='http://127.0.0.1:'+(process.env.PORT||3137);
for(const c of cases){
 const turns=(c.turns||[['customer',c.customer],['rep',c.rep]]).map(([speaker,text])=>({speaker,text}));
 const response=await fetch(base+'/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'automotive',demo_scenario:c.scenario,turns})});
 assert.equal(response.status,200);const data=await response.json();
 const quality=data.answers.rep_response_quality;
 const checks=Object.fromEntries(Object.entries(c.signals||{}).map(([id,expected])=>[id,{expected,probability:data.answers[id].noul,passed:expected?data.answers[id].noul>=.7:data.answers[id].noul<=.3}]));
 const passed=(!c.quality||quality.choice===c.quality)&&Object.values(checks).every(check=>check.passed);
 results.push({id:c.id,passed,expected_quality:c.quality,quality:quality.choice,quality_probabilities:quality.probabilities,checks,model:data.model,trace:data.trace,latency_ms:data.latency_ms});
 console.log((passed?'PASS ':'FAIL ')+c.id+': '+quality.choice);
}
const report={checked_at:new Date().toISOString(),scope:'Authored synthetic text checks of voice-practice inference. Does not prove microphone, TTS, visual rendering or real-call accuracy.',passed:results.filter(r=>r.passed).length,total:results.length,results};
await writeFile(new URL('../docs/practice-evaluation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(report.passed!==report.total)process.exitCode=1;
