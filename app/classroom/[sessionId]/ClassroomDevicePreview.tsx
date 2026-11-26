"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Local device preflight before the teacher opens the Zoom meeting.
 * This does NOT join Zoom, send video to another participant, or alter class time.
 * Tracks are stopped when Zoom begins joining or the preflight unmounts.
 */
export default function ClassroomDevicePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestGeneration = useRef(0);
  const [camera, setCamera] = useState<"idle" | "opening" | "ready" | "error">("idle");
  const [mic, setMic] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [micError, setMicError] = useState("");

  function stopCamera() {
    requestGeneration.current += 1;
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCamera("idle");
  }

  useEffect(() => {
    return () => {
      requestGeneration.current += 1;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("현재 브라우저에서 카메라 미리보기를 지원하지 않습니다.");
      setCamera("error");
      return;
    }
    const generation = ++requestGeneration.current;
    setCameraError("");
    setCamera("opening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (generation !== requestGeneration.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setCamera("ready");
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setCamera("error");
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "주소창의 카메라 권한을 허용한 뒤 다시 눌러 주세요."
        : name === "NotFoundError"
          ? "사용 가능한 카메라가 없습니다. 노트북의 카메라 연결을 확인해 주세요."
          : "카메라를 열 수 없습니다. 다른 앱에서 사용 중인지 확인해 주세요.");
    }
  }

  async function testMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMic("error");
      setMicError("마이크 확인을 지원하지 않는 브라우저입니다.");
      return;
    }
    setMic("checking");
    setMicError("");
    try {
      // This is only a permission/device availability check, not Zoom audio.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(track => track.stop());
      setMic("ready");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setMic("error");
      setMicError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "주소창에서 마이크 사용을 허용해 주세요."
        : "마이크를 확인할 수 없습니다. 연결과 권한을 확인해 주세요.");
    }
  }

  return (
    <section className="talkly-preclass-preview" aria-label="수업 전 영상 준비">
      <div className="talkly-preclass-video">
        <video ref={videoRef} autoPlay playsInline muted aria-label="본인 카메라 미리보기"
          style={{ display: camera === "ready" ? "block" : "none" }} />
        {camera !== "ready" && <span>본인 카메라 미리보기</span>}
      </div>
      <div className="talkly-preclass-actions">
        {camera === "ready" ? (
          <button type="button" onClick={stopCamera}>카메라 끄기</button>
        ) : (
          <button type="button" onClick={() => void openCamera()} disabled={camera === "opening"}>
            {camera === "opening" ? "카메라 연결 중…" : "내 카메라 확인"}
          </button>
        )}
        <button type="button" onClick={() => void testMicrophone()} disabled={mic === "checking"}>
          {mic === "checking" ? "마이크 확인 중…" : "마이크 확인"}
        </button>
      </div>
      {mic === "ready" && <small role="status">마이크 장치 사용 가능 · Zoom 입장 후 오디오 참가가 필요합니다.</small>}
      {cameraError && <small role="alert">{cameraError}</small>}
      {micError && <small role="alert">{micError}</small>}
      <p>강사가 Zoom 회의를 시작하면 자동으로 연결을 다시 시도합니다. 수업 시작 전 미리보기는 상대방에게 전송되지 않습니다.</p>
    </section>
  );
}
