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
    const data = await body(request);
    if (typeof data.consent !== "boolean")
      throw new AiError("학습 요약 저장 안내를 확인해 주세요.");
    // Withdrawal must remain available even if an older member has not renewed consent.
    await requireMember(db, user.id, data.consent);
    let query = db
      .from("ai_members")
      .update({
        learning_summary_consent_at: data.consent
          ? new Date().toISOString()
          : null,
      })
      .eq("user_id", user.id);
    // Repeated opt-in preserves the start boundary; opting back in starts fresh.
    if (data.consent) query = query.is("learning_summary_consent_at", null);
    const { error } = await query;
    if (error) throw error;
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
