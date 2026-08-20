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
      return "취소";
    default:
      return status;
  }
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "completed":
      return "완료";
    case "cancelled":
      return "취소";
    case "no_show":
      return "무단결석";
    case "held":
      return "결석 승인";
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

export default async function AdminParentDetailPage({
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

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const { data: parent, error: parentError } =
    await supabase
      .from("profiles")
      .select(`
        id,
        name,
        role,
        created_at
      `)
      .eq("id", id)
      .eq("role", "parent")
      .maybeSingle();

  if (parentError) {
    throw new Error(parentError.message);
  }

  if (!parent) {
    notFound();
  }

  const { data: childrenData, error: childrenError } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        birth_date,
        school_name,
        grade,
        learning_goal,
        is_active,
        created_at
      `)
      .eq("parent_user_id", parent.id)
      .order("created_at", { ascending: false });

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  const children = childrenData ?? [];
  const childIds = children.map((child) => child.id);

  let enrollments: {
    id: number;
    child_id: number | null;
    course_id: number;
    teacher_user_id: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    lessons_per_week: number | null;
    total_lessons: number | null;
    created_at: string;
  }[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons,
        created_at
      `)
      .in("child_id", childIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    enrollments = data ?? [];
  }

  const enrollmentIds = enrollments.map((item) => item.id);

  const courseIds = Array.from(
    new Set(enrollments.map((item) => item.course_id))
  );

  const teacherIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.teacher_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const [coursesResult, teachersResult] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),

    teacherIds.length > 0
      ? supabase
          .from("teacher_profiles")
          .select("user_id, display_name")
          .in("user_id", teacherIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coursesResult.error) {
    throw new Error(coursesResult.error.message);
  }

  if (teachersResult.error) {
    throw new Error(teachersResult.error.message);
  }

  const courseMap = new Map(
    (coursesResult.data ?? []).map((item) => [item.id, item.name])
  );

  const teacherMap = new Map(
    (teachersResult.data ?? []).map((item) => [
      item.user_id,
      item.display_name || "이름 미등록 강사",
    ])
  );

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    status: string;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        status
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    sessions = data ?? [];
  }

  const sessionIds = sessions.map((session) => session.id);

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

    const firstError =
      attendanceResult.error || evaluationsResult.error;

    if (firstError) {
      throw new Error(firstError.message);
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

  function getChildName(childId: number | null) {
    if (!childId) {
      return "자녀 정보 없음";
    }

    return (
      children.find((child) => child.id === childId)?.name ||
      `자녀 #${childId}`
    );
  }

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId);
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

  function getTeacherName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment?.teacher_user_id) {
      return "미배정";
    }

    return (
      teacherMap.get(enrollment.teacher_user_id) ||
      "미배정"
    );
  }

  function getLatestEnrollment(childId: number) {
    return enrollments.find(
      (enrollment) => enrollment.child_id === childId
    );
  }

  const activeChildrenCount = children.filter(
    (child) => child.is_active
  ).length;

  const activeEnrollmentCount = enrollments.filter(
    (enrollment) => enrollment.status === "active"
  ).length;

  const completedSessionCount = sessions.filter(
    (session) => session.status === "completed"
  ).length;

  const presentCount = attendance.filter(
    (item) => item.status === "present"
  ).length;

  return (
    <div>
      <Link
        href="/admin/parents"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.72,
        }}
      >
        ← 학부모 관리
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
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              letterSpacing: "-0.03em",
            }}
          >
            {parent.name || "이름 미등록 학부모"}
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            학부모 계정과 연결된 자녀 및 수강 현황을 확인합니다.
          </p>
        </div>

        <div
          style={{
            padding: "10px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          학부모 계정
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
          ["연결 자녀", children.length],
          ["활성 자녀", activeChildrenCount],
          ["수강중", activeEnrollmentCount],
          ["전체 수업", sessions.length],
          ["완료 수업", completedSessionCount],
          ["출석", presentCount],
          ["등록 평가", evaluations.length],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "16px",
              border: "1px solid #e2e8f0",
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
          padding: "20px",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          학부모 기본정보
        </h2>

        <p>
          <strong>이름:</strong>{" "}
          {parent.name || "-"}
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>가입일:</strong>{" "}
          {formatDateTime(parent.created_at)}
        </p>
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "20px",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "18px",
          }}
        >
          연결된 자녀
        </h2>

        {children.length === 0 ? (
          <div
            style={{
              padding: "20px",
              border: "1px dashed #cfd8e6",
              borderRadius: "10px",
              opacity: 0.62,
            }}
          >
            연결된 자녀가 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "14px",
            }}
          >
            {children.map((child) => {
              const enrollment =
                getLatestEnrollment(child.id);

              return (
                <div
                  key={child.id}
                  style={{
                    padding: "16px",
                    border:
                      "1px solid rgba(255,255,255,0.13)",
                    borderRadius: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "14px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          marginTop: 0,
                          marginBottom: "6px",
                        }}
                      >
                        {child.name}
                      </h3>

                      <div
                        style={{
                          fontSize: "13px",
                          opacity: 0.56,
                        }}
                      >
                        {[child.school_name, child.grade]
                          .filter(Boolean)
                          .join(" · ") ||
                          "학교/학년 미등록"}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        opacity: 0.72,
                      }}
                    >
                      {child.is_active
                        ? "활성"
                        : "비활성"}
                    </div>
                  </div>

                  {enrollment ? (
                    <div
                      style={{
                        marginTop: "18px",
                      }}
                    >
                      <p>
                        <strong>과정:</strong>{" "}
                        <Link
                          href={`/admin/courses/${enrollment.course_id}`}
                          style={{ color: "#0a4f9e", textDecoration: "none", fontWeight: 700 }}
                        >
                          {courseMap.get(enrollment.course_id) || "-"}
                        </Link>
                      </p>

                      <p>
                        <strong>담당 강사:</strong>{" "}
                        {enrollment.teacher_user_id ? (
                          <Link
                            href={`/admin/teachers/${enrollment.teacher_user_id}`}
                            style={{ color: "#0a4f9e", textDecoration: "none", fontWeight: 700 }}
                          >
                            {teacherMap.get(enrollment.teacher_user_id) || "미배정"}
                          </Link>
                        ) : (
                          "미배정"
                        )}
                      </p>

                      <p>
                        <strong>상태:</strong>{" "}
                        {getEnrollmentStatusLabel(
                          enrollment.status
                        )}
                      </p>

                      <p style={{ marginBottom: 0 }}>
                        <strong>수강기간:</strong>{" "}
                        {enrollment.start_date || "-"} ~{" "}
                        {enrollment.end_date || "-"}
                      </p>
                    </div>
                  ) : (
                    <p
                      style={{
                        marginTop: "18px",
                        marginBottom: 0,
                        opacity: 0.62,
                      }}
                    >
                      등록된 수강정보가 없습니다.
                    </p>
                  )}

                  {enrollment && (
                    <Link
                      href={`/admin/enrollments/${enrollment.id}`}
                      style={{
                        display: "inline-block",
                        marginTop: "18px",
                        marginRight: "8px",
                        padding: "10px 13px",
                        border: "1px solid #d7dee9",
                        borderRadius: "8px",
                        color: "#0a1f44",
                        textDecoration: "none",
                        fontWeight: 700,
                        background: "#ffffff",
                      }}
                    >
                      수강 상세
                    </Link>
                  )}

                  <Link
                    href={`/admin/students/child/${child.id}`}
                    style={{
                      display: "inline-block",
                      marginTop: "18px",
                      padding: "10px 13px",
                      border:
                        "1px solid #d7dee9",
                      borderRadius: "8px",
                      color: "inherit",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    자녀 상세
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "20px",
          border: "1px solid #e2e8f0",
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
              모든 자녀의 최근 수업 10건을 표시합니다.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div
            style={{
              padding: "20px",
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
              const enrollment =
                getEnrollment(session.enrollment_id);

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
                      "110px 80px minmax(0, 1.3fr) minmax(110px, 0.8fr) 100px 90px",
                    gap: "14px",
                    alignItems: "center",
                    padding: "14px",
                    border:
                      "1px solid #e7ebf0",
                    borderRadius: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <strong>
                    {getChildName(
                      enrollment?.child_id ?? null
                    )}
                  </strong>

                  <strong>
                    {session.lesson_number}회차
                  </strong>

                  <div>
                    <div>
                      {formatDateTime(
                        session.scheduled_start
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        opacity: 0.52,
                      }}
                    >
                      {getCourseName(
                        session.enrollment_id
                      )}{" "}
                      ·{" "}
                      {getTeacherName(
                        session.enrollment_id
                      )}
                    </div>
                  </div>

                  <div>
                    {attendanceItem
                      ? getAttendanceStatusLabel(
                          attendanceItem.status
                        )
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
                    {getSessionStatusLabel(
                      session.status
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}