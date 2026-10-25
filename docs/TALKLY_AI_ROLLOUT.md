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


## 2026-10-25 연결 등록·종료 경합 보완

`20261025110204_talkly_ai_session_closing`을 운영 DB에 적용했습니다. ai_sessions에 closing 상태를 추가하고 서비스 역할 전용 ai_begin_close RPC가 회원/세션을 잠근 뒤 먼저 종료 중으로 전환하고 call_id를 반환합니다. 서버는 이 호출 이후 provider hangup 성공을 확인하고 기존 ai_finish로 정산합니다. hangup 실패 시 closing/예약 사용량을 유지해 재시도가 가능하며 종료 확인 전에 이용 시간을 풀지 않습니다. 기존 watchdog와 만료 세션 복구 경로는 closing도 미종료로 처리합니다.

음성 연결 등록은 소유자/connecting/유효 deadline 조건을 모두 확인하고 실제 갱신된 id를 반환받습니다. 갱신 0행이면 409로 응답하고 새로 만든 provider call을 종료한 뒤 예약 실패 정리를 수행합니다. 기존에는 0행이어도 성공 응답으로 진행할 수 있었습니다. 등록이 먼저인 경우 begin_close가 해당 call_id를 읽고, 종료가 먼저면 connecting 조건이 더는 맞지 않아 늦은 등록을 차단합니다.

독립 PostgreSQL 테스트로 두 순서, 예약 유지/새 예약 차단, 중복 정산 환불 1회와 소유자/RPC 권한을 확인했습니다. 실제 서버 함수/라우트 실행 테스트로 begin-close→hangup→finish 순서, hangup 실패 시 정산 차단, 등록 0행의 provider 정리·409, 정상 등록의 watchdog 예약을 확인했습니다. 운영 실제 통화는 만들거나 종료하지 않았습니다. 이는 네트워크가 끊겨 provider 종료 자체를 확인할 수 없는 경우나 함수 강제 종료까지 해결한 영속 supervisor를 뜻하지 않습니다. 실제 마이크/장시간 통화 및 런타임 watchdog 검증은 여전히 남아 있습니다.


## 2026-10-25 수준 적응 및 상황 회화 지침 보강

학습자의 현재 실력에 맞는 자연스러운 현지 회화를 목표로 튜터 지침을 보강했습니다. 여러 의미 있는 발화의 이해/표현/도움 의존도를 보되, 답변 속도·억양·한 번의 단답만으로 수준을 진단하지 않습니다. 쉬운 문장/한 생각부터 시작해 편안한 독립 답변이 이어지면 이유·비교·가정을 한 단계씩 추가하고 어려우면 되돌립니다. 쉬운 영어/천천히/더 어렵게라는 명시적 요청은 바로 반영하도록 합니다. CEFR·향상률·점수는 만들지 않습니다. 새 레벨 DB나 개인정보 프로필을 추가하지 않았습니다.

주제 메뉴나 고정 레벨테스트 없이 자유 회화를 유지합니다. 역할극 요청 시 빠진 역할/목적만 최소 확인하고 호텔·카페·면접 등 실제 상황의 상대역을 맡아 진행하도록 했습니다. 예상 밖의 합리적 상황 변화/중단/주제 전환을 따르고, 장면 도중 잠깐 도움을 준 후 복귀하며, 실제 예약/결제/전화 같은 외부 행동을 했다고 주장하지 않습니다. 정당한 짧은 답변을 매번 따라 말하기로 바꾸지 않고, 교정은 의미/반복 오류 중심으로 최대 한 가지, 교정 연기 요청도 존중합니다.

기존 단어→문장 유도, 최소 한국어, 자동 대기와 AI 정체성/안전 원칙은 유지했습니다. docs/TALKLY_AI_VOICE_QA.md에 수준/상황 평가 사례와 관찰 기준을 추가했으며 실제 모델·악센트·음성 결과는 미검증입니다. 코드 테스트 통과를 실제 원어민 강사 수준의 성능 증명으로 해석하지 않습니다. 지침 변경은 새 음성 연결부터 적용됩니다.


