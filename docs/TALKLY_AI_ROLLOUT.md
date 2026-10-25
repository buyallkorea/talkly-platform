# TALKLY AI initial integration

## Implemented

- `/talkly-ai`: separate AI section; homepage desktop and mobile shortcuts and lower promotional banner.
- Existing Supabase login is reused. AI membership, consent, pass, orders, daily usage and sessions have separate tables; existing classroom enrollment/payment tables are unchanged.
- Signup benefit: one lifetime 180-second free trial per AI membership, no payment, no daily reset; unused seconds remain after pausing. It is separate from the admin test pass.
- One paid plan: KRW 13,900 / 30 days, 600 connected seconds per Asia/Seoul calendar day. No automatic renewal, no daily rollover. Payment extends from the later of current expiration and approval processing time. It does not reset today's quota.
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

## Signup trial rollout

The restored signup-trial requirement is implemented by `supabase/migrations/20261025005457_talkly_ai_signup_trial.sql`, applied to the approved AI tables on 2026-10-25. `ai_members.trial_used_seconds` is a lifetime reserved/used counter capped at 180. `ai_sessions.entitlement` separates trial from paid usage. Active passes use paid daily minutes first. Failed negotiation and pause refund unused reservation; repeated signup does not reset the counter. Real DB trial grant/refund/exhaustion was checked in a rolled-back transaction. No payment record is created for a trial.

## Schema and quota enforcement

Migration: `supabase/migrations/20261025002307_talkly_ai.sql`. It adds four RLS-enabled tables and three invoker RPCs. No changes to existing profiles, auth triggers, enrollment tables, or existing payment endpoints. All writes and payment secrets are server-only. RPC execution is revoked from PUBLIC/anon/authenticated and granted only to service_role. Own-row reads are granted only for non-secret membership and daily usage.

Server creates at most 240-second provider call leases to fit the route's 300-second duration. Quota is atomically reserved under a member lock before external negotiation. A unique partial index prevents concurrent live calls per member. Normal stop hangs up the provider call then charges server elapsed time and refunds unused reservation. Failed negotiations without an attached provider call refund the reservation. Repeated settlement is idempotent. At midnight or pass expiry the lease ends at that boundary.

The browser automatically reconnects after a lease if daily quota remains. This can briefly interrupt speech at a lease boundary and needs voice UX verification. A server-side Next `after()` watchdog checks for closure, hangs up calls at the lease deadline and retries termination. This is bounded to 300 seconds but MUST be verified on the actual Vercel runtime. A worker crash can delay termination; a subsequent start recovers expired leases before reserving more time. Before commercial scale, consider a durable termination scheduler/provider-side supervisor instead of relying only on a function lifetime. Observe server invocation and DB polling costs.

Payment approval uses server fixed price, owner-scoped orders, bound payment keys, Toss idempotency, and lookup/retry recovery. SQL activation is atomic and idempotent. A refund/cancellation webhook and admin refund mutation are not included in this initial iteration; production financial operations must reconcile cancellations and pass access before public sale.

## Verification completed locally

- Full TypeScript check.
- `node tests/talkly-ai/client-connection.mjs`: cancellation of delayed microphone permission, replacement-attempt isolation, and lease countdown independent of PC wall-clock skew.
- Client countdown uses server timestamps and monotonic browser time; pass validity is computed on the server. Connecting can be cancelled, and old data-channel events are ignored.
- Applied schema verification: all four tables have RLS; all three RPCs are invoker functions with pinned search paths, executable only by service_role.
- Actual database reservation/double-session/refund/idempotence smoke check succeeded inside a rolled-back transaction; no fixture rows remained.
- `node tests/talkly-ai/test-access.mjs`: production/development exclusion, paid-mode exclusion, non-admin rejection, owner-only granting and preservation of a longer pass.
- Local production HTTP smoke checks: public preparation page renders; all disabled AI endpoints return 503; enabled POST endpoints reject unauthenticated requests (401) and foreign origins (403).
- Production Next build, using placeholder build-time configuration; no production API key was read.
- `node tests/talkly-ai/config.mjs`: tutor catalog, plan constants, Korean midnight and bounded memory.
- `TALKLY_AI_PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/talkly-ai/database.mjs`: real ephemeral PostgreSQL migration, expiry, double session rejection, ownership, refunds, settlement replay, quota exhaustion, payment key binding, activation replay, 30-day extension, RLS and grants. This does not replace concurrency/load testing on Supabase.

