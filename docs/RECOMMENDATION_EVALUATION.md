# Current recommendation evaluation — 1 November 2026

**Conclusion:** the vector integration works, but technique relevance is uneven.
This is a functioning course-project prototype and a useful practice-discovery
aid. The evidence does not establish that its recommendations are better than
the baseline, or that MiniLM reliably identifies the underlying algorithm.

No ranking settings, model, weights or application flags were changed for this
evaluation. Vector ranking remains enabled with baseline fallback.

## What was evaluated

Regenerated baseline and pgvector results for Chatresh, tourist and Petr in all
three modes: nine lists and 45 returned positions per strategy. Checked API
behavior and eligibility, recomputed similarities independently with NumPy, and
inspected supplied editorial text for all 24 newly introduced problems and their
closest reference relationships. Additional reference explanations were read
where needed to distinguish a common tool from a common solution method.

This is an assistant content review, not independent expert annotation. There
are only three profiles: a two-solve beginner and two advanced users. There is
no intermediate cohort, blinded comparison or subsequent learning/solve outcome.
The latest imported profile snapshot is used; profiles were not refreshed.

## Measured behavior

| Case | Baseline top five retained | Editorial / statement references | Recommendation time |
| --- | --- | --- | --- |
| Chatresh warm-up | 5/5 | 0 / 0 | 30 ms |
| Chatresh stretch | 5/5 | 0 / 0 | 23 ms |
| Chatresh fix weaknesses | 5/5 | 0 / 0 | 55 ms |
| tourist warm-up | 1/5 | 30 / 30 | 198 ms |
| tourist stretch | 0/5 | 30 / 30 | 130 ms |
| tourist fix weaknesses | 4/5 | 15 / 19 | 163 ms |
| Petr warm-up | 0/5 | 30 / 30 | 291 ms |
| Petr stretch | 0/5 | 30 / 30 | 221 ms |
| Petr fix weaknesses | 1/5 | 16 / 30 | 261 ms |

These are single-run local application-call timings, excluding browser rendering,
profile synchronization and network delay. Median 163 ms; maximum 291 ms.

- All nine application/API cases pass. Suggestions stay in the SQL-eligible
  shortlist, exclude accepted problems **within imported history**, and keep
  finite bounded scores. No vector arrays or editorial bodies enter the API.
- Rating fit is stable: Chatresh receives 800/1000/900 for the three modes;
  tourist receives 3300/3500/3300–3500; Petr receives 2700/2900/2800. These rating
  targets come from the baseline; they do not prove personalized readiness.
- Six lists change, introducing 24 positions. Their median baseline rank was
  18; the largest move is `1336/F` from rank 64 to rank 5. Change is not accuracy.
- All 24 introduced positions use editorial evidence. Across the advanced
  profiles, ready-editorial availability rises from 12/30 baseline suggestions
  to 27/30 hybrid suggestions. This is consistent with source-availability and
  channel-weight effects, not evidence that the newer list is more relevant.
- Independent NumPy cosine/channel calculations match saved SQL evidence within
  0.00001. This validates computation, not semantic quality.

## Technique relevance: the important weakness

Cosines below refer to the closest individual reference, rather than the final
score or the average over three references. The observations concern a specific
pair; a weak pair does not establish that the candidate itself is bad practice.

| Introduced problem → closest reference | Cosine | Content observation |
| --- | --- | --- |
| `1063/F` → `2061/F2` | .677 | Both combine DP and range queries, but String Journey adds suffix-array/LCP machinery. Useful partial prerequisites. |
| `1270/H` → `2057/B` | .631 | Threshold/component counting with a lazy tree versus greedy removal of low-frequency values. Weak core-method connection. |
| `1290/E` → `2062/D` | .651 | Cartesian-tree updates and Segment Tree Beats versus greedy tree-value selection. Tree terminology hides different invariants. |
| `1558/F` → `2061/F2` | .642 | Binary movement, order preservation and range structures provide a plausible connection; threshold reduction is additional work. |
| `1034/D` → `1401/F` | .701 | Interval-union counting with balanced sets/two pointers versus XOR-index segment-tree transformations. Shared range wording overstates method similarity. |
| `1083/D` → `2057/D` | .698 | Both design merged segment-tree aggregates. A useful prerequisite connection, with substantially different range/lazy formulas. |
| `1158/F` → `2066/D2` | .685 | Both use combinatorial counting DP. Critical-block/subsequence states differ from constrained placement states. Partial connection. |
| `1336/F` → `2062/E2` | .753 | Genuine shared LCA, DFS-order, subtree/path aggregation tools. Journey adds virtual trees and small-to-large merging. One of the better connections. |
| `2057/H` → `2066/C` | .612 | Greedy stabilization and zero-position stacks versus XOR-state counting DP. Weak core-method connection. |
| `1764/G3` → `1987/H` | .636 | Both derive bounds from an interactive oracle to shrink a hidden search space. Useful transfer, although the oracle proofs differ. |
| `1295/F` → `2053/C` | .678 | Combinatorial/piecewise-polynomial counting DP versus symmetric recursive segment splitting. Weak algorithmic connection. |
| `1473/F` → `2057/E2` | .650 | Maximum-weight closure/min-cut versus incremental all-pairs shortest paths. Graph wording does not establish flow prerequisites. |
| `1572/C` → `2048/F` | .673 | Interval-color DP versus Cartesian-tree minimax DP. Some decomposition/DP prerequisites, different transitions and optimization. |
| `1856/E2` → `2061/E` | .672 | Tree subset-sum/bitset partitioning versus convex marginal gains from AND operations. Generic optimization language is insufficient. |
| `1887/D` → `2057/D` | .672 | Both reason about subarray extrema and range structures, but Split needs rectangle coverage and a sweep. Partial prerequisite connection. |
| `1062/F` → `2057/E1` | .623 | DAG reachability around a longest path versus weighted-path threshold queries. Graph vocabulary, different central reduction. |
| `1129/D` → `2053/C` | .675 | Range-count DP with square-root decomposition versus symmetric recursive splitting. Weak core-method connection. |
| `1372/E` → `2057/A` | .610 | Interval DP around a maximally filled column versus a MEX construction. Row/column wording is not technique evidence. |
| `1677/E` → `2048/F` | .728 | Both exploit interval extrema/Cartesian structure, but offline query maintenance and tree minimax DP are different algorithms. Partial connection. |
| `1768/F` → `2061/E` | .607 | Small/large transition optimization versus convex AND marginal gains. DP/greedy overlap is too broad. |
| `1316/F` → `1010/F` | .620 | Expected pair contributions and augmented segment trees versus generating functions/tree DP with FFT. Weak core-method connection. |
| `1386/C` → `1508/F` | .690 | Bipartiteness with rollback DSU versus DAG dependency reduction and Fenwick events. Graph/range wording dominates. |
| `1633/F` → `1010/F` | .589 | Tree matching via parity and path flips versus polynomial tree counting. Shared trees do not establish the needed matching/HLD method. |
| `983/E` → `1863/H` | .630 | Both use LCA/tree structure; greedy ancestor jumps and Euler queries differ from dynamic trie-based tree values. Partial prerequisites. |

