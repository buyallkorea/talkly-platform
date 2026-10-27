import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { CONSENT_VERSION } from "./config";
export class AiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function enabled() {
  return process.env.TALKLY_AI_ENABLED === "true";
}
export function monthlyReportsEnabled() {
  return process.env.TALKLY_AI_MONTHLY_REPORTS_ENABLED === "true";
}
export function previewTestMode() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.TALKLY_AI_TEST_MODE === "true" &&
    process.env.TALKLY_AI_PAYMENTS_ENABLED !== "true"
  );
}
// Preview write operations stay disabled until a dedicated database is verified.
export function requireIsolatedPreviewWrite(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return;
  const expected = process.env.TALKLY_AI_PREVIEW_DB_PROJECT_REF;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const production = process.env.TALKLY_AI_PRODUCTION_DB_PROJECT_REF;
  if (!expected || !/^[a-z0-9]{20}$/.test(expected) ||
      !production || !/^[a-z0-9]{20}$/.test(production) || expected === production ||
      !url || new URL(url).hostname !== expected + ".supabase.co")
    throw new AiError("개발용 AI 데이터베이스 분리가 확인되지 않았어요.", 503);
}
export async function context(request?: Request) {
  if (!enabled()) throw new AiError("TALKLY AI를 준비 중이에요.", 503);
  if (request) {
    requireIsolatedPreviewWrite(request);
    let origin: URL;
    try {
      origin = new URL(request.headers.get("origin") ?? "");
    } catch {
      throw new AiError("허용되지 않은 요청입니다.", 403);
    }
    // Next may construct request.url from its internal listening hostname.
    // Browser Host is the effective public authority and cannot be overridden
    // by cross-origin browser JS. Do not trust an arbitrary forwarded host.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (origin.host !== host || !["http:", "https:"].includes(origin.protocol))
      throw new AiError("허용되지 않은 요청입니다.", 403);
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AiError("TALKLY 로그인 후 이용해 주세요.", 401);
  return { user, db: createAdminClient() };
}
export function failure(error: unknown) {
  if (!(error instanceof AiError)) console.error("[TALKLY AI] request failed");
  return Response.json(
    {
      error:
        error instanceof AiError
          ? error.message
          : "처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    },
    { status: error instanceof AiError ? error.status : 500 },
  );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 100_000) throw new AiError("요청이 너무 큽니다.", 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AiError("요청 내용을 확인해 주세요.");
    return value;
  } catch {
    throw new AiError("요청 내용을 확인해 주세요.");
  }
}
export async function requireMember(
  db: ReturnType<typeof createAdminClient>,
  id: string,
  requireCurrentConsent = true,
) {
  const { data, error } = await db
    .from("ai_members")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new AiError("AI 가입 정보를 확인하지 못했어요.", 503);
  if (!data || data.status !== "active")
    throw new AiError("AI 전용 가입을 먼저 완료해 주세요.", 403);
  if (requireCurrentConsent && data.consent_version !== CONSENT_VERSION)
    throw new AiError(
      "만 19세 이상 이용 안내를 확인하고 AI 가입 동의를 완료해 주세요.",
      403,
    );
  return data;
}
export async function hangup(callId: string) {
  if (!/^rtc_[A-Za-z0-9_-]+$/.test(callId)) throw new Error("Invalid call id");
  const response = await fetch(
    `https://api.openai.com/v1/realtime/calls/${callId}/hangup`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error("Hangup failed");
}