## Requirements review

See `docs/TALKLY_AI_REQUIREMENTS.md` for agreed features and remaining work, including the still-required monthly learning report.

## Required before production activation

1. Apply migration to isolated staging and run Supabase security advisors.
2. Verify login → separate consent → owned membership and admin views.
3. Use matching Toss TEST keys: approved, cancelled, duplicate confirm, mismatched price/owner/key, timeout after approval; reconcile refunds before paid launch.
4. Grant staging-only test access to a controlled tester, then verify OpenAI model access and real microphone/audio, 10 tutor voice profiles, Korean scaffolding, slow answers, thinking/pause/resume, last-topic continuity.
5. Run a full 10-minute session, a two-tab race, browser close, network failure, midnight/expiry boundary and watchdog enforcement on Vercel. Inspect provider call termination and actual token usage; do not trust the UI timer alone.
6. Review AI-specific privacy/terms, retention, refund policy and child enrollment/consent requirements before sale to minors. The initial join disclosure is not a complete legal policy.
7. Confirm UI on desktop/mobile and no regression to enrollment, teacher/student classroom, admin and existing checkout.

No automatic billing, scheduled month-end delivery, separately recorded custom voices, or validated pronunciation assessment is claimed in this initial version.

## Opt-in learning summaries and monthly review

Applied `20261025011913_talkly_ai_learning_summaries.sql` after the owner selected summary-only storage. Adds nullable `ai_members.learning_summary_consent_at`, owner-readable/server-written `ai_learning_summaries`, and server-only invoker `ai_monthly_activity` with pinned search_path. Production RLS and grants verified; empty report returns zero values; advisors found no new summary/activity findings. No existing classroom or payment schemas changed.

`/talkly-ai/reports` uses verified owner queries and displays Seoul-month settled connected time, active days, learning topics, grounded expressions/corrections and next practice. Separate consent is required before collection; sessions started before consent are excluded. This is a dynamic monthly review, **not scheduled month-end issuance/delivery**. No improvement percentages or pronunciation/CEFR scores. Summary data is AI-generated and browser-transcript-derived, not a verified assessment.

`session/summary` requires an owned closed session and active AI member, consent, conversation text and a start within one hour. One unique session claim prevents repeated provider cost. No raw transcript is stored by this addition. GPT-4.1-mini uses Responses strict JSON schema, store:false, bounded input/output and a 20-second timeout. Exact expression and correction quotations are checked against transcript. Failures are marked, not fabricated; failed/pending rows do not retry automatically. Summary work never delays settlement or automatic voice renewal. Browser close/failed delivery can omit a summary; report coverage discloses this. Latest 1,000 summary records are included with a truncation notice. Consent withdrawal is implemented below; summary retention is implemented below; individual record deletion workflows remain required before public launch.

New checks: `node tests/talkly-ai/reports.mjs`, `node tests/talkly-ai/summary-route.mjs`; PostgreSQL tests now cover summary RLS, insert-claim uniqueness and monthly totals/RPC grants. Production build and local HTTP anonymous401/cross-origin403 passed. Live provider/model access, summary accuracy and real browser/microphone remain unverified.

## Consent withdrawal and delayed summary results

Applied `20261025052121_talkly_ai_summary_preferences.sql`. Adds only `ai_store_learning_summary`, an invoker function with empty search_path and service-role-only EXECUTE. It locks the existing AI member row, verifies active status/current exact consent generation/session owner/closed state/start boundary, and promotes only a pending summary. Opt-out updates the same member row, so completed analysis cannot persist after withdrawal wins the lock. Re-consent rejects results created under old consent. Existing ready records are preserved; no deletion operation or retention policy was added in that consent change; see the subsequent retention migration below. An already-started provider request may complete, but its returned summary is discarded if consent no longer matches.

`/talkly-ai/reports` always displays the consent setting. POST accepts only boolean consent and always uses the authenticated owner. Repeated true preserves the consent timestamp; false withdraws, later true creates a new boundary. Existing recent-conversation memory, paid usage, trial seconds and classroom membership are unchanged.

Tests cover owner-only opt-in/out, invalid types, preservation of repeat-opt-in boundary, withdrawn/re-enabled consent, idempotent save, existing data preservation, and public/client RPC denial. Full TypeScript, regression tests and production build are checked separately. Production function privileges/search_path and missing-owner rejection verified without persistent fixture rows.

