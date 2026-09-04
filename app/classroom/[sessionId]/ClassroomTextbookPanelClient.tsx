"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import ClassroomWhiteboardOverlay from "./ClassroomWhiteboardOverlay";

type AudioHotspot = {
  id: number;
  label: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  audioUrl: string;
};

type ViewerPage = {
  id: number;
  pageNumber: number;
  imageUrl: string;
  hotspots: AudioHotspot[];
};

type Props = {
  title: string;
  pages: ViewerPage[];
  textbookId: number;
  sessionId: number;
  viewerRole: string;
};

type PageMessage = {
  sessionId: number;
  pageIndex: number;
  pageNumber: number;
  senderId: string;
  sentAt: number;
};

const MIN_ZOOM = 60;
const MAX_ZOOM = 180;
const ZOOM_STEP = 10;
const HEARTBEAT_MS = 2500;

export default function ClassroomTextbookPanelClient({
  title,
  pages,
  textbookId,
  sessionId,
  viewerRole,
}: Props) {
  const isController =
    viewerRole === "teacher" ||
    viewerRole === "admin";

  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [zoom, setZoom] =
    useState(100);
  const [showThumbnails, setShowThumbnails] =
    useState(true);
  const [compactViewport, setCompactViewport] =
    useState(false);
  const [
    playingHotspotId,
    setPlayingHotspotId,
  ] = useState<number | null>(null);
  const [
    realtimeConnected,
    setRealtimeConnected,
  ] = useState(false);

  const [supabase] =
    useState(() => createClient());

  const senderId = useMemo(
    () =>
      `viewer-${Math.random()
        .toString(36)
        .slice(2)}-${Date.now()}`,
    []
  );

  const audioRef =
    useRef<HTMLAudioElement | null>(null);
  const viewportRef =
    useRef<HTMLDivElement | null>(null);
  const channelRef =
    useRef<RealtimeChannel | null>(null);
  const subscribedRef =
    useRef(false);
  const currentIndexRef =
    useRef(0);

  const currentPage =
    pages[currentIndex];

  function stopAudio() {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setPlayingHotspotId(null);
  }

  function applyPage(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      pages.length - 1
    );

    stopAudio();
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  }

  async function sendPageState(
    index: number,
    reason: string
  ) {
    if (
      !isController ||
      !subscribedRef.current ||
      !channelRef.current
    ) {
      return;
    }

    const nextIndex = Math.min(
      Math.max(index, 0),
      pages.length - 1
    );

    const page = pages[nextIndex];

    const payload: PageMessage = {
      sessionId,
      pageIndex: nextIndex,
      pageNumber:
        page?.pageNumber ??
        nextIndex + 1,
      senderId,
      sentAt: Date.now(),
    };

    const result =
      await channelRef.current.send({
        type: "broadcast",
        event: "talkly-page-state",
        payload,
      });

    console.log(
      "[TALKLY TEXTBOOK] sent",
      reason,
      payload,
      result
    );
  }

  function moveToPage(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      pages.length - 1
    );

    applyPage(nextIndex);

    if (isController) {
      void sendPageState(
        nextIndex,
        "page-change"
      );
    }
  }

  async function playHotspot(
    hotspot: AudioHotspot
  ) {
    try {
      let audio =
        audioRef.current;

      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;

        audio.addEventListener(
          "ended",
          () =>
            setPlayingHotspotId(null)
        );
      }

      audio.pause();
      audio.src = hotspot.audioUrl;
      audio.currentTime = 0;

      setPlayingHotspotId(
        hotspot.id
      );

      await audio.play();
    } catch {
      setPlayingHotspotId(null);
    }
  }

  function fitToScreen() {
    setZoom(100);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
      });
    });
  }

  useEffect(() => {
    currentIndexRef.current =
      currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    const channelName =
      `classroom-textbook-${sessionId}`;

    const channel =
      supabase.channel(
        channelName,
        {
          config: {
            broadcast: {
              ack: true,
              self: true,
            },
          },
        }
      );

    channelRef.current = channel;

    channel.on(
      "broadcast",
      {
        event:
          "talkly-page-state",
      },
      ({
        payload,
      }) => {
        const message =
          payload as Partial<PageMessage>;

        console.log(
          "[TALKLY TEXTBOOK] received",
          message
        );

        if (
          Number(
            message.sessionId
          ) !== sessionId
        ) {
          return;
        }

        if (
          message.senderId ===
          senderId
        ) {
          return;
        }

        if (isController) {
          return;
        }

        const nextIndex =
          Number(
            message.pageIndex
          );

        if (
          Number.isInteger(
            nextIndex
          ) &&
          nextIndex >= 0 &&
          nextIndex <
            pages.length
        ) {
          applyPage(
            nextIndex
          );
        }
      }
    );

    channel.subscribe(
      (status, error) => {
        console.log(
          "[TALKLY TEXTBOOK] status",
          viewerRole,
          status,
          error ?? ""
        );

        const connected =
          status ===
          "SUBSCRIBED";

        subscribedRef.current =
          connected;

        setRealtimeConnected(
          connected
        );

        if (
          connected &&
          isController
        ) {
          void sendPageState(
            currentIndexRef.current,
            "controller-connected"
          );
        }
      }
    );

    return () => {
      subscribedRef.current =
        false;

      if (
        channelRef.current ===
        channel
      ) {
        channelRef.current =
          null;
      }

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    supabase,
    sessionId,
    viewerRole,
    isController,
    senderId,
    pages.length,
  ]);

  useEffect(() => {
    if (
      !isController ||
      !realtimeConnected
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void sendPageState(
            currentIndexRef.current,
            "heartbeat"
          );
        },
        HEARTBEAT_MS
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    isController,
    realtimeConnected,
  ]);

  useEffect(() => {
    const media =
      window.matchMedia("(max-width: 900px)");

    function applyResponsiveState() {
      const compact = media.matches;

      setCompactViewport(compact);

      if (compact) {
        setShowThumbnails(false);
      }
    }

    applyResponsiveState();

    media.addEventListener(
      "change",
      applyResponsiveState
    );

    return () => {
      media.removeEventListener(
        "change",
        applyResponsiveState
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (!currentPage) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111318",
          color: "#fff",
        }}
      >
        표시할 교재 페이지가 없습니다.
      </div>
    );
  }

  return (
    <>
      <style>{`
        .talkly-textbook-shell {
          container-type: inline-size;
        }

        @media (max-width: 900px) {
          .talkly-textbook-shell {
            font-size: 12px;
          }
        }

        .talkly-textbook-header {
          flex: 0 0 auto;
        }

        .talkly-textbook-tools {
          min-width: 0;
        }

        .talkly-textbook-body {
          flex: 1 1 auto;
          min-height: 0;
        }

        .talkly-textbook-sidebar {
          min-height: 0;
        }

        .talkly-textbook-viewport {
          min-height: 0;
        }

        .talkly-textbook-footer {
          flex: 0 0 auto;
        }

        @media (max-width: 900px) {
          .talkly-textbook-header {
            min-height: 46px !important;
            padding: 7px 8px !important;
            gap: 6px !important;
            flex-wrap: nowrap !important;
            overflow: hidden;
          }

          .talkly-textbook-title {
            max-width: 145px !important;
            font-size: 12px !important;
          }

          .talkly-textbook-tools {
            flex: 1 1 auto;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            justify-content: flex-end;
            scrollbar-width: none;
          }

          .talkly-textbook-tools::-webkit-scrollbar {
            display: none;
          }

          .talkly-textbook-role {
            display: none !important;
          }

          .talkly-textbook-viewport {
            padding: 4px !important;
          }

          .talkly-textbook-footer {
            min-height: 44px !important;
            padding: 6px 8px !important;
          }

          .talkly-textbook-footer button {
            min-height: 34px !important;
            padding: 0 10px !important;
            font-size: 11px !important;
          }
        }

        @media (max-width: 600px) {
          .talkly-textbook-header {
            min-height: 42px !important;
            padding: 5px 6px !important;
          }

          .talkly-textbook-header-title-wrap {
            display: none !important;
          }

          .talkly-textbook-tools {
            width: 100%;
            justify-content: flex-start;
          }

          .talkly-textbook-tools button {
            min-height: 32px !important;
            padding: 0 9px !important;
            font-size: 10px !important;
          }

          .talkly-textbook-zoom-value {
            min-width: 40px !important;
            font-size: 11px !important;
          }

          .talkly-textbook-footer {
            min-height: 40px !important;
            padding: 4px 6px !important;
          }
        }
      `}</style>
    <div
      className="talkly-textbook-shell"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#111318",
        color: "#f7f7f8",
      }}
    >
      <div
        className="talkly-textbook-header"
        style={{
          minHeight: "56px",
          padding: "10px 12px",
          borderBottom:
            "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div
          className="talkly-textbook-header-title-wrap"
          style={{
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                opacity: 0.5,
                letterSpacing:
                  "0.08em",
              }}
            >
              TEXTBOOK
            </div>

            <span
              title={
                realtimeConnected
                  ? "교재 실시간 동기화 연결됨"
                  : "교재 실시간 동기화 연결 중"
              }
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background:
                  realtimeConnected
                    ? "#35d07f"
                    : "#8a8f98",
                display:
                  "inline-block",
              }}
            />
          </div>

          <div
            className="talkly-textbook-title"
            style={{
              marginTop: "3px",
              fontSize: "14px",
              fontWeight: 800,
              overflow: "hidden",
              textOverflow:
                "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "330px",
            }}
          >
            {title}
          </div>
        </div>

        <div
          className="talkly-textbook-tools"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              padding: "5px 8px",
              borderRadius: "999px",
              background:
                isController
                  ? "rgba(53,208,127,0.12)"
                  : "rgba(79,156,255,0.12)",
              border:
                isController
                  ? "1px solid rgba(53,208,127,0.24)"
                  : "1px solid rgba(79,156,255,0.22)",
              color:
                isController
                  ? "#8ce9b8"
                  : "#9bc5ff",
              fontSize: "10px",
              fontWeight: 800,
            }}
          
            className="talkly-textbook-role">
            {isController
              ? `TEACHER CONTROL · ${viewerRole}`
              : `FOLLOW TEACHER · ${viewerRole}`}
          </span>

          <button
            type="button"
            onClick={() =>
              setShowThumbnails(
                (value) =>
                  !value
              )
            }
            style={toolButton}
          >
            {compactViewport
              ? showThumbnails
                ? "Hide"
                : "Pages"
              : showThumbnails
                ? "Hide Pages"
                : "Pages"}
          </button>

          <button
            type="button"
            onClick={() =>
              setZoom((value) =>
                Math.max(
                  MIN_ZOOM,
                  value -
                    ZOOM_STEP
                )
              )
            }
            disabled={
              zoom <= MIN_ZOOM
            }
            style={toolButton}
          >
            −
          </button>

          <div
            className="talkly-textbook-zoom-value"
            style={{
              minWidth: "48px",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {zoom}%
          </div>

          <button
            type="button"
            onClick={() =>
              setZoom((value) =>
                Math.min(
                  MAX_ZOOM,
                  value +
                    ZOOM_STEP
                )
              )
            }
            disabled={
              zoom >= MAX_ZOOM
            }
            style={toolButton}
          >
            +
          </button>

          <button
            type="button"
            onClick={
              fitToScreen
            }
            style={toolButton}
          >
            Fit
          </button>
        </div>
      </div>

      <div
        className="talkly-textbook-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns:
            showThumbnails
              ? "92px minmax(0, 1fr)"
              : "minmax(0, 1fr)",
        }}
      >
        {showThumbnails && (
          <aside
            className="talkly-textbook-sidebar"
            style={{
              minHeight: 0,
              overflowY: "auto",
              borderRight:
                "1px solid rgba(255,255,255,0.08)",
              padding: "8px",
              background:
                "#0d0f13",
            }}
          >
            {pages.map(
              (
                page,
                index
              ) => {
                const active =
                  index ===
                  currentIndex;

                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() =>
                      moveToPage(
                        index
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "5px",
                      marginBottom:
                        "7px",
                      border: active
                        ? "2px solid #4f9cff"
                        : "1px solid rgba(255,255,255,0.12)",
                      borderRadius:
                        "7px",
                      background:
                        active
                          ? "rgba(79,156,255,0.14)"
                          : "#1c1e23",
                      color: "#fff",
                      cursor:
                        "pointer",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio:
                          "0.72",
                        background:
                          "#fff",
                        overflow:
                          "hidden",
                        borderRadius:
                          "4px",
                      }}
                    >
                      <img
                        src={
                          page.imageUrl
                        }
                        alt={`${page.pageNumber}페이지`}
                        loading="lazy"
                        draggable={
                          false
                        }
                        style={{
                          display:
                            "block",
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop:
                          "4px",
                        fontSize:
                          "10px",
                        fontWeight:
                          700,
                      }}
                    >
                      {
                        page.pageNumber
                      }
                      P
                      {page.hotspots
                        .length >
                      0
                        ? " 🎧"
                        : ""}
                    </div>
                  </button>
                );
              }
            )}
          </aside>
        )}

        <div
          ref={viewportRef}
          className="talkly-textbook-viewport"
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            padding: "12px",
            background:
              "#181b21",
          }}
        >
          <div
            style={{
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              justifyContent:
                "center",
              alignItems:
                "flex-start",
            }}
          >
            <div
              style={{
                position:
                  "relative",
                width: `${zoom}%`,
                maxWidth:
                  zoom <= 100
                    ? "100%"
                    : "none",
                flex: "0 0 auto",
                background:
                  "#fff",
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <img
                src={
                  currentPage.imageUrl
                }
                alt={`${title} ${currentPage.pageNumber}페이지`}
                draggable={false}
                style={{
                  display:
                    "block",
                  width:
                    "100%",
                  height: "auto",
                  userSelect:
                    "none",
                }}
              />

              {currentPage.hotspots.map(
                (
                  hotspot
                ) => {
                  const playing =
                    hotspot.id ===
                    playingHotspotId;

                  return (
                    <button
                      key={
                        hotspot.id
                      }
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        void playHotspot(hotspot);
                      }}
                      aria-label={`${hotspot.label} 재생`}
                      title={`${hotspot.label} 재생`}
                      style={{
                        position:
                          "absolute",
                        left: `${hotspot.xPercent}%`,
                        top: `${hotspot.yPercent}%`,
                        width: `${hotspot.widthPercent}%`,
                        height: `${hotspot.heightPercent}%`,
                        border:
                          "none",
                        background:
                          "transparent",
                        padding: 0,
                        cursor:
                          "pointer",
                        zIndex: 45,
                      }}
                    >
                      <span
                        style={{
                          position:
                            "absolute",
                          right: 3,
                          top: 3,
                          width: 26,
                          height: 26,
                          borderRadius:
                            999,
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          background:
                            playing
                              ? "#2684ff"
                              : "rgba(17,19,24,0.82)",
                          color:
                            "#fff",
                          fontSize: 13,
                          boxShadow:
                            "0 2px 7px rgba(0,0,0,0.25)",
                          pointerEvents:
                            "none",
                        }}
                      >
                        {playing
                          ? "▶"
                          : "🔊"}
                      </span>
                    </button>
                  );
                }
              )}

              <ClassroomWhiteboardOverlay
                sessionId={
                  sessionId
                }
                textbookId={
                  textbookId
                }
                pageId={
                  currentPage.id
                }
                pageNumber={
                  currentPage.pageNumber
                }
                viewerRole={
                  viewerRole
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="talkly-textbook-footer"
        style={{
          minHeight: "54px",
          padding: "9px 12px",
          borderTop:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#101115",
          display: "grid",
          gridTemplateColumns:
            "1fr auto 1fr",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() =>
              moveToPage(
                currentIndex - 1
              )
            }
            disabled={
              currentIndex === 0
            }
            style={navButton}
          >
            ← Prev
          </button>
        </div>

        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          {currentIndex + 1} /{" "}
          {pages.length}
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <button
            type="button"
            onClick={() =>
              moveToPage(
                currentIndex + 1
              )
            }
            disabled={
              currentIndex ===
              pages.length - 1
            }
            style={navButton}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

const toolButton:
  React.CSSProperties = {
  padding: "7px 9px",
  border:
    "1px solid rgba(255,255,255,0.15)",
  borderRadius: "7px",
  background: "#202228",
  color: "#fff",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 700,
};

const navButton:
  React.CSSProperties = {
  padding: "8px 10px",
  border:
    "1px solid rgba(255,255,255,0.16)",
  borderRadius: "7px",
  background:
    "transparent",
  color: "#fff",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 700,
};