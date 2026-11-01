# Coderise web workspace

The Next.js app follows the supplied Stitch screenshots as visual inspiration. It implements handle-only access, the Dashboard, Recommendations, Problems, problem details, and a separate protected developer sync console. There are no learner accounts, bookmarks, notes, or practice queues.

## Run locally

Use Node.js 20.9+ (Node 22 recommended). Keep the existing local PostgreSQL settings in the ignored `.env` file. The application and Python importers share PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD.

From the Coderise directory:

```text
npm install
npm run db:web
npm run dev
```

Open http://127.0.0.1:3000. Migration 005 is additive and can be applied after schema 001 and migration 002; migration 004 supplies the statement table. The web app does not require an experimental vector migration or an embedding model download. Existing catalogue and statement data are preserved.

For a fresh database, apply 001, 002, and 004, configure `.env`, install the Python dependencies, and run the existing catalogue/statement importers. Then run `npm run db:web`. See `statement_import.md` for statement-import instructions.

The virtual environment at `.venv` must contain the importer dependencies. The web worker automatically uses `.venv/Scripts/python.exe` on Windows or `.venv/bin/python` on other systems. Set CODERISE_PYTHON to an absolute Python executable path if needed. The application starts a local background Python process for each import and stores job status in PostgreSQL. Run it as a long-lived local Node server; this worker mechanism is not a serverless deployment architecture.

For the web import worker alone, `py -m pip install -r requirements-web-worker.txt` installs only PostgreSQL and dotenv dependencies. Model libraries are not needed to run the site. Activate the existing virtual environment before running that command.

## Public handle access

Entering a previously imported handle opens its dashboard immediately. New handles are imported through the public Codeforces API; any handle can be viewed. An HTTP-only preference cookie remembers the selected handle. It is not authentication and grants no privileged access.

Refresh imports up to 2,000 recent submissions plus rating history. Statistics are labelled as imported history. Pending verdicts can transition to final verdicts through the existing database trigger. Website import jobs share a database advisory lock, avoiding overlapping public API traffic. Refreshes are limited to one request per handle per minute. Failed/abandoned jobs appear as failures rather than an endless loading state.

While a profile page is visible, the header checks for a profile refresh every two minutes. It avoids overlapping jobs and leaves existing data readable. Closing the site stops active-page polling; this is not an unattended recurring scheduler.

## Implemented data endpoints

- `GET /api/problems/search?q=&min=&max=&tag=&status=unsolved&sort=&page=&handle=`
- `GET /api/problems/[contest]/[index]?handle=`
- `GET /api/profiles/[handle]`
- `GET /api/recommendations?handle=&mode=warm_up|stretch|fix_weaknesses`
- `POST /api/sync` with JSON `{ "handle": "Chatresh", "refresh": true }`
- `GET /api/sync/[job-id]`

All SQL input is parameterized; sorting and modes use allowlists. Browser POST requests require a matching Origin. The statement renderer supports Markdown/LaTeX without enabling raw HTML or trusted KaTeX commands. Source images are linked rather than fetched automatically.

## Current practice strategy

The website uses `recommend_practice`, an explicit initial difficulty/topic/popularity baseline. It excludes accepted problems, supports the three modes, and disables weakness weighting below 20 judged submissions. It does not claim semantic matching, calibrated solve probabilities, Elo gains, predicted solve times, or test-level diagnoses. The experimental embedding research remains separate. Similar problems on detail pages are labelled as shared-topic/nearby-rating matches.

## Developer console

Set CODERISE_ADMIN_TOKEN to a long random value in the server environment, restart Next.js, and open `/admin/sync`. The console is disabled if that setting is absent. This is separate developer access, not a learner registration system. Do not put the token in a URL or commit it. The session cookie is HTTP-only, SameSite Strict, expires after one hour, and is Secure in production. Catalogue actions require developer access and an Origin check. The console shows real job logs and statement coverage. Statement and model imports remain explicit scripts.

## Checks

```text
npm test
npm run typecheck
npm run build
```

The UI uses local Geist and JetBrains Mono font packages, not a runtime font CDN. No imported statements, public profile snapshots, credentials, or model files are bundled into the client.
