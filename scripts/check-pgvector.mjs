// Live regression checks. All synthetic rows are rolled back.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { Client }=require('pg');
const config=JSON.parse(await readFile('config/retrieval.json','utf8'));
const client=new Client({host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD});
const hash=text=>createHash('sha256').update(text).digest('hex');
const vector=(x,y)=>JSON.stringify([x,y,...Array(382).fill(0)]);
try {
 await client.connect();
 assert.ok((await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rowCount);
 assert.equal((await client.query("SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='retrieval_embedding'::regclass AND attname='embedding'")).rows[0].type,'vector(384)');
 const before=Number((await client.query('SELECT count(*) FROM retrieval_embedding')).rows[0].count);
 await client.query('BEGIN');
 const marker=randomBytes(5).toString('hex');
 const base=-Number.parseInt(marker,16)*100;
 const contest=-Number.parseInt(marker.slice(0,6),16);
 const uid=(await client.query('INSERT INTO app_user(cf_handle,rating) VALUES($1,1500) RETURNING user_id',[`pgvector_check_${marker}`])).rows[0].user_id;
 await client.query('INSERT INTO contest(contest_id,name) VALUES($1,$2)',[contest,'Rollback-only pgvector check']);
 for(let i=0;i<40;i++) {
  await client.query('INSERT INTO problem(problem_id,contest_id,problem_index,name,rating) VALUES($1,$2,$3,$4,1500)',[base+i,contest,String(i),`vector fixture ${i}`]);
  if(i<37)await client.query("INSERT INTO submission(submission_id,user_id,problem_id,verdict,submitted_at) VALUES($1,$2,$1,'OK',now()-$3*interval '1 day')",[base+i,uid,i]);
 }
 async function cache(index,kind,x,y,text,options={}) {
  const pid=base+index,contentHash=hash(text),identity=[options.model??config.model,config.revision,config.recipe];
  if(kind==='editorial')await client.query("INSERT INTO problem_editorial(problem_id,body,content_hash,source_url,source_problem_id,source_revision,status) VALUES($1,$2,$3,'fixture',$4,'fixture',$5)",[pid,text,options.stale?hash('changed'):contentHash,String(pid),options.review?'needs_review':'ready']);
  else await client.query("INSERT INTO problem_statement(problem_id,description,content_hash,source_url,source_problem_id,source_revision) VALUES($1,$2,$3,'fixture',$4,'fixture')",[pid,text,contentHash,String(pid)]);
  await client.query('INSERT INTO retrieval_embedding(problem_id,source_kind,model,model_revision,recipe,content_hash,input_hash,embedding,chunk_count) VALUES($1,$2,$3,$4,$5,$6,$6,$7::vector,1)',[pid,kind,...identity,contentHash,vector(x,y)]);
 }
 await cache(31,'editorial',1,0,'older compatible editorial');
 await cache(32,'statement',0,1,'older compatible statement');
 await cache(33,'editorial',1,0,'older compatible editorial'); // duplicate source
 await cache(0,'editorial',0,1,'wrong model',{model:'different-model'});
 await cache(1,'editorial',0,1,'stale source',{stale:true});
 await cache(2,'editorial',0,1,'unreviewed explanation',{review:true});
 await cache(37,'editorial',0.6,0.8,'candidate editorial');
 await cache(38,'statement',0,1,'candidate statement');
 await cache(39,'editorial',1,0,'older compatible editorial'); // same text cannot support itself
 const identity=[config.model,config.revision,config.recipe];
 const refs=(await client.query('SELECT problem_id,source_kind FROM retrieval_references($1,$2,$3,$4,$5,30)',[uid,'stretch',...identity])).rows;
 assert.deepEqual(refs.map(row=>[Number(row.problem_id),row.source_kind]),[[base+31,'editorial'],[base+32,'statement']]);
 const scores=(await client.query('SELECT * FROM retrieval_similarities($1::bigint[],$2,$3,$4,$5,$6,30)',[[base+37,base+38,base+39,base+36],uid,'stretch',...identity])).rows;
 const byId=new Map(scores.map(row=>[Number(row.problem_id),row]));
 assert.ok(Math.abs(byId.get(base+37).semantic_similarity-0.6)<1e-6);
 assert.equal(byId.get(base+37).similarity_source,'editorial');
 assert.equal(byId.get(base+38).similarity_source,'statement');
 assert.ok(Math.abs(byId.get(base+38).semantic_similarity-1)<1e-6);
 assert.equal(byId.get(base+39).semantic_similarity,null);
 assert.equal(byId.get(base+36).semantic_similarity,null);
 assert.ok(scores.every(row=>row.editorial_references===1&&row.statement_references===1));
 // The preferred unsuccessful history remains separate from accepted history.
 await client.query("INSERT INTO submission(submission_id,user_id,problem_id,verdict,submitted_at) VALUES($1,$2,$1,'WRONG_ANSWER',now())",[base+37,uid]);
 const failed=(await client.query('SELECT problem_id FROM retrieval_references($1,$2,$3,$4,$5,30)',[uid,'fix_weaknesses',...identity])).rows;
 assert.deepEqual(failed.map(row=>Number(row.problem_id)),[base+37]);
 await client.query('ROLLBACK');
 assert.equal(Number((await client.query('SELECT count(*) FROM retrieval_embedding')).rows[0].count),before);
 console.log('pgvector checks passed: native vector type, compatible history before cutoff, per-channel references, duplicate/stale/model/review exclusions, SQL cosine, missing-text fallback and mode preferences. Fixtures rolled back.');
} catch(error) { await client.query('ROLLBACK').catch(()=>{}); console.error(error); process.exitCode=1; }
finally { await client.end(); }