## 2026-10-25 테스트 진행 시점 및 관리자 연결 운영

사용자 결정: 실제 기기/마이크/대화 품질 등 실사용 테스트는 사이트 오픈 후 차례로 진행하고, 그 전에는 합의한 구현 작업과 코드/DB 검증을 계속합니다. 실제 테스트를 통과했다고 기록하지 않습니다. main 병합·공개 운영 배포·유료 결제 활성화의 별도 승인을 대신하지 않습니다.

관리자에 오래된 미종료 연결 최대 100건 조회/새로고침, 사유 선택과 확인 후 연결 정리 기능을 추가했습니다. 연결 내용·원음·provider call_id는 조회/전달하지 않습니다. 관리자 이력 최근 100건에 요청자/대상/사유/시작 및 완료·실패 상태를 표시합니다. 운영 DB `20261025112815_talkly_ai_admin_session_actions`는 서비스 역할 전용 RLS 테이블이며 적용 검증 시 0건입니다. 사용자 계정이나 연결이 삭제되면 참조는 null로 처리합니다. 운영 이력 보관 기간은 정식 정책 확정 시 함께 정해야 하며 요약 3개월 정책을 임의로 적용하지 않았습니다.

API는 동일 출처와 서버 profiles.role=admin을 매번 확인하며, 명시적 confirm=true와 제한된 사유/UUID를 검증합니다. 대상 회원은 브라우저 값이 아니라 세션 조회 결과에서 가져옵니다. 요청 이력 저장 실패 시 종료를 실행하지 않습니다. closeSession의 기존 provider 종료/시간 정산 순서를 사용하고 임의 사용량 리셋이나 결제 환불을 하지 않습니다. 이미 종료된 연결은 재정산하지 않습니다. 종료 성공 후 이력 결과 갱신만 실패하면 성공 여부와 이력 경고를 분리합니다. 중간 함수 종료로 started가 남으면 결과 확인 대상으로 표시합니다. 관리자 권한/입력/소유자 바인딩/감사 실패/종료 실패/반복 종료/이력 경고와 DB RLS를 코드·독립 PostgreSQL 테스트로 검증했습니다. 실제 회원 연결 정리나 고객 통화를 수행하지 않았습니다.


## 2026-10-25 API 운영 관찰 기반

`20261025115633_talkly_ai_api_events`를 운영 DB에 적용하고 서버 전용 권한/RLS와 초기 0건을 확인했습니다. 음성 연결·요약 생성의 서버 처리 결과와 요약 API가 반환한 유효 토큰만 지연 기록하며 관리자에 최근 표본을 표시합니다. 개인 대화/음성/SDP/키/오류 원문은 추가 저장하지 않습니다. 응답 후 제한 시간 내 best-effort 저장이라 누락/지연 가능하며 실제 음성 청구 토큰이나 전체 과금 원장이 아닙니다. 정확한 비용 계산·청구 대사·자동 예산 차단은 아직 미구현입니다. 구현·검증 및 남은 범위는 docs/TALKLY_AI_API_OBSERVABILITY.md에 정리했습니다. 기존 OpenAI 요청만 관찰하며 검증을 위해 실제 통화나 별도 유료 API 요청은 만들지 않았습니다.


## 2026-10-25 품질 유지와 낭비 방지

