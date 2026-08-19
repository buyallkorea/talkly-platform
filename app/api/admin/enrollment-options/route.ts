import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type ScheduleItem = {
  weekday: string;
  time: string;
};

type Body = {
  title: string;
  targetGroup: string;
  courseId: number;

  lessonDurationMinutes: number;
  lessonsPerWeek: number;

  schedule: ScheduleItem[];

  courseWeeks: number;
  startDate: string;

  capacity: number | null;

  teacherUserId: string | null;
  curriculumName: string | null;
  adminNote: string | null;

  isPublished: boolean;
  isOpen: boolean;
};

const ALLOWED_TARGET_GROUPS = [
  "age_5_7_phonics",

  "elementary_1",
  "elementary_2",
  "elementary_3",
  "elementary_4",
  "elementary_5",
  "elementary_6",

  "middle_1",
  "middle_2",
  "middle_3",

  "high_1",
  "high_2",
  "high_3",

  "university",
  "adult",
  "senior",
];

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
  return new Date(
    `${value}T00:00:00.000Z`
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);

  copy.setUTCDate(
    copy.getUTCDate() + days
  );

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

function calculateSessions({
  startDate,
  weeks,
  schedule,
}: {
  startDate: string;
  weeks: number;
  schedule: ScheduleItem[];
}) {
  const start = parseDate(startDate);

  const endExclusive =
    addDays(start, weeks * 7);

  let current = new Date(start);

  let total = 0;
  let weekday = 0;
  let weekend = 0;

  while (current < endExclusive) {
    const dayNumber =
      current.getUTCDay();

    for (const item of schedule) {
      if (
        DAY_NUMBERS[item.weekday] !==
        dayNumber
      ) {
        continue;
      }

      total += 1;

      if (
        dayNumber === 0 ||
        dayNumber === 6
      ) {
        weekend += 1;
      } else {
        weekday += 1;
      }
    }

    current = addDays(current, 1);
  }

  return {
    total,
    weekday,
    weekend,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  /*
   * 관리자 확인
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (
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

  let body: Body;

  try {
    body =
      (await request.json()) as Body;
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

  if (!body.title?.trim()) {
    return NextResponse.json(
      {
        error: "일정명을 입력해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !ALLOWED_TARGET_GROUPS.includes(
      body.targetGroup
    )
  ) {
    return NextResponse.json(
      {
        error:
          "학년/대상을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !body.courseId ||
    !body.lessonDurationMinutes ||
    !body.lessonsPerWeek ||
    !body.courseWeeks ||
    !body.startDate
  ) {
    return NextResponse.json(
      {
        error:
          "수업 기본정보를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(body.schedule) ||
    body.schedule.length !==
      body.lessonsPerWeek
  ) {
    return NextResponse.json(
      {
        error:
          "주당 횟수와 수업 일정 수가 일치하지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const days =
    body.schedule.map(
      (item) => item.weekday
    );

  if (
    days.some(
      (day) =>
        DAY_NUMBERS[day] === undefined
    )
  ) {
    return NextResponse.json(
      {
        error:
          "수업 요일을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    new Set(days).size !==
    days.length
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

  /*
   * 관리자 설정 확인
   */
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from("enrollment_settings")
    .select(`
      allowed_weekdays,
      allowed_time_slots,
      allowed_lessons_per_week,
      allowed_duration_minutes,
      min_course_weeks,
      max_course_weeks
    `)
    .eq("setting_key", "default")
    .single();

  if (
    settingsError ||
    !settings
  ) {
    return NextResponse.json(
      {
        error:
          "수강신청 설정을 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !settings.allowed_duration_minutes.includes(
      body.lessonDurationMinutes
    )
  ) {
    return NextResponse.json(
      {
        error:
          "허용되지 않은 수업시간입니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !settings.allowed_lessons_per_week.includes(
      body.lessonsPerWeek
    )
  ) {
    return NextResponse.json(
      {
        error:
          "허용되지 않은 주당 횟수입니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    body.courseWeeks <
      settings.min_course_weeks ||
    body.courseWeeks >
      settings.max_course_weeks
  ) {
    return NextResponse.json(
      {
        error:
          `수강기간은 ${settings.min_course_weeks}주 ~ ${settings.max_course_weeks}주 사이여야 합니다.`,
      },
      {
        status: 400,
      }
    );
  }

  for (const item of body.schedule) {
    if (
      !settings.allowed_weekdays.includes(
        item.weekday
      )
    ) {
      return NextResponse.json(
        {
          error:
            "허용되지 않은 요일이 포함되어 있습니다.",
        },
        {
          status: 400,
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
            "허용되지 않은 시간이 포함되어 있습니다.",
        },
        {
          status: 400,
        }
      );
    }
  }

  /*
   * 과정 확인
   */
  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select("id, name, is_active")
    .eq("id", body.courseId)
    .single();

  if (
    courseError ||
    !course ||
    !course.is_active
  ) {
    return NextResponse.json(
      {
        error:
          "과정 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 가격 확인
   */
  const {
    data: pricing,
    error: pricingError,
  } = await supabase
    .from("course_pricing")
    .select(`
      price_per_lesson,
      weekend_multiplier
    `)
    .eq("course_id", body.courseId)
    .eq(
      "lesson_duration_minutes",
      body.lessonDurationMinutes
    )
    .eq("is_active", true)
    .single();

  if (
    pricingError ||
    !pricing
  ) {
    return NextResponse.json(
      {
        error:
          "해당 과정의 수강료가 등록되어 있지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const counts =
    calculateSessions({
      startDate:
        body.startDate,

      weeks:
        body.courseWeeks,

      schedule:
        body.schedule,
    });

  if (counts.total <= 0) {
    return NextResponse.json(
      {
        error:
          "생성 가능한 수업 회차가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const pricePerLesson =
    Number(
      pricing.price_per_lesson
    );

  const weekendMultiplier =
    Number(
      pricing.weekend_multiplier
    );

  const estimatedPrice =
    Math.round(
      counts.weekday *
        pricePerLesson +
        counts.weekend *
          pricePerLesson *
          weekendMultiplier
    );

  const endDate =
    formatDate(
      addDays(
        parseDate(
          body.startDate
        ),
        body.courseWeeks * 7 - 1
      )
    );

  const preferredTimes:
    Record<string, string> = {};

  for (const item of body.schedule) {
    preferredTimes[item.weekday] =
      item.time;
  }

  /*
   * 표준 수강 가능 일정 저장
   */
  const {
    data,
    error,
  } = await supabase
    .from("enrollment_options")
    .insert({
      title:
        body.title.trim(),

      course_id:
        body.courseId,

      target_group:
        body.targetGroup,

      lesson_duration_minutes:
        body.lessonDurationMinutes,

      lessons_per_week:
        body.lessonsPerWeek,

      preferred_days:
        body.schedule.map(
          (item) =>
            item.weekday
        ),

      preferred_times:
        preferredTimes,

      course_weeks:
        body.courseWeeks,

      start_date:
        body.startDate,

      end_date:
        endDate,

      total_lessons:
        counts.total,

      price_per_lesson:
        pricePerLesson,

      weekend_multiplier:
        weekendMultiplier,

      weekday_lesson_count:
        counts.weekday,

      weekend_lesson_count:
        counts.weekend,

      estimated_price:
        estimatedPrice,

      capacity:
        body.capacity,

      enrolled_count:
        0,

      teacher_user_id:
        body.teacherUserId,

      curriculum_name:
        body.curriculumName,

      admin_note:
        body.adminNote,

      is_published:
        body.isPublished,

      is_open:
        body.isOpen,

      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "수강 가능 일정 저장에 실패했습니다.",
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,
    optionId: data.id,
  });
}