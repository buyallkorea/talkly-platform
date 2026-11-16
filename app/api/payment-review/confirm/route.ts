import { requireTossReviewRequest, TOSS_REVIEWER_ID } from "@/lib/payments/toss-review-auth";
import { TOSS_SANDBOX_AMOUNT, verifySandboxOrder } from "@/lib/payments/toss-sandbox-order";

export const runtime = "nodejs";
type TossPayment = {
  paymentKey?: string;
  orderId?: string;
  totalAmount?: number;
  status?: string;
  approvedAt?: string | null;
  method?: string | null;
  code?: string;
};
function verifiedPayment(data: TossPayment, orderId: string, paymentKey: string) {
  return data.status === "DONE" && data.orderId === orderId &&
    data.paymentKey === paymentKey && data.totalAmount === TOSS_SANDBOX_AMOUNT;
}
function approvedResult(payment: TossPayment, orderId: string) {
  return Response.json({
    success: true,
    sandbox: true,
    orderId,
    amount: TOSS_SANDBOX_AMOUNT,
    status: "DONE",
    method: payment.method ?? null,
    approvedAt: payment.approvedAt ?? null,
    note: "토스 테스트 키로 승인 완료. 실제 수강신청·실결제·수업 배정 데이터는 변경되지 않았습니다.",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const checked = requireTossReviewRequest(request);
  if ("response" in checked) return checked.response;
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "요청 정보가 너무 큽니다." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "결제 인증 정보가 올바르지 않습니다." }, { status: 400 });
  }
  const { paymentKey, orderId, amount } = body;
  if (typeof paymentKey !== "string" || paymentKey.length < 5 || paymentKey.length > 250 ||
    typeof orderId !== "string" || !verifySandboxOrder(checked.secretKey, TOSS_REVIEWER_ID, orderId) ||
    amount !== TOSS_SANDBOX_AMOUNT) {
    return Response.json({ error: "테스트 주문·결제금액이 일치하지 않습니다." }, { status: 400 });
  }
  const authorization = "Basic " + Buffer.from(checked.secretKey + ":").toString("base64");
  let response: Response;
  try {
    response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: TOSS_SANDBOX_AMOUNT }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return Response.json({ success: false, paymentMayBeApproved: true,
      error: "토스 승인 응답을 확인하지 못했습니다. 중복 결제 전에 토스 테스트 결제내역을 확인해 주세요." }, { status: 502 });
  }
  let result: TossPayment;
  try {
    result = await response.json() as TossPayment;
  } catch {
    return Response.json({ success: false, paymentMayBeApproved: true,
      error: "토스 승인 응답을 읽지 못했습니다. 테스트 내역을 먼저 확인해 주세요." }, { status: 502 });
  }
  if (!response.ok) {
    // Idempotent result view: an already approved test can be refreshed safely.
    try {
      const inspected = await fetch("https://api.tosspayments.com/v1/payments/" + encodeURIComponent(paymentKey), {
        headers: { Authorization: authorization },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });
      if (inspected.ok) {
        const confirmed = await inspected.json() as TossPayment;
        if (verifiedPayment(confirmed, orderId, paymentKey)) return approvedResult(confirmed, orderId);
      }
    } catch { /* show the original error, without attempting a second approval */ }
    return Response.json({ success: false,
      error: "토스 테스트 결제 승인이 실패했습니다. 테스트 키와 결제수단을 확인해 주세요.",
      code: typeof result.code === "string" ? result.code.slice(0, 70) : null,
    }, { status: 422 });
  }
  if (!verifiedPayment(result, orderId, paymentKey)) {
    return Response.json({ success: false, paymentMayBeApproved: true,
      error: "토스 승인 결과가 주문번호 또는 결제금액과 일치하지 않습니다." }, { status: 409 });
  }
  // Intentionally no enrollment_requests, enrollment_payments, classes or live orders write.
  return approvedResult(result, orderId);
}
