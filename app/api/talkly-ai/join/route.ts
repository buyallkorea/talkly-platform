import { CONSENT_VERSION } from "@/lib/talkly-ai/config";
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
    if (data.consent !== true || data.version !== CONSENT_VERSION)
      throw new AiError("AI 이용 안내와 정보 처리에 동의해 주세요.");
    if (data.adultConfirmed !== true)
      throw new AiError(
        "초기 TALKLY AI는 만 19세 이상만 이용할 수 있어요. 성인 여부를 확인해 주세요.",
        403,
      );
    const consentedAt = new Date().toISOString();
    const { error } = await db.from("ai_members").upsert(
      {
        user_id: user.id,
        consent_version: CONSENT_VERSION,
        consented_at: consentedAt,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    // Update consent only. Never reset trial, pass, suspension, memory or usage.
    const { error: renewError } = await db
      .from("ai_members")
      .update({ consent_version: CONSENT_VERSION, consented_at: consentedAt })
      .eq("user_id", user.id)
      .eq("status", "active")
      .neq("consent_version", CONSENT_VERSION);
    if (renewError) throw renewError;
    await requireMember(db, user.id);
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
