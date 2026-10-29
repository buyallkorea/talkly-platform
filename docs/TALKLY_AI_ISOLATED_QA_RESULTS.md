# TALKLY AI isolated Supabase verification — 2026-10-28/29

## Outcome

A real isolated Supabase environment exposed a pending migration failure missed
by the previous static checks: `ai_checkpoint_ordered` has five arguments but
its service-role GRANT named only four. Corrected the pending migration's
signature. It was not applied to production.

Added an executable PostgreSQL regression that applies all 23 AI migration
files in order, tests the actual five-argument RPC as service_role, rejects
anonymous/authenticated execution, verifies replay/stale/foreign-owner/writer
handling, injects a memory-write failure to prove atomic rollback, and checks
that a deleted memory cannot be restored by a late checkpoint. The test is
included by the existing complete-suite discovery runner (69 AI programs).

## Real environment and lifecycle

With owner approval, created temporary branch `talkly-ai-qa-20261028`
(project `jvlraecuurzemwjizxrq`, parent `nvotgdovtxfzvmrrhxge`) on
2026-10-28 at 07:37:26 UTC. `with_data=false`; no production customers, orders,
lessons or secrets were copied by this work.

The branch's automatic migration process failed because the project history
assumes pre-existing TALKLY base tables (`profiles`, among others). It had zero
public tables. This is a missing reproducible full-schema baseline, not proof
of an issue with the running production database. Inspected only production
schema metadata needed to understand the dependency; did not write production.

For focused AI verification, installed the documented minimal QA `profiles`
prerequisite, real pg_cron, and all 23 AI migration files on the isolated DB.
This is an AI test harness, not a complete clone of TALKLY signup/classroom.
Manual success does not change the branch's original `MIGRATIONS_FAILED`
provisioning status; no automated-branch readiness claim is made.

After verification, the branch was deleted on 2026-10-29 around 05:00 UTC.
Provider branch inventory confirmed only the production/default branch remains.
This removes the synthetic accounts and stops this branch's ongoing compute
usage. At the approved USD 0.01344/hour base rate, roughly 21.4 hours corresponds
to approximately USD 0.29 compute. This is an estimate, not a final invoice;
other usage/taxes/exchange conversion are not included.

## Passed on actual Supabase

- Lifetime 180-second trial reservation, duplicate active-session denial,
  foreign-user settlement denial, zero-charge unattached failure and idempotent
  settlement replay.
- Synthetic attached-call elapsed-time settlement, reconnect with only remaining
  trial seconds, lifetime trial exhaustion, synthetic 30-day payment activation
  replay and a strict 600-second daily limit. Provider hangup/Toss were not called.
- Actual authenticated RLS ownership and denied client payment writes/RPC access.
- Refund intake ownership/idempotence, administrator-only state transitions,
  stale-revision rejection, audit replay/conflict, unchanged payment/pass.
- Closed-month report totals from settled segments (130 seconds, 2 learning
  days, 3 segments), duplicate-publication prevention.
- Summary owner binding, deletion, no late restoration and withdrawn consent.
- Real Auth password login/getUser and PostgREST owner/foreign/anonymous checks,
  denial of browser pass extension/payment reads/service-only reservation RPC,
  and session logout. These users were administratively seeded with synthetic
  `.invalid` addresses, not created through TALKLY signup. No email/SMS was sent.

Lifecycle/report/admin SQL fixtures ran inside transactions ending in rollback.
The separate Auth fixtures were removed with the temporary branch. An attempted
per-user cleanup hit connector `Invalid or expired requestState`; the supported
branch-deletion operation succeeded. No claim of per-user deletion success is
made.

Security advisors reported no WARNING/ERROR items. Thirteen INFO items concern
RLS-enabled tables without browser policies. They are intentionally service-only;
client grants were revoked and representative denial was verified. Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Not passed / next launch gates

- Two independent client DB connections actually contending on the member lock:
  sequential stale-write rejection passed, but the connector did not establish
  observable concurrent lock contention. Temporary dblink/local-connection
  attempts were rejected by managed authentication; the QA extension/role were
  removed. Do not label this concurrency verification complete.
- Full TALKLY signup (phone OTP, Auth trigger/profile creation, confirmation mail),
  because the temporary environment used only an AI schema subset.
- Browser → TALKLY API → isolated Supabase lesson flow. Dedicated Preview
  service credentials have not been installed. Vercel environment values,
  production variables and isolation attestations were not modified.
- Real microphone/WebRTC/provider hangup, model response quality and provider
  costs, 3-minute/10-minute real audio, transport recovery on actual devices.
- Real payment authorization/cancellation/refund. Financial execution remains off.

Next environment must first have a reviewed complete schema baseline and its
own server credentials, then branch-scoped Preview settings verified together.
Keep existing Preview writes blocked until then. `main`, production migrations,
paid checkout and customer outreach remain outside this change.

## Reproducible files

- `tests/talkly-ai/checkpoint-ordering-database.mjs`: automatic local/CI ephemeral
  PostgreSQL test of every AI migration and checkpoint behavior.
- `tests/fixtures/talkly-ai-isolated-prerequisites.sql`: explicit QA-only subset.
- `tests/fixtures/talkly-ai-isolated-lifecycle.sql` and
  `talkly-ai-isolated-reports-admin.sql`: real DB assertions with rollback.
- `tests/fixtures/talkly-ai-isolated-auth-users.sql`: administrative synthetic
  Auth fixture; temporary password supplied in-session, never committed.
- `scripts/verify-talkly-ai-staging-auth.mjs`: explicit isolated opt-in Auth/REST
  check; rejects the known production project and logs no credentials/tokens.
