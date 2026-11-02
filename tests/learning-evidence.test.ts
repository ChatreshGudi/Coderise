import {test} from 'node:test';
import assert from 'node:assert/strict';
import {practiceSnapshot,suggestedReview,type HistoryRow,type PracticeTopic} from '../lib/learning-evidence';
import {learningTopics} from '../lib/learning-graph';
const row:HistoryRow={key:'1/A',contest_id:1,problem_index:'A',name:'Fixture',rating:800,solved_at:'2026-01-01T00:00:00Z',verdict:'OK',tags:['implementation','graphs']};
test('practice evidence deduplicates accepted problems, counts real attempts and excludes pending/compilation errors',()=>{
 const rows=[row,{...row,verdict:'WRONG_ANSWER'},{...row,solved_at:'2026-01-02T00:00:00Z'},...['COMPILATION_ERROR','TESTING','SUBMITTED'].map(verdict=>({...row,verdict}))];
 const result=practiceSnapshot(rows);
 assert.equal(result.solves.length,1);assert.equal(result.solves[0].solved_at,'2026-01-02T00:00:00Z');
 assert.deepEqual(result.solves[0].topics,['implementation','graphs']);
 assert.equal(result.evidence.get('graphs')?.attempts,3);
 assert.equal(result.evidence.get('graphs')?.accepted,2);
 assert.equal(result.evidence.get('graphs')?.solved.size,1);
 assert.equal(result.evidence.get('dp')?.solved.size,0);
 assert.equal(practiceSnapshot([{...row,verdict:'WRONG_ANSWER'}]).solves.length,0);
});
test('review suggestions keep unpracticed background before a failed descendant and never claim mastery',()=>{
 const topics=learningTopics.filter(t=>['implementation','brute-force','dp'].includes(t.id)).map(t=>({...t,solved:0,attempts:t.id==='dp'?5:0,accepted:0,solvedProblems:[]})) as PracticeTopic[];
 const levels=[['implementation'],['brute-force'],['dp']];
 assert.deepEqual(suggestedReview(topics,levels,'dp'),['implementation']);
 topics[0].solved=1;assert.deepEqual(suggestedReview(topics,levels,'dp'),['brute-force']);
 topics[1].solved=1;assert.deepEqual(suggestedReview(topics,levels,'dp'),['dp']);
});
