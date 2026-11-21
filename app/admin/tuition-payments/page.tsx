import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "수강료·결제관리 | TALKLY", robots: { index: false } };

type Tab = "payments" | "evidence" | "refunds";
type Query = { tab?: string; q?: string; status?: string; from?: string; to?: string; page?: string };
type PaymentRow = {
  id: number; enrollment_request_id: number; child_id: number | null;
  order_id: string; order_name: string | null; amount: number; currency: string;
  status: string; toss_status: string | null; payment_method: string | null;
  created_at: string; approved_at: string | null; cancelled_at: string | null;
  failure_code: string | null;
};
type ConsentRow = {
  id: number; payment_id: number; enrollment_request_id: number; order_id: string;
  terms_version: string; terms_sha256: string; terms_snapshot: unknown;
  decisions: unknown; pricing_snapshot: unknown; consented_at: string;
};
const PAGE_SIZE = 25;
const dateOK = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—";
const fmtMoney = (n: number, currency = "KRW") =>
  currency === "KRW" ? n.toLocaleString("ko-KR") + "원" : n.toLocaleString("ko-KR") + " " + currency;
const statusLabel = (status: string) => ({
  paid: "결제 완료", pending: "결제 대기", ready: "결제 준비", failed: "결제 실패",
  cancelled: "결제 취소", canceled: "결제 취소",
}[status] ?? status);
const badge = (status: string) =>
  ["paid"].includes(status) ? "is-success" :
  ["failed", "cancelled", "canceled"].includes(status) ? "is-danger" : "is-neutral";
const pageUrl = (tab: Tab, q: string, status: string, from: string, to: string, page: number) => {
  const p = new URLSearchParams({ tab, page: String(page) });
  if (q) p.set("q", q);
  if (status && tab === "payments") p.set("status", status);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  return "/admin/tuition-payments?" + p.toString();
};

