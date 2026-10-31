# Signup-to-microphone integration verification — 2026-10-29

Status: **blocked before browser signup**. Existing TALKLY OpenAI key reuse is
approved. It remains a Vercel Preview Secret and was not exported, replaced,
printed or written locally. No real OpenAI call has been made by this work.

## Prepared

- Branch: `feat/talkly-ai-integration`, PR #7 remains Draft.
- Temporary Supabase: `talkly-ai-e2e-20261029`, project
  `eakgtjoqumqfmiojlgjd`, branch ID `75bf4ecf-fe45-42bf-b1f4-d6dbfdf679fe`.
  Parent production project is `nvotgdovtxfzvmrrhxge`; `with_data=false`.
- Approved base compute rate rechecked: USD 0.01344/hour. Created at
  2026-10-29T05:23:36Z. This branch is currently retained for credential setup;
  it incurs charges until removed. No automatic deletion is scheduled.
- Installed a reviewed schema-only signup slice: profiles, student/parent/admin
  profiles, phone verification, constraints, indexes, role guard, RLS and real
  Auth user-creation trigger. Metadata came from read-only production catalog
  queries, without customer rows. All 23 AI migrations are installed too.
- The snapshot deliberately omits client DDL grants and is **not** a complete
  classroom/teacher/textbook/commerce schema clone. Do not apply it to production
  or on top of the earlier minimal profiles fixture.
- Real isolated PostgreSQL trigger test passed for student/parent profile
  creation, browser admin-role spoof rejection, profile RLS/role-change denial
  and first 180-second AI trial. Fixtures rolled back; zero persistent test users.
- Advisor findings: service-only tables have expected no-policy INFO entries.
  `is_admin()` has an authenticated SECURITY DEFINER warning: this is the existing
  intentional caller-scoped boolean helper used by profile policies, with no
  arbitrary user parameter or write. Verified non-admin returns false. Its
  trigger counterpart functions are not client-executable.
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Signup defects corrected on the development branch

The email-confirmation message was inside the SMS-send handler rather than the
signup handler. A newly created unconfirmed account was therefore redirected to
login without the required confirmation guidance. Moved that handling to signup,
kept delivery-failure guidance, and disabled duplicate signup after confirmed
account creation. A malformed successful response no longer claims completion.
The existing student/parent phone proof flow is unchanged.

Signup now sends the validated `next` path so confirmation/login can continue
to `/talkly-ai`. Preview confirmation mail uses Vercel's stable branch URL
(or deployment URL), not the hard-coded production host. Production keeps the
TALKLY host. Submitted Origin/Host and external next URLs are never mail targets.
Supabase must allow the exact branch host in its redirect configuration.

## Secure configuration still required

The connected Supabase tools expose publishable keys but not the branch's
server Secret. Vercel also does not return saved sensitive OpenAI Secret values;
this is expected and does not mean the existing key is invalid. Native Supabase
startup was attempted without cloud charges, but required GitHub/S3 artifacts
are blocked by this workspace's network policy. Browser control also fails to
initialize because its session directory is read-only.

An operator must copy the **new test project's own** server key directly from
Supabase into Vercel, without sending it in chat:

1. Test project API keys:
   https://supabase.com/dashboard/project/eakgtjoqumqfmiojlgjd/settings/api
2. Vercel environment variables:
   https://vercel.com/sung-jung-hann-s-projects/talkly-platform/settings/environment-variables
   Add/override `SUPABASE_SERVICE_ROLE_KEY` as Secret, **Preview only**, Git
   branch `feat/talkly-ai-integration`. Use the test project's `service_role`
   or server secret key, never production's key. Do not alter production scope.
3. On that same test Supabase project, Authentication → URL Configuration,
   allow the specific branch redirect origin and login path. Stable branch URL:
   `https://talkly-platform-git-feat-talkl-d11920-sung-jung-hann-s-projects.vercel.app/login`
   Add `/**` only on this exact host if other callback paths are needed.

After the server Secret is installed, configure the remaining branch-scoped
Preview variables together and redeploy:

| Variable | Value / source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://eakgtjoqumqfmiojlgjd.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | This test project's publishable key |
| TALKLY_AI_PREVIEW_DB_PROJECT_REF | eakgtjoqumqfmiojlgjd |
| TALKLY_AI_PRODUCTION_DB_PROJECT_REF | nvotgdovtxfzvmrrhxge |
| TALKLY_AI_PREVIEW_AUTH_ISSUER | https://eakgtjoqumqfmiojlgjd.supabase.co/auth/v1 |
| TALKLY_AI_ENABLED | true |
| TALKLY_AI_TEST_MODE | true |
| TALKLY_AI_PAYMENTS_ENABLED | false |
| TALKLY_AI_OUTREACH_DELIVERY_ENABLED | false |
| OPENAI_API_KEY | Keep existing Preview Secret; no re-entry/export needed |

Signup also needs the existing Preview SOLAPI configuration for OTP, and test
Auth email delivery/redirect settings must be verified. Do not send OTP/messages
to arbitrary invented phone numbers. No OTP bypass was introduced.

## Readiness and actual test sequence

