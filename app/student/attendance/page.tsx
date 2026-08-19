import Link from "next/link";
import { redirect } from "next/navigation";

import TalklyUserHeader from "@/components/TalklyUserHeader";
import { createClient } from "@/lib/supabase-server";

type Enrollment = {
  id: number;
  course_id: number;
  teacher_user_id: string | null;
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

type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "excused"
  | "teacher_absent"
  | null;

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeAttendanceStatus(
  value: string | null | undefined
): AttendanceStatus {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "present" || normalized === "attended") {
    return "present";
  }

  if (normalized === "late" || normalized === "tardy") {
    return "late";
  }

  if (normalized === "absent") {
    return "absent";
  }

  if (
    normalized === "excused" ||
    normalized === "excused_absence"
  ) {
    return "excused";
  }

  if (
    normalized === "teacher_absent" ||
    normalized === "teacher-absent"
  ) {
    return "teacher_absent";
  }

  return null;
}

function getAttendanceLabel(
  status: string | null
) {
  switch (normalizeAttendanceStatus(status)) {
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
      return "미처리";
  }
}

function getAttendanceBadgeClass(
  status: string | null
) {
  switch (normalizeAttendanceStatus(status)) {
    case "present":
      return "talkly-badge talkly-badge-success";
    case "late":
      return "talkly-badge talkly-badge-warning";
    case "absent":
      return "talkly-badge talkly-badge-danger";
    case "excused":
      return "talkly-badge talkly-badge-info";
    case "teacher_absent":
    default:
      return "talkly-badge talkly-badge-neutral";
  }
}

