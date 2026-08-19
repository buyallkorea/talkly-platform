import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  sessionId: number;
};

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase 서버 환경변수가 설정되지 않았습니다."
    );
  }

  return createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 정보를 확인할 수 없습니다.",
        },
        { status: 403 }
      );
    }

    if (
      profile.role !== "student" &&
      profile.role !== "parent"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "학생 또는 학부모 계정만 자동 출석 처리할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const sessionId = Number(body.sessionId);

    if (
      !Number.isInteger(sessionId) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 수업 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    const {
      data: session,
      error: sessionError,
    } = await adminSupabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        started_at,
        ended_at,
        status
      `)
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error:
            sessionError?.message ||
            "수업 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (!session.started_at) {
      return NextResponse.json(
        {
          success: false,
          error: "아직 시작되지 않은 수업입니다.",
        },
        { status: 409 }
      );
    }

    if (session.ended_at) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 종료된 수업입니다.",
        },
        { status: 409 }
      );
    }

    const {
      data: enrollment,
      error: enrollmentError,
    } = await adminSupabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id
      `)
      .eq("id", session.enrollment_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        {
          success: false,
          error:
            enrollmentError?.message ||
            "수강정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    let hasAccess = false;

    if (profile.role === "student") {
      hasAccess =
        enrollment.student_user_id === user.id;
    }

    if (
      profile.role === "parent" &&
      enrollment.child_id
    ) {
      const {
        data: child,
        error: childError,
      } = await adminSupabase
        .from("children")
        .select("id")
        .eq("id", enrollment.child_id)
        .eq("parent_user_id", user.id)
        .maybeSingle();

      if (childError) {
        return NextResponse.json(
          {
            success: false,
            error: childError.message,
          },
          { status: 500 }
        );
      }

      hasAccess = Boolean(child);
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "이 수업에 대한 출석 권한이 없습니다.",
        },
        { status: 403 }
      );
    }

    const {
      data: existingAttendance,
      error: existingAttendanceError,
    } = await adminSupabase
      .from("attendance")
      .select(`
        id,
        status,
        attended_at
      `)
      .eq("class_session_id", sessionId)
      .maybeSingle();

    if (existingAttendanceError) {
      return NextResponse.json(
        {
          success: false,
          error: existingAttendanceError.message,
        },
        { status: 500 }
      );
    }

    if (existingAttendance) {
      return NextResponse.json({
        success: true,
        created: false,
        attendance: {
          id: existingAttendance.id,
          status: existingAttendance.status,
          attendedAt:
            existingAttendance.attended_at,
        },
      });
    }

    const now = new Date().toISOString();

    const {
      data: insertedAttendance,
      error: insertError,
    } = await adminSupabase
      .from("attendance")
      .insert({
        class_session_id: sessionId,
        status: "present",
        attended_at: now,
        note: null,
        created_at: now,
        updated_at: now,
      })
      .select(`
        id,
        status,
        attended_at
      `)
      .single();

    if (insertError) {
      // 새로고침/중복 호출이 거의 동시에 발생한 경우
      // 이미 생성된 출석정보를 다시 읽어 정상 응답합니다.
      if (insertError.code === "23505") {
        const {
          data: duplicateAttendance,
          error: duplicateReadError,
        } = await adminSupabase
          .from("attendance")
          .select(`
            id,
            status,
            attended_at
          `)
          .eq("class_session_id", sessionId)
          .maybeSingle();

        if (
          !duplicateReadError &&
          duplicateAttendance
        ) {
          return NextResponse.json({
            success: true,
            created: false,
            attendance: {
              id: duplicateAttendance.id,
              status: duplicateAttendance.status,
              attendedAt:
                duplicateAttendance.attended_at,
            },
          });
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: `자동 출석 저장 실패: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: true,
      attendance: {
        id: insertedAttendance.id,
        status: insertedAttendance.status,
        attendedAt:
          insertedAttendance.attended_at,
      },
    });
  } catch (error) {
    console.error(
      "AUTO ATTENDANCE CHECK-IN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "자동 출석 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}