import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const {Client}=require('pg');
const client=new Client({host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'coderise',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD});
try{await client.connect();await client.query(await readFile('db/migrations/008_accounts_lists.sql','utf8'));console.log('Migration 008 applied: site accounts, revocable sessions and private problem lists.');}
catch(error){console.error('Account migration failed.',{code:error.code??'internal'});process.exitCode=1;}
finally{await client.end();}
