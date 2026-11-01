-- Additive retrieval storage; does not execute archived migration 003.
BEGIN;
CREATE TABLE IF NOT EXISTS problem_editorial (
 problem_id BIGINT PRIMARY KEY REFERENCES problem(problem_id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(length(trim(body))>0),
 content_hash TEXT NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 source_url TEXT NOT NULL, source_problem_id TEXT NOT NULL, source_revision TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('ready','needs_review')),
 review_reason TEXT NOT NULL DEFAULT '', imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION retrieval_vector_valid(v REAL[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT cardinality(v)=384 AND array_ndims(v)=1
   AND array_position(v,NULL) IS NULL
   AND COALESCE((SELECT bool_and(x>'-Infinity'::real AND x<'Infinity'::real)
      AND sum(x::double precision*x::double precision) BETWEEN 0.99 AND 1.01 FROM unnest(v) x),false)
$$;
CREATE TABLE IF NOT EXISTS retrieval_embedding (
 problem_id BIGINT NOT NULL REFERENCES problem(problem_id) ON DELETE CASCADE,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('editorial','statement')),
 model TEXT NOT NULL, model_revision TEXT NOT NULL, recipe TEXT NOT NULL,
 content_hash TEXT NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 input_hash TEXT NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 embedding REAL[] NOT NULL CHECK(retrieval_vector_valid(embedding)),
 chunk_count INTEGER NOT NULL CHECK(chunk_count>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(problem_id,source_kind,model,model_revision,recipe)
);
ALTER TABLE retrieval_embedding ADD COLUMN IF NOT EXISTS input_hash TEXT NOT NULL
 CHECK(input_hash ~ '^[0-9a-f]{64}$');
-- Old embeddings remain available for provenance but cannot be served when source changes.
CREATE OR REPLACE VIEW retrieval_current_embedding AS
 SELECT e.* FROM retrieval_embedding e
 JOIN problem_editorial pe ON pe.problem_id=e.problem_id AND pe.content_hash=e.content_hash
 WHERE e.source_kind='editorial' AND pe.status='ready'
 UNION ALL
 SELECT e.* FROM retrieval_embedding e
 JOIN problem_statement ps ON ps.problem_id=e.problem_id AND ps.content_hash=e.content_hash
 WHERE e.source_kind='statement';
CREATE OR REPLACE VIEW retrieval_coverage AS
 SELECT count(*) AS catalogue_problems,
 count(ps.problem_id) AS with_statements,
 count(pe.problem_id) AS with_editorials,
 count(pe.problem_id) FILTER(WHERE pe.status='ready') AS ready_editorials,
 count(*) FILTER(WHERE ps.problem_id IS NULL AND pe.problem_id IS NULL) AS without_text
 FROM problem p LEFT JOIN problem_statement ps USING(problem_id)
 LEFT JOIN problem_editorial pe USING(problem_id);
-- Same eligibility and baseline score as 005, with a bounded wider shortlist.
CREATE OR REPLACE FUNCTION recommend_practice_candidates(p_user_id BIGINT,p_mode TEXT DEFAULT 'stretch',p_limit INTEGER DEFAULT 5)
RETURNS TABLE(problem_id BIGINT,contest_id INTEGER,problem_index TEXT,name TEXT,rating INTEGER,
              solved_count INTEGER,score DOUBLE PRECISION,reason TEXT,previous_attempts BIGINT)
LANGUAGE plpgsql STABLE AS $$
DECLARE effective_rating INTEGER; history_count BIGINT; target_rating INTEGER;
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('warm_up','stretch','fix_weaknesses') THEN RAISE EXCEPTION 'Invalid practice mode'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 THEN RAISE EXCEPTION 'Limit must be 1 to 500'; END IF;
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
