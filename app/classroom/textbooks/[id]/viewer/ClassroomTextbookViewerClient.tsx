"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

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
  textbookId: number;
  title: string;
  pages: ViewerPage[];
  viewerRole: string;
  viewerName: string;
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export default function ClassroomTextbookViewerClient({
  textbookId,
  title,
  pages,
  viewerRole,
  viewerName,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [playingHotspotId, setPlayingHotspotId] =
    useState<number | null>(null);
  const [audioMessage, setAudioMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const currentPage = pages[currentIndex];

  function stopAudio() {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setPlayingHotspotId(null);
    setAudioMessage("");
  }

  function moveToPage(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      pages.length - 1
    );

    stopAudio();
    setCurrentIndex(nextIndex);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
      });
    });
  }

  async function playHotspot(hotspot: AudioHotspot) {
    try {
      let audio = audioRef.current;

      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;

        audio.addEventListener("ended", () => {
          setPlayingHotspotId(null);
          setAudioMessage("");
        });
      }

      audio.pause();
      audio.src = hotspot.audioUrl;
      audio.currentTime = 0;

      setPlayingHotspotId(hotspot.id);
      setAudioMessage(`재생 중: ${hotspot.label}`);

      await audio.play();
    } catch {
      setPlayingHotspotId(null);
      setAudioMessage("오디오를 재생하지 못했습니다.");
    }
  }

  function zoomOut() {
    setZoom((value) =>
      Math.max(MIN_ZOOM, value - ZOOM_STEP)
    );
  }

  function zoomIn() {
    setZoom((value) =>
      Math.min(MAX_ZOOM, value + ZOOM_STEP)
    );
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
    thumbnailRefs.current[currentIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        moveToPage(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        moveToPage(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111318",
        color: "#fff",
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.12em",
                opacity: 0.5,
              }}
            >
              TALKLY TEXTBOOK
            </div>

            <h1
              style={{
                margin: "5px 0 0",
                fontSize: 22,
              }}
            >
              {title}
            </h1>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                opacity: 0.5,
              }}
            >
              교재 ID {textbookId}
              {viewerName ? ` · ${viewerName}` : ""}
              {viewerRole ? ` · ${viewerRole}` : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              style={toolbarButton}
            >
              −
            </button>

            <div
              style={{
                minWidth: 64,
                textAlign: "center",
                fontWeight: 800,
              }}
            >
              {zoom}%
            </div>

            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              style={toolbarButton}
            >
              +
            </button>

            <button
              type="button"
              onClick={fitToScreen}
              style={toolbarButton}
            >
              화면 맞춤
            </button>

            <select
              value={currentIndex}
              onChange={(event) =>
                moveToPage(Number(event.target.value))
              }
              style={{
                padding: "9px 10px",
                border:
                  "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                background: "#20232a",
                color: "#fff",
              }}
            >
              {pages.map((page, index) => (
                <option key={page.id} value={index}>
                  {page.pageNumber}페이지
                </option>
              ))}
            </select>
          </div>
        </header>

        {audioMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: "9px 12px",
              borderRadius: 9,
              background: "rgba(63,142,252,0.16)",
              border:
                "1px solid rgba(63,142,252,0.32)",
              fontSize: 13,
            }}
          >
            🎧 {audioMessage}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "150px minmax(0, 1fr)",
            borderRadius: 14,
            overflow: "hidden",
            background: "#1b1e24",
            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <aside
            style={{
              height: "calc(78vh + 62px)",
              background: "#15171c",
              borderRight:
                "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "12px 10px",
                fontSize: 12,
                fontWeight: 800,
                opacity: 0.72,
                borderBottom:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              페이지
            </div>

            <div
              style={{
                overflowY: "auto",
                padding: 9,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              {pages.map((page, index) => {
                const active = index === currentIndex;

                return (
                  <button
                    key={page.id}
                    ref={(element) => {
                      thumbnailRefs.current[index] = element;
                    }}
                    type="button"
                    onClick={() => moveToPage(index)}
                    style={{
                      width: "100%",
                      padding: 6,
                      border: active
                        ? "2px solid #4f9cff"
                        : "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 9,
                      background: active
                        ? "rgba(79,156,255,0.13)"
                        : "#20232a",
                      cursor: "pointer",
                      color: "#fff",
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 5,
                        overflow: "hidden",
                        aspectRatio: "0.72",
                      }}
                    >
                      <img
                        src={page.imageUrl}
                        alt={`${page.pageNumber}페이지`}
                        draggable={false}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {page.pageNumber}페이지
                      {page.hotspots.length > 0
                        ? ` · 🎧${page.hotspots.length}`
                        : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              ref={viewportRef}
              style={{
                height: "78vh",
                overflow: "auto",
                padding: 22,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  minWidth: "100%",
                  minHeight: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems:
                    zoom <= 100 ? "center" : "flex-start",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: `${zoom}%`,
                    maxWidth:
                      zoom <= 100 ? "100%" : "none",
                    flex: "0 0 auto",
                    background: "#fff",
                    boxShadow:
                      "0 12px 34px rgba(0,0,0,0.32)",
                  }}
                >
                  <img
                    src={currentPage.imageUrl}
                    alt={`${title} ${currentPage.pageNumber}페이지`}
                    draggable={false}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                      userSelect: "none",
                    }}
                  />

                  {currentPage.hotspots.map((hotspot) => {
                    const playing =
                      hotspot.id === playingHotspotId;

                    return (
                      <button
                        key={hotspot.id}
                        type="button"
                        onClick={() => playHotspot(hotspot)}
                        title={`${hotspot.label} 재생`}
                        style={{
                          position: "absolute",
                          left: `${hotspot.xPercent}%`,
                          top: `${hotspot.yPercent}%`,
                          width: `${hotspot.widthPercent}%`,
                          height: `${hotspot.heightPercent}%`,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          boxSizing: "border-box",
                          padding: 0,
                          zIndex: 4,
                        }}
                        aria-label={`${hotspot.label} 오디오 재생`}
                      >
                        <span
                          style={{
                            position: "absolute",
                            right: 4,
                            top: 4,
                            minWidth: 28,
                            height: 28,
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: playing
                              ? "#2684ff"
                              : "rgba(17,19,24,0.82)",
                            color: "#fff",
                            fontSize: 14,
                            boxShadow:
                              "0 2px 8px rgba(0,0,0,0.25)",
                            pointerEvents: "none",
                            transition:
                              "transform 120ms ease, background 120ms ease",
                            transform: playing
                              ? "scale(1.08)"
                              : "scale(1)",
                          }}
                        >
                          {playing ? "▶" : "🔊"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <footer
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                background: "#101217",
                borderTop:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={() =>
                    moveToPage(currentIndex - 1)
                  }
                  disabled={currentIndex === 0}
                  style={navButton}
                >
                  ← 이전 페이지
                </button>
              </div>

              <div
                style={{
                  fontWeight: 800,
                }}
              >
                {currentIndex + 1} / {pages.length}
              </div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    moveToPage(currentIndex + 1)
                  }
                  disabled={
                    currentIndex === pages.length - 1
                  }
                  style={navButton}
                >
                  다음 페이지 →
                </button>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

const toolbarButton: React.CSSProperties = {
  padding: "9px 12px",
  border:
    "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "#20232a",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const navButton: React.CSSProperties = {
  padding: "9px 13px",
  border:
    "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};