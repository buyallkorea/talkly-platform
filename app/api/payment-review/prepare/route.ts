import { consumeTossReviewRateLimit, requireTossReviewRequest, TOSS_REVIEWER_ID } from "@/lib/payments/toss-review-auth";
import { createSandboxOrder, TOSS_SANDBOX_AMOUNT } from "@/lib/payments/toss-sandbox-order";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const checked = requireTossReviewRequest(request);
  if ("response" in checked) return checked.response;
  const limitResponse = await consumeTossReviewRateLimit(request, checked.secretKey);
  if (limitResponse) return limitResponse;
  const orderId = createSandboxOrder(checked.secretKey, TOSS_REVIEWER_ID);
  const nonce = orderId.split("-")[2] || "guest";
  return Response.json({
    success: true,
    sandbox: true,
    orderId,
    orderName: "TALKLY 결제 심사용 가상 테스트",
    amount: TOSS_SANDBOX_AMOUNT,
    currency: "KRW",
    customerKey: "talkly-review-" + nonce,
  }, { headers: { "Cache-Control": "no-store" } });
}
