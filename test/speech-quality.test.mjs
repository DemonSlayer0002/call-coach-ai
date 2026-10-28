import test from 'node:test';
import assert from 'node:assert/strict';
import {isHallucination} from '../public/speech-quality.js';
test('short sales-call replies and closing words are retained',()=>{
 for(const text of ['Yes.','No.','Hello','Thank you!','Bye','Yes yes','Ten tomorrow.'])assert.equal(isHallucination(text),false,text);
});
test('clear noise markers and non-call ASR artifacts are dropped',()=>{
 for(const text of ['', '[BLANK_AUDIO]', '(silence)', '♪ music ♪', 'Thanks for watching.', 'you you you you you you'])assert.equal(isHallucination(text),true,text);
});
