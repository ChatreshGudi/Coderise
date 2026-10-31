-- Run this once against the existing Coderise database before importing a user.
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS rank_title TEXT;

CREATE OR REPLACE FUNCTION trg_update_user_tag_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.verdict IN ('TESTING', 'SUBMITTED') THEN
        RETURN NEW;
    END IF;

    INSERT INTO user_tag_stat (
        user_id, tag_id, attempts, accepted, wrong_attempts,
        last_solved_at, proficiency
    )
    SELECT
        NEW.user_id,
        pt.tag_id,
        1,
        (NEW.verdict = 'OK')::integer,
        (NEW.verdict NOT IN ('OK', 'COMPILATION_ERROR'))::integer,
        CASE WHEN NEW.verdict = 'OK' THEN NEW.submitted_at END,
        (NEW.verdict = 'OK')::integer::double precision
    FROM problem_tag AS pt
    WHERE pt.problem_id = NEW.problem_id
    ON CONFLICT (user_id, tag_id) DO UPDATE SET
        attempts = user_tag_stat.attempts + 1,
        accepted = user_tag_stat.accepted + EXCLUDED.accepted,
        wrong_attempts = user_tag_stat.wrong_attempts + EXCLUDED.wrong_attempts,
        last_solved_at = CASE
            WHEN EXCLUDED.last_solved_at IS NULL THEN user_tag_stat.last_solved_at
            WHEN user_tag_stat.last_solved_at IS NULL THEN EXCLUDED.last_solved_at
            ELSE GREATEST(user_tag_stat.last_solved_at, EXCLUDED.last_solved_at)
        END,
        proficiency =
            (user_tag_stat.accepted + EXCLUDED.accepted)::double precision
            / (user_tag_stat.attempts + 1);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submission_tag_stats_after_insert ON submission;
CREATE TRIGGER submission_tag_stats_after_insert
AFTER INSERT ON submission
FOR EACH ROW
EXECUTE FUNCTION trg_update_user_tag_stats();

DROP TRIGGER IF EXISTS submission_tag_stats_after_verdict_update ON submission;
CREATE TRIGGER submission_tag_stats_after_verdict_update
AFTER UPDATE OF verdict ON submission
FOR EACH ROW
WHEN (
    OLD.verdict IN ('TESTING', 'SUBMITTED')
    AND NEW.verdict NOT IN ('TESTING', 'SUBMITTED')
)
EXECUTE FUNCTION trg_update_user_tag_stats();