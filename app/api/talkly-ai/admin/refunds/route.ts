import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
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
      throw new AiError("관리자만 검토할 수 있습니다.", 403);
    const value = await body(request);
    if (
      typeof value.requestId !== "string" ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.requestId) ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !["reviewing", "awaiting_action"].includes(value.state)
    )
      throw new AiError("검토 정보를 확인해 주세요.");
    const { data, error } = await db.rpc("ai_review_refund", {
      p_actor: user.id,
      p_request: value.requestId,
      p_revision: value.revision,
      p_state: value.state,
    });
    if (error)
      throw new AiError(
        "다른 관리자가 변경했거나 처리할 수 없는 상태입니다. 새로고침 후 확인해 주세요.",
        409,
      );
    return Response.json(
      { success: true, revision: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
