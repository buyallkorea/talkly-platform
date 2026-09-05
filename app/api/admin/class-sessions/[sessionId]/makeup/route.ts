import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type RequestBody = {
  lessonDate: string;
  startTime: string;
  durationMinutes: number;
  makeupReason: string;
};

const MAKEUP_ELIGIBLE_STATUSES = [
  "held",
  "cancelled",
  "not_held",
] as const;

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;

    const originalSessionId =
      Number(sessionId);

    if (
      !Number.isInteger(originalSessionId) ||
      originalSessionId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바르지 않은 원본 수업 ID입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createClient();

    /*
     * =====================================================
     * 관리자 확인
     * =====================================================
     */
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
        {
          status: 401,
        }
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * =====================================================
     * 요청값
     * =====================================================
     */
    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "요청 데이터를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const lessonDate =
      typeof body.lessonDate === "string"
        ? body.lessonDate.trim()
        : "";

    const startTime =
      typeof body.startTime === "string"
        ? body.startTime.trim()
        : "";

    const durationMinutes =
      Number(body.durationMinutes);

    const makeupReason =
      typeof body.makeupReason === "string"
        ? body.makeupReason.trim()
        : "";

    if (!isValidDate(lessonDate)) {
      return NextResponse.json(
        {
          success: false,
          error: "보강 수업일을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidTime(startTime)) {
      return NextResponse.json(
        {
          success: false,
          error: "보강 시작시간을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0 ||
      durationMinutes > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "보강 수업시간을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!makeupReason) {
      return NextResponse.json(
        {
          success: false,
          error: "보강 사유를 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 한국시간 입력을 UTC timestamptz로 변환
     */
    const scheduledStart =
      new Date(
        `${lessonDate}T${startTime}:00+09:00`
      );

    if (
      Number.isNaN(
        scheduledStart.getTime()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "보강 시작일시를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      scheduledStart.getTime() <=
      Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "보강수업은 현재 시각 이후로만 생성할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const scheduledEnd =
      new Date(
        scheduledStart.getTime() +
          durationMinutes *
            60 *
            1000
      );

    /*
     * =====================================================
     * 원본 수업
     * =====================================================
     */
    const {
      data: originalSession,
      error: originalError,
    } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        started_at,
        ended_at,
        session_kind,
        makeup_for_session_id
      `)
      .eq("id", originalSessionId)
      .maybeSingle();

    if (originalError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `원본 수업 조회 실패: ${originalError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    if (!originalSession) {
      return NextResponse.json(
        {
          success: false,
          error: "원본 수업을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 보강의 보강은 만들지 않습니다.
     */
    if (
      originalSession.session_kind !==
      "regular"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "보강수업을 원본으로 다시 보강수업을 생성할 수 없습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 원본 상태 확인
     *
     * held:
     *   수업 연기
     *
     * cancelled:
     *   강사/운영상 취소 등
     *
     * not_held:
     *   미진행 후 관리자 판단으로 보강 필요
     *
     * no_show:
     *   학생 결석이므로 기본 보강 대상 아님
     * =====================================================
     */
    if (
      !MAKEUP_ELIGIBLE_STATUSES.includes(
        originalSession.status as
          (typeof MAKEUP_ELIGIBLE_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            originalSession.status === "no_show"
              ? "학생 결석으로 처리된 수업은 기본 보강 대상이 아닙니다."
              : "현재 상태의 원본 수업에는 보강수업을 생성할 수 없습니다.",
          status: originalSession.status,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 수강정보
     * =====================================================
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(`
        id,
        status,
        teacher_user_id,
        start_date,
        end_date
      `)
      .eq(
        "id",
        originalSession.enrollment_id
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

    if (!enrollment.teacher_user_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "담당 강사가 배정되지 않은 수강입니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 완료/취소된 enrollment에는
     * 새 수업을 추가하지 않습니다.
     *
     * 보강이 필요한 enrollment가 completed 상태가 되는 문제는
     * 앞 단계에서 held/not_held를 자동 완료에서 제외함으로써
     * 방지하고 있습니다.
     */
    if (
      enrollment.status === "completed" ||
      enrollment.status === "cancelled"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "이미 완료 또는 취소된 수강에는 보강수업을 생성할 수 없습니다.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 동일 원본의 기존 보강 확인
     *
     * scheduled / in_progress / completed 상태의 보강이
     * 이미 있으면 중복 생성하지 않습니다.
     *
     * cancelled/not_held 된 보강은 새 보강을 다시
     * 생성할 수 있도록 허용합니다.
     * =====================================================
     */
    const {
      data: existingMakeups,
      error: existingMakeupError,
    } = await supabase
      .from("class_sessions")
      .select(`
        id,
        status,
        scheduled_start,
        scheduled_end
      `)
      .eq(
        "makeup_for_session_id",
        originalSession.id
      )
      .eq(
        "session_kind",
        "makeup"
      )
      .in(
        "status",
        [
          "scheduled",
          "in_progress",
          "completed",
        ]
      )
      .limit(1);

    if (existingMakeupError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `기존 보강수업 확인 실패: ${existingMakeupError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      existingMakeups &&
      existingMakeups.length > 0
    ) {
      const existing =
        existingMakeups[0];

      return NextResponse.json(
        {
          success: false,
          error:
            existing.status === "completed"
              ? "이 원본 수업의 보강수업이 이미 완료되었습니다."
              : "이 원본 수업에 이미 예정 또는 진행 중인 보강수업이 있습니다.",
          existingMakeupSessionId:
            existing.id,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 강사 일정 충돌 확인
     *
     * 동일 강사의 scheduled / in_progress 수업과
     * 보강시간이 겹치면 생성하지 않습니다.
     *
     * 조건:
     * existing.start < new.end
     * AND
     * existing.end > new.start
     * =====================================================
     */
    const {
      data: teacherEnrollments,
      error: teacherEnrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id")
      .eq(
        "teacher_user_id",
        enrollment.teacher_user_id
      );

    if (teacherEnrollmentError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `강사 일정 확인 실패: ${teacherEnrollmentError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    const teacherEnrollmentIds =
      (teacherEnrollments ?? [])
        .map((row) => Number(row.id))
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value > 0
        );

    if (
      teacherEnrollmentIds.length > 0
    ) {
      const {
        data: conflicts,
        error: conflictError,
      } = await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          lesson_number,
          scheduled_start,
          scheduled_end,
          status
        `)
        .in(
          "enrollment_id",
          teacherEnrollmentIds
        )
        .in(
          "status",
          [
            "scheduled",
            "in_progress",
          ]
        )
        .lt(
          "scheduled_start",
          scheduledEnd.toISOString()
        )
        .gt(
          "scheduled_end",
          scheduledStart.toISOString()
        )
        .limit(1);

      if (conflictError) {
        return NextResponse.json(
          {
            success: false,
            error:
              `강사 일정 중복 확인 실패: ${conflictError.message}`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        conflicts &&
        conflicts.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "선택한 시간에 담당 강사의 다른 수업이 있습니다.",
            conflictingSessionId:
              conflicts[0].id,
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
     * =====================================================
     * 학생 일정 충돌 확인
     *
     * 같은 enrollment 안에서 scheduled/in_progress 수업과
     * 시간이 겹치면 생성하지 않습니다.
     *
     * 이후 전체 학생계정/자녀 기준의 다중 enrollment
     * 충돌 검사는 별도 확장이 가능합니다.
     * =====================================================
     */
    const {
      data: studentConflicts,
      error: studentConflictError,
    } = await supabase
      .from("class_sessions")
      .select(`
        id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq(
        "enrollment_id",
        originalSession.enrollment_id
      )
      .in(
        "status",
        [
          "scheduled",
          "in_progress",
        ]
      )
      .lt(
        "scheduled_start",
        scheduledEnd.toISOString()
      )
      .gt(
        "scheduled_end",
        scheduledStart.toISOString()
      )
      .limit(1);

    if (studentConflictError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `학생 일정 중복 확인 실패: ${studentConflictError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      studentConflicts &&
      studentConflicts.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "선택한 시간에 이 수강의 다른 수업이 있습니다.",
          conflictingSessionId:
            studentConflicts[0].id,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * 보강수업 생성
     *
     * 중요:
     * lesson_number는 원본 회차와 동일하게 유지합니다.
     *
     * 예:
     * 정규 8회차 미진행
     * → 보강 역시 lesson_number = 8
     *
     * 하지만 session_kind = makeup이므로
     * 계약된 정규 8회차와 구분됩니다.
     * =====================================================
     */
    const now =
      new Date().toISOString();

    const {
      data: makeupSession,
      error: insertError,
    } = await supabase
      .from("class_sessions")
      .insert({
        enrollment_id:
          originalSession.enrollment_id,

        lesson_number:
          originalSession.lesson_number,

        scheduled_start:
          scheduledStart.toISOString(),

        scheduled_end:
          scheduledEnd.toISOString(),

        status: "scheduled",

        meeting_provider: "zoom",

        meeting_id: null,

        meeting_url: null,

        teacher_notes: null,

        started_at: null,

        ended_at: null,

        session_kind: "makeup",

        makeup_for_session_id:
          originalSession.id,

        makeup_reason:
          makeupReason,

        updated_at: now,
      })
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        meeting_provider,
        meeting_id,
        meeting_url,
        session_kind,
        makeup_for_session_id,
        makeup_reason,
        created_at,
        updated_at
      `)
      .single();

    if (
      insertError ||
      !makeupSession
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            insertError?.message ||
            "보강수업 생성에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "보강수업이 생성되었습니다. 이제 Zoom 회의를 연결할 수 있습니다.",

        makeupSession: {
          id:
            makeupSession.id,

          enrollmentId:
            makeupSession.enrollment_id,

          lessonNumber:
            makeupSession.lesson_number,

          scheduledStart:
            makeupSession.scheduled_start,

          scheduledEnd:
            makeupSession.scheduled_end,

          status:
            makeupSession.status,

          sessionKind:
            makeupSession.session_kind,

          makeupForSessionId:
            makeupSession.makeup_for_session_id,

          makeupReason:
            makeupSession.makeup_reason,

          meetingProvider:
            makeupSession.meeting_provider,

          meetingId:
            makeupSession.meeting_id,

          meetingUrl:
            makeupSession.meeting_url,
        },

        /*
         * 관리자 UI가 이 값을 보고
         * 기존 Zoom connect-session API를 호출할 수 있습니다.
         */
        zoomConnectionRequired: true,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE MAKEUP SESSION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "보강수업 생성 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}