사용자는 회화 품질/비용/불편 없는 사용을 함께 요구했습니다. 모델·하루 10분·발화 대기 흐름을 유지하며 중복 및 반복 요청 보호와 백그라운드 DB 조회 축소부터 적용합니다. `20261025122413_talkly_ai_connection_rate_limit`을 운영 DB에 적용하고 RLS/서비스 역할 전용 RPC/초기 0건을 확인했습니다. 일반 시작은 6회/60초 및 30회/시간, 서버가 확인한 직전 정상 paid lease 갱신은 1회 제외하며 실제 일일 한도 검사는 그대로 수행합니다. 제한 시 신규 예약/제공업체 호출 없이 429와 재시도 시간을 안내하며 종료·정산 API는 유지합니다. watchdog 상태 조회는 10초 간격이지만 남은 시간으로 마지막 대기를 줄여 종료 경계를 유지합니다. 코드/독립 PostgreSQL/가상 시계 검증 결과와 실제 미검증 범위는 docs/TALKLY_AI_COST_POLICY.md에 있습니다. 실제 비용 감소나 무불편을 실증한 것으로 표시하지 않습니다.


## 2026-10-25 월별 학습 활동 비교

월간 리포트에 선택 월과 이전 두 달(최대 3개월)의 정산 연결시간/학습 일수 표를 추가했습니다. 영어 능력 점수·향상률·성취도나 자동 재연결 구간을 수업 횟수로 표시하지 않습니다. 진행 중인 달과 월별 일수 차이를 명시하고, 월말 발행 스냅샷이 있으면 그 합계를 사용하며 나머지는 현재 정산 기록을 사용합니다. 조회 실패/잘못된 숫자는 0으로 만들지 않고 불러오지 못한 상태로 표시합니다. 이전 월의 사용량 조회가 실패하더라도 유효한 발행 스냅샷이 있으면 사용할 수 있습니다.

`20261025130957_talkly_ai_activity_history` 적용: 서비스 역할 전용 RPC가 인증 세션에서 가져온 사용자 ID와 최대 3개월 범위를 한 번에 집계합니다. 월별 최초 날짜/유효한 끝 날짜/최대 범위/미래 범위를 DB에서도 검증하고, 빈 달은 실제 0 합계로 명시합니다. 소유자 우선 부분 인덱스는 기존 전역 월말 발행 인덱스와 별개로 추가했습니다. 데이터 변경/새 AI 호출/새 대화 내용 저장은 없습니다. 월 링크의 자동 prefetch를 끄고 선택 월은 링크를 중복 생성하지 않아 불필요한 조회를 줄였습니다.

코드·독립 PostgreSQL 테스트로 연도 경계/윤년/최초 지원월/미래월 정규화, 회원 격리, 중복 날짜의 학습 일수, 월말 exclusive 경계, 활성·0초 연결 제외, 서버 전용 권한, 한 번의 묶음 조회와 스냅샷 우선/장애 fallback/실제 0과 미수집 구별을 확인했습니다. 실제 로그인 UI/모바일 화면 테스트는 사용자 결정대로 오픈 후 실행할 항목입니다. 요약 삭제·3개월 요약 보관·기존 사용량/결제 정책은 유지합니다.


## 2026-10-25 취소·환불 초기 운영 및 결제 확인

사용자는 채팅 선택지에서 **관리자 확인 후 처리**를 선택했습니다. 관리자 검토 방식으로 운영하며 자동 환불 금액 산식은 정하지 않았습니다. 구체적인 환불 기준/신청·검토 화면/실제 토스 취소/이용권 회수 처리는 아직 미구현이며 유료 판매 전 확정할 항목입니다. 이번 선택을 실제 환불 실행이나 정책의 법적 적합성 확정으로 해석하지 않습니다. 이용 안내에도 준비 상태를 반영했습니다.

독립적인 결제 확인 안정성 작업을 완료했습니다. 확인 중 재시도 버튼 비활성, 50초 응답 제한/화면 이탈 시 요청 취소, 같은 주문 재확인 안내, 정상 성공 후에만 URL의 결제 파라미터 제거를 추가했습니다. 이미 이용권에 반영된 주문은 새로 반영했다고 표시하지 않습니다. 서버 maxDuration=60, 기존 제공업체 조회 15초/승인 20초와 같은 멱등키를 유지하고 GET/POST 캐시를 끕니다. 토스 결제 키/주문번호 허용 범위와 빈 키를 검증하고, paid 빠른 응답도 키/금액/이용권 날짜를 확인합니다. 404 이외의 조회 오류에서는 승인 POST를 추가하지 않습니다. provider DONE/금액/통화/주문/키/승인 시각 및 이용권 반영 날짜가 유효해야 성공합니다. 승인 후 이용권 DB 실패는 미확인 상태로 남겨 같은 주문 조회를 재시도하게 합니다.

