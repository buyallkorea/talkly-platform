import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const value = await body(request);
    if (
      typeof value.sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value.sessionId,
      )
    )
      throw new AiError("삭제할 학습 요약을 확인해 주세요.");
    // Privacy action remains available to suspended and legacy-consent members.
    const { data, error } = await db.rpc("ai_delete_learning_summary", {
      p_user: user.id,
      p_session: value.sessionId,
    });
    if (error) throw error;
    if (!data) throw new AiError("학습 요약을 찾을 수 없어요.", 404);
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
