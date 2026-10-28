import test from 'node:test';
import assert from 'node:assert/strict';
import {decide,createMemory,DEFAULT_CONFIG,pickTips,trackStage,createStageMemory} from '../public/decide.js';
const playbook={actions:{close:{title:'Close',tips:{always:['Close']}},ask:{title:'Ask',tips:{always:['Ask']}}},priority:['close','ask'],rules:[],listeningTips:['Listen']};
const answers=(close,ask,confidence=0.8)=>({next_best_action:{type:'choice',choice:close>ask?'close':'ask',probabilities:{close,ask},confidence}});
test('blocking the leading action does not manufacture confidence in a weak alternative',()=>{
 const p={...playbook,rules:[{when:()=>true,block:['close']}]};
 const r=decide(answers(.65,.35),p,createMemory());
 assert.equal(r.status,'listen'); assert.equal(r.score,.35);
});
test('display uses original probability after cooldown exclusions',()=>{
 const mem=createMemory();mem.done.close=100;
 const r=decide(answers(.45,.55),playbook,mem,10);
 assert.equal(r.action,'ask'); assert.equal(r.score,.55);
});
test('unclear choices abstain; high-consequence actions need stronger evidence',()=>{
 const config={...DEFAULT_CONFIG,minMargin:.1,minActionConfidence:.35,actionMinScore:{close:.7}};
 assert.equal(decide(answers(.52,.48),playbook,createMemory(),0,config).status,'listen');
 assert.equal(decide(answers(.65,.35),playbook,createMemory(),0,config).status,'listen');
 assert.equal(decide(answers(.8,.2),playbook,createMemory(),0,config).action,'close');
});
test('objection scripts require both a matching option and enough evidence',()=>{
 const a={tips:{choices:[{question:'objection',option:'price',text:'Clarify total cost'}],always:['Ask about concern']}};
 assert.deepEqual(pickTips(a,{},3,DEFAULT_CONFIG,{objection:{type:'choice',choice:'price',confidence:.9,probabilities:{price:.9}}}),['Clarify total cost','Ask about concern']);
 assert.deepEqual(pickTips(a,{},3,DEFAULT_CONFIG,{objection:{type:'choice',choice:'price',confidence:.1,probabilities:{price:.55}}}),['Ask about concern']);
});
test('nonfinite stage scores cannot poison subsequent readings',()=>{
 const mem=createStageMemory();assert.equal(trackStage({score:NaN},mem,['a','b']),null);assert.equal(mem.smoothed,null);
});
