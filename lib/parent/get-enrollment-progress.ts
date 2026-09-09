import { createAdminClient } from "@/lib/supabase-admin";

export type EnrollmentProgressStage =
  | "level_test"
  | "enrollment"
  | "assignment"
  | "payment"
  | "classes";

export type EnrollmentProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "waiting";

export type EnrollmentProgressResult = {
  childId: number;
  childName: string;

  stage: EnrollmentProgressStage;
  stageStatus: EnrollmentProgressStatus;

  levelTestCompleted: boolean;
  enrollmentRequested: boolean;
  assignmentCompleted: boolean;
  paymentCompleted: boolean;
  enrollmentActivated: boolean;

  levelTestId: number | null;
  enrollmentRequestId: number | null;
  paymentId: number | null;
  enrollmentId: number | null;

  courseId: number | null;
  courseName: string | null;

  teacherName: string | null;
  teacherNationality: string | null;

  lessonDurationMinutes: number | null;
  lessonsPerWeek: number | null;
  assignedDays: string[];
  assignedTimes: Record<string, string>;

  durationMonths: number | null;
  finalPrice: number | null;

  paymentStatus: string | null;
  tossStatus: string | null;

  title: string;
  description: string;
  badgeLabel: string;

  ctaLabel: string;
  ctaHref: string;
};

type GetEnrollmentProgressParams = {
  parentUserId: string;
  childId: number;
};

function getDayLabel(day: string) {
  const labels: Record<string, string> = {
    Monday: "월",
    Tuesday: "화",
    Wednesday: "수",
    Thursday: "목",
    Friday: "금",
    Saturday: "토",
    Sunday: "일",
  };

  return labels[day] ?? day;
}

