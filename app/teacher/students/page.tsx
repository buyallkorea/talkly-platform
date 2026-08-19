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

type Child = {
  id: number;
  name: string;
  grade: string | null;
};

type Student = {
  id: string;
  name: string | null;
};

type Course = {
  id: number;
  name: string;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  ended_at: string | null;
  status: string;
};

type Attendance = {
  id: number;
  class_session_id: number;
  status: string;
};

type Evaluation = {
  id: number;
  class_session_id: number;
  participation_score: number | null;
  comprehension_score: number | null;
  speaking_score: number | null;
  pronunciation_score: number | null;
};

export default async function TeacherStudentsPage() {
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

  const { data: enrollmentData, error: enrollmentError } =
    await supabase
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

  const childIds = enrollments
    .map((item) => item.child_id)
    .filter((id): id is number => id !== null);

  let children: Child[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select(`
        id,
        name,
        grade
      `)
      .in("id", Array.from(new Set(childIds)));

    if (error) {
      throw new Error(error.message);
    }

    children = (data ?? []) as Child[];
  }

  const studentIds = enrollments
    .map((item) => item.student_user_id)
    .filter((id): id is string => Boolean(id));

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

  const courseIds = Array.from(
    new Set(enrollments.map((item) => item.course_id))
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
        ended_at,
        status
      `)
      .in("enrollment_id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    sessions = (data ?? []) as ClassSession[];
  }

  const sessionIds = sessions.map((item) => item.id);

  let attendances: Attendance[] = [];
  let evaluations: Evaluation[] = [];

  if (sessionIds.length > 0) {
    const [
      { data: attendanceData, error: attendanceError },
      { data: evaluationData, error: evaluationError },
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select(`
          id,
          class_session_id,
          status
        `)
        .in("class_session_id", sessionIds),
      supabase
        .from("evaluations")
        .select(`
          id,
          class_session_id,
          participation_score,
          comprehension_score,
          speaking_score,
          pronunciation_score
        `)
        .in("class_session_id", sessionIds),
    ]);

    if (attendanceError) {
      throw new Error(attendanceError.message);
    }

    if (evaluationError) {
      throw new Error(evaluationError.message);
    }

    attendances = (attendanceData ?? []) as Attendance[];
    evaluations = (evaluationData ?? []) as Evaluation[];
  }

  function getStudentName(enrollment: Enrollment) {
    if (enrollment.child_id) {
      return (
        children.find((child) => child.id === enrollment.child_id)?.name ??
        "Student"
      );
    }

    if (enrollment.student_user_id) {
      return (
        students.find((student) => student.id === enrollment.student_user_id)
          ?.name ?? "Adult Student"
      );
    }

    return "Student";
  }

  function getStudentSubLabel(enrollment: Enrollment) {
    if (enrollment.child_id) {
      const child = children.find(
        (item) => item.id === enrollment.child_id
      );

      return child?.grade ? `${child.grade} · 자녀 학생` : "자녀 학생";
    }

    return "성인 학생";
  }

  function getCourseName(courseId: number) {
    return courses.find((course) => course.id === courseId)?.name ?? "-";
  }

  function getEnrollmentSessions(enrollmentId: number) {
    return sessions
      .filter((session) => session.enrollment_id === enrollmentId)
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime()
      );
  }

  function getAttendanceForSessions(sessionIds: number[]) {
    return attendances.filter((attendance) =>
      sessionIds.includes(attendance.class_session_id)
    );
  }

  function getEvaluationForSessions(sessionIds: number[]) {
    return evaluations.filter((evaluation) =>
      sessionIds.includes(evaluation.class_session_id)
    );
  }

  function getEvaluationAverage(items: Evaluation[]) {
    const valid = items.filter((item) =>
      [
        item.participation_score,
        item.comprehension_score,
        item.speaking_score,
        item.pronunciation_score,
      ].every((score) => typeof score === "number")
    );

    if (valid.length === 0) {
      return null;
    }

    const sum = valid.reduce(
      (total, item) =>
        total +
        (item.participation_score ?? 0) +
        (item.comprehension_score ?? 0) +
        (item.speaking_score ?? 0) +
        (item.pronunciation_score ?? 0),
      0
    );

    return (sum / (valid.length * 4)).toFixed(1);
  }

  const studentCards = enrollments.map((enrollment) => {
    const enrollmentSessions = getEnrollmentSessions(enrollment.id);
    const enrollmentSessionIds = enrollmentSessions.map((item) => item.id);
    const enrollmentAttendances =
      getAttendanceForSessions(enrollmentSessionIds);
    const enrollmentEvaluations =
      getEvaluationForSessions(enrollmentSessionIds);

    const completedCount = enrollmentSessions.filter(
      (session) =>
        Boolean(session.ended_at) ||
        session.status === "completed"
    ).length;

    const countedAttendances = enrollmentAttendances.filter((attendance) =>
      ["present", "late", "absent"].includes(attendance.status)
    );

    const attendedCount = countedAttendances.filter((attendance) =>
      ["present", "late"].includes(attendance.status)
    ).length;

    const attendanceRate =
      countedAttendances.length > 0
        ? Math.round(
            (attendedCount / countedAttendances.length) * 100
          )
        : null;

    return {
      enrollment,
      name: getStudentName(enrollment),
      subLabel: getStudentSubLabel(enrollment),
      courseName: getCourseName(enrollment.course_id),
      totalSessions: enrollmentSessions.length,
      completedCount,
      attendanceRate,
      evaluationAverage: getEvaluationAverage(enrollmentEvaluations),
    };
  });

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="teacher"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <section>
          <div className="talkly-section-label">
            MY STUDENTS
          </div>

          <h1
            className="talkly-dashboard-title"
            style={{ marginTop: "6px" }}
          >
            담당 학생
          </h1>

          <p className="talkly-dashboard-subtitle">
            현재 배정된 학생의 과정, 수업 진행상황, 출결, 학습평가를 확인합니다.
          </p>
        </section>

        <section className="talkly-stat-grid">
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              담당 학생
            </div>

            <div className="talkly-stat-value">
              {studentCards.length}명
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

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              전체 수업
            </div>

            <div className="talkly-stat-value">
              {sessions.length}회
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              담당 학생 전체 수업
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              등록 평가
            </div>

            <div className="talkly-stat-value">
              {evaluations.length}건
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              작성된 학습평가
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: "28px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px",
          }}
        >
          {studentCards.length === 0 ? (
            <div
              className="talkly-card"
              style={{
                padding: "30px",
                gridColumn: "1 / -1",
                color: "var(--text-muted)",
              }}
            >
              현재 배정된 학생이 없습니다.
            </div>
          ) : (
            studentCards.map((item) => (
              <article
                key={item.enrollment.id}
                className="talkly-card talkly-card-hover"
                style={{
                  padding: "26px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--talkly-blue-light)",
                      color: "var(--talkly-blue)",
                      fontSize: "22px",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {item.name.slice(0, 1)}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h2
                      style={{
                        margin: 0,
                        color: "var(--talkly-navy)",
                        fontSize: "21px",
                      }}
                    >
                      {item.name}
                    </h2>

                    <div
                      style={{
                        marginTop: "3px",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      {item.subLabel}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "15px",
                    borderRadius: "10px",
                    background: "var(--talkly-blue-soft)",
                    border: "1px solid #e5ecf6",
                  }}
                >
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    현재 과정
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      color: "var(--talkly-navy)",
                      fontSize: "15px",
                      fontWeight: 900,
                    }}
                  >
                    {item.courseName}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "12px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(3, minmax(0, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      padding: "13px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      수업
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "var(--talkly-navy)",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      {item.completedCount} / {item.totalSessions}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "13px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      출석률
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "var(--talkly-navy)",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      {item.attendanceRate === null
                        ? "-"
                        : `${item.attendanceRate}%`}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "13px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      평가
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "var(--talkly-navy)",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      {item.evaluationAverage
                        ? `${item.evaluationAverage} / 5`
                        : "-"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "20px",
                    paddingTop: "18px",
                    borderTop: "1px solid var(--border-light)",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Link
                    href={`/teacher/students/${item.enrollment.id}`}
                    style={{
                      color: "var(--talkly-blue)",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 900,
                    }}
                  >
                    관련 수업 보기 →
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}