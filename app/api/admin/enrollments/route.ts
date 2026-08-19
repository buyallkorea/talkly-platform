import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type ScheduleItem = {
  weekday: string;
  time: string;
};

type CreateEnrollmentBody = {
  childId: number;
  courseId: number;
  teacherUserId?: string | null;

  lessonDurationMinutes: number;
  lessonsPerWeek: number;

  startDate: string;
  courseWeeks: number;

  schedule: ScheduleItem[];
};

type CreatedSession = {
  id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
};

type CreatedZoomMeeting = {
  sessionId: number;
  meetingId: string;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(
  date: Date,
  days: number
) {
  const copy = new Date(date);

  copy.setUTCDate(
    copy.getUTCDate() + days
  );

  return copy;
}

function parseDateOnly(
  value: string
) {
  return new Date(
    `${value}T00:00:00.000Z`
  );
}

function buildSeoulDateTime(
  date: Date,
  time: string
) {
  const dateString =
    formatDateOnly(date);

  return `${dateString}T${time}:00+09:00`;
}

function calculateEndDate(
  startDate: Date,
  weeks: number
) {
  return addDays(
    startDate,
    weeks * 7 - 1
  );
}

function createSessions({
  startDate,
  weeks,
  schedule,
  durationMinutes,
}: {
  startDate: string;
  weeks: number;
  schedule: ScheduleItem[];
  durationMinutes: number;
}) {
  const start =
    parseDateOnly(startDate);

  const endExclusive =
    addDays(
      start,
      weeks * 7
    );

  const sessions: {
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    is_weekend: boolean;
  }[] = [];

  let current =
    new Date(start);

  while (
    current <
    endExclusive
  ) {
    const currentWeekday =
      current.getUTCDay();

    for (
      const item of schedule
    ) {
      const weekdayNumber =
        WEEKDAY_MAP[
          item.weekday
        ];

      if (
        weekdayNumber ===
        undefined
      ) {
        continue;
      }

      if (
        currentWeekday !==
        weekdayNumber
      ) {
        continue;
      }

      const startDateTime =
        buildSeoulDateTime(
          current,
          item.time
        );

      const startTimestamp =
        new Date(
          startDateTime
        );

      const endTimestamp =
        new Date(
          startTimestamp.getTime() +
            durationMinutes *
              60 *
              1000
        );

      sessions.push({
        lesson_number:
          sessions.length + 1,

        scheduled_start:
          startTimestamp.toISOString(),

        scheduled_end:
          endTimestamp.toISOString(),

        is_weekend:
          currentWeekday === 0 ||
          currentWeekday === 6,
      });
    }

    current =
      addDays(
        current,
        1
      );
  }

  return sessions;
}

/*
 * =========================================================
 * Zoom Server-to-Server OAuth
 * =========================================================
 */
async function getZoomAccessToken() {
  const accountId =
    process.env.ZOOM_ACCOUNT_ID;

  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (
    !accountId ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Zoom API 환경변수가 설정되지 않았습니다."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
        accountId
      )}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      `Zoom access token 발급 실패: ${JSON.stringify(
        data
      )}`
    );
  }

  return data.access_token as string;
}

/*
 * =========================================================
 * Zoom Meeting 삭제
 *
 * 수강 생성 도중 오류 발생 시
 * 이미 만들어진 Zoom Meeting을 정리합니다.
 * =========================================================
 */
