
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // 1. 테스트 교실 기능 활성화 확인
    if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") {
      return NextResponse.json(
        { error: "Test classroom is disabled." },
        { status: 403 }
      );
    }

    // 2. 동일 출처 요청만 허용
    const origin = request.headers.get("origin");

    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid origin." },
        { status: 403 }
      );
    }

    // 3. 요청 데이터 검증
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { sessionId } = body as Record<string, unknown>;

    if (
      typeof sessionId !== "number" ||
      !Number.isSafeInteger(sessionId) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid session ID." },
        { status: 400 }
      );
    }

    // 4. 서명된 관리자 테스트 학생 인증 확인
    const verified = await verifyTestStudentMode(sessionId);

    if (!verified) {
      return NextResponse.json(
        { error: "Test student authorization failed." },
        { status: 403 }
      );
    }

    // 5. 로그인 세션 확인
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 6. 서버 전용 Supabase 클라이언트 생성
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error(
        "[TEST ATTENDANCE] Supabase configuration missing"
      );

      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const admin = createSupabaseAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 7. 테스트 수업인지 재확인
    const {
      data: session,
      error: sessionError,
    } = await admin
      .from("class_sessions")
      .select("enrollment_id,is_test,status,ended_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    if (
      session.is_test !== true ||
      session.status !== "in_progress" ||
      session.ended_at !== null
    ) {
      return NextResponse.json(
        { error: "Test session is not in progress." },
        { status: 403 }
      );
    }

    // 8. 테스트 수강신청인지 재확인
    const {
      data: enrollment,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select("is_test")
      .eq("id", session.enrollment_id)
      .maybeSingle();

    if (enrollmentError || enrollment?.is_test !== true) {
      return NextResponse.json(
        { error: "Invalid test enrollment." },
        { status: 403 }
      );
    }

    // 9. 출석 기록이 이미 있는지 확인
    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("attendance")
      .select("id,status")
      .eq("class_session_id", sessionId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "[TEST ATTENDANCE] Existing record check failed:",
        existingError
      );

      return NextResponse.json(
        { error: "Attendance lookup failed." },
        { status: 500 }
      );
    }

    // 강사가 이미 기록한 출석은 변경하지 않음
    if (existing) {
      return NextResponse.json({
        success: true,
        created: false,
        status: existing.status,
      });
    }

    // 10. 기록이 없는 경우에만 출석 생성
    // UNIQUE(class_session_id) 충돌 시 기존 기록 유지
    const {
      data: inserted,
      error: insertError,
    } = await admin
      .from("attendance")
      .upsert(
        {
          class_session_id: sessionId,
          status: "present",
          attended_at: new Date().toISOString(),
        },
        {
          onConflict: "class_session_id",
          ignoreDuplicates: true,
        }
      )
      .select("id,status")
      .maybeSingle();

    if (insertError) {
      console.error(
        "[TEST ATTENDANCE] Insert failed:",
        insertError
      );

      return NextResponse.json(
        { error: "Attendance insert failed." },
        { status: 500 }
      );
    }

    // 동시 요청으로 다른 기록이 먼저 생성된 경우
    if (!inserted) {
      const { data: current, error: currentError } =
        await admin
          .from("attendance")
          .select("status")
          .eq("class_session_id", sessionId)
          .maybeSingle();

      if (currentError || !current) {
        return NextResponse.json(
          { error: "Attendance verification failed." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        created: false,
        status: current.status,
      });
    }

    return NextResponse.json({
      success: true,
      created: true,
      status: inserted.status,
    });
  } catch (error) {
    console.error(
      "[TEST ATTENDANCE] Unexpected error:",
      error
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
