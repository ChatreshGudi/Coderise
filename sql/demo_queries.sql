-- Coderise presentation queries. Replace the sample handle/id where noted.

-- 1. Inspect core table sizes.
SELECT 'users' AS table_name, count(*) FROM app_user
UNION ALL SELECT 'contests', count(*) FROM contest
UNION ALL SELECT 'problems', count(*) FROM problem
UNION ALL SELECT 'tags', count(*) FROM tag
UNION ALL SELECT 'submissions', count(*) FROM submission;

-- 2. Find a user's latest submissions (replace 'tourist').
SELECT s.submission_id, p.name, p.rating, s.verdict, s.submitted_at
FROM submission s
JOIN app_user u USING (user_id)
JOIN problem p USING (problem_id)
WHERE u.cf_handle = 'tourist'
ORDER BY s.submitted_at DESC
LIMIT 20;

-- 3. Show per-tag proficiency for a user.
SELECT t.name, uts.attempts, uts.accepted, uts.wrong_attempts,
       round(uts.proficiency::numeric, 3) AS proficiency
FROM user_tag_stat uts
JOIN app_user u USING (user_id)
JOIN tag t USING (tag_id)
WHERE u.cf_handle = 'tourist'
ORDER BY uts.proficiency, t.name;

-- 4. Inspect tables and constraints in psql:
-- dt
-- d+ submission