async function deleteZoomMeeting(
  accessToken: string,
  meetingId: string
) {
  const response =
    await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(
        meetingId
      )}`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  /*
   * 이미 삭제됐거나 없는 경우까지
   * 롤백 실패로 처리할 필요는 없습니다.
   */
  if (
    !response.ok &&
    response.status !== 404
  ) {
    console.error(
      "[Enrollment Zoom] Zoom delete failed:",
      response.status
    );
  }
}

/*
 * =========================================================
 * 하나의 class_session용 Zoom Meeting 생성
 * =========================================================
 */
async function createZoomMeeting({
  accessToken,
  hostEmail,
  studentName,
  courseName,
  lessonNumber,
  scheduledStart,
  scheduledEnd,
}: {
  accessToken: string;
  hostEmail: string;
  studentName: string;
  courseName: string;
  lessonNumber: number;
  scheduledStart: string;
  scheduledEnd: string;
}) {
  const start =
    new Date(
      scheduledStart
    );

  const end =
    new Date(
      scheduledEnd
    );

  const durationMinutes =
    Math.max(
      1,
      Math.round(
        (
          end.getTime() -
          start.getTime()
        ) /
          60000
      )
    );

  const response =
    await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(
        hostEmail
      )}/meetings`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            topic:
              `TALKLY ${studentName} - ${lessonNumber}회차 - ${courseName}`,

            type: 2,

            start_time:
              scheduledStart,

            duration:
              durationMinutes,

            timezone:
              "Asia/Seoul",

            agenda:
              "TALKLY online English class",

            settings: {
              host_video:
                true,

              participant_video:
                true,

              join_before_host:
                false,

              mute_upon_entry:
                true,

              /*
               * 기존 connect-session과 동일하게
               * TALKLY 자체 대기화면을 사용합니다.
               */
              waiting_room:
                false,

              auto_recording:
                "none",
            },
          }),

        cache:
          "no-store",
      }
    );

  const meeting =
    await response.json();

  if (
    !response.ok ||
    !meeting.id ||
    !meeting.join_url
  ) {
    throw new Error(
      `Zoom Meeting 생성 실패 (${lessonNumber}회차): ${JSON.stringify(
        meeting
      )}`
    );
  }

  return {
    meetingId:
      String(
        meeting.id
      ),

    meetingUrl:
      meeting.join_url as string,
  };
}

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  /*
   * =======================================================
   * 1. 관리자 확인
   * =======================================================
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

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq(
      "id",
      user.id
    )
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !==
      "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "관리자 권한이 필요합니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =======================================================
   * 2. 요청값 확인
   * =======================================================
   */
  let body:
    | CreateEnrollmentBody
    | null =
    null;

  try {
    body =
      (await request.json()) as
        CreateEnrollmentBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "요청 데이터를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    childId,
    courseId,
    teacherUserId,
    lessonDurationMinutes,
    lessonsPerWeek,
    startDate,
    courseWeeks,
    schedule,
  } = body;

  if (
    !childId ||
    !courseId
  ) {
    return NextResponse.json(
      {
        error:
          "학생과 수강 과정을 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !lessonDurationMinutes ||
    lessonDurationMinutes <=
      0
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

  if (
    !lessonsPerWeek ||
    lessonsPerWeek <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "주당 수업 횟수를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (!startDate) {
    return NextResponse.json(
      {
        error:
          "수강 시작일을 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !courseWeeks ||
    courseWeeks <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "수강기간을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      schedule
    ) ||
    schedule.length ===
      0
  ) {
    return NextResponse.json(
      {
        error:
          "수업 요일과 시간을 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    schedule.length !==
    lessonsPerWeek
  ) {
    return NextResponse.json(
      {
        error:
          "선택한 수업 요일 수와 주당 수업 횟수가 일치하지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 3. 관리자 수강신청 설정 확인
   * =======================================================
   */
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .select(`
      allowed_weekdays,
      allowed_time_slots,
      allowed_lessons_per_week,
      allowed_duration_minutes,
      min_course_weeks,
      max_course_weeks
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
          settingsError?.message ||
          "수강신청 설정을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !settings.allowed_duration_minutes.includes(
      lessonDurationMinutes
    )
  ) {
    return NextResponse.json(
      {
        error:
          "현재 허용되지 않은 수업시간입니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !settings.allowed_lessons_per_week.includes(
      lessonsPerWeek
    )
  ) {
    return NextResponse.json(
      {
        error:
          "현재 허용되지 않은 주당 수업 횟수입니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    courseWeeks <
      settings.min_course_weeks ||
    courseWeeks >
      settings.max_course_weeks
  ) {
    return NextResponse.json(
      {
        error:
          `수강기간은 ${settings.min_course_weeks}주부터 ${settings.max_course_weeks}주까지 선택할 수 있습니다.`,
      },
      {
        status: 400,
      }
    );
  }

  for (
    const item of
    schedule
  ) {
    if (
      !settings.allowed_weekdays.includes(
        item.weekday
      )
    ) {
      return NextResponse.json(
        {
          error:
            `${item.weekday}은 현재 선택할 수 없는 수업 요일입니다.`,
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !settings.allowed_time_slots.includes(
        item.time
      )
    ) {
      return NextResponse.json(
        {
          error:
            `${item.time}은 현재 선택할 수 없는 수업 시간입니다.`,
        },
        {
          status:
            400,
        }
      );
    }
  }

  /*
   * =======================================================
   * 4. 학생 확인
   *
   * student_user_id도 같이 가져옵니다.
   * 이미 학생 로그인 계정이 있는 경우
   * 신규 수강도 바로 연결합니다.
   * =======================================================
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      is_active,
      student_user_id
    `)
    .eq(
      "id",
      childId
    )
    .single();

  if (
    childError ||
    !child ||
    !child.is_active
  ) {
    return NextResponse.json(
      {
        error:
          "학생 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 5. 과정 확인
   * =======================================================
   */
  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      is_active
    `)
    .eq(
      "id",
      courseId
    )
    .single();

  if (
    courseError ||
    !course ||
    !course.is_active
  ) {
    return NextResponse.json(
      {
        error:
          "수강 과정을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 6. 담당강사 확인
   * =======================================================
   */
  if (!teacherUserId) {
    return NextResponse.json(
      {
        error:
          "Zoom 수업 생성을 위해 담당 강사를 선택해주세요.",
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
    .from(
      "teacher_profiles"
    )
    .select(`
      user_id,
      display_name
    `)
    .eq(
      "user_id",
      teacherUserId
    )
    .maybeSingle();

  if (
    teacherError ||
    !teacher
  ) {
    return NextResponse.json(
      {
        error:
          teacherError?.message ||
          "담당 강사 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 7. 가격 정책 확인
   * =======================================================
   */
  const {
    data: pricing,
    error: pricingError,
  } = await supabase
    .from(
      "course_pricing"
    )
    .select(`
      price_per_lesson,
      weekend_multiplier,
      is_active
    `)
    .eq(
      "course_id",
      courseId
    )
    .eq(
      "lesson_duration_minutes",
      lessonDurationMinutes
    )
    .eq(
      "is_active",
      true
    )
    .single();

  if (
    pricingError ||
    !pricing
  ) {
    return NextResponse.json(
      {
        error:
          "선택한 과정의 수강료가 등록되어 있지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 8. 실제 수업 회차 계산
   * =======================================================
   */
  const sessions =
    createSessions({
      startDate,

      weeks:
        courseWeeks,

      schedule,

      durationMinutes:
        lessonDurationMinutes,
    });

  if (
    sessions.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "생성 가능한 수업 일정이 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const calculatedEndDate =
    formatDateOnly(
      calculateEndDate(
        parseDateOnly(
          startDate
        ),
        courseWeeks
      )
    );

  const weekdayLessonCount =
    sessions.filter(
      (session) =>
        !session.is_weekend
    ).length;

  const weekendLessonCount =
    sessions.filter(
      (session) =>
        session.is_weekend
    ).length;

  const pricePerLesson =
    Number(
      pricing.price_per_lesson
    );

  const weekendMultiplier =
    Number(
      pricing.weekend_multiplier
    );

  const weekdayPrice =
    weekdayLessonCount *
    pricePerLesson;

  const weekendPrice =
    weekendLessonCount *
    pricePerLesson *
    weekendMultiplier;

  const estimatedPrice =
    Math.round(
      weekdayPrice +
        weekendPrice
    );

  /*
   * =======================================================
   * 9. enrollment 생성
   * =======================================================
   */
  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .insert({
      child_id:
        childId,

      /*
       * 중요:
       * 이미 학생계정이 연결된 자녀라면
       * 신규 수강도 자동 연결
       */
      student_user_id:
        child.student_user_id ??
        null,

      course_id:
        courseId,

      teacher_user_id:
        teacherUserId,

      status:
        "active",

      start_date:
        startDate,

      end_date:
        calculatedEndDate,

      lessons_per_week:
        lessonsPerWeek,

      total_lessons:
        sessions.length,
    })
    .select("id")
    .single();

  if (
    enrollmentError ||
    !enrollment
  ) {
    return NextResponse.json(
      {
        error:
          enrollmentError?.message ||
          "수강정보 생성에 실패했습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =======================================================
   * 10. class_sessions 생성
   *
   * 이후 Zoom 연결을 위해
   * 생성된 ID를 반드시 반환받습니다.
   * =======================================================
   */
  const sessionRows =
    sessions.map(
      (session) => ({
        enrollment_id:
          enrollment.id,

        lesson_number:
          session.lesson_number,

        scheduled_start:
          session.scheduled_start,

        scheduled_end:
          session.scheduled_end,

        status:
          "scheduled",

        meeting_provider:
          "zoom",
      })
    );

  const {
    data:
      createdSessionsData,
    error:
      sessionsError,
  } = await supabase
    .from(
      "class_sessions"
    )
    .insert(
      sessionRows
    )
    .select(`
      id,
      lesson_number,
      scheduled_start,
      scheduled_end
    `);

  if (
    sessionsError ||
    !createdSessionsData
  ) {
    await supabase
      .from(
        "enrollments"
      )
      .delete()
      .eq(
        "id",
        enrollment.id
      );

    return NextResponse.json(
      {
        error:
          `수업 일정 생성 실패: ${
            sessionsError?.message ||
            "생성된 수업정보를 확인할 수 없습니다."
          }`,
      },
      {
        status: 400,
      }
    );
  }

  const createdSessions =
    createdSessionsData as
      CreatedSession[];

  /*
   * =======================================================
   * 11. Zoom Meeting 자동 생성
   * =======================================================
   */
  const hostEmail =
    process.env.ZOOM_HOST_EMAIL;

  if (!hostEmail) {
    /*
     * Zoom이 없으면
     * 만들어진 DB도 되돌립니다.
     */
    await supabase
      .from(
        "class_sessions"
      )
      .delete()
      .eq(
        "enrollment_id",
        enrollment.id
      );

    await supabase
      .from(
        "enrollments"
      )
      .delete()
      .eq(
        "id",
        enrollment.id
      );

    return NextResponse.json(
      {
        error:
          "ZOOM_HOST_EMAIL 환경변수가 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  let accessToken:
    string | null =
    null;

  const createdZoomMeetings:
    CreatedZoomMeeting[] =
    [];

  try {
    accessToken =
      await getZoomAccessToken();

    /*
     * 한 번에 Promise.all을 쓰지 않고
     * 순차 생성합니다.
     *
     * 실패 시 어느 회차까지 생성됐는지
     * 정확히 추적하고 롤백하기 쉽습니다.
     */
    for (
      const session of
      createdSessions
    ) {
      const meeting =
        await createZoomMeeting({
          accessToken,

          hostEmail,

          studentName:
            child.name,

          courseName:
            course.name,

          lessonNumber:
            session.lesson_number,

          scheduledStart:
            session.scheduled_start,

          scheduledEnd:
            session.scheduled_end,
        });

      createdZoomMeetings.push({
        sessionId:
          session.id,

        meetingId:
          meeting.meetingId,
      });

      const {
        error:
          meetingUpdateError,
      } = await supabase
        .from(
          "class_sessions"
        )
        .update({
          meeting_provider:
            "zoom",

          meeting_id:
            meeting.meetingId,

          meeting_url:
            meeting.meetingUrl,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          session.id
        );

      if (
        meetingUpdateError
      ) {
        /*
         * 방금 만든 Zoom도
         * 롤백 대상에 이미 들어가 있으므로
         * catch에서 모두 정리합니다.
         */
        throw new Error(
          `${session.lesson_number}회차 Zoom DB 연결 실패: ${meetingUpdateError.message}`
        );
      }
    }
  } catch (zoomError) {
    console.error(
      "[Enrollment] Zoom auto-create failed:",
      zoomError
    );

    /*
     * -----------------------------------------------
     * 1. 이미 만든 Zoom Meeting 전부 삭제
     * -----------------------------------------------
     */
    if (accessToken) {
      for (
        const zoom of
        createdZoomMeetings
      ) {
        try {
          await deleteZoomMeeting(
            accessToken,
            zoom.meetingId
          );
        } catch (
          deleteError
        ) {
          console.error(
            "[Enrollment] Zoom rollback error:",
            zoom.meetingId,
            deleteError
          );
        }
      }
    }

    /*
     * -----------------------------------------------
     * 2. class_sessions 제거
     * -----------------------------------------------
     */
    await supabase
      .from(
        "class_sessions"
      )
      .delete()
      .eq(
        "enrollment_id",
        enrollment.id
      );

    /*
     * -----------------------------------------------
     * 3. enrollment 제거
     * -----------------------------------------------
     */
    await supabase
      .from(
        "enrollments"
      )
      .delete()
      .eq(
        "id",
        enrollment.id
      );

    return NextResponse.json(
      {
        error:
          zoomError instanceof Error
            ? `수강정보 생성 중 Zoom 자동 연결 실패: ${zoomError.message}`
            : "수강정보 생성 중 Zoom 자동 연결에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * =======================================================
   * 12. 완료
   * =======================================================
   */
  return NextResponse.json({
    success:
      true,

    enrollmentId:
      enrollment.id,

    student: {
      id:
        child.id,

      name:
        child.name,

      studentUserId:
        child.student_user_id ??
        null,
    },

    teacher: {
      userId:
        teacher.user_id,

      name:
        teacher.display_name ??
        "담당 강사",
    },

    course: {
      id:
        course.id,

      name:
        course.name,
    },

    schedule: {
      startDate,

      endDate:
        calculatedEndDate,

      weeks:
        courseWeeks,

      lessonsPerWeek,

      totalLessons:
        sessions.length,

      weekdayLessonCount,

      weekendLessonCount,

      lessonDurationMinutes,
    },

    pricing: {
      pricePerLesson,

      weekendMultiplier,

      weekdayPrice,

      weekendPrice,

      estimatedPrice,
    },

    zoom: {
      connected:
        true,

      meetingCount:
        createdZoomMeetings.length,
    },
  });
}