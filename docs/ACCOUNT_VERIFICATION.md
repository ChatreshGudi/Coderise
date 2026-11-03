# Account/list implementation verification

Verified locally on 2 November 2026 against PostgreSQL 18 and the production Next.js build.

- Migration 008 applied successfully and reran without changing existing accounts/lists.
- Type checking passed; production builds passed.
- All 26 TypeScript unit tests passed, including four new password/hash/input/security cases.
- The live API regression script passed 50 assertions, plus password/session storage, owner isolation, current role, expiry and cascade checks. Synthetic accounts were removed afterward.
- Public web checks passed: imported profile, pagination, exact search, unsolved filter, parameters, all three recommendation modes, six pages and protected administrator actions.
- Browser walkthrough verified sign-in, saved display name/handle, list creation, a list page, and saving a catalogue problem through the chooser. Desktop and mobile layouts were inspected; a narrow-screen action-row overflow was corrected.
- A transfer backup restored into an isolated empty database and matched all expected counts. While a synthetic account/session/list existed in the source, restored site_account/auth_session/auth_throttle/problem_list/problem_list_item counts were all zero, proving the shareable dump excluded those rows.

This is functional/security regression evidence, not an independent penetration test. No persistent administrator was seeded. Create one using the documented hidden-prompt command when needed.

Reproduce with npm test, npm run typecheck, npm run build, node scripts/check-accounts.mjs and node scripts/check-web.mjs. API checks require the configured running origin; real rate limits stay active.
