import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningConfig,learningTopics,prerequisiteLevels,topicId} from '../lib/learning-graph';

test('the curated map is an acyclic graph with unique tags and documented edges',()=>{
 const levels=prerequisiteLevels(learningTopics,learningConfig.edges);
 assert.equal(levels.flat().length,learningTopics.length);
 assert.equal(new Set(learningTopics.map(t=>t.tag)).size,learningTopics.length);
 assert.ok(learningConfig.edges.every(e=>e.reason.trim().length>20));
 const positions=new Map(levels.flatMap((level,i)=>level.map(t=>[t.id,i] as const)));
 assert.ok(learningConfig.edges.every(e=>positions.get(e.from)!<positions.get(e.to)!));
});
test('multiple required background branches stay before their shared destination',()=>{
 const topics=learningTopics.filter(t=>['graphs','data-structures','dsu'].includes(t.id));
 const edges=learningConfig.edges.filter(e=>topics.some(t=>t.id===e.from)&&topics.some(t=>t.id===e.to));
 const levels=prerequisiteLevels(topics,edges);
 assert.deepEqual(levels.map(l=>l.map(t=>t.id)),[['graphs','data-structures'],['dsu']]);
});
test('cycles, missing endpoints and unrecognized URL topics are rejected',()=>{
 const a=learningTopics[0],b=learningTopics[1];
 assert.throws(()=>prerequisiteLevels([a,b],[{from:a.id,to:b.id,reason:'fixture'},{from:b.id,to:a.id,reason:'fixture'}]),/acyclic/);
 assert.throws(()=>prerequisiteLevels([a],[{from:a.id,to:'missing',reason:'fixture'}]),/Invalid/);
 assert.throws(()=>topicId("dp' MATCH(n) DETACH DELETE n"));
 assert.throws(()=>topicId('unknown'));
 assert.equal(topicId('dp'),'dp');
 assert.deepEqual(prerequisiteLevels([],[]),[]);
});
