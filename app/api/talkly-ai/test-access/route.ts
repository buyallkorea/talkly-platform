import {
  AiError,
  context,
  failure,
  previewTestMode,
  requireMember,
} from "@/lib/talkly-ai/server";
export async function POST(request: Request) {
  try {
    const { user, db } = await context(request);
    if (!previewTestMode())
      throw new AiError("테스트 이용권을 사용할 수 없는 환경입니다.", 403);
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin")
      throw new AiError("관리자 본인만 테스트할 수 있어요.", 403);
    const member = await requireMember(db, user.id);
    const validUntil = new Date(
      Math.max(
        Date.now() + 24 * 60 * 60 * 1000,
        Date.parse(member.valid_until ?? "") || 0,
      ),
    ).toISOString();
    const { error } = await db
      .from("ai_members")
      .update({ valid_until: validUntil })
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) throw error;
    // No payment record, quota reset, classroom enrollment or role change.
    return Response.json({ success: true, validUntil });
  } catch (e) {
    return failure(e);
  }
}
