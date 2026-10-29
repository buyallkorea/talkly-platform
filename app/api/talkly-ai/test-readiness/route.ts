import { createAdminClient } from "@/lib/supabase-admin";
import { requireIsolatedPreviewWrite } from "@/lib/talkly-ai/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;
const headers = { "Cache-Control": "no-store" };
/** Read-only Preview configuration check. Never creates a user, lesson or provider call. */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.TALKLY_AI_TEST_MODE !== "true" ||
      process.env.TALKLY_AI_PAYMENTS_ENABLED !== "false")
    return Response.json({ error: "Not available" }, { status: 404, headers });
  try {
    requireIsolatedPreviewWrite(new Request(request.url, { method: "POST" }));
  } catch {
    return Response.json({ status: "blocked", stage: "database_isolation" }, { status: 503, headers });
  }
  if (process.env.TALKLY_AI_ENABLED !== "true" ||
      !process.env.OPENAI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      !process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET ||
      !process.env.SOLAPI_SENDER_NUMBER)
    return Response.json({ status: "blocked", stage: "server_configuration" }, { status: 503, headers });
  try {
    const db = createAdminClient({ timeoutMs: 3000 });
    const checks = await Promise.all([
      db.from("profiles").select("id,role").limit(0),
      db.from("phone_verifications").select("id,consumed_at,verification_token_hash").limit(0),
      db.from("ai_members").select("user_id,consent_version,trial_used_seconds").limit(0),
      db.from("ai_sessions").select("id,checkpoint_writer,checkpoint_version").limit(0),
    ]);
    if (checks.some((check) => check.error))
      return Response.json({ status: "blocked", stage: "database_credentials_or_schema" }, { status: 503, headers });
    const auth = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      redirect: "error",
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!auth.ok) throw new Error("Auth configuration unavailable");
    return Response.json({
      status: "configuration_checked",
      signupAndVoiceTest: "not_run",
      productionWrites: false,
      providerCalls: false,
    }, { headers });
  } catch {
    return Response.json({ status: "blocked", stage: "dependency_connection" }, { status: 503, headers });
  }
}
