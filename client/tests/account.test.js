import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordSchema, changePasswordSchema, profileSchema } from '../src/validations/account.schema.js';
import { passwordSchema as backendPassword, profileSchema as backendProfile } from '../../server/src/validators/account.validator.js';
test('Password frontend/backend konsisten dan menolak truncation bcrypt UTF-8',()=>{
    for(const value of ['Aa1'+'x'.repeat(69),'Aa1'+'é'.repeat(34),'Aa1'+'x'.repeat(70),'Aa1'+'é'.repeat(35),'password','Aa1'])assert.equal(passwordSchema.safeParse(value).success,backendPassword.safeParse(value).success);
    assert.equal(passwordSchema.safeParse('Aa1'+'x'.repeat(69)).success,true);
    assert.equal(passwordSchema.safeParse('Aa1'+'é'.repeat(35)).success,false);
});
test('Profil dan konfirmasi password validasi konsisten',()=>{
    for(const name of ['Ab','Nama QA','x'.repeat(101)])assert.equal(profileSchema.safeParse({name}).success,backendProfile.safeParse({name}).success);
    assert.equal(changePasswordSchema.safeParse({currentPassword:'OldPass123',password:'NewPass123',confirmPassword:'Beda1234'}).success,false);
});
