-- Run in pgAdmin against coderise_windows after migration 007.
-- These queries are read-only. No model server or Python encoder is involved.

-- 1. Prove this is native pgvector storage, not JSON or a float array.
SELECT extname,extversion FROM pg_extension WHERE extname='vector';
SELECT format_type(atttypid,atttypmod) AS embedding_type
FROM pg_attribute WHERE attrelid='retrieval_embedding'::regclass AND attname='embedding';
SELECT source_kind,count(*) AS stored_vectors, min(vector_dims(embedding)) AS dimensions
FROM retrieval_embedding GROUP BY source_kind;
SELECT indexname,indexdef FROM pg_indexes WHERE tablename='retrieval_embedding';

-- 2. Find problems with similar solution explanations to a stored reference.
-- The reference is selected from tourist's recent compatible practice history.
-- Same model/revision/recipe, fresh source hash, and editorial status are required.
WITH reference AS MATERIALIZED (
 SELECT e.* FROM retrieval_references(
  (SELECT user_id FROM app_user WHERE cf_handle='tourist'),'stretch',
  'sentence-transformers/all-MiniLM-L6-v2','1110a243fdf4706b3f48f1d95db1a4f5529b4d41',
  'onnx-fp32-window224-stride192-normalized-mean-v1',1) e WHERE e.source_kind='editorial'
)
SELECT p.contest_id,p.problem_index,p.name,p.rating,
       round((1-(e.embedding <=> r.embedding))::numeric,4) AS cosine_similarity
FROM retrieval_embedding e CROSS JOIN reference r
JOIN problem p ON p.problem_id=e.problem_id
JOIN problem_editorial pe ON pe.problem_id=e.problem_id AND pe.content_hash=e.content_hash AND pe.status='ready'
WHERE e.source_kind='editorial' AND e.model='sentence-transformers/all-MiniLM-L6-v2'
 AND e.model_revision='1110a243fdf4706b3f48f1d95db1a4f5529b4d41'
 AND e.recipe='onnx-fp32-window224-stride192-normalized-mean-v1'
 AND e.content_hash<>r.content_hash
ORDER BY e.embedding <=> r.embedding LIMIT 10;


-- 3. Show the corrected reference counts, separately for each source channel.
SELECT u.cf_handle,r.source_kind,count(*) AS compatible_references
FROM app_user u CROSS JOIN LATERAL retrieval_references(u.user_id,'stretch',
 'sentence-transformers/all-MiniLM-L6-v2','1110a243fdf4706b3f48f1d95db1a4f5529b4d41',
 'onnx-fp32-window224-stride192-normalized-mean-v1',30) r
GROUP BY u.cf_handle,r.source_kind ORDER BY u.cf_handle,r.source_kind;

-- 4. Inspect the exact SQL similarity evidence sent to the app for a shortlist.
-- These scores are cosine similarities, NOT solve probabilities.
WITH candidates AS MATERIALIZED (
 SELECT * FROM recommend_practice_candidates(
  (SELECT user_id FROM app_user WHERE cf_handle='Petr'),'stretch',500)
), scores AS (
 SELECT * FROM retrieval_similarities((SELECT array_agg(problem_id) FROM candidates),
  (SELECT user_id FROM app_user WHERE cf_handle='Petr'),'stretch',
  'sentence-transformers/all-MiniLM-L6-v2','1110a243fdf4706b3f48f1d95db1a4f5529b4d41',
  'onnx-fp32-window224-stride192-normalized-mean-v1',30)
)
SELECT c.contest_id,c.problem_index,c.name,c.rating,c.score AS baseline_score,
 s.similarity_source,round(s.semantic_similarity::numeric,4) AS similarity,
 s.editorial_references,s.statement_references
FROM candidates c JOIN scores s USING(problem_id)
ORDER BY s.semantic_similarity DESC NULLS LAST,c.problem_id LIMIT 10;
