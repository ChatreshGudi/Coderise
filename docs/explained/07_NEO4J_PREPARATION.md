# Neo4j and problem preparation

## 9. How preparation for a specific problem works

1. The user supplies a Codeforces problem ID or canonical URL. The URL is parsed as an identifier; the server does not fetch arbitrary URLs.
2. PostgreSQL returns the target problem, rating, and tags.
3. Supported tags become simultaneous goals in the curated Neo4j prerequisite graph.
4. Neo4j returns their combined prerequisite branches, rather than only one shortest route.
5. PostgreSQL supplies rated practice problems for each topic, excluding the target, accepted problems in imported history, and duplicates across the plan.
6. The frontend displays the map, topic explanations, and practice cards, then links back to the original target.

The graph currently contains 19 curated topics and 21 prerequisite edges. These are explicit human-designed background relationships, not prerequisites inferred by an LLM. Unmapped tags are labelled and may receive direct tag-based practice without invented graph edges.

Practice difficulty considers both learner and target rating. An 800-rated target has no lower rated catalogue band, so the UI explicitly shows same-rating practice. Unrated targets use learner-based difficulty without claiming that suggestions are easier.

This feature uses graph, topic, and rating rules. The separate Recommendations screen uses the pgvector hybrid. Preparation does not analyze a target solution or guarantee that it identifies the crucial observation.

## 10. Why Neo4j is useful

Neo4j stores topics connected by `PREREQUISITE_OF` relationships, including explanations for the edges. It also holds a derived public-practice projection: Profile -> SOLVED -> Problem -> HAS_TAG -> Topic. This allows traversal from a goal through its background and into existing accepted examples.

PostgreSQL remains authoritative for imported records. The graph projection is refreshed from PostgreSQL snapshots when map requests need it. Snapshot hashes and transactions avoid unnecessary or inconsistent rewrites. Losing the projection does not mean losing the original Codeforces history; it can be rebuilt.

## Difficulty and allocation details

lib/preparation-rules.ts computes the band from learner and target rating. Normal center starts at learner effective rating -100, capped toward target rating -200. The range is center ±200 with upper cap target rating -100 for ordinary rated targets. Minimum target 800 explicitly permits same-rating practice; an unrated target uses learner difficulty without claiming easier problems.

A candidate must match the topic, be within the band, differ from the target and have no imported accepted verdict. It is ordered by rating fit, fewer extra topics, popularity and stable identity. Round-robin allocation gives each topic up to three problems while a global used-ID set prevents repeats. Empty pools remain empty rather than silently weakening the rules.

## Graph projection and transactions

The managed labels are CoderiseTopic, CoderiseGraph, CoderiseProfile and CoderiseProblem. Relationships are PREREQUISITE_OF, SOLVED and HAS_TAG. Unique key constraints avoid duplicate managed identities. PostgreSQL supplies the public accepted-history snapshot; Neo4j stores a derived projection for traversal.

A map request compares snapshot hashes/version metadata and refreshes the projection when necessary. Per-profile coordination and timestamps guard concurrent/stale updates, and related graph writes use a Neo4j transaction. This is synchronization, not one transaction spanning PostgreSQL and Neo4j.

## Following the source code

lib/problem-preparation.ts orchestrates the target and practice pools. lib/preparation-rules.ts implements parsing, bands and duplicate-free allocation. lib/learning-path.ts performs graph/evidence retrieval. config/learning-topics.json defines the curated edges. components/learning-map.tsx displays graph/list inspection.

The target's supported tags become simultaneous goals. The union of their ancestor branches is useful; a single shortest route would omit background branches. Unmapped tags can still receive direct practice but never invented prerequisites. Preparation uses these rules, while the separate Recommendations page uses pgvector hybrid ranking.

---

# Prepare for a problem

The default `/path?handle=Chatresh` screen is now **problem-first**. Paste a
Codeforces problem ID or canonical contest/problemset URL. Coderise looks it up
in the local catalogue, uses all mapped Codeforces tags as simultaneous graph
goals, retrieves their combined background from Neo4j, and suggests up to three
unsolved practice problems per topic. The target itself is excluded.

The main flow is **problem -> suggested background -> practice -> retry**.
`/path?handle=Chatresh&view=topic&target=dp` retains topic exploration as a secondary
mode. No starting-topic input has been reintroduced. Problem detail pages include
“Stuck? Build preparation”. Existing accepted examples remain available inside a
collapsed “Your existing practice” section, rather than being the main result.

## Practice selection and limits

- Target metadata/tags come from PostgreSQL, not generated solution analysis.
  No target editorial or LLM solution is used or exposed.
- The effective learner rating is their Codeforces rating, or highest rated accepted
  problem +100, or 1000 with no rated accepted history. Practice centers around
  effective rating -100, capped toward target rating -200, within 800–3500.
- The normal band is center +/-200, with an upper cap of target rating -100.
  Every suggested problem is therefore lower-rated than a rated target above 800.
- For an 800 target, the catalogue has no lower-rated problems: practice stays at
  800 and the UI explicitly says it is the same rating. For an unrated target,
  practice follows learner difficulty and the UI does not claim it is easier.
