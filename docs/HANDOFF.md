# Coderise development handoff

Updated 1 November 2026. The user is returning to Windows; follow `docs/WINDOWS.md`.

## Latest update: pgvector required for the course project

Neo4j learning path implementation added on 2 November: see `docs/LEARNING_PATH.md`.
Latest user-directed revision: `/path` is problem-first. Paste a Codeforces ID/link
to build a combined prerequisite map from all mapped tags and receive up to three
distinct unsolved practice problems per topic. `lib/problem-preparation.ts` and
`lib/preparation-rules.ts` implement strict rating/solved/target filters and explicit
800/unrated/unmapped cases. Past solves are collapsed. Topic exploration remains
secondary via `view=topic`; the detail page links directly to preparation. Test with
`scripts/check-problem-preparation.ts`. No solution generation or new model is used.
The subsequent goal-first revision removes the start selector and shortest-route
UI. It adds an interactive graph/list inspector, conservative background review
suggestions, and a derived Neo4j Profile -> SOLVED -> Problem -> HAS_TAG -> Topic
projection refreshed from PostgreSQL on map requests. Recent accepted examples
come from graph traversal. Run `npm run db:graph` to add projection constraints.
It uses a dedicated curated topic graph (19 nodes, 21 explained edges), optional
shortest route, all ancestor branches and live PostgreSQL practice evidence. The
screen is `/path`, with API `/api/path` and idempotent `npm run db:graph`. Redis
is still not implemented. No mastery or study-time prediction is claimed.

This update supersedes the older array-storage/feature-off notes below. Native
pgvector v0.8.7 is installed in the portable PostgreSQL 18 runtime. The active
database is `coderise_windows` at `127.0.0.1:5433`; credentials remain in ignored
`.env`. Migration 007 converts all 16,094 cached embeddings to `vector(384)`, adds
HNSW cosine indexes and SQL similarity functions, and fixes compatible-reference
selection before the per-channel 30-reference cutoff. Production ranking receives
scalar similarities rather than vector arrays. Vector ranking is enabled locally;
no new model generation was needed. Read [PGVECTOR.md](PGVECTOR.md) for setup,
tests, fallback behavior and pgAdmin demo queries. Quality remains uncalibrated.

The baseline and all original eligibility rules remain available. Chatresh has
no compatible references; tourist and Petr use vector-assisted ranking. Do not
resume Ollama generation. Pre-existing untracked 003/generate_embeddings drafts
were not used. No commit/push is implied by this implementation.

## Project and user preferences

- Repository: https://github.com/ChatreshGudi/Coderise (public), main branch.
- Windows source checkout: `C:\Users\Gudic\Desktop\PESU\Subjects\DBMS\Mini project\Coderise`.
- Current target: Windows on the same dual-boot laptop. The latest release is
  `windows-transfer-2026-11-01`; restore its PostgreSQL 18 snapshot into a new
  Windows database, preserving the earlier Windows checkout/database. See
  `docs/WINDOWS.md`. Fedora setup is complete; Ollama generation remains stopped.
- The original design document governs the feature scope. Prefer fewer polished features. Stitch screenshots were inspiration, not authorization for extra features.
- Public Codeforces handle only. No learner accounts, email, roles, login, handle verification, ownership checks, bookmarks, notes, queues, editor, or judge. Anyone can view any public profile.
- Use local PostgreSQL. Do not introduce Docker.
- Keep credentials, dependencies, model weights, generated datasets/vectors, and backups out of source history. The transfer backup is a GitHub release attachment.
- Tell the user about sensible commit checkpoints. Commit/push when requested; do not lose unrelated local work.

## Working application

Next.js 16.4.3, React 19.3.1, TypeScript, Node.js 22; PostgreSQL 17.6 on Windows; Python import workers. Dependencies are locked in package-lock.json. npm ci is the reproducible installation path.

Screens: handle entry, dashboard, recommendations, problems explorer, problem details, and a developer sync console. Normal usage requires no administrator token. The console is disabled unless CODERISE_ADMIN_TOKEN is configured locally.

The UI is ivory/white and ink black with restrained red accents, Geist and JetBrains Mono, square corners, and thin dividers. Accepted results stay green. The latest UI commit is `fbaec8c` (practice controls, previews, interactive charts).

Implemented polish:

