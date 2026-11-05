"use client";

import { getClassroomText } from "@/lib/classroom-language";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  return <>
    <section className="talkly-material-controls" aria-label="Lesson materials">
      <div>{canControl ? <label>{ui("Lesson materials · 교재 방식")}<select aria-label="Lesson materials" value={mode} disabled={busy || sharing} onChange={event => void change(event.target.value as Mode)}>
        <option value="textbook">{ui("Registered textbook · 등록 교재")}</option><option value="screen">{ui("Screen share · 화면 공유")}</option>
      </select></label> : <strong>{expanded ? ui("Online material · 강사 화면 공유") : ui("Registered textbook · 등록 교재")}</strong>}</div>
      {expanded && <p role="status">{sharing ? ui("Screen sharing · 화면 공유 중") : canControl ? ui("Click Share Screen in Zoom, then select the textbook tab/window. · Zoom의 화면 공유 버튼을 눌러 교재 탭을 선택하세요.") : ui("Waiting for the teacher to share. · 강사의 화면 공유를 기다리고 있습니다.")}</p>}
      {canControl && expanded && <details><summary>{ui("Teaching with online materials · 온라인 교재 사용 안내")}</summary><p>Keep the original textbook tab/window beside this classroom. Operate the textbook there and watch the student here. Share the textbook in Zoom, not this classroom tab. For textbook sound, use Chrome: select Chrome Tab → textbook tab → check Share tab audio (window/entire screen may have no sound). Stop sharing before changing materials.<br />{ui("교재 창과 강의실 창을 좌우에 배치하세요. 교재는 원본 창에서 조작하고 학생은 강의실에서 확인합니다. 학생은 강의실만 열면 됩니다. 교재 소리는 Chrome 탭 → 교재 탭 → ‘탭 오디오 공유’를 체크해야 전달됩니다. 일반 창 공유에서 소리가 안 나면 공유를 중지하고 교재 탭으로 다시 공유하세요.")}</p></details>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{ui(error)}</p>}
    </section>
    <div className="talkly-classroom-stage" data-material-mode={expanded ? "screen" : "textbook"} data-presenter={canControl ? "true" : "false"}>{children}</div>
  </>;
}
