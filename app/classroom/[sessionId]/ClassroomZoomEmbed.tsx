"use client";
import { getClassroomText } from "@/lib/classroom-language";
import { activateZoomControlWithOverflow, zoomAudioState, type ZoomAction, type ZoomAudioUser } from "@/lib/zoom-ui-controls";
import "./zoom-layout.css";
import { markZoomLayout, zoomLayoutSize } from "@/lib/zoom-layout";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
declare global {
  interface Window {
    ZoomMtgEmbedded?: {
      createClient: () => {
        init: (options: {
          zoomAppRoot: HTMLElement;
          language: string;
          patchJsMedia?: boolean;
          leaveOnPageUnload?: boolean;
          customize?: Record<string, unknown>;
        }) => Promise<unknown>;
        join: (options: {
          signature: string;
          meetingNumber: string;
          password: string;
          userName: string;
          zak?: string;
        }) => Promise<unknown>;
        updateVideoOptions?: (options: Record<string, unknown>) => void;
        leaveMeeting?: () => Promise<unknown>;
        on?: (event: string, listener: (payload: { action?: string }) => void) => void;
        off?: (event: string, listener: (payload: { action?: string }) => void) => void;
        getAttendeeslist?: () => ZoomAudioUser[];
        getCurrentUser?: () => ZoomAudioUser | null;
        setViewType?: (view: "gallery") => unknown;
        mute?: (muted: boolean) => Promise<unknown>;

      };
    };
  }
}
type Props = {
  sessionId: number;
  meetingNumber: string;
  password: string;
  userName: string;
  hostMode: boolean;
};
type ZoomScreen =
  | "loading"
  | "joining"
  | "waiting"
  | "error"
  | "joined";
