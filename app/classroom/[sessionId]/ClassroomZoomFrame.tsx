"use client";
import { useEffect, useRef } from "react";

export default function ClassroomZoomFrame({ sessionId, testStudentMode }: { sessionId: number; testStudentMode: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const configure = () => {
      const stage = frame.current?.closest(".talkly-classroom-stage");
      frame.current?.contentWindow?.postMessage({ type: "talkly-zoom-layout", sessionId, split: stage?.getAttribute("data-material-mode") === "screen" && stage?.getAttribute("data-presenter") !== "true" }, window.location.origin);
    };
    const stage = frame.current?.closest(".talkly-classroom-stage");
    const observer = new MutationObserver(configure);
    if (stage) observer.observe(stage, { attributes: true, attributeFilter: ["data-material-mode", "data-presenter"] });
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
  return <iframe ref={frame} className="talkly-zoom-frame" title="Zoom classroom"
    src={testStudentMode ? `${source}?testMode=student` : source}
    allow="camera; microphone; display-capture; autoplay; fullscreen" allowFullScreen />;
}
