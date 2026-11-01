import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
const base=process.env.CODERISE_TEST_URL||'http://127.0.0.1:3000',handle=process.argv[2];
if(!handle)throw new Error('Usage: node scripts/check-import.mjs PUBLIC_CODEFORCES_HANDLE');
const response=await fetch(base+'/api/sync',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({handle})});
const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
if(!data.ready){
  let finished=false;
  for(let attempt=0;attempt<60;attempt++){
    const status=await (await fetch(base+'/api/sync/'+data.job.job_id)).json();
    console.log(status.status,status.stage);
    if(status.status==='failed')throw new Error(status.error_message);
    if(status.status==='completed'){finished=true;break;}
    await setTimeout(2000);
  }
  assert.ok(finished,'Profile import did not finish within two minutes.');
}
const profileResponse=await fetch(base+'/api/profiles/'+encodeURIComponent(handle));
assert.equal(profileResponse.status,200);const profile=await profileResponse.json();
assert.ok(profile.profile.submission_count>0);assert.ok(profile.profile.solved_count<=profile.profile.attempted_count);
console.log('Public handle is imported and its dashboard statistics are available.');
