import { getCurrentUser } from "@/lib/server-user";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import OutreachOperations from "./OutreachOperations";
import { REFUND_STATES } from "@/lib/talkly-ai/refunds";
import VoiceUsagePanel from "./VoiceUsagePanel";
import RefundReviews from "./RefundReviews";
import SessionOperations from "./SessionOperations";
import {
  outreachCandidate,
  OUTREACH_DRAFTS,
} from "@/lib/talkly-ai/reengagement";
export const dynamic = "force-dynamic";
const actionStateLabels: Record<string, string> = {
  started: "시작됨 · 결과 확인 필요",
  completed: "종료·정산 완료",
  failed: "종료·정산 확인 실패",
};
const apiFailureLabels: Record<string, string> = {
  access: "접근 권한",
  rate_limit: "요청 한도",
  provider: "제공업체 오류",
  request_rejected: "요청 거부",
  timeout: "응답 시간 초과",
  other: "추가 확인 필요",
};
export default async function AdminAiPage() {
  const {
    data: { user },
  } = await getCurrentUser();
  if (!user) notFound();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") notFound();
  // Presence only: never render credentials or infer provider approval from them.
  const existingSolapiConfigured = [
    process.env.SOLAPI_API_KEY,
    process.env.SOLAPI_API_SECRET,
    process.env.SOLAPI_SENDER_NUMBER,
  ].every((value) => Boolean(value?.trim()));
  if (process.env.TALKLY_AI_ENABLED !== "true")
    return (
      <section>
        <h1>TALKLY AI 관리</h1>
        <p>
          AI 기능은 아직 공개 전입니다. 데이터 구조와 연결 검증 후 활성화합니다.
        </p>
      </section>
    );
  const db = createAdminClient();
  const [
    members,
    payments,
    usage,
    outreachQueue,
    liveSessions,
    adminActions,
    apiEvents,
    refundRequests,
    refundReviews,
    refundAudit,
    voiceUsage,
    voiceObservations,
  ] = await Promise.all([
    db
      .from("ai_members")
      .select(
        "user_id,status,consented_at,consent_version,valid_until,last_tutor_id,trial_used_seconds",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_payments")
      .select("user_id,order_id,amount,status,approved_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_daily_usage")
      .select("user_id,day,used_seconds")
      .order("day", { ascending: false })
      .limit(100),
    db
      .from("ai_outreach_outbox")
      .select("id,kind,channel,state,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_sessions")
      .select("id,user_id,state,started_at,deadline,entitlement")
      .neq("state", "closed")
      .order("started_at", { ascending: true })
      .limit(100),
    db
      .from("ai_session_admin_actions")
      .select(
        "id,actor_id,user_id,session_id,reason,state,created_at,finished_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_api_events")
      .select(
        "kind,model,outcome,failure_kind,http_status,duration_ms,input_tokens,output_tokens,cached_input_tokens,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("ai_refund_requests")
      .select("id,user_id,payment_id,reason,state,revision,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_refund_reviews")
      .select("id,request_id,actor_id,from_state,to_state,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("ai_refund_audit")
      .select("id,request_id,actor_id,event_type,note,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("ai_voice_usage")
      .select(
        "input_tokens,output_tokens,cached_input_tokens,input_audio_tokens,input_text_tokens,output_audio_tokens,output_text_tokens,cached_audio_tokens,cached_text_tokens",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("ai_voice_observations")
      .select("state,reason,recording_errors,dropped_events,started_at")
      .order("started_at", { ascending: false })
      .limit(100),
  ]);
  if (members.error || payments.error || usage.error)
    return (
      <section>
        <h1>TALKLY AI 관리</h1>
        <p>AI 관리 정보를 불러오지 못했습니다. DB 적용 상태를 확인해 주세요.</p>
      </section>
    );
  const memberIds = [...new Set((members.data ?? []).map((m) => m.user_id))];
  const ids = [
    ...new Set([
      ...memberIds,
      ...(refundRequests.data ?? []).map((row) => row.user_id),
      ...(refundAudit.data ?? []).map((row) => row.actor_id),
      ...(refundReviews.data ?? []).flatMap((row) =>
        row.actor_id ? [row.actor_id] : [],
      ),
      ...(liveSessions.data ?? []).map((s) => s.user_id),
      ...(adminActions.data ?? []).flatMap((a) =>
        [a.actor_id, a.user_id].filter((id): id is string => !!id),
      ),
    ]),
  ];
  const refundPaymentIds = [
    ...new Set((refundRequests.data ?? []).map((row) => row.payment_id)),
  ];
  const [namesResult, activityResult, refundOrders] = await Promise.all([
    ids.length
      ? db.from("profiles").select("id,name,role").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? db
          .from("ai_sessions")
          .select("user_id,state,ended_at,charged_seconds")
          .in("user_id", memberIds)
          .order("started_at", { ascending: false })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    refundPaymentIds.length
      ? db
          .from("ai_payments")
          .select(
            "id,user_id,order_id,amount,status,approved_at,activated_until",
          )
          .in("id", refundPaymentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const names = namesResult.data;
  const nameMap = new Map((names ?? []).map((n) => [n.id, n.name]));
  const name = (id: string) => nameMap.get(id) || id;
  const { data: activity, error: activityError } = activityResult;
  const refundOrderMap = new Map(
    (refundOrders.data ?? []).map((order) => [order.id, order]),
  );
  const roleMap = new Map((names ?? []).map((n) => [n.id, n.role]));
  const candidates = activityError
    ? []
    : (members.data ?? []).flatMap((m) => {
        const sessions = (activity ?? []).filter(
          (s) => s.user_id === m.user_id,
        );
        const last =
          sessions
            .filter(
              (s) =>
                s.state === "closed" && s.charged_seconds > 0 && s.ended_at,
            )
            .map((s) => s.ended_at)
            .sort()
            .at(-1) ?? null;
        const orders = (payments.data ?? []).filter(
          (p) => p.user_id === m.user_id,
        );
        const candidate = outreachCandidate({
          id: m.user_id,
          role: roleMap.get(m.user_id) ?? "",
          status: m.status,
          consentVersion: m.consent_version,
          validUntil: m.valid_until,
          trialUsed: m.trial_used_seconds,
          lastActivity: last,
          hasPaid: orders.some((p) => p.status === "paid"),
          activeSession: sessions.some((s) => s.state !== "closed"),
          paymentPending: orders.some((p) => p.status === "confirming"),
        });
        return candidate ? [candidate] : [];
      });
  return (
    <section>
      <h1>TALKLY AI 운영</h1>
      <p>하루 10분 · 30일 13,900원 · 수동 재결제 / 각 목록 최근 100건</p>
      <section>
        <h2>API 요청·사용량 관찰</h2>
        <p>
          저장된 최근 1,000건 기준입니다. 기록이 누락될 수 있어 전체 요청 수나
          실제 청구액을 뜻하지 않습니다. 요약 생성의 서버 응답에서 확인된 토큰만
          표시하며, 이 요청 처리 목록에는 음성 대화·자막 전사의 토큰과 비용을
          표시하지 않습니다. 음성 응답 관찰은 아래 별도 항목을 확인해 주세요.
        </p>
        {apiEvents.error ? (
          <p>API 처리 기록을 불러오지 못했습니다.</p>
        ) : (
          <>
            <ul>
              {["voice_connect", "learning_summary"].map((kind) => {
                const rows = (apiEvents.data ?? []).filter(
                  (event) => event.kind === kind,
                );
                return (
                  <li key={kind}>
                    {kind === "voice_connect"
                      ? "음성 연결 준비"
                      : "학습 요약 생성"}
                    : 기록 {rows.length}건 · 실패{" "}
                    {rows.filter((event) => event.outcome === "failed").length}
                    건
                  </li>
                );
              })}
            </ul>
            <p>
              확인된 요약 토큰: 입력{" "}
              {(apiEvents.data ?? [])
                .reduce((sum, event) => sum + (event.input_tokens ?? 0), 0)
                .toLocaleString()}{" "}
              · 출력{" "}
              {(apiEvents.data ?? [])
                .reduce((sum, event) => sum + (event.output_tokens ?? 0), 0)
                .toLocaleString()}{" "}
              · 입력 중 캐시{" "}
              {(apiEvents.data ?? [])
                .reduce(
                  (sum, event) => sum + (event.cached_input_tokens ?? 0),
                  0,
                )
                .toLocaleString()}
              . 값이 없는 기록을 0 사용량으로 확정하지 않습니다.
            </p>
            <details>
              <summary>요청 처리 기록 · 최근 50건</summary>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>종류</th>
                      <th>모델</th>
                      <th>결과</th>
                      <th>HTTP</th>
                      <th>응답 시간</th>
                      <th>입력 / 출력 토큰</th>
                      <th>기록 시각 · 한국시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apiEvents.data ?? []).slice(0, 50).map((event, index) => (
                      <tr key={`${event.created_at}-${index}`}>
                        <td>
                          {event.kind === "voice_connect"
                            ? "음성 연결"
                            : "학습 요약"}
                        </td>
                        <td>{event.model}</td>
                        <td>
                          {event.outcome === "succeeded"
                            ? "처리 성공"
                            : `실패 (${apiFailureLabels[event.failure_kind ?? "other"] ?? "추가 확인 필요"})`}
                        </td>
                        <td>{event.http_status ?? "확인 안 됨"}</td>
                        <td>{event.duration_ms}ms</td>
                        <td>
                          {event.input_tokens ?? "미수집"} /{" "}
                          {event.output_tokens ?? "미수집"}
                        </td>
                        <td>
                          {new Date(event.created_at).toLocaleString("ko-KR", {
                            timeZone: "Asia/Seoul",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
      <VoiceUsagePanel
        rows={voiceUsage.data ?? []}
        observations={voiceObservations.data ?? []}
        unavailable={!!voiceUsage.error || !!voiceObservations.error}
        enabled={process.env.TALKLY_AI_VOICE_USAGE_ENABLED === "true"}
      />
      {liveSessions.error ? (
        <p>연결 현황을 불러오지 못했습니다.</p>
      ) : (
        <SessionOperations
          sessions={(liveSessions.data ?? []).map((s) => ({
            id: s.id,
            state: s.state,
            started_at: s.started_at,
            deadline: s.deadline,
            entitlement: s.entitlement,
            name: name(s.user_id),
          }))}
        />
      )}
      <details>
        <summary>관리자 연결 정리 이력 · 최근 100건</summary>
        {adminActions.error ? (
          <p>처리 이력을 불러오지 못했습니다.</p>
        ) : !adminActions.data?.length ? (
          <p>처리 이력이 없습니다.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>처리자</th>
                  <th>대상 회원</th>
                  <th>사유</th>
                  <th>결과</th>
                  <th>요청 시각 · 한국시간</th>
                </tr>
              </thead>
              <tbody>
                {adminActions.data.map((action) => (
                  <tr key={action.id}>
                    <td>
                      {action.actor_id ? name(action.actor_id) : "삭제된 계정"}
                    </td>
                    <td>
                      {action.user_id ? name(action.user_id) : "삭제된 계정"}
                    </td>
                    <td>
                      {action.reason === "connection_issue"
                        ? "연결 장애"
                        : "회원 요청"}
                    </td>
                    <td>{actionStateLabels[action.state] ?? action.state}</td>
                    <td>
                      {new Date(action.created_at).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <section
        style={{
          border: "1px solid #d8b4fe",
          borderRadius: 12,
          padding: 20,
          margin: "20px 0",
        }}
      >
        <h2>재이용·재결제 안내 준비</h2>
        <OutreachOperations
          enabled={process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED === "true"}
        />
        <h3>발송 대기열 · 최근 100건</h3>
        {outreachQueue.error ? (
          <p>대기열을 불러오지 못했습니다.</p>
        ) : (
          <>
            <p>
              자동 대상 등록·예약 발송은 연결 전입니다. 아래 수치는 실제 저장된
              최근 기록의 상태이며 전체 집계가 아닙니다.
            </p>
            <ul>
              {Object.entries({
                pending: "대기 중",
                sending: "발송 처리 중",
                accepted: "발송업체 접수",
                failed: "실패",
                unknown: "결과 확인 필요",
                skipped: "제외됨",
              }).map(([state, label]) => (
                <li key={state}>
                  {label}:{" "}
                  {
                    (outreachQueue.data ?? []).filter(
                      (row) => row.state === state,
                    ).length
                  }
                  건
                </li>
              ))}
            </ul>
            <p>
              발송업체 접수는 전달 완료가 아닙니다. 결과가 불명확한 건은 자동
              재시도하지 않습니다.
            </p>
          </>
        )}
        <p>
          <strong>
            {process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED === "true"
              ? "발송 스위치 ON · 설정과 대상 확인 필요"
              : "실제 발송 OFF"}
          </strong>{" "}
          · 관리자 검토용 대상 조건과 문안입니다.
        </p>
        <p>
          기존 토클리 SOLAPI 계정:{" "}
          {existingSolapiConfigured
            ? "이 배포에 설정됨 — 기존 계정 재사용 예정"
            : "이 배포에는 설정되지 않음 — 운영 설정과 별도 확인 필요"}
          . 설정 유무만 확인하며 실제 발송 연결이나 카카오 승인을 검증한 것은
          아닙니다.
        </p>
        <p>
          카카오 발신프로필·광고 메시지 사용 가능 여부는 기존 SOLAPI 계정에서
          확인해야 합니다. 기존에 연결된 프로필이 있으면 우선 재사용합니다. 현재
          카카오는 채널 친구 대상만 처리하며 문자 대체발송이나 친구가 아닌 대상
          확장은 하지 않습니다. 테스트 배포에 운영 발송 키를 복사하거나
          인증문자를 보내지는 않습니다.
        </p>
        <p>
          최근 회원 100명·결제 100건·해당 회원 연결 기록 1,000건 범위의
          미리보기입니다. 전체 대상 집계나 발송 예약 수가 아닙니다.
        </p>
        {activityError ? (
          <p>대상 조건 미리보기를 불러오지 못했습니다.</p>
        ) : (
          <p>
            체험 후 24시간 지난 조건:{" "}
            {candidates.filter((c) => c.kind === "trial_followup").length}명 /
            유료 이용권 만료 후 24시간 지난 조건:{" "}
            {candidates.filter((c) => c.kind === "pass_expired").length}명
          </p>
        )}
        <p>
          채널별 동의 저장과 대기열은 준비됐으며 자동 등록·예약 발송은 연결
          전입니다. 신규 동의와 실제 발송은 별도 서버 설정으로 제어합니다.
          관리자·강사·정지 회원·성인 이용 확인 전 회원·이용 중인 회원·결제 확인
          중인 회원은 제외합니다.
        </p>
        <p>
          기본안: 체험 후 안내는 회원당 1회, 만료 안내는 이용권 만료 회차당 1회.
          한국시간 09–18시, 동의한 채널 한 곳에만 안내합니다. 실제 발송 직전
          재결제·재이용·수신거부를 다시 확인해야 합니다.
        </p>
        {Object.entries(OUTREACH_DRAFTS).map(([kind, draft]) => (
          <details key={kind}>
            <summary>
              {kind === "trial_followup"
                ? "무료 체험 후 안내 문안"
                : "이용권 만료 후 안내 문안"}{" "}
              (초안)
            </summary>
            <p>{draft.title}</p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{draft.text}</pre>
          </details>
        ))}
        <p>
          초안의 서비스 링크·운영 연락처·무료 수신거부 방법을 확정하고, 채널별
          수신동의·중복 방지·발송 기록·제공업체 설정을 확인해야 실제 발송을 켤
          수 있습니다. 카카오는 광고성 브랜드 메시지 연동이 별도로 필요합니다.
        </p>
      </section>
      <h2>AI 가입 회원</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>회원</th>
              <th>상태</th>
              <th>가입일</th>
              <th>이용권 만료</th>
              <th>선택 강사</th>
              <th>무료 체험 사용·예약</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.map((m) => (
              <tr key={m.user_id}>
                <td>{name(m.user_id)}</td>
                <td>{m.status}</td>
                <td>{m.consented_at}</td>
                <td>{m.valid_until ?? "없음"}</td>
                <td>{m.last_tutor_id ?? "-"}</td>
                <td>{m.trial_used_seconds}초 / 180초</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {refundRequests.error ? (
        <p>환불 요청을 불러오지 못했습니다.</p>
      ) : (
        <RefundReviews
          rows={(refundRequests.data ?? []).map((row) => {
            const found = refundOrderMap.get(row.payment_id);
            const order = found?.user_id === row.user_id ? found : null;
            return {
              ...row,
              name: name(row.user_id),
              orderId: order?.order_id ?? null,
              amount: typeof order?.amount === "number" ? order.amount : null,
              paymentStatus: order?.status ?? null,
              approvedAt: order?.approved_at ?? null,
              validUntil: order?.activated_until ?? null,
            };
          })}
        />
      )}
      <details>
        <summary>환불 검토 변경 이력 · 최근 100건</summary>
        {refundReviews.error ? (
          <p>이력을 불러오지 못했습니다.</p>
        ) : (
          <ul>
            {refundReviews.data?.map((row) => (
              <li key={row.id}>
                접수 {row.request_id} ·{" "}
                {row.actor_id ? name(row.actor_id) : "삭제된 관리자"} ·{" "}
                {REFUND_STATES[row.from_state] ?? "상태 확인 필요"} →{" "}
                {REFUND_STATES[row.to_state] ?? "상태 확인 필요"} ·{" "}
                {new Date(row.created_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </li>
            ))}
          </ul>
        )}
      </details>
      <details>
        <summary>환불 요청별 정산 감사 이력 · 최근 500건</summary>
        <p>이 내역은 관리자의 점검 기록이며 실제 Toss 환불 완료나 이용권 회수를 의미하지 않습니다.</p>
        {refundAudit.error ? (
          <p>정산 감사 이력을 조회하지 못했습니다.</p>
        ) : !(refundAudit.data ?? []).length ? (
          <p>등록된 감사 이력이 없습니다.</p>
        ) : (
          (refundRequests.data ?? []).map((request) => {
            const logs = (refundAudit.data ?? []).filter((log) => log.request_id === request.id);
            if (!logs.length) return null;
            const order = refundOrderMap.get(request.payment_id);
            return (
              <div key={request.id}>
                <h3>{order?.order_id ?? request.id} · {name(request.user_id)}</h3>
                <ul>
                  {logs.map((log) => (
                    <li key={log.id}>
                      {new Date(log.created_at).toLocaleString("ko-KR", {timeZone:"Asia/Seoul"})} ·
                      {name(log.actor_id)} ·
                      {log.event_type === "provider_checked" ? "Toss 결제 대조" :
                       log.event_type === "entitlement_reviewed" ? "이용권 정산 검토" : "수동 조치 필요"}
                      : {log.note}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {(refundAudit.data ?? []).length >= 500 && <p>최근 500건까지만 조회했습니다. 전체 이력은 아닙니다.</p>}
      </details>
      <h2>결제 내역</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>회원</th>
              <th>주문번호</th>
              <th>금액</th>
              <th>상태</th>
              <th>승인일</th>
            </tr>
          </thead>
          <tbody>
            {payments.data?.map((p) => (
              <tr key={p.order_id}>
                <td>{name(p.user_id)}</td>
                <td>{p.order_id}</td>
                <td>{p.amount.toLocaleString()}원</td>
                <td>{p.status}</td>
                <td>{p.approved_at ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>일별 사용량</h2>
      <table>
        <thead>
          <tr>
            <th>회원</th>
            <th>한국시간 날짜</th>
            <th>사용·예약 시간</th>
          </tr>
        </thead>
        <tbody>
          {usage.data?.map((u) => (
            <tr key={u.user_id + u.day}>
              <td>{name(u.user_id)}</td>
              <td>{u.day}</td>
              <td>{u.used_seconds}초 / 600초</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
