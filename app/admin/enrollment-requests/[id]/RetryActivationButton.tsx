"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryActivationButton({ requestId }: { requestId: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function retry() {
    if (saving || !window.confirm("결제된 수강정보와 수업 일정을 다시 생성·확인하시겠습니까? 추가 결제는 진행하지 않습니다.")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/enrollment-requests/${requestId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.error || "수강 활성화에 실패했습니다.");
        return;
      }
      router.refresh();
      setMessage("수강정보 활성화 요청을 완료했습니다. 아래 수업 일정 상태를 다시 확인해 주세요.");
    } catch {
      setMessage("연결 오류로 처리 결과를 확인하지 못했습니다. 수강정보를 확인 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" onClick={retry} disabled={saving} style={{
        minHeight: 44, padding: "10px 16px", borderRadius: 9, border: "1px solid #b42318",
        color: "#b42318", background: "#fff", fontWeight: 800, cursor: saving ? "wait" : "pointer"
      }}>
        {saving ? "수강 활성화 확인 중..." : "결제된 수강 및 수업 생성 다시 시도"}
      </button>
      {message && <p role="status" style={{ color: "#b42318", marginTop: 8 }}>{message}</p>}
    </div>
  );
}
