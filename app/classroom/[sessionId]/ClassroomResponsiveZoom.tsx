"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  const safeJoinUrl = useMemo(() => safeZoomMeetingUrl(meetingUrl), [meetingUrl]);

  useEffect(() => {
    const ua = navigator.userAgent ?? "";
    const handheld = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) ||
      (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
    setView(handheld ? "mobile" : "embedded");
  }, []);

  if (view === "checking") {
    return <div className="talkly-mobile-zoom-access" role="status">화상수업 연결 준비 중 · Checking video connection…</div>;
  }
  if (view === "embedded") {
    return (
      <div className="talkly-zoom-desktop">
        {safeJoinUrl && (
          <details className="talkly-zoom-app-fallback">
            <summary>오디오 연결 문제? Zoom 앱에서 열기 · Audio not working?</summary>
            <p>브라우저 Zoom에서 음성이 계속 연결되지 않으면 Zoom 앱으로 참여할 수 있습니다.
              앱으로 전환하면 기존 내장 Zoom은 종료되어 중복 접속을 줄입니다.</p>
            {hostMode && <p>강사: Zoom 앱에서는 TALKLY 호스트 권한이 자동 전달되지 않습니다.
              해당 Zoom 호스트 계정으로 로그인해야 할 수 있습니다.</p>}
            <a href={safeJoinUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setView("external")}>Zoom 앱에서 수업 열기 · Open in Zoom</a>
          </details>
        )}
        <div className="talkly-zoom-desktop-embed">{children}</div>
      </div>
    );
  }
  if (view === "external") {
    return (
      <div className="talkly-mobile-zoom-access">
        <strong className="talkly-mobile-zoom-heading">Zoom 앱으로 참여 중 · Using Zoom app</strong>
        <p>이 강의실의 수업시간·출석 상태는 그대로 유지됩니다.
          Zoom 앱에서 소리를 연결하고 TALKLY로 돌아와 교재와 채팅을 이용하세요.</p>
        <button type="button" className="talkly-mobile-zoom-browser"
          onClick={() => setView("embedded")}>내장 Zoom으로 돌아가기 (앱에서 먼저 나가기)</button>
      </div>
    );
  }

  return (
    <div className="talkly-mobile-zoom-access">
      <strong className="talkly-mobile-zoom-heading">모바일·태블릿 화상수업</strong>
      <p>
        TALKLY 내장 Zoom 화면은 PC 브라우저에 최적화되어 있습니다.
        휴대폰과 태블릿에서는 Zoom 앱으로 입장하면 카메라·음성 연결이 더 안정적입니다.
      </p>
      {hostMode && (
        <p className="talkly-mobile-zoom-warning">
          강사 호스트 권한은 Zoom 앱에 자동으로 전달되지 않습니다. 강사는 PC에서 수업을 시작하는 것을 권장합니다.
          모바일 Zoom 앱에서 호스트가 되려면 해당 Zoom 호스트 계정으로 별도 로그인해야 할 수 있습니다.
        </p>
      )}
      {safeJoinUrl ? (
        <a className="talkly-mobile-zoom-launch" href={safeJoinUrl} target="_blank" rel="noopener noreferrer" onClick={() => setView("external")}>
          Zoom 앱으로 수업 참여 · Open Zoom
        </a>
      ) : (
        <p role="alert" className="talkly-mobile-zoom-warning">Zoom 수업 참여 링크를 확인할 수 없습니다. 관리자에게 문의해 주세요.</p>
      )}
      <p className="talkly-mobile-zoom-note">
        Zoom 앱이 설치되어 있으면 수업에 입장한 뒤 TALKLY 강의실로 돌아와 교재를 볼 수 있습니다.
        수업시간과 출석 기록은 이 화면을 다시 여는 것만으로 초기화되지 않습니다.
      </p>
      <button type="button" className="talkly-mobile-zoom-browser"
        onClick={() => setView("embedded")}>
        브라우저 화면으로 시도 (모바일 지원 제한) · Try web version
      </button>
    </div>
  );
}
