# Move Coderise to Fedora

This restores the working Windows project on Fedora, including the imported data. Keep Fedora as the main development environment after the move; dual-boot databases do not synchronize automatically.

## 1. Install the essentials

```bash
sudo dnf install git gh nodejs npm python3 python3-pip postgresql-server postgresql-contrib
node --version
psql --version
```

Use Node.js 22 or newer and PostgreSQL **17 or newer** (the backup was made with 17.6). Check these versions before continuing. If your Fedora release supplies an older PostgreSQL, install a matching newer server/client package first; do not restore into PostgreSQL 16. Package names differ between Fedora releases and PostgreSQL repositories.

For a new PostgreSQL installation only:

```bash
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Skip initialization if a database cluster already exists. Do not reinitialize or remove an existing cluster.

## 2. Clone the project and download the backup

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/ChatreshGudi/Coderise.git
cd Coderise
mkdir -p backups
gh release download fedora-transfer-2026-11-01 --repo ChatreshGudi/Coderise --dir backups
cd backups
sha256sum -c coderise-20261101-123335.dump.sha256
cd ..
```

If GitHub CLI requests login, you can instead download the three backup attachments from [the migration release](https://github.com/ChatreshGudi/Coderise/releases/tag/fedora-transfer-2026-11-01) into `backups/`. The `.dump` is a compressed PostgreSQL archive; do not unzip it.

## 3. Create a local database login

```bash
sudo -u postgres psql
```

Inside psql, for a fresh setup:

```sql
CREATE ROLE coderise LOGIN;
\password coderise
CREATE DATABASE coderise OWNER coderise TEMPLATE template0;
\q
```

Choose a local password at the prompt. If this role or database already exists, inspect it first. Restore into a new empty database, rather than overwriting existing work.

Fedora may default to `ident` for TCP connections. Find the authentication file:

```bash
sudo -u postgres psql -Atc 'SHOW hba_file;'
```

Open the printed file with `sudoedit`. For localhost TCP access, set the existing matching loopback entries to:

```text
host    all    all    127.0.0.1/32    scram-sha-256
host    all    all    ::1/128         scram-sha-256
```

Keep local socket administration unchanged. These rules must precede any earlier rule that would match the same connection. Reload and test:

```bash
sudo systemctl reload postgresql
psql -h 127.0.0.1 -U coderise -d coderise -W -c 'SELECT current_user, current_database();'
```

## 4. Restore the snapshot

```bash
pg_restore --host=127.0.0.1 --username=coderise --dbname=coderise -W \
  --no-owner --no-privileges --exit-on-error --single-transaction \
  backups/coderise-20261101-123335.dump
```

This snapshot already includes the schema, functions, triggers, web views, and imported data. **Do not apply migrations 001, 002, 004, or 005 again for this restore. Do not apply experimental migration 003.** The snapshot contains no pgvector extension or generated embeddings.

Expected counts: 11,620 problems; 9,983 statements; 2,055 contests; 4,003 submissions; 549 rating changes; 3 public Codeforces profiles. Transient sync-job records were deliberately omitted. The manifest records all table counts and the checksum.

## 5. Configure and run the website

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` locally:

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=coderise
PGUSER=coderise
PGPASSWORD=your_local_password
CODERISE_ADMIN_TOKEN=
CODERISE_PYTHON=
```

Then:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-web-worker.txt
npm ci
node scripts/verify-backup.mjs backups/coderise-20261101-123335.dump.json
npm test
npm run build
npm run dev
```

Open **http://127.0.0.1:3000**. The background importer automatically uses `.venv/bin/python`. No administrator token is needed for normal usage. With the site running, a second terminal can run:

```bash
node scripts/check-web.mjs
```

Verify the backup before opening the website: automatic profile refresh can legitimately change the live counts afterward. Catalogue and statement reimports are unnecessary for the initial migration.

## 6. Prepare pgvector and Ollama

The website works without these. Install the extension package for the PostgreSQL server you are actually running; Fedora's default package is commonly available as `pgvector`:

```bash
sudo dnf install pgvector
sudo -u postgres psql -d coderise -c "SELECT name, default_version FROM pg_available_extensions WHERE name='vector';"
```

If that query returns `vector`, enable it as the database administrator:

```bash
sudo -u postgres psql -d coderise -c 'CREATE EXTENSION IF NOT EXISTS vector;'
sudo -u postgres psql -d coderise -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

If it returns no rows, the installed extension does not match your server or is unavailable for that Fedora release. Check `psql --version`, the running server version, and `dnf list --available '*pgvector*'` before choosing the matching package. Do not switch database versions or apply draft SQL to work around this.

Ollama is already installed on this laptop's Fedora system. Inspect it before downloading models:

```bash
cat /etc/fedora-release
free -h
df -h ~
ollama --version
ollama list
```

Share those results in the new development chat. We have not selected the final extraction model or installed additional model weights. Start with a small reviewed technique-extraction batch; see [the handoff](HANDOFF.md). ML dependencies in `requirements.txt` and `requirements-statements.txt` are optional and can consume substantial disk space; install them when that experiment begins, ideally using a Python version supported by the chosen model libraries.

## Continue in a new chat

Open `~/Projects/Coderise` and say:

> Read docs/HANDOFF.md and docs/FEDORA.md. We are moving Coderise from Windows to Fedora. Help verify the database restore and local website, then continue the small Ollama technique-extraction experiment. Keep the agreed feature scope and do not apply archived vector drafts.

This file provides continuity even if the Windows-local chat does not appear on Fedora. Do not copy your entire `.codex` directory or credentials into the repository.

## Backup maintenance

The public release contains public Codeforces project data and attributed statement text, not PostgreSQL roles/passwords, `.env`, or sync logs. Keep backups outside Git history. To create another verified snapshot, install npm dependencies and run:

```bash
node scripts/backup-database.mjs
```

On Windows, add `--pg-bin "C:\Program Files\PostgreSQL\17\bin"` if PostgreSQL tools are not on PATH. The script needs a login with permission to create and drop its own temporary verification database. It exports a consistent snapshot, inspects the schema, restores it into that temporary database, compares table counts, and writes `.dump`, `.dump.json`, and `.dump.sha256` files under ignored `backups/`. It refuses unfamiliar tables/credential columns; review future data changes before publishing snapshots.

References: [Fedora PostgreSQL packaging/setup](https://developer.fedoraproject.org/tech/database/postgresql/about.html), [Fedora pgvector packages](https://packages.fedoraproject.org/pkgs/postgresql18-pgvector/pgvector/), [PostgreSQL portable custom archives](https://www.postgresql.org/docs/17/app-pgdump.html).
