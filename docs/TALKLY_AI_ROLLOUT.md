# TALKLY AI initial integration

## Implemented

- `/talkly-ai`: separate AI section; homepage desktop and mobile shortcuts and lower promotional banner.
- Existing Supabase login is reused. AI membership, consent, pass, orders, daily usage and sessions have separate tables; existing classroom enrollment/payment tables are unchanged.
- One plan: KRW 13,900 / 30 days, 600 connected seconds per Asia/Seoul calendar day. No automatic renewal, no daily rollover. Payment extends from the later of current expiration and approval processing time. It does not reset today's quota.
- Ten AI tutor profiles (US/UK/AU/CA/ZA, male/female presentations) use cedar/marin plus locale prompts. These are AI personalities, not ten recorded native speakers. Accent fidelity needs listening tests.
- `gpt-realtime-2.1-mini`; semantic VAD low eagerness; no unsolicited idle timeout. Thinking control suppresses automatic responses; pause disconnects and settles usage. Paused time is not charged.
- Last 20 text turns (max 1,000 characters each), kept only in member memory, are passed as explicitly untrusted previous-conversation data. Audio recordings are not stored by TALKLY AI. Provider processing is disclosed at AI enrollment. No validated pronunciation scores.
- `/admin/talkly-ai`: verified admin-only membership, payment and daily usage views, limited to latest 100 rows per list. Existing profiles.role authorization preserved.

## Rollout state

On 2026-10-25 the owner approved the additive production AI schema and a preview deployment with payments off. The four AI tables and three RPCs have now been applied to the TALKLY database; existing classroom/payment tables were not changed. Production main remains unmerged. Paid checkout remains disabled.

Preview-only flags on `feat/talkly-ai-integration`: `TALKLY_AI_ENABLED=true`, `TALKLY_AI_PAYMENTS_ENABLED=false`, `TALKLY_AI_TEST_MODE=true`. No production flags were changed. Existing OpenAI credentials are reused without reading their value.

Only a verified TALKLY admin can activate a 24-hour test pass for their own AI membership, after joining. `/api/talkly-ai/test-access` also requires `VERCEL_ENV=preview`, test mode on and paid checkout off. It creates no payment record, does not reset daily quota and does not shorten an existing pass. This is for the approved test deployment, not a free public plan.

Required existing environment names:

- `OPENAI_API_KEY` (already present in TALKLY production and preview; reuse authorized)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` (present in production; not currently preview targets)

New rollout gates, both default off:

- `TALKLY_AI_ENABLED=true`: exposes enrollment/session APIs and studio.
- `TALKLY_AI_PAYMENTS_ENABLED=true`: allows real payment preparation/confirmation. Keep false for initial voice verification.

Deploying a changed environment requires a rebuild/redeploy. Never expose OpenAI, Toss secret or Supabase service keys to the client. Do not copy live Toss credentials into a test environment; use a matching Toss test-key pair for payment tests.

## Schema and quota enforcement

Migration: `supabase/migrations/20261025002307_talkly_ai.sql`. It adds four RLS-enabled tables and three invoker RPCs. No changes to existing profiles, auth triggers, enrollment tables, or existing payment endpoints. All writes and payment secrets are server-only. RPC execution is revoked from PUBLIC/anon/authenticated and granted only to service_role. Own-row reads are granted only for non-secret membership and daily usage.

Server creates at most 240-second provider call leases to fit the route's 300-second duration. Quota is atomically reserved under a member lock before external negotiation. A unique partial index prevents concurrent live calls per member. Normal stop hangs up the provider call then charges server elapsed time and refunds unused reservation. Failed negotiations without an attached provider call refund the reservation. Repeated settlement is idempotent. At midnight or pass expiry the lease ends at that boundary.

The browser automatically reconnects after a lease if daily quota remains. This can briefly interrupt speech at a lease boundary and needs voice UX verification. A server-side Next `after()` watchdog checks for closure, hangs up calls at the lease deadline and retries termination. This is bounded to 300 seconds but MUST be verified on the actual Vercel runtime. A worker crash can delay termination; a subsequent start recovers expired leases before reserving more time. Before commercial scale, consider a durable termination scheduler/provider-side supervisor instead of relying only on a function lifetime. Observe server invocation and DB polling costs.

Payment approval uses server fixed price, owner-scoped orders, bound payment keys, Toss idempotency, and lookup/retry recovery. SQL activation is atomic and idempotent. A refund/cancellation webhook and admin refund mutation are not included in this initial iteration; production financial operations must reconcile cancellations and pass access before public sale.

## Verification completed locally

- Full TypeScript check.
- Applied schema verification: all four tables have RLS; all three RPCs are invoker functions with pinned search paths, executable only by service_role.
- Actual database reservation/double-session/refund/idempotence smoke check succeeded inside a rolled-back transaction; no fixture rows remained.
- `node tests/talkly-ai/test-access.mjs`: production/development exclusion, paid-mode exclusion, non-admin rejection, owner-only granting and preservation of a longer pass.
- Local production HTTP smoke checks: public preparation page renders; all disabled AI endpoints return 503; enabled POST endpoints reject unauthenticated requests (401) and foreign origins (403).
- Production Next build, using placeholder build-time configuration; no production API key was read.
- `node tests/talkly-ai/config.mjs`: tutor catalog, plan constants, Korean midnight and bounded memory.
- `TALKLY_AI_PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/talkly-ai/database.mjs`: real ephemeral PostgreSQL migration, expiry, double session rejection, ownership, refunds, settlement replay, quota exhaustion, payment key binding, activation replay, 30-day extension, RLS and grants. This does not replace concurrency/load testing on Supabase.

## Required before production activation

1. Apply migration to isolated staging and run Supabase security advisors.
2. Verify login → separate consent → owned membership and admin views.
3. Use matching Toss TEST keys: approved, cancelled, duplicate confirm, mismatched price/owner/key, timeout after approval; reconcile refunds before paid launch.
4. Grant staging-only test access to a controlled tester, then verify OpenAI model access and real microphone/audio, 10 tutor voice profiles, Korean scaffolding, slow answers, thinking/pause/resume, last-topic continuity.
5. Run a full 10-minute session, a two-tab race, browser close, network failure, midnight/expiry boundary and watchdog enforcement on Vercel. Inspect provider call termination and actual token usage; do not trust the UI timer alone.
6. Review AI-specific privacy/terms, retention, refund policy and child enrollment/consent requirements before sale to minors. The initial join disclosure is not a complete legal policy.
7. Confirm UI on desktop/mobile and no regression to enrollment, teacher/student classroom, admin and existing checkout.

No automatic billing, monthly learning report, separately recorded custom voices, or validated pronunciation assessment is claimed in this initial version.
