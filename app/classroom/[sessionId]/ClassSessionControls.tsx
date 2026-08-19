"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  sessionId: number;
  viewerRole: string;
  initialStartedAt: string | null;
  initialEndedAt: string | null;
};

export default function ClassSessionControls({
  sessionId,
  viewerRole,
  initialStartedAt,
  initialEndedAt,
}: Props) {
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [endedAt, setEndedAt] = useState(initialEndedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canControl =
    viewerRole === "teacher" || viewerRole === "admin";

  const effectiveStatus = endedAt
    ? "completed"
    : startedAt
      ? "in_progress"
      : "scheduled";

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/classroom/session-status?sessionId=${sessionId}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStartedAt(data.session.startedAt ?? null);
        setEndedAt(data.session.endedAt ?? null);
      }
    } catch {
      // 상태 조회 실패는 화면 동작을 막지 않습니다.
    }
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(refreshStatus, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshStatus]);

  async function changeStatus(action: "start" | "end") {
    if (busy) {
      return;
    }

    if (action === "end") {
      const confirmed = window.confirm(
        "수업을 종료하시겠습니까?\n\n" +
          "수업을 종료하면 Zoom 수업이 종료되며,\n" +
          "입실 기록이 없는 학생은 결석으로 처리됩니다."
      );

      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/api/classroom/session-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "수업 상태를 변경하지 못했습니다."
        );
      }

      setStartedAt(data.session.startedAt ?? null);
      setEndedAt(data.session.endedAt ?? null);

      if (action === "end") {
        window.location.reload();
        return;
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "수업 상태 변경 오류"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <span
        style={{
          padding: "7px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background:
            effectiveStatus === "in_progress"
              ? "rgba(53,208,127,0.12)"
              : "rgba(255,255,255,0.06)",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {effectiveStatus === "scheduled"
          ? "수업 시작 전"
          : effectiveStatus === "in_progress"
            ? "수업 진행 중"
            : "수업 종료"}
      </span>

      {canControl && effectiveStatus === "scheduled" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => changeStatus("start")}
          style={{
            ...buttonStyle,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "처리 중..." : "수업 시작"}
        </button>
      )}

      {canControl && effectiveStatus === "in_progress" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => changeStatus("end")}
          style={{
            ...buttonStyle,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "종료 중..." : "수업 종료"}
        </button>
      )}

      {error && (
        <span
          style={{
            width: "100%",
            textAlign: "right",
            color: "#ff9b9b",
            fontSize: 11,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#f7f7f8",
  color: "#111216",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};