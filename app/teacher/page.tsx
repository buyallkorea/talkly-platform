import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type Enrollment = {
  id: number;
  student_user_id: string | null;
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
  meeting_provider: string | null;
  meeting_url: string | null;
};

type Child = {
  id: number;
  name: string;
};

type Student = {
  id: string;
  name: string | null;
};

type Course = {
  id: number;
  name: string;
};

export default async function TeacherPage() {
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

  if (!profile || profile.role !== "teacher") {
    redirect("/");
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      child_id,
      course_id,
      teacher_user_id,
      status
    `)
    .eq("teacher_user_id", user.id)
    .in("status", ["active", "pending"]);

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments = (enrollmentData ?? []) as Enrollment[];
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);

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
        status,
        meeting_provider,
        meeting_url
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    sessions = (data ?? []) as ClassSession[];
  }

  const childIds = enrollments
    .map((enrollment) => enrollment.child_id)
    .filter((id): id is number => id !== null);

  let children: Child[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select("id, name")
      .in("id", Array.from(new Set(childIds)));

    if (error) {
      throw new Error(error.message);
    }

    children = (data ?? []) as Child[];
  }

  const studentIds = enrollments
    .map((enrollment) => enrollment.student_user_id)
    .filter((id): id is string => id !== null);

  let students: Student[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", Array.from(new Set(studentIds)));

    if (error) {
      throw new Error(error.message);
    }

    students = (data ?? []) as Student[];
  }

  const courseIds = enrollments.map((enrollment) => enrollment.course_id);

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .in("id", Array.from(new Set(courseIds)));

    if (error) {
      throw new Error(error.message);
    }

    courses = (data ?? []) as Course[];
  }

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId) ?? null;
  }

  function getStudentName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "Student";
    }

    if (enrollment.child_id) {
      const child = children.find(
        (item) => item.id === enrollment.child_id
      );

      return child?.name || "Student";
    }

    if (enrollment.student_user_id) {
      const student = students.find(
        (item) => item.id === enrollment.student_user_id
      );

      return student?.name || "Adult Student";
    }

    return "Student";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return (
      courses.find((item) => item.id === enrollment.course_id)?.name || "-"
    );
  }

  function getSessionStatus(status: string) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "수업 진행 중",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "수업 완료",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "수업 취소",
        };

      case "no_show":
        return {
          en: "No Show",
          ko: "무단결석",
        };

      case "held":
        return {
          en: "Class Hold",
          ko: "결석 승인",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function getBadgeClass(status: string) {
    if (status === "completed") {
      return "talkly-badge talkly-badge-success";
    }

    if (
      status === "scheduled" ||
      status === "in_progress"
    ) {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  function formatEnglishDateTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function formatKoreanDateTime(value: string) {
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

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    );
  }

  const now = new Date();
  const todayKst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const todaySessions = sessions.filter((session) => {
    const sessionDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(session.scheduled_start));

    return sessionDate === todayKst;
  });

  const upcomingSessions = sessions.filter((session) => {
    if (
      session.status === "completed" ||
      session.status === "cancelled" ||
      session.status === "held"
    ) {
      return false;
    }

    return new Date(session.scheduled_end).getTime() >= now.getTime();
  });

  const completedSessions = sessions.filter(
    (session) => session.status === "completed"
  );

  const uniqueStudents = new Set(
    enrollments.map((enrollment) =>
      enrollment.child_id
        ? `child:${enrollment.child_id}`
        : `student:${enrollment.student_user_id ?? enrollment.id}`
    )
  );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="teacher"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "34px 36px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 62%, #e8f1ff 100%)",
            border: "1px solid #e1e9f5",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "720px",
            }}
          >
            <div className="talkly-eyebrow">
              TALKLY TEACHER
            </div>

            <h1 className="talkly-dashboard-title">
              {profile.name
                ? `${profile.name} 강사님, 안녕하세요.`
                : "강사님, 안녕하세요."}
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                color: "var(--text-secondary)",
                fontSize: "16px",
                lineHeight: 1.75,
              }}
            >
              오늘 수업과 예정된 일정을 확인하고,
              TALKLY Classroom에서 수업을 진행하세요.
              <br />
              수업 종료 후에는 출석과 학습평가를 기록할 수 있습니다.
            </p>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-55px",
              bottom: "-95px",
              width: "270px",
              height: "270px",
              borderRadius: "50%",
              background: "rgba(63, 117, 220, 0.09)",
            }}
          />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "16px",
            marginTop: "30px",
          }}
        >
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              오늘 수업
            </div>

            <div className="talkly-stat-value">
              {todaySessions.length}회
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              오늘 예정된 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              예정 수업
            </div>

            <div className="talkly-stat-value">
              {upcomingSessions.length}회
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              앞으로 진행할 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              완료 수업
            </div>

            <div className="talkly-stat-value">
              {completedSessions.length}회
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              완료 처리된 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              담당 학생
            </div>

            <div className="talkly-stat-value">
              {uniqueStudents.size}명
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              현재 배정된 학생
            </div>
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "28px",
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
                TODAY
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "24px",
                }}
              >
                오늘 수업
              </h2>
            </div>

            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {todaySessions.length}회
            </div>
          </div>

          {todaySessions.length === 0 ? (
            <div
              style={{
                marginTop: "22px",
                padding: "26px",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              오늘 예정된 수업이 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {todaySessions.map((session) => {
                const status =
                  getSessionStatus(session.status);

                return (
                  <Link
                    key={session.id}
                    href={`/teacher/classes/${session.id}`}
                    className="talkly-card-hover"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "90px minmax(180px, 1fr) minmax(220px, 1.2fr) 100px 120px 24px",
                      gap: "14px",
                      alignItems: "center",
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      textDecoration: "none",
                      color: "inherit",
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
                          color: "var(--talkly-navy)",
                          fontWeight: 900,
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "13px",
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
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        {formatEnglishDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        {formatKoreanDateTime(
                          session.scheduled_start
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      {getDurationMinutes(
                        session.scheduled_start,
                        session.scheduled_end
                      )}
                      분
                    </div>

                    <span
                      className={getBadgeClass(
                        session.status
                      )}
                    >
                      {status.ko || status.en}
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
                MY CLASSES
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "24px",
                }}
              >
                전체 수업
              </h2>
            </div>

            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "14px",
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
                padding: "28px",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              현재 배정된 수업이 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {sessions.map((session) => {
                const status =
                  getSessionStatus(session.status);

                return (
                  <Link
                    key={session.id}
                    href={`/teacher/classes/${session.id}`}
                    className="talkly-card-hover"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "90px minmax(180px, 1fr) minmax(220px, 1.2fr) 100px 120px 24px",
                      gap: "14px",
                      alignItems: "center",
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      textDecoration: "none",
                      color: "inherit",
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
                          color: "var(--talkly-navy)",
                          fontWeight: 900,
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "13px",
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
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        {formatEnglishDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        {formatKoreanDateTime(
                          session.scheduled_start
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      {getDurationMinutes(
                        session.scheduled_start,
                        session.scheduled_end
                      )}
                      분
                    </div>

                    <span
                      className={getBadgeClass(
                        session.status
                      )}
                    >
                      {status.ko || status.en}
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
    </div>
  );
}