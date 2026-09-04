"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

type Tool =
  | "select"
  | "pen"
  | "highlighter"
  | "line"
  | "eraser";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  pageId: number;
  kind: "pen" | "highlighter" | "line";
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  authorId: string;
  createdAt: number;
};

type Props = {
  sessionId: number;
  textbookId: number;
  pageId: number;
  pageNumber: number;
  viewerRole: string;
};

type WhiteboardAction =
  | {
      type: "add";
      stroke: Stroke;
    }
  | {
      type: "remove";
      pageId: number;
      strokeId: string;
    }
  | {
      type: "clear";
      pageId: number;
    };

type SyncPayload = {
  sessionId: number;
  senderId: string;
  pages: Record<string, Stroke[]>;
  sentAt: number;
};

const PEN_COLOR = "#ff3b30";
const HIGHLIGHT_COLOR = "#ffd60a";
const SAVE_DELAY_MS = 500;

export default function ClassroomWhiteboardOverlay({
  sessionId,
  textbookId,
  pageId,
  pageNumber,
  viewerRole,
}: Props) {
  const isController =
    viewerRole === "teacher" ||
    viewerRole === "admin";

  const [tool, setTool] =
    useState<Tool>("select");

  const [pages, setPages] =
    useState<Record<string, Stroke[]>>({});

  const [draft, setDraft] =
    useState<Stroke | null>(null);

  const [connected, setConnected] =
    useState(false);

  const [saveState, setSaveState] =
    useState<
      "idle" | "loading" | "saving" | "saved" | "error"
    >("loading");

  const [supabase] =
    useState(() => createClient());

  const senderId = useMemo(
    () =>
      `wb-${Math.random()
        .toString(36)
        .slice(2)}-${Date.now()}`,
    []
  );

  const channelRef =
    useRef<RealtimeChannel | null>(null);

  const pagesRef =
    useRef<Record<string, Stroke[]>>({});

  const drawingRef =
    useRef(false);

  const saveTimersRef =
    useRef<Record<string, number>>({});

  const loadedPagesRef =
    useRef<Set<string>>(new Set());

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const pageKey =
    String(pageId);

  const strokes =
    pages[pageKey] ?? [];

  function normalizePoint(
    event: ReactPointerEvent<SVGSVGElement>
  ): Point {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      ((event.clientX - rect.left) /
        rect.width) *
      100;

    const y =
      ((event.clientY - rect.top) /
        rect.height) *
      100;

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function makeStroke(
    point: Point
  ): Stroke {
    const highlighter =
      tool === "highlighter";

    return {
      id:
        `${senderId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
      pageId,
      kind:
        tool === "line"
          ? "line"
          : highlighter
            ? "highlighter"
            : "pen",
      points: [point],
      color: highlighter
        ? HIGHLIGHT_COLOR
        : PEN_COLOR,
      width: highlighter ? 3.2 : 0.75,
      opacity: highlighter ? 0.34 : 0.95,
      authorId: senderId,
      createdAt: Date.now(),
    };
  }

  async function broadcastAction(
    action: WhiteboardAction
  ) {
    if (!channelRef.current) {
      return;
    }

    await channelRef.current.send({
      type: "broadcast",
      event: "talkly-whiteboard-action",
      payload: {
        sessionId,
        senderId,
        action,
        sentAt: Date.now(),
      },
    });
  }

  async function persistPage(
    targetPageId: number,
    targetPageNumber: number,
    targetStrokes: Stroke[]
  ) {
    setSaveState("saving");

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      setSaveState("error");
      console.error(
        "[WHITEBOARD] user check failed",
        userError
      );
      return;
    }

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabase
      .from("classroom_whiteboard_states")
      .upsert(
        {
          session_id: sessionId,
          textbook_id: textbookId,
          page_number:
            targetPageNumber,
          strokes:
            targetStrokes,
          updated_by: user.id,
          updated_at: now,
        },
        {
          onConflict:
            "session_id,textbook_id,page_number",
        }
      );

    if (error) {
      setSaveState("error");
      console.error(
        "[WHITEBOARD] save failed",
        error
      );
      return;
    }

    setSaveState("saved");

    window.setTimeout(() => {
      setSaveState("idle");
    }, 1200);

    console.log(
      "[WHITEBOARD] saved",
      {
        sessionId,
        textbookId,
        pageId:
          targetPageId,
        pageNumber:
          targetPageNumber,
        strokeCount:
          targetStrokes.length,
      }
    );
  }

  function schedulePersist(
    targetPageId: number,
    targetPageNumber: number,
    targetStrokes: Stroke[]
  ) {
    const key =
      `${sessionId}:${textbookId}:${targetPageNumber}`;

    const existing =
      saveTimersRef.current[key];

    if (existing) {
      window.clearTimeout(
        existing
      );
    }

    saveTimersRef.current[key] =
      window.setTimeout(() => {
        delete saveTimersRef.current[
          key
        ];

        void persistPage(
          targetPageId,
          targetPageNumber,
          targetStrokes
        );
      }, SAVE_DELAY_MS);
  }

  function resolvePageNumber(
    targetPageId: number
  ) {
    if (
      targetPageId === pageId
    ) {
      return pageNumber;
    }

    return null;
  }

  function applyAction(
    action: WhiteboardAction,
    persist: boolean
  ) {
    setPages((current) => {
      const next = {
        ...current,
      };

      let affectedPageId: number;

      if (action.type === "add") {
        affectedPageId =
          action.stroke.pageId;

        const key =
          String(affectedPageId);

        const list =
          next[key] ?? [];

        if (
          list.some(
            (item) =>
              item.id ===
              action.stroke.id
          )
        ) {
          return current;
        }

        next[key] = [
          ...list,
          action.stroke,
        ];
      } else if (
        action.type === "remove"
      ) {
        affectedPageId =
          action.pageId;

        const key =
          String(affectedPageId);

        next[key] = (
          next[key] ?? []
        ).filter(
          (item) =>
            item.id !==
            action.strokeId
        );
      } else {
        affectedPageId =
          action.pageId;

        next[
          String(affectedPageId)
        ] = [];
      }

      pagesRef.current = next;

      if (persist) {
        const targetPageNumber =
          resolvePageNumber(
            affectedPageId
          );

        if (
          targetPageNumber !==
          null
        ) {
          schedulePersist(
            affectedPageId,
            targetPageNumber,
            next[
              String(
                affectedPageId
              )
            ] ?? []
          );
        }
      }

      return next;
    });
  }

  function finishDraft() {
    if (!draft) {
      drawingRef.current = false;
      return;
    }

    const minimumPoints =
      draft.kind === "line"
        ? 2
        : 1;

    if (
      draft.points.length >=
      minimumPoints
    ) {
      const action: WhiteboardAction = {
        type: "add",
        stroke: draft,
      };

      applyAction(
        action,
        true
      );

      void broadcastAction(
        action
      );
    }

    setDraft(null);
    drawingRef.current = false;
  }

  function handlePointerDown(
    event: ReactPointerEvent<SVGSVGElement>
  ) {
    if (tool === "select") {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    const point =
      normalizePoint(event);

    if (tool === "eraser") {
      drawingRef.current = true;
      eraseAtPoint(
        point,
        event.pointerType || "mouse"
      );
      return;
    }

    drawingRef.current = true;

    const stroke =
      makeStroke(point);

    if (
      stroke.kind === "line"
    ) {
      stroke.points = [
        point,
        point,
      ];
    }

    setDraft(stroke);
  }

  function handlePointerMove(
    event: ReactPointerEvent<SVGSVGElement>
  ) {
    if (!drawingRef.current) {
      return;
    }

    const point =
      normalizePoint(event);

    if (tool === "eraser") {
      eraseAtPoint(
        point,
        event.pointerType || "mouse"
      );
      return;
    }

    if (!draft) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      if (
        current.kind === "line"
      ) {
        return {
          ...current,
          points: [
            current.points[0],
            point,
          ],
        };
      }

      return {
        ...current,
        points: [
          ...current.points,
          point,
        ],
      };
    });
  }

  function distanceToSegment(
    point: Point,
    start: Point,
    end: Point
  ) {
    const dx =
      end.x - start.x;
    const dy =
      end.y - start.y;

    if (dx === 0 && dy === 0) {
      return Math.hypot(
        point.x - start.x,
        point.y - start.y
      );
    }

    const t =
      Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * dx +
            (point.y - start.y) * dy) /
            (dx * dx + dy * dy)
        )
      );

    const px =
      start.x + t * dx;
    const py =
      start.y + t * dy;

    return Math.hypot(
      point.x - px,
      point.y - py
    );
  }

  function strokeHit(
    stroke: Stroke,
    point: Point,
    pointerType: string
  ) {
    const baseTolerance =
      pointerType === "touch"
        ? 5.8
        : pointerType === "pen"
          ? 4.2
          : 3.4;

    const tolerance =
      stroke.kind === "highlighter"
        ? baseTolerance + 1.2
        : baseTolerance;

    if (stroke.points.length === 1) {
      return (
        Math.hypot(
          point.x - stroke.points[0].x,
          point.y - stroke.points[0].y
        ) <= tolerance
      );
    }

    for (
      let index = 0;
      index < stroke.points.length - 1;
      index += 1
    ) {
      if (
        distanceToSegment(
          point,
          stroke.points[index],
          stroke.points[index + 1]
        ) <= tolerance
      ) {
        return true;
      }
    }

    return false;
  }

  function eraseAtPoint(
    point: Point,
    pointerType: string
  ) {
    const current =
      pagesRef.current[pageKey] ?? [];

    const target =
      [...current]
        .reverse()
        .find((stroke) =>
          strokeHit(
            stroke,
            point,
            pointerType
          )
        );

    if (!target) {
      return;
    }

    removeStroke(target.id);
  }

  function removeStroke(
    strokeId: string
  ) {
    const action: WhiteboardAction = {
      type: "remove",
      pageId,
      strokeId,
    };

    applyAction(
      action,
      true
    );

    void broadcastAction(
      action
    );
  }

  function undoLast() {
    const current =
      pagesRef.current[
        pageKey
      ] ?? [];

    const last =
      current[
        current.length - 1
      ];

    if (!last) {
      return;
    }

    removeStroke(
      last.id
    );
  }

  function clearPage() {
    if (
      !window.confirm(
        "Clear all notes on this page?\n이 페이지의 모든 필기를 지울까요?"
      )
    ) {
      return;
    }

    const action: WhiteboardAction = {
      type: "clear",
      pageId,
    };

    applyAction(
      action,
      true
    );

    void broadcastAction(
      action
    );
  }

  useEffect(() => {
    const key =
      `${sessionId}:${textbookId}:${pageNumber}`;

    if (
      loadedPagesRef.current.has(
        key
      )
    ) {
      setSaveState("idle");
      return;
    }

    let cancelled = false;

    async function loadSavedPage() {
      setSaveState("loading");

      const {
        data,
        error,
      } = await supabase
        .from(
          "classroom_whiteboard_states"
        )
        .select("strokes")
        .eq(
          "session_id",
          sessionId
        )
        .eq(
          "textbook_id",
          textbookId
        )
        .eq(
          "page_number",
          pageNumber
        )
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setSaveState("error");

        console.error(
          "[WHITEBOARD] load failed",
          error
        );

        return;
      }

      const savedStrokes =
        Array.isArray(
          data?.strokes
        )
          ? (data.strokes as Stroke[])
          : [];

      setPages((current) => {
        const existing =
          current[pageKey] ??
          [];

        const merged =
          existing.length >
          0
            ? existing
            : savedStrokes;

        const next = {
          ...current,
          [pageKey]:
            merged,
        };

        pagesRef.current =
          next;

        return next;
      });

      loadedPagesRef.current.add(
        key
      );

      setSaveState("idle");
    }

    void loadSavedPage();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    sessionId,
    textbookId,
    pageId,
    pageNumber,
    pageKey,
  ]);

  useEffect(() => {
    const channel =
      supabase.channel(
        `classroom-whiteboard-${sessionId}`,
        {
          config: {
            broadcast: {
              ack: true,
              self: false,
            },
          },
        }
      );

    channelRef.current =
      channel;

    channel
      .on(
        "broadcast",
        {
          event:
            "talkly-whiteboard-action",
        },
        ({ payload }) => {
          if (
            Number(
              payload?.sessionId
            ) !== sessionId
          ) {
            return;
          }

          if (
            payload?.senderId ===
            senderId
          ) {
            return;
          }

          const action =
            payload?.action as
              | WhiteboardAction
              | undefined;

          if (!action) {
            return;
          }

          applyAction(
            action,
            false
          );
        }
      )
      .on(
        "broadcast",
        {
          event:
            "talkly-whiteboard-sync-request",
        },
        ({ payload }) => {
          if (!isController) {
            return;
          }

          if (
            Number(
              payload?.sessionId
            ) !== sessionId
          ) {
            return;
          }

          const syncPayload: SyncPayload = {
            sessionId,
            senderId,
            pages:
              pagesRef.current,
            sentAt:
              Date.now(),
          };

          void channel.send({
            type: "broadcast",
            event:
              "talkly-whiteboard-sync-state",
            payload:
              syncPayload,
          });
        }
      )
      .on(
        "broadcast",
        {
          event:
            "talkly-whiteboard-sync-state",
        },
        ({ payload }) => {
          if (
            Number(
              payload?.sessionId
            ) !== sessionId
          ) {
            return;
          }

          if (
            payload?.senderId ===
            senderId
          ) {
            return;
          }

          if (
            payload?.pages &&
            typeof payload.pages ===
              "object"
          ) {
            setPages(
              (current) => {
                const incoming =
                  payload.pages as Record<
                    string,
                    Stroke[]
                  >;

                const next = {
                  ...incoming,
                  ...current,
                };

                pagesRef.current =
                  next;

                return next;
              }
            );
          }
        }
      )
      .subscribe((status) => {
        const ok =
          status ===
          "SUBSCRIBED";

        setConnected(ok);

        if (
          ok &&
          !isController
        ) {
          void channel.send({
            type: "broadcast",
            event:
              "talkly-whiteboard-sync-request",
            payload: {
              sessionId,
              senderId,
              requestedAt:
                Date.now(),
            },
          });
        }
      });

    return () => {
      channelRef.current =
        null;

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    supabase,
    sessionId,
    senderId,
    isController,
  ]);

  useEffect(() => {
    return () => {
      Object.values(
        saveTimersRef.current
      ).forEach((timer) => {
        window.clearTimeout(
          timer
        );
      });
    };
  }, []);

  function renderStroke(
    stroke: Stroke
  ) {
    if (
      stroke.kind === "line"
    ) {
      const a =
        stroke.points[0];

      const b =
        stroke.points[
          stroke.points.length -
            1
        ];

      return (
        <line
          key={stroke.id}
          x1={`${a.x}%`}
          y1={`${a.y}%`}
          x2={`${b.x}%`}
          y2={`${b.y}%`}
          stroke={stroke.color}
          strokeWidth={
            stroke.width
          }
          strokeOpacity={
            stroke.opacity
          }
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            pointerEvents: "none",
            cursor:
              tool ===
              "eraser"
                ? "crosshair"
                : "default",
          }}
          onPointerDown={(
            event
          ) => {
            if (
              tool !==
              "eraser"
            ) {
              return;
            }

            event.stopPropagation();

            removeStroke(
              stroke.id
            );
          }}
        />
      );
    }

    const d =
      stroke.points
        .map(
          (
            point,
            index
          ) =>
            `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
        )
        .join(" ");

    return (
      <path
        key={stroke.id}
        d={d}
        fill="none"
        stroke={stroke.color}
        strokeWidth={
          stroke.width
        }
        strokeOpacity={
          stroke.opacity
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: "none",
          cursor:
            tool ===
            "eraser"
              ? "crosshair"
              : "default",
        }}
        onPointerDown={(
          event
        ) => {
          if (
            tool !==
            "eraser"
          ) {
            return;
          }

          event.stopPropagation();

          removeStroke(
            stroke.id
          );
        }}
      />
    );
  }

  const saveLabel =
    saveState === "loading"
      ? "Loading"
      : saveState === "saving"
        ? "Saving"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save error"
            : "";

  const activeToolLabel =
    tool === "select"
      ? "Pointer"
      : tool === "pen"
        ? "Pen"
        : tool === "highlighter"
          ? "Highlight"
          : tool === "line"
            ? "Line"
            : "Eraser";

  return (
    <>
      <style jsx>{`
        .talkly-whiteboard-toolbar {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 60;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 8px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 14px;
          background: rgba(12, 14, 18, 0.94);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          max-width: calc(100% - 20px);
        }

        .talkly-whiteboard-status {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 8px 0 2px;
          min-width: 88px;
        }

        .talkly-whiteboard-status-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
          line-height: 1.05;
        }

        .talkly-whiteboard-status-title {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
        }

        .talkly-whiteboard-status-sub {
          margin-top: 3px;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.45);
          white-space: nowrap;
        }

        .talkly-whiteboard-divider {
          width: 1px;
          height: 30px;
          background: rgba(255, 255, 255, 0.10);
          flex: 0 0 auto;
        }

        .talkly-whiteboard-group {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        @media (max-width: 900px) {
          .talkly-whiteboard-toolbar {
            left: 8px;
            right: 8px;
            top: 8px;
            gap: 5px;
            padding: 6px 7px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .talkly-whiteboard-toolbar::-webkit-scrollbar {
            display: none;
          }

          .talkly-whiteboard-status {
            min-width: auto;
            padding-right: 4px;
          }

          .talkly-whiteboard-status-copy {
            display: none;
          }

          .talkly-whiteboard-divider {
            height: 28px;
          }
        }

        @media (max-width: 560px) {
          .talkly-whiteboard-toolbar {
            left: 6px;
            right: 6px;
            top: 6px;
            border-radius: 11px;
            padding: 5px 6px;
            gap: 4px;
          }

          .talkly-whiteboard-divider {
            display: none;
          }

          .talkly-whiteboard-toolbar button {
            min-width: 40px !important;
            width: 40px !important;
            height: 38px !important;
            padding: 0 !important;
            border-radius: 8px !important;
          }

          .talkly-whiteboard-toolbar button span:last-child {
            display: none !important;
          }

          .talkly-whiteboard-status {
            padding-right: 1px;
          }
        }
      `}</style>

      <div
        className="talkly-whiteboard-toolbar"
        aria-label="Whiteboard tools"
      >
        <div className="talkly-whiteboard-status">
          <span
            title={
              connected
                ? "Whiteboard connected"
                : "Whiteboard connecting"
            }
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background:
                connected
                  ? "#35d07f"
                  : "#8a8f98",
              boxShadow:
                connected
                  ? "0 0 0 4px rgba(53,208,127,0.10)"
                  : "none",
              flex: "0 0 auto",
            }}
          />

          <div className="talkly-whiteboard-status-copy">
            <span className="talkly-whiteboard-status-title">
              WHITEBOARD
            </span>
            <span className="talkly-whiteboard-status-sub">
              {saveLabel
                ? `${activeToolLabel} · ${saveLabel}`
                : activeToolLabel}
            </span>
          </div>
        </div>

        <div className="talkly-whiteboard-divider" />

        <div className="talkly-whiteboard-group">
          <ToolButton
            active={tool === "select"}
            onClick={() => setTool("select")}
            title="Pointer / 포인터"
            label="Pointer"
            icon="↖"
          />

          <ToolButton
            active={tool === "pen"}
            onClick={() => setTool("pen")}
            title="Pen / 펜"
            label="Pen"
            icon="✎"
          />

          <ToolButton
            active={tool === "highlighter"}
            onClick={() => setTool("highlighter")}
            title="Highlight / 형광펜"
            label="Highlight"
            icon="▰"
          />

          <ToolButton
            active={tool === "line"}
            onClick={() => setTool("line")}
            title="Line / 선"
            label="Line"
            icon="╱"
          />

          <ToolButton
            active={tool === "eraser"}
            onClick={() => setTool("eraser")}
            title="Eraser / 지우개"
            label="Eraser"
            icon="⌫"
          />
        </div>

        <div className="talkly-whiteboard-divider" />

        <div className="talkly-whiteboard-group">
          <ActionButton
            onClick={undoLast}
            title="Undo / 실행 취소"
            label="Undo"
            icon="↶"
          />

          <ActionButton
            onClick={clearPage}
            title="Clear page / 전체 지우기"
            label="Clear"
            icon="×"
            danger
          />
        </div>
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          finishDraft
        }
        onPointerCancel={
          finishDraft
        }
        style={{
          position:
            "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 20,
          touchAction:
            tool === "select"
              ? "auto"
              : "none",
          pointerEvents:
            tool === "select"
              ? "none"
              : "auto",
          cursor:
            tool === "eraser"
              ? "crosshair"
              : tool ===
                  "select"
                ? "default"
                : "crosshair",
        }}
      >
        {strokes.map(
          renderStroke
        )}

        {draft &&
          renderStroke(
            draft
          )}
      </svg>
    </>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        minWidth: 48,
        height: 38,
        padding: "0 8px",
        border:
          active
            ? "1px solid rgba(96,165,250,0.75)"
            : "1px solid rgba(255,255,255,0.12)",
        borderRadius: 9,
        background:
          active
            ? "linear-gradient(180deg, rgba(37,99,235,0.32), rgba(37,99,235,0.18))"
            : "rgba(255,255,255,0.035)",
        color: "#fff",
        cursor: "pointer",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        boxShadow:
          active
            ? "inset 0 0 0 1px rgba(147,197,253,0.08)"
            : "none",
        transition:
          "background 140ms ease, border-color 140ms ease, transform 140ms ease",
        flex: "0 0 auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 14,
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {icon}
      </span>

      <span
        style={{
          marginTop: 2,
          fontSize: 8,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: "0.01em",
          opacity: active ? 1 : 0.62,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function ActionButton({
  onClick,
  title,
  label,
  icon,
  danger = false,
}: {
  onClick: () => void;
  title: string;
  label: string;
  icon: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        minWidth: 44,
        height: 38,
        padding: "0 8px",
        border:
          danger
            ? "1px solid rgba(248,113,113,0.26)"
            : "1px solid rgba(255,255,255,0.12)",
        borderRadius: 9,
        background:
          danger
            ? "rgba(127,29,29,0.14)"
            : "rgba(255,255,255,0.035)",
        color:
          danger
            ? "#fecaca"
            : "#fff",
        cursor: "pointer",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        flex: "0 0 auto",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 14,
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {icon}
      </span>

      <span
        style={{
          marginTop: 2,
          fontSize: 8,
          lineHeight: 1,
          fontWeight: 800,
          opacity: 0.66,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}