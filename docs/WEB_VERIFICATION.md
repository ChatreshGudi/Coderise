# Web workspace verification — 1 November 2026

- Production build and TypeScript checks passed on Node 22.14.0 / Next.js 16.4.3.
- Four input-validation tests passed (handle normalization, problem IDs, bounded numeric input, and mode/query handling).
- Live API checks passed for profile statistics, pagination, exact ID search, combined filters, imported-unsolved filtering, SQL parameter handling, and all three practice modes.
- Core pages returned successful responses against the local PostgreSQL database.
- Existing Chatresh profile refresh completed with three submissions processed and no duplicate history rows.
- First-time public profile import for tourist completed: 2,000 recent submissions and 310 rating changes. This is real public data, not a simulated user.
- Browser checks covered remembered-handle navigation, mode selection, topic disclosure, combined explorer filters, and returning to the same filtered explorer context.
- Problem 1879/C rendered 31 mathematical expressions with zero KaTeX error elements. Statements, examples, and related-topic queries returned actual imported data.
- Desktop (1440px) and mobile (390px) layouts were inspected. The document did not overflow horizontally; wide result tables scroll inside their own container.
- Dependency audit after updating the math renderer: zero reported vulnerabilities.
- Developer operations rejected requests without authorization. The developer token is intentionally unset by default; no learner account was created. An authorized catalogue refresh was not run during this verification.

Recommendations currently use the explicit SQL difficulty/topic/popularity baseline. Semantic ranking, calibrated solve probabilities, and LLM algorithm extraction are not represented as completed functionality. Views and recommendations cover imported history, currently up to 2,000 submissions per profile. Active-page refresh is not an unattended scheduler.

Verification scripts: `npm test`, `node scripts/check-web.mjs`, and `node scripts/check-import.mjs PUBLIC_HANDLE` (the latter imports public data). Keep PostgreSQL running and start the app before running the HTTP checks.