실제 라우트/클라이언트 effect의 가상 테스트로 결제 OFF 차단, 소유자 조건, 멱등 재확인, 조회 장애 시 승인 생략, 변조/취소 상태 차단, 이용권 반영 재시도, 대기/타임아웃/이탈 처리를 확인했습니다. 실제 토스 승인·취소·환불/테스트 결제나 새 비밀 키는 사용하지 않았고 운영 결제 플래그는 OFF입니다. 공식 객체/상태/파라미터 참고: https://docs.tosspayments.com/reference .


### 기존 주문의 조회 전용 복구

결제 확인 중 페이지를 떠난 경우를 위해 결제 내역의 confirming 주문에 ‘승인 여부 다시 확인’을 추가했습니다. lookupOnly=true 경로는 인증된 본인 주문의 저장된 키만 서버에서 사용하며 클라이언트 키를 신뢰하지 않습니다. DONE과 주문/금액/통화/키/승인 시각이 검증될 때 기존 ai_activate로 반영합니다. 이 모드는 provider GET만 사용하고 READY/IN_PROGRESS/404에서는 승인 POST를 보내지 않습니다. 따라서 새 구매가 OFF여도 기존 승인 건을 조회해 반영할 수 있습니다. 신규 승인 경로는 기존 OFF 플래그로 계속 차단합니다. preview에 운영 토스 키를 복사하지 않았으며 실제 조회/승인도 실행하지 않았습니다.

클라이언트 복구는 진행 중 회화/연결/정산과 중복 클릭을 막고, 응답 확인 후 계정을 새로 읽습니다. 이용권 반영은 확인됐지만 계정 새로고침만 실패한 경우를 분리해 안내합니다. 시작 버튼도 결제 작업 중 비활성화합니다. 가상 라우트/클라이언트 함수 테스트로 키 미노출/새 승인 없음/OFF 중 조회 복구/미승인 건 차단/중복과 회화 중 차단/새로고침 실패를 확인했습니다. 실제 기기·토스 결제 검증은 오픈 후 항목입니다.


### 초기 계정/결제 확인 화면 정적 검사 보완

대상 파일 정적 검사에서 effect 본문의 동기 상태 갱신을 발견해 응답 콜백으로 옮겼습니다. 초기 계정 조회와 결제 확인은 시작 전 화면이 닫히면 요청을 생략하고, 이미 진행 중이면 늦은 응답을 화면에 적용하지 않습니다. 결제 재확인의 대기 표시는 클릭 이벤트에서 설정하며 최초 화면은 대기 상태로 시작합니다. 관련 effect/함수 가상 검증과 대상 ESLint/TypeScript 검사를 통과했습니다. 실제 UI 성능 향상을 실측한 것으로 해석하지 않습니다.

## 2026-10-25 환불 접수·검토 단계

- `/talkly-ai/refunds`에서 본인의 결제 완료 주문 최근 100건에 환불 검토를 요청한다. 학습 정지/동의 갱신 전 상태도 결제 지원 접근을 막지 않는다.
- 주문당 요청 하나, 사유는 고정 선택값만 저장한다. 자유 입력 개인정보나 결제 키를 추가 저장하지 않는다. 같은 주문 재시도는 기존 접수 ID를 반환한다.
- 관리자는 접수→검토 중→추가 처리 대기(재검토 가능)로 변경한다. DB에서도 관리자 확인, 행 잠금, revision 충돌 방지 및 같은 트랜잭션의 변경 이력을 보장한다.
- 추가 처리 대기는 환불 승인/완료가 아니다. 금액 산정·토스 취소 API·이용권 회수·자동 알림은 구현 전이다. 새 결제 승인은 OFF이며 실제 고객 결제/환불/문자 발송을 실행하지 않았다.
- 서버 전용 테이블/RPC, 서비스 역할만 접근. 운영 DB에는 빈 테이블과 함수를 추가하고 검증은 로컬 가상 데이터로 수행한다. 실제 로그인 화면/결제/환불 사용 테스트는 오픈 후 진행 예정이다.
- 검토 이력 보관/삭제 정책과 판매 전 환불 기준·연락 방법 확정은 남아 있다. 현재 최근 100건 목록이며 전체 검색/페이지 이동은 미구현이다.

