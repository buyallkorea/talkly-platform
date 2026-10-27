import { PLAN } from "@/lib/talkly-ai/config";
import {
  body,
  context,
  failure,
  requireMember,
  AiError,
} from "@/lib/talkly-ai/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    await requireMember(db, user.id);
    const data = await body(request);
    const lookupOnly = data.lookupOnly === true;
    if (data.lookupOnly !== undefined && typeof data.lookupOnly !== "boolean")
      throw new AiError("결제 확인 방식을 확인해 주세요.");
    // Existing approved payments may be recovered while new checkout is OFF.
    if (!lookupOnly && process.env.TALKLY_AI_PAYMENTS_ENABLED !== "true")
      throw new AiError("결제 준비 중이에요.", 503);
    if (
      typeof data.orderId !== "string" ||
      !/^[A-Za-z0-9_-]{6,64}$/.test(data.orderId) ||
      (!lookupOnly &&
        (typeof data.paymentKey !== "string" ||
          !data.paymentKey.trim() ||
          data.paymentKey.length > 200)) ||
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
    if (order.amount !== PLAN.amount)
      throw new AiError("결제 금액이 일치하지 않습니다.", 409);
    const paymentKey = lookupOnly ? order.payment_key : data.paymentKey;
    if (
      typeof paymentKey !== "string" ||
      !paymentKey.trim() ||
      paymentKey.length > 200
    )
      throw new AiError(
        "저장된 결제 확인 정보를 찾지 못했어요. 기존 결제 화면의 정보를 확인해 주세요.",
        409,
      );
    if (order.payment_key && order.payment_key !== paymentKey)
      throw new AiError("결제 정보가 일치하지 않습니다.", 409);
    if (order.status === "paid") {
      if (
        order.payment_key !== paymentKey ||
        !order.activated_until ||
        !Number.isFinite(Date.parse(order.activated_until))
      )
        throw new AiError(
          "이용권 반영을 확인 중이에요. 잠시 후 다시 확인해 주세요.",
          503,
        );
      return Response.json(
        {
          success: true,
          alreadyActivated: true,
          validUntil: order.activated_until,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (order.status === "cancelled")
      throw new AiError("취소된 주문입니다.", 409);
    if (!process.env.TOSS_SECRET_KEY)
      throw new AiError("결제 설정을 확인해 주세요.", 503);
    // Claim exactly one payment key for this order before the external call.
    if (!order.payment_key) {
      const { data: claimed, error: claimError } = await db
        .from("ai_payments")
        .update({ payment_key: paymentKey, status: "confirming" })
        .eq("id", order.id)
        .is("payment_key", null)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed)
        throw new AiError(
          "결제를 확인 중이에요. 잠시 후 다시 확인해 주세요.",
          409,
        );
    } else if (order.payment_key !== paymentKey)
      throw new AiError("결제 정보가 일치하지 않습니다.", 409);
    const headers = {
      Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": order.id,
    };
    // A retry may follow a network timeout after approval: retrieve first.
    let payment;
    const lookup = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
      { headers, signal: AbortSignal.timeout(15000), cache: "no-store" },
    );
    if (lookup.ok) payment = await lookup.json();
    else if (lookup.status !== 404)
      throw new AiError(
        "결제 상태를 조회하지 못했어요. 새로 구매하지 말고 이 화면에서 다시 확인해 주세요.",
        502,
      );
    if (
      !payment ||
      payment.status === "READY" ||
      payment.status === "IN_PROGRESS"
    ) {
      if (lookupOnly)
        throw new AiError(
          "아직 승인된 결제를 확인하지 못했어요. 기존 결제 화면에서 진행 상태를 확인해 주세요.",
          409,
        );
      const response = await fetch(
        "https://api.tosspayments.com/v1/payments/confirm",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            paymentKey,
            orderId: order.order_id,
            amount: order.amount,
          }),
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new AiError(
          "결제 승인을 확인하지 못했어요. 다시 확인해 주세요.",
          502,
        );
      payment = await response.json();
    }
    // Resolve only verified, never-approved failures. Cancellation/refund of an
    // approved purchase requires its separate entitlement reconciliation flow.
    if (
      ["ABORTED", "EXPIRED"].includes(payment?.status) &&
      payment.approvedAt === null &&
      payment.orderId === order.order_id &&
      payment.paymentKey === paymentKey &&
      payment.totalAmount === order.amount &&
      payment.currency === "KRW"
    ) {
      const { data: failedOrder, error: failedError } = await db
        .from("ai_payments")
        .update({ status: "failed" })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .eq("payment_key", paymentKey)
        .in("status", ["ready", "confirming", "failed"])
        .is("approved_at", null)
        .is("activated_until", null)
        .select("id")
        .maybeSingle();
      if (failedError || !failedOrder)
        throw new AiError(
          "주문 상태가 변경되어 종료 여부를 확인하지 못했어요. 내역을 다시 확인해 주세요.",
          409,
        );
      return Response.json(
        {
          success: false,
          terminal: true,
          error:
            "이 주문은 결제 승인 실패 또는 유효시간 만료로 종료됐어요. 이용권은 추가되지 않았어요.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      payment.status !== "DONE" ||
      payment.orderId !== order.order_id ||
      payment.paymentKey !== paymentKey ||
      payment.totalAmount !== order.amount ||
      payment.currency !== "KRW" ||
      typeof payment.approvedAt !== "string" ||
      !Number.isFinite(Date.parse(payment.approvedAt))
    )
      throw new AiError("결제 완료 상태와 금액을 확인하지 못했어요.", 409);
    const { data: validUntil, error: activationError } = await db.rpc(
      "ai_activate",
      {
        p_user: user.id,
        p_order: order.order_id,
        p_key: paymentKey,
        p_approved: payment.approvedAt,
      },
    );
    if (
      activationError ||
      typeof validUntil !== "string" ||
      !Number.isFinite(Date.parse(validUntil))
    )
      throw new AiError(
        "결제는 승인되었으나 이용권 반영을 확인 중이에요. 이 화면에서 다시 확인해 주세요.",
        503,
      );
    return Response.json(
      { success: true, validUntil },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
