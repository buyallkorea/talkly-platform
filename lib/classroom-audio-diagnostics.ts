/**
 * Explicit, user-initiated microphone check for the same-origin Zoom iframe.
 *
 * This is NOT an audio connection or a recording: the browser prompts for
 * microphone permission only when requested by the user, then every temporary
 * media track is stopped immediately. No audio is uploaded or stored.
 */
export type ClassroomMicrophoneCheck = {
  ok: boolean;
  message: string;
  problem?: "permission" | "device" | "browser" | "temporary";
};

export function explainClassroomMicrophoneError(error: unknown): ClassroomMicrophoneCheck {
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        ok: false, problem: "permission",
        message: "마이크 접근이 차단되었습니다. 주소창 왼쪽 사이트 설정에서 www.talkly.co.kr의 마이크를 허용한 뒤 강의실을 새로고침해 주세요. · Microphone blocked. Allow microphone for this site, then reload.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        ok: false, problem: "device",
        message: "연결된 마이크가 없습니다. 헤드셋·마이크 연결과 장치 설정을 확인해 주세요. · No microphone detected.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        ok: false, problem: "device",
        message: "다른 Zoom 탭 또는 프로그램이 마이크를 사용 중이거나 장치를 열 수 없습니다. 중복 강의실·회의·녹음 프로그램을 닫고 다시 시도해 주세요. · Microphone is busy or unavailable.",
      };
    case "OverconstrainedError":
      return {
        ok: false, problem: "device",
        message: "선택한 입력 장치를 사용할 수 없습니다. 브라우저의 마이크 장치를 다시 선택해 주세요. · Selected microphone unavailable.",
      };
    default:
      return {
        ok: false, problem: "temporary",
        message: "마이크를 확인하지 못했습니다. 사이트 권한·입력 장치·네트워크를 점검한 뒤 다시 시도해 주세요. · Microphone check failed.",
      };
  }
}

export async function checkClassroomMicrophone(): Promise<ClassroomMicrophoneCheck> {
  if (typeof window === "undefined" || !window.isSecureContext ||
      typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false, problem: "browser",
      message: "이 브라우저에서 안전한 마이크 접근을 지원하지 않습니다. 최신 Chrome/Edge에서 HTTPS 강의실을 여세요. · Open the secure classroom in current Chrome or Edge.",
    };
  }

  // Browser Permissions Policy may block microphones inside a nested iframe,
  // even when the outer page has already granted access.
  const withPolicy = document as Document & {
    permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
    featurePolicy?: { allowsFeature: (feature: string) => boolean };
  };
  const policy = withPolicy.permissionsPolicy ?? withPolicy.featurePolicy;
  if (policy && !policy.allowsFeature("microphone")) {
    return {
      ok: false, problem: "permission",
      message: "강의실 iframe에서 마이크가 차단돼 있습니다. 사이트 권한 및 iframe 마이크 허용 설정을 확인해 주세요. · Microphone blocked by iframe policy.",
    };
  }

  let stream: MediaStream | undefined;
  try {
    // A click initiates the browser permission prompt, never a background join.
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return {
      ok: true,
      message: "마이크 접근이 정상입니다. Zoom 아래 도구 모음에서 ‘Join Audio / 오디오 연결’을 눌러주세요. 계속 실패하면 다른 회의 탭을 닫고 네트워크 또는 Zoom 오디오 연결을 확인해 주세요. · Microphone works; connect computer audio in Zoom.",
    };
  } catch (error) {
    return explainClassroomMicrophoneError(error);
  } finally {
    // Never keep a capture running after the diagnostic.
    stream?.getTracks().forEach((track) => track.stop());
  }
}
