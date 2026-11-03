# PostgreSQL design and calculations

## 5. PostgreSQL: the source of truth

The main relational tables represent public Codeforces profiles (`app_user`), contests, problems, tags, problem/tag links, submissions, and rating changes. A problem can have many tags and a tag can belong to many problems, so `problem_tag` is the junction table. Submissions connect a profile to a problem and record verdict, time, language, and resource usage.

Additional tables store statements, editorials, retrieval embeddings, import jobs, and derived topic statistics. Statements and editorials carry source identifiers and hashes so their origin and changes can be tracked.

The name `app_user` is historical: it represents an imported Codeforces profile, not a local login account. `recommendation`, `tag_prerequisite`, and `problem_embedding` include reserved or legacy structures; their presence does not mean every original planned feature is active. Current semantic retrieval uses `retrieval_embedding`; current prerequisite traversal uses Neo4j.

Primary keys identify rows. Foreign keys prevent references to missing parents. Unique constraints prevent duplicates such as repeated contest/problem-index pairs. CHECK constraints reject invalid ratings, counts, verdicts, or vectors. Indexes help common lookup and filtering patterns. Views package reusable queries, and SQL functions implement recommendation candidate selection and vector retrieval.

## 7. Dashboard calculations

The dashboard reads profile metadata, rating changes, and submissions from PostgreSQL. Queries join related tables and aggregate results into unique accepted problems, acceptance statistics, weekly activity, streaks, recent submissions, and topic history.

Topic statistics are maintained through database logic and refresh reconciliation. The submission trigger handles new judged submissions and pending-to-final verdict updates. It should not be described as repairing every possible arbitrary manual edit or deletion. Topic acceptance is an observed statistic, not proof of mastery.

Hover effects and chart selection happen in the frontend; the underlying values come from imported database records.

## Understanding the relationships

contest -> problem is one-to-many. app_user -> submission is one-to-many, and problem -> submission is one-to-many. A submission is one attempt, so repeated attempts remain separate. problem <-> tag is many-to-many through problem_tag. A composite primary key prevents duplicate tag links.

app_user is an imported Codeforces profile, not a website login. Statements and editorials are separate one-to-one problem extensions, avoiding repeated large text in the core problem row. retrieval_embedding can hold different source channels/model recipes for a problem. recommendation, tag_prerequisite, and problem_embedding contain reserved/legacy design structures; they are not evidence that every original planned feature is active.

## Dashboard query details

Recent submissions join submission to problem and order by submitted_at. Rating history joins rating_change to contest. Verdict breakdown groups attempts by verdict. Weekly activity first finds min(submitted_at) per accepted problem within imported history, then groups those first solves into UTC weeks. A generated week series ensures empty weeks still display.

The streak calculation examines distinct UTC accepted days. It starts from today or yesterday and stops at the first gap. Topic history joins user_tag_stat to tag and also counts distinct accepted problems through problem_tag. One problem can contribute to multiple tags, so adding topic totals is not a valid unique-problem total.

## Normalization, constraints and performance

IDs link facts rather than repeating names. A tag name changes in one place. A contest is stored once rather than repeated for every problem. A junction table avoids comma-separated topics. Derived user_tag_stat deliberately duplicates calculated evidence for convenient access; explain its maintenance separately from normalized source facts.

CHECK rules reject invalid values, UNIQUE prevents duplicate identities, and foreign keys prevent orphan records. CASCADE deletes dependent extensions where appropriate; RESTRICT protects referenced catalogue entities. Never describe every foreign key as cascading.

Views are named queries, not automatically stored copies. Functions implement set-based database work. The trigger maintains specific submission-event counters; it does not repair every arbitrary manual final-verdict edit/deletion. Indexes accelerate eligible access patterns at a storage/write cost. PostgreSQL's planner decides whether to use an index; show EXPLAIN rather than claiming guaranteed usage.

## Schema evolution and source files

Read db/init/001_schema.sql and migrations 002, 004, 005, 006, 007. Migration 007 converts retrieval vectors to native vector(384). The untracked 003 draft is not part of the active migration chain. The root CODERISE_DATABASE_DESIGN.md lists exact columns, constraints, indexes, and view definitions.

For the presentation, follow one submission's foreign keys to its profile/problem, then follow that problem's tags. Show a view and a function before explaining query optimization.

## Account and list extension

Migration 008 adds site_account, auth_session, auth_throttle, problem_list and problem_list_item. The physical schema now has 20 tables. Imported app_user profiles stay separate from Coderise login accounts. See [the account/list guide](../ACCOUNTS_LISTS.md) for constraints, session lifecycle, ownership and the new relationships.
