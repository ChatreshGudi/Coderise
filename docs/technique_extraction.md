# Technique extraction pilot

**Stopped at the user's request.** The bounded statement-only comparison showed
slow CPU inference, invented evidence and incorrect algorithms. Saved outputs
are diagnostic artifacts; do not resume or scale this run automatically. The
next direction is importing author editorials from the existing Open R1 source
and grounding embeddings/technique summaries in supplied solution explanations.
The commands below preserve how to reproduce the initial experiment.

This experiment reads the restored PostgreSQL statements and calls local Ollama.
It writes only ignored `reports/` artifacts. It does not migrate the database,
populate production embeddings, or alter the website's recommendation function.

## Run and resume

Use the existing worker dependencies in `.venv`; no Torch or model SDK is required.
The initial comparison uses the installed Qwen2.5-Coder 7B and Qwen3 8B:

```bash
ollama pull qwen3:8b
.venv/bin/python scripts/extract_techniques.py
```

Run the same command after an interruption. A frozen `manifest.json` keeps the
same problems and source text. Each response is saved atomically immediately.
Cache fingerprints include the actual input, system prompt, schema, model digest,
generation options, and prompt version. Failed responses are retained for review;
use `--retry-failed` to replace them. Run only one writer per output folder.

```bash
# Run just one side of the comparison against the same manifest:
.venv/bin/python scripts/extract_techniques.py --models qwen3:8b
# Rebuild the Markdown report without contacting either service:
.venv/bin/python scripts/extract_techniques.py --report-only
# Start a separate 100-problem pilot after reviewing the small comparison:
.venv/bin/python scripts/extract_techniques.py --size 100 \
  --models qwen3:8b --folder reports/technique_pilot_100
# Offline acceptance checks:
.venv/bin/python -m unittest discover -s tests -p 'test_technique_extraction.py'
```

The manifest stores complete source text, stable contest/index identifiers,
source attribution/revision, imported content hash and exact model-input hash.
It deliberately stays frozen if live database content changes; choose a new
folder to sample the updated corpus. Source text and outputs remain outside Git.

## Comparison protocol

The default sample has 10 distinct contests, selected deterministically across
400-point rating buckets. Identical source texts are excluded. Complete source
JSON is limited to 9,000 UTF-8 bytes; long statements are excluded, not truncated.
This small sample is diagnostic, not representative of the full catalogue.

Input contains description, input/output formats, notes and examples. Ratings,
tags, problem titles, identifiers, editorials and solutions are withheld. Tags and
ratings are saved separately as review metadata and must not become ground truth.
The model may still recognize a known statement from training; this is not an
unseen-problem benchmark.

Both models get the same schema and prompt. The initial comparison disables
thinking, uses temperature 0, seed 42, 16,384 context tokens and a maximum 1,800
generated tokens. This measures bounded direct extraction, not either model's
best possible reasoning quality. A separate Qwen3 run with `--think` and a new
folder can assess thinking mode; token-limited responses are failures, not valid
abstentions. No reasoning traces are used as embedding input.

Read `reports/technique_pilot/review.md` alongside the manifest/original problem.
Raw API responses, timing, token counters, model digest and validation errors are
retained under `results/`. Timings include model loading where applicable; inspect
the response's load/evaluation durations before comparing warm inference speed.

Output acceptance requires all schema fields, a complete response, at least one
technique when proposing an algorithm, explicit limitations when abstaining,
and exact evidence substrings. These are mechanical checks only. Reviewers must
judge algorithm correctness, constraint fit, key observations, unsupported
prerequisites and useful uncertainty. Keep generated observations private during
practice: they can reveal solutions.

## Next decision

Select a model only after reviewing outputs. If both small models fail on difficult
cases, compare the installed Coder 14B or Qwen3 thinking mode on those cases.
Record the review and timing tradeoff rather than assuming a larger model wins.

After acceptable extraction quality, freeze a prompt and model digest, run the
100-problem pilot, and evaluate MiniLM embeddings of reviewed technique text
against raw statements and weighted tags with human-reviewed problem pairs.
Only demonstrated gains should enter recommendation ranking. PG18-compatible
pgvector storage needs a new migration with explicit model/version provenance;
the archived migration 003 is not suitable for this experiment.

API references: [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs),
[chat endpoint and timing fields](https://docs.ollama.com/api/chat),
[Qwen3 8B](https://ollama.com/library/qwen3:8b).