- Accessible styled Sort select; topic checkbox menu and removable chips. Multiple topics match **all** selections. Repeated `tag` query parameters survive filters, pagination, and details/back navigation.
- Plain page-number links with brackets around the current page; five nearby pages plus boundaries and a direct page jump. Compact mobile pagination.
- Shared square red checkboxes and number fields with custom chevrons. Rating steps are 100, page steps are 1.
- Show topics is one checkbox for the recommendation list, hidden initially. It persists when switching Warm up / Stretch / Fix weaknesses; do not reintroduce a mode-based component key that resets it.
- Two-line opening statement excerpts, including mathematical notation, on recommendations and the dashboard. Missing statements are labelled; text is not invented.
- Rating chart uses pointer position and keyboard Left/Right/Home/End. Selected contest, rating, and date appear in a **reserved area above** the graph, not a floating overlay. Weekly bars and topic acceptance bars turn red on hover/focus. Submission ratings are highlighted red.
- Native arrow, hand, and I-beam pointers. Only the blinking typing caret is styled: red block where supported, red native fallback. The user rejected custom mouse pointers. Do not bring them back.

## Database state and transfer

Latest snapshot: `coderise-20261101-162508.dump`, PostgreSQL 18.6, 41,018,338 bytes,
SHA-256 `057a7efc73709e386b952b2fd25c0592222d175147e5df102c8a507f701ceacb`.
It includes migration 006, 6,155 editorials and 16,094 retrieval embeddings, plus
the original imported catalogue/history. Every table count matched a restore into
an isolated PostgreSQL 18 instance. Credentials and transient sync-job data are
excluded. The Windows transfer release also preserves ignored research artifacts.
Use PostgreSQL 18 on Windows; do not restore this newer snapshot over the old
PostgreSQL 17 database or reapply schema migrations after restoring it.

The transfer snapshot schema is 001 plus migrations 002, 004, 005. Fedora now
also has migration 006 and the completed retrieval cache described below. The
default website still uses `recommend_practice` from 005. Migration 003 is an
**unfinished, unapplied experiment**; the current retrieval path needs no pgvector.

Transfer release: https://github.com/ChatreshGudi/Coderise/releases/tag/fedora-transfer-2026-11-01

Snapshot `coderise-20261101-123335.dump`, created from PostgreSQL 17.6 and restore-tested against a new temporary database. It contains 11,620 problems, 9,983 statements, 2,055 contests, 33,254 problem/tag links, 4,003 submissions, 549 rating changes, 39 tags, and 3 public profiles. It omits transient sync-job rows. Attached manifest/checksum are authoritative for this snapshot. Counts can change after live imports.

Restore into PostgreSQL 17+ and a fresh database. Do not rerun initial schema migrations after restoring. Verify counts before starting the web app. PostgreSQL roles/passwords, `.env`, model files, local histories, and sync logs are not in the release.

Existing Codeforces importers upsert catalogue/profiles and retain attribution for imported Open R1 statements. Profiles import up to 2,000 recent submissions and rating history, with solve counts explicitly labelled as imported history. Active visible profiles refresh when stale; this is not a full unattended catalogue scheduler.

## Embedding and prediction plan

**Current recommendation ranking is an explicit SQL baseline:** rating fit, imported topic history, and catalogue popularity. Accepted problems are excluded. Weakness weighting is disabled below 20 judged submissions. No semantic ranking, calibrated solve probability, predicted solve time, or rating-gain prediction is currently integrated.

Completed research: read `docs/embedding_evaluation.md`, its results and manifest, and `scripts/evaluate_embeddings.py`. MiniLM statement embeddings sometimes followed story vocabulary instead of underlying algorithms. MPNet did not demonstrate a reliable enough held-out advantage to justify its much higher measured local CPU cost. The proxy labels favor topic-based retrieval; they do not establish learning outcomes. Do not claim statement vectors solve technique understanding or restore the draft's dominant semantic weight.

Earlier proposed direction, superseded by the editorial retrieval implementation
and relevance review below (do not resume this generation plan automatically):

1. Use an LLM **offline through Ollama on Fedora** to extract structured core techniques, important observations, and prerequisites from statements. Qwen3-8B was discussed but postponed because of processing cost/time. Final model remains undecided; first inspect RAM, free disk, GPU/VRAM, and `ollama list`.
2. Start with about 100 problems and review technique outputs before scaling. Save structured results with model/prompt versions and source hashes; make batches resumable. These are proposed implementation requirements for the next stage, not existing functionality.
3. Evaluate embeddings of richer technique descriptions against the existing baseline with human-reviewed relevant pairs. Keep rating constraints and practice goals separate from semantic similarity.
4. Install and verify pgvector on Fedora, design/fix migrations deliberately, and only then connect tested vectors to production recommendation SQL. Keep model choice configurable. Avoid downloading large libraries/models before confirming resources.
5. Treat technique identification and solve-outcome prediction as separate tasks. Predictive probabilities require a leakage-aware historical holdout and calibration evaluation. Do not label similarity scores as solve probabilities or promise success for a profile with only a few solves.

## Unfinished drafts preserved for reference

