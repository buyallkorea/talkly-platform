"use client";
import { useRef, useState } from "react";
export default function MemoryDeletion() {
  const guard = useRef(false);
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function clear() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "삭제 결과를 확인하지 못했어요.");
      setConfirming(false);
      setMessage("이전 대화 기억을 지웠어요. 다음 회화부터 새로 시작해요.");
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !["AbortError", "TimeoutError"].includes(error.name)
          ? error.message
          : "삭제 결과를 확인하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="tai-card">
      <h2>이전 대화 기억 지우기</h2>
      <p>
        다음 회화에 이어 쓰는 마지막 대화 텍스트를 지워요. 이미 진행 중인
        회화에는 적용되지 않아요. 현재 회화를 끝내고 사용해 주세요. 이후 새로
        시작한 회화는 다시 기억할 수 있어요.
      </p>
      <p>
        저장된 학습 요약, 결제, 이용 시간은 유지돼요. 학습 요약은 아래에서 따로
        삭제할 수 있어요.
      </p>
      {confirming ? (
        <>
          <p>이전 대화 기억을 지울까요? 지운 내용은 복구할 수 없어요.</p>
          <button disabled={busy} onClick={clear}>
            {busy ? "삭제 확인 중…" : "대화 기억 삭제 확인"}
          </button>
          <button disabled={busy} onClick={() => setConfirming(false)}>
            취소
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            setConfirming(true);
            setMessage("");
          }}
        >
          이전 대화 기억 지우기
        </button>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
