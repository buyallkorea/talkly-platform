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
    const data = await body(request);
    if (data.consent !== true)
      throw new AiError("학습 요약 저장 안내를 확인해 주세요.");
    const { error } = await db
      .from("ai_members")
      .update({ learning_summary_consent_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("learning_summary_consent_at", null);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
