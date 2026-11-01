import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/verify-backup.mjs backups/SNAPSHOT.dump.json');
const manifest = JSON.parse(await readFile(filename, 'utf8'));
const client = new Client({ host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE || 'coderise', user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD });
try {
  await client.connect();
  for (const [table, expected] of Object.entries(manifest.counts)) {
    const quoted = '"' + table.replaceAll('"', '""') + '"';
    const actual = Number((await client.query(`SELECT count(*) FROM public.${quoted}`)).rows[0].count);
    if (actual !== expected) throw new Error(`${table}: expected ${expected}, found ${actual}. Verify before starting live imports.`);
    console.log(`${table}: ${actual} OK`);
  }
  console.log('All restored table counts match the snapshot manifest.');
} finally { await client.end(); }
