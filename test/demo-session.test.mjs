import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,createDemoPlayer} from '../public/demo-session.js';

test('demo scenarios play in order and finish without inventing or duplicating turns',async()=>{
 for(const scenario of Object.values(SCENARIOS)){
  const received=[];const player=createDemoPlayer({delayMs:0,onTurn:turn=>received.push([turn.speaker,turn.text])});
  player.load(scenario);await player.play();
  assert.deepEqual(received,scenario.turns);assert.equal(player.state().finished,true);assert.equal(player.state().playing,false);
  await player.step();assert.equal(received.length,scenario.turns.length);
 }
});
test('pausing playback prevents a queued next line',async()=>{
 const received=[];let player;
 player=createDemoPlayer({delayMs:20,onTurn:turn=>{received.push(turn);player.pause();}});
 player.load(SCENARIOS.price);await player.play();
 assert.equal(received.length,1);assert.equal(player.state().playing,false);
});
test('changing scenarios cancels the old playback before a second line',async()=>{
 const received=[];let player;
 player=createDemoPlayer({delayMs:20,onTurn:turn=>{received.push(turn.text);if(received.length===1)player.load(SCENARIOS.history);}});
 player.load(SCENARIOS.price);await player.play();
 assert.equal(received.length,1);assert.equal(player.state().index,0);
 await player.step();assert.equal(received[1],SCENARIOS.history.turns[0][1]);
});
