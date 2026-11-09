"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Result = { success?: boolean; sandbox?: boolean; paymentMayBeApproved?: boolean;
  orderId?: string; amount?: number; status?: string; approvedAt?: string | null;
  method?: string | null; error?: string; code?: string | null };
type Display = { state: "loading" | "approved" | "failed" | "uncertain";
  message: string; orderId?: string; method?: string | null; approvedAt?: string | null };

export default function AdminTossTestResult() {
  const started = useRef(false);
  const [display, setDisplay] = useState<Display>({ state: "loading", message: "토스 테스트 결제 결과를 확인하고 있습니다." });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("outcome") === "fail") {
        setDisplay({ state: "failed", message: "토스 결제창에서 테스트 결제가 취소되거나 거절됐습니다. 결제수단 설정을 확인해 주세요." });
        return;
      }
      const paymentKey = params.get("paymentKey"), orderId = params.get("orderId");
      const amount = Number(params.get("amount"));
      if (params.get("outcome") !== "success" || !paymentKey || !orderId || !Number.isInteger(amount) || amount !== 1000) {
        setDisplay({ state: "failed", message: "테스트 결제 승인 정보가 누락되거나 금액이 일치하지 않습니다." });
        return;
      }
      try {
        const r = await fetch("/api/admin/payment-test/confirm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount }),
          signal: AbortSignal.timeout(22000),
        });
        const data = await r.json() as Result;
        if (!r.ok || !data.success || !data.sandbox || data.status !== "DONE" || data.orderId !== orderId || data.amount !== 1000) {
          setDisplay({ state: data.paymentMayBeApproved ? "uncertain" : "failed",
            message: data.error || "토스 결제 승인 확인에 실패했습니다." });
          return;
        }
        setDisplay({ state: "approved", message: "토스 테스트 결제 승인 완료(DONE). 실제 청구는 발생하지 않습니다.",
          orderId: data.orderId, method: data.method, approvedAt: data.approvedAt });
      } catch {
        setDisplay({ state: "uncertain", message: "승인 결과를 확인하지 못했습니다. 새 결제를 시도하기 전 토스 개발자센터에서 테스트 결제내역을 확인해주세요." });
      }
    }
    void confirm();
  }, []);

  return <div className="talkly-toss-test-page">
    <header className="talkly-toss-test-hero">
      <span>PAYMENT TEST · ADMIN ONLY</span>
      <h1>토스 테스트 결제 결과</h1>
      <p>실결제 및 수강등록과 분리된 결제 연동 점검 화면입니다.</p>
    </header>
    <section className="talkly-toss-test-panel">
      <div role="status" className={"talkly-toss-test-result is-" + display.state}>
        {display.state === "approved" ? "승인 성공 · DONE" :
         display.state === "loading" ? "결과 확인 중" :
         display.state === "uncertain" ? "상태 재확인 필요" : "결제 실패 / 취소"}
      </div>
      <p>{display.message}</p>
      {display.state === "approved" && <dl className="talkly-toss-test-receipt">
        <dt>구분</dt><dd>토스 테스트 가상결제</dd>
        <dt>금액</dt><dd>1,000원 (실제 출금 0원)</dd>
        <dt>결제 주문번호</dt><dd>{display.orderId}</dd>
        <dt>결제수단</dt><dd>{display.method || "토스 테스트 결제"}</dd>
        <dt>승인시각</dt><dd>{display.approvedAt || "-"}</dd>
      </dl>}
      <div className="talkly-toss-test-actions">
        <Link href="/admin/payment-test" className="talkly-toss-test-link">테스트 화면으로 돌아가기</Link>
        <a href="https://developers.tosspayments.com/" target="_blank" rel="noreferrer" className="talkly-toss-test-link">토스 개발자센터 테스트 결제내역 확인 ↗</a>
      </div>
      <p className="talkly-toss-test-notice">이 테스트에서는 TALKLY의 수강신청·결제내역·수업시간표 DB에 기록을 생성하거나 수정하지 않습니다. 실제 회원 결제부터 수강권 활성화까지는 별도 E2E 검증이 필요합니다.</p>
    </section>
  </div>;
}
