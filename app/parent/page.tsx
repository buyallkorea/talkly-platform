import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type Child = {
  id: number;
  name: string;
  created_at: string;
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

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type LevelTest = {
  id: number;
  child_id: number | null;
  status: string;
  ai_status: string;
  interview_required: boolean;
  interview_status: string | null;
  final_level: string | null;
  created_at: string;
};

export default async function ParentPage() {
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

  const { data: childData, error: childError } = await supabase
    .from("children")
    .select(`
      id,
      name,
      created_at
    `)
    .eq("parent_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (childError) {
    throw new Error(childError.message);
  }

  const children = (childData ?? []) as Child[];
  const childIds = children.map((child) => child.id);

  let levelTests: LevelTest[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("level_tests")
      .select(`
        id,
        child_id,
        status,
        ai_status,
        interview_required,
        interview_status,
        final_level,
        created_at
      `)
      .in("child_id", childIds)
      .eq("parent_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    levelTests = (data ?? []) as LevelTest[];
  }

  let enrollments: Enrollment[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        course_id,
        teacher_user_id,
        status
      `)
      .in("child_id", childIds);

    if (error) {
      throw new Error(error.message);
    }

    enrollments = (data ?? []) as Enrollment[];
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

  function getChildBySession(session: ClassSession | null) {
    if (!session) return null;

    const enrollment = getEnrollment(session.enrollment_id);
    if (!enrollment?.child_id) return null;

    return children.find((child) => child.id === enrollment.child_id) ?? null;
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

  function getLatestLevelTest(childId: number) {
    return (
      levelTests.find((levelTest) => levelTest.child_id === childId) ?? null
    );
  }

  function getLevelTestButtonLabel(levelTest: LevelTest | null) {
    if (!levelTest) {
      return "무료 레벨테스트";
    }

    if (
      levelTest.final_level ||
      levelTest.status === "completed"
    ) {
      return "최종 레벨 보기";
    }

    if (
      levelTest.interview_status === "completed" ||
      levelTest.status === "interview_completed"
    ) {
      return "화상테스트 결과";
    }

    if (
      levelTest.interview_status === "in_progress"
    ) {
      return "화상테스트 진행 중";
    }

    if (
      levelTest.interview_status === "scheduled" ||
      levelTest.status === "interview_scheduled"
    ) {
      return "화상테스트 일정";
    }

    if (
      levelTest.interview_status === "scheduling"
    ) {
      return "화상테스트 일정 협의";
    }

    if (
      levelTest.interview_status === "requested" ||
      levelTest.interview_required
    ) {
      return "화상테스트 신청완료";
    }

    if (levelTest.ai_status === "in_progress") {
      return "레벨테스트 계속하기";
    }

    if (
      levelTest.ai_status === "completed" ||
      levelTest.status === "admin_review" ||
      levelTest.status === "interview_required"
    ) {
      return "결과 · 화상테스트";
    }

    return "레벨테스트 확인";
  }

  function getLevelTestHref(
    childId: number,
    levelTest: LevelTest | null
  ) {
    if (levelTest) {
      return `/parent/level-tests/${levelTest.id}`;
    }

    return `/parent/level-tests/new?studentMode=1&childId=${childId}`;
  }

  const nextSessionChild = getChildBySession(nextSession);
  const nextSessionCourse = getCourseName(nextSession);
  const nextSessionTeacher = getTeacherName(nextSession);

  const recentEvaluationSession = recentEvaluation
    ? getSessionById(recentEvaluation.class_session_id)
    : null;

  const recentEvaluationChild = getChildBySession(recentEvaluationSession);
  const recentEvaluationCourse = getCourseName(recentEvaluationSession);
  const recentEvaluationAverage = getScoreAverage(recentEvaluation);

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
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
            <div className="talkly-eyebrow">TALKLY PARENT</div>

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
              자녀의 수업 일정과 출결, 학습 평가를 한 곳에서 확인하세요.
              <br />
              오늘도 TALKLY가 꾸준한 영어 학습을 함께합니다.
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

        <section className="talkly-stat-grid">
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">등록 자녀</div>
            <div className="talkly-stat-value">{children.length}명</div>
            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              TALKLY에 등록된 자녀
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
              출석·지각·결석 기록 기준
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
              전체 회차 평가 평균
            </div>
          </div>
        </section>

        <section
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
                  {nextSessionChild?.name || "학생"} · {nextSessionTeacher}
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

                  {nextSessionChild && (
                    <Link
                      href={`/parent/children/${nextSessionChild.id}/classes/${nextSession.id}`}
                      className="talkly-button talkly-button-secondary"
                    >
                      수업 상세
                    </Link>
                  )}
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
              TALKLY LEARNING
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "24px",
                lineHeight: 1.35,
              }}
            >
              수업만 하고
              <br />
              끝나지 않습니다.
            </h2>

            <p
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.75,
                fontSize: "14px",
              }}
            >
              매 수업의 출석, 평가, 숙제와 강사 코멘트를 학부모 페이지에서
              계속 확인할 수 있습니다.
            </p>

            <Link
              href="/parent/children"
              style={{
                display: "inline-flex",
                marginTop: "22px",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: "14px",
              }}
            >
              학습 기록 확인 →
            </Link>
          </div>
        </section>

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "20px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div className="talkly-section-label">MY CHILDREN</div>
              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "25px",
                }}
              >
                자녀 학습관리
              </h2>
            </div>

            <Link
              href="/parent/children"
              style={{
                color: "var(--talkly-blue)",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              전체 보기 →
            </Link>
          </div>

          {children.length === 0 ? (
            <div
              className="talkly-card"
              style={{
                padding: "30px",
              }}
            >
              <strong style={{ color: "var(--talkly-navy)" }}>
                등록된 자녀가 없습니다.
              </strong>

              <p
                style={{
                  margin: "8px 0 18px",
                  color: "var(--text-muted)",
                }}
              >
                자녀를 등록하면 수업과 학습기록을 관리할 수 있습니다.
              </p>

              <Link
                href="/parent/children/new"
                className="talkly-button talkly-button-primary"
              >
                + 자녀 등록
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
              }}
            >
              {children.map((child) => {
                const childEnrollments = enrollments.filter(
                  (enrollment) => enrollment.child_id === child.id
                );

                const childEnrollmentIds = new Set(
                  childEnrollments.map((item) => item.id)
                );

                const childSessions = sessions.filter((session) =>
                  childEnrollmentIds.has(session.enrollment_id)
                );

                const childSessionIds = new Set(
                  childSessions.map((session) => session.id)
                );

                const childEvaluations = evaluations.filter((evaluation) =>
                  childSessionIds.has(evaluation.class_session_id)
                );

                const latestLevelTest =
                  getLatestLevelTest(child.id);

                return (
                  <div
                    key={child.id}
                    className="talkly-card talkly-card-hover"
                    style={{
                      padding: "24px",
                    }}
                  >
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "14px",
                        background: "var(--talkly-blue-light)",
                        color: "var(--talkly-blue)",
                        fontSize: "20px",
                        fontWeight: 900,
                      }}
                    >
                      {child.name.slice(0, 1)}
                    </div>

                    <h3
                      style={{
                        margin: "14px 0 0",
                        color: "var(--talkly-navy)",
                        fontSize: "20px",
                      }}
                    >
                      {child.name}
                    </h3>

                    <div
                      style={{
                        marginTop: "7px",
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      수업 {childSessions.length}회 · 평가{" "}
                      {childEvaluations.length}건
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginTop: "20px",
                      }}
                    >
                      <Link
                        href={`/parent/children/${child.id}/classes`}
                        className="talkly-button talkly-button-secondary"
                      >
                        수업
                      </Link>

                      <Link
                        href={`/parent/children/${child.id}/attendance`}
                        className="talkly-button talkly-button-secondary"
                      >
                        출결
                      </Link>

                      <Link
                        href={`/parent/children/${child.id}/evaluations`}
                        className="talkly-button talkly-button-primary"
                      >
                        학습평가
                      </Link>

                      <Link
                        href={getLevelTestHref(
                          child.id,
                          latestLevelTest
                        )}
                        className="talkly-button talkly-button-secondary"
                      >
                        {getLevelTestButtonLabel(latestLevelTest)}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div>
            <div className="talkly-section-label">RECENT FEEDBACK</div>
            <h2
              style={{
                margin: "5px 0 16px",
                color: "var(--talkly-navy)",
                fontSize: "25px",
              }}
            >
              최근 학습평가
            </h2>
          </div>

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
                    {recentEvaluationChild?.name || "학생"} ·{" "}
                    {recentEvaluationSession.lesson_number}회차
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

              {recentEvaluationChild && (
                <div style={{ marginTop: "20px" }}>
                  <Link
                    href={`/parent/children/${recentEvaluationChild.id}/evaluations`}
                    className="talkly-button talkly-button-primary"
                  >
                    전체 학습평가 보기 →
                  </Link>
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
    </div>
  );
}