import { AiError, context, failure } from "@/lib/talkly-ai/server";
export const runtime = "nodejs";
export const maxDuration = 35;

// Read-only provider reconciliation for a verified administrator.
// Never modifies orders, refunds money, or revokes entitlements.
export async function GET(request: Request) {
  try {
    const { user, db } = await context(request);
    const { data: profile, error: roleError } = await db
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (roleError) throw new AiError("관리자 권한을 확인하지 못했어요.", 503);
    if (profile?.role !== "admin") throw new AiError("관리자만 조회할 수 있습니다.", 403);
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId || !/^[A-Za-z0-9_-]{6,64}$/.test(orderId))
      throw new AiError("주문번호를 확인해 주세요.");
    const { data: order, error } = await db.from("ai_payments")
      .select("id,user_id,order_id,payment_key,amount,status,activated_until,approved_at")
      .eq("order_id", orderId).maybeSingle();
    if (error) throw new AiError("결제 정보를 확인하지 못했어요.", 503);
    if (!order) throw new AiError("주문을 찾을 수 없어요.", 404);
    // Purchases extend an existing pass. Do not compute a refund by simply
    // subtracting 30 days; later purchases may depend on this activation.
    const [laterPurchases, member, liveSessions] = await Promise.all([
      db.from("ai_payments")
        .select("id").eq("user_id", order.user_id).eq("status", "paid")
        .gt("approved_at", order.approved_at ?? "1970-01-01T00:00:00Z")
        .limit(1),
      db.from("ai_members")
        .select("valid_until").eq("user_id", order.user_id).maybeSingle(),
      db.from("ai_sessions")
        .select("id").eq("user_id", order.user_id).neq("state", "closed").limit(1),
    ]);
    if (laterPurchases.error || member.error || liveSessions.error)
      throw new AiError("이용권 의존관계를 조회하지 못했습니다. 상태를 변경하지 않았습니다.", 503);
    const laterPaidPurchase = (laterPurchases.data?.length ?? 0) > 0;
    const activeSession = (liveSessions.data?.length ?? 0) > 0;
    const entitlementReview = {
      laterPaidPurchase, activeSession,
      currentValidUntil: member.data?.valid_until ?? null,
      automaticRevocationSafe: false,
      explanation: laterPaidPurchase
        ? "이후에 추가로 결제한 이용권이 있어 단순 30일 차감이 불가능합니다."
        : activeSession
          ? "진행 중인 음성 수업이 있으므로 이용권 회수 전에 수업 종료를 확인해야 합니다."
          : "실제 사용량, 환불 기준, 선후 결제 관계를 검토한 뒤 별도 정산해야 합니다.",
    };
    if (!order.payment_key)
      return Response.json({
        orderId, localStatus: order.status, providerStatus: null,
        entitlementReview,
        requiresReview: order.status === "paid",
        message: "Toss 결제 키가 없어 외부 결제 상태를 조회할 수 없습니다.",
      }, { headers: { "Cache-Control": "no-store" } });
    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret) throw new AiError("Toss 결제 조회 설정을 확인해 주세요.", 503);
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}`,
      {
        headers: { Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}` },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new AiError(
      "Toss 결제 상태를 조회하지 못했어요. 상태를 변경하지 않았습니다.", 502,
    );
    const provider = await response.json() as Record<string, unknown>;
    const validIdentity = provider.orderId === order.order_id &&
      provider.paymentKey === order.payment_key &&
      provider.totalAmount === order.amount &&
      provider.currency === "KRW";
    const completed = provider.status === "DONE";
    const needsReview = !validIdentity ||
      (order.status === "paid" && !completed) ||
      (order.status !== "paid" && completed);
    return Response.json({
      orderId: order.order_id,
      entitlementReview,
      localStatus: order.status,
      providerStatus: typeof provider.status === "string" ? provider.status : null,
      amountMatches: validIdentity,
      requiresReview: needsReview,
      activatedUntil: order.activated_until,
      message: !validIdentity
        ? "주문·금액·결제키가 일치하지 않습니다. 수동 확인이 필요합니다."
        : needsReview
          ? "TALKLY 이용권과 Toss 결제 상태가 다릅니다. 환불과 이용권 정산을 별도 검토하세요."
          : "외부 결제 상태를 조회했습니다. 환불 여부 및 권리관계는 별도 확인이 필요합니다.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
