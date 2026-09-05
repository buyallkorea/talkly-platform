import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type UpdateClassSessionBody = {
  lessonDate?: string;
  startTime?: string;
  durationMinutes?: number;
  meetingProvider?: string | null;
  meetingUrl?: string | null;
  teacherNotes?: string | null;
};

const ALLOWED_MEETING_PROVIDERS = [
  "zoom",
  "daily",
  "whereby",
  "other",
] as const;

const LOCKED_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
  "held",
  "no_show",
  "not_held",
];

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const { sessionId } = await context.params;

  const parsedSessionId = Number(sessionId);

  if (
    !Number.isInteger(parsedSessionId) ||
    parsedSessionId <= 0
  ) {
    return NextResponse.json(
      {
        error: "올바르지 않은 수업 ID입니다.",
      },
      {
        status: 400,
      }
    );
  }

  const supabase = await createClient();

  /*
   * =========================================================
   * 1. 로그인 확인
   * =========================================================
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * =========================================================
   * 2. 관리자 권한 확인
   * =========================================================
   */
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
        error: "관리자 권한이 필요합니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =========================================================
   * 3. 요청 데이터 확인
   * =========================================================
   */
  let body: UpdateClassSessionBody;

  try {
    body =
      (await request.json()) as UpdateClassSessionBody;
  } catch {
    return NextResponse.json(
      {
        error: "요청 데이터를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =========================================================
   * 4. 현재 수업 조회
   *
   * 여기서 DB의 실제 현재 상태를 다시 읽습니다.
   * 클라이언트가 보내는 status는 신뢰하지 않습니다.
   * =========================================================
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from("class_sessions")
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
      teacher_notes,
      started_at,
      ended_at,
      session_kind,
      makeup_for_session_id,
      makeup_reason
    `)
    .eq("id", parsedSessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      {
        error: sessionError.message,
      },
      {
        status: 400,
      }
    );
  }

  if (!session) {
    return NextResponse.json(
      {
        error: "수업정보를 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * =========================================================
   * 5. 종료시간이 지난 미시작 scheduled 수업 처리
   *
   * 아직 DB가 scheduled인 상태라도
   * scheduled_end가 이미 지났고 시작된 적이 없다면
   * 여기서 not_held로 마감합니다.
   *
   * 과거 수업을 날짜만 미래로 옮겨 되살리는 것을
   * 방지하기 위한 서버 측 안전장치입니다.
   * =========================================================
   */
  let currentStatus = session.status;

  const now = new Date();

  const scheduledEnd =
    new Date(session.scheduled_end);

  const isExpiredUnstarted =
    currentStatus === "scheduled" &&
    !session.started_at &&
    !session.ended_at &&
    !Number.isNaN(scheduledEnd.getTime()) &&
    scheduledEnd.getTime() <= now.getTime();

  if (isExpiredUnstarted) {
    const {
      data: closedSession,
      error: closeError,
    } = await supabase
      .from("class_sessions")
      .update({
        status: "not_held",
        updated_at: now.toISOString(),
      })
      .eq("id", session.id)
      .eq("status", "scheduled")
      .is("started_at", null)
      .lte(
        "scheduled_end",
        now.toISOString()
      )
      .select("status")
      .maybeSingle();

    if (closeError) {
      return NextResponse.json(
        {
          error:
            `미진행 수업 마감 처리 실패: ${closeError.message}`,
        },
        {
          status: 400,
        }
      );
    }

    if (closedSession?.status) {
      currentStatus =
        closedSession.status;
    } else {
      /*
       * 동시에 다른 요청이 상태를 변경했을 가능성이
       * 있으므로 현재 상태를 다시 확인합니다.
       */
      const {
        data: latestSession,
        error: latestError,
      } = await supabase
        .from("class_sessions")
        .select("status")
        .eq("id", session.id)
        .maybeSingle();

      if (latestError) {
        return NextResponse.json(
          {
            error:
              latestError.message,
          },
          {
            status: 400,
          }
        );
      }

      if (!latestSession) {
        return NextResponse.json(
          {
            error:
              "수업정보를 다시 확인할 수 없습니다.",
          },
          {
            status: 404,
          }
        );
      }

      currentStatus =
        latestSession.status;
    }
  }

  /*
   * =========================================================
   * 6. 메모 값 준비
   *
   * 메모는 과거/완료 수업에도 수정할 수 있습니다.
   * =========================================================
   */
  const normalizedTeacherNotes =
    typeof body.teacherNotes === "string"
      ? body.teacherNotes.trim() || null
      : undefined;

  /*
   * =========================================================
   * 7. 일정 변경 요청 여부 확인
   * =========================================================
   */
  const hasScheduleChange =
    body.lessonDate !== undefined ||
    body.startTime !== undefined ||
    body.durationMinutes !== undefined ||
    body.meetingProvider !== undefined ||
    body.meetingUrl !== undefined;

  /*
   * =========================================================
   * 8. 잠긴 수업 상태에서는 원본 일정 변경 금지
   *
   * in_progress
   * completed
   * cancelled
   * held
   * no_show
   * not_held
   *
   * 이 상태에서는 teacher_notes만 변경 가능합니다.
   * =========================================================
   */
  if (
    LOCKED_STATUSES.includes(
      currentStatus
    ) &&
    hasScheduleChange
  ) {
    return NextResponse.json(
      {
        error:
          currentStatus === "not_held"
            ? "미진행으로 마감된 원래 수업의 일정은 변경할 수 없습니다. 보강이 필요한 경우 새 보강수업을 생성해주세요."
            : "이미 진행되었거나 확정 처리된 원래 수업의 일정은 변경할 수 없습니다.",
        status: currentStatus,
      },
      {
        status: 409,
      }
    );
  }

  /*
   * =========================================================
   * 9. scheduled 이외의 알 수 없는 상태도 일정 수정 차단
   * =========================================================
   */
  if (
    hasScheduleChange &&
    currentStatus !== "scheduled"
  ) {
    return NextResponse.json(
      {
        error:
          "현재 상태에서는 수업 일정을 변경할 수 없습니다.",
        status: currentStatus,
      },
      {
        status: 409,
      }
    );
  }

  /*
   * =========================================================
   * 10. scheduled 수업 일정 값 검증
   * =========================================================
   */
  let newScheduledStart =
    session.scheduled_start;

  let newScheduledEnd =
    session.scheduled_end;

  if (hasScheduleChange) {
    const currentStart =
      new Date(session.scheduled_start);

    const currentEnd =
      new Date(session.scheduled_end);

    if (
      Number.isNaN(
        currentStart.getTime()
      ) ||
      Number.isNaN(
        currentEnd.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "기존 수업시간 정보를 확인할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 날짜/시간/수업시간은 세 값이 모두 있어야
     * 안전하게 다시 계산할 수 있습니다.
     */
    if (
      body.lessonDate === undefined ||
      body.startTime === undefined ||
      body.durationMinutes === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "수업일, 시작시간, 수업시간을 모두 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isValidDate(
        body.lessonDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "수업일 형식을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isValidTime(
        body.startTime
      )
    ) {
      return NextResponse.json(
        {
          error:
            "수업 시작시간 형식을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const durationMinutes =
      Number(
        body.durationMinutes
      );

    if (
      !Number.isInteger(
        durationMinutes
      ) ||
      durationMinutes <= 0 ||
      durationMinutes > 180
    ) {
      return NextResponse.json(
        {
          error:
            "수업시간을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 관리자 화면 입력값은 한국시간입니다.
     */
    const startDateTime =
      new Date(
        `${body.lessonDate}T${body.startTime}:00+09:00`
      );

    if (
      Number.isNaN(
        startDateTime.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "수업 시작일시를 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 미래 scheduled 수업만 변경할 수 있습니다.
     */
    if (
      startDateTime.getTime() <=
      Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "수업 일정은 현재 시각 이후로만 변경할 수 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const endDateTime =
      new Date(
        startDateTime.getTime() +
          durationMinutes *
            60 *
            1000
      );

    newScheduledStart =
      startDateTime.toISOString();

    newScheduledEnd =
      endDateTime.toISOString();
  }

  /*
   * =========================================================
   * 11. 화상수업 플랫폼 검증
   *
   * 현재 DB constraint에 맞는 값만 허용합니다.
   * google_meet는 현재 DB constraint에 없으므로
   * 허용하지 않습니다.
   * =========================================================
   */
  let normalizedMeetingProvider:
    | string
    | null
    | undefined =
    undefined;

  if (
    body.meetingProvider !==
    undefined
  ) {
    if (
      body.meetingProvider ===
        null ||
      body.meetingProvider === ""
    ) {
      normalizedMeetingProvider =
        null;
    } else if (
      ALLOWED_MEETING_PROVIDERS.includes(
        body.meetingProvider as
          (typeof ALLOWED_MEETING_PROVIDERS)[number]
      )
    ) {
      normalizedMeetingProvider =
        body.meetingProvider;
    } else {
      return NextResponse.json(
        {
          error:
            "지원하지 않는 화상수업 플랫폼입니다.",
        },
        {
          status: 400,
        }
      );
    }
  }

  const normalizedMeetingUrl =
    typeof body.meetingUrl === "string"
      ? body.meetingUrl.trim() ||
        null
      : body.meetingUrl === null
        ? null
        : undefined;

  /*
   * =========================================================
   * 12. UPDATE payload 생성
   * =========================================================
   */
  const updatePayload: {
    scheduled_start?: string;
    scheduled_end?: string;
    meeting_provider?: string | null;
    meeting_url?: string | null;
    teacher_notes?: string | null;
    updated_at: string;
  } = {
    updated_at:
      new Date().toISOString(),
  };

  if (hasScheduleChange) {
    updatePayload.scheduled_start =
      newScheduledStart;

    updatePayload.scheduled_end =
      newScheduledEnd;
  }

  if (
    normalizedMeetingProvider !==
    undefined
  ) {
    updatePayload.meeting_provider =
      normalizedMeetingProvider;
  }

  if (
    normalizedMeetingUrl !==
    undefined
  ) {
    updatePayload.meeting_url =
      normalizedMeetingUrl;
  }

  if (
    normalizedTeacherNotes !==
    undefined
  ) {
    updatePayload.teacher_notes =
      normalizedTeacherNotes;
  }

  /*
   * 실제로 수정할 내용이 updated_at밖에 없다면
   * 요청 자체를 거부합니다.
   */
  if (
    Object.keys(
      updatePayload
    ).length === 1
  ) {
    return NextResponse.json(
      {
        error:
          "변경할 수업정보가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =========================================================
   * 13. 최종 DB 수정
   *
   * 일정 변경이 포함된 경우에는
   * UPDATE 순간에도 status=scheduled 조건을 다시 걸어
   * 조회 후 수업이 시작되는 race condition을 막습니다.
   * =========================================================
   */
  let updateQuery =
    supabase
      .from("class_sessions")
      .update(updatePayload)
      .eq("id", session.id);

  if (hasScheduleChange) {
    updateQuery =
      updateQuery
        .eq("status", "scheduled")
        .is("started_at", null);
  }

  const {
    data: updatedSession,
    error: updateError,
  } = await updateQuery
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
      teacher_notes,
      started_at,
      ended_at,
      session_kind,
      makeup_for_session_id,
      makeup_reason,
      updated_at
    `)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      {
        error:
          `수업정보 수정 실패: ${updateError.message}`,
      },
      {
        status: 400,
      }
    );
  }

  if (!updatedSession) {
    return NextResponse.json(
      {
        error:
          "수업 상태가 변경되어 수정할 수 없습니다. 화면을 새로고침한 후 다시 확인해주세요.",
      },
      {
        status: 409,
      }
    );
  }

  return NextResponse.json({
    success: true,
    session: updatedSession,
  });
}