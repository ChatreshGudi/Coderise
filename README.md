# Coderise

A Codeforces companion that tracks topic-level practice and recommends what to solve next. It uses public Codeforces data only; it does not submit code or scrape problem statements.

## Recommended development setup: local PostgreSQL 17

Use the existing PostgreSQL 17 server in pgAdmin. Local PostgreSQL keeps the database easy to inspect and query during your demo.

1. If Docker is using port 5432, stop its database from this folder:
       docker compose stop postgres
   This preserves its Docker volume.
2. Connect to the local PostgreSQL 17 server in pgAdmin with the credentials set during local installation.
3. Create a database named coderise (right-click Databases > Create > Database).
4. Select coderise and open Tools > Query Tool.
5. Open db/init/001_schema.sql in the Query Tool and execute it (F5).
6. Refresh Schemas > public > Tables.

The base schema works with stock PostgreSQL 17 and does not require pgvector. problem_embedding.embedding is JSONB for now; we can install pgvector and migrate that column when vector search is implemented.

## Import the real public Codeforces catalogue

The importer fetches contests, problems, ratings, solved counts, and tags from the Codeforces public API. It does not create simulated users or submissions. It waits between API calls, uses idempotent upserts, and can be rerun to refresh the catalogue.

1. Copy .env.example to .env.
2. In .env, set PGUSER and PGPASSWORD to your local PostgreSQL 17 login. Keep PGDATABASE=coderise.
3. From the Coderise folder, create a Python environment and install the importer dependencies:
       py -m venv .venv
       .venv\Scripts\activate
       py -m pip install -r requirements.txt
4. Run the importer:
       py scripts/import_codeforces_catalog.py

The script reads .env, connects to localhost:5432, and reports how many contests, problems, and problem-tag links it processed. The API returns public catalogue metadata, not problem statements. See the official Codeforces API documentation for problemset.problems and contest.list:
https://codeforces.com/apiHelp/methods

## Inspect the imported data

Run the queries in sql/demo_queries.sql from pgAdmin's Query Tool. Useful starter checks include:

    SELECT count(*) FROM problem;
    SELECT count(*) FROM tag;
    SELECT p.name, p.rating, p.solved_count
    FROM problem p
    ORDER BY p.solved_count DESC
    LIMIT 20;

## Optional Docker setup

Docker remains available as an alternative reproducible environment. Copy .env.example to .env and run docker compose up -d. In pgAdmin use host localhost, port 5432, database coderise, user coderise, and the Docker password from POSTGRES_PASSWORD.

Docker uses a separate PostgreSQL 16 container and persistent postgres_data volume. It is a different database from local PostgreSQL 17; stop one if both need port 5432. docker compose down preserves the volume, while docker compose down -v deletes it.

Docker initialization scripts run only when its data directory is empty. For an existing Docker volume, apply schema changes manually.