import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedOrigin} from '../lib/web.mjs';
test('HTTPS behind an explicitly trusted proxy matches the browser origin',()=>{
 assert.equal(expectedOrigin('coach.example','https',{trustProxy:true}),'https://coach.example');
 assert.equal(expectedOrigin('coach.example','https, http',{trustProxy:true}),'https://coach.example');
});
test('untrusted forwarded headers cannot change local origin; explicit public origin wins',()=>{
 assert.equal(expectedOrigin('localhost:3137','https'),'http://localhost:3137');
 assert.equal(expectedOrigin('internal:3000','http',{trustProxy:true,publicOrigin:'https://coach.example/'}),'https://coach.example');
});
