import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
import { refundInput } from "@/lib/talkly-ai/refunds";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const value = await body(request);
    if (!refundInput(value))
      throw new AiError("주문과 사유, 신청 안내 확인 여부를 확인해 주세요.");
    // Account suspension/expired learning consent must not block payment support.
    const { data, error } = await db.rpc("ai_request_refund", {
      p_user: user.id,
      p_order: value.orderId,
      p_reason: value.reason,
    });
    if (error || !data)
      throw new AiError(
        "접수를 확인하지 못했어요. 본인 결제 완료 주문인지 확인한 뒤 다시 시도해 주세요.",
        409,
      );
    return Response.json(
      { success: true, requestId: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
