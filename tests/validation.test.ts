import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validHandle,integer,problemKey,modeValue,withParams } from '../lib/validation';
test('public handle input is normalized without interpreting commands',()=>{
  assert.equal(validHandle(' Chatresh '),'Chatresh');
  for(const value of ['',null,'name; rm -rf','../secret','name with spaces','<script>'])assert.throws(()=>validHandle(value));
});
test('problem ID search accepts the formats users see on Codeforces',()=>{
  assert.deepEqual(problemKey('1879C'),{contest:1879,index:'C'});
  assert.deepEqual(problemKey(' 1879/c '),{contest:1879,index:'C'});
  assert.deepEqual(problemKey('1188A1'),{contest:1188,index:'A1'});
  assert.equal(problemKey("1879C' OR true"),null);
});
test('pagination and ratings cannot become unbounded or negative',()=>{
  assert.equal(integer('-1',1,1,100),1);assert.equal(integer('9999',1,1,100),100);
  assert.equal(integer('1.5',1,1,100),1);assert.equal(integer('0',1,1,100),1);
});
test('mode and navigation parameters remain within the designed contract',()=>{
  assert.equal(modeValue('fix_weaknesses'),'fix_weaknesses');assert.equal(modeValue('admin'),'stretch');
  assert.equal(withParams('/problems',{q:'a&b',page:2,handle:null}),'/problems?q=a%26b&page=2');
});
