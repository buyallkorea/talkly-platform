"use client";

import { getClassroomText } from "@/lib/classroom-language";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";

type Mode = "textbook" | "screen";
export default function ClassroomMaterialStage({ sessionId, initialMode, canControl, children }: {
  sessionId: number; initialMode: Mode; canControl: boolean; children: ReactNode;
}) {
  const ui = getClassroomText(canControl);

  const [mode, setMode] = useState(initialMode);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [paneWidths, setPaneWidths] = useState<[number, number, number]>([22, 58, 20]);
  const [sharedVideoWidth, setSharedVideoWidth] = useState(80);
  const [sharedCameraWidth, setSharedCameraWidth] = useState(22);
  const dragging = useRef<"video" | "chat" | "shared" | "camera" | null>(null);
  const storageKey = "talkly-classroom-layout-v1";
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1051px) and (pointer: fine)");
    const check = () => setDesktop(media.matches);
    check();
    media.addEventListener("change", check);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(stored?.panes) && stored.panes.length === 3 &&
        stored.panes.every((v: unknown) => typeof v === "number" && Number.isFinite(v)) &&
        Math.abs(stored.panes.reduce((a: number, b: number) => a + b, 0) - 100) < 0.1 &&
        stored.panes.every((value: number) => value >= 10)) {
        setPaneWidths(stored.panes as [number, number, number]);
      }
      if (typeof stored?.shared === "number" && stored.shared >= 20 && stored.shared <= 90) {
        setSharedVideoWidth(stored.shared);
      }
      if (typeof stored?.camera === "number" && stored.camera >= 10 && stored.camera <= 80) {
        setSharedCameraWidth(stored.camera);
      }
    } catch { /* Storage may be blocked. Defaults remain usable. */ }
    return () => media.removeEventListener("change", check);
  }, []);
  const saveLayout = (panes: [number, number, number], shared: number, camera: number) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ panes, shared, camera })); } catch { /* optional preference */ }
  };
  const dragTo = (kind: "video" | "chat" | "shared" | "camera", clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const at = (clientX - rect.left) / rect.width * 100;
    const constrain = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    if (kind === "camera") {
      const next = constrain(at, 10, sharedVideoWidth - 10);
      setSharedCameraWidth(next);
      saveLayout(paneWidths, sharedVideoWidth, next);
    } else if (kind === "shared") {
      const next = constrain(at, Math.max(20, sharedCameraWidth + 10), 90);
      setSharedVideoWidth(next);
      saveLayout(paneWidths, next, sharedCameraWidth);
    } else {
      const [video, , chat] = paneWidths;
      const next: [number, number, number] = kind === "video"
        ? [constrain(at, 10, 100 - chat - 10), 0, chat]
        : [video, 0, constrain(100 - at, 10, 100 - video - 10)];
      next[1] = 100 - next[0] - next[2];
      setPaneWidths(next);
      saveLayout(next, sharedVideoWidth, sharedCameraWidth);
    }
  };
  const handleDown = (kind: "video" | "chat" | "shared" | "camera") => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = kind;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) dragTo(dragging.current, event.clientX);
  };
  const handleUp = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleKey = (kind: "video" | "chat" | "shared" | "camera") => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const at = kind === "camera" ? sharedCameraWidth : kind === "shared" ? sharedVideoWidth : kind === "video" ? paneWidths[0] : 100 - paneWidths[2];
    dragTo(kind, rect.left + rect.width * (at + (event.key === "ArrowRight" ? 2 : -2)) / 100);
  };
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const invalidate = useCallback(() => { sequence.current += 1; }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (busyRef.current) return;
    const version = ++sequence.current;
    try {
      const response = await fetch(`/api/classroom/material-mode?sessionId=${sessionId}`, { cache: "no-store", signal });
      const data = await response.json();
      if (mounted.current && !busyRef.current && version === sequence.current && response.ok && (data.mode === "screen" || data.mode === "textbook")) setMode(data.mode);
    } catch { /* Keep the last confirmed mode; reconnect/fallback will recheck. */ }
  }, [sessionId]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const supabase = createClient();
    const channel = supabase.channel(`classroom-material-mode-${sessionId}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${sessionId}`,
    }, () => void refresh(controller.signal)).subscribe();
    const initialTimer = window.setTimeout(() => void refresh(controller.signal), 0);
    const recheck = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    const timer = window.setInterval(recheck, 15000);
    const shareChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: number; active: boolean }>).detail;
      if (detail?.sessionId === sessionId && typeof detail.active === "boolean") setSharing(detail.active);
    };
    window.addEventListener("talkly-zoom-share-state", shareChanged);
    window.addEventListener("online", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => { mounted.current = false; invalidate(); controller.abort(); window.clearTimeout(initialTimer); window.clearInterval(timer); window.removeEventListener("talkly-zoom-share-state", shareChanged); window.removeEventListener("online", recheck); document.removeEventListener("visibilitychange", recheck); void supabase.removeChannel(channel); };
  }, [sessionId, refresh, invalidate]);
  async function change(next: Mode) {
    if (!canControl || busyRef.current || sharing || next === mode) return;
    busyRef.current = true; sequence.current++; setBusy(true); setError("");
    try {
      const response = await fetch("/api/classroom/material-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, mode: next }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not change material mode.");
      if (mounted.current) setMode(data.mode);
    } catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : "Could not change mode."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  const expanded = mode === "screen" || sharing;
  // Zoom SDK owns video + screen-share nodes inside its iframe. Propagate
  // the camera column size without remounting/moving media elements.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !expanded) return;
    const update = () => {
      const width = stage.getBoundingClientRect().width;
      const frame = stage.querySelector<HTMLIFrameElement>(".talkly-zoom-frame");
      frame?.contentWindow?.postMessage({
        type: "talkly-zoom-camera-width",
        sessionId,
        pixels: Math.max(0, Math.floor(width * sharedCameraWidth / 100)),
      }, window.location.origin);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    const frame = stage.querySelector<HTMLIFrameElement>(".talkly-zoom-frame");
    frame?.addEventListener("load", update);
    return () => { observer.disconnect(); frame?.removeEventListener("load", update); };
  }, [expanded, sharedCameraWidth, sessionId, desktop]);
  return <>
    <section className="talkly-material-controls" aria-label="Lesson materials">
      <div>{canControl ? <label>{ui("Lesson materials · 교재 방식")}<select aria-label="Lesson materials" value={mode} disabled={busy || sharing} onChange={event => void change(event.target.value as Mode)}>
        <option value="textbook">{ui("Registered textbook · 등록 교재")}</option><option value="screen">{ui("Screen share · 화면 공유")}</option>
      </select></label> : <strong>{expanded ? ui("Online material · 강사 화면 공유") : ui("Registered textbook · 등록 교재")}</strong>}</div>
      {expanded && <details className="talkly-material-share-help"><summary>{sharing ? ui("Screen sharing · 화면 공유 중") : canControl ? "Screen share help" : "화면 공유 안내"}</summary><p role="status">{sharing ? ui("Screen sharing · 화면 공유 중") : canControl ? ui("Click Share Screen in Zoom, then select the textbook tab/window. · Zoom의 화면 공유 버튼을 눌러 교재 탭을 선택하세요.") : ui("Waiting for the teacher to share. · 강사의 화면 공유를 기다리고 있습니다.")}</p></details>}
      {canControl && expanded && <details><summary>{ui("Teaching with online materials · 온라인 교재 사용 안내")}</summary><p>Keep the original textbook tab/window beside this classroom. Operate the textbook there and watch the student here. Share the textbook in Zoom, not this classroom tab. For textbook sound, use Chrome: select Chrome Tab → textbook tab → check Share tab audio (window/entire screen may have no sound). Stop sharing before changing materials.<br />{ui("교재 창과 강의실 창을 좌우에 배치하세요. 교재는 원본 창에서 조작하고 학생은 강의실에서 확인합니다. 학생은 강의실만 열면 됩니다. 교재 소리는 Chrome 탭 → 교재 탭 → ‘탭 오디오 공유’를 체크해야 전달됩니다. 일반 창 공유에서 소리가 안 나면 공유를 중지하고 교재 탭으로 다시 공유하세요.")}</p></details>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{ui(error)}</p>}
    </section>
    <div ref={stageRef} className="talkly-classroom-stage" data-material-mode={expanded ? "screen" : "textbook"} data-presenter={canControl ? "true" : "false"}
      style={desktop ? ({ gridTemplateColumns: expanded
        ? `minmax(0, ${sharedVideoWidth / 2}fr) minmax(0, ${sharedVideoWidth / 2}fr) minmax(0, ${100 - sharedVideoWidth}fr)`
        : `minmax(0, ${paneWidths[0]}fr) minmax(0, ${paneWidths[1]}fr) minmax(0, ${paneWidths[2]}fr)` } as CSSProperties) : undefined}>
      {children}
      {desktop && <button type="button" className="talkly-pane-reset" title={canControl ? "Restore default panel sizes" : "기본 화면 비율 복원"}
        onClick={() => {
          const panes: [number, number, number] = [22, 58, 20];
          setPaneWidths(panes);
          setSharedVideoWidth(80);
          setSharedCameraWidth(22);
          saveLayout(panes, 80, 22);
        }}>{canControl ? "Reset layout" : "비율 초기화"}</button>}
      {desktop && (expanded ? <>
        <div className="talkly-pane-resizer" role="separator" aria-label={canControl ? "Resize Zoom video and shared teaching materials" : "Zoom 영상과 공유 교재 영역 너비 조절"}
          aria-orientation="vertical" aria-valuenow={Math.round(sharedCameraWidth)} aria-valuemin={10} aria-valuemax={Math.round(sharedVideoWidth - 10)}
          tabIndex={0} style={{ left: `${sharedCameraWidth}%` }}
          onPointerDown={handleDown("camera")} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onKeyDown={handleKey("camera")} />
        <div className="talkly-pane-resizer" data-kind="shared" role="separator" aria-label={canControl ? "Resize shared teaching materials and chat panels" : "공유 교재와 채팅 영역 너비 조절"}
          aria-orientation="vertical" aria-valuenow={Math.round(sharedVideoWidth)} aria-valuemin={20} aria-valuemax={90}
          tabIndex={0} style={{ left: `${sharedVideoWidth}%` }}
          onPointerDown={handleDown("shared")} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onKeyDown={handleKey("shared")} />
      </> : <>
        <div className="talkly-pane-resizer" role="separator" aria-label={canControl ? "Resize video and textbook panels" : "Zoom과 교재 영역 너비 조절"}
          aria-orientation="vertical" aria-valuenow={Math.round(paneWidths[0])} aria-valuemin={10} aria-valuemax={80}
          tabIndex={0} style={{ left: `${paneWidths[0]}%` }}
          onPointerDown={handleDown("video")} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onKeyDown={handleKey("video")} />
        <div className="talkly-pane-resizer" role="separator" aria-label={canControl ? "Resize textbook and chat panels" : "교재와 채팅 영역 너비 조절"}
          aria-orientation="vertical" aria-valuenow={Math.round(100 - paneWidths[2])} aria-valuemin={20} aria-valuemax={90}
          tabIndex={0} style={{ left: `${100 - paneWidths[2]}%` }}
          onPointerDown={handleDown("chat")} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onKeyDown={handleKey("chat")} />
      </>)}
    </div>
  </>;
}
