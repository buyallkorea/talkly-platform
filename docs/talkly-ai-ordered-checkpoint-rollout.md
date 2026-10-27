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
