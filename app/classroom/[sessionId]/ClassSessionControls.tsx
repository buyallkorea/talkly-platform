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
        { cache: "no-store" }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setStartedAt(data.session.startedAt ?? null);
        setEndedAt(data.session.endedAt ?? null);
      }
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(refreshStatus, 2000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  async function changeStatus(action: "start" | "end") {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/classroom/session-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
      });

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
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "수업 상태 변경 오류"
      );
    } finally {
      setBusy(false);
    }
  }

  const statusPrimary =
    effectiveStatus === "scheduled"
      ? "READY"
      : effectiveStatus === "in_progress"
        ? "LIVE"
        : "COMPLETED";

  const statusSecondary =
    effectiveStatus === "scheduled"
      ? "수업 시작 전"
      : effectiveStatus === "in_progress"
        ? "수업 진행 중"
        : "수업 종료";

  return (
    <>
      <style>{`
        .talkly-session-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .talkly-session-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.045);
        }

        .talkly-session-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .talkly-session-status-copy {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }

        .talkly-session-status-primary {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .07em;
        }

        .talkly-session-status-secondary {
          margin-top: 3px;
          font-size: 9px;
          color: rgba(255,255,255,.5);
        }

        .talkly-session-action {
          min-height: 40px;
          padding: 0 15px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.14);
          background: #f8fafc;
          color: #0f172a;
          cursor: pointer;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,.18);
        }

        .talkly-session-action.end {
          background: #ffffff;
        }

        .talkly-session-action:disabled {
          opacity: .55;
          cursor: default;
        }

        .talkly-session-action-main {
          font-size: 11px;
        }

        .talkly-session-action-sub {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
        }

        .talkly-session-error {
          width: 100%;
          text-align: right;
          color: #fca5a5;
          font-size: 10px;
        }

        @media (max-width: 680px) {
          .talkly-session-controls {
            gap: 6px;
          }

          .talkly-session-status {
            min-height: 34px;
            padding: 0 10px;
          }

          .talkly-session-status-secondary,
          .talkly-session-action-sub {
            display: none;
          }

          .talkly-session-action {
            min-height: 34px;
            padding: 0 11px;
            border-radius: 9px;
          }
        }
      `}</style>

      <div className="talkly-session-controls">
        <div className="talkly-session-status">
          <span
            className="talkly-session-status-dot"
            style={{
              background:
                effectiveStatus === "in_progress"
                  ? "#35d07f"
                  : effectiveStatus === "completed"
                    ? "#94a3b8"
                    : "#fbbf24",
              boxShadow:
                effectiveStatus === "in_progress"
                  ? "0 0 0 4px rgba(53,208,127,.10)"
                  : "none",
            }}
          />

          <span className="talkly-session-status-copy">
            <span className="talkly-session-status-primary">
              {statusPrimary}
            </span>
            <span className="talkly-session-status-secondary">
              {statusSecondary}
            </span>
          </span>
        </div>

        {canControl && effectiveStatus === "scheduled" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("start")}
            className="talkly-session-action"
          >
            <span className="talkly-session-action-main">
              {busy ? "Starting..." : "Start Class"}
            </span>
            <span className="talkly-session-action-sub">수업 시작</span>
          </button>
        )}

        {canControl && effectiveStatus === "in_progress" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("end")}
            className="talkly-session-action end"
          >
            <span className="talkly-session-action-main">
              {busy ? "Ending..." : "End Class"}
            </span>
            <span className="talkly-session-action-sub">수업 종료</span>
          </button>
        )}

        {error && (
          <div className="talkly-session-error">
            {error}
          </div>
        )}
      </div>
    </>
  );
}