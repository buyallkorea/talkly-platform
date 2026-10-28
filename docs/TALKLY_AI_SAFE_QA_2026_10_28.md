# TALKLY AI safe QA continuation — 2026-10-28

## Baseline and boundaries

PR #7 remains Draft on `feat/talkly-ai-integration`; inspected head is
`efc9f03c0a5d4ecc2deee0054d40c3047582dfaa`. Its diff against current main has
178 files, including AI routes, 23 SQL migrations, 68 AI test programs and
shared signup/mail/admin-client additions. The PR body is stale: current code
has six personality tutors, not ten regional tutors. Current constants remain
180-second lifetime trial, KRW 13,900, 30 days, 600 seconds per Seoul day.

No main changes/merge, production database writes, migration application,
live payment activation, live provider calls or customer messages were made.
Shared signup changes add server phone proof; mail/admin-client changes add
optional timeouts. Existing regression checks cover role access, signup
confirmation, classroom routing/messaging and dashboard loading, but do not
constitute a complete production regression or browser/device assessment.

## Findings and implemented changes

The existing safety workflow ran only 19 of the 68 AI programs. The full local
baseline found four obsolete harnesses: account hydration omitted the current
normalizer; queue failure assumed no retry; summary storage refusal omitted
pending-claim cleanup; unsubscribe omitted the Preview isolation guard.

Updated these harnesses without changing application behavior. Assertions now
also verify old tutor fallback/current tutor preservation, failed snapshot
retry/session isolation, no summary content after consent/storage refusal,
and rejection of unisolated Preview unsubscribe before any DB call.

Added `npm run test:talkly-ai` to discover every `.mjs` suite, execute each in a
separate process, enforce a per-program timeout, and fail if any program fails.
Pinned the existing-tested PGlite version 0.3.14 as a development dependency,
so SQL tests run reproducibly in CI rather than depending on a scratch path.
The workflow now runs all AI programs and `npm run test:regression`. Changes to
shared signup/mail/admin-client files, AI admin screens, scripts and dependencies
also trigger these checks.

PGlite executes actual PostgreSQL statements against synthetic ephemeral data.
Auth/cron are test doubles. Passing these tests does not verify Supabase Auth,
PostgREST, concurrent independent connections, real cron execution, WebRTC,
provider usage or Toss callbacks. The route inventory command currently flags
the dynamic `/api/talkly-ai/` prefix in AiStudio as unresolved; it is not a
verified broken link and was not added as a blocking CI step.

## Independent environment and cost decision

Read-only provider inspection confirmed production project
`nvotgdovtxfzvmrrhxge` belongs to `buyallkorea`
(`mzvwbeowbmuxhekhlhrz`), on Pro, with no development branches.
No resources have been provisioned.

Options, based on official pricing checked 2026-10-28:

- Local Supabase: no Supabase hosting charge, requires a local runtime. Docker
  is absent here. Supabase also documents an experimental native process mode;
  it has not been provisioned or verified in this workspace.
- Temporary Micro development branch: starts at USD 0.01344/hour, approximately
  USD 0.32256 for 24 hours or USD 9.6768 for 30 days of continuous compute.
  Disk/egress/storage can add costs; branches are not covered by Spend Cap
  or compute credits. It is an isolated Supabase environment, not a second schema
  inside the production database. Do not merge it to production.
- Separate project in existing Pro organization: additional projects start at
  approximately USD 10/month, plus applicable usage. Existing compute credits
  must not be assumed to cover a second instance.
- A free organization/project may be an option subject to account eligibility
  and active-project limits; no eligibility has been established here.

Recommendation: owner-confirmed organization and a short-lived Micro branch,
with synthetic users only. Before creating it, obtain the account-specific
provider cost quote and explicit budget approval. No quoted base rate is a hard
cap or includes OpenAI, SMS/email, Vercel usage, taxes or exchange conversion.

Official sources:
https://supabase.com/docs/guides/platform/manage-your-usage/branching
https://supabase.com/pricing
https://supabase.com/docs/guides/local-development

## Execution after cost approval

1. Create the explicitly approved isolated environment. Inspect schema parity,
   required RPCs and grants without copying production users or payment data.
   Any missing shared signup/profile schema must be reconstructed from reviewed
   schema definitions, not seeded with customer records.
2. Apply pending AI migrations only there and run security advisors. Test
   checkpoint locking from two independent connections; PGlite is insufficient.
3. Set dedicated branch-scoped Preview URL/public/service credentials and
   verify actual key ownership. Keep production variables unchanged. Set the
   three isolation attestations only after this verification.
4. First test real Auth with synthetic users and mocked external services:
   signup, consent, trial reservation, settlement, stop/reload/reconnect,
   duplicate/concurrent requests, denied foreign-user access and exhausted quota.
5. Run payment sandbox, admin audit/refund review and report/consent/deletion
   flows. Keep live payment and customer delivery disabled. Actual refund
   execution/pass revocation is still outside the implemented review workflow.
6. Separately verify model access, microphone and listening/transport recovery
   with an approved provider spend budget. Record real-call termination and
   quota results; do not label mocked checks as end-to-end passes.
7. Review resource termination after testing; no automatic cleanup is claimed.
