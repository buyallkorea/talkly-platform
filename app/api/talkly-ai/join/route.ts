import { CONSENT_VERSION } from "@/lib/talkly-ai/config";
import { body, context, failure, AiError } from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const data = await body(request);
    if (data.consent !== true || data.version !== CONSENT_VERSION)
      throw new AiError("AI 이용 안내와 정보 처리에 동의해 주세요.");
    const { error } = await db
      .from("ai_members")
      .upsert(
        {
          user_id: user.id,
          consent_version: CONSENT_VERSION,
          consented_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return Response.json({ success: true });
  } catch (e) {
    return failure(e);
  }
}
