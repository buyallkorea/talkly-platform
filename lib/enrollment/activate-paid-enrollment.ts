import { createAdminClient } from "@/lib/supabase-admin";

type ActivateResult = {
  enrollmentId: number;
  alreadyExisted: boolean;
  totalLessons: number;
  startDate: string;
  endDate: string;
};

type EnrollmentRequestRow = {
  id: number;
  applicant_user_id: string;
  child_id: number;
  course_id: number;
  status: string;
  assigned_teacher_user_id: string | null;
  assigned_days: string[] | null;
  assigned_times: Record<string, string> | null;
  assigned_lesson_duration_minutes: number | null;
  assigned_lessons_per_week: number | null;
  start_date: string | null;
  duration_months: number | null;
  monthly_lesson_count: number | null;
  assignment_confirmed_at: string | null;
  final_price: number | null;
};

type PaymentRow = {
  id: number;
  enrollment_request_id: number;
  parent_user_id: string;
  child_id: number;
  amount: number;
  status: string;
  enrollment_id: number | null;
};

const DAY_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateToYmd(date: Date) {
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("-");
}

function addDays(
  ymd: string,
  days: number
) {
  const [year, month, day] =
    ymd.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days
    )
  );

  return dateToYmd(date);
}

function getDayOfWeek(
  ymd: string
) {
  const [year, month, day] =
    ymd.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  ).getUTCDay();
}

function getSeoulToday() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  return formatter.format(
    new Date()
  );
}

function normalizeTime(
  value: string
) {
  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    throw new Error(
      `잘못된 수업시간입니다: ${value}`
    );
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      `잘못된 수업시간입니다: ${value}`
    );
  }

  return `${pad2(hour)}:${pad2(
    minute
  )}`;
}