- Candidates must have the selected topic tag, have a published rating in the band,
  differ from the target and have no accepted verdict in this profile's imported
  history. Rank by rating fit, fewer additional tags, popularity, then stable ID.
- Allocate round-robin across topics, prioritizing the suggested review topics, up
  to three per topic without repeating a problem anywhere in the plan. Small or
  empty pools remain small/empty; filters are never silently relaxed.
- Cards show problem IDs, ratings, links and two-line opening statement previews.
  Missing previews are labelled. Short openings are bounded before serialization.
- Tags outside the 19-topic curated graph are explicitly listed. They still get
  direct tag-based practice where possible, but no prerequisite edges are invented.
  If every tag is unmapped, the page shows direct practice without a fake graph.
  Special contest markers beginning with `*` are not treated as learning topics.

These are suggested preparations, not a diagnosis of why the user is stuck. A tag
can describe an alternative solution; a generic background edge may be unnecessary
for a particular problem. The page states that it may miss the crucial observation.
Foundation practice uses graph/topic/rating rules, while the existing Recommendations
page keeps its separate pgvector hybrid ranking.

## Input and API

```text
GET /api/path?handle=Chatresh&problem=1879C
GET /api/path?handle=Chatresh&problem=https%3A%2F%2Fcodeforces.com%2Fcontest%2F20%2Fproblem%2FC
```

Responses include `kind: "problem"`, target metadata, combined graph plan (or null
for unmapped tags), topic practice, missing-map tags and explicit rating-band mode.
Malformed/foreign URLs and empty inputs return 400; absent catalogue problems return
404. URLs are parsed as identifiers only: the server never fetches arbitrary URLs.
This feature does not silently crawl or import a new contest when a problem is absent.
The existing `target` API still supports standalone topic exploration.

Verified locally: 22 unit tests, real normal/minimum/unrated/unmapped targets,
beginner and advanced profiles, multiple graph goals, accepted/target exclusions,
repeat-free suggestions, API errors, statement previews, the problem-page shortcut,
secondary topic exploration and mobile overflow checks passed. Past practice starts
collapsed and the preparation inspector omits the large past-solve counters.

## Verify this flow

```text
npm test
npm run typecheck
node --conditions=react-server --import tsx scripts/check-problem-preparation.ts
node --conditions=react-server --import tsx scripts/check-learning-path.ts
npm run build
```

The preparation check covers normal links/IDs, multiple graph goals, tag membership,
already-accepted/target exclusions, duplicate-free suggestions, beginner/advanced
rating limits, minimum/unrated targets, unmapped tags, revisits and API errors.
The Neo4j connection, graph model, source-of-truth rules and local setup below apply
unchanged. PostgreSQL is read-only for preparation; derived Neo4j projections may
refresh as previously documented.

---

# Goal-first learning map

Open `/path?handle=Chatresh` and choose only a **goal topic**. The starting-topic
selector has been removed: imported practice provides the context. The page shows
all recommended background branches, an interactive graph/list switch, a suggested
place to review, and accepted problems connecting the selected topic to the profile.

## Local setup

1. Create/start the dedicated Coderise local instance in Neo4j Desktop. The instance
   name is separate from its database name (normally `neo4j`).
2. Keep the connection in ignored `.env`:

   ```dotenv
   NEO4J_URI=bolt://127.0.0.1:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_local_instance_password
   NEO4J_DATABASE=neo4j
   ```

   Use the actual Bolt port and database from Desktop. Do not commit credentials.
3. With PostgreSQL and its imported catalogue available:

   ```text
   npm install
   npm run db:graph
   npm run dev
   ```

Restart the site after changing `.env`. Run `npm run db:graph` again when updating
an earlier learning-path installation: it adds the public-history projection schema.
No APOC extension, new Python package or learner account is required.

If Neo4j is unavailable or the map needs synchronization, the screen explains the
problem and `/api/path` returns 503. It does not substitute a static fake graph.
The dashboard, recommendations and problem catalogue still work independently.

## What a user sees

- One goal selector. No starting-topic input, shortest-route form or mastery score.
- An interactive directed graph of every ancestor topic and the goal. Edge
  explanations distinguish recommended background from universal requirements.
- Practice labels: practiced, attempted without an accepted solve, or no imported
  evidence. A red border identifies the goal; selecting a node opens its inspector.
- A Graph/List switch. The list is selected initially on small screens, and the
  graph supports keyboard arrow navigation. All controls are native buttons.
- A suggested review at the earliest background level lacking accepted evidence.
  Previously attempted topics take precedence only within that level. This is a
  transparent navigation heuristic, not a prediction of readiness or optimal study
  order. If all background has practice, suggest the goal; a root has no background.
- A topic inspector with counts, incoming/outgoing connections, an unsolved-problem
  link and up to three recent accepted examples retrieved through the graph.

Missing evidence is not missing knowledge. A tagged accepted problem does not
establish mastery or prove which algorithm the person actually used. Multiple
accepted submissions to one problem still count as one unique solve. Pending
verdicts and compilation errors are excluded from judged attempt counts.

