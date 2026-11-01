# Embedding evaluation: Codeforces statements

Decision: retain `sentence-transformers/all-MiniLM-L6-v2` as the lightweight statement encoder for semantic retrieval experiments. Use weighted topic vectors and rating constraints as the recommendation foundation. Neither tested statement model has earned a dominant ranking weight. A positive semantic contribution has not demonstrated a held-out improvement over topic vectors on this proxy test.

## Actual local experiment

Evaluated 800 rated problems with imported statements, spanning ratings 800-3500. Used 120 queries with at least one non-generic tag: 60 validation queries for hybrid weight selection and 60 held-out queries for comparison. Candidate problems were restricted to +/-400 rating. Same contest, same title, same source problem, and exact duplicated statement text were excluded. The sample order is archived in `embedding_evaluation_manifest.json`.

Models received only title, statement, input format, and output format: no tags, ratings, editorials, or solutions. Text was split into overlapping windows of 224 tokens with stride 192. Both encoders used maximum sequence length 256; normalized chunk vectors were pooled with token-count weights and normalized again. All text was covered through chunking. Each model encoded 2,309 chunks on CPU with four Torch threads and batch size 16.

The tag baseline uses IDF-weighted multi-hot tag vectors and cosine similarity. Relevance labels are IDF-weighted tag Jaccard, excluding implementation, math, greedy, brute force, constructive algorithms, and *special. nDCG uses linear relevance gains. Topic precision@5 means the fraction of five retrieved problems sharing at least one remaining tag. These are imperfect topic proxies, not human relevance labels.

| Method | Topic precision@5 | Topic nDCG@10 | Encoding time |
|---|---:|---:|---:|
| Random | 27.67% | 0.1155 | n/a |
| Weighted tags | 95.67% | 0.8966 | n/a |
| MiniLM statements | 42.67% | 0.2251 | 45.41 seconds |
| MPNet statements | 46.67% | 0.2434 | 550.56 seconds |
| MiniLM + tags, validation-selected 10% semantic weight | 95.00% | 0.8893 | same cached vectors |
| MPNet + tags, validation-selected 0% semantic weight | 95.67% | 0.8966 | reduces to tag baseline |

Weight selection tested semantic weights 0%, 10%, 20%, 30%, 40%, and 50%, using validation nDCG. MiniLM's tiny validation gain at 10% did not carry to the held-out queries. MPNet's selected weight was zero. Encoding times exclude model loading/download; this is one local timing run, not a hardware-independent speed claim. MPNet was about 12.1 times slower here.

MPNet minus MiniLM paired query bootstrap (10,000 resamples, seed 123): nDCG difference +0.0183, 95% interval [-0.0068, +0.0451]; topic precision difference +4.0 percentage points, interval [-0.67, +8.67] percentage points. Both intervals include zero. This small sample does not establish a reliable quality advantage for MPNet.

## Example inspection

For 1252/K Addition Robot (range updates with addition transformations; tags include matrices and data structures), MiniLM's first matches were 237/E Build String (flows/graphs), 645/D Robot Rapping Results Report (graphs), and 56/D Changing a String (dp). The first two share string/robot wording while using different algorithm topics. MPNet also ranked Build String first, though its next matches included data-structure problems. In another inspected case, 1583/B Omkar and Heavenly Tree retrieved other tree problems with MiniLM. These spot checks show both useful structural matches and surface-language failure cases; they are not a blinded human relevance study.

## Limits and next implementation

Tag-based labels inherently favor tag-based retrieval. The table does not prove that tag-only recommendations improve learning, nor that statement embeddings add no useful information within a topic. We have no expert-labelled problem-pair test set or prospective learner outcomes. Averaging statement chunks can also lose fine mathematical structure. Ratings and tags may change on catalogue refresh.

Choose MiniLM for the semantic component because MPNet's measured improvement is small/uncertain and its local CPU cost is much higher. Keep semantic similarity optional and secondary until a human-reviewed relevance set shows it improves rankings. Do not use the previous draft's 65% statement-similarity weight. Rating fit and tag-based practice goals remain separate signals. This evaluation does not update production vectors or the recommendation SQL.

Re-run from the project virtual environment with `py scripts/evaluate_embeddings.py` after installing `requirements.txt` and `requirements-statements.txt` and importing statements. Model revisions are pinned in the script; exact versions and measured results are in `embedding_evaluation_results.json`. The manifest preserves the original sample order across internal database ID differences. `--fresh-sample` deliberately selects a new sample. Local corpus text and vector arrays stay under ignored `reports/embedding_evaluation/`.
