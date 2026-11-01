"""Database regression checks. Every fixture is rolled back."""
import json
import uuid

import psycopg
from dotenv import load_dotenv

from import_codeforces_catalog import db_connect
from retrieval_common import ROOT, CONFIG, text_hash


def main():
    load_dotenv(ROOT / '.env')
    conn = db_connect()
    try:
        users = conn.execute('SELECT user_id FROM app_user').fetchall()
        for (user,) in users:
            for mode in ['warm_up', 'stretch', 'fix_weaknesses']:
                baseline = conn.execute('SELECT * FROM recommend_practice(%s,%s,5)', (user,mode)).fetchall()
                wider = conn.execute('SELECT * FROM recommend_practice_candidates(%s,%s,5)', (user,mode)).fetchall()
                assert baseline == wider, 'Candidate shortlist changed baseline behavior'
        marker = uuid.uuid4().hex
        contest = -1900000000 - int(marker[:5],16)
        pid = -int(marker[:14],16)
        user = conn.execute('INSERT INTO app_user(cf_handle,rating) VALUES(%s,1500) RETURNING user_id',
                            ('retrieval_test_'+marker,)).fetchone()[0]
        conn.execute('INSERT INTO contest(contest_id,name) VALUES(%s,%s)', (contest,'Rollback-only retrieval check'))
        for offset, rating in enumerate([1600,1600,1600,1600,2300]):
            conn.execute('INSERT INTO problem(problem_id,contest_id,problem_index,name,rating,solved_count) '
                         'VALUES(%s,%s,%s,%s,%s,2000000000)',
                         (pid+offset,contest,str(offset),'Rollback fixture',rating))
        # pid+3 is accepted; pid+4 is outside the mode's hard rating band.
        conn.execute("INSERT INTO submission(submission_id,user_id,problem_id,verdict,submitted_at) VALUES(%s,%s,%s,'OK',now())",
                     (pid,user,pid+3))
        candidates = conn.execute("SELECT problem_id FROM recommend_practice_candidates(%s,'stretch',500)",(user,)).fetchall()
        ids = {row[0] for row in candidates}
        assert pid in ids, 'A candidate without either text source was dropped'
        assert pid+3 not in ids and pid+4 not in ids, 'Solved/rating exclusions changed'
        body='A sufficiently long fixture explanation about binary search and monotone feasibility. '*2
        content_hash=text_hash(body)
        conn.execute("INSERT INTO problem_editorial(problem_id,body,content_hash,source_url,source_problem_id,source_revision,status) "
                     "VALUES(%s,%s,%s,'fixture','fixture','fixture','ready')",(pid+1,body,content_hash))
        conn.execute("INSERT INTO problem_statement(problem_id,description,source_url,source_revision,source_problem_id,content_hash) "
                     "VALUES(%s,%s,'fixture','fixture','fixture',%s)",(pid+2,body,content_hash))
        vector=[1.0]+[0.0]*383
        identity=(CONFIG['model'],CONFIG['revision'],CONFIG['recipe'])
        for offset, kind in [(1,'editorial'),(2,'statement')]:
            conn.execute('INSERT INTO retrieval_embedding(problem_id,source_kind,model,model_revision,recipe,content_hash,input_hash,embedding,chunk_count) '
                         'VALUES(%s,%s,%s,%s,%s,%s,%s,%s::real[]::vector,1)',
                         (pid+offset,kind,*identity,content_hash,content_hash,vector))
        assert conn.execute('SELECT count(*) FROM retrieval_current_embedding WHERE problem_id IN(%s,%s)',(pid+1,pid+2)).fetchone()[0]==2
        conn.execute('UPDATE problem_editorial SET content_hash=%s WHERE problem_id=%s',(text_hash('changed'),pid+1))
        conn.execute('UPDATE problem_statement SET content_hash=%s WHERE problem_id=%s',(text_hash('changed'),pid+2))
        assert conn.execute('SELECT count(*) FROM retrieval_current_embedding WHERE problem_id IN(%s,%s)',(pid+1,pid+2)).fetchone()[0]==0, 'Stale vectors remained visible'
        for bad in [[0.0]*384,[float('nan')]+[0.0]*383,[1.0]]:
            rejected=False
            try:
                with conn.transaction():
                    conn.execute('UPDATE retrieval_embedding SET embedding=%s::real[]::vector WHERE problem_id=%s',(bad,pid+1))
            except (psycopg.errors.CheckViolation, psycopg.DataError):
                rejected=True
            assert rejected, 'Invalid vector passed the database constraint'
        print(f'Database checks passed: {len(users)*3} baseline comparisons; missing text, solved/rating exclusions, stale sources and invalid vectors.')
    finally:
        conn.rollback()
        conn.close()


if __name__ == '__main__': main()
