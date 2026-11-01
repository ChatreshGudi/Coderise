# Coverage-aware editorial and statement retrieval

This path embeds existing source text. It does not generate solutions or call
Ollama. The course-project deployment now uses pgvector-assisted ranking, with a
baseline fallback when compatible text/history is missing. See [PGVECTOR.md](PGVECTOR.md).

## Data and coverage

`scripts/import_editorials.py` reads only ID, alias and editorial Parquet columns
from the same immutable Open R1 snapshot as the statements. Completed source
reads are cached under ignored `reports/editorial_import/`. Existing statement
source IDs take precedence over canonical contest/index matching, followed by
aliases. Unrelated manually sourced editorials are not overwritten.

The initial import matched 6,155 editorials to 11,620 catalogue problems. Basic
checks admitted 6,111 to encoding; 44 short or repeated explanations were held
for review. These are measured catalogue counts, not a dataset-wide estimate.
`ready` means basic text checks passed; it is not an expert correctness label.
Identical explanations shared across distinct canonical source IDs are held out;
canonical IDs and their own aliases may legitimately share text.

The completed cache contains 6,111 editorial and 9,983 statement vectors. Source
coverage divides the catalogue into 6,111 editorial-tier problems, 3,967 statement
fallback problems, and 1,542 catalogue-only problems. Some editorial-tier problems
have no local statement; both kinds of embeddings are saved where possible.
The initial 256-document batch took 14.07 seconds of encoding/writes; the remaining
15,838 took 975.52 seconds. These local timings exclude model download/loading.

