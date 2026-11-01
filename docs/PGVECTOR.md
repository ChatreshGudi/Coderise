# Vector recommendations and course demo

Coderise uses **PostgreSQL + pgvector** for the vector database requirement.
The current Windows database has 6,111 editorial and 9,983 statement embeddings,
all `vector(384)`. These are the existing pinned MiniLM embeddings; this migration
does not download a model, regenerate vectors, or run Ollama.

## Set up

1. Install pgvector for the **same PostgreSQL major version and architecture** as
   your server. The Windows transfer uses PostgreSQL 18. The extension files must
   be installed on the server, not in pgAdmin or the Python virtual environment.
2. Configure the normal PostgreSQL credentials in ignored `.env`.
3. For a fresh schema, apply 001, 002 and 004, import the catalogue, then run
   `npm run db:web` (005) and `npm run db:retrieval` (006). The Windows transfer
   snapshot already contains these migrations; skip this step when restoring it.
4. Run `npm run db:pgvector` (007). This converts existing arrays without changing
   their values, creates cosine indexes, and installs the retrieval functions.
   The migration is transactional and can be rerun. Do not run archived 003.
5. Restore a cache-bearing backup, or import sources and encode missing text using
   [retrieval.md](retrieval.md). The current local database already has the cache.
6. Set `CODERISE_SEMANTIC_RECOMMENDATIONS=1` in `.env`, then restart the website.
   `0` selects the baseline for comparisons.

A backup made **after 007** requires the pgvector server package before restore.
A pre-007 backup can be restored first, then converted with step 4. Back up before
converting; `node scripts/backup-database.mjs` creates a restore-verified dump.

### Windows installation used here

The portable PostgreSQL 18 runtime is at
`%LOCALAPPDATA%\Coderise\PostgreSQL18\pgsql`. pgvector v0.8.7 was built from its
[official source](https://github.com/pgvector/pgvector/tree/v0.8.7) using the Visual
Studio x64 C++ tools, PostgreSQL 18 development headers and `lib\postgres.lib`.
In an **x64 Native Tools Command Prompt**:

```bat
set "PGROOT=C:\path\to\PostgreSQL18\pgsql"
git clone --branch v0.8.7 --depth 1 https://github.com/pgvector/pgvector.git
cd pgvector
nmake /F Makefile.win
nmake /F Makefile.win install
```

Use your actual PostgreSQL directory. For a protected installation directory,
the install step may need administrator access. On Fedora, install/build the
extension against that machine's PostgreSQL development package; the database
SQL and application commands are the same. Do not copy a Windows DLL to Linux.

The local portable server uses `127.0.0.1:5433`, database `coderise_windows`.
Start it after reboot with `node backups/windows-runtime/start-db.mjs`, then
start the website normally. The older PostgreSQL 17 server remains separate.

## What happens for a recommendation

1. SQL selects up to 500 eligible problems by rating, unsolved status and baseline
   signals. The vector adjustment cannot admit a problem outside this shortlist.
2. `retrieval_references` chooses up to 30 recent compatible references **per
   channel**, after checking source freshness, model/revision/recipe and duplicate
   hashes. Practice mode controls whether solved or unsuccessful history is used.
3. `retrieval_similarities` computes exact cosine similarity using pgvector's
   `<=>` operator. It averages the three nearest references, preferring editorial
   evidence and using statement evidence when editorial evidence is unavailable.
4. The app uses centered within-channel ranks for a bounded adjustment: up to
   ±0.08 for editorials or ±0.025 for statements. Only scalar evidence leaves
   PostgreSQL. Missing evidence keeps the baseline score.

Partial HNSW cosine indexes are installed for catalogue similarity searches.
The bounded recommendation query deliberately computes exact distances; an
index existing does not mean every query uses approximate search.

## Demo in pgAdmin

Connect to the configured database, open Query Tool, and open
`db/demo/vector_queries.sql`. Run its numbered sections to show:

- extension version, native vector type, 384 dimensions and counts;
- nearest problems by solution-explanation cosine similarity;
- compatible history references for each profile;
- per-candidate similarity and reference counts used by the application.

Open `/recommendations?handle=Petr` or `?handle=tourist` in the website. Its note
shows **VECTOR-ASSISTED**. `/api/recommendations?handle=Petr` reports
`strategy: "pgvector_hybrid"`. Chatresh currently has no compatible text vectors
for the two imported solves, so its baseline fallback is expected.

## Verify

```text
npm test
node scripts/check-pgvector.mjs
node --conditions=react-server --import tsx scripts/check-recommendations.ts
```

The database fixture tests roll back all changes. They cover compatible references
before the history cutoff, duplicate/stale/wrong-model/held-out exclusions, cosine
values, missing-text fallback and practice-mode preferences. The application check
tests all nine restored profile/mode combinations and writes ignored comparison
reports. An independent NumPy audit can then be run with
`.venv\Scripts\python.exe scripts\audit_recommendations.py` on Windows.

Local warm-cache recommendation timings were 22–279 ms across the nine cases;
these are development measurements, not a deployment guarantee. Similarity is
not solve probability or proof of technique equivalence. Better relevance still
needs independent labels; the earlier MiniLM quality limitations remain.