The previous linked worktree parent disappeared during inactivity. Work resumed from a clean clone of `feat/talkly-ai-integration` at `2978a276d25f3e036b1c19e560d27f36377aa52f` in `/workspace/scratch/167e89ec3171/talkly-ai-resumed`; old source files were preserved.

## Three-calendar-month learning-summary retention

Owner selected **3 months** in the chat options. Applied `20261025061233_talkly_ai_summary_retention.sql`: created_at index, owner RLS expiry, and invoker/service-only `ai_purge_expired_learning_summaries`. Uses Asia/Seoul calendar-month subtraction, with PostgreSQL month-end clamping. The report's service-side query applies the same cutoff in TypeScript; expired rows are hidden even before physical cleanup. Only `ai_learning_summaries` is deleted. Existing payments, settled usage, sessions, members, classroom records and recent conversation memory are retained under their separate policies.

Reused the installed pg_cron extension after verifying cron.timezone=GMT and no conflicting job. Registered active job `talkly-ai-summary-retention`, `0 20 * * *` (05:00 Korea). Manual live purge returned 0 rows; no sample data was added to production. Checked job command/schedule/active state and role grants. First scheduled execution remains to be observed; storage may lag the three-month boundary until the next daily run, while read expiry is immediate. Backups/provider retention are separate from this operational table policy.

Ephemeral PostgreSQL tests execute the actual purge, test expired-row RLS, current and related record preservation, repeat purge and denied client execution. A test-only cron stub records registration because PGlite does not run a scheduler. Date tests cover 28/29-day February, month end and Seoul midnight. Privacy guide and consent setting disclose the three-month duration and daily cleanup.

## Pending monthly publication migration — do not enable yet

`20261025062822_talkly_ai_monthly_publication.sql` is **NOT APPLIED**. apply_migration twice returned Invalid or expired requestState; follow-up SQL confirmed no ai_monthly_publications table, migration entry or talkly-ai-monthly-publication job. Do not use execute_sql as an unreviewed DDL bypass. Code defaults off behind TALKLY_AI_MONTHLY_REPORTS_ENABLED. Both account and report skip the new table query when off; failure to read an optional publication cannot prevent voice access.

Proposed daily job 10 15 * * * (00:10 Korea) publishes only the last closed Seoul calendar month, for active AI members with summary consent and positive settled usage. Unique owner/month makes retries idempotent. A new partial AI session index supports the monthly scan. Publication stores only month/timestamp/usage totals, never copied learning text. Site account response links to latest retained publication; report shows publication timestamp and frozen usage totals, while learning text remains governed by its original three-month expiry. Publication metadata is also purged after three calendar months by the publisher. No external message delivery.

Tested using ephemeral PostgreSQL: Seoul New Year month boundary, exclusion of current month, active consent gate, aggregate days/seconds/segments, duplicate retry, owner-only SELECT, denied client writes/RPC, expiry and recorded cron schedule. Actual DB/RLS/scheduled execution and signed-in UI remain unverified. Apply the pending migration using the approved schema mechanism, align file name with returned history version, verify grants/job/empty manual run/advisors, then enable only preview and rebuild. Existing retention and consent features remain active independently.

## Explicit response scheduling for patient conversation

Kept semantic VAD low and interruption handling, but create_response is false for every new call. The client TurnCoordinator schedules one response after input_audio_buffer.committed, when neither thinking nor speaking nor another response is active. It reserves pending synchronously on send, not only after response.created arrives. A committed input received during a pending response is queued until response.done; repeated commit item IDs are bounded/deduplicated. Thinking no longer races asynchronous session.update against response.create. No idle timer creates questions.

Initial greetings and text replies use the same pending gate. Automatic renewal carries thinking and a committed, not-yet-requested input after checkpoint settlement. This does not solve speech interrupted at a provider lease boundary; actual audio continuity remains a rollout blocker. Provider error events now stop/settle the call instead of leaving an error banner while connected time continues to accrue.

Tests exercise TurnCoordinator and extract/execute the actual AiStudio onmessage/think/replyWhenReady functions with a fake channel. Checks cover commitment before response, releasing hold while speaking, deferred input during response, duplicate events, idle and provider-error stop. Existing async microphone/time/quota/report gates are regression-tested. No schema, model, paid flag or quota constants changed. Real microphone/listening verification remains pending in docs/TALKLY_AI_VOICE_QA.md.

