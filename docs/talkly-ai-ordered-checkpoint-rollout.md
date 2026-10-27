# TALKLY AI — Ordered checkpoint rollout gate

Status: **BLOCKED — do not enable in production.**

## Scope
- Database migration: `supabase/migrations/20261027133000_talkly_ai_checkpoint_ordering.sql`
- API flag: `TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED`; keep unset/false.
- Deploy path: draft PR #7, `feat/talkly-ai-integration`; no merge to `main` until separately approved.

## Verified so far
- Isolated transaction reproduction of first write, identical retry, stale version, foreign writer and old session rejection.
- Rollback on deliberately failed member update; version and memory remained unchanged.
- A temporary-function privilege probe allowed `service_role`, denied `anon` and `authenticated`.

These checks do **not** establish correctness of the production function under actual parallel transactions or of real Supabase RLS and API integration.

## Verified lock order in the existing database (2026-10-27)
The current `ai_reserve`, `ai_begin_close`, and `ai_finish` SQL functions acquire the member row lock first. The latter two then acquire the session row lock; the ordered checkpoint function uses the same member-before-session ordering. This reduces lock-order inversion, but does **not** replace a real two-connection concurrency test.

The Supabase project has no separate database development branch. No branch was created and no paid infrastructure was provisioned.

## Current read-only verification (2026-10-27)
- GitHub Actions run [40471788022](https://github.com/buyallkorea/talkly-platform/actions/runs/40471788022) completed successfully (TypeScript and 13 dedicated test commands). This is not an end-to-end browser, production DB migration, or two-connection race test.
- The protected Vercel feature preview is READY, but the Supabase URL and server key variable entries target both production and preview; an isolated preview database has **not** been demonstrated. Do not execute write-producing end-to-end tests against this deployment.
- Supabase branching returned zero development branches. Creating a separate project/branch may be chargeable and requires explicit user approval.
- Live DB **read-only grants audit**: `ai_api_events`, `ai_payments`, and `ai_sessions` have RLS enabled, no select permission for `anon` or `authenticated`, and service-role select access. `ai_members`, `ai_daily_usage`, and `ai_learning_summaries` have RLS enabled, one policy, authenticated select privilege, and no anon select privilege. Privilege alone does not establish policy correctness.
- Supabase security advisors flag RLS-without-policy and security-definer grants elsewhere in the project; examine each target before any repair. Do not automatically create permissive policies.
- **Go/no-go**: no actual AI lesson, checkout, account creation, or production migration until a preview-only DB target is proven or an isolated test environment is approved. The ordered-checkpoint flag remains OFF.

## Reservation and settlement read-only audit (2026-10-27)
- Verified the deployed database function bodies **without invoking them**: `ai_reserve` locks the member row before inspecting an unclosed session and reserves the full lease against either trial usage or the daily usage row. For a valid paid pass its maximum reservation is 240 seconds and its daily allowance is 600 seconds; trial total cap is 180 seconds. Reservation is bounded by the Seoul day boundary.
- `ai_begin_close` and `ai_finish` also lock the member row before the session row. `ai_finish` calculates a capped charge and returns unused reserved time; this is server-side source inspection, **not a real multi-connection race or a production settlement test**.
- Added `tests/talkly-ai/reservation-contract.mjs` to CI. It guards application call ordering: cooldown check → DB reservation → provider connection, and provider hangup before DB settlement. This static guard does not prove the database transaction is race-free.
- The actual two-connection contention, simultaneous API requests, abandoned-call provider state, and test-user quota accounting still require an isolated DB plus controlled test calls. Keep operations and migration gates blocked until then.

## Before enabling
1. Use a dedicated **isolated database** with the exact migration applied. Do not experiment on production member records.
2. Confirm migration, database privilege grants, real API service role, and `ai_reserve` session creation compatibility.
3. Open two **independent database connections** to the same test session. Hold connection A's member row lock while B requests a checkpoint; verify B waits and, when A commits a newer version, B returns `STALE_CHECKPOINT` without overwriting it.
4. Repeat with same version / same content (idempotent), same version / different content (rejected), different writer (rejected), missing writer (rejected), and a newer lesson protecting memory from an older lesson.
5. Check failure injection rolls back **both** `checkpoint_version` and `ai_members.memory`; check deadlocks and timeouts.
6. Test client reload/disconnect/auto-renew, session cancellation, pagehide checkpoint, and reconnect. Run all GitHub CI checks and verify a fresh preview deployment.
7. Only after explicit approval and the above tests, apply migration and enable flag in a controlled preview environment. Production rollout requires a separate approval.

## Safety notes
- Browser `writerId` is a concurrency token **not an authentication credential**. Authentication is via `context()`, member ownership, and service-role-only RPC.
- Reuse of the same writer for different sessions is acceptable because ownership is scoped to session ID.
- Legacy checkpoint path remains intentionally separate while feature flag is off.
- Do not activate payments, call recovery, or alter live voice quotas as part of this work.
