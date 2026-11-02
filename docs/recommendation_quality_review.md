# Recommendation relevance review — 2026-11-01

For the complete post-fix evaluation, including all 24 introduced suggestions,
see [the current evaluation](RECOMMENDATION_EVALUATION.md). The original review
below remains historical evidence, not the current deployment decision.

## Subsequent implementation update

Migration 007 now uses native pgvector storage and SQL cosine scoring. Compatible
reference selection is fixed before applying a 30-reference cap per channel.
The repeated full-catalogue scan was replaced with indexed problem lookups;
reference selection measured about 12 ms locally, previously about 11 seconds.
All nine application/API regression cases and rollback-only vector fixtures pass.
Independent NumPy recomputation agrees with SQL similarities within 0.00001.

| Profile | Warm-up editorial / statement | Stretch | Fix weaknesses |
| --- | --- | --- | --- |
| Chatresh | 0 / 0 | 0 / 0 | 0 / 0 |
| tourist | 30 / 30 | 30 / 30 | 15 / 19 |
| Petr | 30 / 30 | 30 / 30 | 16 / 30 |

The course deployment enables vector-assisted ranking, with the baseline fallback
for missing evidence. Weights and the MiniLM encoder are unchanged. This fixes
coverage and storage integration; it does not establish better learning outcomes
or resolve the technique-versus-vocabulary limitation below. The rest of this
document records the **earlier** review; its selected references and inspected
suggestions describe the pre-fix implementation. Regenerated local reports now
describe the corrected implementation.

## Decision

Keep semantic ranking experimental and disabled by default. The cache and ranking
pipeline work, but this review does not establish better recommendations than
the SQL baseline. Fix reference selection before evaluating or tuning weights.
No production ranking settings were changed during this review.

## Scope and evidence

Reviewed the existing baseline/hybrid comparison for three restored profiles
(Chatresh, tourist, Petr), each in warm-up, stretch and fix-weaknesses mode: nine
cases and 45 returned positions per strategy. Inspected imported explanations
for all 15 newly introduced suggestions and their strongest reference matches,
plus selected statement-fallback controls. These are assistant content judgments,
not independent expert labels or measurements of learning outcomes. This small
sample contains a sparse-history profile and two advanced profiles, with no
representative intermediate cohort.

Local evidence (ignored reports, not committed source data):

- `reports/recommendation_comparison.json`: actual application/API before/after
  results, scores, reasons and adjustments.
- `reports/recommendation_quality/audit.json`: anchor coverage, candidate counts,
  baseline ranks, independently recomputed similarities and top reference IDs.
- `reports/recommendation_quality/documents.json`: source text used for inspection.

The audit uses a repeatable-read, read-only database transaction. It asserts that
recomputed source channels and raw similarities match the saved hybrid output
within 0.00001. It reads existing vectors; no model inference or generation runs.
Statement inspection excerpts contain the description; the actual statement
embedding also includes input/output formats.

## Observed changes and reference coverage

Coverage below counts problems with compatible fresh embeddings, not submission
rows. Editorial and statement counts overlap and must not be added together.

| Profile | Mode | Baseline top five retained | Selected references | Editorial / statement references | Editorial / statement coverage in all eligible history |
| --- | --- | --- | --- | --- | --- |
| Chatresh | Warm-up | 5/5 | 2 solved | 0 / 0 | 0 / 0 of 2 |
| Chatresh | Stretch | 5/5 | 2 solved | 0 / 0 | 0 / 0 of 2 |
| Chatresh | Fix weaknesses | 5/5 | 2 solved (fallback) | 0 / 0 | 0 / 0 of 2 |
| tourist | Warm-up | 0/5 | 30 solved | 3 / 4 | 642 / 861 of 1,220 |
| tourist | Stretch | 0/5 | 30 solved | 3 / 4 | 642 / 861 of 1,220 |
| tourist | Fix weaknesses | 4/5 | 30 unsuccessful | 15 / 21 | 15 / 23 of 32 |
| Petr | Warm-up | 5/5 | 30 solved | 0 / 0 | 631 / 956 of 1,171 |
| Petr | Stretch | 5/5 | 30 solved | 0 / 0 | 631 / 956 of 1,171 |
| Petr | Fix weaknesses | 1/5 | 30 unsuccessful | 15 / 20 | 16 / 35 of 50 |

Five lists stayed unchanged; four changed, introducing 15 suggestions across 45
positions. Overlap is a measure of change, not recommendation accuracy. All 15
introduced suggestions used editorial similarity; statement controls below did
not enter the returned top five.

### Confirmed selection defect

The application takes the latest 30 eligible practice problems **before** checking
embedding availability. Petr's warm-up/stretch receive no semantic evidence
despite hundreds of compatible older references. Tourist's corresponding lists
use only `1401/F`, `920/F` and `1736/C2` as editorial references. Those three all
carry the data-structures tag; all five promoted warm-up suggestions and four of
five stretch suggestions carry it too. This is consistent with concentration on
the narrow available reference set; it does not establish that concentration is
the user's desired practice focus.

Older usable references exist: for Petr, examples include `1373/E`, `2061/G` and
`2061/E`; for tourist, `2066/E`, `2066/D2` and `2066/D1`. Chatresh has no older
compatible reference in imported history, so baseline fallback remains appropriate.

