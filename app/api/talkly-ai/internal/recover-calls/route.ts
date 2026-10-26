import { createAdminClient } from "@/lib/supabase-admin";
import { closeSession } from "@/lib/talkly-ai/session";
export const runtime = "nodejs";
export const maxDuration = 60;
// Deliberately not registered as a cron job: activation requires operational review.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED !== "true" ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json({ error: "Not available" }, { status: 404 });
  }
  const db = createAdminClient();
  // Only overdue registered calls; never refund a registered call without hangup.
  // Bounded batch prevents an extended backlog from exhausting this invocation.
  const { data, error } = await db
    .from("ai_sessions")
    .select("id,user_id")
    .not("call_id", "is", null)
    .in("state", ["connecting", "active", "closing"])
    .lte("deadline", new Date().toISOString())
    .order("deadline", { ascending: true })
    .limit(10)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) {
    return Response.json({ error: "Recovery lookup unavailable" }, { status: 503 });
  }
  let recovered = 0;
  let failed = 0;
  for (const session of data ?? []) {
    try {
      await closeSession(session.user_id, session.id);
      recovered++;
    } catch {
      // Leave the reservation held, so a later invocation can safely retry.
      failed++;
    }
  }
  return Response.json(
    { checked: (data ?? []).length, recovered, failed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
