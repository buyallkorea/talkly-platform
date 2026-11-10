import { requireSandboxAdmin } from "@/lib/payments/toss-sandbox-auth";
import { TOSS_SANDBOX_AMOUNT, verifySandboxOrder } from "@/lib/payments/toss-sandbox-order";

export const runtime = "nodejs";
type TossResponse = {
  paymentKey?: string;
  orderId?: string;
  totalAmount?: number;
  status?: string;
  approvedAt?: string | null;
  method?: string | null;
  code?: string;
  message?: string;
};

export async function POST(request: Request) {
  const checked = await requireSandboxAdmin(request);
  if ("response" in checked) return checked.response;
  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    payload = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "결제 승인 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const { paymentKey, orderId, amount } = payload;
  if (typeof paymentKey !== "string" || paymentKey.length < 5 || paymentKey.length > 250 ||
      typeof orderId !== "string" || !verifySandboxOrder(checked.secretKey, checked.adminId, orderId) ||
      amount !== TOSS_SANDBOX_AMOUNT) {
    return Response.json({ error: "테스트 결제 주문, 금액 또는 세션을 확인할 수 없습니다." }, { status: 400 });
  }

  const authorization = Buffer.from(checked.secretKey + ":").toString("base64");
  let response: Response;
  try {
    response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: "Basic " + authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: TOSS_SANDBOX_AMOUNT }),
      cache: "no-store",
      signal: AbortSignal.timeout(16000),
    });
  } catch {
    return Response.json({
      success: false,
      paymentMayBeApproved: true,
      error: "토스 승인 요청의 결과를 확인하지 못했습니다. 테스트 결제내역을 먼저 확인하고 중복 요청하지 마세요.",
    }, { status: 502 });
  }
  let result: TossResponse;
  try { result = await response.json() as TossResponse; }
  catch {
    return Response.json({ success: false, paymentMayBeApproved: true,
      error: "토스 승인 응답을 확인하지 못했습니다. 토스 개발자센터의 테스트 결제내역을 확인해주세요." }, { status: 502 });
  }
  if (!response.ok) {
    return Response.json({
      success: false, code: typeof result.code === "string" ? result.code.slice(0, 70) : null,
      error: "토스 테스트 결제 승인이 실패했습니다. 카드 결제 절차, 키의 일치 여부 및 승인 제한시간을 확인해주세요.",
    }, { status: 422 });
  }
  if (result.status !== "DONE" || result.orderId !== orderId ||
      result.paymentKey !== paymentKey || result.totalAmount !== TOSS_SANDBOX_AMOUNT) {
    return Response.json({ success: false, paymentMayBeApproved: true,
      error: "토스의 승인 응답이 주문 정보와 일치하지 않습니다. 결제내역을 확인해주세요." }, { status: 409 });
  }

  // Gateway-only sandbox transaction: deliberately no enrollment_payments,
  // enrollments, schedules or class_sessions insert/update.
  return Response.json({
    success: true,
    sandbox: true,
    orderId,
    amount: TOSS_SANDBOX_AMOUNT,
    status: "DONE",
    approvedAt: result.approvedAt ?? null,
    method: result.method ?? null,
    note: "테스트 모드 승인 확인. 실제 청구 및 TALKLY 수강등록은 발생하지 않습니다.",
  }, { headers: { "Cache-Control": "no-store" } });
}
