# Coderise development handoff

Updated 1 November 2026. Read this before changing scope or continuing the Fedora move.

## Project and user preferences

- Repository: https://github.com/ChatreshGudi/Coderise (public), main branch.
- Windows source checkout: `C:\Users\Gudic\Desktop\PESU\Subjects\DBMS\Mini project\Coderise`.
- Target: Fedora on the same dual-boot laptop, with Ollama already installed. Make Fedora the primary environment after verifying the transfer. Follow `docs/FEDORA.md`.
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

Active schema is 001 plus migrations 002, 004, 005. The website uses `recommend_practice` from 005. Migration 003 is an **unfinished, unapplied experiment**. pgvector is **not installed in the Windows source database**, and there are **zero production embeddings**.

Transfer release: https://github.com/ChatreshGudi/Coderise/releases/tag/fedora-transfer-2026-11-01

Snapshot `coderise-20261101-123335.dump`, created from PostgreSQL 17.6 and restore-tested against a new temporary database. It contains 11,620 problems, 9,983 statements, 2,055 contests, 33,254 problem/tag links, 4,003 submissions, 549 rating changes, 39 tags, and 3 public profiles. It omits transient sync-job rows. Attached manifest/checksum are authoritative for this snapshot. Counts can change after live imports.

Restore into PostgreSQL 17+ and a fresh database. Do not rerun initial schema migrations after restoring. Verify counts before starting the web app. PostgreSQL roles/passwords, `.env`, model files, local histories, and sync logs are not in the release.

Existing Codeforces importers upsert catalogue/profiles and retain attribution for imported Open R1 statements. Profiles import up to 2,000 recent submissions and rating history, with solve counts explicitly labelled as imported history. Active visible profiles refresh when stale; this is not a full unattended catalogue scheduler.

## Embedding and prediction plan

**Current recommendation ranking is an explicit SQL baseline:** rating fit, imported topic history, and catalogue popularity. Accepted problems are excluded. Weakness weighting is disabled below 20 judged submissions. No semantic ranking, calibrated solve probability, predicted solve time, or rating-gain prediction is currently integrated.

Completed research: read `docs/embedding_evaluation.md`, its results and manifest, and `scripts/evaluate_embeddings.py`. MiniLM statement embeddings sometimes followed story vocabulary instead of underlying algorithms. MPNet did not demonstrate a reliable enough held-out advantage to justify its much higher measured local CPU cost. The proxy labels favor topic-based retrieval; they do not establish learning outcomes. Do not claim statement vectors solve technique understanding or restore the draft's dominant semantic weight.

Discussed direction, not yet implemented:

1. Use an LLM **offline through Ollama on Fedora** to extract structured core techniques, important observations, and prerequisites from statements. Qwen3-8B was discussed but postponed because of processing cost/time. Final model remains undecided; first inspect RAM, free disk, GPU/VRAM, and `ollama list`.
2. Start with about 100 problems and review technique outputs before scaling. Save structured results with model/prompt versions and source hashes; make batches resumable. These are proposed implementation requirements for the next stage, not existing functionality.
3. Evaluate embeddings of richer technique descriptions against the existing baseline with human-reviewed relevant pairs. Keep rating constraints and practice goals separate from semantic similarity.
4. Install and verify pgvector on Fedora, design/fix migrations deliberately, and only then connect tested vectors to production recommendation SQL. Keep model choice configurable. Avoid downloading large libraries/models before confirming resources.
5. Treat technique identification and solve-outcome prediction as separate tasks. Predictive probabilities require a leakage-aware historical holdout and calibration evaluation. Do not label similarity scores as solve probabilities or promise success for a profile with only a few solves.

## Unfinished drafts preserved for reference

`experiments/archive/` contains reference copies of the old uncommitted migration 003 and embedding generator, with `.txt` extensions to prevent accidental execution. They are **not a setup step**. Original Windows draft paths remain untouched. They need redesign/review; the generator embeds names/tags and averages solved vectors, and the migration attempts JSONB-to-vector conversion without resolving the old JSONB constraints.

## Verification and next actions

Recent production build and type checking pass; six unit tests cover validation, repeated topic parameters, and page-window boundaries. `node scripts/check-web.mjs` passes HTTP/database integration checks. Browser checks covered filtering/chips, page jumps, keyboard interactions, previews/math, chart readouts, red highlights, and mobile overflow.

On Fedora: follow the restore guide, run npm test and npm run build, start npm run dev, then node scripts/check-web.mjs. Browser/native automation capabilities may differ on Linux; report unavailable checks rather than claiming they ran.

Next work is **Fedora environment verification**, then the small Ollama extraction experiment. Preserve the finished UI and agreed scope. Catalogue scheduling and any new predictive feature need their own concrete design rather than being silently added.
