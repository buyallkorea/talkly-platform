"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PendingRequestCancelButton({
  requestId,
  applicationNumber,
  reapplyHref,
}: {
  requestId: number;
  applicationNumber?: string | null;
  reapplyHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!window.confirm(
      `수강신청 ${applicationNumber ?? requestId}를 취소하고 다시 신청하시겠습니까?\n기존 신청 내용은 보관되며, 희망조건은 다시 입력해야 합니다.\n배정·결제 전 대기 신청만 취소할 수 있습니다.`
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
    <div style={{ marginTop: 16, textAlign: "right" }}>
      <p style={{ fontSize: 12, color: "#667085", lineHeight: 1.6 }}>
        신청 조건을 바꾸려면 결제 전 신청을 취소한 뒤 다시 작성할 수 있습니다.
      </p>
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 12 }}>{error}</p>}
      <button type="button" onClick={cancel} disabled={busy}
        style={{ padding: "11px 16px", borderRadius: 9, color: "#b42318",
          background: "#fff", border: "1px solid #fecdca", fontSize: 13,
          fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "취소 처리 중..." : "기존 신청 취소 후 다시 신청"}
      </button>
    </div>
  );
}
