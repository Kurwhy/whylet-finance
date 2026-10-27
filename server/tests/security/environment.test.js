import test from 'node:test';
import assert from 'node:assert/strict';
import {assertEnvironment} from '../../src/config/environment.js';
const base={NODE_ENV:'production',CLIENT_URL:'https://qa.example.invalid',DATABASE_URL:'mysql://fixture:dummy@db:3306/fixture',JWT_SECRET:'a'.repeat(48),CSRF_SECRET:'b'.repeat(48),SMTP_HOST:'mail.internal',SMTP_PORT:'587',MAIL_FROM:'qa@example.invalid'};
test('Production menolak konfigurasi tidak aman tanpa membocorkan nilainya',()=>{
    assert.doesNotThrow(()=>assertEnvironment(base));
    for(const change of [{JWT_SECRET:''},{CSRF_SECRET:base.JWT_SECRET},{CLIENT_URL:'http://qa.example.invalid'},{CLIENT_URL:base.CLIENT_URL+'/'},{DATABASE_URL:'bad'},{MAIL_FROM:''},{SMTP_PORT:'0'}])assert.throws(()=>assertEnvironment({...base,...change}),/Konfigurasi production/);
});
