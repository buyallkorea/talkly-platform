"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function SummaryConsent() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <section className="tai-card">
      <h2>월간 학습 기록 시작하기</h2>
      <p>
        동의한 이후의 회화에서 학습 주제·연습 표현·교정 요약을 저장합니다.
        원음과 전체 대화는 추가 저장하지 않으며, 기존의 마지막 대화 20개 발언
        기억은 유지됩니다. 요약 생성에는 OpenAI를 이용합니다.
      </p>
      <p>
        개인적인 이야기 대신 영어 학습에 필요한 내용을 남깁니다. 현재 개발 검증
        단계이며, 정식 서비스 전 보유기간과 삭제 절차를 확정합니다.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/talkly-ai/reports/consent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ consent: true }),
            });
            if (!r.ok)
              throw new Error("저장하지 못했어요. 다시 시도해 주세요.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "저장 실패");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "저장 중…" : "학습 요약 저장에 동의하고 시작"}
      </button>
      <p role="status">{error}</p>
    </section>
  );
}
