import Link from "next/link";
import { AiError, context } from "@/lib/talkly-ai/server";
import RefundForm from "./RefundForm";
export const dynamic = "force-dynamic";
async function loadRefunds() {
  try {
    const { user, db } = await context();
    const [payments, requests] = await Promise.all([
      db
        .from("ai_payments")
        .select("id,order_id,amount,status,approved_at")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("ai_refund_requests")
        .select("payment_id,state,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (payments.error || requests.error)
      throw new Error("Refund lookup failed");
    return { payments, requests, error: null };
  } catch (error) {
    return {
      payments: null,
      requests: null,
      error:
        error instanceof AiError
          ? error.message
          : "결제·접수 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
    };
  }
}
export default async function Refunds() {
  const { payments, requests, error } = await loadRefunds();
  if (error || !payments || !requests)
    return (
      <main className="tai tai-info">
        <h1>결제·환불 문의</h1>
        <p>{error}</p>
        <Link href="/talkly-ai">TALKLY AI로 돌아가기</Link>
      </main>
    );
  return (
    <main className="tai tai-info">
      <h1>결제·환불 문의</h1>
      <p>
        결제 완료 주문 최근 100건입니다. 신청하면 관리자가 검토합니다. 이 화면의
        검토 상태는 실제 환불 완료를 뜻하지 않아요. 요청만으로 이용권이나 결제
        상태는 바뀌지 않아요.
      </p>
      <p>환불 금액 기준과 실제 환불 처리는 판매 개시 전 확정 예정입니다.</p>
      {!payments.data?.length && <p>표시할 결제 완료 주문이 없어요.</p>}
      {payments.data?.map((p) => (
        <section className="tai-card" key={p.id}>
          <h2>{p.order_id}</h2>
          <p>
            {p.amount.toLocaleString()}원 · 승인{" "}
            {p.approved_at
              ? new Date(p.approved_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })
              : "확인 필요"}
          </p>
          <RefundForm
            orderId={p.order_id}
            state={requests.data?.find((r) => r.payment_id === p.id)?.state}
          />
        </section>
      ))}
      <Link href="/talkly-ai">회화 화면으로 돌아가기</Link>
    </main>
  );
}