export async function getEnrollmentProgress({
  parentUserId,
  childId,
}: GetEnrollmentProgressParams): Promise<EnrollmentProgressResult | null> {
  const admin = createAdminClient();

  /*
   * =========================================================
   * 1. 자녀 확인
   * =========================================================
   */
  const {
    data: child,
    error: childError,
  } = await admin
    .from("children")
    .select(`
      id,
      name,
      parent_user_id,
      is_active
    `)
    .eq("id", childId)
    .eq("parent_user_id", parentUserId)
    .maybeSingle();

  if (childError) {
    console.error(
      "[PARENT ENROLLMENT PROGRESS] 자녀 조회 실패:",
      childError
    );

    return null;
  }

  if (!child) {
    return null;
  }

  /*
   * =========================================================
   * 2. 가장 최근 레벨테스트
   * =========================================================
   */
  const {
    data: levelTests,
    error: levelTestError,
  } = await admin
    .from("level_tests")
    .select(`
      id,
      status,
      final_level,
      final_course_id,
      created_at
    `)
    .eq("child_id", childId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (levelTestError) {
    console.error(
      "[PARENT ENROLLMENT PROGRESS] 레벨테스트 조회 실패:",
      levelTestError
    );
  }

  const levelTest =
    levelTests?.[0] ?? null;

  const levelTestCompleted =
    Boolean(
      levelTest &&
        levelTest.status === "completed" &&
        levelTest.final_level &&
        levelTest.final_course_id
    );

  /*
   * =========================================================
   * 3. 가장 최근 수강신청
   * =========================================================
   */
  const {
    data: requestRows,
    error: requestError,
  } = await admin
    .from("enrollment_requests")
    .select(`
      id,
      child_id,
      course_id,
      level_test_id,
      status,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assignment_confirmed_at,
      duration_months,
      final_price,
      created_at
    `)
    .eq("applicant_user_id", parentUserId)
    .eq("child_id", childId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (requestError) {
    console.error(
      "[PARENT ENROLLMENT PROGRESS] 수강신청 조회 실패:",
      requestError
    );
  }

  const enrollmentRequest =
    requestRows?.[0] ?? null;

  const enrollmentRequested =
    Boolean(enrollmentRequest);

  const assignmentCompleted =
    Boolean(
      enrollmentRequest?.assigned_teacher_user_id &&
        enrollmentRequest?.assignment_confirmed_at
    );

  /*
   * =========================================================
   * 4. 과정 정보
   * =========================================================
   */
  let courseName: string | null = null;

  const courseId =
    enrollmentRequest?.course_id ??
    levelTest?.final_course_id ??
    null;

  if (courseId) {
    const {
      data: course,
      error: courseError,
    } = await admin
      .from("courses")
      .select("id, name")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) {
      console.error(
        "[PARENT ENROLLMENT PROGRESS] 과정 조회 실패:",
        courseError
      );
    }

    courseName =
      course?.name ?? null;
  }

  /*
   * =========================================================
   * 5. 강사 정보
   * =========================================================
   */
  let teacherName: string | null = null;
  let teacherNationality: string | null = null;

  if (
    enrollmentRequest?.assigned_teacher_user_id
  ) {
    const {
      data: teacher,
      error: teacherError,
    } = await admin
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name,
        nationality
      `)
      .eq(
        "user_id",
        enrollmentRequest.assigned_teacher_user_id
      )
      .maybeSingle();

    if (teacherError) {
      console.error(
        "[PARENT ENROLLMENT PROGRESS] 강사 조회 실패:",
        teacherError
      );
    }

    teacherName =
      teacher?.display_name ??
      null;

    teacherNationality =
      teacher?.nationality ??
      null;
  }

  /*
   * =========================================================
   * 6. 결제 정보
   * =========================================================
   */
  let payment:
    | {
        id: number;
        status: string;
        toss_status: string | null;
        enrollment_id: number | null;
        amount: number;
      }
    | null = null;

  if (enrollmentRequest) {
    const {
      data: paymentRows,
      error: paymentError,
    } = await admin
      .from("enrollment_payments")
      .select(`
        id,
        status,
        toss_status,
        enrollment_id,
        amount,
        created_at
      `)
      .eq(
        "enrollment_request_id",
        enrollmentRequest.id
      )
      .order("created_at", {
        ascending: false,
      });

    if (paymentError) {
      console.error(
        "[PARENT ENROLLMENT PROGRESS] 결제 조회 실패:",
        paymentError
      );
    }

    /*
     * paid가 있으면 paid를 우선합니다.
     * 없으면 가장 최근 결제 시도를 사용합니다.
     */
    const paidPayment =
      paymentRows?.find(
        (row) =>
          row.status === "paid"
      ) ?? null;

    payment =
      paidPayment ??
      paymentRows?.[0] ??
      null;
  }

  const paymentCompleted =
    Boolean(
      payment?.status === "paid" &&
        payment?.toss_status === "DONE"
    );

  const enrollmentId =
    payment?.enrollment_id ??
    null;

  /*
   * =========================================================
   * 7. 실제 enrollment 확인
   * =========================================================
   */
  let enrollmentActivated =
    Boolean(enrollmentId);

  if (
    !enrollmentActivated &&
    enrollmentRequest
  ) {
    const {
      data: enrollment,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select("id")
      .eq(
        "source_enrollment_request_id",
        enrollmentRequest.id
      )
      .limit(1)
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "[PARENT ENROLLMENT PROGRESS] 실제 수강 조회 실패:",
        enrollmentError
      );
    }

    if (enrollment) {
      enrollmentActivated = true;
    }
  }

  /*
   * =========================================================
   * 8. 상태 결정
   * =========================================================
   */

  let stage: EnrollmentProgressStage =
    "level_test";

  let stageStatus: EnrollmentProgressStatus =
    "not_started";

  let title =
    "무료 레벨테스트를 시작해 주세요";

  let description =
    "현재 수준을 확인하면 TALKLY가 적합한 과정을 안내해 드립니다.";

  let badgeLabel =
    "레벨테스트 필요";

  let ctaLabel =
    "레벨테스트 신청하기";

  let ctaHref =
    "/parent/level-tests";

  /*
   * 레벨테스트가 완료되었지만 신청 전
   */
  if (
    levelTestCompleted &&
    !enrollmentRequested
  ) {
    stage = "enrollment";
    stageStatus = "in_progress";

    title =
      "수강신청을 진행해 주세요";

    description =
      courseName
        ? `${courseName} 과정으로 수강신청을 진행할 수 있습니다.`
        : "추천 과정을 확인하고 수강신청을 진행해 주세요.";

    badgeLabel =
      "수강신청 가능";

    ctaLabel =
      "수강신청하기";

    ctaHref =
      `/parent/children/${childId}/enrollment?levelTestId=${levelTest?.id}`;
  }

  /*
   * 수강신청 접수 후 관리자 배정 전
   */
  if (
    enrollmentRequested &&
    !assignmentCompleted
  ) {
    stage = "assignment";
    stageStatus = "waiting";

    title =
      "강사와 수업 일정을 확인하고 있습니다";

    description =
      "수강신청이 정상 접수되었습니다. 관리자가 희망 일정과 강사 가능 시간을 확인하고 있습니다.";

    badgeLabel =
      "일정 배정 중";

    ctaLabel =
      "신청 상세 보기";

    ctaHref =
      `/parent/children/${childId}/enrollment-requests/${enrollmentRequest!.id}`;
  }

  /*
   * 배정 완료 후 수강기간 선택 전
   */
  if (
    assignmentCompleted &&
    !enrollmentRequest?.duration_months
  ) {
    stage = "payment";
    stageStatus = "in_progress";

    title =
      "강사와 수업 일정이 확정되었습니다";

    description =
      "수강기간을 선택하고 최종 수강료를 확인해 주세요.";

    badgeLabel =
      "수강기간 선택";

    ctaLabel =
      "수강기간 선택하기";

    ctaHref =
      `/parent/children/${childId}/enrollment-requests/${enrollmentRequest!.id}`;
  }

  /*
   * 수강기간 선택 완료, 결제 전
   */
  if (
    assignmentCompleted &&
    enrollmentRequest?.duration_months &&
    !paymentCompleted
  ) {
    stage = "payment";
    stageStatus = "in_progress";

    if (
      payment?.status === "confirming"
    ) {
      title =
        "결제를 확인하고 있습니다";

      description =
        "결제 승인 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.";

      badgeLabel =
        "결제 처리 중";

      ctaLabel =
        "결제상태 확인하기";
    } else if (
      payment?.status === "failed"
    ) {
      title =
        "결제를 다시 진행해 주세요";

      description =
        "이전 결제가 완료되지 않았습니다. 결제 내용을 확인한 후 다시 진행할 수 있습니다.";

      badgeLabel =
        "결제 필요";

      ctaLabel =
        "결제 다시 진행하기";
    } else {
      title =
        "수강료 결제가 필요합니다";

      description =
        "수강기간과 수업 일정이 모두 확정되었습니다. 결제를 완료하면 수업 준비가 시작됩니다.";

      badgeLabel =
        "결제 대기";

      ctaLabel =
        "결제하기";
    }

    ctaHref =
      `/parent/children/${childId}/enrollment-requests/${enrollmentRequest!.id}`;
  }

  /*
   * 결제 완료 + 실제 수강 생성 완료
   */
  if (
    paymentCompleted &&
    enrollmentActivated
  ) {
    stage = "classes";
    stageStatus = "completed";

    title =
      "수강 준비가 완료되었습니다";

    description =
      "결제가 완료되었고 실제 수업 일정이 등록되었습니다. 내 수업에서 전체 일정을 확인할 수 있습니다.";

    badgeLabel =
      "결제 완료";

    ctaLabel =
      "내 수업 보기";

    ctaHref =
      `/parent/children/${childId}/classes`;
  }

  /*
   * 결제는 완료됐지만 실제 수강등록이 아직 생성되지 않은 경우
   */
  if (
    paymentCompleted &&
    !enrollmentActivated
  ) {
    stage = "classes";
    stageStatus = "waiting";

    title =
      "결제가 완료되었습니다";

    description =
      "결제는 정상 완료되었습니다. 수강정보와 수업 일정을 준비하고 있습니다.";

    badgeLabel =
      "수강 준비 중";

    ctaLabel =
      "신청 상세 보기";

    ctaHref =
      `/parent/children/${childId}/enrollment-requests/${enrollmentRequest!.id}`;
  }

  /*
   * =========================================================
   * 9. 결과 반환
   * =========================================================
   */
  return {
    childId,
    childName: child.name,

    stage,
    stageStatus,

    levelTestCompleted,
    enrollmentRequested,
    assignmentCompleted,
    paymentCompleted,
    enrollmentActivated,

    levelTestId:
      levelTest?.id ??
      null,

    enrollmentRequestId:
      enrollmentRequest?.id ??
      null,

    paymentId:
      payment?.id ??
      null,

    enrollmentId,

    courseId,
    courseName,

    teacherName,
    teacherNationality,

    lessonDurationMinutes:
      enrollmentRequest
        ?.assigned_lesson_duration_minutes ??
      null,

    lessonsPerWeek:
      enrollmentRequest
        ?.assigned_lessons_per_week ??
      null,

    assignedDays:
      enrollmentRequest
        ?.assigned_days ??
      [],

    assignedTimes:
      (enrollmentRequest
        ?.assigned_times as Record<
        string,
        string
      > | null) ??
      {},

    durationMonths:
      enrollmentRequest
        ?.duration_months ??
      null,

    finalPrice:
      enrollmentRequest
        ?.final_price ??
      null,

    paymentStatus:
      payment?.status ??
      null,

    tossStatus:
      payment?.toss_status ??
      null,

    title,
    description,
    badgeLabel,

    ctaLabel,
    ctaHref,
  };
}

export function formatAssignedSchedule(
  assignedDays: string[],
  assignedTimes: Record<string, string>
) {
  if (
    !assignedDays.length
  ) {
    return null;
  }

  return assignedDays
    .map((day) => {
      const time =
        assignedTimes[day];

      if (!time) {
        return getDayLabel(day);
      }

      return `${getDayLabel(day)} ${time.slice(
        0,
        5
      )}`;
    })
    .join(" · ");
}