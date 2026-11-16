import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PaymentConsentsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fpayment-consents");

  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: records, error } = await admin.from("tuition_payment_consents")
    .select("id,payment_id,enrollment_request_id,actor_user_id,order_id,terms_version,terms_snapshot,decisions,pricing_snapshot,terms_sha256,consented_at")
    .order("consented_at", { ascending: false }).limit(100);

  const cell: React.CSSProperties = { padding: "12px", borderBottom: "1px solid #e6eaf0", verticalAlign: "top", wordBreak: "break-word" };
  return (
    <main style={{ maxWidth: 1130, margin: "0 auto", padding: "32px 20px", color: "#102849" }}>
      <h1>결제 전 동의 증빙</h1>
      <p style={{ color: "#667085", lineHeight: 1.8 }}>주문별 동의 원문, 버전, 선택 결과, 최종 수강료, 서버 기록 시각을 조회합니다. 인쇄 메뉴를 이용해 증빙 PDF를 저장할 수 있습니다. 관리자만 접근할 수 있습니다.</p>
      {error ? <p role="alert">기록을 불러오지 못했습니다: {error.message}</p> : null}
      <div style={{ overflowX: "auto", background: "white", borderRadius: 14, border: "1px solid #e6eaf0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#edf4ff" }}>{["동의 시각","주문 / 신청","계정","동의 내용 및 가격"].map(h=><th key={h} scope="col" style={{...cell,textAlign:"left"}}>{h}</th>)}</tr></thead>
          <tbody>{(records ?? []).map((record)=>(
            <tr key={record.id}>
              <td style={cell}>{new Date(record.consented_at).toLocaleString("ko-KR",{ timeZone:"Asia/Seoul" })}</td>
              <td style={cell}><b>{record.order_id}</b><div>신청 #{record.enrollment_request_id} · 결제 #{record.payment_id}</div></td>
              <td style={cell}>{record.actor_user_id}</td>
              <td style={cell}>
                <details><summary style={{ cursor:"pointer",fontWeight:800 }}>증빙 전문 보기</summary>
                  <p>약관 버전: {record.terms_version}</p>
                  <p>약관 SHA-256: {record.terms_sha256}</p>
                  <p>동의 결과: {JSON.stringify(record.decisions)}</p>
                  <p>결제 조건: {JSON.stringify(record.pricing_snapshot)}</p>
                  <div style={{whiteSpace:"pre-wrap",padding:10,background:"#f5f8fc",borderRadius:8}}>{JSON.stringify(record.terms_snapshot,null,2)}</div>
                </details>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!error && (records ?? []).length===0 && <p>아직 수강료 결제 동의 기록이 없습니다.</p>}
    </main>
  );
}
