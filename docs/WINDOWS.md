# Return to Windows — 1 November 2026

## Accounts and private lists update

After updating code or restoring an older transfer snapshot, run `npm ci` and `npm run db:accounts`. Set `CODERISE_ORIGIN` to the exact browser origin (for local use, `http://127.0.0.1:3000`). Accounts/profile/private lists and administrator setup are documented in [ACCOUNTS_LISTS.md](ACCOUNTS_LISTS.md). Shared developer-token access is retired. Shareable backups exclude all account/session/private-list rows. Earlier historical account/token descriptions below are superseded by this update.


The Fedora work, editorials and cached embeddings are preserved in the
[Windows transfer release](https://github.com/ChatreshGudi/Coderise/releases/tag/windows-transfer-2026-11-01).
Use this release rather than the older Fedora transfer snapshot.

## What is preserved

- Code and schema through migration 006, including the experimental retrieval path.
- PostgreSQL 18.6 snapshot `coderise-20261101-162508.dump`: 11,620 problems,
  9,983 statements, 6,155 editorials (6,111 ready), 16,094 cached vectors,
  4,003 submissions and three profiles. The manifest lists every table count.
- Public research artifacts in `coderise-research-20261101.zip`: recommendation
  comparisons, source inspections, coverage reports, import cache and stopped
  technique-pilot outputs. Extracting this restores the ignored `reports/` tree.
- SHA-256 checksums and a backup manifest. The backup was restored into an
  isolated PostgreSQL 18 instance and every table count matched.

The snapshot includes schema, functions, views, triggers and vectors. No need to
apply migrations, import statements/editorials or regenerate embeddings after
restoring. No pgvector or Ollama installation is required to run the website.

Passwords, PostgreSQL roles, `.env`, Python/Node installations, virtualenvs and
model weights are not transferred. Transient sync-job rows are excluded. Linux
and Windows databases remain independent after the move.

## 1. Prepare Windows

Use Node.js 22, Git, Python 3.10+ and **PostgreSQL 18** with pgAdmin/client tools.
The new snapshot was made with PostgreSQL 18.6; use PostgreSQL 18 to restore it.
The old Windows PostgreSQL 17 database can remain installed and untouched.

If 17 already uses port 5432, install/run 18 on **5433**. The commands below assume
18 is on 5433; change `$PgPort` if you chose another port. Confirm pgAdmin's server
connection uses that same port. The installer creates its own `postgres` account;
use that Windows installation's password, not the Fedora password.

## 2. Get code and release files

Use a **new checkout** to preserve any uncommitted work in the old Windows folder.
Run these blocks from one PowerShell session. Start in the parent directory where
you want the project:

```powershell
git clone https://github.com/ChatreshGudi/Coderise.git Coderise-Windows-Transfer
Set-Location Coderise-Windows-Transfer
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$PgPort = 5433
$Snapshot = 'coderise-20261101-162508.dump'
$Release = 'https://github.com/ChatreshGudi/Coderise/releases/download/windows-transfer-2026-11-01'
New-Item -ItemType Directory -Force backups | Out-Null
foreach ($Name in @($Snapshot, "$Snapshot.json", "$Snapshot.sha256", 'coderise-research-20261101.zip', 'SHA256SUMS.txt')) {
    Invoke-WebRequest "$Release/$Name" -OutFile "backups/$Name"
}
```

Check both the dump and research archive before restoring:

```powershell
foreach ($Line in Get-Content backups/SHA256SUMS.txt) {
    $Expected, $Name = $Line -split '\s+', 2
    $Actual = (Get-FileHash "backups/$Name" -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -ne $Expected) { throw "Checksum mismatch: $Name" }
    Write-Host "$Name OK"
}
Expand-Archive backups/coderise-research-20261101.zip -DestinationPath .
```

## 3. Restore into a new database

Keep the website stopped until count verification finishes. This creates a new
database, **`coderise_windows`**, leaving the existing `coderise` database intact.
If that new name already exists, choose another unused name consistently rather
than restoring over an existing database.

```powershell
& "$PgBin\psql.exe" --version
& "$PgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U postgres -d postgres -W -c 'SHOW server_version;'
& "$PgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U postgres -d postgres -W -c 'CREATE DATABASE coderise_windows OWNER postgres TEMPLATE template0;'
if ($LASTEXITCODE -ne 0) { throw 'Database creation failed; stop here.' }
& "$PgBin\pg_restore.exe" --host=127.0.0.1 --port=$PgPort --username=postgres --dbname=coderise_windows --password --no-owner --no-privileges --exit-on-error --single-transaction "backups/$Snapshot"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; stop here.' }
```

The password prompts use the Windows PostgreSQL 18 `postgres` password. Do not
reapply migrations 001–006 or archived migration 003 to the restored database.

## 4. Configure local dependencies and verify counts

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; stop here.' }
py -3 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements-web-worker.txt
Copy-Item .env.example .env
notepad .env
```

Set these values in `.env` (replace the password placeholder):

```dotenv
PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=coderise_windows
PGUSER=postgres
PGPASSWORD=your_windows_postgres_18_password
CODERISE_PYTHON=
CODERISE_ADMIN_TOKEN=
CODERISE_SEMANTIC_RECOMMENDATIONS=0
```

Use your actual port. The blank Python setting automatically selects
`.venv\Scripts\python.exe`; never copy a Fedora `/home/...` path into it.

```powershell
node scripts/verify-backup.mjs "backups/$Snapshot.json"
if ($LASTEXITCODE -ne 0) { throw 'Table counts differ; stop before starting the website.' }
npm run dev
```

Open <http://127.0.0.1:3000>. In pgAdmin, connect to the PostgreSQL **18** server at
`127.0.0.1:5433` and open `coderise_windows`. The tables `problem_editorial` and
`retrieval_embedding`, plus the `retrieval_coverage` view, contain the new work.
Subsequent profile refreshes can legitimately change submission/table counts.

## 5. Enable the vector database integration

After restoring and verifying the transfer snapshot, follow
[PGVECTOR.md](PGVECTOR.md): install the PostgreSQL 18 pgvector package, run
`npm run db:pgvector`, set `CODERISE_SEMANTIC_RECOMMENDATIONS=1`, and restart the
website. The local Windows setup has completed these steps. The transfer snapshot
predates migration 007, so it still needs that conversion on another machine.

## 6. Continue development

Read [HANDOFF.md](HANDOFF.md), [retrieval.md](retrieval.md), and the
[relevance review](recommendation_quality_review.md). Compatible-reference selection
and pgvector integration are now implemented in migration 007. A labelled relevance
evaluation is still useful before tuning the encoder or weights. Do not resume
the stopped Ollama experiment.

The cached vectors work directly from PostgreSQL; model weights are unnecessary
for application ranking. Only if changing/rebuilding sources later, install:

```powershell
& .\.venv\Scripts\python.exe -m pip install -r requirements-retrieval.txt
```

The encoder downloads its pinned CPU model when it is next needed. Reports are
diagnostics, not an independently labelled benchmark. No Windows execution was
performed on Fedora; verification here covered the PostgreSQL archive restore.

Suggested continuation prompt:

> Read docs/HANDOFF.md, docs/WINDOWS.md and docs/recommendation_quality_review.md.
> We returned from Fedora with the Windows transfer release and a PostgreSQL 18
> database. Read docs/PGVECTOR.md for the subsequent native-vector migration and
> compatible-reference fix. Vector ranking is enabled locally with a baseline
> fallback. Do not resume Ollama generation or claim validated recommendation quality.
