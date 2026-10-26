import { AiError, context, failure } from "@/lib/talkly-ai/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { user, db } = await context(request);
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw new AiError("관리자 권한을 확인하지 못했습니다.", 503);
    if (profile?.role !== "admin") throw new AiError("관리자만 조회할 수 있습니다.", 403);
    const params = new URL(request.url).searchParams;
    const requestId = params.get("requestId");
    const orderId = params.get("orderId");
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if ((requestId ? 1 : 0) + (orderId ? 1 : 0) !== 1 ||
      (requestId && !uuid.test(requestId)) ||
      (orderId && !/^[A-Za-z0-9_-]{6,64}$/.test(orderId)))
      throw new AiError("환불 접수번호 또는 주문번호 중 하나를 입력해 주세요.");
    let requestLookup = db.from("ai_refund_requests")
      .select("id,payment_id,user_id,reason,state,revision,created_at");
    if (requestId) requestLookup = requestLookup.eq("id", requestId);
    else {
      const { data: payment, error: paymentError } = await db.from("ai_payments")
        .select("id").eq("order_id", orderId!).maybeSingle();
      if (paymentError) throw new AiError("주문 조회에 실패했습니다.", 503);
      if (!payment) throw new AiError("주문번호를 찾을 수 없습니다.", 404);
      requestLookup = requestLookup.eq("payment_id", payment.id);
    }
    const { data: refund, error } = await requestLookup.maybeSingle();
    if (error) throw new AiError("환불 요청을 조회하지 못했습니다.", 503);
    if (!refund) throw new AiError("환불 요청이 없습니다.", 404);
    const [audit, reviews, payment] = await Promise.all([
      db.from("ai_refund_audit").select("id,actor_id,event_type,note,created_at")
        .eq("request_id", refund.id).order("created_at", { ascending: false }).limit(500),
      db.from("ai_refund_reviews").select("id,actor_id,from_state,to_state,created_at")
        .eq("request_id", refund.id).order("created_at", { ascending: false }).limit(500),
      db.from("ai_payments").select("order_id,amount,status,approved_at,activated_until")
        .eq("id", refund.payment_id).maybeSingle(),
    ]);
    if (audit.error || reviews.error || payment.error)
      throw new AiError("정산 이력을 조회하지 못했습니다.", 503);
    return Response.json({
      refund, payment: payment.data,
      audit: audit.data ?? [], reviews: reviews.data ?? [],
      truncated: (audit.data?.length ?? 0) >= 500 || (reviews.data?.length ?? 0) >= 500,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
