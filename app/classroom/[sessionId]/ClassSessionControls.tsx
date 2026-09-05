"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  sessionId: number;
  viewerRole: string;
  initialStartedAt: string | null;
  initialEndedAt: string | null;
};

type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "held"
  | "no_show"
  | "not_held"
  | string;

export default function ClassSessionControls({
  sessionId,
  viewerRole,
  initialStartedAt,
  initialEndedAt,
}: Props) {
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [endedAt, setEndedAt] = useState(initialEndedAt);

  const [effectiveStatus, setEffectiveStatus] =
    useState<SessionStatus>(
      initialEndedAt
        ? "completed"
        : initialStartedAt
          ? "in_progress"
          : "scheduled"
    );

  /*
   * 최초 API 상태 확인 전에는 scheduled 수업의 Start 버튼을
   * 잠시 숨깁니다.
   *
   * 이유:
   * 과거 수업이 DB에서 아직 scheduled 상태로 남아 있어도
   * session-status API가 scheduled_end를 확인하여
   * not_held로 자동마감하기 전까지 Start 버튼이 순간적으로
   * 노출되는 것을 방지합니다.
   */
  const [statusLoaded, setStatusLoaded] = useState(
    Boolean(initialStartedAt || initialEndedAt)
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canControl =
    viewerRole === "teacher" || viewerRole === "admin";

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

        if (
          typeof data.session.effectiveStatus === "string" &&
          data.session.effectiveStatus
        ) {
          setEffectiveStatus(data.session.effectiveStatus);
        } else {
          setEffectiveStatus(
            data.session.endedAt
              ? "completed"
              : data.session.startedAt
                ? "in_progress"
                : "scheduled"
          );
        }

        setStatusLoaded(true);
      }
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    /*
     * 페이지 진입 즉시 한 번 확인합니다.
     * 이후 2초마다 서버 상태를 동기화합니다.
     */
    void refreshStatus();

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
        /*
         * Start 요청 순간에 scheduled_end가 지났다면
         * 서버가 not_held로 마감하고 409를 반환할 수 있습니다.
         * 그 경우 즉시 최신 상태를 다시 받아 화면을 갱신합니다.
         */
        await refreshStatus();

        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "수업 상태를 변경하지 못했습니다."
        );
      }

      setStartedAt(data.session.startedAt ?? null);
      setEndedAt(data.session.endedAt ?? null);

      if (
        typeof data.session.effectiveStatus === "string" &&
        data.session.effectiveStatus
      ) {
        setEffectiveStatus(data.session.effectiveStatus);
      } else {
        setEffectiveStatus(
          data.session.endedAt
            ? "completed"
            : data.session.startedAt
              ? "in_progress"
              : "scheduled"
        );
      }

      setStatusLoaded(true);

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

  const statusText: Record<
    string,
    {
      primary: string;
      secondary: string;
      dot: string;
      glow?: string;
    }
  > = {
    scheduled: {
      primary: "READY",
      secondary: "수업 시작 전",
      dot: "#fbbf24",
    },

    in_progress: {
      primary: "LIVE",
      secondary: "수업 진행 중",
      dot: "#35d07f",
      glow: "0 0 0 4px rgba(53,208,127,.10)",
    },

    completed: {
      primary: "COMPLETED",
      secondary: "수업 종료",
      dot: "#94a3b8",
    },

    held: {
      primary: "HELD",
      secondary: "수업 연기",
      dot: "#60a5fa",
    },

    cancelled: {
      primary: "CANCELLED",
      secondary: "수업 취소",
      dot: "#f87171",
    },

    no_show: {
      primary: "NO SHOW",
      secondary: "결석",
      dot: "#fb7185",
    },

    not_held: {
      primary: "NOT HELD",
      secondary: "미진행",
      dot: "#94a3b8",
    },
  };

  const currentStatus =
    statusText[effectiveStatus] ?? {
      primary: String(effectiveStatus || "STATUS")
        .replaceAll("_", " ")
        .toUpperCase(),
      secondary: "수업 상태",
      dot: "#94a3b8",
    };

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
              background: currentStatus.dot,
              boxShadow: currentStatus.glow ?? "none",
            }}
          />

          <span className="talkly-session-status-copy">
            <span className="talkly-session-status-primary">
              {currentStatus.primary}
            </span>

            <span className="talkly-session-status-secondary">
              {currentStatus.secondary}
            </span>
          </span>
        </div>

        {canControl &&
          statusLoaded &&
          effectiveStatus === "scheduled" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeStatus("start")}
              className="talkly-session-action"
            >
              <span className="talkly-session-action-main">
                {busy ? "Starting..." : "Start Class"}
              </span>

              <span className="talkly-session-action-sub">
                수업 시작
              </span>
            </button>
          )}

        {canControl &&
          effectiveStatus === "in_progress" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeStatus("end")}
              className="talkly-session-action end"
            >
              <span className="talkly-session-action-main">
                {busy ? "Ending..." : "End Class"}
              </span>

              <span className="talkly-session-action-sub">
                수업 종료
              </span>
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