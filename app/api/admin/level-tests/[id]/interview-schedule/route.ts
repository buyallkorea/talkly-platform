import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const INTERVIEW_DURATION_MINUTES = 20;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ScheduleBody = {
  testerUserId?: string;
  scheduledAt?: string;
  meetingProvider?: string | null;
  meetingUrl?: string | null;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const levelTestId = Number(id);

    if (
      !Number.isInteger(levelTestId) ||
      levelTestId <= 0
    ) {
      return NextResponse.json(
        {
          error: "잘못된 레벨테스트 번호입니다.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        { status: 401 }
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
          error: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const body =
      (await request.json()) as ScheduleBody;

    const testerUserId =
      body.testerUserId?.trim() || "";

    const scheduledAt =
      body.scheduledAt?.trim() || "";

    const meetingProvider =
      body.meetingProvider?.trim() || null;

    const meetingUrl =
      body.meetingUrl?.trim() || null;

    if (!testerUserId) {
      return NextResponse.json(
        {
          error: "담당 강사를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        {
          error: "테스트 일시를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    const start = new Date(scheduledAt);

    if (
      Number.isNaN(start.getTime())
    ) {
      return NextResponse.json(
        {
          error: "테스트 일시가 올바르지 않습니다.",
        },
        { status: 400 }
      );
    }

    if (start.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error:
            "지난 시간에는 레벨테스트를 배정할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const end = new Date(
      start.getTime() +
        INTERVIEW_DURATION_MINUTES *
          60 *
          1000
    );

    const admin = createAdminClient();

    const {
      data: levelTest,
      error: levelTestError,
    } = await admin
      .from("level_tests")
      .select(`
        id,
        interview_required,
        status
      `)
      .eq("id", levelTestId)
      .maybeSingle();

    if (levelTestError) {
      return NextResponse.json(
        {
          error: levelTestError.message,
        },
        { status: 400 }
      );
    }

    if (!levelTest) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (!levelTest.interview_required) {
      return NextResponse.json(
        {
          error:
            "먼저 원어민 추가 테스트 대상으로 저장해주세요.",
        },
        { status: 400 }
      );
    }

    const {
      data: teacher,
      error: teacherError,
    } = await admin
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name,
        is_active
      `)
      .eq("user_id", testerUserId)
      .maybeSingle();

    if (
      teacherError ||
      !teacher ||
      !teacher.is_active
    ) {
      return NextResponse.json(
        {
          error:
            "활동 중인 강사 정보를 확인할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const seoulParts =
      getSeoulDateParts(start);

    const dateString =
      `${seoulParts.year}-` +
      `${pad(seoulParts.month)}-` +
      `${pad(seoulParts.day)}`;

    const startTime =
      `${pad(seoulParts.hour)}:` +
      `${pad(seoulParts.minute)}:00`;

    const endParts =
      getSeoulDateParts(end);

    const endTime =
      `${pad(endParts.hour)}:` +
      `${pad(endParts.minute)}:00`;

    /*
     * JS getDay():
     * 0=Sunday ... 6=Saturday
     *
     * TALKLY teacher_availability도
     * 동일한 규칙을 사용합니다.
     */
    const dayOfWeek =
      getSeoulDayOfWeek(start);

    /*
     * 1. TALKLY 전체 운영 차단일 확인
     */
    const {
      data: blocks,
      error: blockError,
    } = await admin
      .from("class_operation_blocks")
      .select(`
        id,
        start_time,
        end_time,
        reason
      `)
      .eq("block_date", dateString)
      .eq("is_active", true);

    if (blockError) {
      return NextResponse.json(
        {
          error: blockError.message,
        },
        { status: 400 }
      );
    }

    for (const block of blocks || []) {
      if (
        !block.start_time ||
        !block.end_time
      ) {
        return NextResponse.json(
          {
            error:
              block.reason
                ? `해당 날짜는 수업 운영이 중단되어 있습니다. (${block.reason})`
                : "해당 날짜는 수업 운영이 중단되어 있습니다.",
          },
          { status: 409 }
        );
      }

      if (
        timeRangesOverlap(
          startTime,
          endTime,
          block.start_time,
          block.end_time
        )
      ) {
        return NextResponse.json(
          {
            error:
              block.reason
                ? `선택한 시간은 운영 차단 시간입니다. (${block.reason})`
                : "선택한 시간은 운영 차단 시간입니다.",
          },
          { status: 409 }
        );
      }
    }

    /*
     * 2. 강사의 정규 근무시간 확인
     */
    const {
      data: recurring,
      error: recurringError,
    } = await admin
      .from("teacher_availability")
      .select(`
        id,
        start_time,
        end_time,
        effective_from,
        effective_to
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .eq("day_of_week", dayOfWeek)
      .eq("is_available", true);

    if (recurringError) {
      return NextResponse.json(
        {
          error: recurringError.message,
        },
        { status: 400 }
      );
    }

    const recurringAvailable =
      (recurring || []).some((row) => {
        if (
          row.effective_from &&
          dateString <
            row.effective_from
        ) {
          return false;
        }

        if (
          row.effective_to &&
          dateString >
            row.effective_to
        ) {
          return false;
        }

        return (
          startTime >= row.start_time &&
          endTime <= row.end_time
        );
      });

    /*
     * 3. 특정일 예외 확인
     */
    const {
      data: exceptions,
      error: exceptionError,
    } = await admin
      .from(
        "teacher_availability_exceptions"
      )
      .select(`
        id,
        exception_type,
        start_time,
        end_time,
        reason
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .eq(
        "exception_date",
        dateString
      )
      .eq("is_active", true);

    if (exceptionError) {
      return NextResponse.json(
        {
          error: exceptionError.message,
        },
        { status: 400 }
      );
    }

    let availableByException = false;

    for (const exception of
      exceptions || []) {
      if (
        exception.exception_type ===
        "unavailable"
      ) {
        if (
          !exception.start_time ||
          !exception.end_time
        ) {
          return NextResponse.json(
            {
              error:
                exception.reason
                  ? `해당 강사는 이 날짜에 근무할 수 없습니다. (${exception.reason})`
                  : "해당 강사는 이 날짜에 근무할 수 없습니다.",
            },
            { status: 409 }
          );
        }

        if (
          timeRangesOverlap(
            startTime,
            endTime,
            exception.start_time,
            exception.end_time
          )
        ) {
          return NextResponse.json(
            {
              error:
                exception.reason
                  ? `해당 강사는 선택한 시간에 근무할 수 없습니다. (${exception.reason})`
                  : "해당 강사는 선택한 시간에 근무할 수 없습니다.",
            },
            { status: 409 }
          );
        }
      }

      if (
        exception.exception_type ===
        "available"
      ) {
        if (
          !exception.start_time ||
          !exception.end_time
        ) {
          availableByException = true;
        } else if (
          startTime >=
            exception.start_time &&
          endTime <=
            exception.end_time
        ) {
          availableByException = true;
        }
      }
    }

    if (
      !recurringAvailable &&
      !availableByException
    ) {
      return NextResponse.json(
        {
          error:
            "선택한 시간은 해당 강사의 근무 가능시간이 아닙니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 4. 기존 정규수업 충돌 확인
     */
    const {
      data: classConflicts,
      error: classConflictError,
    } = await admin
      .from("class_sessions")
      .select(`
        id,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq(
        "teacher_user_id",
        testerUserId
      )
      .lt(
        "scheduled_start",
        end.toISOString()
      )
      .gt(
        "scheduled_end",
        start.toISOString()
      )
      .not(
        "status",
        "in",
        '("cancelled","canceled")'
      )
      .limit(1);

    if (classConflictError) {
      return NextResponse.json(
        {
          error:
            classConflictError.message,
        },
        { status: 400 }
      );
    }

    if (
      classConflicts &&
      classConflicts.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "선택한 시간에 이미 정규수업이 배정되어 있습니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 5. 다른 원어민 레벨테스트와 충돌 확인
     */
    const {
      data: interviewConflicts,
      error: interviewConflictError,
    } = await admin
      .from("level_test_interviews")
      .select(`
        id,
        level_test_id,
        scheduled_at,
        duration_minutes,
        status
      `)
      .eq(
        "tester_user_id",
        testerUserId
      )
      .neq(
        "level_test_id",
        levelTestId
      )
      .not(
        "status",
        "in",
        '("cancelled","canceled","completed")'
      );

    if (interviewConflictError) {
      return NextResponse.json(
        {
          error:
            interviewConflictError.message,
        },
        { status: 400 }
      );
    }

    const hasInterviewConflict =
      (interviewConflicts || []).some(
        (item) => {
          if (!item.scheduled_at) {
            return false;
          }

          const otherStart =
            new Date(
              item.scheduled_at
            );

          const otherDuration =
            item.duration_minutes || 20;

          const otherEnd =
            new Date(
              otherStart.getTime() +
                otherDuration *
                  60 *
                  1000
            );

          return (
            start < otherEnd &&
            end > otherStart
          );
        }
      );

    if (hasInterviewConflict) {
      return NextResponse.json(
        {
          error:
            "선택한 시간에 해당 강사의 다른 레벨테스트가 이미 예약되어 있습니다.",
        },
        { status: 409 }
      );
    }

    /*
     * 모든 검증 통과 후 저장
     */
    const now =
      new Date().toISOString();

    const {
  data: existingInterview,
  error: existingError,
} = await admin
  .from("level_test_interviews")
  .select(`
    id,
    status,
    scheduled_at,
    created_at
  `)
  .eq(
    "level_test_id",
    levelTestId
  )
  .order(
    "created_at",
    {
      ascending: false,
    }
  )
  .limit(1)
  .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: existingError.message,
        },
        { status: 400 }
      );
    }

    const interviewPayload = {
      level_test_id: levelTestId,
      tester_user_id:
        testerUserId,
      status: "scheduled",
      scheduled_at:
        start.toISOString(),
      duration_minutes:
        INTERVIEW_DURATION_MINUTES,
      meeting_provider:
        meetingProvider,
      meeting_url:
        meetingUrl,
      updated_at: now,
    };

    if (existingInterview?.id) {
      const { error } = await admin
        .from("level_test_interviews")
        .update(interviewPayload)
        .eq(
          "id",
          existingInterview.id
        );

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 400 }
        );
      }
    } else {
      const { error } = await admin
        .from("level_test_interviews")
        .insert({
          ...interviewPayload,
          created_at: now,
        });

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    const {
      error: levelTestUpdateError,
    } = await admin
      .from("level_tests")
      .update({
        tester_user_id:
          testerUserId,
        scheduled_at:
          start.toISOString(),
        interview_status:
          "scheduled",
        status:
          "interview_scheduled",
        updated_at: now,
      })
      .eq("id", levelTestId);

    if (levelTestUpdateError) {
      return NextResponse.json(
        {
          error:
            levelTestUpdateError.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "원어민 화상 레벨테스트 일정이 저장되었습니다.",
      scheduledAt:
        start.toISOString(),
      durationMinutes:
        INTERVIEW_DURATION_MINUTES,
      teacher: {
        userId:
          teacher.user_id,
        displayName:
          teacher.display_name,
      },
    });
  } catch (error) {
    console.error(
      "LEVEL TEST INTERVIEW SCHEDULE API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "원어민 테스트 일정 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

function pad(value: number) {
  return String(value).padStart(
    2,
    "0"
  );
}

function getSeoulDateParts(
  date: Date
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SEOUL_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const map =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function getSeoulDayOfWeek(
  date: Date
) {
  const weekday =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          SEOUL_TIME_ZONE,
        weekday: "short",
      }
    ).format(date);

  const map: Record<
    string,
    number
  > = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday];
}

function timeToMinutes(
  value: string
) {
  const [hour, minute] =
    value.split(":");

  return (
    Number(hour) * 60 +
    Number(minute)
  );
}

function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const aStart =
    timeToMinutes(startA);

  const aEnd =
    timeToMinutes(endA);

  const bStart =
    timeToMinutes(startB);

  const bEnd =
    timeToMinutes(endB);

  return (
    aStart < bEnd &&
    aEnd > bStart
  );
}