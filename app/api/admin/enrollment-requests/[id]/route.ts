import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type ActionBody = {
  action: "approve" | "reject";
  teacherUserId?: string | null;
  curriculum?: string | null;
  adminNote?: string | null;
};

const DAY_NUMBERS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      response: NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      ),
    };
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
    return {
      supabase,
      response: NextResponse.json(
        {
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    supabase,
    response: null,
  };
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await context.params;

  const requestId = Number(id);

  if (
    !Number.isInteger(requestId) ||
    requestId <= 0
  ) {
    return NextResponse.json(
      {
        error: "수강신청 ID가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    supabase,
    response: adminResponse,
  } = await requireAdmin();

  if (adminResponse) {
    return adminResponse;
  }

  let body: ActionBody;

  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json(
      {
        error: "요청 내용을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    body.action !== "approve" &&
    body.action !== "reject"
  ) {
    return NextResponse.json(
      {
        error: "올바르지 않은 처리 방식입니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: enrollmentRequest,
    error: requestError,
  } = await supabase
    .from("enrollment_requests")
    .select(`
      id,
      applicant_user_id,
      child_id,
      enrollment_option_id,
      course_id,
      lesson_duration_minutes,
      lessons_per_week,
      preferred_days,
      preferred_times,
      start_date,
      end_date,
      total_lessons,
      weekday_lesson_count,
      weekend_lesson_count,
      price_per_lesson,
      weekend_multiplier,
      estimated_price,
      status,
      assigned_teacher_user_id,
      assigned_curriculum,
      admin_note
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (
    requestError ||
    !enrollmentRequest
  ) {
    return NextResponse.json(
      {
        error:
          requestError?.message ||
          "수강신청을 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    enrollmentRequest.status !== "pending"
  ) {
    return NextResponse.json(
      {
        error:
          `이미 처리된 신청입니다. 현재 상태: ${enrollmentRequest.status}`,
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 반려
   */
  if (body.action === "reject") {
    const {
      error: rejectError,
    } = await supabase
      .from("enrollment_requests")
      .update({
        status: "rejected",
        admin_note:
          body.adminNote?.trim() || null,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending");

    if (rejectError) {
      return NextResponse.json(
        {
          error:
            `반려 처리 실패: ${rejectError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      action: "rejected",
    });
  }

  /*
   * 승인
   */
  if (!body.teacherUserId) {
    return NextResponse.json(
      {
        error: "승인하려면 담당 강사를 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: teacher,
    error: teacherError,
  } = await supabase
    .from("teacher_profiles")
    .select("user_id, display_name, is_active")
    .eq("user_id", body.teacherUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (
    teacherError ||
    !teacher
  ) {
    return NextResponse.json(
      {
        error:
          teacherError?.message ||
          "선택한 강사를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !enrollmentRequest.child_id ||
    !enrollmentRequest.course_id ||
    !enrollmentRequest.start_date ||
    !enrollmentRequest.end_date
  ) {
    return NextResponse.json(
      {
        error:
          "신청 데이터에 학생, 과정 또는 수강기간 정보가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      enrollmentRequest.preferred_days
    ) ||
    enrollmentRequest.preferred_days.length === 0
  ) {
    return NextResponse.json(
      {
        error: "수업 요일 정보가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !enrollmentRequest.preferred_times ||
    typeof enrollmentRequest.preferred_times !==
      "object"
  ) {
    return NextResponse.json(
      {
        error: "수업 시간 정보가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  let createdEnrollmentId: number | null = null;

  try {
    /*
     * 같은 학생 / 과정 / 기간의 중복 수강 방지
     */
    const {
      data: duplicateRows,
      error: duplicateError,
    } = await supabase
      .from("enrollments")
      .select("id")
      .eq(
        "child_id",
        enrollmentRequest.child_id
      )
      .eq(
        "course_id",
        enrollmentRequest.course_id
      )
      .eq(
        "start_date",
        enrollmentRequest.start_date
      )
      .eq(
        "end_date",
        enrollmentRequest.end_date
      )
      .in("status", [
        "active",
        "pending",
      ])
      .limit(1);

    if (duplicateError) {
      throw new Error(
        `중복 수강 확인 실패: ${duplicateError.message}`
      );
    }

    if (
      duplicateRows &&
      duplicateRows.length > 0
    ) {
      throw new Error(
        "동일한 학생에게 같은 과정과 수강기간의 수강정보가 이미 존재합니다."
      );
    }

    /*
     * enrollment 생성
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .insert({
        child_id:
          enrollmentRequest.child_id,

        student_user_id:
          null,

        course_id:
          enrollmentRequest.course_id,

        teacher_user_id:
          body.teacherUserId,

        status:
          "active",

        start_date:
          enrollmentRequest.start_date,

        end_date:
          enrollmentRequest.end_date,

        lessons_per_week:
          enrollmentRequest.lessons_per_week,

        total_lessons:
          enrollmentRequest.total_lessons,
      })
      .select("id")
      .single();

    if (
      enrollmentError ||
      !enrollment
    ) {
      throw new Error(
        `수강정보 생성 실패: ${
          enrollmentError?.message ||
          "알 수 없는 오류"
        }`
      );
    }

    createdEnrollmentId =
      enrollment.id;

    /*
     * class_sessions 생성
     */
    const start =
      parseDate(
        enrollmentRequest.start_date
      );

    const endExclusive =
      addDays(
        parseDate(
          enrollmentRequest.end_date
        ),
        1
      );

    const preferredDays =
      enrollmentRequest.preferred_days as string[];

    const preferredTimes =
      enrollmentRequest.preferred_times as Record<
        string,
        string
      >;

    const durationMinutes =
      Number(
        enrollmentRequest.lesson_duration_minutes
      );

    const totalLessons =
      Number(
        enrollmentRequest.total_lessons
      );

    const sessions: {
      enrollment_id: number;
      lesson_number: number;
      scheduled_start: string;
      scheduled_end: string;
      status: string;
      meeting_provider: string;
    }[] = [];

    let current = new Date(start);

    while (
      current < endExclusive &&
      sessions.length < totalLessons
    ) {
      const currentDay =
        current.getUTCDay();

      for (
        const weekday of preferredDays
      ) {
        if (
          sessions.length >= totalLessons
        ) {
          break;
        }

        const weekdayNumber =
          DAY_NUMBERS[weekday];

        if (
          weekdayNumber === undefined ||
          weekdayNumber !== currentDay
        ) {
          continue;
        }

        const time =
          preferredTimes[weekday];

        if (!time) {
          continue;
        }

        const dateString =
          formatDate(current);

        /*
         * TALKLY 운영시간은 한국시간 기준
         */
        const sessionStart =
          new Date(
            `${dateString}T${time}:00+09:00`
          );

        const sessionEnd =
          new Date(
            sessionStart.getTime() +
              durationMinutes *
                60 *
                1000
          );

        sessions.push({
          enrollment_id:
            enrollment.id,

          lesson_number:
            sessions.length + 1,

          scheduled_start:
            sessionStart.toISOString(),

          scheduled_end:
            sessionEnd.toISOString(),

          status:
            "scheduled",

          meeting_provider:
            "zoom",
        });
      }

      current =
        addDays(current, 1);
    }

    if (
      sessions.length !== totalLessons
    ) {
      throw new Error(
        `수업 회차 계산 오류: 예정 ${totalLessons}회 중 ${sessions.length}회만 생성되었습니다.`
      );
    }

    const {
      error: sessionsError,
    } = await supabase
      .from("class_sessions")
      .insert(sessions);

    if (sessionsError) {
      throw new Error(
        `수업 일정 생성 실패: ${sessionsError.message}`
      );
    }

    /*
     * 신청 승인 완료
     */
    const {
      data: approvedRows,
      error: approveError,
    } = await supabase
      .from("enrollment_requests")
      .update({
        status: "approved",

        assigned_teacher_user_id:
          body.teacherUserId,

        assigned_curriculum:
          body.curriculum?.trim() ||
          null,

        admin_note:
          body.adminNote?.trim() ||
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id");

    if (approveError) {
      throw new Error(
        `신청 승인 상태 저장 실패: ${approveError.message}`
      );
    }

    if (
      !approvedRows ||
      approvedRows.length !== 1
    ) {
      throw new Error(
        "수강신청 상태가 변경되어 승인할 수 없습니다."
      );
    }

    /*
     * 표준 일정 신청 인원 증가
     */
    if (
      enrollmentRequest.enrollment_option_id
    ) {
      const optionId =
        Number(
          enrollmentRequest.enrollment_option_id
        );

      const {
        data: option,
        error: optionReadError,
      } = await supabase
        .from("enrollment_options")
        .select(`
          id,
          enrolled_count,
          capacity
        `)
        .eq("id", optionId)
        .maybeSingle();

      if (optionReadError) {
        console.error(
          "[Enrollment Approval] option read error:",
          optionReadError.message
        );
      }

      if (option) {
        const newCount =
          Number(
            option.enrolled_count ?? 0
          ) + 1;

        const isFull =
          option.capacity !== null &&
          newCount >=
            Number(option.capacity);

        const {
          error: optionUpdateError,
        } = await supabase
          .from("enrollment_options")
          .update({
            enrolled_count:
              newCount,

            is_open:
              !isFull,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", optionId);

        if (optionUpdateError) {
          console.error(
            "[Enrollment Approval] option update error:",
            optionUpdateError.message
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: "approved",
      enrollmentId:
        enrollment.id,
      sessionsCreated:
        sessions.length,
    });
  } catch (error) {
    console.error(
      "[Enrollment Approval Error]",
      error
    );

    /*
     * 승인 도중 오류가 나면
     * 이번 승인으로 생성한 데이터만 복구
     */
    if (
      createdEnrollmentId !== null
    ) {
      await supabase
        .from("class_sessions")
        .delete()
        .eq(
          "enrollment_id",
          createdEnrollmentId
        );

      await supabase
        .from("enrollments")
        .delete()
        .eq(
          "id",
          createdEnrollmentId
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "수강 승인 중 알 수 없는 오류가 발생했습니다.",
      },
      {
        status: 400,
      }
    );
  }
}