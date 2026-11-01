# Coderise

A Codeforces practice companion built with Next.js and local PostgreSQL. Enter a public handle, inspect imported progress, browse problems, and choose practice suggestions. No registration or ownership verification is required.

## Run the website

Requirements: Node.js 22, PostgreSQL 17 with pgAdmin, and Python 3.10+.

From the project folder in Command Prompt:

```text
copy .env.example .env
notepad .env
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements-web-worker.txt
npm install
```

If `.env` or `.venv` already exists, reuse it. Set PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD to the local PostgreSQL connection. Keep credentials out of Git.

### Fresh database

Create a database named `coderise` in pgAdmin. In its Query Tool, execute:

1. `db/init/001_schema.sql`
2. `db/migrations/002_submission_tag_stats.sql`
3. `db/migrations/004_problem_statements.sql`

Import the catalogue, then add the web views, functions, and job table:

```text
py scripts\import_codeforces_catalog.py
npm run db:web
npm run dev
```

Open http://127.0.0.1:3000 and enter a Codeforces handle. The website imports recent public submissions and rating history. PostgreSQL must stay running.

### Existing database

With the catalogue, migrations 002 and 004, and `.env` already configured:

```text
npm install
npm run db:web
npm run dev
```

The website does not require pgvector, embedding generation, or an LLM. Its current recommendations use the explicit SQL topic/difficulty/popularity baseline. See [web setup and implementation details](docs/WEB.md) and [verification results](docs/WEB_VERIFICATION.md).

## Import statements

```text
py -m pip install -r requirements-statements.txt
py scripts\import_problem_statements.py
```

The importer matches a pinned Open R1 Codeforces dataset snapshot to the catalogue. It stores descriptions, input/output formats, notes, examples, attribution, source IDs, and content hashes. It does not import editorials, solutions, or test cases. Read [statement import documentation](docs/statement_import.md) for source information and coverage reporting.

Statements are optional for browsing: missing statements link to the original Codeforces page. Dataset content and database rows are not included in Git. Generated coverage reports are local and ignored.

## Features

- Public-handle import, switching, manual refresh, and active-page refresh.
- Dashboard with imported solves, rating history, weekly activity, topic statistics, verdicts, and recent submissions.
- Three practice modes: Warm up, Stretch, and Fix weaknesses.
- Problem search, rating/topic filters, imported-unsolved filtering, sorting, and pagination.
- Statement pages with mathematical notation, examples, attempts, and related-topic problems.
- Separate developer sync console, disabled until CODERISE_ADMIN_TOKEN is configured in the server environment.

No bookmarks, learner accounts, private notes, practice queues, editor, or judge are implemented. Users submit on Codeforces. Personal statistics and solved exclusions reflect imported history, currently up to 2,000 recent submissions per handle.

## Checks

```text
npm test
npm run typecheck
npm run build
```

With the app running, `node scripts/check-web.mjs` checks the live API and pages using the imported Chatresh profile. Set CODERISE_TEST_HANDLE to another imported handle if needed. `node scripts/check-import.mjs PUBLIC_HANDLE` exercises import and writes public profile data to the local database.

## Embedding research

[The evaluation report](docs/embedding_evaluation.md) compares MiniLM, MPNet, and a weighted-tag baseline on imported statements. This research is separate from the website's current ranking. To reproduce it, install `requirements.txt` and `requirements-statements.txt`, import the statements, then run `py scripts\evaluate_embeddings.py`. Model weights download on first use. Experiment data and vectors stay under ignored `reports/`.

## Data sources and Git

Use the public [Codeforces API](https://codeforces.com/apiHelp/methods) for profiles and catalogue updates. Statement source: [Open R1 Codeforces dataset](https://huggingface.co/datasets/open-r1/codeforces); retain its attribution and review its dataset card when redistributing content.

Commit source, migrations, lockfiles, and documentation. Do not commit environment credentials, `.venv`, `node_modules`, build output, model files, or database data.
