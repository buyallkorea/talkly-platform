import { getCurrentUser } from "@/lib/server-user";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
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
  const [members, payments, usage] = await Promise.all([
    db
      .from("ai_members")
      .select("user_id,status,consented_at,valid_until,last_tutor_id")
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
    ? await db.from("profiles").select("id,name").in("id", ids)
    : { data: [] };
  const nameMap = new Map((names ?? []).map((n) => [n.id, n.name]));
  const name = (id: string) => nameMap.get(id) || id;
  return (
    <section>
      <h1>TALKLY AI 운영</h1>
      <p>하루 10분 · 30일 13,900원 · 수동 재결제 / 각 목록 최근 100건</p>
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
