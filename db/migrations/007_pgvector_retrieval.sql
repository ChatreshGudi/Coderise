-- Replace array storage with pgvector without regenerating cached embeddings.
-- Requires 006 and the pgvector server extension package. Never run archived 003.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE EXTENSION IF NOT EXISTS vector;
DROP VIEW retrieval_current_embedding;
ALTER TABLE retrieval_embedding DROP CONSTRAINT IF EXISTS retrieval_embedding_embedding_check;
ALTER TABLE retrieval_embedding ALTER COLUMN embedding TYPE vector(384)
  USING embedding::vector(384);
ALTER TABLE retrieval_embedding ADD CONSTRAINT retrieval_embedding_embedding_check
  CHECK (retrieval_vector_valid(embedding::real[]));
CREATE VIEW retrieval_current_embedding AS
 SELECT e.* FROM retrieval_embedding e
 JOIN problem_editorial pe ON pe.problem_id=e.problem_id AND pe.content_hash=e.content_hash
 WHERE e.source_kind='editorial' AND pe.status='ready'
 UNION ALL
 SELECT e.* FROM retrieval_embedding e
 JOIN problem_statement ps ON ps.problem_id=e.problem_id AND ps.content_hash=e.content_hash
 WHERE e.source_kind='statement';

CREATE INDEX IF NOT EXISTS retrieval_editorial_cosine_hnsw ON retrieval_embedding
 USING hnsw (embedding vector_cosine_ops) WHERE source_kind='editorial';
CREATE INDEX IF NOT EXISTS retrieval_statement_cosine_hnsw ON retrieval_embedding
 USING hnsw (embedding vector_cosine_ops) WHERE source_kind='statement';

-- Choose the mode's eligible history first, then fresh/compatible vectors, and
-- only then cap each channel. Identical source hashes count as one reference.
CREATE OR REPLACE FUNCTION retrieval_references(
 p_user_id bigint,p_mode text,p_model text,p_revision text,p_recipe text,p_limit integer DEFAULT 30)
RETURNS TABLE(problem_id bigint,source_kind text,content_hash text,embedding vector,practiced_at timestamptz)
LANGUAGE plpgsql STABLE AS $$
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('warm_up','stretch','fix_weaknesses') THEN RAISE EXCEPTION 'Invalid practice mode'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Reference limit must be 1 to 100'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app_user u WHERE u.user_id=p_user_id) THEN RAISE EXCEPTION 'Unknown profile'; END IF;
 RETURN QUERY WITH history AS (
  SELECT s.problem_id,max(s.submitted_at) AS practiced_at,bool_or(s.verdict='OK') AS solved
  FROM submission s WHERE s.user_id=p_user_id
   AND s.verdict NOT IN ('TESTING','SUBMITTED','COMPILATION_ERROR') GROUP BY s.problem_id
 ), eligible AS (
  SELECT h.* FROM history h WHERE h.solved=CASE
   WHEN p_mode='fix_weaknesses' AND EXISTS(SELECT 1 FROM history WHERE NOT solved) THEN false
   WHEN EXISTS(SELECT 1 FROM history WHERE solved) THEN true ELSE false END
 ), compatible AS (
  SELECT e.problem_id,e.source_kind,e.content_hash,e.embedding,h.practiced_at,
   row_number() OVER(PARTITION BY e.source_kind,e.content_hash ORDER BY h.practiced_at DESC,e.problem_id) AS duplicate_rank
  FROM eligible h JOIN retrieval_embedding e ON e.problem_id=h.problem_id
  WHERE e.model=p_model AND e.model_revision=p_revision AND e.recipe=p_recipe
   AND ((e.source_kind='editorial' AND EXISTS(
    SELECT 1 FROM problem_editorial pe WHERE pe.problem_id=e.problem_id
     AND pe.content_hash=e.content_hash AND pe.status='ready'))
    OR (e.source_kind='statement' AND EXISTS(
    SELECT 1 FROM problem_statement ps WHERE ps.problem_id=e.problem_id AND ps.content_hash=e.content_hash)))
 ), ranked AS (
  SELECT c.*,row_number() OVER(PARTITION BY c.source_kind ORDER BY c.practiced_at DESC,c.problem_id) AS reference_rank
  FROM compatible c WHERE c.duplicate_rank=1
 )
 SELECT r.problem_id,r.source_kind,r.content_hash,r.embedding,r.practiced_at FROM ranked r
 WHERE r.reference_rank<=p_limit ORDER BY r.source_kind,r.reference_rank;
END;
$$;

-- Exact pgvector distances within the eligible shortlist preserve hard rating
-- and solved exclusions. HNSW is available for open-ended catalogue similarity
-- searches; this bounded scoring query deliberately uses exact comparisons.
CREATE OR REPLACE FUNCTION retrieval_similarities(
 p_problem_ids bigint[],p_user_id bigint,p_mode text,p_model text,p_revision text,p_recipe text,p_limit integer DEFAULT 30)
RETURNS TABLE(problem_id bigint,similarity_source text,semantic_similarity double precision,
 editorial_references integer,statement_references integer,matched_references integer)
LANGUAGE sql STABLE AS $$
 WITH refs AS MATERIALIZED (
  SELECT * FROM retrieval_references(p_user_id,p_mode,p_model,p_revision,p_recipe,p_limit)
 ), counts AS (
  SELECT count(*) FILTER(WHERE source_kind='editorial')::integer AS editorial,
         count(*) FILTER(WHERE source_kind='statement')::integer AS statement FROM refs
 ), pair_scores AS (
  SELECT c.problem_id,c.source_kind,a.problem_id AS reference_id,a.practiced_at,
   greatest(-1.0,least(1.0,1-(c.embedding <=> a.embedding))) AS similarity
  FROM retrieval_current_embedding c JOIN refs a ON a.source_kind=c.source_kind AND a.content_hash<>c.content_hash
  WHERE c.problem_id=ANY(p_problem_ids) AND c.model=p_model AND c.model_revision=p_revision AND c.recipe=p_recipe
 ), ordered AS (
  SELECT s.*,row_number() OVER(PARTITION BY s.problem_id,s.source_kind ORDER BY s.similarity DESC,s.practiced_at DESC,s.reference_id) AS n
  FROM pair_scores s
 ), means AS (
  SELECT s.problem_id,s.source_kind,avg(s.similarity) AS similarity,count(*)::integer AS matched
  FROM ordered s WHERE s.n<=3 GROUP BY s.problem_id,s.source_kind
 ), preferred AS (
  SELECT m.*,row_number() OVER(PARTITION BY m.problem_id ORDER BY CASE m.source_kind WHEN 'editorial' THEN 0 ELSE 1 END) AS n
  FROM means m
 )
 SELECT ids.id,p.source_kind,p.similarity,c.editorial,c.statement,COALESCE(p.matched,0)
 FROM (SELECT DISTINCT unnest(p_problem_ids) AS id) ids CROSS JOIN counts c
 LEFT JOIN preferred p ON p.problem_id=ids.id AND p.n=1;
$$;
ANALYZE retrieval_embedding;
COMMIT;
