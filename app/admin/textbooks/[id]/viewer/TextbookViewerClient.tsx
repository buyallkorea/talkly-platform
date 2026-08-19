"use client";

import Link from "next/link";
import {
  PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase-browser";

type ViewerPage = {
  id: number;
  pageNumber: number;
  imageUrl: string;
};

type Props = {
  textbookId: number;
  title: string;
  status: string;
  pages: ViewerPage[];
};

type Hotspot = {
  id: number;
  page_id: number;
  type: string;
  label: string | null;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  audio_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type DraftRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
];

function getExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

export default function TextbookViewerClient({
  textbookId,
  title,
  status,
  pages,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(100);

  const [editMode, setEditMode] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] =
    useState<number | null>(null);
  const [loadingHotspots, setLoadingHotspots] =
    useState(false);

  const [draftRect, setDraftRect] =
    useState<DraftRect | null>(null);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingRect, setPendingRect] =
    useState<DraftRect | null>(null);
  const [hotspotLabel, setHotspotLabel] =
    useState("듣기");
  const [savingHotspot, setSavingHotspot] =
    useState(false);
  const [hotspotMessage, setHotspotMessage] =
    useState("");

  const [audioFile, setAudioFile] =
    useState<File | null>(null);
  const [audioUploading, setAudioUploading] =
    useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] =
    useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<
    Array<HTMLButtonElement | null>
  >([]);

  const currentPage = pages[currentIndex];

  const selectedHotspot =
    hotspots.find(
      (item) => item.id === selectedHotspotId
    ) ?? null;

  const moveToPage = (index: number) => {
    const nextIndex = Math.min(
      Math.max(index, 0),
      pages.length - 1
    );

    setCurrentIndex(nextIndex);
    setSelectedHotspotId(null);
    setDraftRect(null);
    setDragStart(null);
    setPendingRect(null);
    setHotspotMessage("");
    setAudioFile(null);
    setAudioPreviewUrl(null);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
      });
    });
  };

  const goPrevious = () => {
    moveToPage(currentIndex - 1);
  };

  const goNext = () => {
    moveToPage(currentIndex + 1);
  };

  const zoomOut = () => {
    setZoom((value) =>
      Math.max(MIN_ZOOM, value - ZOOM_STEP)
    );
  };

  const zoomIn = () => {
    setZoom((value) =>
      Math.min(MAX_ZOOM, value + ZOOM_STEP)
    );
  };

  const fitToScreen = () => {
    setZoom(100);

    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
      });
    });
  };

  async function loadHotspots() {
    if (!currentPage?.id) return;

    setLoadingHotspots(true);
    setHotspotMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("textbook_hotspots")
        .select(`
          id,
          page_id,
          type,
          label,
          x_percent,
          y_percent,
          width_percent,
          height_percent,
          audio_url,
          sort_order,
          is_active
        `)
        .eq("page_id", currentPage.id)
        .order("sort_order", {
          ascending: true,
        })
        .order("id", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      setHotspots(
        (data ?? []).map((item) => ({
          ...item,
          x_percent: Number(item.x_percent),
          y_percent: Number(item.y_percent),
          width_percent: Number(
            item.width_percent
          ),
          height_percent: Number(
            item.height_percent
          ),
        }))
      );
    } catch (error) {
      setHotspotMessage(
        error instanceof Error
          ? `핫스팟 조회 실패: ${error.message}`
          : "핫스팟 조회에 실패했습니다."
      );
    } finally {
      setLoadingHotspots(false);
    }
  }

  async function loadAudioPreview(
    audioPath: string | null
  ) {
    setAudioPreviewUrl(null);

    if (!audioPath) return;

    try {
      const supabase = createClient();

      const { data, error } =
        await supabase.storage
          .from("textbook-audio")
          .createSignedUrl(
            audioPath,
            60 * 30
          );

      if (error || !data?.signedUrl) {
        throw new Error(
          error?.message ||
            "오디오 미리보기 URL 생성 실패"
        );
      }

      setAudioPreviewUrl(
        data.signedUrl
      );
    } catch (error) {
      setHotspotMessage(
        error instanceof Error
          ? `오디오 불러오기 실패: ${error.message}`
          : "오디오를 불러오지 못했습니다."
      );
    }
  }

  useEffect(() => {
    loadHotspots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage.id]);

  useEffect(() => {
    const hotspot =
      hotspots.find(
        (item) =>
          item.id === selectedHotspotId
      ) ?? null;

    setAudioFile(null);
    loadAudioPreview(
      hotspot?.audio_url ?? null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHotspotId]);

  useEffect(() => {
    thumbnailRefs.current[
      currentIndex
    ]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.target instanceof
          HTMLInputElement ||
        event.target instanceof
          HTMLSelectElement ||
        event.target instanceof
          HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        moveToPage(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        moveToPage(currentIndex + 1);
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        (event.key === "+" ||
          event.key === "=")
      ) {
        event.preventDefault();
        zoomIn();
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key === "-"
      ) {
        event.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [currentIndex]);

  function pointToPercent(
    event: PointerEvent<HTMLDivElement>
  ) {
    const rect =
      overlayRef.current?.getBoundingClientRect();

    if (
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null;
    }

    const x = Math.min(
      100,
      Math.max(
        0,
        ((event.clientX - rect.left) /
          rect.width) *
          100
      )
    );

    const y = Math.min(
      100,
      Math.max(
        0,
        ((event.clientY - rect.top) /
          rect.height) *
          100
      )
    );

    return { x, y };
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (!editMode || pendingRect) return;

    const point =
      pointToPercent(event);

    if (!point) return;

    setSelectedHotspotId(null);

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    setDragStart(point);
    setDraftRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });

    setHotspotMessage("");
  }

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (
      !editMode ||
      !dragStart ||
      pendingRect
    ) {
      return;
    }

    const point =
      pointToPercent(event);

    if (!point) return;

    setDraftRect({
      x: Math.min(
        dragStart.x,
        point.x
      ),
      y: Math.min(
        dragStart.y,
        point.y
      ),
      width: Math.abs(
        point.x - dragStart.x
      ),
      height: Math.abs(
        point.y - dragStart.y
      ),
    });
  }

  function handlePointerUp(
    event: PointerEvent<HTMLDivElement>
  ) {
    if (
      !editMode ||
      !dragStart ||
      !draftRect ||
      pendingRect
    ) {
      return;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    setDragStart(null);

    if (
      draftRect.width < 1 ||
      draftRect.height < 1
    ) {
      setDraftRect(null);
      setHotspotMessage(
        "너무 작은 영역입니다. 조금 더 크게 드래그해주세요."
      );
      return;
    }

    setPendingRect(draftRect);
    setDraftRect(null);
    setHotspotLabel("듣기");
  }

  async function saveHotspot() {
    if (!pendingRect) return;

    setSavingHotspot(true);
    setHotspotMessage("");

    try {
      const supabase = createClient();

      const nextSortOrder =
        hotspots.length === 0
          ? 0
          : Math.max(
              ...hotspots.map(
                (item) =>
                  item.sort_order
              )
            ) + 1;

      const { data, error } =
        await supabase
          .from(
            "textbook_hotspots"
          )
          .insert({
            page_id:
              currentPage.id,
            type: "audio",
            label:
              hotspotLabel.trim() ||
              "듣기",
            x_percent:
              pendingRect.x,
            y_percent:
              pendingRect.y,
            width_percent:
              pendingRect.width,
            height_percent:
              pendingRect.height,
            audio_url: null,
            sort_order:
              nextSortOrder,
            is_active: true,
          })
          .select(`
            id,
            page_id,
            type,
            label,
            x_percent,
            y_percent,
            width_percent,
            height_percent,
            audio_url,
            sort_order,
            is_active
          `)
          .single();

      if (error) {
        throw new Error(
          error.message
        );
      }

      const savedHotspot: Hotspot = {
        ...data,
        x_percent: Number(
          data.x_percent
        ),
        y_percent: Number(
          data.y_percent
        ),
        width_percent: Number(
          data.width_percent
        ),
        height_percent: Number(
          data.height_percent
        ),
      };

      setHotspots((current) => [
        ...current,
        savedHotspot,
      ]);

      setSelectedHotspotId(
        savedHotspot.id
      );
      setPendingRect(null);

      setHotspotMessage(
        "핫스팟 영역이 저장되었습니다."
      );
    } catch (error) {
      setHotspotMessage(
        error instanceof Error
          ? `핫스팟 저장 실패: ${error.message}`
          : "핫스팟 저장에 실패했습니다."
      );
    } finally {
      setSavingHotspot(false);
    }
  }

  async function uploadAudio() {
    if (
      !selectedHotspot ||
      !audioFile
    ) {
      setHotspotMessage(
        "오디오 파일을 먼저 선택해주세요."
      );
      return;
    }

    const extension = getExtension(
      audioFile.name
    );

    if (
      !AUDIO_EXTENSIONS.includes(
        extension
      )
    ) {
      setHotspotMessage(
        "MP3, WAV, M4A, AAC, OGG 형식의 오디오 파일만 업로드할 수 있습니다."
      );
      return;
    }

    setAudioUploading(true);
    setHotspotMessage("");

    try {
      const supabase =
        createClient();

      const safeFilename =
        sanitizeFilename(
          audioFile.name
        );

      const storagePath =
        `textbooks/${textbookId}/pages/${currentPage.pageNumber}/hotspots/${selectedHotspot.id}/${crypto.randomUUID()}-${safeFilename}`;

      const { error: uploadError } =
        await supabase.storage
          .from("textbook-audio")
          .upload(
            storagePath,
            audioFile,
            {
              upsert: false,
              cacheControl: "3600",
              contentType:
                audioFile.type ||
                undefined,
            }
          );

      if (uploadError) {
        throw new Error(
          `오디오 업로드 실패: ${uploadError.message}`
        );
      }

      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from(
          "textbook_hotspots"
        )
        .update({
          audio_url:
            storagePath,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          selectedHotspot.id
        )
        .select(`
          id,
          page_id,
          type,
          label,
          x_percent,
          y_percent,
          width_percent,
          height_percent,
          audio_url,
          sort_order,
          is_active
        `)
        .single();

      if (updateError) {
        await supabase.storage
          .from("textbook-audio")
          .remove([
            storagePath,
          ]);

        throw new Error(
          `핫스팟 오디오 연결 실패: ${updateError.message}`
        );
      }

      const normalized: Hotspot = {
        ...updated,
        x_percent: Number(
          updated.x_percent
        ),
        y_percent: Number(
          updated.y_percent
        ),
        width_percent: Number(
          updated.width_percent
        ),
        height_percent: Number(
          updated.height_percent
        ),
      };

      setHotspots(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              normalized.id
                ? normalized
                : item
          )
      );

      setAudioFile(null);

      await loadAudioPreview(
        storagePath
      );

      const input =
        document.getElementById(
          "hotspotAudioFile"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      setHotspotMessage(
        "오디오 파일이 핫스팟에 연결되었습니다."
      );
    } catch (error) {
      setHotspotMessage(
        error instanceof Error
          ? error.message
          : "오디오 연결 중 오류가 발생했습니다."
      );
    } finally {
      setAudioUploading(false);
    }
  }

  function cancelPendingHotspot() {
    setPendingRect(null);
    setDraftRect(null);
    setDragStart(null);
    setHotspotMessage("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f5f7",
        padding: 24,
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
            justifyContent:
              "space-between",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <Link
              href="/admin/textbooks/new"
              style={{
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              ← 교재 관리
            </Link>

            <h1
              style={{
                margin: "14px 0 6px",
              }}
            >
              {title}
            </h1>

            <div
              style={{
                fontSize: 14,
                opacity: 0.65,
              }}
            >
              {status} ·{" "}
              {pages.length}페이지 ·
              교재 ID{" "}
              {textbookId}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setEditMode(
                  (value) => !value
                );
                setSelectedHotspotId(
                  null
                );
                cancelPendingHotspot();
              }}
              style={{
                ...buttonStyle,
                background: editMode
                  ? "#0f6fff"
                  : "#fff",
                color: editMode
                  ? "#fff"
                  : "#111",
                borderColor: editMode
                  ? "#0f6fff"
                  : "#ddd",
              }}
            >
              {editMode
                ? "핫스팟 편집 종료"
                : "핫스팟 편집"}
            </button>

            <button
              type="button"
              onClick={zoomOut}
              disabled={
                zoom <= MIN_ZOOM
              }
              style={buttonStyle}
            >
              − 축소
            </button>

            <div
              style={{
                minWidth: 70,
                padding:
                  "10px 12px",
                textAlign:
                  "center",
                background: "#fff",
                border:
                  "1px solid #ddd",
                borderRadius: 8,
                fontWeight: 800,
              }}
            >
              {zoom}%
            </div>

            <button
              type="button"
              onClick={zoomIn}
              disabled={
                zoom >= MAX_ZOOM
              }
              style={buttonStyle}
            >
              + 확대
            </button>

            <button
              type="button"
              onClick={
                fitToScreen
              }
              style={buttonStyle}
            >
              화면 맞춤
            </button>

            <select
              value={currentIndex}
              onChange={(event) =>
                moveToPage(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              style={{
                padding:
                  "10px 12px",
                border:
                  "1px solid #ddd",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              {pages.map(
                (
                  page,
                  index
                ) => (
                  <option
                    key={page.id}
                    value={index}
                  >
                    {
                      page.pageNumber
                    }
                    페이지
                  </option>
                )
              )}
            </select>
          </div>
        </header>

        {editMode && (
          <div
            style={{
              marginBottom: 14,
              padding:
                "12px 14px",
              borderRadius: 10,
              border:
                "1px solid #b8d4ff",
              background:
                "#edf5ff",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <strong>
              핫스팟 편집 모드
            </strong>{" "}
            — 교재에서 듣기
            영역을 마우스로
            드래그하세요.
          </div>
        )}

        {hotspotMessage && (
          <div
            style={{
              marginBottom: 14,
              padding:
                "12px 14px",
              borderRadius: 10,
              border:
                "1px solid #ddd",
              background: "#fff",
              fontSize: 14,
            }}
          >
            {hotspotMessage}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "170px minmax(0, 1fr)",
            background: "#1d1f23",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow:
              "0 18px 50px rgba(0,0,0,0.12)",
          }}
        >
          <aside
            style={{
              height:
                "calc(72vh + 64px)",
              background: "#15171a",
              borderRight:
                "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection:
                "column",
              minWidth: 0,
            }}
          >
            <div
              style={{
                padding:
                  "14px 14px 10px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                borderBottom:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              페이지
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 10,
                display: "flex",
                flexDirection:
                  "column",
                gap: 10,
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
                      ref={(
                        element
                      ) => {
                        thumbnailRefs.current[
                          index
                        ] = element;
                      }}
                      type="button"
                      onClick={() =>
                        moveToPage(
                          index
                        )
                      }
                      style={{
                        width:
                          "100%",
                        padding: 8,
                        border:
                          active
                            ? "2px solid #4ea1ff"
                            : "1px solid rgba(255,255,255,0.14)",
                        borderRadius: 10,
                        background:
                          active
                            ? "rgba(78,161,255,0.12)"
                            : "#202226",
                        cursor:
                          "pointer",
                        color:
                          "#fff",
                        textAlign:
                          "left",
                      }}
                    >
                      <div
                        style={{
                          background:
                            "#fff",
                          borderRadius: 6,
                          overflow:
                            "hidden",
                          aspectRatio:
                            "0.72",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                        }}
                      >
                        <img
                          src={
                            page.imageUrl
                          }
                          alt={`${page.pageNumber}페이지 썸네일`}
                          draggable={
                            false
                          }
                          loading="lazy"
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
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight:
                            active
                              ? 800
                              : 600,
                          textAlign:
                            "center",
                          opacity:
                            active
                              ? 1
                              : 0.75,
                        }}
                      >
                        {
                          page.pageNumber
                        }
                        페이지
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </aside>

          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection:
                "column",
            }}
          >
            <div
              ref={viewportRef}
              style={{
                height: "72vh",
                overflow: "auto",
                padding: 24,
                boxSizing:
                  "border-box",
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
                    zoom <= 100
                      ? "center"
                      : "flex-start",
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
                      "0 10px 30px rgba(0,0,0,0.28)",
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
                      width: "100%",
                      height: "auto",
                      userSelect:
                        "none",
                    }}
                  />

                  <div
                    ref={overlayRef}
                    onPointerDown={
                      handlePointerDown
                    }
                    onPointerMove={
                      handlePointerMove
                    }
                    onPointerUp={
                      handlePointerUp
                    }
                    style={{
                      position:
                        "absolute",
                      inset: 0,
                      cursor: editMode
                        ? "crosshair"
                        : "default",
                      pointerEvents:
                        editMode
                          ? "auto"
                          : "none",
                      touchAction:
                        "none",
                    }}
                  >
                    {editMode &&
                      hotspots.map(
                        (
                          hotspot
                        ) => {
                          const selected =
                            hotspot.id ===
                            selectedHotspotId;

                          return (
                            <button
                              key={
                                hotspot.id
                              }
                              type="button"
                              onPointerDown={(
                                event
                              ) => {
                                event.stopPropagation();
                              }}
                              onPointerUp={(
                                event
                              ) => {
                                event.stopPropagation();
                                setSelectedHotspotId(
                                  hotspot.id
                                );
                                setHotspotMessage(
                                  ""
                                );
                              }}
                              style={{
                                position:
                                  "absolute",
                                left: `${hotspot.x_percent}%`,
                                top: `${hotspot.y_percent}%`,
                                width: `${hotspot.width_percent}%`,
                                height: `${hotspot.height_percent}%`,
                                border:
                                  selected
                                    ? "3px solid #0f6fff"
                                    : "2px solid #00a36c",
                                background:
                                  selected
                                    ? "rgba(15,111,255,0.22)"
                                    : "rgba(0,163,108,0.18)",
                                boxSizing:
                                  "border-box",
                                cursor:
                                  "pointer",
                                padding: 0,
                                zIndex:
                                  selected
                                    ? 5
                                    : 3,
                              }}
                            >
                              <span
                                style={{
                                  position:
                                    "absolute",
                                  left: 0,
                                  top: 0,
                                  transform:
                                    "translateY(-100%)",
                                  maxWidth: 180,
                                  padding:
                                    "4px 7px",
                                  borderRadius:
                                    "6px 6px 0 0",
                                  background:
                                    selected
                                      ? "#0f6fff"
                                      : "#00a36c",
                                  color:
                                    "#fff",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  whiteSpace:
                                    "nowrap",
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  pointerEvents:
                                    "none",
                                }}
                              >
                                {hotspot.audio_url
                                  ? "🎧 "
                                  : ""}
                                {hotspot.label ||
                                  `핫스팟 #${hotspot.id}`}
                              </span>
                            </button>
                          );
                        }
                      )}

                    {draftRect && (
                      <div
                        style={{
                          position:
                            "absolute",
                          left: `${draftRect.x}%`,
                          top: `${draftRect.y}%`,
                          width: `${draftRect.width}%`,
                          height: `${draftRect.height}%`,
                          border:
                            "2px dashed #ff9d00",
                          background:
                            "rgba(255,157,0,0.18)",
                          boxSizing:
                            "border-box",
                          pointerEvents:
                            "none",
                        }}
                      />
                    )}

                    {pendingRect && (
                      <div
                        style={{
                          position:
                            "absolute",
                          left: `${pendingRect.x}%`,
                          top: `${pendingRect.y}%`,
                          width: `${pendingRect.width}%`,
                          height: `${pendingRect.height}%`,
                          border:
                            "3px solid #0f6fff",
                          background:
                            "rgba(15,111,255,0.18)",
                          boxSizing:
                            "border-box",
                          pointerEvents:
                            "none",
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <footer
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr auto 1fr",
                alignItems:
                  "center",
                gap: 16,
                padding:
                  "16px 20px",
                background: "#111317",
                color: "#fff",
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={
                    goPrevious
                  }
                  disabled={
                    currentIndex ===
                    0
                  }
                  style={
                    darkButtonStyle
                  }
                >
                  ← 이전 페이지
                </button>
              </div>

              <div
                style={{
                  fontWeight: 800,
                  textAlign:
                    "center",
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
                  onClick={goNext}
                  disabled={
                    currentIndex ===
                    pages.length - 1
                  }
                  style={
                    darkButtonStyle
                  }
                >
                  다음 페이지 →
                </button>
              </div>
            </footer>
          </div>
        </section>

        {pendingRect && (
          <section
            style={{
              marginTop: 16,
              padding: 18,
              border:
                "1px solid #c8d9f5",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: 18,
              }}
            >
              새 핫스팟 저장
            </h2>

            <p
              style={{
                marginTop: 0,
                fontSize: 13,
                opacity: 0.65,
              }}
            >
              {currentPage.pageNumber}
              페이지 · X{" "}
              {pendingRect.x.toFixed(
                2
              )}
              % · Y{" "}
              {pendingRect.y.toFixed(
                2
              )}
              % · W{" "}
              {pendingRect.width.toFixed(
                2
              )}
              % · H{" "}
              {pendingRect.height.toFixed(
                2
              )}
              %
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                value={
                  hotspotLabel
                }
                onChange={(
                  event
                ) =>
                  setHotspotLabel(
                    event.target
                      .value
                  )
                }
                placeholder="예: Listen 1"
                style={{
                  minWidth: 240,
                  padding:
                    "11px 12px",
                  border:
                    "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />

              <button
                type="button"
                onClick={
                  saveHotspot
                }
                disabled={
                  savingHotspot
                }
                style={{
                  ...buttonStyle,
                  background:
                    "#0f6fff",
                  color: "#fff",
                  borderColor:
                    "#0f6fff",
                }}
              >
                {savingHotspot
                  ? "저장 중..."
                  : "영역 저장"}
              </button>

              <button
                type="button"
                onClick={
                  cancelPendingHotspot
                }
                disabled={
                  savingHotspot
                }
                style={buttonStyle}
              >
                취소
              </button>
            </div>
          </section>
        )}

        {editMode &&
          !pendingRect && (
            <section
              style={{
                marginTop: 16,
                padding: 18,
                border:
                  "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  alignItems:
                    "center",
                  flexWrap: "wrap",
                }}
              >
                <strong>
                  현재 페이지 핫스팟:{" "}
                  {loadingHotspots
                    ? "불러오는 중..."
                    : `${hotspots.length}개`}
                </strong>

                <span
                  style={{
                    fontSize: 13,
                    opacity: 0.6,
                  }}
                >
                  초록색 = 저장됨 ·
                  파란색 = 선택됨
                </span>
              </div>

              {selectedHotspot ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 10,
                    border:
                      "1px solid #b8d4ff",
                    background:
                      "#f5f9ff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    선택된 핫스팟:{" "}
                    {selectedHotspot.label ||
                      `#${selectedHotspot.id}`}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 8,
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      X:{" "}
                      {selectedHotspot.x_percent.toFixed(
                        3
                      )}
                      %
                    </div>
                    <div>
                      Y:{" "}
                      {selectedHotspot.y_percent.toFixed(
                        3
                      )}
                      %
                    </div>
                    <div>
                      W:{" "}
                      {selectedHotspot.width_percent.toFixed(
                        3
                      )}
                      %
                    </div>
                    <div>
                      H:{" "}
                      {selectedHotspot.height_percent.toFixed(
                        3
                      )}
                      %
                    </div>
                    <div>
                      오디오:{" "}
                      {selectedHotspot.audio_url
                        ? "연결됨"
                        : "미연결"}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop:
                        "1px solid #d8e6fa",
                      paddingTop: 14,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        marginBottom: 8,
                      }}
                    >
                      오디오 파일 연결
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems:
                          "center",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <input
                        id="hotspotAudioFile"
                        type="file"
                        accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*"
                        disabled={
                          audioUploading
                        }
                        onChange={(
                          event
                        ) =>
                          setAudioFile(
                            event
                              .target
                              .files?.[0] ??
                              null
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={
                          uploadAudio
                        }
                        disabled={
                          audioUploading ||
                          !audioFile
                        }
                        style={{
                          ...buttonStyle,
                          background:
                            "#0f6fff",
                          color:
                            "#fff",
                          borderColor:
                            "#0f6fff",
                          opacity:
                            audioUploading ||
                            !audioFile
                              ? 0.55
                              : 1,
                        }}
                      >
                        {audioUploading
                          ? "업로드 중..."
                          : "오디오 업로드"}
                      </button>
                    </div>

                    {audioFile && (
                      <p
                        style={{
                          marginTop: 8,
                          marginBottom: 0,
                          fontSize: 13,
                          opacity: 0.7,
                        }}
                      >
                        선택 파일:{" "}
                        <strong>
                          {
                            audioFile.name
                          }
                        </strong>
                      </p>
                    )}

                    {audioPreviewUrl && (
                      <div
                        style={{
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            marginBottom: 6,
                          }}
                        >
                          연결된 오디오 미리듣기
                        </div>

                        <audio
                          controls
                          src={
                            audioPreviewUrl
                          }
                          style={{
                            width:
                              "100%",
                            maxWidth: 520,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : hotspots.length >
                0 ? (
                <p
                  style={{
                    marginBottom: 0,
                    fontSize: 13,
                    opacity: 0.65,
                  }}
                >
                  교재 위의 초록색
                  영역을 클릭하면
                  오디오를 연결할 수
                  있습니다.
                </p>
              ) : (
                <p
                  style={{
                    marginBottom: 0,
                    fontSize: 13,
                    opacity: 0.65,
                  }}
                >
                  아직 이 페이지에
                  저장된 핫스팟이
                  없습니다.
                </p>
              )}
            </section>
          )}
      </div>
    </main>
  );
}

const buttonStyle:
  React.CSSProperties = {
  padding: "10px 13px",
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const darkButtonStyle:
  React.CSSProperties = {
  padding: "10px 14px",
  border:
    "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  color: "#fff",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 700,
};