## 2026-10-25 이전 대화 기억 삭제

- 월간 학습 리포트에 별도 확인/취소가 있는 기억 삭제 기능을 추가했다. 저장된 마지막 최대 20개 발언만 지우며 학습 요약·결제·사용 시간·동의·선택 강사는 변경하지 않는다.
- 서버 인증 사용자 ID로만 삭제한다. 정지/동의 갱신 전에도 본인 정보 삭제를 막지 않는다.
- DB의 현재 시각을 저장 기준으로 남겨 삭제 이전 시작 회화의 늦은 체크포인트가 내용을 복원하지 못하게 한다. 새로 시작한 회화는 다시 저장할 수 있다. 진행 중 제공업체 문맥은 지워지지 않으므로 종료 후 사용하도록 안내한다.
- 추가 AI 호출은 없다. 데이터·API 검증 완료, 실제 로그인 화면 클릭과 음성 연계는 오픈 후 테스트 예정이며 통과한 것으로 간주하지 않는다.
- Supabase CLI 마이그레이션 파일 생성 후 외부 사용 통계 전송은 자동 승인 검토에서 차단됐다. 해당 전송은 재시도하지 않았다. 생성된 파일과 승인된 DB 커넥터로 작업을 완료했다.

## 2026-10-25 승인 전 실패·만료 주문 상태 정리

기존 확인 요청의 결제사 응답이 ABORTED/EXPIRED이고 승인 시각이 null이며 주문/결제키/금액/통화가 모두 일치할 때만 미승인 주문을 failed로 기록한다. 갱신 조건은 본인 주문, 저장된 키 일치, ready/confirming/failed 상태, 승인·이용권 반영 시각 null이다. 동시 변경으로 조건이 달라지면 처리 완료로 표시하지 않는다. 승인·이용권 추가 요청을 하지 않으며 paid/CANCELED/PARTIAL_CANCELED 주문의 실제 취소·환불·이용권 회수 기능은 아니다.

서버가 확인한 종료 상태에서는 재시도 안내를 멈추고 계정 내역을 갱신한다. 내역 갱신 실패 시 종료 사실과 새로고침 필요를 구분한다. 신규 결제 승인 OFF 유지. 실제 Toss 호출 없이 제공업체 응답 모형으로 정상·변조·동시 변경·UI 실패 처리를 검증했다. 상태 정의: https://docs.tosspayments.com/reference .

## 2026-10-25 음성 응답 사용량 관찰 준비

서버 sideband 관찰기, 응답별 토큰/음성·텍스트·캐시 구분, 서버 전용 테이블과 관리자 최근 표본 패널을 구현했다. 기본 스위치 OFF 유지, 실제 socket/API 요청 없음. 원음/대화 원문은 이 기록에 저장하지 않는다. 누락·저장 오류·수집 한도는 별도로 표시하며 사용량 없음=0 또는 청구액 완성으로 간주하지 않는다. 상세 구현·테스트·전송량/플랫폼 비용 검증 및 보관 정책 잔여 범위는 docs/TALKLY_AI_VOICE_USAGE.md에 정리했다. 운영 DB 마이그레이션 20261025151758 적용, 초기 테이블 0건/서버 전용 권한과 RLS 확인.
