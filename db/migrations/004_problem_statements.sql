-- Independent of pgvector migration 003; may be applied before it.
CREATE TABLE IF NOT EXISTS problem_statement (
    problem_id BIGINT PRIMARY KEY REFERENCES problem(problem_id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    input_format TEXT NOT NULL DEFAULT '',
    output_format TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    examples JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(examples) = 'array'),
    source_url TEXT NOT NULL,
    source_revision TEXT NOT NULL,
    source_problem_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW statement_coverage AS
SELECT count(*) AS catalogue_problems,
       count(ps.problem_id) AS with_statements,
       count(*) - count(ps.problem_id) AS without_statements
FROM problem p LEFT JOIN problem_statement ps USING (problem_id);