Official references: https://developers.openai.com/api/docs/guides/realtime-vad and https://developers.openai.com/api/docs/guides/realtime-conversations (keep VAD while controlling response creation). No live OpenAI request or secret value read was needed for these event tests.

## Superseding manual thinking: automatic continuation grace

Owner explicitly removed the thinking button requirement. Removed hold UI/state/think handler and hold payload; pause/end remain. TurnCoordinator now delays only committed audio turns: default1.5s, short1–3 words2.5s, trailing incomplete/filler expressions3.5s, long7+ word statements0.8s; a local rolling short-answer pattern raises default to2.2s. These are initial heuristics, not language-level scores. Transcript updates are anchored to the original commit time, so unrelated events do not continually extend the timer. No new model calls or DB writes.

Speech restart cancels the timer. The coordinator tracks the new speech item and waits for its own commit, so an old/duplicate commit cannot release a new utterance. Text submissions bypass voice grace. Timers clear on local stop and are rebuilt only for pending input on renewal. No silence-only idle event creates a question. Long mid-sentence pauses can still be misjudged; VAD latency is additional to grace, and real listening remains required.

Replaced earlier manual-hold tests with fake-clock/fake-scheduler tests of the actual client handler plus timing rules, resume-before-reply, new-commit matching, duplicate suppression and idle. Manual QA document was rewritten for hands-free use; prior hold instructions in this history are superseded. Existing schema, model, quota and paid flags are unchanged.

## Voice transport/device/playback failure cleanup

AiStudio now funnels data-channel close/error, microphone audio-track ended, peer closed/disconnected/failed, and rejected audio.play through the existing stop/settlement path. Failure during connecting cancels setup too. Callback guards bind to the current peer and connection epoch, so old device/playback events cannot close a replacement connection. Normal local close cancels the epoch first; expiry-boundary remote close retains lease renewal.

`connection-failures.mjs` executes actual failConnection/localClose/stop functions and actual device/channel/peer handlers using fake browser objects. Checks include one-time mic/peer cleanup and settlement, setup failure, stale events, normal close, audio failure, queued summary after settlement, near-expiry renewal, and complete network failure with visible unsettled state. This proves client behavior under mocks, not actual unplug/browser policies or offline quota accuracy. If stop cannot reach the server, settlement awaits watchdog/recovery; do not claim immediate server refunds. No schema, key, price or quota change.

Browser references: MDN MediaStreamTrack ended_event, RTCDataChannel close_event, HTMLMediaElement play. Explicit track.stop does not emit ended, and current-epoch guards also prevent intentional-close recursion.

## Monthly schema retry during connection audit

A fresh read confirmed the monthly publication table/history were still absent and existing retention job active. One apply_migration retry in the new turn again returned Invalid or expired requestState. A follow-up read confirmed no table/history/job. Keep publication off; do not repeat unchanged mutations until the connector request-state issue is resolved. Other UI/voice work is independent and continues.

Existing signup/parent-child code was inspected for launch policy preparation. Student/parent role and phone verification do not by themselves establish the AI learner age or AI parental consent. Initial launch audience remains an explicit product decision; no auth/enrollment/child schema change was made. See docs/TALKLY_AI_LAUNCH_DECISIONS.md.

## Adult-first launch decision and self-declaration gate

Owner chose adult-first in chat. AI consent version is now 2026-10-25-v2-adult19; join requires both explicit adultConfirmed:true and the current notice consent. Consent version/time are the audit record of self-declaration, not verified age. Existing AI member consent renews by updating ONLY consent fields; ignore-duplicate insertion and status-filtered updates preserve trial/pass/suspension/memory. No DOB/ID data, new schema or existing TALKLY signup/child changes.

requireMember defaults to requiring current consent for new AI access. Account exposes needsAdultConsent, and studio shows the updated declaration for legacy members. Withdrawal of learning-summary consent explicitly allows legacy consent so this privacy control is not blocked. Closed-session stop/checkpoint remain available for cleanup. Verified DB aggregate showed zero existing AI members before rollout; no real member records were modified by the tests.

adult-enrollment.mjs executes the actual join route and requireMember function under fake owner-scoped DB operations: boolean declaration, current version, foreign userId ignored, repeat timestamp preservation, legacy renewal with trial/pass/memory preservation, suspended rejection and legacy withdrawal allowance. Provider/identity verification remains separate; this is NOT proof that all underage access is prevented. Before public launch decide age assurance and implement the chosen verification integration. Minor-specific flows are postponed by owner decision.