const ZOOM_VERSION = "6.2.0";
const SCRIPTS = [
  `https://source.zoom.us/${ZOOM_VERSION}/lib/vendor/react.min.js`,
  `https://source.zoom.us/${ZOOM_VERSION}/lib/vendor/react-dom.min.js`,
  `https://source.zoom.us/${ZOOM_VERSION}/lib/vendor/redux.min.js`,
  `https://source.zoom.us/${ZOOM_VERSION}/lib/vendor/redux-thunk.min.js`,
  `https://source.zoom.us/${ZOOM_VERSION}/lib/vendor/lodash.min.js`,
  `https://source.zoom.us/zoom-meeting-embedded-${ZOOM_VERSION}.min.js`,
];
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${src}"]`
    ) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener(
        "load",
        () => resolve(),
        {
          once: true,
        }
      );
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              `스크립트 로드 실패: ${src}`
            )
          ),
        {
          once: true,
        }
      );
      return;
    }
    const script =
      document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(
        new Error(
          `스크립트 로드 실패: ${src}`
        )
      );
    };
    document.head.appendChild(script);
  });
}
function stringifyZoomError(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
function isMeetingNotStartedError(
  error: unknown
) {
  const text =
    stringifyZoomError(
      error
    ).toLowerCase();
  return (
    text.includes(
      "meeting has not started"
    ) ||
    text.includes(
      '"errorcode":3008'
    ) ||
    text.includes(
      '"errorcode": 3008'
    ) ||
    text.includes(
      "errorcode:3008"
    ) ||
    text.includes(
      "errorcode: 3008"
    )
  );
}
export default function ClassroomZoomEmbed({
  sessionId,
  meetingNumber,
  password,
  userName,
  hostMode,
}: Props) {
  const ui = getClassroomText(hostMode);

  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );
  const runningRef =
    useRef(false);

  const clientRef = useRef<ReturnType<NonNullable<Window["ZoomMtgEmbedded"]>["createClient"]> | null>(null);
  const shareCleanupRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const joinedRef = useRef(false);

  const disposeClient = useCallback(async () => {
    shareCleanupRef.current?.();
    shareCleanupRef.current = null;
    const client = clientRef.current;
    clientRef.current = null;
    const wasJoined = joinedRef.current;
    joinedRef.current = false;
    if (client && wasJoined && typeof client.leaveMeeting === "function") {
      try {
        await client.leaveMeeting();
      } catch (error) {
        console.warn("[TALKLY] Zoom leaveMeeting failed:", error);
      }
    }
  }, []);
  const [
    screen,
    setScreen,
  ] =
    useState<ZoomScreen>(
      "loading"
    );
  const [
    status,
    setStatus,
  ] =
    useState(
      ui("Zoom Meeting SDK 준비 중...")
    );
  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");
  const [
    attempt,
    setAttempt,
  ] =
    useState(0);
  const [split, setSplit] = useState(false);
  const splitRef = useRef(false);
  const [receiving, setReceiving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [audioState, setAudioState] = useState("unknown");
  const [peerAudio, setPeerAudio] = useState("");
  const [controlError, setControlError] = useState("");
  const [audioBusy, setAudioBusy] = useState(false);
  const audioBusyRef = useRef(false);
  const measureVideo = useCallback(() => {
    const root = rootRef.current;
    const width = root?.parentElement?.clientWidth || root?.clientWidth || 420;
    const height = root?.parentElement?.clientHeight || root?.clientHeight || 430;
    const size = zoomLayoutSize(width, height, splitRef.current);
    root?.style?.setProperty("--zoom-content-height", `${size.height}px`);
    root?.style?.setProperty("--video-column", `${size.width}px`);
    root?.parentElement?.style.setProperty("--video-column", `${size.width}px`);
    return size;
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(() => markZoomLayout(root));
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    markZoomLayout(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const configure = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "talkly-zoom-layout" || event.data.sessionId !== sessionId || typeof event.data.split !== "boolean") return;
      splitRef.current = !hostMode && event.data.split;
      setSplit(splitRef.current);
      const size = measureVideo();
      if (joinedRef.current) clientRef.current?.updateVideoOptions?.({ viewSizes: { default: size, ribbon: size } });
    };
    window.addEventListener("message", configure);
    if (window.parent !== window) window.parent.postMessage({ type: "talkly-zoom-ready", sessionId }, window.location.origin);
    return () => window.removeEventListener("message", configure);
  }, [sessionId, hostMode, measureVideo]);
  const startZoom =
    useCallback(async () => {
      if (
        runningRef.current
      ) {
        return;
      }
      runningRef.current =
        true;

      const generation = generationRef.current;
      const ensureCurrent = () => {
        if (generation !== generationRef.current || !rootRef.current) {
          throw new Error("Zoom initialization cancelled");
        }
      };
      try {
        setScreen(
          "loading"
        );
        setErrorMessage(
          ""
        );
        setStatus(
          hostMode
            ? ui("Zoom 호스트 인증을 준비하는 중...")
            : ui("Zoom SDK를 불러오는 중...")
        );
        for (
          const src of
          SCRIPTS
        ) {
          await loadScript(
            src
          );
          ensureCurrent();
        }
        if (
          !window.ZoomMtgEmbedded ||
          !rootRef.current
        ) {
          throw new Error(
            ui("Zoom Meeting SDK를 초기화할 수 없습니다.")
          );
        }
        let signature =
          "";
        let zak:
          | string
          | undefined;
        /*
         * =====================================================
         * 강사 / 관리자
         * Zoom 호스트 인증
         * =====================================================
         */
        if (hostMode) {
          setStatus(
            ui("Zoom 호스트 권한을 확인하는 중...")
          );
          const hostResponse =
            await fetch(
              "/api/zoom/host-auth",
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                credentials:
                  "same-origin",
                body:
                  JSON.stringify({
                    sessionId,
                  }),
              }
            );
          const hostData =
            await hostResponse.json();
          if (
            !hostResponse.ok ||
            !hostData.success ||
            !hostData.signature ||
            !hostData.zak
          ) {
            throw new Error(
              typeof hostData.error ===
                "string"
                ? hostData.error
                : ui("Zoom 호스트 인증정보를 발급받지 못했습니다.")
            );
          }
          signature =
            hostData.signature;
          zak =
            hostData.zak;
        } else {
          /*
           * ===================================================
           * 학생
           * Zoom 참가자용 SDK Signature
           * ===================================================
           */
          setStatus(
            ui("TALKLY 인증을 확인하는 중...")
          );
          const signatureResponse =
            await fetch(
              "/api/zoom/sdk-signature",
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                credentials:
                  "same-origin",
                body:
                  JSON.stringify({
                    meetingNumber,
                    sessionId,
                    role: 0,
                  }),
              }
            );
          const signatureData =
            await signatureResponse.json();
          if (
            !signatureResponse.ok ||
            !signatureData.success ||
            !signatureData.signature
          ) {
            throw new Error(
              typeof signatureData.error ===
                "string"
                ? signatureData.error
                : ui("Meeting SDK 서명을 발급받지 못했습니다.")
            );
          }
          signature =
            signatureData.signature;
        }
        ensureCurrent();
        await disposeClient();
        ensureCurrent();

        /*
         * 기존 Zoom DOM 제거
         *
         * 재시도 시 이전 SDK DOM이 남아 있으면
         * 화면이 중복 렌더링될 수 있습니다.
         */
        if (
          rootRef.current
        ) {
          rootRef.current.innerHTML =
            "";
        }
        const client =
          window.ZoomMtgEmbedded.createClient();
        clientRef.current = client;
        setStatus(
          hostMode
            ? ui("Zoom 수업을 시작하는 중...")
            : ui("Zoom 수업실을 여는 중...")
        );
        const { width: rootWidth, height: videoHeight } = measureVideo();
        ensureCurrent();
        await client.init({
          zoomAppRoot:
            rootRef.current,
          language:
            hostMode ? "en-US" : "ko-KR",
          patchJsMedia:
            true,
          leaveOnPageUnload: true,
          customize: {
            sharing: { options: { hideShareAudioOption: false } },
            video: {
              defaultViewType: "gallery",
              popper: { disableDraggable: true },
              isResizable:
                false,
              viewSizes: {
                default: {
                  width: rootWidth,
                  height: videoHeight,
                },
                ribbon: { width: rootWidth, height: videoHeight },
              },
            },
            meetingInfo: [
              "topic",
              "host",
              "mn",
              "pwd",
              "telPwd",
              "invite",
              "participant",
              "dc",
              "enctype",
            ],
          },
        });
        // Only public SDK events are observed. Keep the SDK DOM and media transport intact.
        const updateAudio = () => {
          try {
            const me = client.getCurrentUser?.();
            setAudioState(zoomAudioState(me));
            const peers = client.getAttendeeslist?.().filter(person => me?.userId != null && person.userId !== me.userId) || [];
            setPeerAudio(peers.length === 0 ? ui("Waiting for the other participant · 상대방 입장 대기") : peers.some(person => zoomAudioState(person) === "disconnected") ? ui("Other participant: audio not connected · 상대방 오디오 미연결") : peers.some(person => zoomAudioState(person) === "unknown") ? ui("Other participant: checking audio · 상대방 오디오 확인 중") : peers.some(person => zoomAudioState(person) === "muted") ? ui("Other participant: microphone muted · 상대방 마이크 음소거") : ui("Other participant: audio connected · 상대방 오디오 연결됨"));
          } catch { setAudioState("unknown"); }
        };
        const emitShare = (active: boolean) => {
          setReceiving(active && !hostMode);
          // Ribbon enforces a 615px base height when receiving a share. Gallery
          // honours the compact video dimensions and avoids a clipped camera rail.
          if (active && !hostMode) window.setTimeout(() => {
            if (clientRef.current === client && joinedRef.current) {
              client.setViewType?.("gallery");
              markZoomLayout(rootRef.current!);
            }
          }, 150);
          setSharing(active);
          window.dispatchEvent(new CustomEvent("talkly-zoom-share-state", { detail: { sessionId, active } }));
          if (window.parent !== window && typeof window.parent?.postMessage === "function") {
            window.parent.postMessage({ type: "talkly-zoom-share-state", sessionId, active }, window.location.origin);
          }
        };
        const checkShare = () => {
          try {
            const attendees = client.getAttendeeslist?.();
            if (Array.isArray(attendees)) emitShare(attendees.some(person => person.sharerOn === true));
          } catch { /* The SDK can briefly have no participant state while joining/reconnecting. */ }
        };
        const peerShare = (payload: { action?: string }) => {
          const action = payload.action?.toLowerCase();
          if (action === "start") emitShare(true);
          else if (action === "stop") {
            if (client.getAttendeeslist) checkShare(); else emitShare(false);
          }
        };
        client.on?.("peer-share-state-change", peerShare);
        client.on?.("user-updated", checkShare);
        client.on?.("user-updated", updateAudio);
        client.on?.("user-added", updateAudio);
        client.on?.("user-removed", updateAudio);
        client.on?.("user-removed", checkShare);
        shareCleanupRef.current = () => {
          client.off?.("peer-share-state-change", peerShare);
          client.off?.("user-updated", checkShare);
          client.off?.("user-updated", updateAudio);
          client.off?.("user-added", updateAudio);
          client.off?.("user-removed", updateAudio);
          client.off?.("user-removed", checkShare);
          // A retry/unmount must not leave another classroom instance expanded.
          if (typeof window.dispatchEvent === "function") emitShare(false);
        };
        setStatus(
          hostMode
            ? ui("Zoom 호스트로 입장하는 중...")
            : ui("Zoom 수업에 입장하는 중...")
        );
        /*
         * =====================================================
         * Zoom Meeting 입장
         * =====================================================
         */
        ensureCurrent();
        setScreen("joining");
        await client.join({
          signature,
          meetingNumber,
          password,
          userName,
          ...(zak
            ? { zak }
            : {}),
        });
        joinedRef.current = true;
        checkShare();
        updateAudio();
        if (generation !== generationRef.current) {
          try {
            await client.leaveMeeting?.();
          } catch (error) {
            console.warn("[TALKLY] Zoom stale join cleanup failed:", error);
          }
          if (clientRef.current === client) {
            clientRef.current = null;
            joinedRef.current = false;
          }
          return;
        }

        /*
         * =====================================================
         * 중요
         *
         * 예전 attendance-checkin 자동출석 코드는 제거했습니다.
         *
         * 현재 자동출석은:
         *
         * StudentAttendanceRecorder
         *   ↓
         * /api/classroom/attendance
         *   ↓
         * attendance 테이블
         *
         * 방식으로만 처리합니다.
         * =====================================================
         */
        setStatus(
          ""
        );
        setScreen(
          "joined"
        );
      } catch (error) {
        if (generation !== generationRef.current) {
          return;
        }
        void disposeClient();
        console.error(
          "ZOOM CLASSROOM EMBED ERROR:",
          error
        );
        setStatus(
          ""
        );
        /*
         * 학생이 강사보다 먼저 Zoom Meeting에
         * 접근했을 경우 대기화면 처리
         */
        if (
          !hostMode &&
          isMeetingNotStartedError(
            error
          )
        ) {
          setScreen(
            "waiting"
          );
          setErrorMessage(
            ""
          );
          return;
        }
        setErrorMessage(
          stringifyZoomError(
            error
          )
        );
        setScreen(
          "error"
        );
      } finally {
        if (generation === generationRef.current) {
          runningRef.current = false;
        }
      }
    }, [
      sessionId,
      meetingNumber,
      password,
      userName,
      hostMode,
      disposeClient,
      measureVideo, ui]);
  useEffect(() => {
    generationRef.current += 1;
    const timer = window.setTimeout(() => void startZoom(), 0);
    return () => {
      window.clearTimeout(timer);
      generationRef.current += 1;
      runningRef.current = false;
      void disposeClient();
    };
  }, [startZoom, disposeClient, attempt]);
  useEffect(() => {
    if (screen !== "waiting") return;
    const timer = window.setTimeout(() => setAttempt(value => value + 1), 10000);
    return () => window.clearTimeout(timer);
  }, [screen, attempt]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || screen !== "joined") return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const size = measureVideo();
        clientRef.current?.updateVideoOptions?.({ viewSizes: { default: size, ribbon: size } });
      }, 150);
    });
    observer.observe(root.parentElement || root);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [screen, measureVideo]);
  function retryZoom() {
    if (
      runningRef.current
    ) {
      return;
    }
    setAttempt(
      (value) =>
        value + 1
    );
  }
  async function audioAction() {
    if (audioBusyRef.current) return;
    setControlError("");
    if (audioState !== "ready" && audioState !== "muted") { void nativeAction("audio"); return; }
    audioBusyRef.current = true; setAudioBusy(true);
    try {
      const client = clientRef.current;
      if (!client?.mute) throw new Error("Use the Zoom microphone button");
      await client.mute(audioState === "ready");
      setAudioState(zoomAudioState(client.getCurrentUser?.()));
    } catch { setControlError(ui("Microphone change failed. Check browser permissions and Zoom audio settings. · 마이크 변경 실패: 브라우저 권한과 Zoom 오디오 설정을 확인하세요.")); }
    finally { audioBusyRef.current = false; setAudioBusy(false); }
  }
  async function nativeAction(action: ZoomAction) {
    setControlError("");
    if (!rootRef.current || !await activateZoomControlWithOverflow(rootRef.current, action)) setControlError(ui("Use the matching Zoom toolbar button below or its More (…) menu. · 아래 Zoom 도구 모음 또는 더보기(…)에서 해당 버튼을 눌러주세요."));
  }
  function testSpeaker() {
    if (typeof AudioContext === "undefined") { setControlError(ui("Speaker test unavailable in this browser · 이 브라우저에서는 소리 테스트를 지원하지 않습니다.")); return; }
    const context = new AudioContext();
    const tone = context.createOscillator(), volume = context.createGain();
    tone.frequency.value = 440; volume.gain.value = .08;
    tone.connect(volume); volume.connect(context.destination);
    void context.resume().then(() => {
      tone.onended = () => void context.close();
      tone.start(); tone.stop(context.currentTime + .4);
    }).catch(() => { void context.close(); setControlError(ui("Speaker playback blocked. Check site sound permission. · 사이트 소리 권한을 확인하세요.")); });
  }
  const showOverlay =
    screen ===
      "loading" ||
    screen ===
      "waiting" ||
    screen ===
      "error";
  return (
    <div lang={hostMode ? "en" : "ko"} className="talkly-zoom-shell" data-split={split ? "true" : "false"} data-receiving={receiving ? "true" : "false"}>
      <div className="talkly-zoom-status" role="status">
        <strong>{hostMode ? ui("Teacher · 강사") : ui("Video · 영상")} · {screen === "joined" ? ui("Zoom connected · Zoom 연결됨") : screen === "joining" ? ui("Joining · 입장 중") : ui("Connecting · 연결 준비")}</strong>
        {screen === "joined" && <>
          <p className={audioState !== "ready" ? "talkly-audio-warning" : undefined}>{audioState === "ready" ? ui("Microphone on · 마이크 켜짐") : audioState === "muted" ? ui("Microphone muted · 마이크 꺼짐") : audioState === "disconnected" ? ui("Audio NOT connected — click Connect audio · 오디오 미연결: 오디오 연결을 누르세요") : ui("Checking audio · 오디오 상태 확인 중")}</p>
          <p>{ui(peerAudio)}</p>
          <div className="talkly-zoom-actions">
            <button type="button" onClick={() => void audioAction()} disabled={audioBusy}>{audioState === "ready" ? ui("Mute · 마이크 끄기") : audioState === "muted" ? ui("Unmute · 마이크 켜기") : ui("1. Connect audio · 오디오 연결")}</button>
            <button type="button" onClick={() => void nativeAction("video")}>{ui("2. Camera · 카메라 켜기/끄기")}</button>
            {hostMode && <button type="button" data-action={sharing ? "stop-share" : "share"} onClick={() => void nativeAction(sharing ? "stop-share" : "share")}>{sharing ? ui("Stop sharing · 공유 중지") : ui("3. Share textbook · 교재 화면 공유")}</button>}
          </div>
          <details><summary>{ui("Sound help · 소리가 안 들릴 때")}</summary><div className="talkly-zoom-actions">
            <button type="button" onClick={testSpeaker}>{ui("Test speaker · 소리 테스트")}</button>
            <button type="button" onClick={() => void nativeAction("settings")}>{ui("Audio settings · 오디오 설정")}</button>
          </div><p>{ui("Both participants must connect audio and unmute. Allow microphone and sound in browser site settings; check the selected speaker/microphone and device volume. · 양쪽 모두 오디오 연결 후 마이크를 켜세요. 브라우저 사이트 설정의 마이크·소리 허용, 사용 장치와 볼륨을 확인하세요.")}</p></details>
          {hostMode && <p className="talkly-audio-warning">Textbook sound: Chrome tab → textbook tab → enable Share tab audio. Window/screen sharing may have no sound.<br />{ui("교재 소리: Chrome 탭 → 교재 탭 선택 → ‘탭 오디오 공유’ 체크. 체크하지 않았다면 공유를 중지하고 다시 시작하세요.")}</p>}
          {controlError && <p role="alert" className="talkly-audio-warning">{controlError}</p>}
        </>}
      </div>
      <div className="talkly-zoom-body">
      {showOverlay && (
        <div
          style={{
            position:
              "absolute",
            inset:
              0,
            zIndex:
              10,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "32px",
            textAlign:
              "center",
            background:
              "#111216",
            boxSizing:
              "border-box",
          }}
        >
          {screen ===
            "loading" && (
            <div>
              <div
                style={{
                  fontSize:
                    "14px",
                  opacity:
                    0.55,
                  marginBottom:
                    "12px",
                }}
              >
                TALKLY CLASSROOM
              </div>
              <div
                style={{
                  fontWeight:
                    800,
                  fontSize:
                    "20px",
                }}
              >
                {ui(status)}
              </div>
            </div>
          )}
          {screen ===
            "waiting" && (
            <div
              style={{
                maxWidth:
                  "420px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "14px",
                  opacity:
                    0.5,
                  marginBottom:
                    "12px",
                }}
              >
                TALKLY CLASSROOM
              </div>
              <div
                style={{
                  fontWeight:
                    800,
                  fontSize:
                    "24px",
                  marginBottom:
                    "14px",
                }}
              >{ui("수업 시작 전입니다")}</div>
              <p
                style={{
                  margin:
                    0,
                  lineHeight:
                    1.7,
                  opacity:
                    0.72,
                  fontSize:
                    "15px",
                }}
              >{ui("아직 Zoom 수업이 시작되지 않았습니다.")}<br />{ui("강사가 Zoom을 시작하면 10초 간격으로 자동 재입장합니다.")}</p>
              <button
                type="button"
                onClick={
                  retryZoom
                }
                style={
                  primaryButton
                }
              >{ui("Zoom 수업 입장 다시 시도")}</button>
            </div>
          )}
          {screen ===
            "error" && (
            <div
              style={{
                maxWidth:
                  "440px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "14px",
                  opacity:
                    0.5,
                  marginBottom:
                    "12px",
                }}
              >
                TALKLY CLASSROOM
              </div>
              <div
                style={{
                  fontWeight:
                    800,
                  fontSize:
                    "22px",
                  marginBottom:
                    "14px",
                }}
              >
                {hostMode
                  ? ui("Zoom 호스트 연결 오류")
                  : ui("Zoom 연결 오류")}
              </div>
              <p
                style={{
                  margin:
                    0,
                  lineHeight:
                    1.7,
                  opacity:
                    0.72,
                  fontSize:
                    "14px",
                }}
              >
                {hostMode
                  ? ui("Zoom 수업을 호스트로 시작하지 못했습니다.")
                  : ui("Zoom 수업실에 연결하지 못했습니다.")}
              </p>
              {errorMessage && (
                <div
                  style={{
                    marginTop:
                      "14px",
                    padding:
                      "12px",
                    borderRadius:
                      "8px",
                    background:
                      "rgba(255,255,255,0.05)",
                    fontSize:
                      "12px",
                    opacity:
                      0.6,
                    wordBreak:
                      "break-word",
                    maxHeight:
                      "140px",
                    overflow:
                      "auto",
                  }}
                >
                  {ui(errorMessage)}
                </div>
              )}
              <button
                type="button"
                onClick={
                  retryZoom
                }
                style={
                  primaryButton
                }
              >{ui("다시 시도")}</button>
            </div>
          )}
        </div>
      )}
      <div
        ref={
          rootRef
        }
        id="talkly-zoom-sdk-root"
        style={{
          position: "relative",
          width:
            "100%",
          height:
            "100%",
          minHeight:
            240,
        }}
      />
      {split && !receiving && screen === "joined" && <div className="talkly-share-waiting"><strong>{ui("Shared textbook · 공유 교재")}</strong><p>{ui("Waiting for the teacher to share · 강사의 교재 화면 공유를 기다립니다.")}</p></div>}
      </div>
    </div>
  );
}
const primaryButton: React.CSSProperties =
  {
    marginTop:
      "26px",
    padding:
      "13px 24px",
    borderRadius:
      "9px",
    border:
      "1px solid rgba(255,255,255,0.25)",
    background:
      "#f7f7f8",
    color:
      "#111216",
    fontSize:
      "15px",
    fontWeight:
      800,
    cursor:
      "pointer",
  };