function createSeoulDateTime(
  ymd: string,
  time: string
) {
  const normalizedTime =
    normalizeTime(time);

  /*
   * TALKLY 수업 운영시간은 Asia/Seoul 기준입니다.
   * +09:00을 명시해 JS Date가 UTC instant로 변환하게 합니다.
   */
  const date =
    new Date(
      `${ymd}T${normalizedTime}:00+09:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "수업 날짜/시간을 계산하지 못했습니다."
    );
  }

  return date;
}

function getSeoulDateFromInstant(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

export async function activatePaidEnrollment(
  paymentId: number
): Promise<ActivateResult> {
  const admin =
    createAdminClient();

  /*
   * =========================================================
   * 1. 결제 확인
   * =========================================================
   */
  const {
    data: paymentData,
    error: paymentError,
  } = await admin
    .from(
      "enrollment_payments"
    )
    .select(`
      id,
      enrollment_request_id,
      parent_user_id,
      child_id,
      amount,
      status,
      enrollment_id
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (
    paymentError ||
    !paymentData
  ) {
    throw new Error(
      "결제정보를 찾을 수 없습니다."
    );
  }

  const payment =
    paymentData as PaymentRow;

  if (
    payment.status !==
    "paid"
  ) {
    throw new Error(
      "결제가 완료된 주문만 수강등록할 수 있습니다."
    );
  }

  /*
   * =========================================================
   * 2. 수강신청 확인
   * =========================================================
   */
  const {
    data: requestData,
    error: requestError,
  } = await admin
    .from(
      "enrollment_requests"
    )
    .select(`
      id,
      applicant_user_id,
      child_id,
      course_id,
      status,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      start_date,
      duration_months,
      monthly_lesson_count,
      assignment_confirmed_at,
      final_price
    `)
    .eq(
      "id",
      payment.enrollment_request_id
    )
    .maybeSingle();

  if (
    requestError ||
    !requestData
  ) {
    throw new Error(
      "수강신청 정보를 찾을 수 없습니다."
    );
  }

  const enrollmentRequest =
    requestData as EnrollmentRequestRow;

  if (
    enrollmentRequest
      .applicant_user_id !==
      payment.parent_user_id ||
    enrollmentRequest.child_id !==
      payment.child_id
  ) {
    throw new Error(
      "결제정보와 수강신청 정보가 일치하지 않습니다."
    );
  }

  if (
    !enrollmentRequest
      .assigned_teacher_user_id ||
    !enrollmentRequest
      .assignment_confirmed_at
  ) {
    throw new Error(
      "강사 및 수업일정 배정이 완료되지 않았습니다."
    );
  }

  const assignedDays =
    enrollmentRequest
      .assigned_days ?? [];

  const assignedTimes =
    enrollmentRequest
      .assigned_times ?? {};

  const lessonDuration =
    Number(
      enrollmentRequest
        .assigned_lesson_duration_minutes
    );

  const lessonsPerWeek =
    Number(
      enrollmentRequest
        .assigned_lessons_per_week
    );

  const durationMonths =
    Number(
      enrollmentRequest
        .duration_months
    );

  const monthlyLessonCount =
    Number(
      enrollmentRequest
        .monthly_lesson_count
    );

  if (
    assignedDays.length ===
      0 ||
    !Number.isInteger(
      lessonDuration
    ) ||
    lessonDuration <= 0 ||
    !Number.isInteger(
      lessonsPerWeek
    ) ||
    lessonsPerWeek <= 0 ||
    !Number.isInteger(
      durationMonths
    ) ||
    durationMonths <= 0 ||
    !Number.isInteger(
      monthlyLessonCount
    ) ||
    monthlyLessonCount <= 0
  ) {
    throw new Error(
      "수강등록에 필요한 일정 또는 수강기간 정보가 부족합니다."
    );
  }

  if (
    assignedDays.length !==
    lessonsPerWeek
  ) {
    throw new Error(
      "배정된 요일 수와 주당 수업횟수가 일치하지 않습니다."
    );
  }

  const totalLessons =
    monthlyLessonCount *
    durationMonths;

  /*
   * 모든 요일의 시간 존재 여부 확인
   */
  for (
    const dayName of
    assignedDays
  ) {
    if (
      DAY_NUMBER[
        dayName
      ] === undefined
    ) {
      throw new Error(
        `알 수 없는 수업요일입니다: ${dayName}`
      );
    }

    if (
      !assignedTimes[
        dayName
      ]
    ) {
      throw new Error(
        `${dayName} 수업시간이 없습니다.`
      );
    }

    normalizeTime(
      assignedTimes[
        dayName
      ]
    );
  }

  /*
   * =========================================================
   * 3. 자녀 및 학생 계정 확인
   * =========================================================
   */
  const {
    data: child,
    error: childError,
  } = await admin
    .from("children")
    .select(`
      id,
      parent_user_id,
      student_user_id,
      linked_student_user_id,
      is_active
    `)
    .eq(
      "id",
      enrollmentRequest.child_id
    )
    .maybeSingle();

  if (
    childError ||
    !child
  ) {
    throw new Error(
      "자녀 정보를 찾을 수 없습니다."
    );
  }

  if (
    child.parent_user_id !==
    payment.parent_user_id
  ) {
    throw new Error(
      "자녀 소유정보가 일치하지 않습니다."
    );
  }

  /*
   * 기존 구조 두 필드를 모두 지원합니다.
   */
  const studentUserId =
    child.student_user_id ??
    child.linked_student_user_id ??
    null;

  /*
   * =========================================================
   * 4. 첫 수업일 및 전체 세션 계산
   *
   * 신청 start_date보다 빠르게 시작하지 않습니다.
   * 이미 지나간 시간도 생성하지 않습니다.
   * =========================================================
   */
  const now =
    new Date();

  const seoulToday =
    getSeoulToday();

  let cursorDate =
    enrollmentRequest
      .start_date &&
    enrollmentRequest
      .start_date >
      seoulToday
      ? enrollmentRequest
          .start_date
      : seoulToday;

  const sessions: Array<{
    lessonNumber: number;
    dayName: string;
    dayOfWeek: number;
    localDate: string;
    start: Date;
    end: Date;
  }> = [];

  /*
   * 비정상 데이터로 무한루프가 생기는 것을 방지합니다.
   * 최대 3년 범위까지 탐색합니다.
   */
  for (
    let dayOffset = 0;
    dayOffset <
      366 * 3 &&
    sessions.length <
      totalLessons;
    dayOffset++
  ) {
    const localDate =
      dayOffset === 0
        ? cursorDate
        : addDays(
            cursorDate,
            dayOffset
          );

    const dayOfWeek =
      getDayOfWeek(
        localDate
      );

    const dayName =
      assignedDays.find(
        (name) =>
          DAY_NUMBER[
            name
          ] ===
          dayOfWeek
      );

    if (!dayName) {
      continue;
    }

    const start =
      createSeoulDateTime(
        localDate,
        assignedTimes[
          dayName
        ]
      );

    /*
     * 결제/활성화 시점 이전 수업은 만들지 않습니다.
     */
    if (
      start.getTime() <=
      now.getTime()
    ) {
      continue;
    }

    const end =
      new Date(
        start.getTime() +
          lessonDuration *
            60 *
            1000
      );

    sessions.push({
      lessonNumber:
        sessions.length + 1,
      dayName,
      dayOfWeek,
      localDate,
      start,
      end,
    });
  }

  if (
    sessions.length !==
    totalLessons
  ) {
    throw new Error(
      "전체 수업일정을 생성하지 못했습니다."
    );
  }

  const actualStartDate =
    sessions[0].localDate;

  const actualEndDate =
    sessions[
      sessions.length - 1
    ].localDate;

  /*
   * =========================================================
   * 5. 기존 enrollment 확인
   *
   * payment와 request 양쪽으로 확인합니다.
   * =========================================================
   */
  const {
    data: existingEnrollment,
    error:
      existingEnrollmentError,
  } = await admin
    .from("enrollments")
    .select("id")
    .or(
      `source_payment_id.eq.${payment.id},source_enrollment_request_id.eq.${enrollmentRequest.id}`
    )
    .limit(1)
    .maybeSingle();

  if (
    existingEnrollmentError
  ) {
    throw new Error(
      `기존 수강 확인 실패: ${existingEnrollmentError.message}`
    );
  }

  let enrollmentId:
    | number
    | null =
    existingEnrollment?.id ??
    payment.enrollment_id ??
    null;

  const alreadyExisted =
    Boolean(enrollmentId);

  /*
   * =========================================================
   * 6. enrollment 생성
   * =========================================================
   */
  if (!enrollmentId) {
    const {
      data:
        createdEnrollment,
      error:
        createEnrollmentError,
    } = await admin
      .from("enrollments")
      .insert({
        child_id:
          enrollmentRequest
            .child_id,

        student_user_id:
          studentUserId,

        course_id:
          enrollmentRequest
            .course_id,

        teacher_user_id:
          enrollmentRequest
            .assigned_teacher_user_id,

        status:
          "active",

        start_date:
          actualStartDate,

        end_date:
          actualEndDate,

        lessons_per_week:
          lessonsPerWeek,

        total_lessons:
          totalLessons,

        source_payment_id:
          payment.id,

        source_enrollment_request_id:
          enrollmentRequest.id,
      })
      .select("id")
      .single();

    if (
      createEnrollmentError ||
      !createdEnrollment
    ) {
      /*
       * 동시 요청 때문에 UNIQUE 충돌이 발생했을 수도 있으므로
       * 다시 기존 데이터를 조회합니다.
       */
      const {
        data:
          retryEnrollment,
      } = await admin
        .from(
          "enrollments"
        )
        .select("id")
        .eq(
          "source_payment_id",
          payment.id
        )
        .maybeSingle();

      if (
        !retryEnrollment
      ) {
        throw new Error(
          `수강등록 생성 실패: ${
            createEnrollmentError
              ?.message ??
            "알 수 없는 오류"
          }`
        );
      }

      enrollmentId =
        retryEnrollment.id;
    } else {
      enrollmentId =
        createdEnrollment.id;
    }
  }

  if (!enrollmentId) {
    throw new Error(
      "수강등록 ID를 확인하지 못했습니다."
    );
  }

  /*
   * 기존 enrollment가 부분 생성된 상태로 재호출될 수도 있으므로
   * 핵심 정보를 다시 맞춥니다.
   */
  const {
    error:
      enrollmentUpdateError,
  } = await admin
    .from("enrollments")
    .update({
      child_id:
        enrollmentRequest
          .child_id,

      student_user_id:
        studentUserId,

      course_id:
        enrollmentRequest
          .course_id,

      teacher_user_id:
        enrollmentRequest
          .assigned_teacher_user_id,

      status:
        "active",

      start_date:
        actualStartDate,

      end_date:
        actualEndDate,

      lessons_per_week:
        lessonsPerWeek,

      total_lessons:
        totalLessons,

      source_payment_id:
        payment.id,

      source_enrollment_request_id:
        enrollmentRequest.id,
    })
    .eq(
      "id",
      enrollmentId
    );

  if (
    enrollmentUpdateError
  ) {
    throw new Error(
      `수강등록 갱신 실패: ${enrollmentUpdateError.message}`
    );
  }

  /*
   * =========================================================
   * 7. payment → enrollment 역연결
   * =========================================================
   */
  const {
    error:
      paymentLinkError,
  } = await admin
    .from(
      "enrollment_payments"
    )
    .update({
      enrollment_id:
        enrollmentId,
    })
    .eq(
      "id",
      payment.id
    );

  if (paymentLinkError) {
    throw new Error(
      `결제-수강 연결 실패: ${paymentLinkError.message}`
    );
  }

  /*
   * =========================================================
   * 8. class_schedules 생성
   *
   * 이미 해당 요일 schedule이 있으면 새로 만들지 않습니다.
   * =========================================================
   */
  const {
    data:
      existingSchedules,
    error:
      scheduleReadError,
  } = await admin
    .from(
      "class_schedules"
    )
    .select(`
      id,
      day_of_week
    `)
    .eq(
      "enrollment_id",
      enrollmentId
    );

  if (
    scheduleReadError
  ) {
    throw new Error(
      `정규 수업일정 조회 실패: ${scheduleReadError.message}`
    );
  }

  const existingDaySet =
    new Set(
      (
        existingSchedules ??
        []
      ).map(
        (row) =>
          Number(
            row.day_of_week
          )
      )
    );

  const scheduleRows =
    assignedDays
      .filter(
        (dayName) =>
          !existingDaySet.has(
            DAY_NUMBER[
              dayName
            ]
          )
      )
      .map(
        (dayName) => ({
          enrollment_id:
            enrollmentId,

          day_of_week:
            DAY_NUMBER[
              dayName
            ],

          start_time:
            `${normalizeTime(
              assignedTimes[
                dayName
              ]
            )}:00`,

          duration_minutes:
            lessonDuration,

          timezone:
            "Asia/Seoul",

          is_active:
            true,

          effective_from:
            actualStartDate,

          effective_to:
            actualEndDate,
        })
      );

  if (
    scheduleRows.length >
    0
  ) {
    const {
      error:
        scheduleInsertError,
    } = await admin
      .from(
        "class_schedules"
      )
      .insert(
        scheduleRows
      );

    if (
      scheduleInsertError
    ) {
      throw new Error(
        `정규 수업일정 생성 실패: ${scheduleInsertError.message}`
      );
    }
  }

  /*
   * =========================================================
   * 9. class_sessions 생성
   *
   * lesson_number가 이미 존재하면 재생성하지 않습니다.
   * =========================================================
   */
  const {
    data:
      existingSessions,
    error:
      sessionReadError,
  } = await admin
    .from(
      "class_sessions"
    )
    .select(`
      id,
      lesson_number
    `)
    .eq(
      "enrollment_id",
      enrollmentId
    );

  if (
    sessionReadError
  ) {
    throw new Error(
      `수업 세션 조회 실패: ${sessionReadError.message}`
    );
  }

  const existingLessonSet =
    new Set(
      (
        existingSessions ??
        []
      ).map(
        (row) =>
          Number(
            row.lesson_number
          )
      )
    );

  const sessionRows =
    sessions
      .filter(
        (session) =>
          !existingLessonSet.has(
            session.lessonNumber
          )
      )
      .map(
        (session) => ({
          enrollment_id:
            enrollmentId,

          lesson_number:
            session.lessonNumber,

          scheduled_start:
            session.start.toISOString(),

          scheduled_end:
            session.end.toISOString(),

          status:
            "scheduled",

          meeting_provider:
            "zoom",

          session_kind:
            "regular",

          teacher_user_id:
            enrollmentRequest
              .assigned_teacher_user_id,

          original_teacher_user_id:
            enrollmentRequest
              .assigned_teacher_user_id,

          is_external_teacher:
            false,

          external_teacher_availability_confirmed:
            false,
        })
      );

  if (
    sessionRows.length >
    0
  ) {
    const {
      error:
        sessionInsertError,
    } = await admin
      .from(
        "class_sessions"
      )
      .insert(
        sessionRows
      );

    if (
      sessionInsertError
    ) {
      throw new Error(
        `수업 세션 생성 실패: ${sessionInsertError.message}`
      );
    }
  }

  return {
    enrollmentId,
    alreadyExisted,
    totalLessons,
    startDate:
      actualStartDate,
    endDate:
      actualEndDate,
  };
}