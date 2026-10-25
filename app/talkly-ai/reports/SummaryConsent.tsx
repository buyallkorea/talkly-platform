"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function SummaryConsent({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function changeConsent() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/talkly-ai/reports/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: !enabled }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok)
        throw new Error("설정을 저장하지 못했어요. 다시 시도해 주세요.");
      setMessage(
        enabled
          ? "새 학습 요약 저장을 껐어요."
          : "다음 회화부터 학습 요약을 저장해요.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tai-card">
      <h2>{enabled ? "학습 요약 저장 중" : "월간 학습 기록 시작하기"}</h2>
      <p>
        동의한 이후의 회화에서 학습 주제·연습 표현·교정 요약을 저장합니다.
        원음과 전체 대화는 추가 저장하지 않으며, 기존의 마지막 대화 20개 발언
        기억은 유지됩니다. 요약 생성에는 OpenAI를 이용합니다.
      </p>
      <p>
        {enabled
          ? "언제든 새 요약 저장을 끌 수 있어요. 이미 저장된 요약과 사용량은 유지됩니다. 끄기 전에 분석을 시작한 내용도 저장 시점에 동의가 없으면 추가 보관하지 않습니다."
          : "개인적인 이야기 대신 영어 학습에 필요한 내용을 남깁니다. 다시 켜면 그 이후 시작한 회화부터 기록해요."}
      </p>
      <p>
        현재 개발 검증 단계이며, 정식 서비스 전 보유기간과 기존 기록 삭제 절차를
        확정합니다.
      </p>
      <button disabled={busy} onClick={changeConsent}>
        {busy
          ? "설정 저장 중…"
          : enabled
            ? "새 학습 요약 저장 끄기"
            : "학습 요약 저장에 동의하고 시작"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
