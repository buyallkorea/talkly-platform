import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type Enrollment = {
  id: number;
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
  started_at: string | null;
  ended_at: string | null;
  status: string;
};

type Evaluation = {
  id: number;
  class_session_id: number;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

export default async function StudentClassesPage() {
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
        teacher_user_id,
        status
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
        started_at,
        ended_at,
        status
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    sessions = (data ?? []) as ClassSession[];
  }

  const sessionIds = sessions.map((session) => session.id);

  let evaluations: Evaluation[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("evaluations")
      .select(`
        id,
        class_session_id
      `)
      .in("class_session_id", sessionIds);

    if (error) {
      throw new Error(error.message);
    }

    evaluations = (data ?? []) as Evaluation[];
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

  const now = new Date();

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId) ?? null;
  }

  function getCourseName(session: ClassSession) {
    const enrollment = getEnrollment(session.enrollment_id);
    if (!enrollment) return "-";

    return (
      courses.find((course) => course.id === enrollment.course_id)?.name ?? "-"
    );
  }

  function getTeacherName(session: ClassSession) {
    const enrollment = getEnrollment(session.enrollment_id);

    if (!enrollment?.teacher_user_id) {
      return "담당 강사";
    }

    return (
      teachers.find(
        (teacher) => teacher.user_id === enrollment.teacher_user_id
      )?.display_name ?? "담당 강사"
    );
  }

  function hasEvaluation(sessionId: number) {
    return evaluations.some(
      (evaluation) => evaluation.class_session_id === sessionId
    );
  }

  function formatDateTime(value: string) {
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

  function getDurationMinutes(start: string, end: string) {
    return Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 60000
    );
  }

  function getEffectiveStatus(session: ClassSession) {
    if (session.ended_at || session.status === "completed") {
      return "completed";
    }

    if (session.started_at || session.status === "in_progress") {
      return "in_progress";
    }

    return session.status;
  }

  function getStatusLabel(status: string) {
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
        return "무단결석";
      case "held":
        return "결석 승인";
      default:
        return status;
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

  const upcomingCount = sessions.filter((session) => {
    const status = getEffectiveStatus(session);

    if (status === "completed") return false;
    if (status === "cancelled" || status === "held") return false;

    return new Date(session.scheduled_end).getTime() >= now.getTime();
  }).length;

  const completedCount = sessions.filter(
    (session) => getEffectiveStatus(session) === "completed"
  ).length;

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="student"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="talkly-section-label">
              MY CLASSES
            </div>

            <h1
              className="talkly-dashboard-title"
              style={{ marginTop: "6px" }}
            >
              내 수업
            </h1>

            <p className="talkly-dashboard-subtitle">
              예정된 수업과 지난 수업 기록을 한 곳에서 확인합니다.
            </p>
          </div>

          <Link
            href="/student"
            className="talkly-button talkly-button-secondary"
          >
            ← 대시보드
          </Link>
        </section>

        <section className="talkly-stat-grid">
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">전체 수업</div>
            <div className="talkly-stat-value">{sessions.length}회</div>
            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              등록된 전체 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">예정 수업</div>
            <div className="talkly-stat-value">{upcomingCount}회</div>
            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              앞으로 참여할 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">완료 수업</div>
            <div className="talkly-stat-value">{completedCount}회</div>
            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              종료된 수업
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
                CLASS SCHEDULE
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
              아직 등록된 수업이 없습니다.
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
                const effectiveStatus = getEffectiveStatus(session);
                const canEnter =
                  effectiveStatus === "scheduled" ||
                  effectiveStatus === "in_progress";

                return (
                  <article
                    key={session.id}
                    className="talkly-card-hover"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "90px minmax(210px, 1.2fr) minmax(150px, 0.8fr) 90px 130px auto",
                      gap: "14px",
                      alignItems: "center",
                      padding: "18px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      background: "#ffffff",
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

                    <span className={getBadgeClass(effectiveStatus)}>
                      {getStatusLabel(effectiveStatus)}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {canEnter && (
                        <Link
                          href={`/classroom/${session.id}`}
                          className="talkly-button talkly-button-primary"
                          style={{
                            minHeight: "38px",
                            padding: "8px 12px",
                            fontSize: "12px",
                          }}
                        >
                          Classroom
                        </Link>
                      )}

                      {effectiveStatus === "completed" &&
                        hasEvaluation(session.id) && (
                          <span
                            className="talkly-badge talkly-badge-success"
                          >
                            평가 완료
                          </span>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}