The reference fix improves availability, but does not repair these representation
errors. The match `.728` for `1677/E` is not automatically more useful than the
interactive-search match `.636` for `1764/G3`.

## Diversity, evidence strength and practical limitations

**Concentration:** tourist's warm-up list goes from 3/5 to 5/5 data-structures
problems; stretch goes from 1/5 to 4/5. Petr's fix-weaknesses list goes from 0/5
to 4/5. Mean pairwise tag Jaccard rises in five of the six changed lists (Petr
warm-up is the exception). Related practice can intentionally concentrate topics,
so this is a diversity warning rather than a universal failure condition.

**Adjustment strength:** the introduced candidates have mean-of-three cosines
between .541 and .674. Within-channel percentile ranking can still give almost
the full +.08 editorial adjustment. It measures relative rank, without checking
whether any match is convincing. Even when all evidence is weak, some candidates
necessarily rank highest. There is no independently calibrated confidence gate.

**Variant dependence:** source hashes remove exact duplicate text, but distinct
easy/hard editorials can still supply two of three matches. For `1473/F`, both
`2057/E2` and `2057/E1` contribute despite sharing the same shortest-path problem
family. Three reference rows are not necessarily three independent techniques.

**Cold start:** Chatresh currently gains nothing from embeddings: neither imported
solve has compatible vector evidence. Its starter lists are sensible difficulty
defaults, not learned preferences. Catalogue coverage is not globally absent for
beginners: 2,401 of 2,791 problems rated 800–1200 have at least one fresh compatible
vector (86.0%); the problem is this profile's particular history. The corresponding
either-channel counts are 3,157/3,545 for 1300–1900, 2,753/3,126 for 2000–2600,
and 1,528/1,840 for 2700–3500.

**Statement fallback:** it is available for 89–196 candidates in the advanced
warm-up/stretch lists but contributes none of the returned positions in this
snapshot. Near-identical problem variants can score very highly, e.g.
`1896/H2` versus `1896/H1` at .997; that is not evidence of general technique
retrieval. Evaluate variant matches separately from unrelated problems.

**Prediction:** there is no trained, calibrated solve-success predictor here.
The final score is a ranking heuristic, not a probability. Imported-history
exclusions also cannot guarantee that an older solve outside the 2,000-submission
import window will never be recommended.

## Recommended next work

1. Build a small labelled set of technique pairs and baseline-versus-hybrid lists,
   including intermediate users, beginner histories, same-family variants and
   vocabulary-only hard negatives. Have a human judge relevance and prerequisites.
2. On a separate tuning portion, evaluate confidence-aware bounded adjustments,
   reference-family diversity and list diversity. Keep held-out cases untouched;
   do not choose a cosine threshold from these inspected examples and then claim
   it has been validated on them.
3. Compare representation improvements against the same held-out set. Retain
   pgvector regardless of encoder choice. More model generation alone does not
   resolve the evaluation or score-calibration problems.

For personal use today: use the lists as starting points, inspect the statement,
and expect occasional unrelated suggestions. For the course demo: demonstrate
native pgvector, cosine retrieval, hybrid ranking and missing-evidence fallback;
describe technique quality as a limitation being evaluated.

## Reproduce

From the configured project directory:

```text
node --conditions=react-server --import tsx scripts/check-recommendations.ts
.venv\Scripts\python.exe scripts\audit_recommendations.py
.venv\Scripts\python.exe scripts\evaluate_recommendations.py
```

Use `.venv/bin/python` on Fedora. The first script tests both flag values in its
own process; it does not edit `.env`. Audit queries are read-only. Generated
comparisons, source documents and metrics stay under ignored `reports/`.
`scripts/evaluate_recommendations.py` calculates descriptive metrics only; the
editorial observations above are explicit content judgments, not automated labels.
