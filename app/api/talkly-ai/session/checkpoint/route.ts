import { body, context, failure, AiError } from "@/lib/talkly-ai/server";
import { cleanTurns } from "@/lib/talkly-ai/config";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const data = await body(request);
    if (
      typeof data.sessionId !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.sessionId)
    )
      throw new AiError("대화 정보를 확인해 주세요.");
    const { data: s, error } = await db
      .from("ai_sessions")
      .select("id,started_at")
      .eq("id", data.sessionId)
      .eq("user_id", user.id)
      .single();
    if (error || !s) throw new AiError("대화를 찾을 수 없어요.", 404);
    const transcript = cleanTurns(data.turns);
    if (transcript.length) {
      const { error: memoryError } = await db
        .from("ai_members")
        .update({ memory: transcript, memory_session_at: s.started_at })
        .eq("user_id", user.id)
        .or(`memory_session_at.is.null,memory_session_at.lte.${s.started_at}`);
      if (memoryError) throw memoryError;
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