export default async function TuitionPaymentsAdminPage({ searchParams }: { searchParams: Promise<Query> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Ftuition-payments");
  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const p = await searchParams;
  const tab: Tab = p.tab === "evidence" || p.tab === "refunds" ? p.tab : "payments";
  const q = (p.q ?? "").trim().slice(0, 100);
  const status = ["all", "paid", "pending", "ready", "failed", "cancelled"].includes(p.status ?? "") ? (p.status ?? "all") : "all";
  const from = dateOK(p.from) ? p.from! : "";
  const to = dateOK(p.to) ? p.to! : "";
  const page = /^\d+$/.test(p.page ?? "") ? Math.max(1, Math.min(10000, Number(p.page))) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const admin = createAdminClient();

  const payments = tab !== "evidence";
  let rows: PaymentRow[] = [];
  let consents: ConsentRow[] = [];
  let count = 0;
  let errorMessage = "";

  if (payments) {
    let query = admin.from("enrollment_payments")
      .select("id,enrollment_request_id,child_id,order_id,order_name,amount,currency,status,toss_status,payment_method,created_at,approved_at,cancelled_at,failure_code", { count: "exact" });
    if (tab === "refunds") query = query.or("status.eq.cancelled,status.eq.canceled,cancelled_at.not.is.null");
    else if (status !== "all") query = query.eq("status", status);
    // Search only the payment order ID; never expose gateway payment keys.
    if (q) query = query.ilike("order_id", "%" + q.replace(/[%,]/g, "") + "%");
    if (from) query = query.gte(tab === "refunds" ? "created_at" : "created_at", from + "T00:00:00+09:00");
    if (to) {
      const end = new Date(to + "T00:00:00+09:00");
      end.setUTCDate(end.getUTCDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }
    const result = await query.order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (result.error) errorMessage = "결제 기록을 불러오지 못했습니다: " + result.error.message;
    else { rows = (result.data ?? []) as PaymentRow[]; count = result.count ?? 0; }
  } else {
    let query = admin.from("tuition_payment_consents")
      .select("id,payment_id,enrollment_request_id,order_id,terms_version,terms_sha256,terms_snapshot,decisions,pricing_snapshot,consented_at", { count: "exact" });
    if (q) query = query.ilike("order_id", "%" + q.replace(/[%,]/g, "") + "%");
    if (from) query = query.gte("consented_at", from + "T00:00:00+09:00");
    if (to) {
      const end = new Date(to + "T00:00:00+09:00");
      end.setUTCDate(end.getUTCDate() + 1);
      query = query.lt("consented_at", end.toISOString());
    }
    const result = await query.order("consented_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (result.error) errorMessage = "동의 증빙을 불러오지 못했습니다: " + result.error.message;
    else { consents = (result.data ?? []) as ConsentRow[]; count = result.count ?? 0; }
  }

  const childIds = [...new Set(rows.map(row => row.child_id).filter((id): id is number => id !== null))];
  const childResult = childIds.length ? await admin.from("children").select("id,name").in("id", childIds) : null;
  const childNames = new Map((childResult?.data ?? []).map(child => [Number(child.id), String(child.name ?? "")]));
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <main className="talkly-payment-center">
      <header className="talkly-payment-center-heading">
        <span className="talkly-payment-eyebrow">TALKLY · ADMIN</span>
        <h1>수강료·결제관리</h1>
        <p>수강료 결제와 당시 동의 증빙을 한곳에서 조회합니다. 이 화면은 읽기 전용으로, 결제 승인이나 환불을 실행하지 않습니다.</p>
      </header>
      <nav className="talkly-payment-tabs" aria-label="수강료 관리 메뉴">
        <Link aria-current={tab === "payments" ? "page" : undefined} href="/admin/tuition-payments?tab=payments">결제내역</Link>
        <Link aria-current={tab === "evidence" ? "page" : undefined} href="/admin/tuition-payments?tab=evidence">결제·동의 증빙</Link>
        <Link aria-current={tab === "refunds" ? "page" : undefined} href="/admin/tuition-payments?tab=refunds">취소·환불 확인</Link>
      </nav>
      <form className="talkly-payment-filter" method="get" action="/admin/tuition-payments">
        <input type="hidden" name="tab" value={tab}/>
        <label>주문번호 검색<input name="q" type="search" defaultValue={q} placeholder="주문번호" maxLength={100}/></label>
        {tab === "payments" && <label>결제 상태<select name="status" defaultValue={status}>
          <option value="all">전체</option><option value="paid">결제 완료</option>
          <option value="pending">대기</option><option value="ready">준비</option>
          <option value="failed">실패</option><option value="cancelled">취소</option>
        </select></label>}
        <label>시작일<input type="date" name="from" defaultValue={from}/></label>
        <label>종료일<input type="date" name="to" defaultValue={to}/></label>
        <button type="submit">조회</button>
        <Link href={"/admin/tuition-payments?tab=" + tab}>초기화</Link>
      </form>
      <div className="talkly-payment-section-heading">
        <h2>{tab === "payments" ? "수강료 결제내역" : tab === "evidence" ? "결제 당시 동의 증빙" : "취소·환불 관련 결제 기록"}</h2>
        <span>조회 결과 {count.toLocaleString("ko-KR")}건</span>
      </div>
      {tab === "refunds" && <p className="talkly-payment-warning">이 목록은 취소 상태 또는 취소 시각이 기록된 수강료 결제를 보여줍니다. 취소 기록이 실제 환불 완료 금액을 보증하지는 않습니다. 최종 환불금액과 토스 거래 내역은 별도 확인하세요.</p>}
      {errorMessage && <p role="alert" className="talkly-payment-error">{errorMessage}</p>}
      <div className="talkly-payment-table-wrap">
        {payments ? <table className="talkly-payment-table">
          <thead><tr><th>주문 / 신청</th><th>학생</th><th>결제금액</th><th>결제상태</th><th>결제수단</th><th>처리일</th></tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.id}>
              <td><strong>{row.order_id}</strong><small>신청 #{row.enrollment_request_id} · 결제 #{row.id}</small></td>
              <td>{row.child_id ? childNames.get(row.child_id) || ("학생 #" + row.child_id) : "—"}</td>
              <td className="talkly-payment-money">{fmtMoney(row.amount, row.currency)}</td>
              <td><span className={"talkly-payment-status " + badge(row.status)}>{statusLabel(row.status)}</span>
                {row.toss_status && <small>토스: {row.toss_status}</small>}</td>
              <td>{row.payment_method || "—"}</td>
              <td>{fmtDate(row.cancelled_at || row.approved_at || row.created_at)}<small>{row.cancelled_at ? "취소 기록 시각" : row.approved_at ? "승인 시각" : "신청 시각"}</small></td>
            </tr>)}
            {!rows.length && <tr><td colSpan={6} className="talkly-payment-empty">{errorMessage ? "조회 오류" : "조회된 결제 기록이 없습니다."}</td></tr>}
          </tbody>
        </table> : <table className="talkly-payment-table">
          <thead><tr><th>동의 시각</th><th>주문 / 신청</th><th>동의 버전</th><th>결제·약관 증빙</th></tr></thead>
          <tbody>{consents.map(record => <tr key={record.id}>
            <td>{fmtDate(record.consented_at)}</td>
            <td><strong>{record.order_id}</strong><small>신청 #{record.enrollment_request_id} · 결제 #{record.payment_id}</small></td>
            <td>{record.terms_version}</td>
            <td><details><summary>당시 증빙 보기</summary>
              <div className="talkly-payment-evidence"><p><strong>약관 해시:</strong> {record.terms_sha256}</p>
                <strong>동의 선택 결과</strong><pre>{JSON.stringify(record.decisions, null, 2)}</pre>
                <strong>당시 결제 조건</strong><pre>{JSON.stringify(record.pricing_snapshot, null, 2)}</pre>
                <strong>동의한 약관 원문</strong><pre>{JSON.stringify(record.terms_snapshot, null, 2)}</pre>
              </div>
            </details></td>
          </tr>)}
          {!consents.length && <tr><td colSpan={4} className="talkly-payment-empty">{errorMessage ? "조회 오류" : "조회된 동의 기록이 없습니다."}</td></tr>}
          </tbody>
        </table>}
      </div>
      <div className="talkly-payment-pages"><span>{page} / {pages} 페이지</span>
        {page > 1 && <Link href={pageUrl(tab,q,status,from,to,page - 1)}>이전</Link>}
        {page < pages && <Link href={pageUrl(tab,q,status,from,to,page + 1)}>다음</Link>}
      </div>
      <footer className="talkly-payment-foot">
        <p>수강료 거래만 표시합니다. AI 서비스·교재 별도 결제는 포함하지 않습니다. 결제 정보를 수정하거나 취소 처리할 때는 승인된 별도 업무 절차를 이용하세요.</p>
        <Link href="/admin/payment-test">토스 테스트 결제</Link>
        <Link href="/admin/enrollment-requests">수강 신청 관리</Link>
      </footer>
    </main>
  );
}
