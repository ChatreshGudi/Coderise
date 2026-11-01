"""Run a durable web-requested import using the existing public API importers."""
import json
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from psycopg.types.json import Jsonb
from import_codeforces_catalog import db_connect, fetch_api as fetch_catalog, upsert_catalog
from import_codeforces_user import fetch_api, import_user, SUBMISSION_LIMIT

ROOT = Path(__file__).resolve().parents[1]

def main(job_id):
    load_dotenv(ROOT / '.env')
    # One public API consumer at a time across website jobs on this database.
    with db_connect() as lock_connection:
        lock_connection.autocommit = True
        lock_connection.execute('SELECT pg_advisory_lock(79204136)')
        row = lock_connection.execute("SELECT kind,handle FROM sync_job WHERE job_id=%s AND status='queued'", (job_id,)).fetchone()
        if row is None:
            return
        def stage(text):
            lock_connection.execute("UPDATE sync_job SET stage=%s WHERE job_id=%s", (text,job_id))
        lock_connection.execute("UPDATE sync_job SET status='running',started_at=now(),stage='Fetching public profile' WHERE job_id=%s", (job_id,))
        try:
            kind, handle = row
            if kind == 'profile':
                profile = fetch_api('user.info', {'handles':handle})[0]
                canonical = profile['handle']
                stage('Importing rating history'); time.sleep(2.1)
                ratings = fetch_api('user.rating', {'handle':canonical})
                stage('Importing recent submissions'); time.sleep(2.1)
                submissions = fetch_api('user.status', {'handle':canonical,'from':'1','count':str(SUBMISSION_LIMIT)})
                result = import_user(canonical, profile, ratings, submissions)
                lock_connection.execute('UPDATE app_user SET last_synced_at=now() WHERE lower(cf_handle)=lower(%s)', (canonical,))
                counts = dict(rating_changes=result[0], submissions_processed=result[1], skipped=result[2])
                lock_connection.execute('UPDATE sync_job SET handle=%s WHERE job_id=%s', (canonical,job_id))
            else:
                def snapshot(connection):
                    return {r[0]:(r[1],r[2],tuple(r[3])) for r in connection.execute('''
                      SELECT p.problem_id,p.name,p.rating,COALESCE(array_agg(t.name ORDER BY t.name)
                        FILTER(WHERE t.name IS NOT NULL),'{}')
                      FROM problem p LEFT JOIN problem_tag pt USING(problem_id) LEFT JOIN tag t USING(tag_id)
                      GROUP BY p.problem_id''').fetchall()}
                before=snapshot(lock_connection)
                stage('Fetching contest catalogue'); contests=fetch_catalog('contest.list'); time.sleep(2.1)
                stage('Importing problem catalogue'); catalogue=fetch_catalog('problemset.problems')
                result=upsert_catalog(contests,catalogue.get('problems',[]),catalogue.get('problemStatistics',[]))
                counts=dict(contests=result[0],problems=result[1],tag_links=result[2])
                # Catalogue tag changes must not leave historical topic counters stale.
                with db_connect() as connection:
                    after=snapshot(connection)
                    changed=[pid for pid,metadata in after.items() if before.get(pid)!=metadata]
                    if changed:
                        removed=connection.execute('DELETE FROM problem_embedding WHERE problem_id=ANY(%s)', (changed,))
                        counts['vectors_invalidated']=removed.rowcount
                        if connection.execute("SELECT to_regclass('public.user_embedding')").fetchone()[0] is not None:
                            connection.execute('''DELETE FROM user_embedding ue WHERE EXISTS(
                              SELECT 1 FROM submission s WHERE s.user_id=ue.user_id AND s.verdict='OK' AND s.problem_id=ANY(%s))''',(changed,))
                    connection.execute('''INSERT INTO user_tag_stat(user_id,tag_id,attempts,accepted,wrong_attempts,last_solved_at,proficiency)
                      SELECT s.user_id,pt.tag_id,count(*)::int,count(*) FILTER(WHERE s.verdict='OK')::int,
                        count(*) FILTER(WHERE s.verdict NOT IN ('OK','COMPILATION_ERROR'))::int,
                        max(s.submitted_at) FILTER(WHERE s.verdict='OK'),
                        count(*) FILTER(WHERE s.verdict='OK')::double precision/count(*)
                      FROM submission s JOIN problem_tag pt USING(problem_id)
                      WHERE s.verdict NOT IN ('TESTING','SUBMITTED') GROUP BY s.user_id,pt.tag_id
                      ON CONFLICT(user_id,tag_id) DO UPDATE SET attempts=EXCLUDED.attempts,accepted=EXCLUDED.accepted,
                        wrong_attempts=EXCLUDED.wrong_attempts,last_solved_at=EXCLUDED.last_solved_at,proficiency=EXCLUDED.proficiency''')
                    connection.execute('''DELETE FROM user_tag_stat uts WHERE NOT EXISTS (
                      SELECT 1 FROM submission s JOIN problem_tag pt USING(problem_id)
                      WHERE s.user_id=uts.user_id AND pt.tag_id=uts.tag_id AND s.verdict NOT IN ('TESTING','SUBMITTED'))''')
            lock_connection.execute("UPDATE sync_job SET status='completed',stage='Import complete',counts=%s,finished_at=now() WHERE job_id=%s", (Jsonb(counts),job_id))
        except Exception as exc:
            lock_connection.execute("UPDATE sync_job SET status='failed',stage='Import failed',error_message=%s,finished_at=now() WHERE job_id=%s", (str(exc)[:1000],job_id))
            raise
        finally:
            time.sleep(2.1)
            lock_connection.execute('SELECT pg_advisory_unlock(79204136)')

if __name__ == '__main__':
    main(sys.argv[1])
