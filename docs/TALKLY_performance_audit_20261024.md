# TALKLY loading performance review — 2026-10-24 KST

## Changes

- Anonymous middleware requests no longer instantiate an Auth client when there is no Supabase session cookie. Session cookies, including chunked cookies, still go through SDK getClaims verification/refresh. Server pages and APIs retain authoritative getUser and existing role/ownership checks.
- Server-rendered pages and layouts use a React cache-wrapped getCurrentUser and server client. This reuse is scoped to one React server render, never a shared identity cache. Route handlers retain their independent validation.
- Login uses the user already validated by signInWithPassword, removing a second Auth user network request. Existing profile role checks, representative admin email check, and safe next-path checks remain.
- Student, parent and teacher dashboard independent metadata queries execute concurrently. Ownership/enrollment dependencies remain ordered. Admin dashboard already uses parallel query groups; its layout/page identity check now benefits from request-scoped reuse.
- Classroom and both textbook viewers batch signed image/audio URLs in groups of at most 200 unique paths. A 101-page book now needs one image signing request instead of 101; audio uses a separate batch. Missing required images fail explicitly; unavailable audio remains optional. Page order and saved progress restore remain intact.
- Public catalogue cover signatures use a 60-second shared cache, with one-hour signed URL expiry. Only covers of currently public/active/ready catalogue entries are passed in. Catalogue metadata itself is still read fresh. Private book pages, audio, enrollment information and account data are never put in this shared cache.
- Loading boundaries show an accessible progress/skeleton state on initial and role-based navigation, respecting reduced motion. This improves feedback; it is not a backend timing measurement.

## Validation

- TypeScript no-emit validation.
- Production build with placeholder public configuration, never deployed as a prebuilt artifact.
- 58 automated test cases across login, storage batch handling, request identity reuse, middleware cookie renewal, dashboard concurrency/authorization, route audit, messaging, Zoom and signup regressions. Existing terminal-classroom suite additionally exercises 22 routing combinations.
- Internal route scan: 119 pages, 76 API routes, 999 literal references, zero unresolved references.
- Targeted lint: no new production-code errors. Existing teacher dashboard Date.now render-purity finding and unrelated baseline findings remain outside this performance change.
- No database schema/RLS changes, real meetings, payments, messages or test account creation.

## Measurement limits

The pre-change anonymous external HTTP sample included proxy/network overhead: login 6.49s, home 5.96s, curriculum 8.84s. The anonymous home menu API's own Server-Timing was only 1.7ms while the external request took about 6s. These single samples are unsuitable for attributing total elapsed time to application work, or for advertising a percentage improvement.

Unauthenticated redirects to login are not authenticated dashboard benchmarks. Real user sessions, mobile/desktop web vitals, camera/microphone and Zoom connection speed still need live session measurement. Vercel project log access currently returns a team authorization error, so this review cannot claim a clean production runtime error-log scan. No hosting-region or global cache change was made without evidence.
