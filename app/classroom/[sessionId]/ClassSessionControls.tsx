"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  const [startedAt, setStartedAt] =
    useState(initialStartedAt);

  const [endedAt, setEndedAt] =
    useState(initialEndedAt);

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
  const [statusLoaded, setStatusLoaded] =
    useState(
      Boolean(
        initialStartedAt ||
          initialEndedAt
      )
    );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * 상대방이 수업을 종료했을 때
   * 중복 reload가 발생하지 않도록 보호합니다.
   */
  const reloadingRef =
    useRef(false);

  const canControl =
    viewerRole === "teacher" ||
    viewerRole === "admin";

  const refreshStatus =
    useCallback(async () => {
      if (reloadingRef.current) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/classroom/session-status?sessionId=${sessionId}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          return;
        }

        const nextStartedAt =
          data.session.startedAt ??
          null;

        const nextEndedAt =
          data.session.endedAt ??
          null;

        let nextEffectiveStatus:
          SessionStatus;

        if (
          typeof data.session
            .effectiveStatus ===
            "string" &&
          data.session.effectiveStatus
        ) {
          nextEffectiveStatus =
            data.session
              .effectiveStatus;
        } else {
          nextEffectiveStatus =
            nextEndedAt
              ? "completed"
              : nextStartedAt
                ? "in_progress"
                : "scheduled";
        }

        setStartedAt(
          nextStartedAt
        );

        setEndedAt(
          nextEndedAt
        );

        setEffectiveStatus(
          nextEffectiveStatus
        );

        setStatusLoaded(true);

        /*
         * 기존 ClassSessionEndWatcher가 담당하던 기능입니다.
         *
         * 강사 또는 관리자가 다른 브라우저에서 수업을 종료했거나,
         * 상대방의 종료 처리가 DB에 반영된 것을 확인하면
         * 현재 교실 페이지를 한 번 새로고침합니다.
         *
         * 이렇게 하면 별도의 2초 polling 컴포넌트가 필요 없습니다.
         */
        if (
          nextEffectiveStatus ===
            "completed" &&
          !reloadingRef.current
        ) {
          reloadingRef.current =
            true;

          window.location.reload();
        }
      } catch {
        /*
         * 일시적인 네트워크 오류는
         * 다음 확인 주기에서 다시 시도합니다.
         */
      }
    }, [sessionId]);

  useEffect(() => {
    /*
     * 페이지 진입 즉시 한 번 확인합니다.
     *
     * 현재 1단계에서는 기존 동작 안정성을 유지하기 위해
     * 2초 polling 자체는 유지합니다.
     *
     * 단, ClassSessionEndWatcher의 중복 polling을 제거하여
     * 수업 진행 중 동일 API 호출을 절반 수준으로 줄입니다.
     *
     * 다음 단계에서 Supabase Realtime + 느린 fallback polling
     * 구조로 변경할 예정입니다.
     */
    void refreshStatus();

    const timer =
      window.setInterval(
        refreshStatus,
        2000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [refreshStatus]);

  async function changeStatus(
    action: "start" | "end"
  ) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/classroom/session-status",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              sessionId,
              action,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        /*
         * Start 요청 순간에 scheduled_end가 지났다면
         * 서버가 not_held로 마감하고 409를 반환할 수 있습니다.
         * 그 경우 즉시 최신 상태를 다시 받아 화면을 갱신합니다.
         */
        await refreshStatus();

        throw new Error(
          typeof data.error ===
            "string"
            ? data.error
            : "수업 상태를 변경하지 못했습니다."
        );
      }

      const nextStartedAt =
        data.session.startedAt ??
        null;

      const nextEndedAt =
        data.session.endedAt ??
        null;

      let nextEffectiveStatus:
        SessionStatus;

      if (
        typeof data.session
          .effectiveStatus ===
          "string" &&
        data.session.effectiveStatus
      ) {
        nextEffectiveStatus =
          data.session
            .effectiveStatus;
      } else {
        nextEffectiveStatus =
          nextEndedAt
            ? "completed"
            : nextStartedAt
              ? "in_progress"
              : "scheduled";
      }

      setStartedAt(
        nextStartedAt
      );

      setEndedAt(
        nextEndedAt
      );

      setEffectiveStatus(
        nextEffectiveStatus
      );

      setStatusLoaded(true);

      if (action === "end") {
        reloadingRef.current =
          true;

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
      glow:
        "0 0 0 4px rgba(53,208,127,.10)",
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
    statusText[
      effectiveStatus
    ] ?? {
      primary: String(
        effectiveStatus ||
          "STATUS"
      )
        .replaceAll("_", " ")
        .toUpperCase(),

      secondary:
        "수업 상태",

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
              background:
                currentStatus.dot,

              boxShadow:
                currentStatus.glow ??
                "none",
            }}
          />

          <span className="talkly-session-status-copy">
            <span className="talkly-session-status-primary">
              {
                currentStatus.primary
              }
            </span>

            <span className="talkly-session-status-secondary">
              {
                currentStatus.secondary
              }
            </span>
          </span>
        </div>

        {canControl &&
          statusLoaded &&
          effectiveStatus ===
            "scheduled" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                changeStatus(
                  "start"
                )
              }
              className="talkly-session-action"
            >
              <span className="talkly-session-action-main">
                {busy
                  ? "Starting..."
                  : "Start Class"}
              </span>

              <span className="talkly-session-action-sub">
                수업 시작
              </span>
            </button>
          )}

        {canControl &&
          effectiveStatus ===
            "in_progress" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                changeStatus(
                  "end"
                )
              }
              className="talkly-session-action end"
            >
              <span className="talkly-session-action-main">
                {busy
                  ? "Ending..."
                  : "End Class"}
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