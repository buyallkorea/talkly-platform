import { context, failure } from "@/lib/talkly-ai/server";
import { seoulDay, PLAN } from "@/lib/talkly-ai/config";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user, db } = await context();
    const [member, usage, payments] = await Promise.all([
      db
        .from("ai_members")
        .select("status,valid_until,last_tutor_id,memory")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("ai_daily_usage")
        .select("used_seconds")
        .eq("user_id", user.id)
        .eq("day", seoulDay())
        .maybeSingle(),
      db
        .from("ai_payments")
        .select("order_id,amount,status,approved_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (member.error || usage.error || payments.error)
      throw new Error("Account read failed");
    return Response.json(
      {
        member: member.data,
        remaining: Math.max(
          0,
          PLAN.dailySeconds - (usage.data?.used_seconds ?? 0),
        ),
        payments: payments.data,
        name: user.user_metadata?.name ?? "",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
