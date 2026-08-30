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
    if (
      tool === "select" ||
      tool === "eraser"
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    const point =
      normalizePoint(event);

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
    if (
      !drawingRef.current ||
      !draft
    ) {
      return;
    }

    const point =
      normalizePoint(event);

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
            pointerEvents:
              tool ===
              "eraser"
                ? "stroke"
                : "none",
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
          pointerEvents:
            tool ===
            "eraser"
              ? "stroke"
              : "none",
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

  return (
    <>
      <div
        style={{
          position:
            "absolute",
          top: 8,
          right: 8,
          zIndex: 20,
          display: "flex",
          alignItems:
            "center",
          gap: 5,
          padding: "5px",
          borderRadius: 10,
          border:
            "1px solid rgba(255,255,255,0.18)",
          background:
            "rgba(14,15,18,0.92)",
          boxShadow:
            "0 4px 14px rgba(0,0,0,0.25)",
          backdropFilter:
            "blur(8px)",
        }}
      >
        <span
          title={
            connected
              ? "Whiteboard connected"
              : "Whiteboard connecting"
          }
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background:
              connected
                ? "#35d07f"
                : "#8a8f98",
            margin:
              "0 3px",
          }}
        />

        {saveLabel && (
          <span
            style={{
              marginRight:
                3,
              fontSize: 9,
              opacity:
                saveState ===
                "error"
                  ? 1
                  : 0.55,
              color:
                saveState ===
                "error"
                  ? "#fca5a5"
                  : "#ffffff",
              whiteSpace:
                "nowrap",
            }}
          >
            {saveLabel}
          </span>
        )}

        <ToolButton
          active={
            tool === "select"
          }
          onClick={() =>
            setTool("select")
          }
          title="Pointer / 포인터"
        >
          ↖
        </ToolButton>

        <ToolButton
          active={
            tool === "pen"
          }
          onClick={() =>
            setTool("pen")
          }
          title="Pen / 펜"
        >
          ✎
        </ToolButton>

        <ToolButton
          active={
            tool ===
            "highlighter"
          }
          onClick={() =>
            setTool(
              "highlighter"
            )
          }
          title="Highlighter / 형광펜"
        >
          ▰
        </ToolButton>

        <ToolButton
          active={
            tool === "line"
          }
          onClick={() =>
            setTool("line")
          }
          title="Line / 선"
        >
          ╱
        </ToolButton>

        <ToolButton
          active={
            tool === "eraser"
          }
          onClick={() =>
            setTool("eraser")
          }
          title="Eraser / 지우개"
        >
          ⌫
        </ToolButton>

        <ToolButton
          active={false}
          onClick={
            undoLast
          }
          title="Undo / 실행 취소"
        >
          ↶
        </ToolButton>

        <ToolButton
          active={false}
          onClick={
            clearPage
          }
          title="Clear page / 전체 지우기"
        >
          ×
        </ToolButton>
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
          zIndex: 10,
          touchAction:
            "none",
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        padding: 0,
        border:
          active
            ? "1px solid #4f9cff"
            : "1px solid rgba(255,255,255,0.14)",
        borderRadius: 7,
        background:
          active
            ? "rgba(79,156,255,0.22)"
            : "#202228",
        color: "#fff",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}