## Re-engagement preview (no delivery)

Owner requested Kakao/email re-engagement for trial-only users and lapsed paid passes. Added reengagement.ts pure targeting/delivery-decision rules, tests, and admin-only preview using existing AI data. It is a bounded sample (100 members/100 payments/1,000 related sessions), not an authoritative campaign queue. The screen reports actual sendable count zero because no channel consent ledger or send ledger is connected. Drafts include explicit unresolved placeholders and cannot be sent from this UI.

Confirmed existing SMTP and SOLAPI verification SMS code; did not modify them or send messages. Kakao marketing requires brand-message channel setup rather than reusing an informational/SMS payload. Scope/status and next implementation steps are in docs/TALKLY_AI_REENGAGEMENT.md. No new provider/resource install, credentials copied, DB schema change, or message delivery occurred. Full automation remains incomplete until consent persistence, unsubscribe, durable queue/dedup and provider configuration are implemented and verified.


## 2026-10-25 월말 발행 DB 보류 해소

이전 requestState 오류는 이번 적용에서 재현되지 않았습니다. `20261025095815_talkly_ai_monthly_publication`을 운영 DB에 적용하고 RLS, 서비스 역할 전용 실행 권한, `talkly-ai-monthly-publication` cron 활성 및 `10 15 * * *`(매일 한국시간 00:10)을 확인했습니다. 지난달의 마감된 실제 사용량과 요약 저장 동의가 있는 활성 회원을 대상으로 고유 사용자/월 키로 한 번 발행하며, 이후 일일 실행은 중복 없이 재시도합니다. 현재 운영 수동 실행은 정상 종료/신규 0건입니다. 실제 예약 실행과 실제 이용자의 발행 확인은 아직 검증 전입니다. 텍스트 요약 자체를 중복 복사하거나 카카오/이메일로 보내지 않습니다.

테스트 브랜치 preview에만 `TALKLY_AI_MONTHLY_REPORTS_ENABLED=true`를 설정했습니다. 운영 사이트 기능 플래그와 유료 결제는 켜지 않았습니다. 이전 문서의 해당 migration 미적용/flag OFF 상태는 이 기록으로 대체합니다. 독립 PostgreSQL의 연도 경계/지난달 집계/중복 재시도/소유자 RLS/3개월 보관 테스트와 account flag 검증을 통과했습니다.


## 2026-10-25 회원 학습 요약 삭제

`20261025100553_talkly_ai_summary_deletion`을 운영 DB에 적용했습니다. 개인 리포트에 저장 시각/주제별 요약 관리와 삭제 확인/취소를 추가했습니다. 인증한 사용자 ID로만 서비스 전용 `ai_delete_learning_summary`를 호출하며 타인의 존재 여부는 같은 404로 처리합니다. 정지/구버전 동의 회원도 본인 리포트를 읽고 삭제할 수 있게 조회 경로에서 학습 활성화 조건을 분리했습니다. 새로운 회화/생성 권한은 바꾸지 않았습니다.

내용은 null로 지우고 failed/deleted_at 처리하며, 같은 연결의 재생성을 막는 PK와 내용 없는 기록은 기존 3개월 보관 만료까지 남깁니다. 기존 정리 작업이 이후 물리 삭제합니다. 삭제된 행은 RLS와 서버 리포트 쿼리 양쪽에서 제외합니다. 기존 저장 함수는 pending만 ready로 바꾸므로 삭제 후 진행 중 결과가 도착해도 복원하지 못합니다. 회원 행 잠금 순서도 기존 저장 함수와 같습니다. 사용량/결제/세션/월별 발행 합계 및 마지막 대화 기억은 보존합니다. 삭제 UI는 현재 조회된 달/최대 1000건 내에서 20개씩 표시합니다.

독립 PostgreSQL 테스트로 소유권, 내용 삭제, 반복 삭제 시각 유지, 진행 중 생성 차단, PK 재생성 차단, 정지/구버전 회원, RLS/실행 권한과 세션 보존을 확인했습니다. 라우트 테스트는 UUID 검증/본인 바인딩/404/DB 실패/캐시 금지를 확인했습니다. 운영 DB에서는 스키마와 권한만 확인했으며 실제 고객 요약을 삭제하지 않았습니다. 실제 로그인 브라우저의 삭제 클릭 테스트는 아직 미실행입니다.
