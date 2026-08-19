import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type Attendance = {
  id: number;
  class_session_id: number;
  status: string;
  attended_at: string | null;
  note: string | null;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

export default async function ParentChildAttendancePage({
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
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  // 본인 자녀인지 확인
  const { data: child, error: childError } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        is_active
      `)
      .eq("id", Number(id))
      .eq("parent_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (childError) {
    throw new Error(childError.message);
  }

  if (!child) {
    notFound();
  }

  // 자녀의 수강정보 조회
  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      child_id,
      course_id,
      teacher_user_id,
      status
    `)
    .eq("child_id", child.id);

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments =
    (enrollmentData ?? []) as Enrollment[];

  const enrollmentIds =
    enrollments.map((item) => item.id);

  // 전체 수업 회차 조회
  let sessions: ClassSession[] = [];

  if (enrollmentIds.length > 0) {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase
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
      .order("scheduled_start", {
        ascending: false,
      });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    sessions =
      (sessionData ?? []) as ClassSession[];
  }

  const sessionIds =
    sessions.map((session) => session.id);

  // 출석정보 조회
  let attendances: Attendance[] = [];

  if (sessionIds.length > 0) {
    const {
      data: attendanceData,
      error: attendanceError,
    } = await supabase
      .from("attendance")
      .select(`
        id,
        class_session_id,
        status,
        attended_at,
        note
      `)
      .in("class_session_id", sessionIds);

    if (attendanceError) {
      throw new Error(attendanceError.message);
    }

    attendances =
      (attendanceData ?? []) as Attendance[];
  }

  // 과정명 조회
  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (enrollment) => enrollment.course_id
      )
    )
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const {
      data: courseData,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id, name")
      .in("id", courseIds);

    if (courseError) {
      throw new Error(courseError.message);
    }

    courses =
      (courseData ?? []) as Course[];
  }

  // 담당 강사명 조회
  const teacherIds = Array.from(
    new Set(
      enrollments
        .map(
          (enrollment) =>
            enrollment.teacher_user_id
        )
        .filter(
          (teacherId): teacherId is string =>
            Boolean(teacherId)
        )
    )
  );

  let teachers: Teacher[] = [];

  if (teacherIds.length > 0) {
    const {
      data: teacherData,
      error: teacherError,
    } = await supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .in("user_id", teacherIds);

    if (teacherError) {
      throw new Error(teacherError.message);
    }

    teachers =
      (teacherData ?? []) as Teacher[];
  }

  function getAttendanceStatusLabel(
    status: string
  ) {
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

  function getSessionStatusLabel(
    status: string
  ) {
    switch (status) {
      case "scheduled":
        return "예정";
      case "completed":
        return "수업 완료";
      case "cancelled":
        return "수업 취소";
      case "no_show":
        return "무단결석";
      case "held":
        return "결석 승인";
      default:
        return status;
    }
  }

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

  function getEnrollment(
    enrollmentId: number
  ) {
    return enrollments.find(
      (enrollment) =>
        enrollment.id === enrollmentId
    );
  }

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return (
      courses.find(
        (course) =>
          course.id === enrollment.course_id
      )?.name ?? "-"
    );
  }

  function getTeacherName(
    enrollmentId: number
  ) {
    const enrollment =
      getEnrollment(enrollmentId);

    if (
      !enrollment ||
      !enrollment.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teachers.find(
        (teacher) =>
          teacher.user_id ===
          enrollment.teacher_user_id
      )?.display_name ?? "미배정"
    );
  }

  function getAttendance(
    sessionId: number
  ) {
    return attendances.find(
      (attendance) =>
        attendance.class_session_id === sessionId
    );
  }

  const presentCount = attendances.filter(
    (attendance) =>
      attendance.status === "present"
  ).length;

  const lateCount = attendances.filter(
    (attendance) =>
      attendance.status === "late"
  ).length;

  const absentCount = attendances.filter(
    (attendance) =>
      attendance.status === "absent"
  ).length;

  const excusedCount = attendances.filter(
    (attendance) =>
      attendance.status === "excused"
  ).length;

  const teacherAbsentCount =
    attendances.filter(
      (attendance) =>
        attendance.status === "teacher_absent"
    ).length;

  const holdCount = sessions.filter(
    (session) => session.status === "held"
  ).length;

  const countedAttendanceCount =
    presentCount + lateCount + absentCount;

  const attendanceRate =
    countedAttendanceCount > 0
      ? Math.round(
          ((presentCount + lateCount) /
            countedAttendanceCount) *
            100
        )
      : null;

  function getStatusBadgeClass(
    attendanceStatus: string | null,
    sessionStatus: string
  ) {
    if (attendanceStatus === "present") {
      return "talkly-badge talkly-badge-success";
    }

    if (attendanceStatus === "late") {
      return "talkly-badge talkly-badge-blue";
    }

    if (
      attendanceStatus === "absent" ||
      sessionStatus === "no_show"
    ) {
      return "talkly-badge talkly-badge-neutral";
    }

    if (
      attendanceStatus === "excused" ||
      attendanceStatus === "teacher_absent" ||
      sessionStatus === "held"
    ) {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <div style={{ marginBottom: "20px" }}>
          <Link
            href={`/parent/children/${child.id}`}
            style={{
              color: "var(--talkly-blue)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            ← 자녀 상세
          </Link>
        </div>

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "32px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border: "1px solid #e1e9f5",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                ATTENDANCE
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                {child.name} 출결 현황
              </h1>

              <p className="talkly-dashboard-subtitle">
                전체 수업의 출석 및 결석 기록을 확인합니다.
              </p>
            </div>

            <div
              style={{
                minWidth: "150px",
                padding: "18px 22px",
                borderRadius: "16px",
                background: "#ffffff",
                border: "1px solid #dce7f5",
                boxShadow: "0 8px 24px rgba(10,31,68,0.06)",
              }}
            >
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                출석률
              </div>

              <div
                style={{
                  marginTop: "4px",
                  color: "var(--talkly-navy)",
                  fontSize: "30px",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                }}
              >
                {attendanceRate === null
                  ? "-"
                  : `${attendanceRate}%`}
              </div>
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "220px",
              height: "220px",
              right: "-70px",
              bottom: "-115px",
              borderRadius: "50%",
              background: "rgba(63,117,220,0.08)",
            }}
          />
        </section>

        <section
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(135px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            ["전체 수업", sessions.length],
            ["출석", presentCount],
            ["지각", lateCount],
            ["결석", absentCount],
            ["인정결석", excusedCount],
            ["결석 승인", holdCount],
            ["강사결석", teacherAbsentCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="talkly-card"
              style={{
                padding: "19px",
              }}
            >
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: "7px",
                  color: "var(--talkly-navy)",
                  fontSize: "27px",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "24px",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                ATTENDANCE HISTORY
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "23px",
                }}
              >
                출결 기록
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                최근 수업부터 표시됩니다.
              </p>
            </div>

            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              총 {sessions.length}회
            </div>
          </div>

          {sessions.length === 0 ? (
            <div
              style={{
                marginTop: "24px",
                padding: "26px",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              아직 등록된 수업이 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "11px",
              }}
            >
              {sessions.map((session) => {
                const attendance =
                  getAttendance(session.id);

                const primaryStatus = attendance
                  ? getAttendanceStatusLabel(
                      attendance.status
                    )
                  : getSessionStatusLabel(
                      session.status
                    );

                return (
                  <Link
                    key={session.id}
                    href={`/parent/children/${child.id}/classes/${session.id}`}
                    className="talkly-card-hover parent-attendance-row"
                    style={{
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      textDecoration: "none",
                      color: "inherit",
                      display: "grid",
                      gridTemplateColumns:
                        "82px minmax(220px, 1.3fr) minmax(120px, .8fr) 110px 24px",
                      gap: "16px",
                      alignItems: "center",
                      background: "#ffffff",
                    }}
                  >
                    <strong
                      style={{
                        color: "var(--talkly-navy)",
                      }}
                    >
                      {session.lesson_number}회차
                    </strong>

                    <div>
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontWeight: 800,
                          fontSize: "14px",
                        }}
                      >
                        {formatDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "5px",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color: "var(--talkly-navy)",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        {getTeacherName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "var(--text-muted)",
                          fontSize: "11px",
                        }}
                      >
                        담당 강사
                      </div>
                    </div>

                    <span
                      className={getStatusBadgeClass(
                        attendance?.status ?? null,
                        session.status
                      )}
                    >
                      {primaryStatus}
                    </span>

                    <span
                      style={{
                        color: "var(--talkly-blue)",
                        fontWeight: 900,
                        textAlign: "right",
                      }}
                    >
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 760px) {
          .parent-attendance-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .parent-attendance-row > :nth-child(2) {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .parent-attendance-row > :nth-child(3) {
            grid-column: 1 / -1;
            grid-row: 3;
          }

          .parent-attendance-row > :nth-child(4) {
            justify-self: start;
          }

          .parent-attendance-row > :nth-child(5) {
            grid-column: 2;
            grid-row: 1;
            justify-self: end;
          }
        }

        @media (max-width: 560px) {
          .talkly-dashboard-main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .parent-attendance-row {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start !important;
          }

          .parent-attendance-row > :nth-child(5) {
            align-self: flex-end;
            margin-top: -28px;
          }
        }
      `}</style>
    </div>
  );
}