import { getCurrentUser } from "@/lib/server-user";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import {
  outreachCandidate,
  OUTREACH_DRAFTS,
} from "@/lib/talkly-ai/reengagement";
export const dynamic = "force-dynamic";
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
  const [members, payments, usage, outreachQueue] = await Promise.all([
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
  ]);
  if (members.error || payments.error || usage.error)
    return (
      <section>
        <h1>TALKLY AI 관리</h1>
        <p>AI 관리 정보를 불러오지 못했습니다. DB 적용 상태를 확인해 주세요.</p>
      </section>
    );
  const ids = [...new Set((members.data ?? []).map((m) => m.user_id))];
  const { data: names } = ids.length
    ? await db.from("profiles").select("id,name,role").in("id", ids)
    : { data: [] };
  const nameMap = new Map((names ?? []).map((n) => [n.id, n.name]));
  const name = (id: string) => nameMap.get(id) || id;
  const { data: activity, error: activityError } = ids.length
    ? await db
        .from("ai_sessions")
        .select("user_id,state,ended_at,charged_seconds")
        .in("user_id", ids)
        .order("started_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };
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
      <section
        style={{
          border: "1px solid #d8b4fe",
          borderRadius: 12,
          padding: 20,
          margin: "20px 0",
        }}
      >
        <h2>재이용·재결제 안내 준비</h2>
        <h3>발송 대기열 · 최근 100건</h3>
        {outreachQueue.error ? (
          <p>대기열을 불러오지 못했습니다.</p>
        ) : (
          <>
            <p>
              자동 등록·발송은 연결 전입니다. 아래 수치는 실제 저장된 최근
              기록의 상태이며 전체 집계가 아닙니다.
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
          <strong>실제 발송 OFF</strong> · 관리자 검토용 대상 조건과 문안입니다.
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
          확인해야 합니다. 기존에 연결된 프로필이 있으면 우선 재사용합니다.
          테스트 배포에 운영 발송 키를 복사하거나 인증문자를 보내지는 않습니다.
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
          현재 별도 이메일·카카오 광고 수신동의와 발송 이력 저장이 연결되지 않아
          발송 가능 대상은 0명입니다. 관리자·강사·정지 회원·성인 이용 확인 전
          회원·이용 중인 회원·결제 확인 중인 회원은 제외합니다.
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
          수신동의·중복 방지·발송 기록·제공업체 설정을 완료해야 실제 발송을 켤
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
