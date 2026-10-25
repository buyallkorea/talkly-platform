"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Session = {
  id: string;
  name: string;
  state: string;
  started_at: string;
  deadline: string;
  entitlement: string;
};
export default function SessionOperations({
  sessions,
}: {
  sessions: Session[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("connection_issue");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const visible = sessions.filter((session) => !closed.has(session.id));
  async function stop(session: Session) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/admin/session-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, reason, confirm: true }),
        signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "종료 처리를 확인하지 못했어요.");
      setClosed((previous) => new Set([...previous, session.id]));
      setSelected(null);
      setMessage(
        result.alreadyClosed
          ? "이미 종료된 연결입니다."
          : result.auditRecorded
            ? "음성 연결 종료와 사용 시간 정산을 완료했습니다."
            : "연결 종료·정산은 완료했지만 이력 갱신을 확인하지 못했습니다. 처리 이력을 확인해 주세요.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name)
          ? "응답이 늦어 종료 결과를 확인하지 못했습니다. 현황을 새로고침한 뒤 다시 확인해 주세요."
          : error instanceof TypeError
            ? "서버 연결을 확인하지 못했습니다. 종료 여부는 현황을 새로고침해 확인해 주세요."
            : error instanceof Error
              ? error.message
              : "처리하지 못했습니다. 상태를 다시 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>진행 중·종료 확인이 필요한 연결</h2>
      <p>
        미종료 연결 중 오래된 순서로 최대 100건입니다. 화면은 자동 갱신되지
        않습니다.
      </p>
      <p>
        연결 정리는 학습자의 실제 회화를 종료합니다. 장애 확인 또는 회원 요청이
        있을 때만 사용해 주세요. 기존 정산 규칙으로 처리하며 사용 시간을 임의로
        초기화하지 않습니다.
      </p>
      <button disabled={busy} onClick={() => router.refresh()}>
        현황 새로고침
      </button>
      {!visible.length ? (
        <p>표시할 미종료 연결이 없습니다.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>회원</th>
                <th>상태</th>
                <th>이용 구분</th>
                <th>시작 · 한국시간</th>
                <th>예약 종료 · 한국시간</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((session) => (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>
                    {{
                      connecting: "연결 준비",
                      active: "회화 중",
                      closing: "종료 처리 중",
                    }[session.state] ?? session.state}
                  </td>
                  <td>
                    {session.entitlement === "trial"
                      ? "무료 체험"
                      : "일일 이용권"}
                  </td>
                  <td>
                    {new Date(session.started_at).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </td>
                  <td>
                    {new Date(session.deadline).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </td>
                  <td>
                    {selected === session.id ? (
                      <>
                        <label>
                          종료 사유{" "}
                          <select
                            disabled={busy}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          >
                            <option value="connection_issue">연결 장애</option>
                            <option value="member_request">
                              회원 종료 요청
                            </option>
                          </select>
                        </label>{" "}
                        <button disabled={busy} onClick={() => stop(session)}>
                          회화 종료 확인
                        </button>{" "}
                        <button
                          disabled={busy}
                          onClick={() => setSelected(null)}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(session.id);
                          setMessage("");
                        }}
                      >
                        연결 정리
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
