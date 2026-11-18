"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PendingRequestCancelButton({
  requestId,
  applicationNumber,
  reapplyHref,
  hasAssignedTeacher = false,
}: {
  requestId: number;
  applicationNumber?: string | null;
  reapplyHref: string;
  hasAssignedTeacher?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!window.confirm(
      `수강신청 ${applicationNumber ?? requestId}를 취소하고 다시 신청하시겠습니까?\n기존 신청 기록은 보존되지만 미결제 결제 주문과 임시 강사예약은 취소됩니다.\n새로운 신청서에서 희망 조건을 다시 입력해야 합니다.`
    )) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/parent/enrollment-requests/${requestId}/cancel`, {
        method: "POST",
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "신청을 취소하지 못했습니다.");
      }
      router.refresh();
      router.push(reapplyHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "신청 취소 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {error && <p role="alert" style={{ margin: "0 0 8px", width: "100%", color: "#b42318", fontSize: 12 }}>{error}</p>}
      <button type="button" onClick={cancel} disabled={busy}
        title={hasAssignedTeacher ? "결제 전 임시 강사배정과 결제 준비 주문을 해제하고 다시 신청합니다." : "기존 미결제 수강신청을 취소한 뒤 다시 신청합니다."}
        style={{ minHeight: 50, padding: "0 18px", borderRadius: 12, color: "#b42318",
          background: "#fff", border: "1px solid #fda29b", fontSize: 13,
          fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "신청 취소 중..." : "신청 취소 후 다시 신청"}
      </button>
    </div>
  );
}
