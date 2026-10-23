# TALKLY route and runtime audit — 2026-10-23 (KST)

## Scope and evidence

- Started from main `04346c2194a35c647df4a102ecd84b96e8c8ad32`.
- Initial inventory: 118 page routes, 76 API routes, 989 internal path references in app/components/lib. After fixes: 119 pages, 76 APIs, 999 references, zero unresolved paths (`npm run check:routes`). This checks code references, including API paths, rather than counting unique clickable links.
- Compared 996 literal database selects and 178 object-literal writes with the live TALKLY public schema. Four real `profiles.email` reads were invalid; storage bucket names are not database tables and were excluded as false positives. Both referenced public RPCs exist. Embedded relations match live foreign keys.
- Read-only HTTP sweep of all 66 pre-existing static page routes: 12 reach public/auth screens and 54 redirect to login. No errors on this completed sweep. Textbook detail IDs 5 and 30 and notice ID 1 also returned 200.
- `/curriculum` returned 500 on the first request but 200 on subsequent checks, including the complete sweep. Its page also rendered successfully against a fixture of current public curriculum data. Cause of that first error is unconfirmed; do not describe it as permanently fixed.
- Source image paths resolve to existing public files. Company-introduction anchor `/#about` was invalid; the real section is `/#greeting`. Reviews uses a conditional JSX id and is a valid anchor, not a missing section.

## Fixes

1. Added `/admin/evaluations`, which the dashboard already linked to in three places. The read-only page shows completed non-test lessons and existing evaluation content by Seoul date, with pagination, teacher and lesson links, plus an empty state. Existing monthly/final evaluation rules are unchanged. Added the sidebar entry.
2. Corrected the parent enrollment-progress CTA to `/parent/level-tests/new?childId=...`, preserving the selected child.
3. Corrected both shared-header introduction links to `/#greeting`.
4. Teacher editor now resolves email through server Auth after verifying admin role and the target teacher. Teacher-email PATCH no longer queries/writes the nonexistent profiles email column or attempts a spurious rollback after Auth succeeds.
5. Interview schedule notices resolve the verified recipient's email from Auth. Regression tests mock delivery; no notice was actually sent.
6. Parent child detail resolves the linked student's email only after verifying the active child belongs to that parent. Unrelated-child access still stops before a privileged account lookup.
7. Added common retry/home error UI and a site-specific 404. This provides recovery from transient failures; it is not a substitute for fixing underlying errors.
8. Added an executable internal-route regression check (`npm run check:routes`).

## Validation

- New regression tests: 9; existing automated tests: 31; existing terminal classroom cases: 22. All pass.
- TypeScript, production build, and lint on changed production files/new checks pass.
- Repository-wide ESLint baseline still has 61 errors and 39 warnings, primarily existing React hook rules, loose types, and CommonJS test imports. These are not equivalent to observed failing pages; no claim is made that the entire repository is lint-clean.
- No schema, RLS, production account/email, class, Zoom meeting, payment, or notice data was changed during testing.

## Limits and remaining work

- Anonymous HTTP redirects do not verify every signed-in role's full interaction flow. Admin/parent identity and ownership behavior were checked in regression tests; live signed-in end-to-end verification remains separate.
- Vercel team-scoped runtime logs/error clusters are inaccessible through the current connection (403). No claims about an error-free production log stream.
- Existing legal draft work remains on its separate PR (#3). `/terms` and `/privacy` are not published on main and footer labels currently are plain text; do not silently publish unapproved policy drafts as part of this bug fix.
- Legacy `DeleteTextbookButton.tsx` references an absent DELETE method, but it is not imported by any active page/component. No new destructive deletion feature was introduced. Static API matching must prioritize literal paths over dynamic paths (bulk-import has its own valid POST route).
