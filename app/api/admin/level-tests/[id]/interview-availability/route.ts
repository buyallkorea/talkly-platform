import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const INTERVIEW_DURATION_MINUTES = 20;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  testerUserId?: string;
  date?: string;
};

type TimeRange = {
  start_time: string | null;
  end_time: string | null;
};

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":");

  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  return aStart < bEnd && aEnd > bStart;
}

function getDayOfWeek(dateString: string) {
  /*
   * 정오 UTC를 사용해서 날짜 경계 영향을 피합니다.
   * 0=Sunday ... 6=Saturday
   */
  return new Date(`${dateString}T12:00:00Z`).getUTCDay();
}

function seoulLocalToUtc(
  dateString: string,
  timeString: string
) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const [hour, minute] = timeString
    .split(":")
    .map(Number);

  /*
   * Asia/Seoul = UTC+9
   */
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - 9,
      minute,
      0,
      0
    )
  );
}

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
        {
          status: 400,
        }
      );
    }

    /*
     * 관리자 인증
     */
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
          error: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      (await request.json()) as RequestBody;

    const testerUserId =
      body.testerUserId?.trim() || "";

    const dateString =
      body.date?.trim() || "";

    if (!testerUserId) {
      return NextResponse.json(
        {
          error: "담당 강사를 선택해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ) {
      return NextResponse.json(
        {
          error: "테스트 날짜를 선택해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 과거 날짜 차단
     */
    const todaySeoul = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(new Date());

    if (dateString < todaySeoul) {
      return NextResponse.json(
        {
          error:
            "지난 날짜에는 레벨테스트를 배정할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const admin = createAdminClient();

    /*
     * 레벨테스트 확인
     */
    const {
      data: levelTest,
      error: levelTestError,
    } = await admin
      .from("level_tests")
      .select(`
        id,
        interview_required
      `)
      .eq("id", levelTestId)
      .maybeSingle();

    if (levelTestError) {
      return NextResponse.json(
        {
          error: levelTestError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (!levelTest) {
      return NextResponse.json(
        {
          error:
            "레벨테스트 정보를 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (!levelTest.interview_required) {
      return NextResponse.json(
        {
          error:
            "먼저 원어민 추가 테스트 대상으로 저장해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 강사 확인
     */
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
        {
          status: 400,
        }
      );
    }

    const dayOfWeek =
      getDayOfWeek(dateString);

    /*
     * 정규 가용시간
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
        {
          status: 400,
        }
      );
    }

    const validRecurring =
      (recurring || []).filter((row) => {
        if (
          row.effective_from &&
          dateString < row.effective_from
        ) {
          return false;
        }

        if (
          row.effective_to &&
          dateString > row.effective_to
        ) {
          return false;
        }

        return true;
      });

    /*
     * 특정일 강사 예외
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
        {
          status: 400,
        }
      );
    }

    /*
     * 전체 운영 차단
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
        {
          status: 400,
        }
      );
    }

    /*
     * 해당 날짜의 UTC 범위
     */
    const dayStart =
      seoulLocalToUtc(
        dateString,
        "00:00"
      );

    const nextDate = new Date(
      dayStart.getTime() +
        24 * 60 * 60 * 1000
    );

    /*
     * 정규수업
     */
    const {
      data: classSessions,
      error: classSessionError,
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
      .gte(
        "scheduled_start",
        dayStart.toISOString()
      )
      .lt(
        "scheduled_start",
        nextDate.toISOString()
      );

    if (classSessionError) {
      return NextResponse.json(
        {
          error: classSessionError.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 해당 강사의 레벨테스트
     */
    const {
      data: interviews,
      error: interviewError,
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
      .gte(
        "scheduled_at",
        dayStart.toISOString()
      )
      .lt(
        "scheduled_at",
        nextDate.toISOString()
      );

    if (interviewError) {
      return NextResponse.json(
        {
          error: interviewError.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 10:00 ~ 21:30까지
     * 30분 단위 후보 생성
     *
     * 실제 강사 근무시간이 더 짧으면
     * 아래 검증에서 자동 제외됩니다.
     */
    const candidates: string[] = [];

    for (
      let minute = 10 * 60;
      minute <= 21 * 60 + 30;
      minute += 30
    ) {
      candidates.push(
        minutesToTime(minute)
      );
    }

    const availableSlots =
      candidates.filter(
        (slotStart) => {
          const startMinutes =
            timeToMinutes(slotStart);

          const slotEnd =
            minutesToTime(
              startMinutes +
                INTERVIEW_DURATION_MINUTES
            );

          /*
           * 1. 정규 근무시간 안인지 확인
           */
          let available =
            validRecurring.some(
              (row) =>
                Boolean(
                  row.start_time &&
                    row.end_time &&
                    slotStart >=
                      row.start_time &&
                    slotEnd <=
                      row.end_time
                )
            );

          /*
           * 2. 특정일 available 예외
           */
          for (const exception of
            exceptions || []) {
            if (
              exception.exception_type !==
              "available"
            ) {
              continue;
            }

            if (
              !exception.start_time ||
              !exception.end_time
            ) {
              available = true;
              continue;
            }

            if (
              slotStart >=
                exception.start_time &&
              slotEnd <=
                exception.end_time
            ) {
              available = true;
            }
          }

          if (!available) {
            return false;
          }

          /*
           * 3. unavailable 예외
           */
          for (const exception of
            exceptions || []) {
            if (
              exception.exception_type !==
              "unavailable"
            ) {
              continue;
            }

            /*
             * 시간 없는 unavailable =
             * 종일 근무 불가
             */
            if (
              !exception.start_time ||
              !exception.end_time
            ) {
              return false;
            }

            if (
              timeRangesOverlap(
                slotStart,
                slotEnd,
                exception.start_time,
                exception.end_time
              )
            ) {
              return false;
            }
          }

          /*
           * 4. TALKLY 전체 운영 차단
           */
          for (const block of
            blocks || []) {
            if (
              !block.start_time ||
              !block.end_time
            ) {
              return false;
            }

            if (
              timeRangesOverlap(
                slotStart,
                slotEnd,
                block.start_time,
                block.end_time
              )
            ) {
              return false;
            }
          }

          const slotStartDate =
            seoulLocalToUtc(
              dateString,
              slotStart
            );

          const slotEndDate = new Date(
            slotStartDate.getTime() +
              INTERVIEW_DURATION_MINUTES *
                60 *
                1000
          );

          /*
           * 오늘 날짜라면 이미 지난 슬롯 제거
           */
          if (
            slotStartDate.getTime() <=
            Date.now()
          ) {
            return false;
          }

          /*
           * 5. 정규수업 충돌
           */
          const classConflict =
            (classSessions || []).some(
              (session) => {
                if (
                  !session.scheduled_start ||
                  !session.scheduled_end
                ) {
                  return false;
                }

                if (
                  session.status ===
                    "cancelled" ||
                  session.status ===
                    "canceled"
                ) {
                  return false;
                }

                const existingStart =
                  new Date(
                    session.scheduled_start
                  );

                const existingEnd =
                  new Date(
                    session.scheduled_end
                  );

                return (
                  slotStartDate <
                    existingEnd &&
                  slotEndDate >
                    existingStart
                );
              }
            );

          if (classConflict) {
            return false;
          }

          /*
           * 6. 다른 레벨테스트 충돌
           *
           * 현재 수정 중인 levelTestId의
           * 기존 일정은 제외합니다.
           */
          const interviewConflict =
            (interviews || []).some(
              (item) => {
                if (
                  item.level_test_id ===
                  levelTestId
                ) {
                  return false;
                }

                if (!item.scheduled_at) {
                  return false;
                }

                if (
                  item.status ===
                    "cancelled" ||
                  item.status ===
                    "canceled" ||
                  item.status ===
                    "completed"
                ) {
                  return false;
                }

                const existingStart =
                  new Date(
                    item.scheduled_at
                  );

                const duration =
                  item.duration_minutes ||
                  INTERVIEW_DURATION_MINUTES;

                const existingEnd =
                  new Date(
                    existingStart.getTime() +
                      duration *
                        60 *
                        1000
                  );

                return (
                  slotStartDate <
                    existingEnd &&
                  slotEndDate >
                    existingStart
                );
              }
            );

          if (interviewConflict) {
            return false;
          }

          return true;
        }
      );

    return NextResponse.json({
      ok: true,
      date: dateString,
      teacher: {
        userId: teacher.user_id,
        displayName:
          teacher.display_name,
      },
      durationMinutes:
        INTERVIEW_DURATION_MINUTES,
      slots: availableSlots,
    });
  } catch (error) {
    console.error(
      "LEVEL TEST INTERVIEW AVAILABILITY ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "가능한 테스트 시간을 확인하는 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}