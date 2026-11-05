"use client";
import { useEffect, useRef } from "react";

export default function ClassroomZoomFrame({ sessionId, testStudentMode }: { sessionId: number; testStudentMode: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const shareState = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "talkly-zoom-share-state" || event.data.sessionId !== sessionId || typeof event.data.active !== "boolean") return;
      window.dispatchEvent(new CustomEvent("talkly-zoom-share-state", { detail: { sessionId, active: event.data.active } }));
    };
    window.addEventListener("message", shareState);
    return () => window.removeEventListener("message", shareState);
  }, [sessionId]);
  const source = `/classroom/${sessionId}/zoom`;
  return <iframe ref={frame} className="talkly-zoom-frame" title="Zoom classroom · 영상 및 공유 교재"
    src={testStudentMode ? `${source}?testMode=student` : source}
    allow="camera; microphone; display-capture; autoplay; fullscreen" allowFullScreen />;
}
