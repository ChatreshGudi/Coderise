import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { Client }=require('pg');
const client=new Client({host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'coderise',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD,connectionTimeoutMillis:5000});
try {
  await client.connect();
  await client.query(await readFile('db/migrations/006_coverage_retrieval.sql','utf8'));
  console.log('Coverage retrieval migration 006 applied.');
} catch(error) {
  console.error('Retrieval migration failed:',error.message);process.exitCode=1;
} finally { await client.end(); }
