"use client";

import { useState } from "react";

type TossPaymentWindow = {
  on(eventName: "paymentRequest" | "cancel", callback: () => void | Promise<void>): void;
  destroy(): void | Promise<void>;
};
type TossWidgets = {
  setAmount(params: { value: number; currency: "KRW" }): Promise<void>;
  renderPaymentWindow(): Promise<TossPaymentWindow>;
  requestPayment(params: {
    orderId: string; orderName: string; successUrl: string; failUrl: string;
  }): Promise<void> | void;
};
type TossSDK = (clientKey: string) => { widgets(params: { customerKey: string }): TossWidgets };
function getSdk(): TossSDK | undefined {
  return (window as unknown as { TossPayments?: TossSDK }).TossPayments;
}

const SDK = "https://js.tosspayments.com/v2/standard";
async function loadSDK(): Promise<void> {
  if (getSdk()) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="' + SDK + '"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(Error("토스 SDK를 불러오지 못했습니다.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(Error("토스 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

type Prepared = {
  success?: boolean; error?: string; orderId?: string; orderName?: string;
  customerKey?: string; amount?: number; currency?: string; sandbox?: boolean;
};
export default function TossSandboxCheckout({ clientKey }: { clientKey: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true); setFailed(false); setMessage("테스트 주문을 생성하고 있습니다.");
    let paymentWindow: TossPaymentWindow | null = null;
    try {
      if (!clientKey.startsWith("test_gck_")) throw Error("테스트 전용 키가 아닙니다.");
      const response = await fetch("/api/admin/payment-test/prepare", { method: "POST" });
      const data = await response.json() as Prepared;
      if (!response.ok || data.success !== true || data.sandbox !== true ||
        !data.orderId || !data.orderName || !data.customerKey ||
        data.amount !== 1000 || data.currency !== "KRW") throw Error(data.error || "테스트 주문 생성 실패");
      setMessage("토스 테스트 결제창을 불러오고 있습니다.");
      await loadSDK();
      const sdk = getSdk();
      if (!sdk) throw Error("토스 결제 모듈 초기화 실패");
      const widgets = sdk(clientKey).widgets({ customerKey: data.customerKey });
      await widgets.setAmount({ value: data.amount, currency: "KRW" });
      paymentWindow = await widgets.renderPaymentWindow();
      const activeWindow = paymentWindow;
      activeWindow.on("cancel", async () => {
        setBusy(false);
        setMessage("결제창을 닫았습니다. 실제 결제나 수강등록은 발생하지 않았습니다.");
        try { await activeWindow.destroy(); } catch { /* already closed */ }
      });
      activeWindow.on("paymentRequest", async () => {
        try {
          const origin = window.location.origin;
          await widgets.requestPayment({
            orderId: data.orderId!,
            orderName: data.orderName!,
            successUrl: origin + "/admin/payment-test/result?outcome=success",
            failUrl: origin + "/admin/payment-test/result?outcome=fail",
          });
        } catch (error) {
          setFailed(true); setBusy(false);
          setMessage(error instanceof Error ? error.message : "결제 요청에 실패했습니다.");
          try { await activeWindow.destroy(); } catch { /* already closed */ }
        }
      });
      setMessage("가상 결제창이 열렸습니다. 테스트 결제를 진행하거나 취소할 수 있습니다.");
    } catch (error) {
      setBusy(false); setFailed(true);
      setMessage(error instanceof Error ? error.message : "토스 테스트 결제창 연결 실패");
      try { await paymentWindow?.destroy(); } catch { /* already closed */ }
    }
  }

  return <>
    <button type="button" className="talkly-toss-test-button" disabled={busy} onClick={() => void start()}>
      {busy ? "테스트 결제 진행 중…" : "가상 결제창 열기 · 1,000원"}
    </button>
    {message && <p role={failed ? "alert" : "status"} className={failed ? "talkly-toss-test-error" : "talkly-toss-test-feedback"}>{message}</p>}
  </>;
}
