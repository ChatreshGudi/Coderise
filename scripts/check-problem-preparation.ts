import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {learningTopics} from '../lib/learning-graph';
loadEnvConfig(process.cwd());
async function main(){
 const {query,pool}=await import('../lib/db');
 const {getProfile}=await import('../lib/data');
 const {prepareProblem,PreparationInputError}=await import('../lib/problem-preparation');
 const {graphDriver}=await import('../lib/neo4j');
 const {GET}=await import('../app/api/path/route');
 try{
  const profile=await getProfile('Chatresh');assert.ok(profile);
  const accepted=new Set((await query<{problem_id:number}>("SELECT DISTINCT problem_id FROM submission WHERE user_id=$1 AND verdict='OK'",[profile.user_id])).map(p=>p.problem_id));
  const unrated=(await query<{key:string}>('SELECT contest_id||problem_index AS key FROM problem WHERE rating IS NULL AND EXISTS(SELECT 1 FROM problem_tag pt WHERE pt.problem_id=problem.problem_id) ORDER BY problem_id LIMIT 1'))[0];
  const unmapped=(await query<{key:string}>(`SELECT p.contest_id||p.problem_index AS key FROM problem p
   WHERE EXISTS(SELECT 1 FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id AND t.name NOT LIKE '*%')
   AND NOT EXISTS(SELECT 1 FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id AND t.name=ANY($1::text[])) LIMIT 1`,[learningTopics.map(t=>t.tag)]))[0];
  const inputs=['1879C','https://codeforces.com/contest/20/problem/C','4A',unrated?.key,unmapped?.key].filter((s):s is string=>!!s);
  for(const input of inputs){
   const prep=await prepareProblem(profile,input);
   const all=prep.practice.flatMap(t=>t.problems);
   assert.equal(new Set(all.map(p=>p.problem_id)).size,all.length);
   for(const p of all){assert.ok(!accepted.has(p.problem_id));assert.notEqual(p.problem_id,prep.problem.problem_id);assert.ok(p.rating>=prep.band.min&&p.rating<=prep.band.max);if(prep.problem.rating!==null&&prep.problem.rating>800)assert.ok(p.rating<prep.problem.rating)}
   const tags=await query<{problem_id:number;tags:string[]}>('SELECT p.problem_id,ARRAY(SELECT t.name FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id) AS tags FROM problem p WHERE p.problem_id=ANY($1::bigint[])',[all.map(p=>p.problem_id)]);
   for(const topic of prep.practice){assert.ok(topic.problems.length<=3);assert.ok(topic.problems.every(p=>tags.find(t=>t.problem_id===p.problem_id)?.tags.includes(topic.tag)))}
   const mapped=learningTopics.filter(t=>prep.problem.tags.includes(t.tag));
   assert.deepEqual(prep.plan?.targets??[],mapped.map(t=>t.id));
   if(input===unmapped?.key)assert.equal(prep.plan,null);
   console.log(input,prep.problem.name,prep.band.relation,all.length,'distinct practice suggestions',prep.plan?.targets??'no curated background');
  }
  await assert.rejects(()=>prepareProblem(profile,'https://evil.example/contest/20/problem/C'),e=>e instanceof PreparationInputError&&e.status===400);
  await assert.rejects(()=>prepareProblem(profile,'9999999Z'),e=>e instanceof PreparationInputError&&e.status===404);
  const [solvedTarget]=await query<{key:string}>("SELECT p.contest_id||p.problem_index AS key FROM submission s JOIN problem p USING(problem_id) WHERE s.user_id=$1 AND s.verdict='OK' LIMIT 1",[profile.user_id]);
  if(solvedTarget){const revisit=await prepareProblem(profile,solvedTarget.key);assert.equal(revisit.problem.already_solved,true);assert.ok(revisit.practice.flatMap(t=>t.problems).every(p=>p.problem_id!==revisit.problem.problem_id))}
  const api=await GET(new Request('http://localhost/api/path?handle=Chatresh&problem=1879C'));assert.equal(api.status,200);assert.equal((await api.json()).kind,'problem');
  assert.equal((await GET(new Request('http://localhost/api/path?handle=Chatresh&problem='))).status,400);
  assert.equal((await GET(new Request('http://localhost/api/path?handle=Chatresh&problem=9999999Z'))).status,404);
  const advanced=await getProfile('Petr');if(advanced){const p=await prepareProblem(advanced,'1879C');assert.ok(p.practice.flatMap(t=>t.problems).every(t=>p.problem.rating===null||t.rating<p.problem.rating))}
  console.log('Problem preparation checks passed: real links/IDs, multiple goals, accepted/target exclusion, topic matches, rating limits, deduplication, minimum/unrated targets, unmapped tags and API errors.');
 }finally{await pool.end();await graphDriver().close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