Editorials are stored in `problem_editorial`, with source URL, source problem ID,
immutable dataset revision, content hash, status and review reason. Retain the
[Open R1 attribution and dataset license](https://huggingface.co/datasets/open-r1/codeforces).
The complete explanations are internal retrieval data; the API does not return
them or disclose solution details in recommendation reasons.

## Encoder and cache

The pinned MiniLM model and encoding recipe live in `config/retrieval.json`.
The CPU ONNX runtime loads only `onnx/model.onnx` and the tokenizer (about 90 MB
for the weights), avoiding a Torch/CUDA installation. It uses the model's masked
mean pooling, L2 normalization and overlapping 224-token windows with stride 192.
Normalized chunk vectors are pooled by source-token count and normalized again.
Every token is covered; long text is chunked rather than silently truncated.

Both editorial and statement embeddings are stored when their sources exist.
Statement input is description + input format + output format; editorial input
is the supplied explanation with basic HTML cleanup. No generated techniques,
ratings, tags or problem titles are added to either embedding input.

`retrieval_embedding` records source kind, source hash, exact prepared-input hash,
model ID/revision, recipe, vector, chunk count and creation time. Batches commit
independently. Re-running only encodes missing or changed inputs. Model artifacts
and text caches remain under ignored `reports/`; vectors stay in local PostgreSQL.

Migration 007 converts the existing cache to native `vector(384)` without model
inference. PostgreSQL computes cosine similarities with `<=>`; only scalar
similarities reach the application. Partial HNSW cosine indexes support catalogue
similarity searches. Recommendation scoring uses exact comparisons within a
bounded shortlist. Zero, non-finite and wrong-sized vectors are rejected by
database constraints. `retrieval_current_embedding`
rejects stale source hashes and held-out editorials without deleting provenance.

## Ranking behavior

1. The SQL baseline chooses up to 500 candidates using the same rating band,
   solved exclusions, difficulty fit, topic weakness, popularity and retry signals.
2. Up to 30 recent compatible references form anchors **per source channel**.
   Source freshness, model identity and duplicate hashes are checked before the
   cutoff, so unavailable recent vectors do not hide usable older history.
   Warm-up/stretch prefer accepted history;
   if none exists, they use unsuccessful judged attempts. Fix weaknesses prefers
   unsuccessful attempts, falling back to accepted history. Compilation failures
   and pending verdicts are excluded from semantic anchors.
3. Editorial candidates compare only with editorial anchors from the same model,
   revision and recipe. If that channel is unavailable, statement embeddings
   compare with statement anchors. If neither works, the baseline score remains.
   Identical source hashes are not independent anchor evidence.
4. The mean of the three closest anchors gives a raw similarity. At least five
   comparable candidates are required. Similarities are converted to centered
   ranks *within each source channel*, so raw editorial and statement cosine
   values are never treated as interchangeable. Ties remain neutral.
5. The adjustment is bounded at +/-0.08 for editorials and +/-0.025 for statements.
   Missing vectors receive zero adjustment; having an embedding is not itself a
   bonus. The resulting score is bounded to [0,1], not a solve probability.

Those weights are initial experiment settings, not fitted/calibrated
weights or evidence of better learning outcomes. Use an independent labelled
relevance set before claiming better recommendation quality.
Ranking occurs within the 500-problem baseline shortlist, not the entire corpus.

`recommend_practice` is preserved as the baseline. Migration 006 adds the wider
`recommend_practice_candidates` function without changing the original function.
The API reports `pgvector_hybrid` only when the returned results use a
compatible similarity channel, otherwise `topic_difficulty_baseline`. Vector
values and editorial bodies never enter the production ranking payload.

## Fedora setup and usage

Reuse the existing `.venv` and `.env` credentials:

```bash
.venv/bin/python -m pip install -r requirements-retrieval.txt
npm run db:retrieval
npm run db:pgvector # install the matching pgvector server package first
.venv/bin/python scripts/import_editorials.py           # audit only
.venv/bin/python scripts/import_editorials.py --apply   # apply completed import
.venv/bin/python scripts/build_retrieval_embeddings.py # all missing/stale sources
```

For a bounded encoder trial, add `--limit 256`. Run only one importer/embedding
writer at a time. Changing statements or editorials automatically hides old
vectors; rerun the encoder to refresh them. To refresh the source snapshot,
explicitly pass a new immutable `--revision` after reviewing its changes.

Enable vector ranking when starting the app:

```bash
CODERISE_SEMANTIC_RECOMMENDATIONS=1 npm run dev
```

Or set that variable in ignored `.env` and restart the running server. `0` or an
unset variable uses the baseline. Missing retrieval functions also fall back to the
baseline; unrelated database failures remain errors rather than being hidden.
Profiles with no usable practice anchors also retain the baseline.

## Checks and review

The [earlier relevance review](recommendation_quality_review.md) found that limiting
history before vector availability missed usable references. Migration 007 fixes
that bug; the update in that review records the new coverage. It also found
vocabulary matches that did not share the core algorithm. That quality limitation
remains; weights have not been tuned on those inspected examples. Reproduce the audit with
`.venv/bin/python scripts/audit_recommendations.py` after generating the application
comparison below. Its source text and diagnostics stay under ignored
`reports/recommendation_quality/`.

```bash
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python scripts/check_retrieval.py
node scripts/check-pgvector.mjs
node --conditions=react-server --import tsx scripts/check-recommendations.ts
npm run typecheck
npm run build
```

The database check uses rollback-only fixtures to test exclusions, source
invalidation and vector constraints, and compares baseline output for restored
profiles. The application check exercises the real API handler and writes
`reports/recommendation_comparison.md`/`.json`; these are review aids, not a quality
benchmark. `reports/retrieval_embeddings.json` records encoder versions/timing.
Final validation passed 12 TypeScript tests, 12 Python tests, database regression
checks, all nine restored profile/mode API checks, and the production build.
Query `retrieval_coverage` in pgAdmin for source coverage, and filter
`retrieval_current_embedding` by the active model/revision/recipe for vector counts.

The production build uses Webpack because Turbopack follows the existing Linux
virtualenv interpreter symlink outside its project root. Build tracing excludes
`.venv`, model/report caches and backups; the Python worker remains a local
runtime dependency.

References: [MiniLM model and mean pooling](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2),
[pinned ONNX files](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/1110a243fdf4706b3f48f1d95db1a4f5529b4d41/onnx).
