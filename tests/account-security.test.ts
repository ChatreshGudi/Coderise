import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,usernameValue,passwordValue,digest,sessionToken,sessionConfiguration} from '../lib/account-security';
import {positiveId,listFields} from '../lib/list-rules';
test('passwords use salted Argon2id and reject wrong credentials',async()=>{
 const password='A long course test passphrase 42!';
 const a=await hashPassword(password),b=await hashPassword(password);
 assert.match(a,/^\$argon2id\$/);assert.notEqual(a,b);
 assert.equal(await verifyPassword(a,password),true);assert.equal(await verifyPassword(a,'wrong'),false);assert.equal(await verifyPassword(null,password),false);
 assert.throws(()=>passwordValue('1234567'));assert.equal(passwordValue('12345678'),'12345678');assert.throws(()=>passwordValue('x'.repeat(129)));
});
test('identifiers and list data are bounded independently of browser validation',()=>{
 assert.equal(usernameValue(' Student_42 '),'student_42');assert.throws(()=>usernameValue('admin; --'));
 for(const x of [0,-1,'1 OR true','1.2',{},null,'999999999999999999'])assert.throws(()=>positiveId(x));
 assert.equal(positiveId('42'),42);assert.deepEqual(listFields({name:' Graphs ',description:' Later '}),{name:'Graphs',description:'Later'});
 assert.throws(()=>listFields({name:' '}));assert.throws(()=>listFields({name:'a',description:'x'.repeat(501)}));
});
test('session tokens are random high-entropy values with deterministic storage digests',()=>{
 const a=sessionToken(),b=sessionToken();assert.match(a,/^[0-9a-f]{64}$/);assert.notEqual(a,b);assert.notEqual(digest(a),a);assert.equal(digest(a),digest(a));
});
test('non-loopback HTTP cannot be used for credential sessions',()=>{
 const previous=process.env.CODERISE_ORIGIN;
 try{process.env.CODERISE_ORIGIN='http://example.com';assert.throws(sessionConfiguration);process.env.CODERISE_ORIGIN='https://example.com';assert.equal(sessionConfiguration().name,'__Host-coderise_session');process.env.CODERISE_ORIGIN='http://127.0.0.1:3000';assert.equal(sessionConfiguration().secure,false);}finally{if(previous===undefined)delete process.env.CODERISE_ORIGIN;else process.env.CODERISE_ORIGIN=previous;}
});
