"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REFUND_REASONS, REFUND_STATES } from "@/lib/talkly-ai/refunds";
type Row = {
  id: string;
  user_id: string;
  payment_id: string;
  reason: string;
  state: string;
  revision: number;
  created_at: string;
};
export default function RefundReviews({ rows }: { rows: Row[] }) {
  const router = useRouter(),
    guard = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function update(row: Row) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: row.id,
          revision: row.revision,
          state: row.state === "reviewing" ? "awaiting_action" : "reviewing",
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "검토 상태를 저장하지 못했습니다.");
      setMessage(
        "검토 이력을 저장했습니다. 실제 환불·이용권 변경은 수행하지 않았습니다.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !["AbortError", "TimeoutError"].includes(error.name)
          ? error.message
          : "처리 결과를 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>환불 요청 검토 · 최근 100건</h2>
      <p>
        접수·검토 이력만 관리합니다. 추가 처리 대기는 환불 승인·완료가 아닙니다.
        금액 결정, 토스 취소, 이용권 조정은 연결 전입니다.
      </p>
      <button disabled={busy} onClick={() => router.refresh()}>
        접수 현황 새로고침
      </button>
      {!rows.length ? (
        <p>접수된 요청이 없습니다.</p>
      ) : (
        rows.map((row) => (
          <article key={row.id}>
            <p>
              회원 {row.user_id} · 결제 기록 {row.payment_id}
            </p>
            <p>
              {REFUND_REASONS[row.reason]} · {REFUND_STATES[row.state]} · 접수{" "}
              {new Date(row.created_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </p>
            <button disabled={busy} onClick={() => update(row)}>
              {row.state === "reviewing"
                ? "검토 기록 후 추가 처리 대기로"
                : "검토 시작·다시 열기"}
            </button>
          </article>
        ))
      )}
      <p role="status">{message}</p>
    </section>
  );
}
