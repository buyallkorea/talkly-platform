"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestAction = "reject" | "cancel";

export default function RequestStatusControls({
  requestId,
  status,
  hasAssignment,
  hasPayment,
}: {
  requestId: number;
  status: string;
  hasAssignment: boolean;
  hasPayment: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canCancel = (status === "pending" || status === "approved") && !hasPayment;
  const canReject = status === "pending" && !hasAssignment && !hasPayment;
  if (!canCancel && !canReject) return null;

  async function submit(action: RequestAction) {
    const note = reason.trim();
    if (note.length < 3 || note.length > 1000) {
      setError("처리 사유를 3자 이상 1,000자 이하로 작성해 주세요.");
      return;
    }
    const verb = action === "cancel" ? "취소" : "반려";
    if (!window.confirm(`수강신청 #${requestId}를 ${verb} 처리하시겠습니까?\n\n사유: ${note}\n\n기존 신청 기록은 보존되며 신청자가 다시 신청할 수 있게 됩니다.`)) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/enrollment-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      const result = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "신청 상태를 변경하지 못했습니다.");
      }
      setMessage(`수강신청 #${requestId}의 ${verb} 처리가 완료되었습니다.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="수강신청 반려 및 취소" style={{
      marginTop: 20, padding: 22, borderRadius: 14,
      border: "1px solid #f0d0cb", background: "#fffafa"
    }}>
      <h2 style={{ margin: 0, fontSize: 20, color: "#7a271a" }}>신청 {canReject ? "반려·취소" : "취소"}</h2>
      <p style={{ color: "#475467", fontSize: 13, lineHeight: 1.7 }}>
        결제 승인이 없는 대기·배정 신청만 취소할 수 있습니다.
        미승인 결제 주문과 강사 임시 예약은 함께 종료되며, 원본 신청 기록은 보존됩니다.
        반려는 아직 강사가 배정되지 않은 대기 신청에만 가능합니다.
      </p>
      <label htmlFor="request-disposition-reason" style={{ display: "block", margin: "14px 0 6px", fontWeight: 800, color: "#344054", fontSize: 13 }}>
        처리 사유 (필수)
      </label>
      <textarea id="request-disposition-reason" rows={3} maxLength={1000}
        value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy}
        placeholder="예: 기존 테스트 신청 정리, 신청 조건 재작성 요청"
        style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #d0d5dd", borderRadius: 10, resize: "vertical", font: "inherit", background: "#fff", color: "#101828" }} />
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{error}</p>}
      {message && <p role="status" style={{ color: "#027a48", fontSize: 13 }}>{message}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => submit("cancel")}
          style={{ padding: "11px 18px", borderRadius: 9, border: "1px solid #d0d5dd", background: "#fff", fontWeight: 800, cursor: "pointer" }}>
          {busy ? "처리 중..." : "신청 취소"}
        </button>
        {canReject && (
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => submit("reject")}
            style={{ padding: "11px 18px", borderRadius: 9, border: 0, background: "#b42318", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            신청 반려
          </button>
        )}
      </div>
    </section>
  );
}
