import { createClient } from "@/lib/supabase-server";

type ServerSupabaseClient =
  Awaited<
    ReturnType<
      typeof createClient
    >
  >;

export type TeacherReviewEligibility = {
  eligible: boolean;

  code:
    | "ELIGIBLE"
    | "NOT_STUDENT"
    | "ENROLLMENT_NOT_FOUND"
    | "NOT_ENROLLMENT_STUDENT"
    | "ENROLLMENT_NOT_COMPLETED"
    | "NO_CLASSES"
    | "CLASS_STILL_ACTIVE"
    | "TEACHER_NOT_FOUND"
    | "ALREADY_REVIEWED";

  message: string;

  enrollmentId: number;

  childId: number | null;

  teacherUserId:
    | string
    | null;

  teacherName:
    | string
    | null;

  courseName:
    | string
    | null;

  existingReviewId:
    | number
    | null;

  totalSessions: number;

  remainingSessions: number;
};

type CheckTeacherReviewParams = {
  supabase:
    ServerSupabaseClient;

  userId: string;

  enrollmentId: number;
};

/*
 * =========================================================
 * 실제 수업을 주로 담당한 강사를 결정합니다.
 *
 * TALKLY 현재 구조에서는:
 *
 * 1순위:
 * 해당 enrollment의 수업들에 대해
 * evaluations.teacher_user_id가 가장 많이 기록된 강사
 *
 * 2순위:
 * enrollments.teacher_user_id
 *
 * 강사 교체가 있었을 경우에도
 * 단순히 현재 enrollment.teacher_user_id만 사용하는 것보다
 * 실제 수업 기록에 가까운 강사를 선택하기 위한 구조입니다.
 * =========================================================
 */
async function resolvePrimaryTeacher({
  supabase,
  enrollmentTeacherUserId,
  sessionIds,
}: {
  supabase:
    ServerSupabaseClient;

  enrollmentTeacherUserId:
    string | null;

  sessionIds: number[];
}) {
  if (
    sessionIds.length === 0
  ) {
    return enrollmentTeacherUserId;
  }

  const {
    data: evaluationRows,
    error: evaluationError,
  } =
    await supabase
      .from("evaluations")
      .select(
        "teacher_user_id"
      )
      .in(
        "class_session_id",
        sessionIds
      );

  /*
   * 기존 수업평가 데이터 조회가 실패해도
   * 강사평가 시스템 전체가 막히지 않도록
   * enrollment 담당강사로 fallback 합니다.
   */
  if (
    evaluationError ||
    !evaluationRows
  ) {
    return enrollmentTeacherUserId;
  }

  const counts =
    new Map<
      string,
      number
    >();

  for (
    const row of
    evaluationRows
  ) {
    const teacherUserId =
      row.teacher_user_id;

    if (
      typeof teacherUserId !==
        "string" ||
      !teacherUserId
    ) {
      continue;
    }

    counts.set(
      teacherUserId,
      (
        counts.get(
          teacherUserId
        ) ?? 0
      ) + 1
    );
  }

  if (
    counts.size === 0
  ) {
    return enrollmentTeacherUserId;
  }

  const ranked =
    Array.from(
      counts.entries()
    ).sort(
      (
        [teacherA, countA],
        [teacherB, countB]
      ) => {
        if (
          countB !== countA
        ) {
          return (
            countB -
            countA
          );
        }

        /*
         * 동률이면 현재 enrollment 담당강사를
         * 우선합니다.
         */
        if (
          teacherA ===
          enrollmentTeacherUserId
        ) {
          return -1;
        }

        if (
          teacherB ===
          enrollmentTeacherUserId
        ) {
          return 1;
        }

        return 0;
      }
    );

  return (
    ranked[0]?.[0] ??
    enrollmentTeacherUserId
  );
}