## Why Neo4j is used

The topic graph comes from `config/learning-topics.json`: 19 topics and 21 explained
recommended-background relationships, manually curated by Coderise. Codeforces does
not provide these prerequisite edges. IDs, matching SQL tags and acyclicity are
checked by the loader. Managed nodes have unique indexed keys and a graph namespace.

The graph now also contains a rebuildable projection of imported public history:

```text
(CoderiseProfile)-[:SOLVED]->(CoderiseProblem)-[:HAS_TAG]->(CoderiseTopic)
                                                         |
                                                PREREQUISITE_OF
                                                         v
                                                  (goal topic)
```

- `CoderiseProfile`: canonical public handle, snapshot hash, source timestamp.
  It represents imported public evidence, not an authenticated account.
- `CoderiseProblem`: canonical contest/index key, name and rating.
- `SOLVED`: the imported accepted connection, with latest accepted timestamp.
- `HAS_TAG`: a connection to a topic represented in the curated roadmap.
- `PREREQUISITE_OF`: an authored recommendation, with an explanatory reason.
- `CoderiseGraph`: map version and projection schema version.

The service traverses up to 12 prerequisite hops to retrieve all background, then
queries Profile -> SOLVED -> Problem -> HAS_TAG -> Topic for accepted examples.
SQL supplies the authoritative history/counts; Neo4j supplies multi-hop structure
and the actual problem connections. The browser receives neither raw submissions
nor every solved problem, only topic counts and up to three examples per topic.

## Projection freshness and concurrency

PostgreSQL remains authoritative. One SQL statement captures the profile timestamp
and current imported submissions. The server computes counts, deduplicated accepted
problems and a deterministic projection hash. On a learning-page/API request:

1. A Neo4j transaction acquires a per-profile write lock.
2. If the accepted-problem snapshot changed, that profile's managed SOLVED edges
   are replaced and the relevant problem/tag connections are merged.
3. The hash and source timestamp are recorded, and graph evidence is read in the
   same transaction. An unchanged snapshot avoids rewriting problem relationships.
4. Graph counts are checked against the SQL snapshot before returning examples.

A timestamp guard prevents an older overlapping request from overwriting a newer
profile snapshot; that rare request asks for a reload. Managed transactions retry
transient failures. Other handles' SOLVED edges are never cleared. The next request
after a successful profile refresh updates the projection; there is no claim of an
unattended graph sync. Removing a solve from the SQL import removes its SOLVED edge
when next projected. Unreferenced problem nodes can remain as harmless derived
metadata. A profile deleted directly in SQL is no longer accessible through this
API, although its derived graph node is not automatically garbage-collected.

`npm run db:graph` idempotently seeds the curriculum and constraints. It does not
wipe other Neo4j data or all public-history projections. Curriculum source is in
Git and the profile projection can be rebuilt from PostgreSQL, so a Neo4j dump is
not required to recreate this feature. To intentionally rebuild all managed graph
data, use a dedicated instance and reload from source; do not clear an unrelated DB.

## API and course demo

```text
GET /api/path?handle=Petr&target=flows
```

The response contains target, profile handle, topic counts/recent solved examples,
prerequisite edges and reasons, display levels, suggested review IDs and map version.
Old `start` query parameters are ignored. Unknown goals return 400; unknown public
profiles return 404. Service errors return 503 without credentials or raw DB errors.
GET may refresh this derived projection, much like populating a cache; it does not
modify PostgreSQL history or contact Codeforces. The normal header refresh remains
an independent existing application behavior.

Open `db/demo/learning_graph.cypher` in Neo4j Query/Browser. It demonstrates the
curriculum, all ancestors, edge explanations, indexes/constraints, profile-solved-
problem-topic connections and connections leading toward a goal. Shortest-path
queries remain available as a database demonstration, but are not presented as an
optimal personal learning plan in the UI.

## Verification

```text
npm test
npm run typecheck
node --conditions=react-server --import tsx scripts/check-learning-path.ts
npm run build
```

Unit tests cover acyclicity, branches, hostile inputs, verdict exclusions, repeated
accepted submissions and the review heuristic. Live checks exercise all 19 goal
ancestor sets, branch preservation, root goals, accepted-only graph examples,
repeat projection and API validation. If Petr is imported, its graph counts are
independently compared with SQL tag-specific accepted sets. The live check updates
only derived Neo4j projection data; PostgreSQL is read-only.

References: [Neo4j managed transactions](https://neo4j.com/docs/javascript-manual/current/transactions/),
[locking and concurrent access](https://neo4j.com/docs/operations-manual/current/database-internals/concurrent-data-access/).

Verified locally on 2 November 2026: 17 unit tests, all 19 live goal cases,
independent Petr SQL/graph counts, eight Cypher demo sections, production build,
legacy URL handling, and desktop/mobile interaction checks passed. Mobile graph
scrolling stays inside the canvas; the page has no horizontal overflow. Existing
pgvector recommendations continue to work.
