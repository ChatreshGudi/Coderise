# Frontend and browser behavior

## 3. Frontend: what the user sees

Next.js and React provide the handle entry page, dashboard, recommendations, searchable problem catalogue, problem detail page, and problem preparation screen. Components render tables, charts, filters, checkboxes, pagination, statement mathematics, and graph interactions.

Pages and components do not decide database permissions or run SQL in the browser. Server-rendered pages obtain data through server helpers; browser interactions use Next.js API routes where needed. For example, changing catalogue filters changes query parameters, which the server validates and translates into parameterized database queries.

The selected handle cookie is a browser preference, not a login. Anyone may inspect another public Codeforces profile.

## Following a catalogue search through the frontend

The Problems page takes URL parameters for search, minimum/maximum rating, topics, status, sort, and page. The form changes those parameters. The server reads and validates them, calls searchProblems in lib/data.ts, and renders the matching rows. URL state preserves the view through pagination and back navigation.

Selecting several topics means the problem must contain every selected topic. Repeated tag parameters represent the selected set. The database performs filtering before pagination; the browser does not download the entire catalogue and hide unwanted rows. Each page contains 25 results. The matching result count and total catalogue count are distinct.

Next.js supports both server and client components. Server components can call server helpers directly and render data without an extra internal HTTP API call. Client components handle browser state and pointer/keyboard interaction. API routes are used when the browser needs a new server operation, such as starting a refresh. Database drivers and credentials stay on the server.

The rating graph already has its series when the user hovers. Selecting a point changes frontend state and displays that point's date/rating; it does not call Codeforces for each movement. Similarly, bar highlights and topic visibility are presentation behavior, while their counts and tags originate from PostgreSQL.

## Components to explain

| Component | Responsibility |
|---|---|
| workspace.tsx | Shared workspace/header/footer structure |
| rating-chart.tsx | Interactive selection of imported rating history |
| topic-filter.tsx | Multiple topic selection and chips |
| styled-select.tsx | Styled, accessible selection control |
| pagination.tsx | Page links and direct navigation |
| statement.tsx | Markdown/math statement rendering |
| statement-preview.tsx | Bounded opening excerpts |
| sync-controls.tsx | Refresh actions and job progress |
| learning-map.tsx | Graph/list topic inspection |

Raw statement HTML and trusted KaTeX commands are not enabled. Missing text is labelled, and Codeforces remains the solving/submission destination.