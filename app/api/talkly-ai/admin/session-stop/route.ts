import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
import { closeSession } from "@/lib/talkly-ai/session";
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin")
      throw new AiError("관리자만 연결을 정리할 수 있어요.", 403);
    const value = await body(request);
    if (
      typeof value.sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value.sessionId,
      ) ||
      value.confirm !== true ||
      !["connection_issue", "member_request"].includes(value.reason)
    )
      throw new AiError("대상 연결과 종료 사유를 확인해 주세요.");
    const { data: session, error: sessionError } = await db
      .from("ai_sessions")
      .select("id,user_id,state")
      .eq("id", value.sessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new AiError("대화 연결을 찾을 수 없어요.", 404);
    if (session.state === "closed")
      return Response.json(
        { success: true, alreadyClosed: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    // Audit must exist before an administrator can affect another member's call.
    const { data: action, error: auditError } = await db
      .from("ai_session_admin_actions")
      .insert({
        actor_id: user.id,
        user_id: session.user_id,
        session_id: session.id,
        reason: value.reason,
      })
      .select("id")
      .single();
    if (auditError || !action)
      throw new AiError("처리 이력을 저장하지 못해 종료하지 않았어요.", 503);
    const actionId = action.id;
    async function record(state: "completed" | "failed") {
      try {
        const { error } = await db
          .from("ai_session_admin_actions")
          .update({ state, finished_at: new Date().toISOString() })
          .eq("id", actionId);
        return !error;
      } catch {
        return false;
      }
    }
    try {
      // Owner comes from the server lookup; no arbitrary refund or balance reset.
      await closeSession(session.user_id, session.id);
    } catch {
      await record("failed");
      throw new AiError(
        "종료와 정산을 확인하지 못했어요. 상태를 새로 확인한 뒤 다시 시도해 주세요.",
        503,
      );
    }
    const auditRecorded = await record("completed");
    return Response.json(
      { success: true, auditRecorded },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
