import {
  context,
  failure,
  previewTestMode,
  monthlyReportsEnabled,
} from "@/lib/talkly-ai/server";
import { summaryRetentionCutoff } from "@/lib/talkly-ai/reports";
import {
  seoulDay,
  PLAN,
  TRIAL_SECONDS,
  CONSENT_VERSION,
} from "@/lib/talkly-ai/config";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user, db } = await context();
    const [member, usage, payments, profile, publication] = await Promise.all([
      db
        .from("ai_members")
        .select(
          "status,valid_until,last_tutor_id,memory,trial_used_seconds,consent_version",
        )
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
      db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      monthlyReportsEnabled()
        ? db
            .from("ai_monthly_publications")
            .select("month,published_at")
            .eq("user_id", user.id)
            .gt("published_at", summaryRetentionCutoff())
            .order("month", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (member.error || usage.error || payments.error)
      throw new Error("Account read failed");
    const activePass =
      member.data?.status === "active" &&
      !!member.data?.valid_until &&
      Date.parse(member.data.valid_until) > Date.now();
    const trialRemaining = member.data
      ? Math.max(0, TRIAL_SECONDS - member.data.trial_used_seconds)
      : 0;
    return Response.json(
      {
        member: member.data,
        needsAdultConsent:
          !!member.data && member.data.consent_version !== CONSENT_VERSION,
        latestReport: publication.error ? null : publication.data,
        activePass,
        trialRemaining,
        paymentsEnabled: process.env.TALKLY_AI_PAYMENTS_ENABLED === "true",
        canTestAccess:
          previewTestMode() && !profile.error && profile.data?.role === "admin",
        remaining: activePass
          ? Math.max(0, PLAN.dailySeconds - (usage.data?.used_seconds ?? 0))
          : trialRemaining,
        payments: payments.data,
        name: user.user_metadata?.name ?? "",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
