import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, rankWithCoverage, type RankingCandidate, type RetrievalVectors } from '../lib/recommendation-ranking';
import config from '../config/retrieval.json';

const empty:RetrievalVectors={editorial_vector:null,editorial_hash:null,statement_vector:null,statement_hash:null};
function vector(sim:number) { const v=Array(config.dimensions).fill(0); v[0]=sim;v[1]=Math.sqrt(1-sim*sim);return v; }
function pool(kind:'editorial'|'statement'):RankingCandidate[] {
  return [-.8,-.4,0,.4,.8].map((sim,i)=>({...empty,problem_id:i+1,score:.5,solved_count:0,
    [`${kind}_vector`]:vector(sim),[`${kind}_hash`]:`source-${i}`}));
}
const editorialAnchor={...empty,editorial_vector:vector(1),editorial_hash:'anchor'};
const statementAnchor={...empty,statement_vector:vector(1),statement_hash:'anchor'};

test('missing or unusable vectors preserve baseline order and scores',()=>{
  const rows=pool('editorial').map(row=>({...row,score:row.problem_id/10}));
  const ranked=rankWithCoverage(rows,[],5);
  assert.deepEqual(ranked.map(r=>r.problem_id),[5,4,3,2,1]);
  assert.ok(ranked.every(r=>r.score===r.baseline_score && r.similarity_source===null));
  assert.equal(cosine([1],[1]),null);
  assert.equal(cosine(Array(384).fill(0),vector(1)),null);
  assert.equal(cosine(Array(384).fill(NaN),vector(1)),null);
});
test('editorial contribution is centered and missing-text candidates receive no adjustment',()=>{
  const rows=[...pool('editorial'),{...empty,problem_id:6,score:.5,solved_count:0}];
  const ranked=rankWithCoverage(rows,[editorialAnchor],6);
  assert.equal(ranked[0].problem_id,5);
  assert.equal(ranked.at(-1)!.problem_id,1);
  assert.ok(Math.abs(ranked.reduce((s,r)=>s+r.semantic_adjustment,0))<1e-10);
  assert.equal(ranked.find(r=>r.problem_id===6)!.semantic_adjustment,0);
  assert.equal(ranked.find(r=>r.problem_id===3)!.semantic_adjustment,0);
});
test('statement fallback is weaker, and incompatible channels are never compared',()=>{
  const ranked=rankWithCoverage(pool('statement'),[statementAnchor],5);
  assert.ok(ranked.every(r=>r.similarity_source==='statement'));
  assert.ok(Math.abs(ranked[0].semantic_adjustment-config.statementWeight)<1e-10);
  assert.ok(config.statementWeight<config.editorialWeight);
  assert.ok(rankWithCoverage(pool('statement'),[editorialAnchor],5).every(r=>r.similarity_source===null));
});
test('editorials take priority; statement fallback remains available without editorial anchors',()=>{
  const both=pool('editorial').map(row=>({...row,statement_vector:row.editorial_vector,statement_hash:row.editorial_hash}));
  assert.ok(rankWithCoverage(both,[editorialAnchor,statementAnchor],5).every(r=>r.similarity_source==='editorial'));
  assert.ok(rankWithCoverage(both,[statementAnchor],5).every(r=>r.similarity_source==='statement'));
});
test('identical similarities and tiny pools create no semantic score bonus',()=>{
  const tied=pool('editorial').map(row=>({...row,editorial_vector:vector(.8)}));
  assert.ok(rankWithCoverage(tied,[editorialAnchor],5).every(r=>r.semantic_adjustment===0));
  assert.ok(rankWithCoverage(pool('editorial').slice(0,4),[editorialAnchor],4).every(r=>r.similarity_source===null));
});
test('duplicate source text is excluded as anchor evidence and input order does not change ranks',()=>{
  const rows=pool('editorial');
  const duplicate={...editorialAnchor,editorial_hash:'source-0'};
  assert.equal(rankWithCoverage(rows,[duplicate],5).find(r=>r.problem_id===1)!.similarity_source,null);
  assert.deepEqual(rankWithCoverage(rows,[editorialAnchor],5),rankWithCoverage([...rows].reverse(),[editorialAnchor],5));
});