`experiments/archive/` contains reference copies of the old uncommitted migration 003 and embedding generator, with `.txt` extensions to prevent accidental execution. They are **not a setup step**. Original Windows draft paths remain untouched. They need redesign/review; the generator embeds names/tags and averages solved vectors, and the migration attempts JSONB-to-vector conversion without resolving the old JSONB constraints.

## Verification and next actions

Latest relevance review: see `docs/recommendation_quality_review.md`. Nine
profile/mode cases (45 positions) introduced 15 suggestions; this is change,
not an accuracy measurement. Keep semantic ranking off by default. Confirmed
defect: the latest-30 history cutoff precedes checking vector availability.
Petr has 631 compatible solved editorial references but zero in the selected
30; tourist's solved modes rely on only three. Next implement selection of recent
compatible references per source channel, then repeat the review. Several high
cosines reflect broad vocabulary rather than core algorithms; one interactive
search pair has a useful structural connection. No weights were tuned. The
read-only `scripts/audit_recommendations.py` saves evidence in ignored
`reports/recommendation_quality/` and checks similarity agreement with the saved
application comparison. No generation was resumed or production setting enabled.

Latest implementation: editorial-first / statement-fallback retrieval is now
implemented; see `docs/retrieval.md`. Migration 006 is additive, preserves the
original baseline, and uses dedicated `problem_editorial` and `retrieval_embedding`
tables with native normalized 384-float arrays. A pinned MiniLM ONNX CPU encoder
replaces generation. Source hashes and model/revision/recipe gate freshness.
The import found 6,155 editorials, of which 6,111 passed basic text checks and 44
were held for review. These are not expert correctness labels. The new ranking
is opt-in via `CODERISE_SEMANTIC_RECOMMENDATIONS=1`; defaults remain baseline until
relevance review. Report paths: `reports/editorial_import/coverage.json`,
`reports/retrieval_embeddings.json`, and `reports/recommendation_comparison.md`.
The cache completed: 6,111 editorial and 9,983 statement vectors. Source tiers are
6,111 editorial / 3,967 statement fallback / 1,542 catalogue-only. Twelve TS tests,
twelve Python tests, rollback-only DB checks, all nine profile/mode API checks and
the production build passed. Build now uses Webpack to avoid Turbopack following
the Fedora `.venv/bin/python` symlink outside the project root. The local `.env`
was not changed to enable the experimental flag; restart with the flag to try it.
Do not resume the abandoned statement-solving Ollama run. Weights are bounded
experimental settings, not calibrated probabilities or proven quality gains.

Latest steering: the user stopped the statement-only model comparison because
inference was slow and outputs inaccurate. The remaining Python process was
interrupted; do not resume it automatically. Qwen3 8B is installed. Initial
outputs and assistant review notes remain in ignored `reports/technique_pilot/`.
The new direction is editorial/solution-grounded embeddings. The same
`open-r1/codeforces` dataset has an `editorial` field (the dataset card reports
about 60% coverage across its problems); the existing statement importer excludes
it. First audit actual coverage and quality at the pinned dataset revision,
joining through stored `source_problem_id` and `source_revision`, then design an
editorial import with attribution/content hashes. Embed supplied explanations as
a baseline before asking an LLM to summarize techniques. Dataset-wide coverage
must not be presented as measured coverage of the local catalogue.

Fedora migration completed in this session: PostgreSQL 18.6 (PGDG), restored table
counts matched the published manifest, pgAdmin connected, and the user confirmed
the local website runs. The local role/database is `coderise`; credentials stay
in ignored `.env`. PGDG uses the `postgresql-18` service and `/usr/pgsql-18/bin`.

Technique extraction now has a resumable local-Ollama harness:
`scripts/extract_techniques.py`. Read `docs/technique_extraction.md`. The initial
comparison uses Qwen3 8B and the already installed Qwen2.5-Coder 7B on the same
frozen 10-problem sample. Manifest, raw responses, timing and review report live
under ignored `reports/technique_pilot/`. No production vectors or recommendation
SQL are changed by this harness. Review quality and failure modes before selecting
a model or scaling; valid JSON and grounded quotes do not establish correctness.

Recent production build and type checking pass; six unit tests cover validation, repeated topic parameters, and page-window boundaries. `node scripts/check-web.mjs` passes HTTP/database integration checks. Browser checks covered filtering/chips, page jumps, keyboard interactions, previews/math, chart readouts, red highlights, and mobile overflow.

On Fedora: follow the restore guide, run npm test and npm run build, start npm run dev, then node scripts/check-web.mjs. Browser/native automation capabilities may differ on Linux; report unavailable checks rather than claiming they ran.

Next work is **compatible reference selection**, followed by another relevance
comparison and an independent review set; see `docs/recommendation_quality_review.md`.
Fedora setup and embedding generation are complete. Preserve the finished UI and
agreed scope. Catalogue scheduling and predictive features need their own design.
