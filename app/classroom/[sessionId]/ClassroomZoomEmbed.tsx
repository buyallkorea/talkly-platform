"use client";

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
          customize?: Record<string, unknown>;
        }) => Promise<unknown>;

        join: (options: {
          signature: string;
          meetingNumber: string;
          password: string;
          userName: string;
          zak?: string;
        }) => Promise<unknown>;
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
  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const runningRef =
    useRef(false);

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
      "Zoom Meeting SDK 준비 중..."
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

  const startZoom =
    useCallback(async () => {
      if (
        runningRef.current
      ) {
        return;
      }

      runningRef.current =
        true;

      try {
        setScreen(
          "loading"
        );

        setErrorMessage(
          ""
        );

        setStatus(
          hostMode
            ? "Zoom 호스트 인증을 준비하는 중..."
            : "Zoom SDK를 불러오는 중..."
        );

        for (
          const src of
          SCRIPTS
        ) {
          await loadScript(
            src
          );
        }

        if (
          !window.ZoomMtgEmbedded ||
          !rootRef.current
        ) {
          throw new Error(
            "Zoom Meeting SDK를 초기화할 수 없습니다."
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
            "Zoom 호스트 권한을 확인하는 중..."
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
                : "Zoom 호스트 인증정보를 발급받지 못했습니다."
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
            "TALKLY 인증을 확인하는 중..."
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
                : "Meeting SDK 서명을 발급받지 못했습니다."
            );
          }

          signature =
            signatureData.signature;
        }

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

        setStatus(
          hostMode
            ? "Zoom 수업을 시작하는 중..."
            : "Zoom 수업실을 여는 중..."
        );

        const rootWidth =
          Math.max(
            160,
            Math.floor(
              rootRef.current.clientWidth || 420
            )
          );

        const rootHeight =
          Math.max(
            120,
            Math.floor(
              rootRef.current.clientHeight || 430
            )
          );

        await client.init({
          zoomAppRoot:
            rootRef.current,

          language:
            "ko-KR",

          patchJsMedia:
            true,

          customize: {
            video: {
              isResizable:
                true,

              viewSizes: {
                default: {
                  width: rootWidth,
                  height: rootHeight,
                },

                ribbon: {
                  width: rootWidth,
                  height: Math.max(
                    80,
                    Math.min(
                      120,
                      Math.round(
                        rootHeight * 0.28
                      )
                    )
                  ),
                },
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

        setStatus(
          hostMode
            ? "Zoom 호스트로 입장하는 중..."
            : "Zoom 수업에 입장하는 중..."
        );

        /*
         * =====================================================
         * Zoom Meeting 입장
         * =====================================================
         */
        await client.join({
          signature,
          meetingNumber,
          password,
          userName,
          ...(zak
            ? { zak }
            : {}),
        });

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
        runningRef.current =
          false;
      }
    }, [
      sessionId,
      meetingNumber,
      password,
      userName,
      hostMode,
      attempt,
    ]);

  useEffect(() => {
    startZoom();
  }, [startZoom]);

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

  const showOverlay =
    screen ===
      "loading" ||
    screen ===
      "waiting" ||
    screen ===
      "error";

  return (
    <div
      style={{
        position:
          "relative",

        height:
          "100%",

        minHeight:
          0,

        width:
          "100%",

        background:
          "#111216",

        overflow:
          "hidden",
      }}
    >
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
                {status}
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
              >
                수업 시작 전입니다
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
                    "15px",
                }}
              >
                아직 Zoom 수업이 시작되지 않았습니다.
                <br />
                강사가 수업을 시작한 후 아래 버튼을 눌러 입장해 주세요.
              </p>

              <button
                type="button"
                onClick={
                  retryZoom
                }
                style={
                  primaryButton
                }
              >
                Zoom 수업 입장 다시 시도
              </button>
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
                  ? "Zoom 호스트 연결 오류"
                  : "Zoom 연결 오류"}
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
                  ? "Zoom 수업을 호스트로 시작하지 못했습니다."
                  : "Zoom 수업실에 연결하지 못했습니다."}
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
                  {errorMessage}
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
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={
          rootRef
        }
        id="meetingSDKElement"
        style={{
          width:
            "100%",

          height:
            "100%",

          minHeight:
            0,
        }}
      />
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