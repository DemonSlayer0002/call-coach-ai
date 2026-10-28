import test from 'node:test';
import assert from 'node:assert/strict';
import {isSpeechLoop,redactContactDetails} from '../lib/transcript.mjs';
test('detects clear ASR loops while retaining short repetition and ordinary conversation',()=>{
 assert.equal(isSpeechLoop('thank you '.repeat(15)),true);
 assert.equal(isSpeechLoop('I need a vehicle '.repeat(12)),true);
 assert.equal(isSpeechLoop('yes yes'),false);
 assert.equal(isSpeechLoop('I need a car with a large trunk and good gas mileage because I travel a lot for work and take my family on trips.'),false);
});
test('masks contact details and long identifiers while retaining prices and vehicle identity',()=>{
 const r=redactContactDetails('Email sam@example.test or call (202) 555-0123. ID 123-45-6789, account 123456789012. Budget $25,000, payment $450, VIN 1C4HJXEG2JW279979.');
 assert.ok(!r.includes('sam@'));assert.ok(!r.includes('555-0123'));assert.ok(!r.includes('123-45'));assert.ok(!r.includes('123456789012'));
 assert.ok(r.includes('$25,000'));assert.ok(r.includes('$450'));assert.ok(r.includes('1C4HJXEG2JW279979'));
});