/*
 * =========================================================
 * 강사평가 가능 여부 공통 검사
 *
 * 이 함수를:
 *
 * - 평가 가능 여부 API
 * - 실제 평가 제출 API
 *
 * 양쪽에서 동일하게 사용합니다.
 *
 * 따라서 화면에서는 평가 가능해 보였는데
 * 실제 제출에서는 다른 규칙이 적용되는 문제를
 * 방지할 수 있습니다.
 * =========================================================
 */
export async function checkTeacherReviewEligibility({
  supabase,
  userId,
  enrollmentId,
}: CheckTeacherReviewParams): Promise<TeacherReviewEligibility> {
  const base = {
    enrollmentId,
    childId: null,
    teacherUserId: null,
    teacherName: null,
    courseName: null,
    existingReviewId: null,
    totalSessions: 0,
    remainingSessions: 0,
  };

  /*
   * -------------------------------------------------------
   * 1. 학생 계정인지
   * -------------------------------------------------------
   */

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "id, role"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !==
      "student"
  ) {
    return {
      ...base,

      eligible: false,

      code:
        "NOT_STUDENT",

      message:
        "강사 평가는 실제 수업을 들은 학생 계정으로만 작성할 수 있습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 2. 수강정보
   * -------------------------------------------------------
   */

  const {
    data: enrollment,
    error: enrollmentError,
  } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status
      `)
      .eq(
        "id",
        enrollmentId
      )
      .maybeSingle();

  if (
    enrollmentError ||
    !enrollment
  ) {
    return {
      ...base,

      eligible: false,

      code:
        "ENROLLMENT_NOT_FOUND",

      message:
        "수강정보를 찾을 수 없습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 3. 실제 이 수강의 학생계정인지
   *
   * 성인학생:
   * enrollment.student_user_id
   *
   * 자녀학생:
   * enrollment.student_user_id
   * 또는
   * children.student_user_id
   * 또는
   * children.linked_student_user_id
   * -------------------------------------------------------
   */

  let isEnrollmentStudent =
    enrollment.student_user_id ===
    userId;

  let childId:
    number | null =
      enrollment.child_id ??
      null;

  if (
    !isEnrollmentStudent &&
    childId
  ) {
    const {
      data: child,
      error: childError,
    } =
      await supabase
        .from("children")
        .select(`
          id,
          student_user_id,
          linked_student_user_id
        `)
        .eq(
          "id",
          childId
        )
        .maybeSingle();

    if (
      !childError &&
      child
    ) {
      isEnrollmentStudent =
        child.student_user_id ===
          userId ||
        child.linked_student_user_id ===
          userId;
    }
  }

  if (
    !isEnrollmentStudent
  ) {
    return {
      ...base,

      childId,

      eligible: false,

      code:
        "NOT_ENROLLMENT_STUDENT",

      message:
        "이 수강을 실제로 이용한 학생 계정만 강사를 평가할 수 있습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 4. 과정명
   * -------------------------------------------------------
   */

  let courseName:
    string | null =
      null;

  if (
    enrollment.course_id
  ) {
    const {
      data: course,
    } =
      await supabase
        .from("courses")
        .select(
          "name"
        )
        .eq(
          "id",
          enrollment.course_id
        )
        .maybeSingle();

    courseName =
      course?.name ??
      null;
  }

  /*
   * -------------------------------------------------------
   * 5. 이미 평가했는지
   * -------------------------------------------------------
   */

  const {
    data: existingReview,
    error:
      existingReviewError,
  } =
    await supabase
      .from(
        "teacher_reviews"
      )
      .select(
        "id"
      )
      .eq(
        "enrollment_id",
        enrollmentId
      )
      .maybeSingle();

  if (
    existingReviewError
  ) {
    throw new Error(
      `기존 강사평가 확인 실패: ${existingReviewError.message}`
    );
  }

  if (
    existingReview
  ) {
    return {
      ...base,

      childId,
      courseName,

      existingReviewId:
        existingReview.id,

      eligible: false,

      code:
        "ALREADY_REVIEWED",

      message:
        "이미 강사 평가를 완료한 수강입니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 6. enrollment 자체가 최종 완료 상태인지
   *
   * TALKLY에서는 수업 연기(held)가 존재할 수 있으므로
   * 단순히 예정 수업이 없다는 이유만으로
   * 수강완료라고 판단하지 않습니다.
   *
   * enrollment.status = completed 를
   * 최종 기준으로 사용합니다.
   * -------------------------------------------------------
   */

  if (
    enrollment.status !==
    "completed"
  ) {
    return {
      ...base,

      childId,
      courseName,

      eligible: false,

      code:
        "ENROLLMENT_NOT_COMPLETED",

      message:
        "모든 수업이 최종 완료된 후 강사를 평가할 수 있습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 7. 전체 수업 상태 확인
   * -------------------------------------------------------
   */

  const {
    data: sessions,
    error: sessionsError,
  } =
    await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        status,
        started_at,
        ended_at
      `)
      .eq(
        "enrollment_id",
        enrollmentId
      );

  if (
    sessionsError
  ) {
    throw new Error(
      `수업정보 확인 실패: ${sessionsError.message}`
    );
  }

  const sessionRows =
    sessions ?? [];

  if (
    sessionRows.length === 0
  ) {
    return {
      ...base,

      childId,
      courseName,

      eligible: false,

      code:
        "NO_CLASSES",

      message:
        "등록된 수업이 없어 강사평가를 진행할 수 없습니다.",
    };
  }

  const remainingSessions =
    sessionRows.filter(
      (session) => {
        if (
          session.ended_at
        ) {
          return false;
        }

        if (
          session.status ===
            "scheduled" ||
          session.status ===
            "in_progress"
        ) {
          return true;
        }

        if (
          session.started_at &&
          !session.ended_at
        ) {
          return true;
        }

        return false;
      }
    );

  if (
    remainingSessions.length >
    0
  ) {
    return {
      ...base,

      childId,
      courseName,

      totalSessions:
        sessionRows.length,

      remainingSessions:
        remainingSessions.length,

      eligible: false,

      code:
        "CLASS_STILL_ACTIVE",

      message:
        "아직 진행 예정이거나 진행 중인 수업이 남아 있습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 8. 실제 주 담당강사 결정
   * -------------------------------------------------------
   */

  const teacherUserId =
    await resolvePrimaryTeacher({
      supabase,

      enrollmentTeacherUserId:
        enrollment.teacher_user_id ??
        null,

      sessionIds:
        sessionRows.map(
          (session) =>
            session.id
        ),
    });

  if (
    !teacherUserId
  ) {
    return {
      ...base,

      childId,
      courseName,

      totalSessions:
        sessionRows.length,

      eligible: false,

      code:
        "TEACHER_NOT_FOUND",

      message:
        "평가할 담당 강사 정보를 확인할 수 없습니다.",
    };
  }

  /*
   * -------------------------------------------------------
   * 9. 강사명
   * -------------------------------------------------------
   */

  const {
    data: teacherProfile,
    error:
      teacherProfileError,
  } =
    await supabase
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
    teacherProfileError
  ) {
    throw new Error(
      `강사정보 확인 실패: ${teacherProfileError.message}`
    );
  }

  if (
    !teacherProfile
  ) {
    return {
      ...base,

      childId,
      courseName,

      teacherUserId,

      totalSessions:
        sessionRows.length,

      eligible: false,

      code:
        "TEACHER_NOT_FOUND",

      message:
        "평가할 강사 계정을 확인할 수 없습니다.",
    };
  }

  return {
    eligible: true,

    code:
      "ELIGIBLE",

    message:
      "강사 평가를 작성할 수 있습니다.",

    enrollmentId,

    childId,

    teacherUserId,

    teacherName:
      teacherProfile.display_name ||
      "담당 강사",

    courseName,

    existingReviewId:
      null,

    totalSessions:
      sessionRows.length,

    remainingSessions:
      0,
  };
}