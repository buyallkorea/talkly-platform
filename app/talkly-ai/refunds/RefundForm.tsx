"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REFUND_REASONS, REFUND_STATES } from "@/lib/talkly-ai/refunds";
export default function RefundForm({
  orderId,
  state,
}: {
  orderId: string;
  state?: string;
}) {
  const router = useRouter();
  const guard = useRef(false);
  const [reason, setReason] = useState("unused"),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [submitted, setSubmitted] = useState(false);
  async function submit() {
    if (guard.current || !confirmed) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason, confirm: true }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "접수하지 못했어요.");
      setSubmitted(true);
      setMessage("환불 검토 요청이 접수됐어요.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !["AbortError", "TimeoutError"].includes(error.name)
          ? error.message
          : "접수 결과를 확인하지 못했어요. 새로고침해 확인하거나 같은 주문으로 다시 신청해 주세요. 중복 접수되지 않아요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      {state || submitted ? (
        <p>{REFUND_STATES[state ?? "requested"] ?? "접수 상태 확인 필요"}</p>
      ) : (
        <>
          <label>
            신청 사유{" "}
            <select
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            >
              {Object.entries(REFUND_REASONS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              신청만으로 환불이 확정되거나 이용권이 종료되지 않으며 관리자가
              확인한다는 안내를 확인했어요.
            </label>
          </p>
          <button disabled={busy || !confirmed} onClick={submit}>
            {busy ? "접수 확인 중…" : "환불 검토 요청"}
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
