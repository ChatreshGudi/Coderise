# Coderise: detailed implementation and presentation guides

Read the guides in order. They explain the current implementation, how requests move through the code, what each database does, and the limitations to state during a presentation.

1. [Architecture and data flow](01_ARCHITECTURE.md)
2. [Frontend and browser behavior](02_FRONTEND.md)
3. [Backend, API, validation and security](03_BACKEND_API.md)
4. [PostgreSQL design and calculations](04_POSTGRESQL.md)
5. [Imports and synchronization](05_IMPORTS_SYNC.md)
6. [Recommendations and pgvector](06_RECOMMENDATIONS_PGVECTOR.md)
7. [Neo4j and problem preparation](07_NEO4J_PREPARATION.md)
8. [Presentation and viva](08_DEMO_AND_VIVA.md)
9. [Accounts, profiles, private lists and security](../ACCOUNTS_LISTS.md)

The root CODERISE_DATABASE_DESIGN.md is the exact schema reference contributed through GitHub. These guides explain the behavior around that schema. Optional Coderise accounts now save private lists and preferences; public Codeforces browsing remains available.

Paths in these guides are relative to the repository root, so they work on Windows and Fedora. Documentation explains the implementation; it does not imply that new tests were run when these files were written.