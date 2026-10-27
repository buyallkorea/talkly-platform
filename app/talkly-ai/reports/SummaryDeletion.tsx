"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type RecordItem = {
  session_id: string;
  day: string;
  status: string;
  created_at: string;
  label: string;
};
export default function SummaryDeletion({
  records,
}: {
  records: RecordItem[];
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState(20);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const visible = records.filter((row) => !hidden.has(row.session_id));
  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "삭제하지 못했어요.");
      setHidden((previous) => new Set([...previous, id]));
      setConfirm(null);
      setMessage("학습 요약을 삭제했어요. 리포트를 새로 불러옵니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "삭제 결과를 확인하지 못했어요. 다시 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tai-card">
      <h2>저장된 학습 요약 관리</h2>
      <p>
        삭제하면 해당 요약의 내용이 지워지고 리포트 집계에서 제외되며 복구할 수
        없어요. 같은 회화의 요약이 다시 생성되지 않도록 최소한의 처리 기록은
        기존 보관 기간까지 남깁니다.
      </p>
      <p>
        결제·이용 시간·월별 사용량과 마지막 대화 기억은 별도 기록입니다. 요약
        삭제로 이용 시간이 복구되지는 않아요.
      </p>
      {visible.length === 0 ? (
        <p>이달에 삭제할 학습 요약이 없어요.</p>
      ) : (
        <ul>
          {visible.slice(0, limit).map((record, index) => (
            <li key={record.session_id}>
              {record.day} · 기록 {index + 1} ·{" "}
              {new Date(record.created_at).toLocaleTimeString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              · {record.label || "학습 요약"} ·{" "}
              {record.status === "ready"
                ? "저장 완료"
                : record.status === "pending"
                  ? "생성 중"
                  : "생성 실패"}{" "}
              {confirm === record.session_id ? (
                <>
                  <span>이 요약을 삭제할까요? </span>
                  <button
                    disabled={busy}
                    onClick={() => remove(record.session_id)}
                  >
                    삭제 확인
                  </button>{" "}
                  <button disabled={busy} onClick={() => setConfirm(null)}>
                    취소
                  </button>
                </>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => setConfirm(record.session_id)}
                >
                  요약 삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {visible.length > limit && (
        <button disabled={busy} onClick={() => setLimit((value) => value + 20)}>
          20개 더 보기
        </button>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
