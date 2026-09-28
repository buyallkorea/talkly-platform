"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase-browser";

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

type RealtimeSessionRow = {
  id?: number;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

const FALLBACK_POLL_INTERVAL_MS = 60_000;

export default function ClassSessionControls({
  sessionId,
  viewerRole,
  initialStartedAt,
  initialEndedAt,
}: Props) {
  const [supabase] = useState(() => createClient());

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

  const applySessionState =
    useCallback(
      ({
        nextStartedAt,
        nextEndedAt,
        nextEffectiveStatus,
      }: {
        nextStartedAt: string | null;
        nextEndedAt: string | null;
        nextEffectiveStatus: SessionStatus;
      }) => {
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
         * 강사/관리자 또는 다른 브라우저에서 수업 종료가
         * 반영되면 현재 교실을 한 번 새로고침합니다.
         *
         * 종료 이후 서버 페이지가 담당하는 기존 이동/종료 UI를
         * 그대로 사용하기 위해 현재 라우팅 구조는 변경하지 않습니다.
         */
        if (
          (
            nextEffectiveStatus ===
              "completed" ||
            Boolean(nextEndedAt)
          ) &&
          !reloadingRef.current
        ) {
          reloadingRef.current =
            true;

          window.location.reload();
        }
      },
      []
    );

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

        applySessionState({
          nextStartedAt,
          nextEndedAt,
          nextEffectiveStatus,
        });
      } catch {
        /*
         * 일시적인 네트워크 오류는 Realtime 또는
         * 다음 fallback 확인 주기에서 다시 복구합니다.
         */
      }
    }, [
      applySessionState,
      sessionId,
    ]);

  useEffect(() => {
    /*
     * 페이지 진입 직후 서버 API를 한 번 호출합니다.
     *
     * 이 호출은 단순 상태 조회뿐 아니라 기존 session-status API의
     * scheduled_end 검사 / not_held 자동마감 로직을 계속 보존하기
     * 위해 유지합니다.
     */
    void refreshStatus();

    /*
     * class_sessions 변경은 Supabase Realtime으로 즉시 수신합니다.
     *
     * 채널은 sessionId별로 분리하여 다른 수업의 상태 변경이
     * 현재 교실에 영향을 주지 않도록 합니다.
     */
    const channel =
      supabase
        .channel(
          `class-session-status-${sessionId}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "class_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            if (
              reloadingRef.current
            ) {
              return;
            }

            const nextRow =
              payload.new as RealtimeSessionRow;

            const nextStartedAt =
              nextRow.started_at ??
              null;

            const nextEndedAt =
              nextRow.ended_at ??
              null;

            let nextEffectiveStatus:
              SessionStatus;

            if (
              typeof nextRow.status ===
                "string" &&
              nextRow.status
            ) {
              nextEffectiveStatus =
                nextRow.status;
            } else {
              nextEffectiveStatus =
                nextEndedAt
                  ? "completed"
                  : nextStartedAt
                    ? "in_progress"
                    : "scheduled";
            }

            applySessionState({
              nextStartedAt,
              nextEndedAt,
              nextEffectiveStatus,
            });
          }
        )
        .subscribe();

    /*
     * Realtime 연결 누락/일시 장애 및 scheduled_end 자동마감
     * 보조용 fallback입니다.
     *
     * 기존 2초 polling:
     *   사용자 1명당 분당 30회
     *
     * 변경 후:
     *   사용자 1명당 분당 1회
     *
     * 수업 Start/End 자체는 Realtime으로 즉시 반영됩니다.
     */
    const fallbackTimer =
      window.setInterval(
        refreshStatus,
        FALLBACK_POLL_INTERVAL_MS
      );

    return () => {
      window.clearInterval(
        fallbackTimer
      );

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    applySessionState,
    refreshStatus,
    sessionId,
    supabase,
  ]);

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

      applySessionState({
        nextStartedAt,
        nextEndedAt,
        nextEffectiveStatus,
      });

      if (
        action === "end" &&
        !reloadingRef.current
      ) {
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