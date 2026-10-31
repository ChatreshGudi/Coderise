# Coderise

A Codeforces companion that tracks topic-level practice and recommends what to solve next. It uses the public Codeforces API; it does not submit code or scrape problem statements.

## Recommended setup: local PostgreSQL 17

This is the simplest setup for development and database demos. It uses the PostgreSQL 17 server installed on your computer, which you can inspect with pgAdmin.

### Prerequisites

- Windows with PostgreSQL 17 and pgAdmin
- Python 3.10 or newer
- Internet access for the Codeforces API

### 1. Create the database

1. Open pgAdmin and connect to your local PostgreSQL 17 server.
2. Right-click Databases, choose Create > Database, and name it coderise.
3. Select coderise and open Tools > Query Tool.
4. Open db/init/001_schema.sql and execute it with F5.
5. Open db/migrations/002_submission_tag_stats.sql and execute it with F5.
6. Refresh Schemas > public > Tables.

If Docker is already using port 5432, stop its database first from the project folder:

    docker compose stop postgres

This preserves the Docker database volume.

### 2. Configure the database connection

Copy the example environment file, then edit it with the credentials for your local PostgreSQL server:

    copy .env.example .env
    notepad .env

Set PGUSER and PGPASSWORD to your local PostgreSQL login. Keep PGHOST=localhost, PGPORT=5432, and PGDATABASE=coderise. If .env already exists, add or update those PG settings instead of overwriting it.

The .env file is ignored by Git. Never commit it or share its password.

### 3. Install the importer

Run these commands from the Coderise folder in Command Prompt:

    py -m venv .venv
    .venv\Scripts\activate
    py -m pip install -r requirements.txt

### 4. Import Codeforces data

Import the public contest and problem catalogue:

    py scripts\import_codeforces_catalog.py

Optionally import a public user profile, rating history, and up to 2,000 recent submissions:

    py scripts\import_codeforces_user.py YOUR_CODEFORCES_HANDLE

The user importer stores the handle as unverified. It does not prove ownership or create a login session. It can be rerun safely; submission IDs prevent the same judged submission from being counted twice.

Both importers use the public Codeforces API and wait between API calls. They store catalogue metadata, not problem statements. See the [Codeforces API documentation](https://codeforces.com/apiHelp/methods).

### 5. Inspect the database

Open sql/demo_queries.sql in pgAdmin's Query Tool. Replace YOUR_CODEFORCES_HANDLE with the imported handle in the user-specific queries.

The base schema supports stock PostgreSQL 17. Unrated problems keep a NULL rating. The embedding column is JSONB for now; pgvector search has not been added to this local setup yet.

## Optional Docker database

Docker provides a separate PostgreSQL 16 database with persistent storage. It is useful when you want to recreate the database environment without installing PostgreSQL locally.

1. Start Docker Desktop.
2. Copy .env.example to .env if you have not already, and set POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD for Docker.
3. Run:

       docker compose up -d
       docker compose ps

4. In pgAdmin, register a server with host localhost, port POSTGRES_PORT (5432 by default), database POSTGRES_DB, username POSTGRES_USER, and password POSTGRES_PASSWORD.
5. The first start initializes the schema from db/init/001_schema.sql. Run db/migrations/002_submission_tag_stats.sql manually in pgAdmin.

If local PostgreSQL already uses port 5432, set POSTGRES_PORT=5433 in .env and connect to Docker on port 5433. To run an importer against Docker, also set PGPORT to that host port, PGUSER to POSTGRES_USER, and PGPASSWORD to POSTGRES_PASSWORD.

Docker stores its data in the postgres_data volume. docker compose down stops the service but preserves the data; docker compose down -v deletes the volume and its data. The Docker image includes pgvector, but the current schema does not use its vector type or search features.

## Git and local data

Commit the source files, schema, migrations, and documentation. Do not commit .env, .venv, or PostgreSQL data. A database import changes the local database; it does not add the imported rows to Git.
