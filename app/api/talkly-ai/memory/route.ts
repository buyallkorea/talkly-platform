import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const value = await body(request);
    if (value.confirm !== true)
      throw new AiError("이전 대화 기억 삭제를 확인해 주세요.");
    const { data, error } = await db.rpc("ai_clear_memory", {
      p_user: user.id,
    });
    if (error || typeof data !== "string" || !Number.isFinite(Date.parse(data)))
      throw new AiError(
        "대화 기억 삭제를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        503,
      );
    return Response.json(
      { success: true, clearedAt: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
