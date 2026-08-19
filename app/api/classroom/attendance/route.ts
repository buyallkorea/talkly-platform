import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
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
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createSupabaseAdmin(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    /*
     * -------------------------------------------------------
     * 1. 로그인 세션 확인용 client
     * -------------------------------------------------------
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 2. 학생 역할 확인
     * -------------------------------------------------------
     */
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error:
            profileError?.message ||
            "사용자 정보를 확인할 수 없습니다.",
        },
        {
          status: 403,
        }
      );
    }

    if (profile.role !== "student") {
      return NextResponse.json(
        {
          success: false,
          error:
            "학생 계정에서만 자동 출석을 기록할 수 있습니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 3. 요청값 확인
     * -------------------------------------------------------
     */
    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "요청 데이터를 읽을 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const sessionId =
      Number(body.sessionId);

    if (
      !Number.isInteger(sessionId) ||
      sessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "올바른 수업 ID가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. 관리자 client
     *
     * 이후 DB 쓰기는 service role로 처리합니다.
     * RLS 우회는 서버 내부에서만 수행됩니다.
     * -------------------------------------------------------
     */
    const admin =
      createAdminClient();

    /*
     * -------------------------------------------------------
     * 5. 수업 조회
     * -------------------------------------------------------
     */
    const {
      data: session,
      error: sessionError,
    } = await admin
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        status,
        started_at,
        ended_at
      `)
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error:
            sessionError?.message ||
            "수업을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 6. 진행 중인 수업인지 확인
     * -------------------------------------------------------
     */
    if (!session.started_at) {
      return NextResponse.json(
        {
          success: false,
          error:
            "아직 시작되지 않은 수업입니다.",
        },
        {
          status: 409,
        }
      );
    }

    if (session.ended_at) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이미 종료된 수업입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 7. 실제 수강생인지 확인
     * -------------------------------------------------------
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id
      `)
      .eq(
        "id",
        session.enrollment_id
      )
      .maybeSingle();

    if (
      enrollmentError ||
      !enrollment
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            enrollmentError?.message ||
            "수강정보를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      enrollment.student_user_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이 수업에 등록된 학생 계정이 아닙니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 8. 기존 출결 확인
     * -------------------------------------------------------
     */
    const {
      data: existingAttendance,
      error: existingError,
    } = await admin
      .from("attendance")
      .select(`
        id,
        class_session_id,
        status,
        attended_at,
        note,
        created_at,
        updated_at
      `)
      .eq(
        "class_session_id",
        sessionId
      )
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `기존 출결 조회 실패: ${existingError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * 이미 기록이 있으면 최초 입장시간 유지
     */
    if (existingAttendance) {
      return NextResponse.json({
        success: true,
        created: false,
        attendance:
          existingAttendance,
        message:
          "이미 출석이 기록되어 있습니다.",
      });
    }

    /*
     * -------------------------------------------------------
     * 9. 자동 출석 생성
     *
     * TALKLY 정책:
     * 늦게 접속해도 자동 late 처리하지 않음.
     * Classroom 실제 입장 = present
     * -------------------------------------------------------
     */
    const now =
      new Date().toISOString();

    const {
      data: attendance,
      error: attendanceError,
    } = await admin
      .from("attendance")
      .insert({
        class_session_id:
          sessionId,

        status: "present",

        attended_at: now,

        note:
          "Student entered TALKLY Classroom",

        updated_at: now,
      })
      .select(`
        id,
        class_session_id,
        status,
        attended_at,
        note,
        created_at,
        updated_at
      `)
      .single();

    if (
      attendanceError ||
      !attendance
    ) {
      /*
       * 동시에 요청이 두 번 들어온 경우
       * UNIQUE(class_session_id) 충돌 가능성이 있으므로
       * 다시 조회합니다.
       */
      const {
        data: retryAttendance,
      } = await admin
        .from("attendance")
        .select(`
          id,
          class_session_id,
          status,
          attended_at,
          note,
          created_at,
          updated_at
        `)
        .eq(
          "class_session_id",
          sessionId
        )
        .maybeSingle();

      if (retryAttendance) {
        return NextResponse.json({
          success: true,
          created: false,
          attendance:
            retryAttendance,
          message:
            "출석이 이미 기록되어 있습니다.",
        });
      }

      return NextResponse.json(
        {
          success: false,
          error:
            attendanceError?.message ||
            "출석 기록에 실패했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      created: true,
      attendance,
      message:
        "출석이 자동 기록되었습니다.",
    });
  } catch (error) {
    console.error(
      "CLASSROOM ATTENDANCE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "출석 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}