# Backend, API, validation and security

## 4. Backend: the coordinator

Next.js route handlers and server-only helpers sit between the UI and databases. They validate handles, ratings, modes, page numbers, and problem IDs. SQL values are passed as parameters; sortable fields and modes use allowlists. The server returns the fields needed by the interface rather than exposing database credentials or complete vector arrays.

Main API examples:

- `/api/profiles/[handle]`: imported profile and dashboard information.
- `/api/problems/search`: search, filters, sorting, and pagination.
- `/api/recommendations`: recommendations for a profile and mode.
- `/api/path`: preparation for a problem or topic exploration.
- `/api/sync`: starts or reuses a public-profile import job.

The protected developer console controls catalogue operations using the existing developer token. It is separate from public browsing.

## Request validation and database access

lib/validation.ts validates handles, modes, integers, problem identifiers, topic arrays, and URL parameters. Handles use a bounded character pattern; topic values are deduplicated and bounded. User values are bound as SQL arguments. Sorting uses an allowlist of fixed SQL expressions because arbitrary browser-provided SQL syntax must never be interpolated.

lib/db.ts owns a pg connection pool with a maximum of eight connections, a connection timeout, idle timeout, and a 15-second statement timeout. Reusing connections avoids establishing a new database session for every query. query(sql,args) returns rows to server helpers. The browser never receives the connection password.

lib/request.ts selects a handle from URL parameters or the preference cookie and validates browser origins for state-changing requests. lib/sync.ts coordinates worker jobs. lib/neo4j.ts manages the graph driver. Pure ranking logic is separate from database I/O so its rules can be reasoned about independently.

## Concrete API operations

| Endpoint | Operation |
|---|---|
| GET /api/profiles/[handle] | Imported profile/dashboard information |
| GET /api/problems/search | Catalogue filtering and pagination |
| GET /api/problems/[contest]/[index] | Statement, metadata and attempts |
| GET /api/recommendations | Mode-based baseline/hybrid suggestions |
| GET /api/path | Target preparation or topic exploration |
| POST /api/sync | Start or reuse a public-profile import |
| GET /api/sync/[id] | Job status for browser polling |
| /api/admin/* | Protected developer catalogue actions |

Preparation URLs are parsed as identifiers; the server does not fetch arbitrary submitted URLs. Invalid inputs and missing catalogue records are different cases, normally represented by 400 and 404. Database failure should appear as failure rather than a misleading successful empty result.

## Current security boundaries

Public profiles are intentionally visible to anyone. The handle cookie is a preference, not authentication. The developer console uses a separate shared token and server-side checks. SQL is parameterized; browser POST requests have origin checks; worker processes are started with an argument array and shell disabled.

Ignored .env files keep credentials out of Git but remain plaintext local files. Do not call them encrypted storage. Learner authentication is not implemented.