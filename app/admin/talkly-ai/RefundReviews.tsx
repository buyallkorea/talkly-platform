"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { REFUND_REASONS, REFUND_STATES } from "@/lib/talkly-ai/refunds";
type Row = {
  id: string;
  user_id: string;
  payment_id: string;
  reason: string;
  state: string;
  revision: number;
  created_at: string;
  name: string;
  orderId: string | null;
  amount: number | null;
  paymentStatus: string | null;
  approvedAt: string | null;
  validUntil: string | null;
};
const paymentLabels: Record<string, string> = {
  ready: "결제 대기",
  confirming: "승인 확인 중",
  paid: "승인 완료",
  failed: "승인 실패·만료",
  cancelled: "취소됨",
};
const date = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "확인 필요";
export default function RefundReviews({ rows }: { rows: Row[] }) {
  const router = useRouter(),
    guard = useRef(false),
    pendingAudit = useRef<Record<string, { eventKey: string; eventType: string; note: string }>>({});
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [auditNotes, setAuditNotes] = useState<Record<string, string>>({}),
    [auditTypes, setAuditTypes] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [stateFilter, setStateFilter] = useState("all");
  const filtered = rows.filter((row) => {
    const term = search.trim().toLocaleLowerCase();
    return (stateFilter === "all" || row.state === stateFilter) &&
      (!term || [row.name, row.orderId ?? "", row.id].some((value) => value.toLocaleLowerCase().includes(term)));
  });
  async function update(row: Row) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: row.id,
          revision: row.revision,
          state: row.state === "reviewing" ? "awaiting_action" : "reviewing",
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (response.status === 409) throw new Error("다른 관리자가 먼저 처리했거나 상태가 변경됐습니다. 새로고침 후 다시 확인해 주세요.");
      if (response.status === 403) throw new Error("관리자 권한이 없어 저장할 수 없습니다.");
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "검토 상태를 저장하지 못했습니다.");
      setMessage(
        "검토 이력을 저장했습니다. 실제 환불·이용권 변경은 수행하지 않았습니다.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !["AbortError", "TimeoutError"].includes(error.name)
          ? error.message
          : "처리 결과를 확인하지 못했습니다. 새로고침 후 상태를 확인해 주세요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function recordAudit(row: Row) {
    if (guard.current) return;
    const note = (auditNotes[row.id] ?? "").trim();
    if (!note || note.length > 1000) {
      setMessage("정산 검토 내용을 1~1000자로 입력해 주세요.");
      return;
    }
    guard.current = true;
    setBusy(true);
    setMessage("");
    const entry = pendingAudit.current[row.id] ?? {
      eventKey: crypto.randomUUID(),
      eventType: auditTypes[row.id] ?? "entitlement_reviewed",
      note,
    };
    pendingAudit.current[row.id] = entry;
    try {
      const response = await fetch("/api/talkly-ai/admin/refund-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: row.id,
          eventKey: entry.eventKey,
          eventType: entry.eventType,
          note: entry.note,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (response.status === 403) throw new Error("관리자 권한이 없어 기록을 저장할 수 없습니다.");
      if (response.status === 409) throw new Error("중복 처리키가 다른 내용과 충돌했거나 요청을 찾을 수 없습니다. 기록을 확인해 주세요.");
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "정산 검토 이력을 저장하지 못했습니다.");
      delete pendingAudit.current[row.id];
      setAuditNotes((current) => ({ ...current, [row.id]: "" }));
      setMessage("정산 검토 이력을 저장했습니다. 실제 환불이나 이용권 변경은 하지 않았습니다.");
      router.refresh();
    } catch (error) {
      setMessage("저장 결과가 불확실합니다. 입력 내용을 바꾸지 않고 ‘정산 검토 이력 저장’을 다시 누르면 동일 처리키로 재확인합니다. " + (error instanceof Error ? error.message : ""));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>환불 요청 검토 · 최근 100건</h2>
      <p>
        접수·검토 이력만 관리합니다. 추가 처리 대기는 환불 승인·완료가 아닙니다.
        금액 결정, 토스 취소, 이용권 조정은 연결 전입니다.
      </p>
      <button disabled={busy} onClick={() => router.refresh()}>
        접수 현황 새로고침
      </button>
      <div>
        <label htmlFor="refund-search">회원·주문번호·접수번호 검색</label>
        <input id="refund-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="현재 조회한 최근 100건에서 검색" />
        <label htmlFor="refund-state">처리 상태</label>
        <select id="refund-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">전체</option>
          <option value="requested">접수</option>
          <option value="reviewing">검토 중</option>
          <option value="awaiting_action">추가 처리 대기</option>
        </select>
        <p>현재 조회한 {rows.length}건 중 {filtered.length}건 표시 · 전체 환불 건수 검색은 아닙니다.</p>
      </div>
      {!rows.length ? (
        <p>접수된 요청이 없습니다.</p>
      ) : (
        filtered.length === 0 ? <p>검색 조건에 맞는 환불 요청이 없습니다.</p> : filtered.map((row) => (
          <article key={row.id}>
            <p>
              회원 {row.name} · 주문 {row.orderId ?? "상세 조회 필요"}
            </p>
            <p>
              결제 금액:{" "}
              {row.amount === null
                ? "확인 필요"
                : `${row.amount.toLocaleString()}원`}{" "}
              ·{" "}
              {row.paymentStatus
                ? (paymentLabels[row.paymentStatus] ?? "상태 확인 필요")
                : "결제 상태 확인 필요"}
            </p>
            <p>
              승인: {date(row.approvedAt)} · 이 주문의 이용권 반영 만료:{" "}
              {date(row.validUntil)}
            </p>
            <details>
              <summary>요청·회원 식별 정보</summary>
              <p>
                접수 {row.id} · 회원 {row.user_id} · 결제 기록 {row.payment_id}
              </p>
            </details>
            {!row.orderId && (
              <p>
                결제 상세를 확인하지 못했습니다. 현황을 새로고침한 뒤 검토해
                주세요.
              </p>
            )}
            <p>
              {REFUND_REASONS[row.reason]} · {REFUND_STATES[row.state]} · 접수{" "}
              {new Date(row.created_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </p>
            <div>
              <label htmlFor={`refund-audit-type-${row.id}`}>정산 검토 기록 유형</label>
              <select
                id={`refund-audit-type-${row.id}`}
                value={auditTypes[row.id] ?? "entitlement_reviewed"}
                disabled={busy || !!pendingAudit.current[row.id]}
                onChange={(e) => setAuditTypes((current) => ({ ...current, [row.id]: e.target.value }))}
              >
                <option value="provider_checked">Toss 결제 확인</option>
                <option value="entitlement_reviewed">이용권 정산 검토</option>
                <option value="manual_action_required">수동 조치 필요</option>
              </select>
              <label htmlFor={`refund-audit-note-${row.id}`}>정산 검토 메모</label>
              <textarea
                id={`refund-audit-note-${row.id}`}
                maxLength={1000}
                value={auditNotes[row.id] ?? ""}
                disabled={busy || !!pendingAudit.current[row.id]}
                onChange={(e) => setAuditNotes((current) => ({ ...current, [row.id]: e.target.value }))}
                placeholder="확인한 사실과 후속 조치만 기록하세요. 결제키나 개인정보를 입력하지 마세요."
              />
              <button disabled={busy || !(auditNotes[row.id] ?? "").trim()} onClick={() => recordAudit(row)}>
                정산 검토 이력 저장
              </button>
            </div>
            <button disabled={busy || !row.orderId} onClick={() => update(row)}>
              {row.state === "reviewing"
                ? "검토 기록 후 추가 처리 대기로"
                : "검토 시작·다시 열기"}
            </button>
          </article>
        ))
      )}
      <p role="status">{message}</p>
    </section>
  );
}
