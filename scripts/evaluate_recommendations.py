"""Summarize regenerated comparison/audit artifacts; no database writes or inference.

Run check-recommendations.ts, then audit_recommendations.py first. These descriptive
metrics measure ranking behavior, not recommendation accuracy or learning gains.
"""
import collections
import itertools
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    comparison = json.loads((ROOT / 'reports/recommendation_comparison.json').read_text())
    audit = json.loads((ROOT / 'reports/recommendation_quality/audit.json').read_text())
    documents = json.loads((ROOT / 'reports/recommendation_quality/documents.json').read_text())
    audits = {(r['handle'], r['mode']): r for r in audit}
    cases = []
    for case in comparison:
        row = audits[case['handle'], case['mode']]
        by_key = {r['key']: r for r in row['picks']}
        baseline = {r['key'] for r in case['baseline']}
        introduced = [r for r in case['hybrid'] if r['key'] not in baseline]
        assert set(r['key'] for r in introduced) == set(row['introduced']), 'Regenerate both reports'
        metrics = {}
        for strategy in ('baseline', 'hybrid'):
            picks = case[strategy]
            docs = [documents[r['key']] for r in picks]
            tags = [set(d['tags']) - {'*special'} for d in docs]
            pairs = [len(a & b) / len(a | b) if a | b else 0 for a, b in itertools.combinations(tags, 2)]
            counts = collections.Counter(t for group in tags for t in group)
            metrics[strategy] = {
                'ratings': [r['rating'] for r in picks],
                'ready_editorials': sum(d['editorial_status'] == 'ready' for d in docs),
                'topics': dict(counts.most_common()),
                'mean_pairwise_tag_jaccard': round(statistics.mean(pairs), 3) if pairs else None,
                'contest_years': [int(d['date'][:4]) for d in docs],
                'similarity_sources': dict(collections.Counter(r.get('similarity_source') or 'baseline' for r in picks)),
            }
        cases.append({
            'handle': case['handle'], 'mode': case['mode'], 'milliseconds': case['milliseconds'],
            'references': row['anchor_vectors'], 'candidate_channels': row['comparable_channels'],
            'candidates': row['candidates'], 'overlap_at_5': row['overlap'], **metrics,
            'introduced': [{
                'key': r['key'], 'baseline_rank': by_key[r['key']]['baseline_rank'],
                'hybrid_rank': case['hybrid'].index(r) + 1,
                'similarity': r['semantic_similarity'], 'adjustment': r['semantic_adjustment'],
                'closest_reference': by_key[r['key']]['similarity']['matches'][0],
            } for r in introduced],
        })
    new = [p for c in cases for p in c['introduced']]
    advanced = [c for c in cases if sum(c['references'].values())]
    summary = {
        'warning': 'Descriptive snapshot, not accuracy; three profiles, no intermediate cohort or outcome labels.',
        'cases': len(cases), 'returned_positions': sum(len(c['hybrid']) for c in comparison),
        'changed_lists': sum(c['overlap_at_5'] < 5 for c in cases), 'introduced_positions': len(new),
        'introduced_baseline_rank_median': statistics.median(p['baseline_rank'] for p in new) if new else None,
        'introduced_baseline_rank_max': max((p['baseline_rank'] for p in new), default=None),
        'advanced_returned_editorial_evidence': sum(c['hybrid']['similarity_sources'].get('editorial', 0) for c in advanced),
        'advanced_baseline_ready_editorials': sum(c['baseline']['ready_editorials'] for c in advanced),
        'advanced_hybrid_ready_editorials': sum(c['hybrid']['ready_editorials'] for c in advanced),
        'similarity_range_introduced': [min((p['similarity'] for p in new), default=None), max((p['similarity'] for p in new), default=None)],
        'latency_ms': {'median': statistics.median(c['milliseconds'] for c in cases), 'max': max(c['milliseconds'] for c in cases)},
        'cases_detail': cases,
    }
    destination = ROOT / 'reports/recommendation_quality/evaluation_metrics.json'
    destination.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in summary.items() if k != 'cases_detail'}, indent=2))
    print(f'Per-case metrics saved to {destination}')


if __name__ == '__main__':
    main()