## Content inspection

Pair cosine values below describe the closest cited reference, not the final
candidate score or the mean over up to three references. They are not correctness
probabilities. A useful shared prerequisite is weaker evidence than a shared
core algorithm, and neither alone proves that a problem should replace a baseline
suggestion.

| Newly introduced problem | Observation from the supplied explanation |
| --- | --- |
| `1063/F` String Journey | Suffix-array/LCP reasoning plus DP and segment-tree maxima. Range-query experience transfers partly, but references do not establish suffix-array prerequisites. |
| `1270/H` Number of Components | Threshold reduction plus range-add/minimum-count segment tree. Related data-structure practice; the threshold observation is additional work. |
| `1290/E` Cartesian Tree | Fenwick aggregates and segment-tree Beats. Basic segment-tree overlap does not establish readiness for Beats. |
| `1558/F` Strange Sort | Binary-threshold reduction, zero-motion recurrence, range-add/range-max tree. Related implementation skills, different key observation. |
| `1500/E` Subset Trick | Subset-sum interval structure and augmented segment-tree aggregates. Partial prerequisite overlap with `1401/F`; its XOR-index permutation technique is different. |
| `1034/D` Intervals of Intervals | Balanced interval sets, two pointers and counting/summing unions. Cosine 0.701 with XOR/segment-tree problem `1401/F` overstates evidence of a specific shared technique. |
| `1083/D` The Fair Nut's getting crazy | Lazy segment trees maintaining sums and pair products. Plausible progression in range aggregation, with substantial extra derivation. |
| `2057/H` Coffee Break | Greedy stabilization and stack simulation. Array-update vocabulary overlaps, but the supplied proof is not the reference's range-query method. |
| `1158/F` Density of subarrays | Critical-block counting and combinatorial DP; no clear core-technique connection to closest reference `1401/F` (cosine 0.554). |
| `1876/G` Clubstep | Amortized merging of query states, stack/priority queue, then tree traversal. Closest reference `1401/F` scores 0.673 despite different core mechanisms. |
| `1764/G3` Doremy's Perfect DS Class | Useful connection to `1987/H` Fumo Temple (0.636): infer bounds from an interactive oracle to shrink a hidden search space within a query budget. The oracles and proofs still differ. |
| `1633/F` Perfect Matching | Tree matching via subtree parity, path flips, HLD/lazy trees. Some dynamic-tree prerequisites overlap; the three references do not all share that core technique. |
| `1316/F` Battalion Strength | Expected adjacent-pair contributions maintained in an augmented segment tree. Closest reference `1010/F` uses polynomial tree DP/FFT (0.620); tree/aggregation wording is insufficient technique evidence. |
| `1386/C` Joker | Offline bipartiteness with rollback DSU. Closest reference `1508/F` uses DAG constraint reduction and Fenwick events (0.690): graph/range vocabulary, different main algorithms. |
| `983/E` NN country | Greedy upward reach, binary lifting and Euler-tour range queries. Some tree prerequisites overlap with `1863/H` (0.630), but the main invariants differ. |

### Statement fallback controls

- `1672/F2` Checker for Array Shuffling versus `1984/G` Magic Trick II scores
  0.756. Both involve rearranging permutations, but arbitrary swaps and fixed-length
  block moves have different constraints and objectives. The statement match alone
  does not establish transfer of the solution method. The candidate's baseline
  rank was 134 and it did not enter the top five.
- `1896/H2` versus `1896/H1` Cyclic Hamming has cosine 0.997. These are versions of
  the same problem family. This can be useful progression, but near-duplicate
  statements should be evaluated separately from general technique retrieval.

### Adjustment strength

Within-channel percentiles still award the full adjustment range when absolute
evidence is weak. A channel with only a few usable references can therefore make
large changes: `1500/E` moves from baseline rank 52 to returned rank 5 with +0.08;
`1876/G` moves from 60 to 5. Large movement is not itself a mistake, but these
examples lack enough reviewed evidence to justify calling the current weight
conservative. Do not tune the weights on these same examples and then report
them as independent validation.

## Next implementation and evaluation

1. Select the most recent **compatible** references from eligible imported history,
   separately for editorial and statement channels, capped at 30 per channel.
   Preserve solved/unsuccessful mode preferences and baseline when no evidence
   exists. Surface actual reference counts for diagnostics. This fixes the
   confirmed availability issue without downloading or generating more text.
2. Re-run the same comparison as a regression review. Broader reference coverage
   may change the concentration observed here; do not assume the selection fix
   establishes better relevance.
3. Build an independently reviewed comparison set including intermediate users,
   missing-text cases, same-family variants, technique matches and vocabulary-only
   matches. Judge rating fit, prerequisite readiness, practice goal and technique
   relevance separately. Compare both retained and displaced suggestions.
4. Use separate tuning and held-out cases to evaluate confidence gating and
   smaller adjustments. Include reference diversity and absolute evidence rather
   than relying only on candidate-relative percentiles. Choose settings only after
   those labels exist; no additional LLM generation is needed for this step.

This review changes documentation and adds a reproducible read-only audit script.
It does not enable the feature, alter rankings, or claim a measured accuracy gain.
