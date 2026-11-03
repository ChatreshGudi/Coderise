// Creates synthetic accounts, tests API isolation, and removes only those accounts in finally.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,createHash} from 'node:crypto';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd());const {Client}=require('pg');
const base=process.env.CODERISE_TEST_ORIGIN||'http://127.0.0.1:3000',run=randomBytes(6).toString('hex');
const names=[`check_a_${run}`,`check_b_${run}`],password='Synthetic test only '+randomBytes(20).toString('hex'),nextPassword=password+' changed';
const client=new Client({host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'coderise',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD});
const digest=v=>createHash('sha256').update(v).digest('hex');
let checks=0;
async function request(path,{method='GET',body,cookie,origin=base}={}){
 const response=await fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:response.status,data,headers:response.headers,cookie:response.headers.getSetCookie().find(v=>v.includes('coderise_session='))?.split(';')[0]};
}
function status(result,expected){assert.equal(result.status,expected,`Expected HTTP ${expected}, got ${result.status}`);checks++;return result;}
try{
 await client.connect();
 status(await request('/api/lists'),401);status(await request('/api/auth/me'),401);
 status(await request('/api/auth/register',{method:'POST',body:{username:names[0],password,preferred_cf_handle:'bad handle!'}}),400);
 for(const name of names){const r=status(await request('/api/auth/register',{method:'POST',body:{username:name,password,role:'admin',...(name===names[0]?{preferred_cf_handle:' Chatresh '}:{})}}),201);assert.ok(r.cookie);}
 const a=status(await request('/api/auth/login',{method:'POST',body:{username:names[0],password}}),200),b=status(await request('/api/auth/login',{method:'POST',body:{username:names[1],password}}),200);
 const second=status(await request('/api/auth/login',{method:'POST',body:{username:names[0],password}}),200);
 assert.match(a.headers.get('set-cookie'),/HttpOnly/i);assert.match(a.headers.get('set-cookie'),/SameSite=Lax/i);
 const me=status(await request('/api/auth/me',{cookie:a.cookie}),200);assert.equal(me.data.account.role,'user');assert.equal('password_hash' in me.data.account,false);assert.match(me.headers.get('cache-control'),/no-store/);
 assert.equal(me.data.account.preferred_cf_handle,'Chatresh');
 const accountId=me.data.account.account_id;
 const stored=(await client.query('SELECT password_hash FROM site_account WHERE account_id=$1',[accountId])).rows[0];assert.match(stored.password_hash,/^\$argon2id\$/);assert.ok(!stored.password_hash.includes(password));
 const rawToken=a.cookie.split('=')[1],session=(await client.query('SELECT token_hash FROM auth_session WHERE token_hash=$1',[digest(rawToken)])).rows[0];assert.equal(session.token_hash,digest(rawToken));assert.notEqual(session.token_hash,rawToken);
 status(await request('/api/lists',{method:'POST',cookie:a.cookie,origin:'https://foreign.example',body:{name:'Rejected'}}),403);
 status(await request('/api/lists',{method:'POST',cookie:a.cookie,body:{name:'x',description:'x'.repeat(17000)}}),413);
 const problem=(await client.query("SELECT p.problem_id,u.cf_handle FROM submission s JOIN problem p USING(problem_id) JOIN app_user u USING(user_id) WHERE s.verdict='OK' ORDER BY s.submission_id LIMIT 1")).rows[0];assert.ok(problem,'Import a public profile before running this check.');
 const created=status(await request('/api/lists',{method:'POST',cookie:a.cookie,body:{name:'Synthetic private list',description:'Isolation check'}}),201),listId=created.data.list.list_id;
 status(await request(`/api/lists/${listId}`,{cookie:b.cookie}),404);
 status(await request(`/api/lists/${listId}`,{method:'PATCH',cookie:b.cookie,body:{name:'stolen'}}),404);
 status(await request(`/api/lists/${listId}`,{method:'DELETE',cookie:b.cookie,body:{}}),404);
 status(await request(`/api/lists/${listId}/items`,{method:'POST',cookie:b.cookie,body:{problem_id:problem.problem_id}}),404);
 assert.equal(status(await request('/api/lists',{cookie:b.cookie}),200).data.lists.length,0);
 for(let i=0;i<2;i++)status(await request(`/api/lists/${listId}/items`,{method:'POST',cookie:a.cookie,body:{problem_id:problem.problem_id}}),200);
 status(await request(`/api/lists/${listId}/items`,{method:'POST',cookie:a.cookie,body:{problem_id:999999999999}}),404);
 assert.equal(status(await request(`/api/lists/${listId}`,{cookie:a.cookie}),200).data.rows.length,1);
 status(await request('/api/account',{method:'PATCH',cookie:a.cookie,body:{display_name:'Course Tester',preferred_cf_handle:problem.cf_handle,account_id:me.data.account.account_id+1,role:'admin'}}),200);
 const own=status(await request(`/api/lists/${listId}?status=solved`,{cookie:a.cookie}),200);assert.equal(own.data.count,1);assert.equal(own.data.rows[0].solved,true);
 assert.equal(status(await request('/api/auth/me',{cookie:a.cookie}),200).data.account.role,'user');
 status(await request('/api/admin/access',{method:'POST',body:{token:'legacy'}}),410);
 status(await request('/api/admin/catalogue',{method:'POST',cookie:a.cookie,body:{}}),403);
 await client.query("UPDATE site_account SET role='admin' WHERE account_id=$1",[accountId]);
 assert.equal(status(await request('/api/auth/me',{cookie:a.cookie}),200).data.account.role,'admin');
 const adminPage=status(await request('/admin/sync',{cookie:a.cookie}),200);assert.ok(adminPage.data.includes('The job log'));
 await client.query("UPDATE site_account SET role='user' WHERE account_id=$1",[accountId]);
 status(await request('/api/admin/catalogue',{method:'POST',cookie:a.cookie,body:{}}),403);
 status(await request('/api/account/password',{method:'POST',cookie:a.cookie,body:{current_password:'wrong',new_password:nextPassword}}),401);
 const changed=status(await request('/api/account/password',{method:'POST',cookie:a.cookie,body:{current_password:password,new_password:nextPassword}}),200);
 status(await request('/api/auth/me',{cookie:a.cookie}),401);status(await request('/api/auth/me',{cookie:second.cookie}),401);status(await request('/api/auth/me',{cookie:changed.cookie}),200);
 status(await request('/api/auth/login',{method:'POST',body:{username:names[0],password}}),401);
 const fresh=status(await request('/api/auth/login',{method:'POST',body:{username:names[0],password:nextPassword}}),200);
 await client.query("UPDATE auth_session SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE token_hash=$1",[digest(fresh.cookie.split('=')[1])]);
 status(await request('/api/auth/me',{cookie:fresh.cookie}),401);
 status(await request('/api/auth/logout',{method:'POST',cookie:b.cookie,body:{}}),200);status(await request('/api/auth/me',{cookie:b.cookie}),401);
 status(await request('/api/account',{method:'DELETE',cookie:changed.cookie,body:{current_password:'wrong'}}),401);
 status(await request('/api/account',{method:'DELETE',cookie:changed.cookie,body:{current_password:nextPassword}}),200);status(await request('/api/auth/me',{cookie:changed.cookie}),401);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM problem_list WHERE list_id=$1',[listId])).rows[0].n,0);
 const missing='missing_'+run;for(let i=0;i<8;i++)status(await request('/api/auth/login',{method:'POST',body:{username:missing,password}}),401);
 status(await request('/api/auth/login',{method:'POST',body:{username:missing,password}}),429);
 console.log(`Passed ${checks} account/list API assertions plus hash storage, private ownership, role, expiry and cascade checks.`);
}finally{
 await client.query('DELETE FROM site_account WHERE username=ANY($1::text[])',[names]).catch(()=>{});
 const keys=[...names,'missing_'+run].map(v=>digest('auth:username:'+v));await client.query('DELETE FROM auth_throttle WHERE key_hash=ANY($1::text[])',[keys]).catch(()=>{});
 await client.end();
}
