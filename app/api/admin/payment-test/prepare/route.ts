import { requireSandboxAdmin } from "@/lib/payments/toss-sandbox-auth";
import { createSandboxOrder, TOSS_SANDBOX_AMOUNT } from "@/lib/payments/toss-sandbox-order";

export async function POST(request: Request) {
  const checked = await requireSandboxAdmin(request);
  if ("response" in checked) return checked.response;
  const orderId = createSandboxOrder(checked.secretKey, checked.adminId);
  return Response.json({
    success: true,
    orderId,
    orderName: "TALKLY 토스페이먼츠 결제연동 테스트",
    amount: TOSS_SANDBOX_AMOUNT,
    currency: "KRW",
    customerKey: checked.adminId,
    sandbox: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
