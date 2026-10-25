import { PLAN } from "@/lib/talkly-ai/config";
import {
  body,
  context,
  failure,
  requireMember,
  AiError,
} from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    await requireMember(db, user.id);
    if (process.env.TALKLY_AI_PAYMENTS_ENABLED !== "true")
      throw new AiError("결제 준비 중이에요.", 503);
    const data = await body(request);
    if (
      typeof data.orderId !== "string" ||
      typeof data.paymentKey !== "string" ||
      data.paymentKey.length > 300 ||
      data.amount !== PLAN.amount
    )
      throw new AiError("결제 정보를 확인해 주세요.");
    const { data: order, error } = await db
      .from("ai_payments")
      .select("*")
      .eq("order_id", data.orderId)
      .eq("user_id", user.id)
      .single();
    if (error || !order) throw new AiError("주문을 찾을 수 없어요.", 404);
    if (order.status === "paid")
      return Response.json({
        success: true,
        validUntil: order.activated_until,
      });
    if (order.status === "cancelled")
      throw new AiError("취소된 주문입니다.", 409);
    if (order.amount !== PLAN.amount)
      throw new AiError("결제 금액이 일치하지 않습니다.", 409);
    if (!process.env.TOSS_SECRET_KEY)
      throw new AiError("결제 설정을 확인해 주세요.", 503);
    // Claim exactly one payment key for this order before the external call.
    if (!order.payment_key) {
      const { data: claimed, error: claimError } = await db
        .from("ai_payments")
        .update({ payment_key: data.paymentKey, status: "confirming" })
        .eq("id", order.id)
        .is("payment_key", null)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed)
        throw new AiError(
          "결제를 확인 중이에요. 잠시 후 다시 확인해 주세요.",
          409,
        );
    } else if (order.payment_key !== data.paymentKey)
      throw new AiError("결제 정보가 일치하지 않습니다.", 409);
    const headers = {
      Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": order.id,
    };
    // A retry may follow a network timeout after approval: retrieve first.
    let payment;
    const lookup = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(data.paymentKey)}`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (lookup.ok) payment = await lookup.json();
    if (
      !payment ||
      payment.status === "READY" ||
      payment.status === "IN_PROGRESS"
    ) {
      const response = await fetch(
        "https://api.tosspayments.com/v1/payments/confirm",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            paymentKey: data.paymentKey,
            orderId: order.order_id,
            amount: order.amount,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw new AiError(
          "결제 승인을 확인하지 못했어요. 다시 확인해 주세요.",
          502,
        );
      payment = await response.json();
    }
    if (
      payment.status !== "DONE" ||
      payment.orderId !== order.order_id ||
      payment.paymentKey !== data.paymentKey ||
      payment.totalAmount !== order.amount ||
      payment.currency !== "KRW"
    )
      throw new AiError("결제 완료 상태와 금액을 확인하지 못했어요.", 409);
    const { data: validUntil, error: activationError } = await db.rpc(
      "ai_activate",
      {
        p_user: user.id,
        p_order: order.order_id,
        p_key: data.paymentKey,
        p_approved: payment.approvedAt,
      },
    );
    if (activationError)
      throw new AiError(
        "결제는 승인되었으나 이용권 반영을 확인 중이에요. 이 화면에서 다시 확인해 주세요.",
        503,
      );
    return Response.json({ success: true, validUntil });
  } catch (e) {
    return failure(e);
  }
}
