# Import problem statements

After importing the catalogue, apply `db/migrations/004_problem_statements.sql` in pgAdmin. This migration is independent of pgvector migration 003 and can be applied first.

    py -m pip install -r requirements-statements.txt
    py scripts\import_problem_statements.py

The importer reads statement columns from the pinned Open R1 Codeforces dataset snapshot, matches contest IDs/problem indices and duplicate aliases, and upserts the text into `problem_statement`. It imports descriptions, input/output formats, notes, and examples. Editorials, solutions, and test cases are excluded. Source URL, source problem ID, dataset revision, and a content hash are stored with each row.

Source and attribution: [Open R1 Codeforces dataset](https://huggingface.co/datasets/open-r1/codeforces), published by Guilherme Penedo and collaborators. Preserve the source attribution and review the dataset card's license information when redistributing dataset content. The default snapshot is pinned in the importer for reproducibility; `--revision` selects another snapshot explicitly.

Run `SELECT * FROM statement_coverage;` in pgAdmin to inspect coverage. The importer writes `reports/statement_coverage.json` and `reports/missing_statements.csv` locally; these data reports are ignored by Git. Re-running the same snapshot updates existing rows without creating duplicates. New or changed statement content invalidates affected problem vectors and cached user vectors.

The current `generate_embeddings.py` still embeds titles and tags. Statement-aware encoding and model evaluation are the next implementation step; importing statements does not itself generate new embeddings.

Explicit empty, punctuation-only, PDF-pointer, and statement-link placeholders are excluded. `reports/short_statements_review.csv` flags descriptions under 80 characters for manual review; genuine short statements are retained. Image-dependent text may require additional review before embedding.
