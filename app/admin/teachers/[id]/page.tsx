import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getEnrollmentStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "수강 대기";
    case "active":
      return "수강중";
    case "paused":
      return "일시중지";
    case "completed":
      return "수강 완료";
    case "cancelled":
      return "수강 취소";
    default:
      return status;
  }
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "in_progress":
      return "수업 진행 중";
    case "completed":
      return "수업 완료";
    case "cancelled":
      return "수업 취소";
    case "no_show":
      return "결석";
    case "held":
      return "수업 연기";
    default:
      return status;
  }
}

function getAttendanceStatusLabel(status: string) {
  switch (status) {
    case "present":
      return "출석";
    case "late":
      return "지각";
    case "absent":
      return "결석";
    case "excused":
      return "인정결석";
    case "teacher_absent":
      return "강사결석";
    default:
      return status;
  }
}

export default async function TeacherDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const { data: teacher, error } = await supabase
    .from("teacher_profiles")
    .select(`
      user_id,
      display_name,
      nationality,
      bio,
      specialties,
      years_experience,
      education,
      certifications,
      hourly_rate,
      is_active,
      created_at,
      updated_at
    `)
    .eq("user_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!teacher) {
    notFound();
  }

  const { data: teacherProfile, error: teacherProfileError } =
    await supabase
      .from("profiles")
      .select(`
        id,
        name,
        phone,
        birth_date,
        gender,
        profile_image_url,
        created_at
      `)
      .eq("id", id)
      .maybeSingle();

  if (teacherProfileError) {
    throw new Error(teacherProfileError.message);
  }

  const { data: enrollmentsData, error: enrollmentsError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        created_at
      `)
      .eq("teacher_user_id", id)
      .order("created_at", { ascending: false });

  if (enrollmentsError) {
    throw new Error(enrollmentsError.message);
  }

  const enrollments = enrollmentsData ?? [];
  const enrollmentIds = enrollments.map((item) => item.id);

  const childIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.child_id)
        .filter((value): value is number => value !== null)
    )
  );

  const adultStudentIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.student_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const courseIds = Array.from(
    new Set(enrollments.map((item) => item.course_id))
  );

  const [
    childrenResult,
    adultStudentsResult,
    coursesResult,
  ] = await Promise.all([
    childIds.length > 0
      ? supabase
          .from("children")
          .select("id, name, school_name, grade")
          .in("id", childIds)
      : Promise.resolve({ data: [], error: null }),

    adultStudentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, name")
          .in("id", adultStudentIds)
      : Promise.resolve({ data: [], error: null }),

    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError =
    childrenResult.error ||
    adultStudentsResult.error ||
    coursesResult.error;

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const childMap = new Map(
    (childrenResult.data ?? []).map((item) => [item.id, item])
  );

  const adultStudentMap = new Map(
    (adultStudentsResult.data ?? []).map((item) => [item.id, item])
  );

  const courseMap = new Map(
    (coursesResult.data ?? []).map((item) => [item.id, item.name])
  );

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error: sessionError } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", { ascending: false });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    sessions = data ?? [];
  }

  const sessionIds = sessions.map((item) => item.id);

  let attendance: {
    id: number;
    class_session_id: number;
    status: string;
  }[] = [];

  let evaluations: {
    id: number;
    class_session_id: number;
  }[] = [];

  if (sessionIds.length > 0) {
    const [attendanceResult, evaluationsResult] =
      await Promise.all([
        supabase
          .from("attendance")
          .select("id, class_session_id, status")
          .in("class_session_id", sessionIds),

        supabase
          .from("evaluations")
          .select("id, class_session_id")
          .in("class_session_id", sessionIds),
      ]);

    const activityError =
      attendanceResult.error || evaluationsResult.error;

    if (activityError) {
      throw new Error(activityError.message);
    }

    attendance = attendanceResult.data ?? [];
    evaluations = evaluationsResult.data ?? [];
  }

  const attendanceMap = new Map(
    attendance.map((item) => [item.class_session_id, item])
  );

  const evaluationSet = new Set(
    evaluations.map((item) => item.class_session_id)
  );

  const [teacherReviewSummaryResult, teacherReviewsResult] =
    await Promise.all([
      supabase
        .from("teacher_review_summary")
        .select(`
          teacher_user_id,
          review_count,
          attitude_average,
          lesson_quality_average,
          explanation_average,
          communication_average,
          preparation_average,
          satisfaction_average,
          overall_average,
          latest_review_at
        `)
        .eq("teacher_user_id", id)
        .maybeSingle(),

      supabase
        .from("teacher_reviews")
        .select(`
          id,
          enrollment_id,
          attitude_score,
          lesson_quality_score,
          explanation_score,
          communication_score,
          preparation_score,
          satisfaction_score,
          comment,
          created_at
        `)
        .eq("teacher_user_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const teacherReviewError =
    teacherReviewSummaryResult.error ||
    teacherReviewsResult.error;

  if (teacherReviewError) {
    throw new Error(teacherReviewError.message);
  }

  const teacherReviewSummary = teacherReviewSummaryResult.data;
  const teacherReviews = teacherReviewsResult.data ?? [];

  const seoulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const todayStart = new Date(`${seoulDate}T00:00:00+09:00`);
  const tomorrowStart = new Date(`${seoulDate}T00:00:00+09:00`);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const activeEnrollments = enrollments.filter(
    (item) => item.status === "active"
  );

  const uniqueStudentKeys = new Set<string>();

  for (const enrollment of activeEnrollments) {
    if (enrollment.child_id) {
      uniqueStudentKeys.add(`child-${enrollment.child_id}`);
    } else if (enrollment.student_user_id) {
      uniqueStudentKeys.add(`adult-${enrollment.student_user_id}`);
    }
  }

  const todaySessions = sessions.filter((session) => {
    const start = new Date(session.scheduled_start);
    return start >= todayStart && start < tomorrowStart;
  });

  const weekSessions = sessions.filter((session) => {
    const start = new Date(session.scheduled_start);
    return start >= weekStart && start < weekEnd;
  });

  const completedSessions = sessions.filter(
    (session) => session.status === "completed"
  );

  const attendanceCompletedCount = sessions.filter(
    (session) => attendanceMap.has(session.id)
  ).length;

  const evaluationCompletedCount = sessions.filter(
    (session) => evaluationSet.has(session.id)
  ).length;

  const attendanceRate =
    completedSessions.length > 0
      ? Math.round(
          (completedSessions.filter((session) =>
            attendanceMap.has(session.id)
          ).length /
            completedSessions.length) *
            100
        )
      : 0;

  const evaluationRate =
    completedSessions.length > 0
      ? Math.round(
          (completedSessions.filter((session) =>
            evaluationSet.has(session.id)
          ).length /
            completedSessions.length) *
            100
        )
      : 0;

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId);
  }

  function getStudentName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      return (
        childMap.get(enrollment.child_id)?.name ||
        `자녀 #${enrollment.child_id}`
      );
    }

    if (enrollment.student_user_id) {
      return (
        adultStudentMap.get(enrollment.student_user_id)?.name ||
        "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getStudentSubInfo(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment?.child_id) {
      return "성인 학생";
    }

    const child = childMap.get(enrollment.child_id);

    return (
      [child?.school_name, child?.grade]
        .filter(Boolean)
        .join(" · ") || "학교/학년 미등록"
    );
  }

  function getStudentDetailHref(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "/admin/students";
    }

    if (enrollment.child_id) {
      return `/admin/students/child/${enrollment.child_id}`;
    }

    if (enrollment.student_user_id) {
      return `/admin/students/adult/${enrollment.student_user_id}`;
    }

    return "/admin/students";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return (
      courseMap.get(enrollment.course_id) ||
      `과정 #${enrollment.course_id}`
    );
  }

  return (
    <div>
      <Link
        href="/admin/teachers"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.72,
        }}
      >
        ← 강사 관리
      </Link>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            minWidth: 0,
          }}
        >
          {teacherProfile?.profile_image_url ? (
            <img
              src={teacherProfile.profile_image_url}
              alt={`${
                teacher.display_name ||
                teacherProfile.name ||
                "강사"
              } 프로필 사진`}
              style={{
                width: "118px",
                height: "118px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid #d6deea",
                background: "#f2f4f7",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-label="프로필 사진 없음"
              style={{
                width: "118px",
                height: "118px",
                borderRadius: "50%",
                border: "1px solid #d6deea",
                background: "#f2f4f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "34px",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {(
                teacher.display_name ||
                teacherProfile?.name ||
                "T"
              )
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                letterSpacing: "-0.03em",
              }}
            >
              {teacher.display_name ||
                teacherProfile?.name ||
                "이름 미등록 강사"}
            </h1>

            <p
              style={{
                marginTop: "9px",
                marginBottom: 0,
                opacity: 0.6,
              }}
            >
              강사 기본정보와 담당 학생, 수업 및 평가 작성 현황을 확인합니다.
            </p>

            <div
              style={{
                marginTop: "10px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                fontSize: "13px",
                opacity: 0.72,
              }}
            >
              <span>{teacher.nationality || "국적 미등록"}</span>
              <span>·</span>
              <span>
                {teacher.years_experience != null
                  ? `경력 ${teacher.years_experience}년`
                  : "경력 미등록"}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              border: "1px solid #e4e7ec",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {teacher.is_active ? "활성 강사" : "비활성 강사"}
          </div>

          <Link
            href={`/admin/teachers/${teacher.user_id}/edit`}
            style={{
              padding: "10px 14px",
              border: "1px solid #d6deea",
              borderRadius: "9px",
              color: "inherit",
              textDecoration: "none",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            강사정보 수정
          </Link>
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          ["담당 학생", uniqueStudentKeys.size],
          ["진행 중 수강", activeEnrollments.length],
          ["오늘 수업", todaySessions.length],
          ["이번 주 수업", weekSessions.length],
          ["전체 수업", sessions.length],
          ["출결 처리", attendanceCompletedCount],
          ["평가 작성", evaluationCompletedCount],
          ["강사 평가", teacherReviewSummary?.review_count ?? 0],
          [
            "강사 평점",
            teacherReviewSummary?.overall_average != null
              ? `${Number(teacherReviewSummary.overall_average).toFixed(2)}`
              : "-",
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "20px",
              border: "1px solid #e4e7ec",
              borderRadius: "12px",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                opacity: 0.58,
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "29px",
                fontWeight: 800,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: "22px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: "24px",
            border: "1px solid #e4e7ec",
            borderRadius: "14px",
            background: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            기본 정보
          </h2>

          <p>
            <strong>실명:</strong>{" "}
            {teacherProfile?.name || "-"}
          </p>

          <p>
            <strong>표시 이름:</strong>{" "}
            {teacher.display_name || "-"}
          </p>

          <p>
            <strong>국적:</strong>{" "}
            {teacher.nationality || "-"}
          </p>

          <p>
            <strong>연락처:</strong>{" "}
            {teacherProfile?.phone || "-"}
          </p>

          <p>
            <strong>생년월일:</strong>{" "}
            {teacherProfile?.birth_date || "-"}
          </p>

          <p>
            <strong>성별:</strong>{" "}
            {teacherProfile?.gender || "-"}
          </p>

          <p style={{ marginBottom: 0 }}>
            <strong>등록일:</strong>{" "}
            {formatDateTime(teacher.created_at)}
          </p>
        </div>

        <div
          style={{
            padding: "24px",
            border: "1px solid #e4e7ec",
            borderRadius: "14px",
            background: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            강사 프로필
          </h2>

          <p>
            <strong>경력:</strong>{" "}
            {teacher.years_experience != null
              ? `${teacher.years_experience}년`
              : "-"}
          </p>

          <p>
            <strong>학력:</strong>{" "}
            {teacher.education || "-"}
          </p>

          <p>
            <strong>자격 및 인증:</strong>{" "}
            {teacher.certifications || "-"}
          </p>

          <p>
            <strong>전문분야:</strong>{" "}
            {teacher.specialties &&
            teacher.specialties.length > 0
              ? teacher.specialties.join(", ")
              : "-"}
          </p>

          <p style={{ marginBottom: 0 }}>
            <strong>시간당 수업료:</strong>{" "}
            {teacher.hourly_rate != null
              ? `${teacher.hourly_rate.toLocaleString()}원`
              : "-"}
          </p>
        </div>
      </section>

      <section
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(280px, 0.55fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: "24px",
            border: "1px solid #e4e7ec",
            borderRadius: "14px",
            background: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            담당 학생
          </h2>

          {activeEnrollments.length === 0 ? (
            <div
              style={{
                padding: "24px",
                border: "1px dashed #cfd8e6",
                borderRadius: "10px",
                opacity: 0.62,
              }}
            >
              현재 진행 중인 수강이 없습니다.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {activeEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={getStudentDetailHref(enrollment.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(160px, 1fr) minmax(160px, 1fr) 110px",
                    gap: "12px",
                    alignItems: "center",
                    padding: "14px",
                    border: "1px solid #e7ebf0",
                    borderRadius: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {getStudentName(enrollment.id)}
                    </div>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        opacity: 0.52,
                      }}
                    >
                      {getStudentSubInfo(enrollment.id)}
                    </div>
                  </div>

                  <div>
                    {getCourseName(enrollment.id)}
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {getEnrollmentStatusLabel(enrollment.status)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "24px",
            border: "1px solid #e4e7ec",
            borderRadius: "14px",
            background: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            작성 현황
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span>출결 처리율</span>
                <strong>{attendanceRate}%</strong>
              </div>

              <div
                style={{
                  marginTop: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#e9eef5",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${attendanceRate}%`,
                    height: "100%",
                    background: "#0a1f44",
                      color: "#ffffff",
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span>평가 작성률</span>
                <strong>{evaluationRate}%</strong>
              </div>

              <div
                style={{
                  marginTop: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#e9eef5",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${evaluationRate}%`,
                    height: "100%",
                    background: "#0a1f44",
                      color: "#ffffff",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>강사 평가</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#667085",
                fontSize: "13px",
              }}
            >
              수강을 완료한 학생이 작성한 평가입니다.
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
            }}
          >
            <div style={{ color: "#667085", fontSize: "12px" }}>종합 평점</div>
            <div style={{ marginTop: "3px", fontSize: "28px", fontWeight: 900 }}>
              {teacherReviewSummary?.overall_average != null
                ? `${Number(teacherReviewSummary.overall_average).toFixed(2)} / 10`
                : "-"}
            </div>
            <div style={{ marginTop: "3px", color: "#667085", fontSize: "12px" }}>
              총 {teacherReviewSummary?.review_count ?? 0}건
            </div>
          </div>
        </div>

        {teacherReviewSummary && (teacherReviewSummary.review_count ?? 0) > 0 && (
          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
            }}
          >
            {[
              ["수업 태도", teacherReviewSummary.attitude_average],
              ["수업 구성", teacherReviewSummary.lesson_quality_average],
              ["설명 이해도", teacherReviewSummary.explanation_average],
              ["소통", teacherReviewSummary.communication_average],
              ["수업 준비", teacherReviewSummary.preparation_average],
              ["전반 만족도", teacherReviewSummary.satisfaction_average],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "15px",
                  border: "1px solid #e5ecf6",
                  borderRadius: "10px",
                  background: "#f7faff",
                }}
              >
                <div style={{ color: "#667085", fontSize: "11px", fontWeight: 700 }}>
                  {label}
                </div>
                <div style={{ marginTop: "5px", fontSize: "20px", fontWeight: 900 }}>
                  {value != null ? `${Number(value).toFixed(2)} / 10` : "-"}
                </div>
              </div>
            ))}
          </div>
        )}

        {teacherReviews.length === 0 ? (
          <div
            style={{
              marginTop: "18px",
              padding: "24px",
              border: "1px dashed #cfd8e6",
              borderRadius: "10px",
              color: "#667085",
            }}
          >
            아직 등록된 강사 평가가 없습니다.
          </div>
        ) : (
          <div
            style={{
              marginTop: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {teacherReviews.map((review) => (
              <article
                key={review.id}
                style={{
                  padding: "18px",
                  border: "1px solid #e7ebf0",
                  borderRadius: "11px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>{getCourseName(review.enrollment_id)}</strong>
                    <div style={{ marginTop: "4px", color: "#667085", fontSize: "12px" }}>
                      평가일 {formatDateTime(review.created_at)}
                    </div>
                  </div>
                  <strong>
                    {((
                      review.attitude_score +
                      review.lesson_quality_score +
                      review.explanation_score +
                      review.communication_score +
                      review.preparation_score +
                      review.satisfaction_score
                    ) / 6).toFixed(1)} / 10
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                    gap: "8px",
                    fontSize: "12px",
                  }}
                >
                  {[
                    ["태도", review.attitude_score],
                    ["구성", review.lesson_quality_score],
                    ["설명", review.explanation_score],
                    ["소통", review.communication_score],
                    ["준비", review.preparation_score],
                    ["만족", review.satisfaction_score],
                  ].map(([label, score]) => (
                    <div key={String(label)} style={{ padding: "10px", background: "#f8fafc", borderRadius: "8px" }}>
                      <span style={{ color: "#667085" }}>{label}</span>{" "}
                      <strong>{score} / 10</strong>
                    </div>
                  ))}
                </div>

                {review.comment && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px",
                      background: "#f9fafb",
                      borderRadius: "9px",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {review.comment}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "18px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              최근 수업
            </h2>

            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                fontSize: "13px",
                opacity: 0.56,
              }}
            >
              최근 수업 10건을 표시합니다.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div
            style={{
              padding: "24px",
              border: "1px dashed #cfd8e6",
              borderRadius: "10px",
              opacity: 0.62,
            }}
          >
            등록된 수업이 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "9px",
            }}
          >
            {sessions.slice(0, 10).map((session) => {
              const attendanceItem =
                attendanceMap.get(session.id);

              const hasEvaluation =
                evaluationSet.has(session.id);

              return (
                <Link
                  key={session.id}
                  href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "80px minmax(150px, 0.9fr) minmax(0, 1.4fr) minmax(110px, 0.7fr) minmax(100px, 0.7fr) 90px",
                    gap: "14px",
                    alignItems: "center",
                    padding: "14px",
                    border: "1px solid #e7ebf0",
                    borderRadius: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <strong>
                    {session.lesson_number}회차
                  </strong>

                  <strong>
                    {getStudentName(session.enrollment_id)}
                  </strong>

                  <div>
                    <div>
                      {formatDateTime(session.scheduled_start)}
                    </div>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        opacity: 0.52,
                      }}
                    >
                      {getCourseName(session.enrollment_id)}
                    </div>
                  </div>

                  <div>
                    {attendanceItem
                      ? getAttendanceStatusLabel(attendanceItem.status)
                      : "출결 미등록"}
                  </div>

                  <div>
                    {hasEvaluation
                      ? "평가 완료"
                      : "평가 미작성"}
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {getSessionStatusLabel(session.status)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          강사 소개
        </h2>

        <p
          style={{
            whiteSpace: "pre-wrap",
            marginBottom: 0,
            lineHeight: 1.7,
          }}
        >
          {teacher.bio ||
            "등록된 강사 소개가 없습니다."}
        </p>
      </section>
    </div>
  );
}