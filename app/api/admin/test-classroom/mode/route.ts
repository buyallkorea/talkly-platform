import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

type Mode = "observer" | "student";
const COOKIE_PREFIX = "talkly_test_classroom_mode_";
const TTL_SECONDS = 2 * 60 * 60;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 없습니다.");
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

// Signed proof only; the actual classroom permissions are NOT granted by this endpoint.
// Future write endpoints must independently verify this proof AND the database test flags.
export async function POST(request: Request) {
  try {
    if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") {
      return NextResponse.json({ error: "테스트 기능이 비활성화되어 있습니다." }, { status: 403 });
    }

    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
    }

    let body: { sessionId?: unknown; mode?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "잘못된 JSON입니다." }, { status: 400 }); }
    const sessionId = body?.sessionId;
    const mode = body?.mode;
    if (typeof sessionId !== "number" || !Number.isSafeInteger(sessionId) || sessionId <= 0 ||
        (mode !== "observer" && mode !== "student")) {
      return NextResponse.json({ error: "수업 ID 또는 입장 모드가 잘못되었습니다." }, { status: 400 });
    }

    const admin = adminClient();
    const { data: session, error: sessionError } = await admin
      .from("class_sessions").select("id, enrollment_id, is_test, status, ended_at")
      .eq("id", sessionId).maybeSingle();
    if (sessionError || !session || session.is_test !== true ||
        !["scheduled", "in_progress"].includes(session.status) || session.ended_at) {
      return NextResponse.json({ error: "유효한 테스트 수업이 아닙니다." }, { status: 403 });
    }
    const { data: enrollment, error: enrollmentError } = await admin
      .from("enrollments").select("id, is_test")
      .eq("id", session.enrollment_id).maybeSingle();
    if (enrollmentError || enrollment?.is_test !== true) {
      return NextResponse.json({ error: "테스트 수강정보를 확인할 수 없습니다." }, { status: 403 });
    }

    const response = NextResponse.json({ success: true, mode, sessionId });
    const cookieName = `${COOKIE_PREFIX}${sessionId}`;
    const cookiePath = "/"; // Future test-only APIs may live outside /classroom.
    if (mode === "observer") {
      response.cookies.set(cookieName, "", { path: cookiePath, maxAge: 0 });
      return response;
    }
    const secret = process.env.TALKLY_TEST_MODE_SIGNING_SECRET;
    if (!secret || secret.length < 32) {
      return NextResponse.json({ error: "테스트 모드 서명키가 설정되지 않았습니다." }, { status: 503 });
    }
    const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const payload = `${user.id}:${sessionId}:${expiry}`;
    const proof = `${payload}.${sign(payload, secret)}`;
    response.cookies.set(cookieName, proof, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: cookiePath, maxAge: TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("[TEST CLASSROOM MODE]", error);
    return NextResponse.json({ error: "테스트 입장 모드 처리에 실패했습니다." }, { status: 500 });
  }
}