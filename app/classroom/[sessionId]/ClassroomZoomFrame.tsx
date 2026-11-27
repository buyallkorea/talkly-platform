"use client";
import { useEffect, useRef, useState } from "react";

export default function ClassroomZoomFrame({ sessionId, testStudentMode }: { sessionId: number; testStudentMode: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [meetingPrepared, setMeetingPrepared] = useState(!testStudentMode);
  useEffect(() => {
    if (!testStudentMode) { setMeetingPrepared(true); return; }
    // Admin test student: transparently upgrade meetings created by the
    // previous configuration before the native Zoom SDK attempts to join.
    // The server checks role/session/meeting ownership and verifies Zoom API.
    const controller = new AbortController();
    void fetch("/api/admin/test-classroom/prepare-zoom", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) console.warn("[TALKLY] Zoom early-join configuration unavailable", response.status);
    }).catch(error => {
      if (!controller.signal.aborted) console.warn("[TALKLY] Zoom early-join configuration unavailable", error);
    }).finally(() => {
      if (!controller.signal.aborted) setMeetingPrepared(true);
    });
    return () => controller.abort();
  }, [sessionId, testStudentMode]);

  useEffect(() => {
    const configure = () => {
      const stage = frame.current?.closest(".talkly-classroom-stage");
      frame.current?.contentWindow?.postMessage({ type: "talkly-zoom-layout", sessionId, split: stage?.getAttribute("data-material-mode") === "screen" && stage?.getAttribute("data-sharing") === "true" && stage?.getAttribute("data-presenter") !== "true" }, window.location.origin);
      const cameraPercent = Number(stage?.getAttribute("data-camera-percent"));
      if (stage && Number.isFinite(cameraPercent) && cameraPercent >= 10) {
        frame.current?.contentWindow?.postMessage({
          type: "talkly-zoom-camera-width",
          sessionId,
          pixels: Math.round(stage.getBoundingClientRect().width * cameraPercent / 100),
        }, window.location.origin);
      }
    };
    const stage = frame.current?.closest(".talkly-classroom-stage");
    const observer = new MutationObserver(configure);
    if (stage) observer.observe(stage, { attributes: true, attributeFilter: ["data-material-mode", "data-presenter", "data-sharing", "data-camera-percent"] });
    frame.current?.addEventListener("load", configure);
    const currentFrame = frame.current;
    const shareState = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === "talkly-zoom-ready" && event.data.sessionId === sessionId) { configure(); return; }
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "talkly-zoom-share-state" || event.data.sessionId !== sessionId || typeof event.data.active !== "boolean") return;
      window.dispatchEvent(new CustomEvent("talkly-zoom-share-state", { detail: { sessionId, active: event.data.active } }));
    };
    window.addEventListener("message", shareState);
    return () => { observer.disconnect(); currentFrame?.removeEventListener("load", configure); window.removeEventListener("message", shareState); };
  }, [sessionId]);
  const source = `/classroom/${sessionId}/zoom`;
  if (!meetingPrepared) return <div role="status" style={{padding:12,color:"#cbd5e1"}}>Zoom 자동 연결 준비 중…</div>;
  return <iframe ref={frame} className="talkly-zoom-frame" title="Zoom classroom"
    src={testStudentMode ? `${source}?testMode=student` : source}
    allow="camera; microphone; display-capture; autoplay; fullscreen" allowFullScreen />;
}
