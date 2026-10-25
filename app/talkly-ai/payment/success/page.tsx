"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export default function AiPaymentSuccess() {
  const [message, setMessage] = useState("결제와 이용권을 확인 중이에요."),
    [retry, setRetry] = useState(0),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(true),
    [retryAllowed, setRetryAllowed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    const params = new URLSearchParams(location.search);
    if (
      !params.get("orderId") ||
      !params.get("paymentKey") ||
      !params.get("amount")
    ) {
      setMessage(
        "결제 확인 정보를 찾지 못했어요. 이용권·결제 내역에서 상태를 확인해 주세요.",
      );
      setBusy(false);
      setRetryAllowed(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 50000);
    setBusy(true);
    setRetryAllowed(true);
    setMessage("기존 주문의 결제와 이용권을 확인 중이에요.");
    void fetch("/api/talkly-ai/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: params.get("orderId"),
        paymentKey: params.get("paymentKey"),
        amount: Number(params.get("amount")),
      }),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.success !== true)
          throw new Error(d.error || "결제 상태를 확인하지 못했어요.");
        if (!cancelled) {
          setDone(true);
          setMessage(
            d.alreadyActivated
              ? "이미 이용권에 반영된 결제입니다. 이용권·결제 내역에서 현재 유효기간을 확인해 주세요."
              : "30일 이용권이 반영됐어요. 영어 대화를 시작해 보세요.",
          );
          history.replaceState(null, "", location.pathname);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setMessage(
            timedOut
              ? "결제 확인이 지연되고 있어요. 중복 구매 대신 아래 버튼으로 같은 주문을 다시 확인해 주세요."
              : e instanceof TypeError || e instanceof SyntaxError
                ? "결제 상태를 확인하지 못했어요. 중복 구매 대신 같은 주문을 다시 확인해 주세요."
                : e.message || "결제 상태를 확인하지 못했어요.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [retry]);
  return (
    <main className="tai tai-info">
      <h1>TALKLY AI 결제</h1>
      <p role="status">{message}</p>
      {!done && retryAllowed && (
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRetry((r) => r + 1);
          }}
        >
          {busy ? "결제 확인 중…" : "같은 주문 다시 확인"}
        </button>
      )}
      <p>
        <Link href="/talkly-ai">이용권·결제 내역으로</Link>
      </p>
    </main>
  );
}
