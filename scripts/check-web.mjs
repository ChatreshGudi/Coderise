import assert from 'node:assert/strict';
const base=process.env.CODERISE_TEST_URL||'http://127.0.0.1:3000';
const handle=process.env.CODERISE_TEST_HANDLE||'Chatresh';
async function get(path){const r=await fetch(base+path);assert.equal(r.status,200,path);return r.json();}
const profile=await get('/api/profiles/'+encodeURIComponent(handle));
assert.ok(profile.profile.solved_count<=profile.profile.attempted_count);
assert.ok(profile.profile.accepted_submissions<=profile.profile.submission_count);
const all=await get('/api/problems/search?handle='+handle);assert.equal(all.rows.length,25);
const second=await get('/api/problems/search?handle='+handle+'&page=2');
assert.ok(!all.rows.some(a=>second.rows.some(b=>a.problem_id===b.problem_id)));
const exact=await get('/api/problems/search?q=1879C&handle='+handle);assert.equal(exact.count,1);assert.equal(exact.rows[0].contest_id,1879);
const unsolved=await get('/api/problems/search?status=unsolved&handle='+handle);assert.ok(unsolved.rows.every(p=>p.verdict!=='OK'));
const malicious=await get('/api/problems/search?q='+encodeURIComponent("' OR true;--"));assert.ok(malicious.count<all.total);
for(const mode of ['warm_up','stretch','fix_weaknesses']){
  const data=await get('/api/recommendations?handle='+handle+'&mode='+mode);
  assert.equal(data.mode,mode);assert.ok(data.problems.length<=5);
  if(!(mode==='stretch'&&profile.profile.rating>=3500))assert.ok(data.problems.length>0);
  for(const p of data.problems){assert.ok(p.rating>=800&&p.rating<=3500);assert.ok(p.score>=0&&p.score<=1);}
}
for(const path of ['/?switch=1','/dashboard?handle='+handle,'/recommendations?handle='+handle,'/problems','/problems/1879/C?handle='+handle,'/admin/sync']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();assert.ok(!html.includes('Something interrupted'),path);
}
const forbidden=await fetch(base+'/api/admin/catalogue',{method:'POST',headers:{Origin:base}});assert.equal(forbidden.status,403);
const crossSite=await fetch(base+'/api/sync',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({handle})});assert.equal(crossSite.status,403);
const select=await fetch(base+'/api/sync',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({handle})});
assert.equal(select.status,200);assert.equal((await select.json()).ready,true);
console.log('Live checks passed: imported profile, pagination, exact search, unsolved filter, parameter handling, three practice modes, six pages, and protected developer actions.');
