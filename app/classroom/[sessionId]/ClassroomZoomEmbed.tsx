"use client";
import { getClassroomText } from "@/lib/classroom-language";
import { checkClassroomMicrophone } from "@/lib/classroom-audio-diagnostics";
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
  // Do not initialize a replacement Zoom client while the previous
  // microphone/media connection is still leaving the meeting.
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

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
  const cameraColumnPixelsRef = useRef<number | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [audioState, setAudioState] = useState("unknown");
  const [peerAudio, setPeerAudio] = useState("");
  const [cameraOn, setCameraOn] = useState<boolean | null>(null);
  const [cameraControlFailed, setCameraControlFailed] = useState(false);
  const [micCheckOk, setMicCheckOk] = useState<boolean | null>(null);
  const [controlError, setControlError] = useState("");
  const [micCheckMessage, setMicCheckMessage] = useState("");
  const [micChecking, setMicChecking] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [sameNameParticipants, setSameNameParticipants] = useState(0);
  const [audioBusy, setAudioBusy] = useState(false);
  const audioBusyRef = useRef(false);
  const audioRecoveryTimersRef = useRef<number[]>([]);
  const [audioRecoveryStatus, setAudioRecoveryStatus] =
    useState<"idle" | "attempting" | "timeout">("idle");
  const clearAudioRecoveryTimers = useCallback(() => {
    audioRecoveryTimersRef.current.forEach(timer => window.clearTimeout(timer));
    audioRecoveryTimersRef.current = [];
  }, []);
  useEffect(() => () => clearAudioRecoveryTimers(), [clearAudioRecoveryTimers]);

  // A lightweight, best-effort browser SDK presence signal for administrators.
  // It is deliberately distinct from attendance and Zoom server membership.
  useEffect(() => {
    if (screen !== "joined") return;
    const report = (state: "joined" | "left", keepalive = false) => {
      void fetch("/api/classroom/live-presence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, state }),
        cache: "no-store",
        keepalive,
      }).catch(() => { /* Never interrupt a lesson due to monitoring failures. */ });
    };
    report("joined");
    const timer = window.setInterval(() => {
      if (joinedRef.current) report("joined");
    }, 25_000);
    return () => {
      window.clearInterval(timer);
      report("left", true);
    };
  }, [screen, sessionId]);

  const measureVideo = useCallback(() => {
    const root = rootRef.current;
    const width = root?.parentElement?.clientWidth || root?.clientWidth || 420;
    const height = root?.parentElement?.clientHeight || root?.clientHeight || 430;
    const size = zoomLayoutSize(width, height, splitRef.current);
    const cameraWidth = cameraColumnPixelsRef.current == null
      ? Math.min(320, Math.max(160, width * .275))
      : Math.max(40, Math.min(cameraColumnPixelsRef.current, width - 40));
    root?.style?.setProperty("--zoom-content-height", `${size.height}px`);
    root?.style?.setProperty("--video-column", `${cameraWidth}px`);
    root?.parentElement?.style.setProperty("--video-column", `${cameraWidth}px`);
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
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.sessionId !== sessionId) return;
      if (event.data.type === "talkly-zoom-camera-width") {
        if (typeof event.data.pixels !== "number" || !Number.isFinite(event.data.pixels)) return;
        cameraColumnPixelsRef.current = Math.max(40, event.data.pixels);
        const size = measureVideo();
        if (joinedRef.current) clientRef.current?.updateVideoOptions?.({ viewSizes: { default: size, ribbon: size } });
        return;
      }
      if (event.data.type !== "talkly-zoom-layout" || typeof event.data.split !== "boolean") return;
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
        await teardownRef.current;
        ensureCurrent();
        clearAudioRecoveryTimers();
        setAudioRecoveryStatus("idle");
        setAudioState("unknown");
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
            const currentAudio = zoomAudioState(me);
            setAudioState(currentAudio);
            if (currentAudio === "ready" || currentAudio === "muted") {
              clearAudioRecoveryTimers();
              setAudioRecoveryStatus("idle");
            }
            setCameraOn(typeof me?.bVideoOn === "boolean" ? me.bVideoOn : null);
            const peers = client.getAttendeeslist?.().filter(person => me?.userId != null && person.userId !== me.userId) || [];
            const currentDisplayName = me?.displayName?.trim().toLocaleLowerCase();
            setSameNameParticipants(currentDisplayName
              ? peers.filter(person => person.displayName?.trim().toLocaleLowerCase() === currentDisplayName).length
              : 0);
            setPeerAudio(peers.length === 0 ? ui("Waiting for the other participant · 상대방 입장 대기") : peers.some(person => ["disconnected", "failed"].includes(zoomAudioState(person))) ? ui("Other participant: audio not connected · 상대방 오디오 미연결") : peers.some(person => ["unknown", "connecting"].includes(zoomAudioState(person))) ? ui("Other participant: checking audio · 상대방 오디오 확인 중") : peers.some(person => zoomAudioState(person) === "muted") ? ui("Other participant: microphone muted · 상대방 마이크 음소거") : ui("Other participant: audio connected · 상대방 오디오 연결됨"));
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
      clearAudioRecoveryTimers,
      measureVideo, ui]);
  useEffect(() => {
    generationRef.current += 1;
    const timer = window.setTimeout(() => void startZoom(), 0);
    return () => {
      window.clearTimeout(timer);
      generationRef.current += 1;
      runningRef.current = false;
      const previousCleanup = disposeClient();
      teardownRef.current = previousCleanup;
      void previousCleanup.catch((error) => console.warn("[TALKLY] Zoom cleanup failed:", error));
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
  function reconnectClassroom() {
    if (runningRef.current) return;
    if (!window.confirm(hostMode
      ? "Reconnect Zoom? The lesson and remaining time are not reset. Computer audio must be reconnected afterward."
      : "Zoom 연결을 다시 시작할까요? 수업시간·출석은 초기화되지 않으며 오디오도 다시 연결해야 합니다.")) return;
    setControlError("");
    setMicCheckMessage("");
    clearAudioRecoveryTimers();
    setAudioRecoveryStatus("idle");
    setAudioState("unknown");
    setCameraOn(null);
    setCameraControlFailed(false);
    setMicCheckOk(null);
    retryZoom();
  }
  async function checkMicrophone() {
    if (micChecking) return;
    setMicChecking(true);
    setMicCheckMessage("");
    try {
      const outcome = await checkClassroomMicrophone();
      setMicCheckMessage(hostMode && outcome.message.includes(" · ") ? outcome.message.split(" · ").at(-1)! : outcome.message);
      setMicCheckOk(outcome.ok);
    } finally {
      setMicChecking(false);
    }
  }
  async function audioAction() {
    if (audioBusyRef.current) return;
    audioBusyRef.current = true;
    setAudioBusy(true);
    setControlError("");
    try {
      const client = clientRef.current;
      if (audioState === "ready" || audioState === "muted") {
        if (!client?.mute) throw new Error("Zoom audio mute API unavailable");
        await client.mute(audioState === "ready");
        setAudioState(zoomAudioState(client.getCurrentUser?.()));
        return;
      }

      // The Zoom embedded Meeting SDK does not expose a public joinAudio API.
      // Activate only the visible, explicitly named native Join Computer Audio
      // control from the user's click. Do not auto-click on mount or reconnect.
      const clicked = Boolean(rootRef.current &&
        await activateZoomControlWithOverflow(rootRef.current, "join-audio"));
      if (!clicked) {
        setAudioRecoveryStatus("timeout");
        setDiagnosticsOpen(true);
        setControlError(hostMode
          ? "Zoom's Join Audio button was not found. Use the native Zoom toolbar or its audio dialog to connect computer audio."
          : "Zoom의 오디오 참가 버튼을 찾지 못했습니다. Zoom 기본 도구 모음에서 ‘컴퓨터 오디오 참가’를 눌러 주세요.");
        console.warn("[TALKLY] Zoom Join Computer Audio control unavailable");
        return;
      }
      setAudioRecoveryStatus("attempting");
      clearAudioRecoveryTimers();
      const generation = generationRef.current;
      // Refresh only after a user action; no permanent polling and no
      // interference with Zoom-owned media streams.
      for (const delay of [600, 2200, 8500]) {
        const timer = window.setTimeout(() => {
          if (generation !== generationRef.current || !joinedRef.current ||
              !clientRef.current) return;
          try {
            const current = zoomAudioState(clientRef.current.getCurrentUser?.());
            setAudioState(current);
            if (current === "ready" || current === "muted") {
              clearAudioRecoveryTimers();
              setAudioRecoveryStatus("idle");
              return;
            }
            if (delay === 8500) {
              setAudioRecoveryStatus("timeout");
              setDiagnosticsOpen(true);
              console.warn("[TALKLY] Computer audio not confirmed after join request", {
                audioState: current,
              });
            }
          } catch {
            if (delay === 8500) setAudioRecoveryStatus("timeout");
          }
        }, delay);
        audioRecoveryTimersRef.current.push(timer);
      }
    } catch {
      setAudioRecoveryStatus("timeout");
      setDiagnosticsOpen(true);
      setControlError(hostMode
        ? "Audio action did not complete. Check Zoom audio settings, browser permissions and the native toolbar."
        : "오디오 연결을 확인하지 못했습니다. Zoom 오디오 설정과 브라우저 마이크 권한을 확인해 주세요.");
    } finally {
      audioBusyRef.current = false;
      setAudioBusy(false);
    }
  }
  async function nativeAction(action: ZoomAction) {
    setControlError("");
    // The Zoom SDK toolbar click must happen synchronously in the browser's
    // transient user-activation window. Never await permissions first.
    const clicked = Boolean(rootRef.current && await activateZoomControlWithOverflow(rootRef.current, action));
    if (action === "video") {
      setCameraControlFailed(!clicked);
      if (clicked) window.setTimeout(() => {
        const me = clientRef.current?.getCurrentUser?.();
        setCameraOn(typeof me?.bVideoOn === "boolean" ? me.bVideoOn : null);
      }, 900);
    }
    if (!clicked) {
      if (action === "video" && navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "camera" as PermissionName });
          if (permission.state === "denied") {
            setControlError(hostMode
              ? "Camera is blocked. Allow camera access in browser site settings and reopen the classroom."
              : "브라우저에서 카메라가 차단되었습니다. 사이트 설정에서 카메라 사용을 허용해주세요.");
          } else {
            setControlError(hostMode
              ? "Zoom camera control was not found. Use Zoom's native Video button or More menu."
              : "Zoom 카메라 버튼을 찾지 못했습니다. Zoom 기본 비디오 버튼 또는 더보기 메뉴를 확인해주세요.");
          }
        } catch {
          setControlError(hostMode
            ? "Use Zoom's native Video control or More menu."
            : "Zoom 기본 비디오 버튼 또는 더보기 메뉴를 사용해주세요.");
        }
      } else {
        setControlError(hostMode
          ? "Use the corresponding control in Zoom's native toolbar or More menu."
          : "Zoom 기본 도구 모음 또는 더보기 메뉴에서 해당 버튼을 눌러주세요.");
      }
      setDiagnosticsOpen(true);
    }
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
  const audioConnected = audioState === "ready" || audioState === "muted";
  const audioAttention = screen === "joined" && !audioConnected;
  const showOverlay =
    screen ===
      "loading" ||
    screen ===
      "waiting" ||
    screen ===
      "error";
  return (
    <div lang={hostMode ? "en" : "ko"} className="talkly-zoom-shell" data-host={hostMode ? "true" : "false"} data-sharing={sharing ? "true" : "false"} data-split={split ? "true" : "false"} data-receiving={receiving ? "true" : "false"}>
      <div className="talkly-zoom-status" role="group" aria-label={hostMode ? "Class audio, video and sharing" : "오디오 및 비디오 조작"}>
        {screen === "joined" && <>
          <div className="talkly-zoom-quick-actions" role="toolbar" aria-label={hostMode ? "Lesson controls" : "수업 조작"}>
            <button type="button" onClick={testSpeaker} title={hostMode ? "Test laptop speaker" : "스피커 소리 테스트"}>{hostMode ? "Speaker" : "스피커"}</button>
            <button type="button" onClick={() => void audioAction()} disabled={audioBusy}
              data-health={["disconnected", "failed"].includes(audioState) ? "error" : "unknown"}
              title={!audioConnected ? (hostMode ? "Join computer audio" : "컴퓨터 오디오 연결") : hostMode ? "Audio / microphone" : "오디오 / 마이크"}>
              {!audioConnected ? (hostMode ? "Join Audio" : "오디오 연결") : audioState === "muted" ? (hostMode ? "Unmute" : "음소거 해제") : (hostMode ? "Mute" : "음소거")}
            </button>
            <button type="button" onClick={() => void nativeAction("video")}
              data-health={cameraControlFailed ? "error" : "unknown"}
              title={cameraControlFailed ? (hostMode ? "Camera action failed — check settings" : "카메라 조작 실패 — 설정 확인") : hostMode ? "Toggle camera" : "카메라 켜기 / 끄기"}>
              {cameraOn === true ? (hostMode ? "Camera off" : "카메라 끄기") : (hostMode ? "Camera on" : "카메라 켜기")}{cameraControlFailed ? " !" : ""}
            </button>
            {hostMode ? (
              <button type="button" onClick={() => void nativeAction(sharing ? "stop-share" : "share")}
                data-action={sharing ? "stop-share" : "share"} title={sharing ? "Stop sharing teaching materials" : "Share teaching materials"}>
                {sharing ? "Stop share" : "Share"}
              </button>
            ) : null}
          </div>
          {(!hostMode || audioAttention || controlError || cameraControlFailed || diagnosticsOpen) && <details className="talkly-zoom-diagnostics" open={diagnosticsOpen}
            onToggle={event => setDiagnosticsOpen(event.currentTarget.open)}>
            <summary title={hostMode ? "More connection settings" : "추가 연결 설정"} aria-label={hostMode ? "More connection settings" : "추가 연결 설정"}>⋯</summary>
            <div className="talkly-zoom-diagnostic-panel">
              <strong>{hostMode ? "Connection settings" : "연결 설정"}</strong>
              <div className="talkly-zoom-indicators" role="status">
                <span className="talkly-zoom-health" data-health="ok">{hostMode ? "Zoom connected" : "Zoom 연결됨"}</span>
                <span className="talkly-zoom-health" data-health={["disconnected", "failed"].includes(audioState) ? "error" : audioConnected ? "ok" : "unknown"}>{audioState === "failed" ? (hostMode ? "Audio connection failed" : "오디오 연결 실패") : audioState === "disconnected" ? (hostMode ? "Audio disconnected" : "오디오 미연결") : audioConnected ? (hostMode ? "Audio joined" : "오디오 연결됨") : (hostMode ? "Audio checking" : "오디오 확인 중")}</span>
                <span className="talkly-zoom-health" data-health={micCheckOk === false ? "error" : micCheckOk === true ? "ok" : "unknown"}>{micCheckOk === false ? (hostMode ? "Microphone issue" : "마이크 문제") : micCheckOk === true ? (hostMode ? "Microphone checked" : "마이크 확인됨") : (hostMode ? "Microphone not checked" : "마이크 점검 전")}</span>
                <span className="talkly-zoom-health" data-health={cameraControlFailed ? "error" : cameraOn === true ? "ok" : "unknown"}>{cameraControlFailed ? (hostMode ? "Camera issue" : "카메라 문제") : cameraOn === true ? (hostMode ? "Camera on" : "카메라 켜짐") : cameraOn === false ? (hostMode ? "Camera off" : "카메라 꺼짐") : (hostMode ? "Camera checking" : "카메라 확인 중")}</span>
              </div>
              <p className="talkly-zoom-peer">{hostMode ? "Other participant (read only): " : "상대방 상태 (읽기 전용): "}{ui(peerAudio)}</p>
              {sameNameParticipants > 0 && <p className="talkly-zoom-error">{hostMode ? "Duplicate participant name detected. Close extra Zoom sessions to avoid audio conflicts." : "같은 이름으로 여러 기기에서 접속 중입니다. 중복 연결을 확인해 주세요."}</p>}
              <div className="talkly-zoom-diagnostic-actions">
                <button type="button" onClick={() => void nativeAction("video")}>{cameraOn === true ? (hostMode ? "Turn camera off" : "카메라 끄기") : (hostMode ? "Turn camera on" : "카메라 켜기")}</button>
                <button type="button" onClick={() => void checkMicrophone()} disabled={micChecking}
                  data-health={micCheckOk === false ? "error" : "unknown"}>{micChecking ? (hostMode ? "Checking…" : "확인 중…") : hostMode ? "Check microphone" : "마이크 점검"}</button>
                <button type="button" onClick={reconnectClassroom} disabled={runningRef.current}
                  title={hostMode ? "Reconnect without resetting lesson time" : "수업시간을 유지하고 Zoom 재연결"}>{hostMode ? "Reconnect Zoom" : "Zoom 재연결"}</button>
                <button type="button" onClick={testSpeaker}>{hostMode ? "Test speaker" : "스피커 테스트"}</button>
                <button type="button" onClick={() => void nativeAction("settings")}>{hostMode ? "Audio settings" : "오디오 설정"}</button>
              </div>
              {micCheckMessage && <p role="status" className={micCheckOk === false ? "talkly-zoom-error" : "talkly-zoom-diagnostic"}>{micCheckMessage}</p>}
              {controlError && <p role="alert" className="talkly-zoom-error">{controlError}</p>}
              {hostMode && <details className="talkly-textbook-audio-help"><summary>Textbook audio help</summary><p>In Chrome, share the textbook tab and enable Share tab audio.</p></details>}
              <p className="talkly-zoom-help">{hostMode ? "Check your browser's audio and camera permissions if a device cannot connect." : "연결이 안 되면 브라우저의 마이크·카메라 권한을 확인하세요."}</p>
            </div>
          </details>}
        </>}
      </div>
      {screen === "joined" && !hostMode && (
        <button type="button" className="talkly-zoom-camera-access"
          onClick={() => void nativeAction("video")}
          aria-label={cameraOn === true ? (hostMode ? "Turn camera off" : "카메라 끄기") : (hostMode ? "Turn camera on" : "카메라 켜기")}
          title={hostMode ? "Camera / video" : "카메라 켜기·끄기"}>
          {cameraOn === true ? (hostMode ? "Camera off" : "카메라 끄기") : (hostMode ? "Camera on" : "카메라 켜기")}
        </button>
      )}
      {screen === "joined" && (audioAttention || audioState === "muted") && (
        <div className="talkly-audio-connection-banner" data-health={audioConnected ? "muted" : "needs-audio"}
          role={audioAttention ? "alert" : "status"}>
          <div>
            <strong>{audioState === "muted"
              ? (hostMode ? "Audio joined · microphone muted" : "오디오 연결됨 · 마이크 음소거")
              : audioState === "failed" || audioRecoveryStatus === "timeout"
                ? (hostMode ? "Computer audio needs attention" : "컴퓨터 오디오 연결 확인 필요")
                : audioState === "connecting" || audioRecoveryStatus === "attempting"
                  ? (hostMode ? "Connecting computer audio…" : "컴퓨터 오디오 연결 확인 중…")
                  : (hostMode ? "Join computer audio to speak and hear" : "서로 말하고 들으려면 컴퓨터 오디오를 연결하세요")}</strong>
            <small>{audioState === "muted"
              ? (hostMode ? "Unmute to let your student hear you." : "상대방이 내 목소리를 들으려면 음소거를 해제하세요.")
              : audioRecoveryStatus === "attempting"
                ? (hostMode ? "If Zoom opens a dialog, choose Join with Computer Audio." : "Zoom 창이 뜨면 ‘컴퓨터 오디오로 참가’를 반드시 눌러 주세요.")
                : (hostMode ? "A video connection does not connect audio automatically." : "강의실 입장과 소리 연결은 별개입니다. 연결 후 서로 소리가 들리는지 확인하세요.")}</small>
          </div>
          <button type="button" onClick={() => void audioAction()} disabled={audioBusy}>
            {audioState === "muted"
              ? (hostMode ? "Unmute microphone" : "마이크 음소거 해제")
              : (hostMode ? "Join computer audio" : "컴퓨터 오디오 연결")}
          </button>
        </div>
      )}
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