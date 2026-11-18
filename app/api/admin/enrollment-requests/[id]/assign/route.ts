import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { activatePaidEnrollment } from "@/lib/enrollment/activate-paid-enrollment";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AssignBody = {
  teacherUserId: string;
  assignedDays: string[];
  assignedTime: string;
  lessonDurationMinutes: number;
  lessonsPerWeek: number;
  availabilityCheckedAt?: string | null;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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
  request: Request,
  context: RouteContext
) {
  const { id } =
    await context.params;

  const requestId =
    Number(id);

  if (
    !Number.isInteger(
      requestId
    ) ||
    requestId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "수강신청 ID를 확인해주세요.",
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
    profile.role !== "admin"
  ) {
    return NextResponse.json(
      {
        error:
          "관리자만 배정할 수 있습니다.",
      },
      {
        status: 403,
      }
    );
  }

  let body: AssignBody;

  try {
    body =
      (await request.json()) as
        AssignBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "배정 정보를 확인할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  const teacherUserId =
    String(
      body.teacherUserId ??
        ""
    ).trim();

  const assignedDays =
    Array.isArray(
      body.assignedDays
    )
      ? body.assignedDays.map(
          String
        )
      : [];

  const assignedTime =
    String(
      body.assignedTime ??
        ""
    );

  const lessonDurationMinutes =
    Number(
      body.lessonDurationMinutes
    );

  const lessonsPerWeek =
    Number(
      body.lessonsPerWeek
    );

  if (!teacherUserId) {
    return NextResponse.json(
      {
        error:
          "배정할 강사를 선택해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    ![25, 50].includes(
      lessonDurationMinutes
    )
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
    !Number.isInteger(
      lessonsPerWeek
    ) ||
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

  if (
    assignedDays.length !==
    lessonsPerWeek
  ) {
    return NextResponse.json(
      {
        error:
          `주 ${lessonsPerWeek}회 수업은 요일을 정확히 ${lessonsPerWeek}개 선택해야 합니다.`,
      },
      {
        status: 400,
      }
    );
  }

  const uniqueDays =
    Array.from(
      new Set(
        assignedDays
      )
    );

  if (
    uniqueDays.length !==
    assignedDays.length
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

  const invalidDay =
    assignedDays.find(
      (day) =>
        !WEEKDAYS.includes(
          day as
            (typeof WEEKDAYS)[number]
        )
    );

  if (invalidDay) {
    return NextResponse.json(
      {
        error:
          "배정 요일을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    assignedDays.includes(
      "Saturday"
    ) &&
    assignedDays.includes(
      "Sunday"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "토요일과 일요일은 동시에 배정할 수 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !isTimeText(
      assignedTime
    )
  ) {
    return NextResponse.json(
      {
        error:
          "수업 시작시간을 확인해주세요.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 관리자 화면에서 실제 가용시간을 다시 조회한 직후에만
   * 확정 버튼을 활성화합니다.
   * 이 값은 UX 보호용이며, 향후 결제/동시예약 단계에서는
   * DB 트랜잭션 기반의 최종 충돌검사를 추가합니다.
   */
  const checkedAtText =
    body.availabilityCheckedAt
      ? String(
          body.availabilityCheckedAt
        )
      : "";

  const checkedAt =
    checkedAtText
      ? new Date(
          checkedAtText
        )
      : null;

  if (
    !checkedAt ||
    Number.isNaN(
      checkedAt.getTime()
    ) ||
    Date.now() -
      checkedAt.getTime() >
      5 * 60 * 1000
  ) {
    return NextResponse.json(
      {
        error:
          "강사 가용시간을 다시 확인한 뒤 배정을 확정해주세요.",
      },
      {
        status: 409,
      }
    );
  }

  const adminClient =
    createAdminClient();

  const {
    data:
      enrollmentRequest,
    error:
      requestError,
  } = await adminClient
    .from(
      "enrollment_requests"
    )
    .select(`
      id,
      request_type,
      status,
      checkout_mode,
      teacher_preference_type,
      pricing_category,
      assigned_teacher_user_id,
      assignment_confirmed_at
    `)
    .eq(
      "id",
      requestId
    )
    .maybeSingle();

  if (
    requestError ||
    !enrollmentRequest
  ) {
    return NextResponse.json(
      {
        error:
          "수강신청을 찾을 수 없습니다.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    enrollmentRequest.request_type !==
    "custom"
  ) {
    return NextResponse.json(
      {
        error:
          "맞춤 수강신청만 이 화면에서 배정할 수 있습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    ![
      "pending",
      "approved",
    ].includes(
      String(
        enrollmentRequest.status
      )
    )
  ) {
    return NextResponse.json(
      {
        error:
          "현재 상태에서는 강사를 배정할 수 없습니다.",
      },
      {
        status: 409,
      }
    );
  }

  const {
    data: teacher,
    error: teacherError,
  } = await adminClient
    .from(
      "teacher_profiles"
    )
    .select(`
      user_id,
      display_name,
      is_active,
      nationality
    `)
    .eq(
      "user_id",
      teacherUserId
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
          "현재 배정할 수 없는 강사입니다.",
      },
      {
        status: 400,
      }
    );
  }

  // Prepaid recommendation: keep the exact purchased pricing category unchanged.
  // A changing region after payment would silently substitute a different product.
  const { data: paymentRows, error: paymentError } = await adminClient
    .from("enrollment_payments")
    .select("id,status,created_at")
    .eq("enrollment_request_id", requestId)
    .in("status", ["ready", "confirming", "paid"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (paymentError) {
    return NextResponse.json({ error: "결제 상태를 조회하지 못했습니다." }, { status: 500 });
  }
  const currentPayment = paymentRows?.find((row) => row.status === "paid");
  if (paymentRows?.some((row) => row.status === "confirming" || row.status === "ready") && !currentPayment) {
    return NextResponse.json({ error: "결제 처리 중인 주문이 있습니다. 결제 상태를 먼저 확인해 주세요." }, { status: 409 });
  }
  if (currentPayment) {
    if (enrollmentRequest.assigned_teacher_user_id || enrollmentRequest.assignment_confirmed_at) {
      return NextResponse.json({ error: "결제 후 이미 배정된 수업은 별도 일정 변경 절차를 이용해 주세요." }, { status: 409 });
    }
    if (enrollmentRequest.teacher_preference_type !== "any" ||
        enrollmentRequest.checkout_mode !== "direct") {
      return NextResponse.json({ error: "기존 결제 주문과 배정 방식이 일치하지 않습니다." }, { status: 409 });
    }
    const nationality = String(teacher.nationality ?? "").toLowerCase();
    const region = nationality.includes("philipp") || nationality.includes("필리핀") ? "philippines"
      : ["미국", "캐나다", "usa", "us", "american", "canada", "canadian", "united states"].some((x) => nationality.includes(x))
        ? "special" : "western";
    if (region !== enrollmentRequest.pricing_category) {
      return NextResponse.json({
        error: "결제한 강사 지역과 배정 강사의 지역이 다릅니다. 동일한 가격구분의 강사를 선택해 주세요."
      }, { status: 409 });
    }
  }

  const assignedTimes =
    Object.fromEntries(
      assignedDays.map(
        (day) => [
          day,
          assignedTime,
        ]
      )
    );

  const now =
    new Date().toISOString();

  const {
    data: updated,
    error: updateError,
  } = await adminClient
    .from(
      "enrollment_requests"
    )
    .update({
      status:
        "approved",

      assigned_teacher_user_id:
        teacherUserId,

      assigned_days:
        assignedDays,

      assigned_times:
        assignedTimes,

      assigned_lesson_duration_minutes:
        lessonDurationMinutes,

      assigned_lessons_per_week:
        lessonsPerWeek,

      assigned_at:
        now,

      assignment_confirmed_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      requestId
    )
    .select(`
      id,
      status,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assigned_at,
      assignment_confirmed_at
    `)
    .single();

  if (
    updateError ||
    !updated
  ) {
    return NextResponse.json(
      {
        error:
          updateError?.message ||
          "강사 배정 저장에 실패했습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (currentPayment) {
    // Paid recommendations become actual enrollments only after confirmed admin assignment.
    try {
      const activated = await activatePaidEnrollment(currentPayment.id);
      return NextResponse.json({ success: true, assignment: updated, enrollment: activated });
    } catch (cause) {
      console.error("[ADMIN ASSIGN] paid enrollment activation pending", cause);
      return NextResponse.json({
        success: true, assignment: updated, enrollmentActivationPending: true,
        warning: "강사 배정은 저장되었지만 결제된 수업의 활성화가 완료되지 않았습니다. 수강내역과 오류 로그를 확인해 주세요."
      });
    }
  }
  return NextResponse.json({ success: true, assignment: updated });
}