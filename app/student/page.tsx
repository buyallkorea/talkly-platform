import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import {
  getStudentEnrollments,
  type StudentEnrollmentRow,
} from "@/lib/student-enrollments";

type Enrollment = StudentEnrollmentRow;

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

type TeacherReview = {
  id: number;
  enrollment_id: number;
  created_at: string;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

export default async function StudentPage() {
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

  const enrollments =
    (await getStudentEnrollments({
      supabase,
      userId: user.id,
    })) as Enrollment[];
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

  let teacherReviews: TeacherReview[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("teacher_reviews")
      .select(`
        id,
        enrollment_id,
        created_at
      `)
      .in("enrollment_id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    teacherReviews = (data ?? []) as TeacherReview[];
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

  const upcomingSessions = sessions
    .filter((session) => {
      if (session.ended_at) return false;
      if (session.status === "cancelled" || session.status === "held") {
        return false;
      }

      return new Date(session.scheduled_end).getTime() >= now.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    );

  const nextSession = upcomingSessions[0] ?? null;

  const completedSessions = sessions.filter(
    (session) => Boolean(session.ended_at) || session.status === "completed"
  );

  const countedAttendances = attendances.filter((attendance) =>
    ["present", "late", "absent"].includes(attendance.status)
  );

  const attendedCount = countedAttendances.filter((attendance) =>
    ["present", "late"].includes(attendance.status)
  ).length;

  const attendanceRate =
    countedAttendances.length > 0
      ? Math.round((attendedCount / countedAttendances.length) * 100)
      : null;

  const scoredEvaluations = evaluations.filter((evaluation) =>
    [
      evaluation.participation_score,
      evaluation.comprehension_score,
      evaluation.speaking_score,
      evaluation.pronunciation_score,
    ].every((score) => typeof score === "number")
  );

  const evaluationAverage =
    scoredEvaluations.length > 0
      ? (
          scoredEvaluations.reduce(
            (sum, evaluation) =>
              sum +
              (evaluation.participation_score ?? 0) +
              (evaluation.comprehension_score ?? 0) +
              (evaluation.speaking_score ?? 0) +
              (evaluation.pronunciation_score ?? 0),
            0
          ) /
          (scoredEvaluations.length * 4)
        ).toFixed(1)
      : null;

  const recentEvaluation = evaluations[0] ?? null;

  function getEnrollment(enrollmentId: number) {
    return enrollments.find((item) => item.id === enrollmentId) ?? null;
  }

  function getCourseName(session: ClassSession | null) {
    if (!session) return "-";

    const enrollment = getEnrollment(session.enrollment_id);
    if (!enrollment) return "-";

    return (
      courses.find((course) => course.id === enrollment.course_id)?.name ?? "-"
    );
  }

  function getTeacherName(session: ClassSession | null) {
    if (!session) return "담당 강사";

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

  function getCourseNameByEnrollment(enrollment: Enrollment) {
    return (
      courses.find((course) => course.id === enrollment.course_id)?.name ?? "-"
    );
  }

  function getTeacherNameByEnrollment(enrollment: Enrollment) {
    if (!enrollment.teacher_user_id) return "담당 강사";

    return (
      teachers.find(
        (teacher) => teacher.user_id === enrollment.teacher_user_id
      )?.display_name ?? "담당 강사"
    );
  }

  function getSessionById(sessionId: number) {
    return sessions.find((session) => session.id === sessionId) ?? null;
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function getScoreAverage(evaluation: Evaluation | null) {
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

  const nextSessionCourse = getCourseName(nextSession);
  const nextSessionTeacher = getTeacherName(nextSession);

  const recentEvaluationSession = recentEvaluation
    ? getSessionById(recentEvaluation.class_session_id)
    : null;

  const recentEvaluationCourse = getCourseName(recentEvaluationSession);
  const recentEvaluationAverage = getScoreAverage(recentEvaluation);

  const reviewedEnrollmentIds = new Set(
    teacherReviews.map((review) => review.enrollment_id)
  );

  const pendingReviewEnrollments = enrollments.filter(
    (enrollment) =>
      enrollment.status === "completed" &&
      !reviewedEnrollmentIds.has(enrollment.id)
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
            <div className="talkly-eyebrow">TALKLY STUDENT</div>

            <h1 className="talkly-dashboard-title">
              {profile.name
                ? `${profile.name}님, 안녕하세요.`
                : "안녕하세요."}
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                color: "var(--text-secondary)",
                fontSize: "16px",
                lineHeight: 1.75,
              }}
            >
              다음 수업을 확인하고 TALKLY Classroom에서 바로 수업을 시작하세요.
              <br />
              수업 후에는 출결과 학습평가, 수강 완료 후 강사평가까지 한 곳에서 이어집니다.
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

        {pendingReviewEnrollments.length > 0 && (
          <section
            style={{
              marginTop: "24px",
            }}
          >
            <div className="talkly-section-label">ACTION REQUIRED</div>
            <h2
              style={{
                margin: "5px 0 14px",
                color: "var(--talkly-navy)",
                fontSize: "24px",
              }}
            >
              강사 평가가 필요한 수강
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(270px, 1fr))",
                gap: "12px",
              }}
            >
              {pendingReviewEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/student/teacher-reviews/${enrollment.id}`}
                  className="talkly-card talkly-card-hover"
                  style={{
                    display: "block",
                    padding: "22px",
                    color: "inherit",
                    textDecoration: "none",
                    border: "1px solid #dbe7ff",
                    background: "#f7faff",
                  }}
                >
                  <div
                    style={{
                      color: "var(--talkly-blue)",
                      fontSize: "11px",
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                    }}
                  >
                    TEACHER REVIEW
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      color: "var(--talkly-navy)",
                      fontSize: "18px",
                      fontWeight: 900,
                    }}
                  >
                    {getCourseNameByEnrollment(enrollment)}
                  </div>
                  <div
                    style={{
                      marginTop: "5px",
                      color: "var(--text-secondary)",
                      fontSize: "13px",
                    }}
                  >
                    {getTeacherNameByEnrollment(enrollment)}
                  </div>
                  <div
                    style={{
                      marginTop: "18px",
                      color: "var(--talkly-blue)",
                      fontSize: "13px",
                      fontWeight: 900,
                    }}
                  >
                    강사 평가하기 →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="talkly-stat-grid">
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">완료 수업</div>
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
              실제 종료된 수업 기준
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">출석률</div>
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
              전체 출결 기록 기준
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">평균 학습평가</div>
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
          className="student-next-class-grid"
          style={{
            marginTop: "28px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
            gap: "20px",
            alignItems: "stretch",
          }}
        >
          <div
            className="talkly-card"
            style={{
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="talkly-section-label">NEXT CLASS</div>
                <h2
                  style={{
                    margin: "6px 0 0",
                    color: "var(--talkly-navy)",
                    fontSize: "24px",
                    letterSpacing: "-0.03em",
                  }}
                >
                  다음 수업
                </h2>
              </div>

              {nextSession && (
                <span className="talkly-badge talkly-badge-blue">
                  {nextSession.started_at ? "수업 진행 중" : "예정"}
                </span>
              )}
            </div>

            {nextSession ? (
              <div style={{ marginTop: "26px" }}>
                <div
                  style={{
                    fontSize: "21px",
                    fontWeight: 900,
                    color: "var(--talkly-navy)",
                  }}
                >
                  {nextSessionCourse} · {nextSession.lesson_number}회차
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--text-secondary)",
                    fontSize: "15px",
                  }}
                >
                  {nextSessionTeacher}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--text-muted)",
                    fontSize: "14px",
                  }}
                >
                  {formatDateTime(nextSession.scheduled_start)}
                </div>

                <div
                  style={{
                    marginTop: "24px",
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/classroom/${nextSession.id}`}
                    className="talkly-button talkly-button-primary"
                  >
                    TALKLY Classroom 입장 →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: "24px",
                  padding: "24px",
                  border: "1px dashed var(--border)",
                  borderRadius: "12px",
                  color: "var(--text-muted)",
                }}
              >
                예정된 수업이 없습니다.
              </div>
            )}
          </div>

          <div
            className="talkly-card"
            style={{
              padding: "28px",
              background:
                "linear-gradient(145deg, #0a1f44 0%, #15386f 100%)",
              color: "#ffffff",
              border: "none",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                opacity: 0.7,
              }}
            >
              TALKLY CLASSROOM
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "24px",
                lineHeight: 1.35,
              }}
            >
              수업에만
              <br />
              집중하세요.
            </h2>

            <p
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.75,
                fontSize: "14px",
              }}
            >
              화상수업과 디지털 교재가 하나의 화면에 연결됩니다.
              수업이 시작되면 Classroom에서 바로 참여할 수 있습니다.
            </p>

            {nextSession && (
              <Link
                href={`/classroom/${nextSession.id}`}
                style={{
                  display: "inline-flex",
                  marginTop: "22px",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              >
                Classroom 바로가기 →
              </Link>
            )}
          </div>
        </section>

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div className="talkly-section-label">
            MY LEARNING
          </div>

          <h2
            style={{
              margin: "5px 0 16px",
              color: "var(--talkly-navy)",
              fontSize: "25px",
            }}
          >
            나의 학습
          </h2>

          <div
            className="student-learning-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            {[
              {
                href: "/student/classes",
                title: "내 수업",
                description: "전체 수업 일정과 지난 수업, 강사평가 상태를 확인합니다.",
                label: "CLASSES",
              },
              {
                href: "/student/attendance",
                title: "출결",
                description: "출석·지각·결석 기록을 확인합니다.",
                label: "ATTENDANCE",
              },
              {
                href: "/student/evaluations",
                title: "학습평가",
                description: "회차별 평가와 강사 피드백을 확인합니다.",
                label: "EVALUATION",
              },
              {
                href: "/curriculum",
                title: "커리큘럼 · 교재",
                description: "레벨별 목표와 학습 교재를 확인합니다.",
                label: "CURRICULUM",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="talkly-card talkly-card-hover"
                style={{
                  display: "block",
                  padding: "22px",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    color: "var(--talkly-blue)",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    marginTop: "9px",
                    color: "var(--talkly-navy)",
                    fontSize: "18px",
                    fontWeight: 900,
                  }}
                >
                  {item.title}
                </div>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    lineHeight: 1.65,
                  }}
                >
                  {item.description}
                </p>

                <div
                  style={{
                    marginTop: "18px",
                    color: "var(--talkly-blue)",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  바로가기 →
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div className="talkly-section-label">
            RECENT FEEDBACK
          </div>

          <h2
            style={{
              margin: "5px 0 16px",
              color: "var(--talkly-navy)",
              fontSize: "25px",
            }}
          >
            최근 학습평가
          </h2>

          {recentEvaluation && recentEvaluationSession ? (
            <article
              className="talkly-card"
              style={{
                padding: "28px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "var(--talkly-navy)",
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    {recentEvaluationSession.lesson_number}회차 평가
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    {recentEvaluationCourse} ·{" "}
                    {formatDateTime(recentEvaluationSession.scheduled_start)}
                  </div>
                </div>

                <span className="talkly-badge talkly-badge-blue">
                  평균 {recentEvaluationAverage ?? "-"} / 5
                </span>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                }}
              >
                {[
                  ["참여도", recentEvaluation.participation_score],
                  ["이해도", recentEvaluation.comprehension_score],
                  ["말하기", recentEvaluation.speaking_score],
                  ["발음", recentEvaluation.pronunciation_score],
                ].map(([label, score]) => (
                  <div
                    key={String(label)}
                    style={{
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
                      {label}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "var(--talkly-navy)",
                        fontSize: "20px",
                        fontWeight: 900,
                      }}
                    >
                      {typeof score === "number" ? `${score} / 5` : "-"}
                    </div>
                  </div>
                ))}
              </div>

              {recentEvaluation.teacher_comment && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "18px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                  }}
                >
                  <strong
                    style={{
                      color: "var(--talkly-navy)",
                    }}
                  >
                    Teacher Comment
                  </strong>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.75,
                    }}
                  >
                    {recentEvaluation.teacher_comment}
                  </div>
                </div>
              )}
            </article>
          ) : (
            <div
              className="talkly-card"
              style={{
                padding: "28px",
                color: "var(--text-muted)",
              }}
            >
              아직 등록된 학습평가가 없습니다.
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 980px) {
          .student-next-class-grid {
            grid-template-columns: 1fr !important;
          }

          .student-learning-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 620px) {
          .talkly-dashboard-main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .talkly-stat-grid {
            grid-template-columns: 1fr !important;
          }

          .student-learning-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}