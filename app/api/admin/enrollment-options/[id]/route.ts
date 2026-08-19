import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type ScheduleItem = {
  weekday: string;
  time: string;
};

type UpdateBody = {
  title: string;
  targetGroup: string;

  courseId: number;

  lessonDurationMinutes: number;
  lessonsPerWeek: number;

  startDate: string;
  courseWeeks: number;

  schedule: ScheduleItem[];

  capacity: number | null;

  teacherUserId: string | null;
  curriculumName: string | null;

  adminNote: string | null;

  isPublished: boolean;
  isOpen: boolean;
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
  return new Date(
    `${value}T00:00:00.000Z`
  );
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

function formatDate(date: Date) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateSessions(
  startDate: string,
  weeks: number,
  schedule: ScheduleItem[]
) {
  const start =
    parseDate(startDate);

  const end =
    addDays(
      start,
      weeks * 7
    );

  let current =
    new Date(start);

  let total = 0;
  let weekday = 0;
  let weekend = 0;

  while (current < end) {
    const dayNumber =
      current.getUTCDay();

    for (const item of schedule) {
      if (
        DAY_NUMBERS[
          item.weekday
        ] !== dayNumber
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

    current =
      addDays(current, 1);
  }

  return {
    total,
    weekday,
    weekend,
  };
}

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      error:
        NextResponse.json(
          {
            error:
              "로그인이 필요합니다.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    return {
      supabase,
      error:
        NextResponse.json(
          {
            error:
              "관리자 권한이 필요합니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  return {
    supabase,
    error: null,
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
  const { id } =
    await context.params;

  const optionId =
    Number(id);

  if (
    !Number.isInteger(
      optionId
    )
  ) {
    return NextResponse.json(
      {
        error:
          "일정 ID가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    supabase,
    error:
      adminError,
  } = await requireAdmin();

  if (adminError) {
    return adminError;
  }

  const body =
    (await request.json()) as
      UpdateBody;

  if (
    !body.title ||
    !body.courseId ||
    !body.startDate
  ) {
    return NextResponse.json(
      {
        error:
          "필수 정보를 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      body.schedule
    ) ||
    body.schedule.length !==
      body.lessonsPerWeek
  ) {
    return NextResponse.json(
      {
        error:
          "수업 일정을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data:
      existingOption,
    error:
      existingError,
  } = await supabase
    .from(
      "enrollment_options"
    )
    .select(
      "id, enrolled_count"
    )
    .eq(
      "id",
      optionId
    )
    .single();

  if (
    existingError ||
    !existingOption
  ) {
    return NextResponse.json(
      {
        error:
          "수강 일정을 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    body.capacity !== null &&
    body.capacity <
      existingOption.enrolled_count
  ) {
    return NextResponse.json(
      {
        error:
          "현재 신청 인원보다 정원을 작게 설정할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data: pricing,
    error:
      pricingError,
  } = await supabase
    .from(
      "course_pricing"
    )
    .select(
      "price_per_lesson, weekend_multiplier"
    )
    .eq(
      "course_id",
      body.courseId
    )
    .eq(
      "lesson_duration_minutes",
      body.lessonDurationMinutes
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
          "수강료 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const counts =
    calculateSessions(
      body.startDate,
      body.courseWeeks,
      body.schedule
    );

  if (
    counts.total <= 0
  ) {
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
        body.courseWeeks *
          7 -
          1
      )
    );

  const preferredTimes:
    Record<
      string,
      string
    > = {};

  body.schedule.forEach(
    (item) => {
      preferredTimes[
        item.weekday
      ] = item.time;
    }
  );

  const {
    error:
      updateError,
  } = await supabase
    .from(
      "enrollment_options"
    )
    .update({
      title:
        body.title.trim(),

      target_group:
        body.targetGroup,

      course_id:
        body.courseId,

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

      start_date:
        body.startDate,

      course_weeks:
        body.courseWeeks,

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
    .eq(
      "id",
      optionId
    );

  if (updateError) {
    return NextResponse.json(
      {
        error:
          updateError.message,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,
  });
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } =
    await context.params;

  const optionId =
    Number(id);

  if (
    !Number.isInteger(
      optionId
    )
  ) {
    return NextResponse.json(
      {
        error:
          "일정 ID가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    supabase,
    error:
      adminError,
  } = await requireAdmin();

  if (adminError) {
    return adminError;
  }

  const {
    data: option,
    error:
      optionError,
  } = await supabase
    .from(
      "enrollment_options"
    )
    .select(
      "id, enrolled_count"
    )
    .eq(
      "id",
      optionId
    )
    .single();

  if (
    optionError ||
    !option
  ) {
    return NextResponse.json(
      {
        error:
          "수강 일정을 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * 신청자가 있는 일정은
   * 삭제하지 않고 마감시키는 게 안전함.
   */
  if (
    option.enrolled_count >
    0
  ) {
    return NextResponse.json(
      {
        error:
          "이미 신청자가 있는 일정은 삭제할 수 없습니다. 비공개 또는 신청 마감으로 변경해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    error:
      deleteError,
  } = await supabase
    .from(
      "enrollment_options"
    )
    .delete()
    .eq(
      "id",
      optionId
    );

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          deleteError.message,
      },
      {
        status: 400,
      }
    );
  }

  return NextResponse.json({
    success: true,
  });
}