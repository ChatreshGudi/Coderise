# Imports, refresh jobs and consistency

## 6. Importing a handle

1. The visitor enters a handle, and the server validates it.
2. Existing imported data can be displayed immediately. A new or refreshed profile starts a tracked import job.
3. A Python worker calls the Codeforces public API for profile information, recent submissions, and rating history.
4. The worker inserts new records or updates existing ones using stable IDs and upserts. This avoids duplicating data on refresh.
5. The job table records progress, completion, or failure. The interface polls job status.
6. PostgreSQL serves the refreshed dashboard and practice data.

Imports currently cover up to 2,000 recent submissions per handle. Therefore solved counts, exclusions, and topic statistics describe imported history, not necessarily the user's entire career. Active-page refresh is polling while the website is open; it is not an unattended scheduler.

## Worker lifecycle and concurrency

lib/sync.ts checks existing data, active jobs, and the latest request before inserting sync_job. Repeated refreshes for a handle are limited to one per minute. The current coordinator limits queued/running jobs to four and marks abandoned jobs older than 15 minutes as failed.

A Python process is launched with shell disabled. scripts/sync_web_job.py updates stage/status, coordinates API work through a PostgreSQL advisory lock, runs imports/reconciliation, and records success/failure. The browser polls the job row. Database uniqueness rules also help prevent duplicate active jobs. This is a small local worker design, not a distributed message queue.

## Upserts, deletes and consistency

Stable external IDs mean refreshing the same source updates records instead of duplicating them. INSERT ... ON CONFLICT handles profile/problem/submission updates. A pending verdict may later become final. Catalogue import replaces the relevant tag links so removed tags do not remain forever. Text/cache invalidation and stale relationship cleanup explain meaningful DELETE operations without adding a destructive public UI.

A transaction protects a related set of database writes. It does not make a remote API request and both databases one atomic operation. Idempotent IDs, source hashes, explicit failure status and retries bridge those boundaries.

## Text and embedding updates

Source records retain revision/URL/ID and content hashes. Editorial status distinguishes ready sources from records needing review. Embeddings also record the prepared-input hash, encoder identity, and recipe. Changed source text hides stale vectors through the current-embedding view. Re-encoding is an explicit offline operation.

An active-page refresh is polling while the website is visible. Closing the site stops it. Catalogue/text/model updates are explicit workflows; there is no unattended nightly scheduler.

## Moving to another machine

Git transports source and configuration examples. A database dump transports imported rows and vectors. The backup utility restore-checks a disposable database and compares counts; the manifest/checksum describes that snapshot. The target needs the required PostgreSQL version and matching pgvector server extension before an appropriate restore. Neo4j must be running/configured and its managed graph can be synced again.

Read docs/WINDOWS.md or docs/FEDORA.md together with docs/PGVECTOR.md. Do not reapply initial schema scripts over a restored database or overwrite an unrelated database.