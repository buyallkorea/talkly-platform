import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const COOKIE_PREFIX = "talkly_test_classroom_mode_";
const MAX_TTL_SECONDS = 2 * 60 * 60;

/**
 * Server-only verification for a temporary administrator acting as a test student.
 * A valid proof never changes the user's real profile role or bypasses RLS.
 * Each write endpoint must call this helper and independently validate its action.
 */
export async function verifyTestStudentMode(sessionId: number): Promise<boolean> {
  if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") return false;
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return false;

  const secret = process.env.TALKLY_TEST_MODE_SIGNING_SECRET;
  if (!secret || secret.length < 32) return false;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return false;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") return false;

  const cookieStore = await cookies();
  const proof = cookieStore.get(`${COOKIE_PREFIX}${sessionId}`)?.value;
  if (!proof) return false;

  const separator = proof.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = proof.slice(0, separator);
  const suppliedSignature = proof.slice(separator + 1);
  const match = /^([0-9a-f-]{36}):(\d+):(\d+)$/.exec(payload);
  if (!match) return false;
  const [, proofUserId, proofSessionId, expiryString] = match;
  if (proofUserId !== user.id || proofSessionId !== String(sessionId)) return false;

  const expiry = Number(expiryString);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + MAX_TTL_SECONDS) return false;

  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const expected = Buffer.from(expectedSignature, "utf8");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const admin = createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error: sessionError } = await admin
    .from("class_sessions")
    .select("enrollment_id, is_test, status, ended_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || session?.is_test !== true ||
      !["scheduled", "in_progress"].includes(session.status) || session.ended_at) {
    return false;
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .select("is_test")
    .eq("id", session.enrollment_id)
    .maybeSingle();
  return !enrollmentError && enrollment?.is_test === true;
}