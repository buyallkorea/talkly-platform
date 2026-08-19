import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  childId: number;
  enrollmentOptionId: number;
};

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
          "학부모 계정에서만 신청할 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * 학부모 수강신청 공개 여부
   */
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .select(
      "parent_self_enrollment_enabled"
    )
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

  const optionId =
    Number(
      body.enrollmentOptionId
    );

  if (
    !childId ||
    !optionId
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

  /*
   * 자기 자녀인지 확인
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
   * 공개 + 신청가능 일정 확인
   */
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

  /*
   * 정원 검사
   */
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

  /*
   * 동일 자녀가 동일 일정을
   * 중복 신청하지 못하게 함
   */
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

  /*
   * enrollment_requests용
   * preferred_times 형태
   */
  const preferredTimes =
    option.preferred_times ??
    {};

  /*
   * 신청 저장
   *
   * 신청 당시 가격을
   * 그대로 복사해서 보존
   */
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
    requestId:
      inserted.id,
  });
}