`GET /api/talkly-ai/test-readiness` exists only in Preview with test mode and
payments explicitly off. Missing isolation returns 503 **before any DB client
is created**. With isolation/configuration present it makes only limit-zero
schema/credential reads and a read-only Auth settings call. It creates no user,
lesson, transcript, payment or provider call and returns no secrets. A successful
`configuration_checked` response explicitly says signup/voice have not run.
Do not interpret this endpoint as an Auth-trigger/email/model/microphone pass.

After it passes:

1. Open `/signup?next=/talkly-ai` in an isolated Preview browser. Use an operator-
   controlled email and phone; receive OTP, complete signup, confirm email, log
   in, and check the same test user/profile IDs across Auth and public tables.
2. Accept adult/AI consent. Verify exactly 180 trial seconds without payment.
3. Connect a real microphone, speak and hear the AI. Check permission denial,
   audio playback, slow answers, tutor change and continuity.
4. Stop/reload/reconnect and check settled DB time, only remaining trial time,
   provider hangup, no duplicate active session, and exhausted-trial behavior.
5. Run an independent two-connection checkpoint contention test and actual-device
   network dropout checks. Sequential DB tests do not replace these.
6. Verify reports/consent/deletion and payment sandbox separately; keep live
   payments/customer outreach off. Record outcomes and actual provider usage.
7. Revoke test sessions, remove test users, retire test credentials/deployment,
   delete the temporary branch, and confirm resource removal.

The agent's cloud browser cannot access the user's physical microphone. A
virtual audio device may verify transport, but the user's actual browser/device
must still complete the real microphone check. Do not label it passed otherwise.

## Checkpoint — 2026-10-31

- Operator installed isolated branch Supabase server credentials and temporary
  SOLAPI credentials directly into branch-scoped Preview Secrets. Production
  SOLAPI entries remain unchanged. Temporary SOLAPI key expires after one day.
- Preview redeploy `dpl_EbVkkYX97zQNe3mNB8gRGjAkcL1E` at commit `53635ef6`
  passed the read-only readiness check (HTTP 200, configuration_checked).
- Operator completed real SMS receipt/verification with the corrected phone
  number and submitted signup. One student Auth account and profile were created.
  Email confirmation remains incomplete: test SMTP returned Gmail 535
  BadCredentials on confirmation resend. Do not recreate the existing account.
- SMTP repair and real microphone verification are deferred by the operator.
  The test branch remains retained at the operator's request and continues to
  incur its approved hourly charge. No production migration or live payment
  activation was performed.
- Signup feedback now appears immediately after phone verification controls,
  before password inputs; malformed SMS success cannot start a success cooldown.
  SOLAPI send-many/detail requires exactly one accepted registration and no
  failed messages. This proves provider acceptance, not handset delivery.
  Raw provider error bodies are no longer logged because they may include PII.
- The first missing SMS was traced to an operator-entered incorrect recipient;
  it is not evidence of a provider rejection. Email and voice E2E remain open.

### 2026-10-31: retry failed lesson settlement before reconnecting

The studio now keeps the session ID and segment summary until the stop endpoint
acknowledges settlement. Starting again first retries that same stop request;
when it fails, microphone setup and a new reservation do not proceed. Successful
settlement clears the retry target and submits the retained optional summary.
The server's existing idempotent close and provider-hangup requirements remain
in effect. This retry target is held in browser memory; page unload still relies
on keepalive and server recovery.

The new `stop-retry.mjs` executes the studio's stop function and start preflight
with simulated network failures, checking repeated failure, later success,
summary retention, and prevention of a new microphone connection before settlement.
These checks make no external provider or production database calls. Real microphone
and SMTP validation remain deferred.

### 2026-10-31: validate payment lookup before approval

Payment confirmation now checks the provider lookup's order ID, payment key,
amount and KRW currency before proceeding from READY/IN_PROGRESS to an approval
request. A mismatched or malformed successful lookup cannot trigger approval.
Malformed approval responses also cannot activate an entitlement. The existing
404 lookup path, idempotency key, paid replay, lookup-only recovery while checkout
is disabled, terminal failure handling, and activation retry remain covered.

Added mocked cases cover each identity mismatch in both pending statuses and
null/array/string/empty-object/number lookup and approval responses. No real Toss
requests or payments are made. The account entitlement, refund review and admin
reconciliation suites continue to check expiry, daily limits, ownership and
read-only provider reconciliation; live payment sandbox verification is pending.

### 2026-10-31: tolerate malformed persisted learning summaries

The report validates persisted summary JSON before rendering topics, expressions,
corrections, practice text or deletion labels. A malformed ready record is excluded
from content totals and explicitly reported, while its deletion control and the
independent usage totals remain available. Valid summaries retain their content;
this shape check does not re-assess their original transcript evidence.

Tests exercise malformed nested values, length limits and valid writer output.
A server-rendered page test mixes valid and malformed records, verifies the page
still renders valid learning content and a warning, keeps both deletion targets,
and checks that summary queries are scoped to the authenticated member. Existing
DB ownership/deletion, month boundary and snapshot suites remain part of CI.
No production database, provider calls or schema changes are involved.