export default async function StudentAttendancePage() {
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

  if (!profile || profile.role !== "student") {
    redirect("/");
  }

  const { data: enrollmentData, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        course_id,
        teacher_user_id
      `)
      .eq("student_user_id", user.id);

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const enrollmentIds = enrollments.map((item) => item.id);

  let sessions: ClassSession[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
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

    if (error) {
      throw new Error(error.message);
    }

    sessions = (data ?? []) as ClassSession[];
  }

  const sessionIds = sessions.map((session) => session.id);

  let attendances: Attendance[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        class_session_id,
        status,
        attended_at,
        note
      `)
      .in("class_session_id", sessionIds);

    if (error) {
      throw new Error(error.message);
    }

    attendances = (data ?? []) as Attendance[];
  }

  const courseIds = Array.from(
    new Set(enrollments.map((enrollment) => enrollment.course_id))
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .in("id", courseIds);

    if (error) {
      throw new Error(error.message);
    }

    courses = (data ?? []) as Course[];
  }

  const teacherIds = Array.from(
    new Set(
      enrollments
        .map((enrollment) => enrollment.teacher_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  let teachers: Teacher[] = [];

  if (teacherIds.length > 0) {
    const { data, error } = await supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .in("user_id", teacherIds);

    if (error) {
      throw new Error(error.message);
    }

    teachers = (data ?? []) as Teacher[];
  }

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId) ?? null;
  }

  function getCourseName(session: ClassSession) {
    const enrollment = getEnrollment(session.enrollment_id);

    if (!enrollment) {
      return "-";
    }

    return (
      courses.find((course) => course.id === enrollment.course_id)?.name ??
      "-"
    );
  }

  function getTeacherName(session: ClassSession) {
    const enrollment = getEnrollment(session.enrollment_id);

    if (!enrollment || !enrollment.teacher_user_id) {
      return "미배정";
    }

    return (
      teachers.find(
        (teacher) => teacher.user_id === enrollment.teacher_user_id
      )?.display_name ?? "미배정"
    );
  }

  function getAttendance(sessionId: number) {
    return (
      attendances.find(
        (attendance) => attendance.class_session_id === sessionId
      ) ?? null
    );
  }

  const presentCount = attendances.filter(
    (attendance) =>
      normalizeAttendanceStatus(attendance.status) === "present"
  ).length;

  const lateCount = attendances.filter(
    (attendance) =>
      normalizeAttendanceStatus(attendance.status) === "late"
  ).length;

  const absentCount = attendances.filter(
    (attendance) =>
      normalizeAttendanceStatus(attendance.status) === "absent"
  ).length;

  const excusedCount = attendances.filter(
    (attendance) =>
      normalizeAttendanceStatus(attendance.status) === "excused"
  ).length;

  const teacherAbsentCount = attendances.filter(
    (attendance) =>
      normalizeAttendanceStatus(attendance.status) === "teacher_absent"
  ).length;

  const attendanceBase = presentCount + lateCount + absentCount;

  const attendanceRate =
    attendanceBase === 0
      ? null
      : Math.round(
          ((presentCount + lateCount) / attendanceBase) * 100
        );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="student"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
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
                MY ATTENDANCE
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                출결
              </h1>

              <p className="talkly-dashboard-subtitle">
                회차별 출결 기록과 전체 출석 현황을 확인합니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  minWidth: "145px",
                  padding: "17px 21px",
                  borderRadius: "15px",
                  background: "#ffffff",
                  border: "1px solid #dce7f5",
                }}
              >
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  현재 출석률
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "var(--talkly-navy)",
                    fontSize: "29px",
                    fontWeight: 900,
                  }}
                >
                  {attendanceRate === null ? "-" : `${attendanceRate}%`}
                </div>
              </div>

              <Link
                href="/student"
                className="talkly-button talkly-button-secondary"
              >
                ← 대시보드
              </Link>
            </div>
          </div>
        </section>

        <section
          className="student-attendance-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
            gap: "12px",
            marginTop: "22px",
          }}
        >
          {[
            ["전체 수업", sessions.length, "등록된 전체 회차"],
            ["출석", presentCount, "정상 출석"],
            ["지각", lateCount, "지각 처리"],
            ["결석", absentCount, "결석 처리"],
            ["인정결석", excusedCount, "승인된 결석"],
            ["강사결석", teacherAbsentCount, "강사 사유"],
          ].map(([label, value, description]) => (
            <div
              key={String(label)}
              className="talkly-card"
              style={{ padding: "18px" }}
            >
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "var(--talkly-navy)",
                  fontSize: "25px",
                  fontWeight: 900,
                }}
              >
                {value}회
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                }}
              >
                {description}
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
                  fontSize: "24px",
                }}
              >
                회차별 출결
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                최근 수업부터 표시합니다.
              </p>
            </div>

            <Link
              href="/student/classes"
              style={{
                color: "var(--talkly-blue)",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              내 수업 전체보기 →
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div
              style={{
                marginTop: "24px",
                padding: "28px",
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
                marginTop: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {sessions.map((session) => {
                const attendance = getAttendance(session.id);

                return (
                  <Link
                    key={session.id}
                    href={`/classroom/${session.id}`}
                    className="talkly-card-hover student-attendance-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "85px minmax(220px, 1.2fr) minmax(140px, .7fr) 120px minmax(150px, .7fr) 24px",
                      gap: "14px",
                      alignItems: "center",
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      background: "#ffffff",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--talkly-navy)",
                        fontWeight: 900,
                      }}
                    >
                      {session.lesson_number}회차
                    </div>

                    <div>
                      <div
                        style={{
                          color: "var(--talkly-navy)",
                          fontWeight: 800,
                          fontSize: "14px",
                        }}
                      >
                        {getCourseName(session)}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                        }}
                      >
                        {formatDateTime(session.scheduled_start)}
                      </div>
                    </div>

                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "14px",
                      }}
                    >
                      {getTeacherName(session)}
                    </div>

                    <span
                      className={getAttendanceBadgeClass(
                        attendance?.status ?? null
                      )}
                    >
                      {getAttendanceLabel(attendance?.status ?? null)}
                    </span>

                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "12px",
                      }}
                    >
                      입장시간{" "}
                      {formatDateTime(attendance?.attended_at ?? null)}
                    </div>

                    <span
                      style={{
                        color: "var(--talkly-blue)",
                        fontWeight: 900,
                        textAlign: "right",
                      }}
                    >
                      →
                    </span>

                    {attendance?.note && (
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          marginTop: "2px",
                          padding: "12px 14px",
                          borderRadius: "9px",
                          background: "var(--talkly-blue-soft)",
                          border: "1px solid #e5ecf6",
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        <strong
                          style={{
                            color: "var(--talkly-navy)",
                          }}
                        >
                          출결 메모
                        </strong>

                        <div style={{ marginTop: "5px" }}>
                          {attendance.note}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 1050px) {
          .student-attendance-stats {
            grid-template-columns:
              repeat(3, minmax(120px, 1fr)) !important;
          }

          .student-attendance-row {
            grid-template-columns:
              80px minmax(200px, 1fr) 130px 110px 24px !important;
          }

          .student-attendance-row > :nth-child(5) {
            display: none;
          }

          .student-attendance-row > :nth-child(6) {
            grid-column: 5;
          }
        }

        @media (max-width: 720px) {
          .student-attendance-stats {
            grid-template-columns:
              repeat(2, minmax(120px, 1fr)) !important;
          }

          .student-attendance-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .student-attendance-row > :nth-child(2) {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .student-attendance-row > :nth-child(3) {
            grid-column: 1 / -1;
            grid-row: 3;
          }

          .student-attendance-row > :nth-child(4) {
            justify-self: start;
          }

          .student-attendance-row > :nth-child(6) {
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

          .student-attendance-stats {
            grid-template-columns: 1fr 1fr !important;
          }

          .student-attendance-row {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start !important;
          }

          .student-attendance-row > :nth-child(6) {
            align-self: flex-end;
            margin-top: -28px;
          }
        }
      `}</style>
    </div>
  );
}