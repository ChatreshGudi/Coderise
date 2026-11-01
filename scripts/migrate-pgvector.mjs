import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const client = new Client({ host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE || 'coderise', user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD });
try {
  await client.connect();
  await client.query(await readFile('db/migrations/007_pgvector_retrieval.sql', 'utf8'));
  console.log('Migration 007 applied: vector(384) storage, cosine indexes and database retrieval.');
  console.log((await client.query('SELECT source_kind,count(*) AS vectors FROM retrieval_embedding GROUP BY source_kind ORDER BY source_kind')).rows);
} catch (error) { console.error('pgvector migration failed:', error.message); process.exitCode = 1; }
finally { await client.end(); }
