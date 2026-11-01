-- Web workspace support. Independent of the experimental vector migration 003.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_handle_ci_idx ON app_user (lower(cf_handle));
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS sync_job (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('profile','catalogue')),
    handle TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
    stage TEXT NOT NULL DEFAULT 'Waiting to import',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
    counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    CHECK ((kind='profile' AND handle IS NOT NULL) OR kind='catalogue')
);
CREATE UNIQUE INDEX IF NOT EXISTS sync_job_active_profile_idx ON sync_job(lower(handle))
    WHERE kind='profile' AND status IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS sync_job_active_catalogue_idx ON sync_job(kind)
    WHERE kind='catalogue' AND status IN ('queued','running');
CREATE INDEX IF NOT EXISTS sync_job_latest_idx ON sync_job(created_at DESC);
CREATE INDEX IF NOT EXISTS problem_name_search_idx ON problem USING gin(to_tsvector('simple',name));

CREATE OR REPLACE VIEW user_practice_summary AS
SELECT u.user_id,u.cf_handle,u.rating,u.max_rating,u.rank_title,u.country,u.last_synced_at,
       count(s.submission_id) AS submission_count,
       count(DISTINCT s.problem_id) FILTER (WHERE s.verdict='OK') AS solved_count,
       count(DISTINCT s.problem_id) AS attempted_count,
       count(s.submission_id) FILTER (WHERE s.verdict='OK') AS accepted_submissions,
       min(s.submitted_at) AS history_start,
       max(s.submitted_at) AS latest_submission,
       count(s.submission_id) FILTER (WHERE s.verdict NOT IN ('TESTING','SUBMITTED')) AS judged_count
FROM app_user u LEFT JOIN submission s USING(user_id) GROUP BY u.user_id;

-- Transparent initial practice baseline; independent of embeddings and model downloads.
CREATE OR REPLACE FUNCTION recommend_practice(p_user_id BIGINT,p_mode TEXT DEFAULT 'stretch',p_limit INTEGER DEFAULT 5)
RETURNS TABLE(problem_id BIGINT,contest_id INTEGER,problem_index TEXT,name TEXT,rating INTEGER,
              solved_count INTEGER,score DOUBLE PRECISION,reason TEXT,previous_attempts BIGINT)
LANGUAGE plpgsql STABLE AS $$
DECLARE effective_rating INTEGER; history_count BIGINT; target_rating INTEGER;
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('warm_up','stretch','fix_weaknesses') THEN RAISE EXCEPTION 'Invalid practice mode'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>20 THEN RAISE EXCEPTION 'Limit must be 1 to 20'; END IF;
 SELECT COALESCE(u.rating,(SELECT max(p.rating) FROM submission s JOIN problem p USING(problem_id)
                          WHERE s.user_id=u.user_id AND s.verdict='OK')+100,1000)
 INTO effective_rating FROM app_user u WHERE u.user_id=p_user_id;
 IF effective_rating IS NULL THEN RAISE EXCEPTION 'Unknown profile'; END IF;
 IF p_mode='stretch' AND effective_rating>=3500 THEN RETURN; END IF;
 SELECT count(*) INTO history_count FROM submission s WHERE s.user_id=p_user_id AND s.verdict NOT IN ('TESTING','SUBMITTED');
 target_rating:=greatest(800,least(3500,effective_rating+CASE p_mode WHEN 'warm_up' THEN -100 WHEN 'stretch' THEN 100 ELSE 0 END));
 RETURN QUERY WITH candidates AS (
   SELECT p.*, COALESCE(a.attempts,0) AS attempts,
     COALESCE((SELECT avg(1-uts.proficiency) FROM problem_tag pt JOIN user_tag_stat uts USING(tag_id)
               WHERE pt.problem_id=p.problem_id AND uts.user_id=p_user_id),0)::double precision AS weakness,
     (SELECT t.name FROM problem_tag pt JOIN user_tag_stat uts USING(tag_id) JOIN tag t USING(tag_id)
       WHERE pt.problem_id=p.problem_id AND uts.user_id=p_user_id ORDER BY uts.proficiency,t.name LIMIT 1) AS weak_tag,
     greatest(0.0,1-abs(p.rating-target_rating)/500.0)::double precision AS difficulty_fit
   FROM problem p LEFT JOIN LATERAL (SELECT count(*) AS attempts FROM submission s
     WHERE s.user_id=p_user_id AND s.problem_id=p.problem_id AND s.verdict NOT IN ('TESTING','SUBMITTED')) a ON true
   WHERE p.rating BETWEEN greatest(800,target_rating-300) AND least(3500,target_rating+300)
     AND NOT EXISTS(SELECT 1 FROM submission s WHERE s.user_id=p_user_id AND s.problem_id=p.problem_id AND s.verdict='OK')
 ), ranked AS (
   SELECT c.*, CASE WHEN p_mode='fix_weaknesses' AND history_count>=20
     THEN .45*c.difficulty_fit+.35*c.weakness+.15*ln(1+c.solved_count)/greatest(1,max(ln(1+c.solved_count)) OVER())
          +CASE WHEN c.attempts>0 THEN .05 ELSE 0 END
     ELSE .75*c.difficulty_fit+.20*ln(1+c.solved_count)/greatest(1,max(ln(1+c.solved_count)) OVER())
          +CASE WHEN c.attempts>0 THEN .05 ELSE 0 END END::double precision AS rank_score
   FROM candidates c
 )
 SELECT r.problem_id,r.contest_id,r.problem_index,r.name,r.rating,r.solved_count,r.rank_score,
   CASE WHEN r.attempts>0 THEN 'Previously attempted without an accepted verdict.'
        WHEN p_mode='fix_weaknesses' AND history_count>=20 AND r.weak_tag IS NOT NULL AND r.weakness>0
          THEN 'Practice '||r.weak_tag||', a topic with unsuccessful attempts in your imported history.'
        WHEN p_mode='warm_up' THEN 'A comfortable rating range for a warm-up.'
        WHEN p_mode='stretch' THEN 'A step above your effective practice rating.'
        WHEN history_count<20 THEN 'Within your starting difficulty range; more history is needed for weakness analysis.'
        ELSE 'Near your practice difficulty, without a reliable weak-topic signal for this candidate.' END,
   r.attempts
 FROM ranked r ORDER BY r.rank_score DESC,r.solved_count DESC,r.problem_id LIMIT p_limit;
END;
$$;
COMMIT;
