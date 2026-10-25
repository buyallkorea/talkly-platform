"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export default function AiPaymentSuccess() {
  const [message, setMessage] = useState("결제와 이용권을 확인 중이에요."),
    [retry, setRetry] = useState(0),
    [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    void fetch("/api/talkly-ai/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: params.get("orderId"),
        paymentKey: params.get("paymentKey"),
        amount: Number(params.get("amount")),
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!cancelled) {
          setDone(true);
          setMessage("30일 이용권이 반영됐어요. 영어 대화를 시작해 보세요.");
          history.replaceState(null, "", location.pathname);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setMessage(e.message || "결제 상태를 확인하지 못했어요.");
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: 25 }}>
      <h1>TALKLY AI 결제</h1>
      <p role="status">{message}</p>
      {!done && (
        <button onClick={() => setRetry((r) => r + 1)}>결제 다시 확인</button>
      )}
      <p>
        <Link href="/talkly-ai">AI 회화로 돌아가기</Link>
      </p>
    </main>
  );
}
