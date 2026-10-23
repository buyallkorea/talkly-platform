"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "observer" | "student";

export default function TestClassroomModeChooser({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [error, setError] = useState("");

  async function enterMode(mode: Mode) {
    if (pendingMode !== null) return;
    setPendingMode(mode);
    setError("");
    try {
      const response = await fetch("/api/admin/test-classroom/mode", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, mode }),
      });
      const result: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "입장 모드 설정에 실패했습니다.");
      }
      router.replace(`/classroom/${sessionId}?testMode=${mode}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "입장 처리 중 오류가 발생했습니다.");
      setPendingMode(null);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090b0f", color: "#f8fafc", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 560, padding: 28, borderRadius: 16, background: "#15161a", border: "1px solid #30343c" }}>
        <p style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800 }}>TALKLY · TEST CLASSROOM</p>
        <h1 style={{ fontSize: 24, margin: "12px 0" }}>테스트 수업 입장 방식</h1>
        <p style={{ lineHeight: 1.7, color: "#cbd5e1" }}>
          테스트 학생 모드에서는 Zoom에 참가자로 입장하고 채팅·전자칠판·출석을 테스트할 수 있습니다. 강사는 별도 강사 계정으로 입장하여 수업을 시작해야 합니다.
        </p>
        <button type="button" onClick={() => enterMode("observer")} disabled={pendingMode !== null}
          style={{ display: "block", width: "100%", padding: 14, borderRadius: 10, border: 0, background: "#2563eb", color: "white", fontWeight: 800, marginTop: 24, cursor: pendingMode ? "wait" : "pointer", opacity: pendingMode ? 0.7 : 1 }}>
          {pendingMode === "observer" ? "참관 모드 확인 중…" : "관리자 참관 모드로 입장 (읽기 전용)"}
        </button>
        <button type="button" onClick={() => enterMode("student")} disabled={pendingMode !== null}
          style={{ display: "block", width: "100%", padding: 14, borderRadius: 10, border: "1px solid #64748b", background: "#1e293b", color: "white", fontWeight: 800, marginTop: 12, cursor: pendingMode ? "wait" : "pointer", opacity: pendingMode ? 0.7 : 1 }}>
          {pendingMode === "student" ? "테스트 학생 인증 중…" : "테스트 학생으로 입장 · Zoom·채팅·교재 테스트"}
        </button>
        {error && <p role="alert" style={{ color: "#fca5a5", marginTop: 12 }}>{error}</p>}
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16, lineHeight: 1.6 }}>
          Zoom 입장 후 마이크·카메라 사용을 허용하고 오디오 연결·비디오 시작을 눌러 주세요.
          테스트 기능이 비활성화되어 있으면 두 모드 모두 API에서 거부됩니다.
        </p>
      </section>
    </main>
  );
}