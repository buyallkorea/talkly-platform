import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    enrollmentId: string;
  }>;
};

type Enrollment = {
  id: number;
  student_user_id: string | null;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lessons_per_week: number | null;
  total_lessons: number | null;
};

type Child = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  learning_goal: string | null;
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
  started_at: string | null;
  ended_at: string | null;
  status: string;
};

type Attendance = {
  id: number;
  class_session_id: number;
  status: string;
  attended_at: string | null;
};

type Evaluation = {
  id: number;
  class_session_id: number;
  participation_score: number | null;
  comprehension_score: number | null;
  speaking_score: number | null;
  pronunciation_score: number | null;
  strengths: string | null;
  improvements: string | null;
  homework: string | null;
  teacher_comment: string | null;
  updated_at: string;
};

export default async function TeacherStudentDetailPage({
  params,
}: PageProps) {
  const { enrollmentId } = await params;
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
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons
      `)
      .eq("id", Number(enrollmentId))
      .eq("teacher_user_id", user.id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollmentData) {
    notFound();
  }

  const enrollment = enrollmentData as Enrollment;

  let studentName = "Student";
  let studentSubLabel = "학생";
  let schoolName: string | null = null;
  let learningGoal: string | null = null;

  if (enrollment.child_id) {
    const { data: childData, error: childError } = await supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        school_name,
        learning_goal
      `)
      .eq("id", enrollment.child_id)
      .maybeSingle();

    if (childError) {
      throw new Error(childError.message);
    }

    if (childData) {
      const child = childData as Child;
      studentName = child.name;
      studentSubLabel = child.grade ? `${child.grade} · 자녀 학생` : "자녀 학생";
      schoolName = child.school_name;
      learningGoal = child.learning_goal;
    }
  } else if (enrollment.student_user_id) {
    const { data: studentData, error: studentError } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", enrollment.student_user_id)
      .maybeSingle();

    if (studentError) {
      throw new Error(studentError.message);
    }

    if (studentData) {
      const student = studentData as Student;
      studentName = student.name || "Adult Student";
      studentSubLabel = "성인 학생";
    }
  }

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  if (courseError) {
    throw new Error(courseError.message);
  }

  const course = (courseData ?? null) as Course | null;

  const { data: sessionData, error: sessionError } = await supabase
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
    .eq("enrollment_id", enrollment.id)
    .order("lesson_number", { ascending: true });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessions = (sessionData ?? []) as ClassSession[];
  const sessionIds = sessions.map((session) => session.id);

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
          status,
          attended_at
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
          pronunciation_score,
          strengths,
          improvements,
          homework,
          teacher_comment,
          updated_at
        `)
        .in("class_session_id", sessionIds)
        .order("updated_at", { ascending: false }),
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

  function getAttendance(sessionId: number) {
    return (
      attendances.find(
        (attendance) => attendance.class_session_id === sessionId
      ) ?? null
    );
  }

  function getEvaluation(sessionId: number) {
    return (
      evaluations.find(
        (evaluation) => evaluation.class_session_id === sessionId
      ) ?? null
    );
  }

  function formatDateTime(value: string | null) {
    if (!value) return "-";

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
        return "무단결석";
      case "held":
        return "결석 승인";
      default:
        return status;
    }
  }

  function getSessionBadgeClass(status: string) {
    if (status === "completed") {
      return "talkly-badge talkly-badge-success";
    }

    if (status === "scheduled" || status === "in_progress") {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  function getAttendanceLabel(status: string | null) {
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
        return "미등록";
    }
  }

  function getAttendanceBadgeClass(status: string | null) {
    if (status === "present") {
      return "talkly-badge talkly-badge-success";
    }

    if (status === "late") {
      return "talkly-badge talkly-badge-blue";
    }

    return "talkly-badge talkly-badge-neutral";
  }

  function getEvaluationAverage(evaluation: Evaluation | null) {
    if (!evaluation) return null;

    const scores = [
      evaluation.participation_score,
      evaluation.comprehension_score,
      evaluation.speaking_score,
      evaluation.pronunciation_score,
    ];

    if (!scores.every((score) => typeof score === "number")) {
      return null;
    }

    return (
      scores.reduce((sum, score) => sum + (score ?? 0), 0) / scores.length
    ).toFixed(1);
  }

  const completedSessions = sessions.filter(
    (session) =>
      Boolean(session.ended_at) ||
      session.status === "completed"
  );

  const countedAttendances = attendances.filter((attendance) =>
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

  const validEvaluations = evaluations.filter((evaluation) =>
    [
      evaluation.participation_score,
      evaluation.comprehension_score,
      evaluation.speaking_score,
      evaluation.pronunciation_score,
    ].every((score) => typeof score === "number")
  );

  const evaluationAverage =
    validEvaluations.length > 0
      ? (
          validEvaluations.reduce(
            (sum, evaluation) =>
              sum +
              (evaluation.participation_score ?? 0) +
              (evaluation.comprehension_score ?? 0) +
              (evaluation.speaking_score ?? 0) +
              (evaluation.pronunciation_score ?? 0),
            0
          ) /
          (validEvaluations.length * 4)
        ).toFixed(1)
      : null;

  function getSkillAverage(
    key:
      | "participation_score"
      | "comprehension_score"
      | "speaking_score"
      | "pronunciation_score"
  ) {
    const scores = evaluations
      .map((evaluation) => evaluation[key])
      .filter((score): score is number => typeof score === "number");

    if (scores.length === 0) {
      return null;
    }

    return (
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    ).toFixed(1);
  }

  const participationAverage =
    getSkillAverage("participation_score");

  const comprehensionAverage =
    getSkillAverage("comprehension_score");

  const speakingAverage =
    getSkillAverage("speaking_score");

  const pronunciationAverage =
    getSkillAverage("pronunciation_score");

  const recentEvaluationTrend = evaluations
    .map((evaluation) => {
      const session = sessions.find(
        (item) => item.id === evaluation.class_session_id
      );

      const scores = [
        evaluation.participation_score,
        evaluation.comprehension_score,
        evaluation.speaking_score,
        evaluation.pronunciation_score,
      ];

      if (
        !session ||
        !scores.every((score) => typeof score === "number")
      ) {
        return null;
      }

      const average =
        scores.reduce((sum, score) => sum + (score ?? 0), 0) /
        scores.length;

      return {
        lessonNumber: session.lesson_number,
        average,
        scheduledStart: session.scheduled_start,
      };
    })
    .filter(
      (
        item
      ): item is {
        lessonNumber: number;
        average: number;
        scheduledStart: string;
      } => Boolean(item)
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() -
        new Date(b.scheduledStart).getTime()
    )
    .slice(-6);

  const latestTrendScore =
    recentEvaluationTrend.length > 0
      ? recentEvaluationTrend[
          recentEvaluationTrend.length - 1
        ].average.toFixed(1)
      : null;

  const bestTrendScore =
    recentEvaluationTrend.length > 0
      ? Math.max(
          ...recentEvaluationTrend.map(
            (item) => item.average
          )
        ).toFixed(1)
      : null;

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="teacher"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <div style={{ marginBottom: "20px" }}>
          <Link
            href="/teacher/students"
            style={{
              color: "var(--talkly-blue)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            ← 담당 학생
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--talkly-blue)",
                  color: "#ffffff",
                  fontSize: "27px",
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {studentName.slice(0, 1)}
              </div>

              <div>
                <div className="talkly-section-label">
                  STUDENT DETAIL
                </div>

                <h1
                  className="talkly-dashboard-title"
                  style={{ marginTop: "5px" }}
                >
                  {studentName}
                </h1>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--text-secondary)",
                  }}
                >
                  {studentSubLabel} · {course?.name || "-"}
                </p>
              </div>
            </div>

            <span className="talkly-badge talkly-badge-blue">
              {enrollment.status === "active"
                ? "수강중"
                : enrollment.status}
            </span>
          </div>
        </section>

        <section className="talkly-stat-grid">
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
              전체 {sessions.length}회 중
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              출석률
            </div>

            <div className="talkly-stat-value">
              {attendanceRate === null ? "-" : `${attendanceRate}%`}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              출석·지각·결석 기준
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              평균 학습평가
            </div>

            <div className="talkly-stat-value">
              {evaluationAverage ?? "-"}
              {evaluationAverage && (
                <span
                  style={{
                    marginLeft: "5px",
                    fontSize: "15px",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  / 5
                </span>
              )}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              등록된 회차 평가 평균
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: "20px",
          }}
        >
          <div className="talkly-section-label">
            LEARNING SKILLS
          </div>

          <h2
            style={{
              margin: "5px 0 14px",
              color: "var(--talkly-navy)",
              fontSize: "22px",
            }}
          >
            영역별 평균
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "14px",
            }}
          >
            {[
              ["참여도", participationAverage],
              ["이해도", comprehensionAverage],
              ["말하기", speakingAverage],
              ["발음", pronunciationAverage],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="talkly-card"
                style={{
                  padding: "20px",
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
                    fontSize: "26px",
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {value ?? "-"}
                  {value && (
                    <span
                      style={{
                        marginLeft: "5px",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      / 5
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                  }}
                >
                  등록된 전체 평가 평균
                </div>
              </div>
            ))}
          </div>
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
                LEARNING TREND
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "22px",
                }}
              >
                최근 학습평가 추이
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span className="talkly-badge talkly-badge-blue">
                최근 {latestTrendScore ?? "-"} / 5
              </span>

              <span className="talkly-badge talkly-badge-success">
                최고 {bestTrendScore ?? "-"} / 5
              </span>
            </div>
          </div>

          {recentEvaluationTrend.length === 0 ? (
            <div
              style={{
                marginTop: "20px",
                padding: "22px",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
              }}
            >
              아직 추이를 표시할 수 있는 평가가 없습니다.
            </div>
          ) : (
            <div
              className="teacher-trend-grid"
              style={{
                marginTop: "24px",
                display: "grid",
                gridTemplateColumns:
                  `repeat(${recentEvaluationTrend.length}, minmax(72px, 1fr))`,
                gap: "12px",
                alignItems: "end",
              }}
            >
              {recentEvaluationTrend.map((item) => {
                const percent = Math.max(
                  0,
                  Math.min(100, (item.average / 5) * 100)
                );

                return (
                  <div
                    key={`${item.lessonNumber}-${item.scheduledStart}`}
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        height: "180px",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        padding: "0 8px",
                        borderRadius: "12px",
                        background: "var(--talkly-blue-soft)",
                        border: "1px solid #e5ecf6",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          maxWidth: "54px",
                          height: `${percent}%`,
                          minHeight: "8px",
                          borderRadius: "10px 10px 4px 4px",
                          background:
                            "linear-gradient(180deg, var(--talkly-blue), var(--talkly-navy))",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "center",
                          paddingTop: "8px",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {item.average.toFixed(1)}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "8px",
                        textAlign: "center",
                        color: "var(--talkly-navy)",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      {item.lessonNumber}회차
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop: "28px",
            padding: "28px",
          }}
        >
          <div className="talkly-section-label">
            STUDENT INFORMATION
          </div>

          <h2
            style={{
              margin: "5px 0 20px",
              color: "var(--talkly-navy)",
              fontSize: "23px",
            }}
          >
            학생 정보
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              ["과정", course?.name || "-"],
              ["학생 유형", studentSubLabel],
              ["학교", schoolName || "-"],
              ["수강 시작일", enrollment.start_date || "-"],
              ["수강 종료일", enrollment.end_date || "-"],
              [
                "주당 수업",
                enrollment.lessons_per_week != null
                  ? `${enrollment.lessons_per_week}회`
                  : "-",
              ],
              [
                "총 수업",
                enrollment.total_lessons != null
                  ? `${enrollment.total_lessons}회`
                  : "-",
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  padding: "16px",
                  borderRadius: "11px",
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
                  {label}
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "var(--talkly-navy)",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {learningGoal && (
            <div
              style={{
                marginTop: "12px",
                padding: "18px",
                borderRadius: "11px",
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
                학습 목표
              </div>

              <div
                style={{
                  marginTop: "7px",
                  color: "var(--talkly-navy)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  fontWeight: 700,
                }}
              >
                {learningGoal}
              </div>
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
                CLASS HISTORY
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "23px",
                }}
              >
                수업 기록
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
                padding: "26px",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              등록된 수업이 없습니다.
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
                const attendance = getAttendance(session.id);
                const evaluation = getEvaluation(session.id);
                const sessionEvaluationAverage =
                  getEvaluationAverage(evaluation);

                return (
                  <Link
                    key={session.id}
                    href={`/teacher/classes/${session.id}`}
                    className="talkly-card-hover teacher-session-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "90px minmax(220px, 1fr) 120px 120px 110px 24px",
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
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          fontWeight: 700,
                        }}
                      >
                        {formatDateTime(session.scheduled_start)}
                      </div>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        입장:{" "}
                        {formatDateTime(
                          attendance?.attended_at ?? null
                        )}
                      </div>
                    </div>

                    <span
                      className={getSessionBadgeClass(
                        session.status
                      )}
                    >
                      {getSessionStatusLabel(session.status)}
                    </span>

                    <span
                      className={getAttendanceBadgeClass(
                        attendance?.status ?? null
                      )}
                    >
                      {getAttendanceLabel(
                        attendance?.status ?? null
                      )}
                    </span>

                    <div
                      style={{
                        color: "var(--talkly-navy)",
                        fontSize: "13px",
                        fontWeight: 800,
                      }}
                    >
                      {sessionEvaluationAverage
                        ? `${sessionEvaluationAverage} / 5`
                        : "평가 없음"}
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
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 820px) {
          .teacher-trend-grid {
            grid-template-columns: repeat(3, minmax(80px, 1fr)) !important;
          }

          .teacher-session-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
            padding: 16px !important;
          }

          .teacher-session-row > :nth-child(2) {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .teacher-session-row > :nth-child(3),
          .teacher-session-row > :nth-child(4),
          .teacher-session-row > :nth-child(5) {
            justify-self: start;
          }

          .teacher-session-row > :nth-child(6) {
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

          .talkly-stat-grid {
            grid-template-columns: 1fr !important;
          }

          .teacher-trend-grid {
            display: flex !important;
            overflow-x: auto;
            gap: 10px !important;
            padding-bottom: 8px;
            scroll-snap-type: x proximity;
          }

          .teacher-trend-grid > div {
            min-width: 88px;
            scroll-snap-align: start;
          }

          .teacher-session-row {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .teacher-session-row > * {
            width: auto;
          }

          .teacher-session-row > :nth-child(6) {
            align-self: flex-end;
            margin-top: -28px;
          }
        }
      `}</style>
    </div>
  );
}