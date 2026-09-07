import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  durationMonths: number;
};

function getPricingCategory(
  savedCategory: string | null,
  nationality: string | null
) {
  if (
    savedCategory &&
    [
      "philippines",
      "western",
      "special",
      "intensive",
    ].includes(savedCategory)
  ) {
    return savedCategory;
  }

  const normalized =
    (nationality ?? "")
      .trim()
      .toLowerCase();

  if (
    normalized.includes("philipp") ||
    normalized.includes("필리핀")
  ) {
    return "philippines";
  }

  return "western";
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const {
    id,
  } = await context.params;

  const enrollmentRequestId =
    Number(id);

  if (
    !Number.isInteger(
      enrollmentRequestId
    ) ||
    enrollmentRequestId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "수강신청 번호가 올바르지 않습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const supabase =
    await createClient();

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
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    return NextResponse.json(
      {
        error:
          "학부모 계정에서만 이용할 수 있습니다.",
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
          "수강기간 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const durationMonths =
    Number(
      body.durationMonths
    );

  if (
    !Number.isInteger(
      durationMonths
    ) ||
    durationMonths <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "수강기간을 다시 선택해 주세요.",
      },
      {
        status: 400,
      }
    );
  }

  const adminClient =
    createAdminClient();

  const {
    data: enrollmentRequest,
    error:
      enrollmentRequestError,
  } = await adminClient
    .from("enrollment_requests")
    .select(`
      id,
      applicant_user_id,
      child_id,
      course_id,
      status,
      assigned_teacher_user_id,
      assigned_days,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assignment_confirmed_at,
      pricing_category
    `)
    .eq(
      "id",
      enrollmentRequestId
    )
    .eq(
      "applicant_user_id",
      user.id
    )
    .maybeSingle();

  if (
    enrollmentRequestError
  ) {
    return NextResponse.json(
      {
        error:
          enrollmentRequestError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (!enrollmentRequest) {
    return NextResponse.json(
      {
        error:
          "수강신청 정보를 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    !enrollmentRequest.assigned_teacher_user_id ||
    !enrollmentRequest.assignment_confirmed_at ||
    !enrollmentRequest.assigned_lesson_duration_minutes ||
    !enrollmentRequest.assigned_lessons_per_week
  ) {
    return NextResponse.json(
      {
        error:
          "강사와 수업 일정 배정이 완료된 후 결제할 수 있습니다.",
      },
      {
        status: 409,
      }
    );
  }

  const [
    teacherResult,
    policyResult,
  ] =
    await Promise.all([
      adminClient
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          nationality
        `)
        .eq(
          "user_id",
          enrollmentRequest.assigned_teacher_user_id
        )
        .maybeSingle(),

      adminClient
        .from(
          "enrollment_discount_policies"
        )
        .select(`
          id,
          duration_months,
          discount_rate
        `)
        .eq(
          "duration_months",
          durationMonths
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),
    ]);

  if (
    teacherResult.error ||
    !teacherResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "배정된 강사 정보를 확인할 수 없습니다.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    policyResult.error ||
    !policyResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "선택한 수강기간의 할인정책을 찾을 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const pricingCategory =
    getPricingCategory(
      enrollmentRequest.pricing_category,
      teacherResult.data.nationality
    );

  const {
    data: pricing,
    error: pricingError,
  } = await adminClient
    .from("course_pricing")
    .select(`
      id,
      price_per_lesson,
      weekend_multiplier,
      monthly_lesson_count,
      pricing_category
    `)
    .eq(
      "course_id",
      enrollmentRequest.course_id
    )
    .eq(
      "lesson_duration_minutes",
      enrollmentRequest.assigned_lesson_duration_minutes
    )
    .eq(
      "lessons_per_week",
      enrollmentRequest.assigned_lessons_per_week
    )
    .eq(
      "pricing_category",
      pricingCategory
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (
    pricingError ||
    !pricing
  ) {
    return NextResponse.json(
      {
        error:
          pricingError?.message ||
          "배정 조건에 맞는 수강료를 찾을 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const assignedDays =
    (
      enrollmentRequest.assigned_days ??
      []
    ) as string[];

  const lessonsPerWeek =
    Number(
      enrollmentRequest.assigned_lessons_per_week
    );

  const monthlyLessonCount =
    Number(
      pricing.monthly_lesson_count ??
      0
    );

  if (
    lessonsPerWeek <= 0 ||
    monthlyLessonCount <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "월 수업 횟수 설정을 확인해 주세요.",
      },
      {
        status: 500,
      }
    );
  }

  const weekendDayCount =
    assignedDays.filter(
      (day) =>
        day === "Saturday" ||
        day === "Sunday"
    ).length;

  const weekdayDayCount =
    Math.max(
      0,
      lessonsPerWeek -
        weekendDayCount
    );

  const weeksPerMonth =
    monthlyLessonCount /
    lessonsPerWeek;

  const monthlyWeekdayLessons =
    weekdayDayCount *
    weeksPerMonth;

  const monthlyWeekendLessons =
    weekendDayCount *
    weeksPerMonth;

  const pricePerLesson =
    Number(
      pricing.price_per_lesson
    );

  const weekendMultiplier =
    Number(
      pricing.weekend_multiplier
    );

  const monthlyRegularPrice =
    pricePerLesson *
    (
      monthlyWeekdayLessons +
      monthlyWeekendLessons *
        weekendMultiplier
    );

  const regularPrice =
    Math.round(
      monthlyRegularPrice *
        durationMonths
    );

  const discountRate =
    Number(
      policyResult.data
        .discount_rate
    );

  const discountAmount =
    Math.round(
      regularPrice *
        (
          discountRate /
          100
        )
    );

  const finalPrice =
    Math.max(
      0,
      regularPrice -
        discountAmount
    );

  /*
   * 중요:
   * 클라이언트가 보낸 금액은 사용하지 않습니다.
   * 서버가 course_pricing + 할인정책으로 전부 다시 계산합니다.
   */
  const {
    data: updated,
    error: updateError,
  } = await adminClient
    .from("enrollment_requests")
    .update({
      course_pricing_id:
        pricing.id,
      pricing_category:
        pricingCategory,
      duration_months:
        durationMonths,
      monthly_lesson_count:
        monthlyLessonCount,
      regular_price:
        regularPrice,
      discount_rate:
        discountRate,
      discount_amount:
        discountAmount,
      final_price:
        finalPrice,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      enrollmentRequestId
    )
    .eq(
      "applicant_user_id",
      user.id
    )
    .select(`
      id,
      course_pricing_id,
      pricing_category,
      duration_months,
      monthly_lesson_count,
      regular_price,
      discount_rate,
      discount_amount,
      final_price
    `)
    .single();

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
    pricing: updated,
    message:
      "수강기간과 결제금액이 저장되었습니다.",
  });
}
