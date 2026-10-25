import { AiError, body, context, failure } from "@/lib/talkly-ai/server";
import { runOutreachBatch } from "@/lib/talkly-ai/outreach-worker";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const { data: profile, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (profile?.role !== "admin")
      throw new AiError("관리자만 안내 발송을 처리할 수 있습니다.", 403);
    const value = await body(request);
    if (value.confirm !== true)
      throw new AiError("실제 안내 발송 여부를 확인해 주세요.");
    if (process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED !== "true")
      throw new AiError("현재 실제 안내 발송은 꺼져 있습니다.", 503);
    const result = await runOutreachBatch();
    return Response.json(
      { success: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
