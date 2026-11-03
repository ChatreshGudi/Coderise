import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { Client } = require('pg');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const directory = resolve(option('--output', 'backups'));
const pgBin = option('--pg-bin', '');
// Optional separate local PostgreSQL instance for restore verification.
// This avoids granting CREATEDB to the application role.
const verificationUrl = option('--verify-url', '');
const stem = `coderise-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-')}`;
const dump = join(directory, `${stem}.dump`);
const config = { host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE || 'coderise', user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD };
const env = { ...process.env, PGHOST: config.host, PGPORT: String(config.port), PGDATABASE: config.database, PGUSER: config.user };
const allowed = new Set(['app_user', 'contest', 'problem', 'tag', 'problem_tag', 'submission', 'rating_change', 'user_tag_stat', 'recommendation', 'tag_prerequisite', 'problem_embedding', 'problem_statement', 'sync_job', 'problem_editorial', 'retrieval_embedding']);
const privateTables = new Set(['site_account','auth_session','auth_throttle','problem_list','problem_list_item']);
for (const name of privateTables) allowed.add(name);
const excludedTables = new Set(['sync_job', ...privateTables]);
const quote = name => `"${name.replaceAll('"', '""')}"`;
function run(command, parameters) {
  return new Promise((ok, fail) => {
    const executable = pgBin ? join(pgBin, command + (process.platform === 'win32' ? '.exe' : '')) : command;
    const child = spawn(executable, parameters, { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', fail);
    child.on('close', code => code === 0 ? ok() : fail(new Error(`${command} failed: ${error}`)));
  });
}
const source = new Client(config);
const verifier = verificationUrl ? new Client({ connectionString: verificationUrl }) : source;
let temporaryDatabase;
try {
  await mkdir(directory, { recursive: true });
  await source.connect();
  if (verifier !== source) await verifier.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables = (await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
  if (tables.some(name => !allowed.has(name))) throw new Error('Unexpected database tables: review the backup allowlist before publishing.');
  const suspicious = await source.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND NOT (table_name=ANY($1::text[])) AND column_name ~* '(password|secret|token|email|session)' ", [[...privateTables]]);
  if (suspicious.rows.length) throw new Error('Potentially sensitive columns require manual review before publishing.');
  const counts = {};
  for (const table of tables) counts[table] = excludedTables.has(table) ? 0 : Number((await source.query(`SELECT count(*) FROM public.${quote(table)}`)).rows[0].count);
  const snapshot = (await source.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  const serverVersion = (await source.query('SHOW server_version')).rows[0].server_version;
  await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--no-tablespaces', ...[...excludedTables].map(name => `--exclude-table-data=public.${name}`), `--snapshot=${snapshot}`, `--file=${dump}`]);
  await source.query('COMMIT');
  const inspection = `${dump}.inspection.sql`;
  try {
    await run('pg_restore', ['--no-owner', '--no-privileges', `--file=${inspection}`, dump]);
    const text = await readFile(inspection, 'utf8');
    // Imported statements can coincidentally contain a short database password as ordinary text.
    // Audit schema/configuration separately; the allowlisted tables contain only public project data.
    const schemaText = text.replace(/^COPY[\s\S]*?^\\\.\r?$/gm, '');
    if (process.env.PGPASSWORD && schemaText.includes(process.env.PGPASSWORD)) throw new Error('A configured password appears in the schema. Review before publishing.');
    if (process.env.CODERISE_ADMIN_TOKEN && text.includes(process.env.CODERISE_ADMIN_TOKEN)) throw new Error('A configured admin token appears in the dump. Do not publish this backup.');
  } finally { await unlink(inspection).catch(() => {}); }
  temporaryDatabase = `coderise_restore_check_${Date.now()}`;
  await verifier.query(`CREATE DATABASE ${quote(temporaryDatabase)} TEMPLATE template0`);
  let restoreTarget = temporaryDatabase;
  if (verificationUrl) {
    const target = new URL(verificationUrl);
    target.pathname = `/${temporaryDatabase}`;
    restoreTarget = target.toString();
  }
  await run('pg_restore', ['--exit-on-error', '--no-owner', '--no-privileges', `--dbname=${restoreTarget}`, dump]);
  const restored = new Client(verificationUrl ? { connectionString: restoreTarget } : { ...config, database: temporaryDatabase });
  try {
    await restored.connect();
    for (const [table, count] of Object.entries(counts)) {
      const actual = Number((await restored.query(`SELECT count(*) FROM public.${quote(table)}`)).rows[0].count);
      if (actual !== count) throw new Error(`Restore count mismatch for ${table}.`);
    }
  } finally { await restored.end(); }
  const bytes = await readFile(dump);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const manifest = { file: basename(dump), created_at: new Date().toISOString(), server_version: serverVersion, bytes: bytes.length, sha256, format: 'PostgreSQL custom archive', excluded_data: [...excludedTables].map(name => `public.${name}`), credentials_included: false, restore_verified: true, counts };
  await writeFile(`${dump}.json`, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(`${dump}.sha256`, `${sha256}  ${basename(dump)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
} catch (error) {
  console.error('Backup failed:', error.message);
  process.exitCode = 1;
} finally {
  if (temporaryDatabase) await verifier.query(`DROP DATABASE ${quote(temporaryDatabase)}`).catch(error => { console.error('Temporary restore database cleanup failed:', error.message); process.exitCode = 1; });
  if (verifier !== source) await verifier.end();
  await source.end();
}
