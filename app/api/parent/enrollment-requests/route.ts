import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type StandardRequestBody = {
  requestType?: "standard";
  childId: number;
  enrollmentOptionId: number;
};

type CustomRequestBody = {
  requestType: "custom";
  childId: number;
  levelTestId?: number | null;
  courseId: number;
  lessonDurationMinutes: number;
  lessonsPerWeek: number;
  preferredDays: string[];
  preferredTimes: Record<string, string>;
  teacherPreferenceType: "any" | "specific";
  preferredTeacherUserId?: string | null;
  startDate?: string | null;
};

type RequestBody =
  | StandardRequestBody
  | CustomRequestBody;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function isPositiveInteger(
  value: unknown
) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number > 0
  );
}

function isDateText(
  value: unknown
) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  );
}

function isTimeText(
  value: unknown
) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(
      value
    )
  );
}

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  /*
   * =====================================================
   * 1. 로그인 확인
   * =====================================================
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
   * =====================================================
   * 2. 학부모 확인
   * =====================================================
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
          "학부모 계정에서만 신청할 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * =====================================================
   * 3. 수강 운영 설정
   * =====================================================
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
      allowed_lessons_per_week,
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
    !settings ||
    !settings.parent_self_enrollment_enabled
  ) {
    return NextResponse.json(
      {
        error:
          "현재 학부모 수강신청이 열려 있지 않습니다.",
      },
      {
        status: 403,
      }
    );
  }

  let body:
    RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "신청 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const childId =
    Number(body.childId);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "자녀 정보를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * =====================================================
   * 4. 자기 자녀인지 확인
   * =====================================================
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(
      "id, name, is_active"
    )
    .eq("id", childId)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .single();

  if (
    childError ||
    !child
  ) {
    return NextResponse.json(
      {
        error:
          "자녀 정보를 확인할 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * =====================================================
   * 5. 맞춤 신청
   * =====================================================
   */
  if (
    body.requestType ===
    "custom"
  ) {
    const courseId =
      Number(
        body.courseId
      );

    const durationMinutes =
      Number(
        body.lessonDurationMinutes
      );

    const lessonsPerWeek =
      Number(
        body.lessonsPerWeek
      );

    const preferredDays =
      Array.isArray(
        body.preferredDays
      )
        ? body.preferredDays.map(
            String
          )
        : [];

    const preferredTimes =
      body.preferredTimes &&
      typeof body.preferredTimes ===
        "object"
        ? body.preferredTimes
        : {};

    const teacherPreferenceType =
      body.teacherPreferenceType;

    const preferredTeacherUserId =
      body.preferredTeacherUserId
        ? String(
            body.preferredTeacherUserId
          )
        : null;

    const startDate =
      body.startDate &&
      isDateText(
        body.startDate
      )
        ? body.startDate
        : null;

    if (
      !isPositiveInteger(
        courseId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "교육과정을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedDurations =
      (
        settings.allowed_duration_minutes ??
        []
      ).map(Number);

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

    const allowedLessons =
      (
        settings.allowed_lessons_per_week ??
        []
      ).map(Number);

    if (
      !allowedLessons.includes(
        lessonsPerWeek
      )
    ) {
      return NextResponse.json(
        {
          error:
            "현재 선택할 수 없는 주당 수업 횟수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      preferredDays.length !==
      lessonsPerWeek
    ) {
      return NextResponse.json(
        {
          error:
            `주 ${lessonsPerWeek}회 수업은 희망 요일을 정확히 ${lessonsPerWeek}개 선택해야 합니다.`,
        },
        {
          status: 400,
        }
      );
    }

    const uniqueDays =
      Array.from(
        new Set(
          preferredDays
        )
      );

    if (
      uniqueDays.length !==
      preferredDays.length
    ) {
      return NextResponse.json(
        {
          error:
            "같은 요일을 중복 선택할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedWeekdays =
      (
        settings.allowed_weekdays ??
        []
      ).map(String);

    const invalidDay =
      preferredDays.find(
        (day) =>
          !WEEKDAYS.includes(
            day as
              (typeof WEEKDAYS)[number]
          ) ||
          !allowedWeekdays.includes(
            day
          )
      );

    if (invalidDay) {
      return NextResponse.json(
        {
          error:
            "현재 운영하지 않는 요일이 포함되어 있습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      preferredDays.includes(
        "Saturday"
      ) &&
      preferredDays.includes(
        "Sunday"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "토요일과 일요일은 동시에 선택할 수 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    for (
      const day of
      preferredDays
    ) {
      const time =
        preferredTimes[
          day
        ];

      if (
        !isTimeText(
          time
        )
      ) {
        return NextResponse.json(
          {
            error:
              `${day} 수업 희망시간을 확인해주세요.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    if (
      teacherPreferenceType !==
        "any" &&
      teacherPreferenceType !==
        "specific"
    ) {
      return NextResponse.json(
        {
          error:
            "강사 선택 방식을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      teacherPreferenceType ===
        "specific"
    ) {
      if (
        !settings.allow_student_choose_teacher
      ) {
        return NextResponse.json(
          {
            error:
              "현재는 특정 강사를 직접 선택할 수 없습니다.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !preferredTeacherUserId
      ) {
        return NextResponse.json(
          {
            error:
              "희망 강사를 선택해주세요.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * 과정 유효성
     */
    const {
      data: course,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id, name")
      .eq(
        "id",
        courseId
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

    if (
      courseError ||
      !course
    ) {
      return NextResponse.json(
        {
          error:
            "현재 신청할 수 없는 교육과정입니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 특정 강사 유효성
     */
    if (
      teacherPreferenceType ===
        "specific" &&
      preferredTeacherUserId
    ) {
      const adminClient =
        createAdminClient();

      const {
        data: teacher,
        error:
          teacherError,
      } = await adminClient
        .from(
          "teacher_profiles"
        )
        .select(
          "user_id, is_active"
        )
        .eq(
          "user_id",
          preferredTeacherUserId
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (
        teacherError ||
        !teacher
      ) {
        return NextResponse.json(
          {
            error:
              "현재 선택할 수 없는 강사입니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * 레벨테스트 추천 스냅샷
     * - body의 추천값은 신뢰하지 않음
     * - levelTestId가 유효하고 최종확정된 경우만 서버에서 읽음
     */
    let levelTestId:
      number | null = null;

    let recommendedCourseId:
      number | null = null;

    let finalLevelSnapshot:
      string | null = null;

    if (
      body.levelTestId !==
        undefined &&
      body.levelTestId !== null
    ) {
      const parsedLevelTestId =
        Number(
          body.levelTestId
        );

      if (
        isPositiveInteger(
          parsedLevelTestId
        )
      ) {
        const {
          data: levelTest,
        } = await supabase
          .from(
            "level_tests"
          )
          .select(`
            id,
            status,
            final_level,
            final_course_id
          `)
          .eq(
            "id",
            parsedLevelTestId
          )
          .eq(
            "parent_user_id",
            user.id
          )
          .eq(
            "child_id",
            childId
          )
          .maybeSingle();

        if (
          levelTest &&
          levelTest.status ===
            "completed" &&
          levelTest.final_level &&
          levelTest.final_course_id
        ) {
          levelTestId =
            levelTest.id;

          recommendedCourseId =
            Number(
              levelTest.final_course_id
            );

          finalLevelSnapshot =
            levelTest.final_level;
        }
      }
    }

    /*
     * 동일 자녀의 처리 중인 맞춤신청 중복 방지
     */
    const {
      data:
        existingCustom,
    } = await supabase
      .from(
        "enrollment_requests"
      )
      .select(
        "id, status"
      )
      .eq(
        "applicant_user_id",
        user.id
      )
      .eq(
        "child_id",
        childId
      )
      .eq(
        "request_type",
        "custom"
      )
      .in(
        "status",
        [
          "pending",
          "approved",
        ]
      )
      .limit(1)
      .maybeSingle();

    if (
      existingCustom
    ) {
      return NextResponse.json(
        {
          error:
            "이미 처리 중인 맞춤 수강신청이 있습니다.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from(
        "enrollment_requests"
      )
      .insert({
        applicant_user_id:
          user.id,

        child_id:
          childId,

        request_type:
          "custom",

        enrollment_option_id:
          null,

        course_id:
          courseId,

        level_test_id:
          levelTestId,

        recommended_course_id:
          recommendedCourseId,

        final_level_snapshot:
          finalLevelSnapshot,

        lesson_duration_minutes:
          durationMinutes,

        lessons_per_week:
          lessonsPerWeek,

        preferred_days:
          preferredDays,

        preferred_times:
          preferredTimes,

        teacher_preference_type:
          teacherPreferenceType,

        preferred_teacher_user_id:
          teacherPreferenceType ===
            "specific"
            ? preferredTeacherUserId
            : null,

        start_date:
          startDate,

        end_date:
          null,

        total_lessons:
          null,

        weekday_lesson_count:
          0,

        weekend_lesson_count:
          0,

        price_per_lesson:
          null,

        weekend_multiplier:
          1.5,

        estimated_price:
          null,

        status:
          "pending",

        assigned_teacher_user_id:
          null,

        assigned_days:
          null,

        assigned_times:
          null,

        assigned_lesson_duration_minutes:
          null,

        assigned_lessons_per_week:
          null,

        assigned_at:
          null,

        assignment_confirmed_at:
          null,

        assigned_curriculum:
          null,

        admin_note:
          null,

        updated_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

    if (
      insertError ||
      !inserted
    ) {
      return NextResponse.json(
        {
          error:
            insertError?.message ||
            "맞춤 수강신청 저장에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      requestType:
        "custom",
      requestId:
        inserted.id,
    });
  }

  /*
   * =====================================================
   * 6. 기존 표준 일정 신청
   * =====================================================
   */
  const optionId =
    Number(
      (
        body as
          StandardRequestBody
      ).enrollmentOptionId
    );

  if (
    !Number.isInteger(
      optionId
    ) ||
    optionId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "자녀와 수업 일정을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: option,
    error: optionError,
  } = await supabase
    .from(
      "enrollment_options"
    )
    .select(`
      id,
      course_id,
      lesson_duration_minutes,
      lessons_per_week,
      preferred_days,
      preferred_times,
      start_date,
      end_date,
      total_lessons,
      price_per_lesson,
      weekend_multiplier,
      weekday_lesson_count,
      weekend_lesson_count,
      estimated_price,
      capacity,
      enrolled_count,
      is_published,
      is_open
    `)
    .eq(
      "id",
      optionId
    )
    .eq(
      "is_published",
      true
    )
    .eq(
      "is_open",
      true
    )
    .single();

  if (
    optionError ||
    !option
  ) {
    return NextResponse.json(
      {
        error:
          "현재 신청할 수 없는 일정입니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    option.capacity !==
      null &&
    option.enrolled_count >=
      option.capacity
  ) {
    return NextResponse.json(
      {
        error:
          "해당 일정은 정원이 마감되었습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: existing,
  } = await supabase
    .from(
      "enrollment_requests"
    )
    .select("id, status")
    .eq(
      "applicant_user_id",
      user.id
    )
    .eq(
      "child_id",
      childId
    )
    .eq(
      "enrollment_option_id",
      optionId
    )
    .in(
      "status",
      [
        "pending",
        "approved",
      ]
    )
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "이미 신청한 수업 일정입니다.",
      },
      {
        status: 409,
      }
    );
  }

  const preferredTimes =
    option.preferred_times ??
    {};

  const {
    data: inserted,
    error: insertError,
  } = await supabase
    .from(
      "enrollment_requests"
    )
    .insert({
      applicant_user_id:
        user.id,

      child_id:
        childId,

      request_type:
        "standard",

      enrollment_option_id:
        option.id,

      course_id:
        option.course_id,

      lesson_duration_minutes:
        option.lesson_duration_minutes,

      lessons_per_week:
        option.lessons_per_week,

      preferred_days:
        option.preferred_days,

      preferred_times:
        preferredTimes,

      start_date:
        option.start_date,

      end_date:
        option.end_date,

      total_lessons:
        option.total_lessons,

      weekday_lesson_count:
        option.weekday_lesson_count,

      weekend_lesson_count:
        option.weekend_lesson_count,

      price_per_lesson:
        option.price_per_lesson,

      weekend_multiplier:
        option.weekend_multiplier,

      estimated_price:
        option.estimated_price,

      status:
        "pending",

      assigned_teacher_user_id:
        null,

      assigned_curriculum:
        null,

      admin_note:
        null,

      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (
    insertError ||
    !inserted
  ) {
    return NextResponse.json(
      {
        error:
          insertError?.message ||
          "수강신청 저장에 실패했습니다.",
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,
    requestType:
      "standard",
    requestId:
      inserted.id,
  });
}