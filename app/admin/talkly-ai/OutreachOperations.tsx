"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export default function OutreachOperations({ enabled }: { enabled: boolean }) {
  const router = useRouter(),
    guard = useRef(false);
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function process() {
    if (!enabled || !confirmed || guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("대기열의 대상과 동의·연락처를 다시 확인하고 있습니다.");
    try {
      const response = await fetch("/api/talkly-ai/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
        signal: AbortSignal.timeout(185000),
      });
      const value = await response.json();
      if (!response.ok || value.success !== true)
        throw new Error(value.error || "처리 결과를 확인하지 못했습니다.");
      const r = value.result;
      if (r.status === "off")
        setMessage("실제 발송 스위치가 꺼져 있어 처리하지 않았습니다.");
      else if (r.status === "unconfigured")
        setMessage(
          "서비스 주소·운영 연락처·발신 설정이 준비되지 않아 처리하지 않았습니다.",
        );
      else if (r.status === "outside_hours")
        setMessage("한국시간 09–18시에만 안내를 처리합니다.");
      else
        setMessage(
          `발송업체 접수 ${r.accepted}건 · 실패 ${r.failed}건 · 결과 확인 필요 ${r.unknown}건 · 제외 ${r.skipped}건 · 준비 재시도 대기 ${r.deferred}건 · 기록 확인 필요 ${r.unrecorded}건. 접수는 전달 완료가 아닙니다.`,
        );
      setConfirmed(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !(error instanceof TypeError) &&
          !(error instanceof SyntaxError) &&
          !["TimeoutError", "AbortError"].includes(error.name)
          ? error.message
          : "처리 결과를 확인하지 못했습니다. 반복 실행보다 대기열 상태를 먼저 새로고침해 주세요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>대기 안내 수동 처리</h3>
      <p>
        자동 대상 등록·예약 발송은 아직 연결하지 않았습니다. 수동 처리는 서버
        스위치와 발신 설정이 준비된 경우에만 대기열에서 최대 3건을 처리합니다.
        발송 직전에 동의·재결제·연락처와 시간대를 다시 확인합니다.
      </p>
      {!enabled ? (
        <p>현재 실제 발송 OFF입니다. 고객 안내를 실행할 수 없습니다.</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              disabled={busy}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{" "}
            실제 고객 안내를 처리한다는 점을 확인했습니다.
          </label>
          <p>
            <button disabled={busy || !confirmed} onClick={process}>
              {busy ? "처리 결과 확인 중…" : "대기 안내 최대 3건 처리"}
            </button>
          </p>
        </>
      )}
      <button disabled={busy} onClick={() => router.refresh()}>
        대기열 새로고침
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
