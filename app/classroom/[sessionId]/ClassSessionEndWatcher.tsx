"use client";

type Props = {
  sessionId: number;
};

/*
 * 수업 종료 감지는 ClassSessionControls로 통합되었습니다.
 *
 * 기존에는 이 컴포넌트와 ClassSessionControls가 각각
 * /api/classroom/session-status를 2초마다 호출하여
 * 동일한 상태 확인 요청이 중복 발생했습니다.
 *
 * 현재는 기존 page.tsx 구조를 안전하게 유지하기 위해
 * 컴포넌트 자체는 남겨두되 polling은 수행하지 않습니다.
 *
 * 다음 구조 정리 단계에서 page.tsx의 import/render도
 * 함께 제거할 수 있습니다.
 */
export default function ClassSessionEndWatcher({
  sessionId: _sessionId,
}: Props) {
  return null;
}