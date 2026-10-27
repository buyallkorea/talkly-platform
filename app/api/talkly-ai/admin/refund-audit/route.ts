import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const { data: profile, error: roleError } = await db.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (roleError) throw new AiError("관리자 권한을 확인하지 못했습니다.", 503);
    if (profile?.role !== "admin") throw new AiError("관리자만 기록할 수 있습니다.", 403);
    const value = await body(request);
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (typeof value.requestId !== "string" || !uuid.test(value.requestId) ||
        typeof value.eventKey !== "string" || !uuid.test(value.eventKey) ||
        !["provider_checked","entitlement_reviewed","manual_action_required"].includes(value.eventType) ||
        typeof value.note !== "string" || !value.note.trim() || value.note.length > 1000)
      throw new AiError("정산 기록을 확인해 주세요.");
    const { data, error } = await db.rpc("ai_record_refund_audit", {
      p_actor: user.id, p_request: value.requestId,
      p_event_key: value.eventKey, p_type: value.eventType,
      p_note: value.note.trim(),
    });
    if (error) throw new AiError("기록을 저장하지 못했습니다. 중복 요청 여부를 확인해 주세요.", 409);
    return Response.json({ success: true, auditId: data }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return failure(error); }
}
