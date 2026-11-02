/** Integration checks: synchronize derived public history and verify graph reads. */
import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {learningConfig,learningTopics} from '../lib/learning-graph';
loadEnvConfig(process.cwd());
async function main(){
 const {query,pool}=await import('../lib/db');
 const {graphDriver}=await import('../lib/neo4j');
 const {learningPath}=await import('../lib/learning-path');
 const {GET}=await import('../app/api/path/route');
 try{
  const uid=(await query<{user_id:number}>('SELECT user_id FROM app_user WHERE cf_handle=$1',['Chatresh']))[0]?.user_id;
  assert.ok(uid,'Import Chatresh first');
  for(const goal of learningTopics){
   const expected=new Set([goal.id]);let changed=true;
   while(changed){changed=false;for(const e of learningConfig.edges)if(expected.has(e.to)&&!expected.has(e.from)){expected.add(e.from);changed=true}}
   const plan=await learningPath(uid,goal.id);
   assert.deepEqual(plan.topics.map(t=>t.id).sort(),[...expected].sort());
   assert.equal(plan.edges.length,learningConfig.edges.filter(e=>expected.has(e.to)&&expected.has(e.from)).length);
   assert.equal(plan.levels.flat().length,expected.size);
   assert.ok(plan.topics.every(t=>t.solved>=0&&t.attempts>=t.accepted&&t.accepted>=t.solved));
  }
  const branched=await learningPath(uid,'dsu');
  assert.ok(branched.topics.some(t=>t.id==='data-structures'),'Shortest route must not hide another background branch');
  const root=await learningPath(uid,'implementation');
  assert.equal(root.topics.length,1);
  assert.ok(root.topics[0].solvedProblems.length>0);
  const accepted=new Set((await query<{key:string}>(`SELECT DISTINCT p.contest_id||'/'||p.problem_index AS key FROM submission s JOIN problem p USING(problem_id) WHERE s.user_id=$1 AND s.verdict='OK'`,[uid])).map(r=>r.key));
  for(const p of root.topics[0].solvedProblems)assert.ok(accepted.has(p.key));
  const repeat=await learningPath(uid,'implementation');
  assert.deepEqual(repeat.topics,root.topics);
  const experienced=(await query<{user_id:number}>('SELECT user_id FROM app_user WHERE cf_handle=$1',['Petr']))[0];
  if(experienced){
   const begin=performance.now();
   const plan=await learningPath(experienced.user_id,'flows');
   for(const t of plan.topics){
    const [expected]=await query<{solved:number}>(`SELECT count(DISTINCT s.problem_id) AS solved FROM submission s JOIN problem_tag pt USING(problem_id) JOIN tag t USING(tag_id) WHERE s.user_id=$1 AND s.verdict='OK' AND t.name=$2`,[experienced.user_id,t.tag]);
    assert.equal(t.solved,expected.solved);
    assert.equal(t.solvedProblems.length,Math.min(3,t.solved));
   }
   console.log(`Experienced-profile projection and graph evidence match PostgreSQL (${Math.round(performance.now()-begin)} ms including independent checks).`);
  }
  const api=await GET(new Request('http://localhost/api/path?handle=Chatresh&target=flows'));
  assert.equal(api.status,200);assert.equal((await api.json()).target,'flows');
  assert.equal((await GET(new Request('http://localhost/api/path?handle=Chatresh&target=invalid'))).status,400);
  assert.equal((await GET(new Request('http://localhost/api/path?handle=nonexistent_fixture_8347'))).status,404);
  console.log(`Learning-path checks passed: ${learningTopics.length} goals, all background branches, root case, accepted-only graph evidence, repeat projection, invalid inputs and API responses.`);
 }finally{await pool.end();await graphDriver().close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
