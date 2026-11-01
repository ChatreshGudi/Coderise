"""Read-only content audit of the existing before/after recommendation report."""
import collections
import json
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

from import_codeforces_catalog import db_connect
from retrieval_common import ROOT, CONFIG, atomic_json


def main():
    load_dotenv(ROOT / '.env')
    comparison=json.loads((ROOT/'reports/recommendation_comparison.json').read_text())
    identity=(CONFIG['model'],CONFIG['revision'],CONFIG['recipe'])
    audit=[]
    documents={}
    with db_connect() as conn:
        conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
        for case in comparison:
            handle,mode=case['handle'],case['mode']
            uid,rating,last_synced=conn.execute('SELECT user_id,rating,last_synced_at FROM app_user WHERE cf_handle=%s',(handle,)).fetchone()
            history=conn.execute("""SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,
              max(s.submitted_at) AS practiced_at,bool_or(s.verdict='OK') AS solved
              FROM submission s JOIN problem p USING(problem_id)
              WHERE user_id=%s AND verdict NOT IN ('TESTING','SUBMITTED','COMPILATION_ERROR')
              GROUP BY p.problem_id ORDER BY practiced_at DESC,p.problem_id""",(uid,)).fetchall()
            want_solved=not(mode=='fix_weaknesses' and any(not r[6] for r in history)) and any(r[6] for r in history)
            eligible_history=[r for r in history if r[6]==want_solved]
            selected_refs=conn.execute('SELECT problem_id,source_kind FROM retrieval_references(%s,%s,%s,%s,%s,%s)', (uid,mode,*identity,CONFIG['anchorLimit'])).fetchall()
            selected_pairs=set(selected_refs)
            anchors=[r for r in eligible_history if any(pid==r[0] for pid,_ in selected_refs)]
            history_vectors=set(conn.execute(
                'SELECT problem_id,source_kind FROM retrieval_current_embedding '
                'WHERE problem_id=ANY(%s) AND model=%s AND model_revision=%s AND recipe=%s',
                ([r[0] for r in eligible_history],*identity)).fetchall())
            history_coverage={kind:sum((r[0],kind) in history_vectors for r in eligible_history)
                              for kind in ['editorial','statement']}
            older_references={kind:[f'{r[1]}/{r[2]}' for r in eligible_history[CONFIG['anchorLimit']:]
                                    if (r[0],kind) in history_vectors][:5]
                              for kind in ['editorial','statement']}
            candidates=conn.execute('SELECT * FROM recommend_practice_candidates(%s,%s,%s)',(uid,mode,CONFIG['candidateLimit'])).fetchall()
            ids={r[0] for r in candidates}|{r[0] for r in anchors}
            records=conn.execute("""SELECT p.problem_id,p.contest_id,p.problem_index,p.name,p.rating,
                c.start_time,ps.description,pe.body,pe.status,
                ARRAY(SELECT t.name FROM problem_tag pt JOIN tag t USING(tag_id) WHERE pt.problem_id=p.problem_id ORDER BY t.name)
                FROM problem p JOIN contest c USING(contest_id) LEFT JOIN problem_statement ps USING(problem_id)
                LEFT JOIN problem_editorial pe USING(problem_id) WHERE p.problem_id=ANY(%s)""",(list(ids),)).fetchall()
            meta={r[0]:dict(problem_id=r[0],key=f'{r[1]}/{r[2]}',name=r[3],rating=r[4],date=str(r[5]),
                           statement=r[6],editorial=r[7],editorial_status=r[8],tags=r[9]) for r in records}
            vectors={(pid,kind):(content_hash,np.array(vector,dtype=float)) for pid,kind,content_hash,vector in conn.execute(
                'SELECT problem_id,source_kind,content_hash,embedding::real[] FROM retrieval_current_embedding '
                'WHERE problem_id=ANY(%s) AND model=%s AND model_revision=%s AND recipe=%s',(list(ids),*identity))}
            anchor_counts={kind:sum((r[0],kind) in selected_pairs for r in anchors) for kind in ['editorial','statement']}
            details={}
            groups=collections.Counter()
            for candidate in candidates:
                pid=candidate[0]
                for kind in ['editorial','statement']:
                    if (pid,kind) not in vectors: continue
                    h,v=vectors[pid,kind]
                    matches=[]
                    for anchor in anchors:
                        if (anchor[0],kind) not in vectors or (anchor[0],kind) not in selected_pairs: continue
                        ah,av=vectors[anchor[0],kind]
                        if ah==h: continue
                        score=float(v@av/(np.linalg.norm(v)*np.linalg.norm(av)))
                        matches.append(dict(key=meta[anchor[0]]['key'],similarity=score,tags=meta[anchor[0]]['tags'],
                                            name=meta[anchor[0]]['name']))
                    if matches:
                        matches.sort(key=lambda r:-r['similarity'])
                        details[pid]=dict(kind=kind,similarity=float(np.mean([r['similarity'] for r in matches[:3]])),matches=matches[:3])
                        groups[kind]+=1
                        break
            by_key={value['key']:pid for pid,value in meta.items()}
            # The saved before/after comparison must still describe this snapshot.
            for pick in case['hybrid']:
                if pick.get('semantic_similarity') is not None:
                    detail=details[by_key[pick['key']]]
                    assert detail['kind']==pick['similarity_source']
                    assert abs(detail['similarity']-pick['semantic_similarity'])<1e-5
            ranks={row[0]:i+1 for i,row in enumerate(candidates)}
            reviewed=[]
            selected={r['key'] for r in case['baseline']}|{r['key'] for r in case['hybrid']}
            # Include the strongest statement fallback even when it misses the top five.
            statement_candidates=[pid for pid,d in details.items() if d['kind']=='statement']
            if statement_candidates:
                selected.add(meta[max(statement_candidates,key=lambda pid:details[pid]['similarity'])]['key'])
            for key in sorted(selected):
                if key not in by_key: continue
                pid=by_key[key]
                detail=details.get(pid)
                reviewed.append(dict(**{k:v for k,v in meta[pid].items() if k not in ('statement','editorial')},
                                     baseline_rank=ranks.get(pid),similarity=detail))
                documents[key]=meta[pid]
                if detail:
                    for match in detail['matches']:
                        documents[match['key']]=meta[by_key[match['key']]]
            baseline={r['key'] for r in case['baseline']}
            hybrid={r['key'] for r in case['hybrid']}
            audit.append(dict(handle=handle,mode=mode,rating=rating,last_synced_at=str(last_synced),
                reference_history='solved' if want_solved else 'unsolved attempts',anchors=len(anchors),
                anchor_vectors=anchor_counts,candidates=len(candidates),comparable_channels=dict(groups),
                eligible_history=len(eligible_history),history_vectors=history_coverage,
                older_compatible_references=older_references,
                overlap=len(baseline&hybrid),introduced=sorted(hybrid-baseline),removed=sorted(baseline-hybrid),
                picks=reviewed))
    folder=ROOT/'reports/recommendation_quality'
    atomic_json(folder/'audit.json',audit)
    atomic_json(folder/'documents.json',documents)
    for row in audit:
        print(row['handle'],row['mode'],'anchors',row['anchors'],row['anchor_vectors'],
              'all history',row['eligible_history'],row['history_vectors'],
              'channels',row['comparable_channels'],'overlap',row['overlap'],'introduced',row['introduced'])
    print('Content and reference matches saved under reports/recommendation_quality/')


if __name__=='__main__': main()
