"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type View = "checking" | "embedded" | "mobile" | "external";

export function safeZoomMeetingUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" ||
        !(host === "zoom.us" || host.endsWith(".zoom.us")) ||
        !/^\/j\/\d+(?:\/|$)/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function ClassroomResponsiveZoom({
  meetingUrl,
  hostMode,
  children,
}: {
  meetingUrl: string | null;
  hostMode: boolean;
  children: ReactNode;
}) {
  const [view, setView] = useState<View>("checking");
  const [zoomFailed, setZoomFailed] = useState(false);
  const iframeWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin ||
          event.data?.type !== "talkly-zoom-connection-state" ||
          typeof event.data.failed !== "boolean") return;
      const frame = iframeWrapperRef.current?.querySelector<HTMLIFrameElement>("iframe.talkly-zoom-frame");
      if (!frame || event.source !== frame.contentWindow) return;
      setZoomFailed(event.data.failed);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  const safeJoinUrl = useMemo(() => safeZoomMeetingUrl(meetingUrl), [meetingUrl]);

  useEffect(() => {
    const ua = navigator.userAgent ?? "";
    const handheld = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) ||
      (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
    setView(handheld ? "mobile" : "embedded");
  }, []);

  if (view === "checking") {
    return <div className="talkly-mobile-zoom-access" role="status">{hostMode ? "Preparing video connection…" : "화상수업 연결 준비 중…"}</div>;
  }
  if (view === "embedded") {
    return (
      <div className="talkly-zoom-desktop">
        {safeJoinUrl && zoomFailed && (
          <details className="talkly-zoom-app-fallback" open>
            <summary>{hostMode ? "Audio trouble? Open in Zoom app" : "오디오 연결 문제? Zoom 앱에서 열기"}</summary>
            <p>{hostMode ? "If browser audio fails, use the Zoom app. The embedded view closes to avoid duplicate sessions." : "브라우저 Zoom 음성이 연결되지 않으면 Zoom 앱을 이용할 수 있습니다."}</p>
            {hostMode && <p>Teacher: Zoom app does not automatically inherit host privileges. Sign in to the Zoom host account if required.</p>}
            <a href={safeJoinUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setView("external")}>{hostMode ? "Open Zoom app" : "Zoom 앱에서 수업 열기"}</a>
          </details>
        )}
        <div ref={iframeWrapperRef} className="talkly-zoom-desktop-embed">{children}</div>
      </div>
    );
  }
  if (view === "external") {
    return (
      <div className="talkly-mobile-zoom-access">
        <strong className="talkly-mobile-zoom-heading">{hostMode ? "Using Zoom app" : "Zoom 앱으로 참여 중"}</strong>
        <p>{hostMode ? "Lesson time stays unchanged. Return to TALKLY for materials and chat." : "수업시간과 출석은 유지됩니다. Zoom 앱에서 소리를 연결하고 교재와 채팅은 TALKLY에서 이용하세요."}</p>
        <button type="button" className="talkly-mobile-zoom-browser"
          onClick={() => setView("embedded")}>{hostMode ? "Return to browser (leave app first)" : "내장 Zoom으로 돌아가기 (앱에서 먼저 나가기)"}</button>
      </div>
    );
  }

  return (
    <div className="talkly-mobile-zoom-access">
      <strong className="talkly-mobile-zoom-heading">{hostMode ? "Tablet and phone video" : "모바일·태블릿 화상수업"}</strong>
      <p>{hostMode ? "The embedded Zoom meeting is designed for desktop browsers. On tablet or phone, use the Zoom app for more reliable audio and video." : "내장 Zoom은 PC 브라우저에 최적화되어 있습니다. 휴대폰과 태블릿은 Zoom 앱 이용을 권장합니다."}</p>
      {hostMode && (
        <p className="talkly-mobile-zoom-warning">Host privileges do not transfer automatically to the Zoom app. Start lessons on a PC where possible; on mobile, sign in with the Zoom host account.</p>
      )}
      {safeJoinUrl ? (
        <a className="talkly-mobile-zoom-launch" href={safeJoinUrl} target="_blank" rel="noopener noreferrer" onClick={() => setView("external")}>
          {hostMode ? "Open Zoom app" : "Zoom 앱으로 수업 참여"}
        </a>
      ) : (
        <p role="alert" className="talkly-mobile-zoom-warning">{hostMode ? "Meeting link unavailable. Contact the administrator." : "Zoom 수업 참여 링크를 확인할 수 없습니다. 관리자에게 문의해 주세요."}</p>
      )}
      <p className="talkly-mobile-zoom-note">{hostMode ? "Join in Zoom, then return to TALKLY for the textbook and chat. Lesson time is preserved." : "Zoom 앱에 입장한 뒤 TALKLY로 돌아와 교재·채팅을 볼 수 있습니다. 수업시간과 출석은 유지됩니다."}</p>
      <button type="button" className="talkly-mobile-zoom-browser"
        onClick={() => setView("embedded")}>
        {hostMode ? "Try browser (limited support)" : "브라우저 화면으로 시도 (모바일 지원 제한)"}
      </button>
    </div>
  );
}
