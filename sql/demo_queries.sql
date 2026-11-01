-- Run against the Coderise database after migrations 002, 004 and 005.
-- Replace YOUR_CODEFORCES_HANDLE with an imported public handle.

SELECT 'users' AS table_name,count(*) FROM app_user
UNION ALL SELECT 'contests',count(*) FROM contest
UNION ALL SELECT 'problems',count(*) FROM problem
UNION ALL SELECT 'tags',count(*) FROM tag
UNION ALL SELECT 'submissions',count(*) FROM submission;

SELECT * FROM statement_coverage;

SELECT * FROM user_practice_summary
WHERE lower(cf_handle)=lower('YOUR_CODEFORCES_HANDLE');

SELECT s.submission_id,p.name,p.rating,s.verdict,s.submitted_at
FROM submission s JOIN app_user u USING(user_id) JOIN problem p USING(problem_id)
WHERE lower(u.cf_handle)=lower('YOUR_CODEFORCES_HANDLE')
ORDER BY s.submitted_at DESC LIMIT 20;

SELECT t.name,uts.attempts,uts.accepted,uts.wrong_attempts,
       round(uts.proficiency::numeric,3) AS observed_acceptance
FROM user_tag_stat uts JOIN app_user u USING(user_id) JOIN tag t USING(tag_id)
WHERE lower(u.cf_handle)=lower('YOUR_CODEFORCES_HANDLE')
ORDER BY uts.proficiency,t.name;

-- Current website baseline. Modes: warm_up, stretch, fix_weaknesses.
SELECT r.* FROM app_user u
CROSS JOIN LATERAL recommend_practice(u.user_id,'stretch',5) r
WHERE lower(u.cf_handle)=lower('YOUR_CODEFORCES_HANDLE');

SELECT p.contest_id,p.problem_index,p.name,p.rating
FROM problem p LEFT JOIN problem_statement ps USING(problem_id)
WHERE ps.problem_id IS NULL ORDER BY p.contest_id DESC,p.problem_index LIMIT 20;

SELECT kind,handle,status,stage,created_at,finished_at,counts
FROM sync_job ORDER BY created_at DESC LIMIT 20;
