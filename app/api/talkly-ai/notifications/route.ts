import {
  AiError,
  body,
  context,
  failure,
  requireMember,
} from "@/lib/talkly-ai/server";
export const dynamic = "force-dynamic";
const NOTICE_VERSION = "2026-10-25-outreach-v1";
function optInEnabled() {
  // Separate from delivery. Keep off until the notice and channel setup are reviewed.
  return process.env.TALKLY_AI_OUTREACH_OPT_IN_ENABLED === "true";
}
export async function GET() {
  try {
    const { user, db } = await context();
    const { data, error } = await db
      .from("ai_outreach_preferences")
      .select("channel,enabled,updated_at")
      .eq("user_id", user.id);
    if (error) throw error;
    return Response.json(
      {
        preferences: data ?? [],
        noticeVersion: NOTICE_VERSION,
        optInEnabled: optInEnabled(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    const value = await body(request);
    if (
      !["kakao", "email"].includes(value.channel) ||
      typeof value.enabled !== "boolean"
    )
      throw new AiError("안내 채널과 수신 설정을 확인해 주세요.");
    if (value.enabled) {
      if (!optInEnabled())
        throw new AiError(
          "새 수신 동의는 준비 중이에요. 기존 동의 철회는 가능합니다.",
          503,
        );
      if (value.noticeVersion !== NOTICE_VERSION)
        throw new AiError("최신 수신 안내를 다시 확인해 주세요.");
      await requireMember(db, user.id);
      const { data: profile, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!["student", "parent"].includes(profile?.role ?? ""))
        throw new AiError("학습 회원만 신청할 수 있어요.", 403);
    }
    // No active-member/current-consent gate on withdrawal. The RPC checks membership.
    // Never accept a target user ID, timestamp or audit version from the browser.
    const { error } = await db.rpc("ai_set_outreach_consent", {
      p_user: user.id,
      p_channel: value.channel,
      p_enabled: value.enabled,
      p_notice: NOTICE_VERSION,
    });
    if (error) throw error;
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
