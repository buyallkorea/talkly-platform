import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RequestBody = {
  date: string;
  durationMinutes: number;
  teacherUserId?: string | null;
};

type TimeRange = {
  start: number;
  end: number;
};

type TeacherRow = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
  specialties: string[] | null;
  years_experience: number | null;
};

type AvailabilityRow = {
  teacher_user_id: string;
  start_time: string;
  end_time: string;
  effective_from: string | null;
  effective_to: string | null;
};

type ExceptionRow = {
  teacher_user_id: string;
  exception_type: "available" | "unavailable";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type OperationBlockRow = {
  id: number;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BookedSessionRow = {
  id: number;
  teacher_user_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

function timeToMinutes(value: string) {
  const [hour, minute] = value
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number
) {
  return startA < endB && endA > startB;
}

function isInsideRange(
  lessonStart: number,
  lessonEnd: number,
  range: TimeRange
) {
  return (
    lessonStart >= range.start &&
    lessonEnd <= range.end
  );
}

function getKoreaDayOfWeek(dateText: string) {
  const date = new Date(
    `${dateText}T12:00:00+09:00`
  );

  return date.getDay();
}

function getWeekdayName(dayOfWeek: number) {
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return names[dayOfWeek];
}

function getKoreaDayBounds(dateText: string) {
  const start = new Date(
    `${dateText}T00:00:00+09:00`
  );

  const next = new Date(
    `${dateText}T00:00:00+09:00`
  );

  next.setDate(
    next.getDate() + 1
  );

  return {
    start: start.toISOString(),
    end: next.toISOString(),
  };
}

function getKoreaTimeMinutes(value: string) {
  const date = new Date(value);

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).formatToParts(date);

  const hour = Number(
    parts.find(
      (part) =>
        part.type === "hour"
    )?.value ?? 0
  );

  const minute = Number(
    parts.find(
      (part) =>
        part.type === "minute"
    )?.value ?? 0
  );

  return hour * 60 + minute;
}

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  /*
   * 로그인 확인
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * 학부모 확인
   */
  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    return NextResponse.json(
      {
        error:
          "학부모 계정에서만 조회할 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  let body: RequestBody;

  try {
    body =
      (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "조회 조건을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const dateText =
    String(body.date ?? "");

  const durationMinutes =
    Number(
      body.durationMinutes
    );

  const teacherUserId =
    body.teacherUserId
      ? String(
          body.teacherUserId
        )
      : null;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateText
    )
  ) {
    return NextResponse.json(
      {
        error:
          "수업 날짜를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 내부 가용시간 계산용 Service Role 클라이언트
   * - 학부모 인증/권한 확인은 위의 supabase 사용
   * - 강사 근무시간/예외/운영차단/수업정보는 서버에서만 조회
   */
  const adminClient =
    createAdminClient();

  /*
   * 수강 운영 설정
   */
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .select(`
      parent_self_enrollment_enabled,
      allowed_weekdays,
      allowed_time_slots,
      allowed_duration_minutes,
      allow_student_choose_teacher
    `)
    .eq(
      "setting_key",
      "default"
    )
    .single();

  if (
    settingsError ||
    !settings
  ) {
    return NextResponse.json(
      {
        error:
          "수강 운영 설정을 불러올 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    !settings.parent_self_enrollment_enabled
  ) {
    return NextResponse.json(
      {
        error:
          "현재 수강신청이 열려 있지 않습니다.",
      },
      {
        status: 403,
      }
    );
  }

  const allowedDurations: number[] =
    (
      settings.allowed_duration_minutes ??
      []
    ).map(
      (value: number) =>
        Number(value)
    );

  if (
    !allowedDurations.includes(
      durationMinutes
    )
  ) {
    return NextResponse.json(
      {
        error:
          "현재 선택할 수 없는 수업시간입니다.",
      },
      {
        status: 400,
      }
    );
  }

  const dayOfWeek =
    getKoreaDayOfWeek(
      dateText
    );

  const weekdayName =
    getWeekdayName(
      dayOfWeek
    );

  const allowedWeekdays: string[] =
    settings.allowed_weekdays ??
    [];

  if (
    !allowedWeekdays.includes(
      weekdayName
    )
  ) {
    return NextResponse.json({
      success: true,
      date: dateText,
      dayOfWeek,
      weekdayName,
      durationMinutes,
      availableTeachers: [],
      totalAvailableSlots: 0,
      message:
        "해당 요일은 현재 수업을 운영하지 않습니다.",
    });
  }

  /*
   * TALKLY 전체 운영 차단
   */
  const {
    data: operationBlocksData,
    error: blockError,
  } = await adminClient
    .from(
      "class_operation_blocks"
    )
    .select(`
      id,
      start_time,
      end_time,
      reason
    `)
    .eq(
      "block_date",
      dateText
    )
    .eq(
      "is_active",
      true
    );

  if (blockError) {
    return NextResponse.json(
      {
        error:
          "운영 차단 정보를 확인할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const operationBlocks =
    (operationBlocksData ??
      []) as OperationBlockRow[];

  const wholeDayBlock =
    operationBlocks.find(
      (block) =>
        !block.start_time &&
        !block.end_time
    );

  if (wholeDayBlock) {
    return NextResponse.json({
      success: true,
      date: dateText,
      dayOfWeek,
      weekdayName,
      durationMinutes,
      availableTeachers: [],
      totalAvailableSlots: 0,
      message:
        wholeDayBlock.reason ||
        "해당 날짜는 수업을 운영하지 않습니다.",
    });
  }

  /*
   * 활성 강사 조회
   */
  let teacherQuery =
    adminClient
      .from(
        "teacher_profiles"
      )
      .select(`
        user_id,
        display_name,
        nationality,
        specialties,
        years_experience
      `)
      .eq(
        "is_active",
        true
      );

  if (
    teacherUserId &&
    settings.allow_student_choose_teacher
  ) {
    teacherQuery =
      teacherQuery.eq(
        "user_id",
        teacherUserId
      );
  }

  const {
    data: teachersData,
    error: teacherError,
  } =
    await teacherQuery;

  if (teacherError) {
    return NextResponse.json(
      {
        error:
          "강사 정보를 불러올 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const teachers =
    (teachersData ??
      []) as TeacherRow[];

  if (
    teachers.length === 0
  ) {
    return NextResponse.json({
      success: true,
      date: dateText,
      dayOfWeek,
      weekdayName,
      durationMinutes,
      availableTeachers: [],
      totalAvailableSlots: 0,
    });
  }

  const teacherIds =
    teachers.map(
      (teacher) =>
        teacher.user_id
    );

  /*
   * 정규 근무 가능시간
   */
  const {
    data: regularAvailabilityData,
    error: availabilityError,
  } = await adminClient
    .from(
      "teacher_availability"
    )
    .select(`
      teacher_user_id,
      start_time,
      end_time,
      effective_from,
      effective_to
    `)
    .in(
      "teacher_user_id",
      teacherIds
    )
    .eq(
      "day_of_week",
      dayOfWeek
    )
    .eq(
      "is_available",
      true
    );

  if (
    availabilityError
  ) {
    return NextResponse.json(
      {
        error:
          "강사 근무시간을 확인할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const regularAvailability =
    (regularAvailabilityData ??
      []) as AvailabilityRow[];

  /*
   * 해당 날짜 강사별 예외 일정
   */
  const {
    data: exceptionsData,
    error: exceptionError,
  } = await adminClient
    .from(
      "teacher_availability_exceptions"
    )
    .select(`
      teacher_user_id,
      exception_type,
      start_time,
      end_time,
      reason
    `)
    .in(
      "teacher_user_id",
      teacherIds
    )
    .eq(
      "exception_date",
      dateText
    )
    .eq(
      "is_active",
      true
    );

  if (
    exceptionError
  ) {
    return NextResponse.json(
      {
        error:
          "강사 예외일정을 확인할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const exceptions =
    (exceptionsData ??
      []) as ExceptionRow[];

  /*
   * 해당 날짜 기존 수업
   */
  const dayBounds =
    getKoreaDayBounds(
      dateText
    );

  const {
    data: bookedSessionsData,
    error: bookedError,
  } = await adminClient
    .from(
      "class_sessions"
    )
    .select(`
      id,
      teacher_user_id,
      scheduled_start,
      scheduled_end,
      status
    `)
    .in(
      "teacher_user_id",
      teacherIds
    )
    .gte(
      "scheduled_start",
      dayBounds.start
    )
    .lt(
      "scheduled_start",
      dayBounds.end
    );

  if (bookedError) {
    return NextResponse.json(
      {
        error:
          "기존 수업일정을 확인할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  const bookedSessions =
    (bookedSessionsData ??
      []) as BookedSessionRow[];

  /*
   * 취소 수업은 가용시간을
   * 차단하지 않음
   */
  const activeBookedSessions =
    bookedSessions.filter(
      (session) =>
        ![
          "cancelled",
          "canceled",
        ].includes(
          String(
            session.status
          ).toLowerCase()
        )
    );

  /*
   * 운영 설정의 시작시간 후보
   */
  let candidateTimes: string[] =
    (
      settings.allowed_time_slots ??
      []
    )
      .map(
        (time: string) =>
          String(time).slice(
            0,
            5
          )
      )
      .filter(
        (time: string) =>
          Boolean(time)
      );

  /*
   * 25분:
   * 30분 단위 시작
   */
  if (
    durationMinutes === 25
  ) {
    candidateTimes =
      candidateTimes.filter(
        (time: string) => {
          const minutes =
            timeToMinutes(
              time
            );

          return (
            minutes % 30 ===
            0
          );
        }
      );
  }

  /*
   * 50분:
   * 정시 시작
   */
  if (
    durationMinutes === 50
  ) {
    candidateTimes =
      candidateTimes.filter(
        (time: string) => {
          const minutes =
            timeToMinutes(
              time
            );

          return (
            minutes % 60 ===
            0
          );
        }
      );
  }

  const result =
    teachers
      .map(
        (teacher) => {
          /*
           * 해당 날짜에 유효한
           * 정규 근무시간
           */
          const regularRanges: TimeRange[] =
            regularAvailability
              .filter(
                (row) => {
                  if (
                    row.teacher_user_id !==
                    teacher.user_id
                  ) {
                    return false;
                  }

                  if (
                    row.effective_from &&
                    dateText <
                      row.effective_from
                  ) {
                    return false;
                  }

                  if (
                    row.effective_to &&
                    dateText >
                      row.effective_to
                  ) {
                    return false;
                  }

                  return true;
                }
              )
              .map(
                (row) => ({
                  start:
                    timeToMinutes(
                      row.start_time
                    ),
                  end:
                    timeToMinutes(
                      row.end_time
                    ),
                })
              );

          const teacherExceptions =
            exceptions.filter(
              (row) =>
                row.teacher_user_id ===
                teacher.user_id
            );

          /*
           * 임시 추가 근무 가능시간
           */
          const additionalRanges: TimeRange[] =
            teacherExceptions
              .filter(
                (row) =>
                  row.exception_type ===
                    "available" &&
                  row.start_time &&
                  row.end_time
              )
              .map(
                (row) => ({
                  start:
                    timeToMinutes(
                      row.start_time as string
                    ),
                  end:
                    timeToMinutes(
                      row.end_time as string
                    ),
                })
              );

          let availableRanges: TimeRange[] =
            [
              ...regularRanges,
              ...additionalRanges,
            ];

          /*
           * 종일 근무불가 예외
           */
          const unavailableAllDay =
            teacherExceptions.some(
              (row) =>
                row.exception_type ===
                  "unavailable" &&
                !row.start_time &&
                !row.end_time
            );

          if (
            unavailableAllDay
          ) {
            availableRanges =
              [];
          }

          /*
           * 특정 시간 근무불가
           */
          const unavailableRanges: TimeRange[] =
            teacherExceptions
              .filter(
                (row) =>
                  row.exception_type ===
                    "unavailable" &&
                  row.start_time &&
                  row.end_time
              )
              .map(
                (row) => ({
                  start:
                    timeToMinutes(
                      row.start_time as string
                    ),
                  end:
                    timeToMinutes(
                      row.end_time as string
                    ),
                })
              );

          const teacherBookings =
            activeBookedSessions.filter(
              (session) =>
                session.teacher_user_id ===
                teacher.user_id
            );

          const availableTimes =
            candidateTimes.filter(
              (time: string) => {
                const start =
                  timeToMinutes(
                    time
                  );

                const end =
                  start +
                  durationMinutes;

                /*
                 * 정규 근무시간 또는
                 * 임시 추가 근무시간 안에
                 * 수업 전체가 들어가야 함
                 */
                const withinAvailability =
                  availableRanges.some(
                    (range) =>
                      isInsideRange(
                        start,
                        end,
                        range
                      )
                  );

                if (
                  !withinAvailability
                ) {
                  return false;
                }

                /*
                 * 강사 개인 예외 차단
                 */
                const hitsTeacherBlock =
                  unavailableRanges.some(
                    (range) =>
                      overlaps(
                        start,
                        end,
                        range.start,
                        range.end
                      )
                  );

                if (
                  hitsTeacherBlock
                ) {
                  return false;
                }

                /*
                 * TALKLY 전체 부분 운영차단
                 */
                const hitsOperationBlock =
                  operationBlocks.some(
                    (block) => {
                      if (
                        !block.start_time ||
                        !block.end_time
                      ) {
                        return false;
                      }

                      return overlaps(
                        start,
                        end,
                        timeToMinutes(
                          block.start_time
                        ),
                        timeToMinutes(
                          block.end_time
                        )
                      );
                    }
                  );

                if (
                  hitsOperationBlock
                ) {
                  return false;
                }

                /*
                 * 해당 강사의 기존 수업과 충돌
                 */
                const hitsExistingClass =
                  teacherBookings.some(
                    (session) => {
                      const bookedStart =
                        getKoreaTimeMinutes(
                          session.scheduled_start
                        );

                      const bookedEnd =
                        getKoreaTimeMinutes(
                          session.scheduled_end
                        );

                      return overlaps(
                        start,
                        end,
                        bookedStart,
                        bookedEnd
                      );
                    }
                  );

                return !hitsExistingClass;
              }
            );

          return {
            teacherUserId:
              teacher.user_id,

            displayName:
              teacher.display_name ??
              "Teacher",

            nationality:
              teacher.nationality ??
              null,

            specialties:
              teacher.specialties ??
              [],

            yearsExperience:
              teacher.years_experience ??
              null,

            availableTimes,
          };
        }
      )
      .filter(
        (teacher) =>
          teacher.availableTimes
            .length > 0
      );

  const totalAvailableSlots =
    result.reduce(
      (
        total,
        teacher
      ) =>
        total +
        teacher
          .availableTimes
          .length,
      0
    );

  return NextResponse.json({
    success: true,
    date:
      dateText,
    dayOfWeek,
    weekdayName,
    durationMinutes,
    availableTeachers:
      result,
    totalAvailableSlots,
  });
}