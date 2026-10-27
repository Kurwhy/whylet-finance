import test from 'node:test';import assert from 'node:assert/strict';
import {apiOrigins} from '../src/utils/apiOrigin.js';
test('CSRF origin mendukung URL API relatif untuk deployment same-origin',()=>{
 assert.deepEqual(apiOrigins('/api/v1','/wallets','https://qa.example.invalid'),{base:'https://qa.example.invalid',request:'https://qa.example.invalid'});
 const foreign=apiOrigins('/api/v1','https://foreign.invalid/x','https://qa.example.invalid');assert.notEqual(foreign.base,foreign.request);
 assert.equal(apiOrigins('http://localhost:5001/api/v1','/wallets','http://localhost:5173').request,'http://localhost:5001');
});
