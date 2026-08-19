import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

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
  scheduled_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
};

type Evaluation = {
  id: number;
  class_session_id: number;
  teacher_user_id: string;
  participation_score: number | null;
  comprehension_score: number | null;
  speaking_score: number | null;
  pronunciation_score: number | null;
  strengths: string | null;
  improvements: string | null;
  homework: string | null;
  teacher_comment: string | null;
  created_at: string;
  updated_at: string;
};

type Attendance = {
  id: number;
  class_session_id: number;
  status: string;
  attended_at: string | null;
};

type AiReport = {
  id: number;
  class_session_id: number;
  status: string;
  summary: string | null;
  strengths: string | null;
  improvements: string | null;
  grammar_analysis: string | null;
  vocabulary_analysis: string | null;
  pronunciation_analysis: string | null;
  fluency_analysis: string | null;
  recommended_practice: string | null;
  student_summary: string | null;
  analyzed_at: string | null;
};

type Course = {
  id: number;
  name: string;
};

type TeacherProfile = {
  user_id: string;
  display_name: string | null;
};

type UserProfile = {
  id: string;
  name: string | null;
};

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase 관리자 환경변수가 설정되지 않았습니다."
    );
  }

  return createAdminClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}

function getScoreText(
  score: number | null
) {
  return score === null
    ? "-"
    : `${score} / 5`;
}

function getAttendanceLabel(
  status?: string | null
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
      return "미기록";
  }
}

function getSessionStatusLabel(
  status: string
) {
  switch (status) {
    case "scheduled":
      return "예정";

    case "in_progress":
      return "수업 진행 중";

    case "completed":
      return "수업 완료";

    case "held":
      return "결석 승인";

    case "cancelled":
      return "취소";

    case "no_show":
      return "무단결석";

    default:
      return status;
  }
}

function combineLanguageAnalysis(
  report: AiReport
) {
  const parts: string[] = [];

  if (report.grammar_analysis) {
    parts.push(
      `문법\n${report.grammar_analysis}`
    );
  }

  if (report.vocabulary_analysis) {
    parts.push(
      `어휘\n${report.vocabulary_analysis}`
    );
  }

  if (
    report.pronunciation_analysis
  ) {
    parts.push(
      `발음\n${report.pronunciation_analysis}`
    );
  }

  if (report.fluency_analysis) {
    parts.push(
      `말하기 흐름\n${report.fluency_analysis}`
    );
  }

  return parts.length > 0
    ? parts.join("\n\n")
    : null;
}

export default async function StudentEvaluationsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message
    );
  }

  if (
    !profile ||
    profile.role !== "student"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 학생 수강정보
   * ==========================================
   */
  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      teacher_user_id
    `)
    .eq(
      "student_user_id",
      user.id
    );

  if (enrollmentError) {
    throw new Error(
      enrollmentError.message
    );
  }

  const enrollments =
    (enrollmentData ??
      []) as Enrollment[];

  const enrollmentIds =
    enrollments.map(
      (item) => item.id
    );

  /*
   * ==========================================
   * 수업 회차
   * ==========================================
   */
  let sessions:
    ClassSession[] = [];

  if (enrollmentIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
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
      .in(
        "enrollment_id",
        enrollmentIds
      )
      .order(
        "scheduled_start",
        {
          ascending: false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    sessions =
      (data ??
        []) as ClassSession[];
  }

  const sessionIds =
    sessions.map(
      (session) =>
        session.id
    );

  /*
   * ==========================================
   * 강사 평가 + 출결
   * ==========================================
   */
  let evaluations:
    Evaluation[] = [];

  let attendances:
    Attendance[] = [];

  if (sessionIds.length > 0) {
    const [
      evaluationResult,
      attendanceResult,
    ] =
      await Promise.all([
        supabase
          .from("evaluations")
          .select(`
            id,
            class_session_id,
            teacher_user_id,
            participation_score,
            comprehension_score,
            speaking_score,
            pronunciation_score,
            strengths,
            improvements,
            homework,
            teacher_comment,
            created_at,
            updated_at
          `)
          .in(
            "class_session_id",
            sessionIds
          )
          .order(
            "updated_at",
            {
              ascending: false,
            }
          ),

        supabase
          .from("attendance")
          .select(`
            id,
            class_session_id,
            status,
            attended_at
          `)
          .in(
            "class_session_id",
            sessionIds
          ),
      ]);

    if (evaluationResult.error) {
      throw new Error(
        evaluationResult.error.message
      );
    }

    if (attendanceResult.error) {
      throw new Error(
        attendanceResult.error.message
      );
    }

    evaluations =
      (evaluationResult.data ??
        []) as Evaluation[];

    attendances =
      (attendanceResult.data ??
        []) as Attendance[];
  }

  /*
   * ==========================================
   * AI 수업 리포트
   * ==========================================
   */
  let aiReports:
    AiReport[] = [];

  if (sessionIds.length > 0) {
    const admin =
      createAdmin();

    const {
      data,
      error,
    } = await admin
      .from(
        "ai_class_reports"
      )
      .select(`
        id,
        class_session_id,
        status,
        summary,
        strengths,
        improvements,
        grammar_analysis,
        vocabulary_analysis,
        pronunciation_analysis,
        fluency_analysis,
        recommended_practice,
        student_summary,
        analyzed_at
      `)
      .in(
        "class_session_id",
        sessionIds
      )
      .eq(
        "status",
        "completed"
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    aiReports =
      (data ??
        []) as AiReport[];
  }

  /*
   * ==========================================
   * 과정
   * ==========================================
   */
  const courseIds =
    Array.from(
      new Set(
        enrollments.map(
          (item) =>
            item.course_id
        )
      )
    );

  let courses:
    Course[] = [];

  if (courseIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("courses")
      .select(
        "id, name"
      )
      .in(
        "id",
        courseIds
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    courses =
      (data ??
        []) as Course[];
  }

  /*
   * ==========================================
   * 강사 이름
   * ==========================================
   */
  const teacherIds =
    Array.from(
      new Set(
        [
          ...evaluations.map(
            (item) =>
              item.teacher_user_id
          ),

          ...enrollments
            .map(
              (item) =>
                item.teacher_user_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            ),
        ]
      )
    );

  let teacherProfiles:
    TeacherProfile[] = [];

  let userProfiles:
    UserProfile[] = [];

  if (teacherIds.length > 0) {
    const admin =
      createAdmin();

    const [
      teacherResult,
      profileResult,
    ] =
      await Promise.all([
        admin
          .from(
            "teacher_profiles"
          )
          .select(
            "user_id, display_name"
          )
          .in(
            "user_id",
            teacherIds
          ),

        admin
          .from("profiles")
          .select(
            "id, name"
          )
          .in(
            "id",
            teacherIds
          ),
      ]);

    if (!teacherResult.error) {
      teacherProfiles =
        (teacherResult.data ??
          []) as TeacherProfile[];
    }

    if (!profileResult.error) {
      userProfiles =
        (profileResult.data ??
          []) as UserProfile[];
    }
  }

  function getSession(
    sessionId: number
  ) {
    return (
      sessions.find(
        (session) =>
          session.id ===
          sessionId
      ) ?? null
    );
  }

  function getEnrollment(
    enrollmentId: number
  ) {
    return (
      enrollments.find(
        (item) =>
          item.id ===
          enrollmentId
      ) ?? null
    );
  }

  function getCourseName(
    sessionId: number
  ) {
    const session =
      getSession(
        sessionId
      );

    if (!session) {
      return "-";
    }

    const enrollment =
      getEnrollment(
        session.enrollment_id
      );

    if (!enrollment) {
      return "-";
    }

    return (
      courses.find(
        (course) =>
          course.id ===
          enrollment.course_id
      )?.name ?? "-"
    );
  }

  function getTeacherName(
    teacherUserId: string
  ) {
    const displayName =
      teacherProfiles.find(
        (teacher) =>
          teacher.user_id ===
          teacherUserId
      )?.display_name;

    if (displayName?.trim()) {
      return displayName.trim();
    }

    const profileName =
      userProfiles.find(
        (item) =>
          item.id ===
          teacherUserId
      )?.name;

    if (profileName?.trim()) {
      return profileName.trim();
    }

    return "담당 강사";
  }

  function getAttendance(
    sessionId: number
  ) {
    return (
      attendances.find(
        (attendance) =>
          attendance
            .class_session_id ===
          sessionId
      ) ?? null
    );
  }

  function getAiReport(
    sessionId: number
  ) {
    return (
      aiReports.find(
        (report) =>
          report.class_session_id ===
          sessionId
      ) ?? null
    );
  }

  /*
   * ==========================================
   * 통계
   * ==========================================
   */
  const validEvaluations =
    evaluations.filter(
      (evaluation) =>
        [
          evaluation
            .participation_score,
          evaluation
            .comprehension_score,
          evaluation
            .speaking_score,
          evaluation
            .pronunciation_score,
        ].every(
          (score) =>
            typeof score ===
            "number"
        )
    );

  const totalScore =
    validEvaluations.reduce(
      (
        sum,
        evaluation
      ) =>
        sum +
        (evaluation
          .participation_score ??
          0) +
        (evaluation
          .comprehension_score ??
          0) +
        (evaluation
          .speaking_score ??
          0) +
        (evaluation
          .pronunciation_score ??
          0),
      0
    );

  const scoreCount =
    validEvaluations.length *
    4;

  const averageScore =
    scoreCount > 0
      ? (
          totalScore /
          scoreCount
        ).toFixed(1)
      : "-";

  const completedSessions =
    sessions.filter(
      (session) =>
        session.status ===
          "completed" ||
        Boolean(
          session.ended_at
        )
    );

  const evaluationRate =
    completedSessions.length > 0
      ? Math.round(
          (evaluations.length /
            completedSessions.length) *
            100
        )
      : 0;

  /*
   * 강사 평가 또는 AI 리포트가
   * 하나라도 있는 회차를 표시합니다.
   */
  const reportSessionIds =
    Array.from(
      new Set([
        ...evaluations.map(
          (item) =>
            item.class_session_id
        ),
        ...aiReports.map(
          (item) =>
            item.class_session_id
        ),
      ])
    );

  const reportSessions =
    sessions
      .filter(
        (session) =>
          reportSessionIds.includes(
            session.id
          )
      )
      .sort(
        (a, b) =>
          new Date(
            b.scheduled_start
          ).getTime() -
          new Date(
            a.scheduled_start
          ).getTime()
      );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="student"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        <section
          className="talkly-card"
          style={{
            padding: "32px",
            background:
              "linear-gradient(135deg, #f7faff 0%, #edf4ff 100%)",
            border:
              "1px solid #dce8fa",
          }}
        >
          <div className="talkly-section-label">
            LEARNING REPORT
          </div>

          <h1
            className="talkly-dashboard-title"
            style={{
              margin:
                "6px 0 0",
            }}
          >
            학습평가
          </h1>

          <p
            className="talkly-dashboard-subtitle"
            style={{
              marginBottom:
                0,
            }}
          >
            강사 평가와 TALKLY
            AI 수업 분석을 회차별로
            한 곳에서 확인합니다.
          </p>

          <div
            style={{
              marginTop:
                "22px",
              display:
                "flex",
              gap:
                "10px",
              flexWrap:
                "wrap",
            }}
          >
            <Link
              href="/student"
              className="talkly-button talkly-button-secondary"
            >
              ← 대시보드
            </Link>

            <Link
              href="/student/classes"
              className="talkly-button talkly-button-secondary"
            >
              내 수업 →
            </Link>
          </div>
        </section>

        <section
          className="talkly-stat-grid"
          style={{
            marginTop:
              "24px",
          }}
        >
          <StatCard
            label="등록된 평가"
            value={`${evaluations.length}건`}
            description="강사가 등록한 학습평가"
          />

          <StatCard
            label="전체 평균"
            value={
              averageScore === "-"
                ? "-"
                : `${averageScore} / 5`
            }
            description="4개 평가 영역 평균"
          />

          <StatCard
            label="AI 분석"
            value={`${aiReports.length}건`}
            description="완료된 AI 수업 리포트"
          />

          <StatCard
            label="평가 등록률"
            value={`${evaluationRate}%`}
            description="완료 수업 대비 강사 평가"
          />
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "28px",
            padding:
              "28px",
          }}
        >
          <div className="talkly-section-label">
            CLASS REPORT
          </div>

          <h2
            style={{
              margin:
                "5px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize:
                "24px",
            }}
          >
            회차별 수업 리포트
          </h2>

          <p
            style={{
              margin:
                "8px 0 0",
              color:
                "var(--text-muted)",
              fontSize:
                "14px",
            }}
          >
            강사 평가와 AI 분석을
            같은 회차에서 함께
            확인할 수 있습니다.
          </p>

          {reportSessions.length ===
          0 ? (
            <div
              style={{
                marginTop:
                  "24px",
                padding:
                  "30px",
                border:
                  "1px dashed var(--border)",
                borderRadius:
                  "12px",
                color:
                  "var(--text-muted)",
                textAlign:
                  "center",
              }}
            >
              아직 등록된 수업
              리포트가 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop:
                  "24px",
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "22px",
              }}
            >
              {reportSessions.map(
                (session) => {
                  const evaluation =
                    evaluations.find(
                      (item) =>
                        item.class_session_id ===
                        session.id
                    ) ?? null;

                  const attendance =
                    getAttendance(
                      session.id
                    );

                  const aiReport =
                    getAiReport(
                      session.id
                    );

                  return (
                    <article
                      key={
                        session.id
                      }
                      style={{
                        border:
                          "1px solid var(--border)",
                        borderRadius:
                          "16px",
                        background:
                          "#ffffff",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding:
                            "24px",
                          background:
                            "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "flex-start",
                            gap:
                              "20px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                margin:
                                  0,
                                color:
                                  "var(--talkly-navy)",
                                fontSize:
                                  "22px",
                              }}
                            >
                              {
                                session.lesson_number
                              }
                              회차
                              수업 리포트
                            </h3>

                            <div
                              style={{
                                marginTop:
                                  "7px",
                                color:
                                  "var(--text-muted)",
                                fontSize:
                                  "14px",
                              }}
                            >
                              {formatDateTime(
                                session.scheduled_start
                              )}
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "5px",
                                color:
                                  "var(--text-secondary)",
                                fontSize:
                                  "13px",
                              }}
                            >
                              {getCourseName(
                                session.id
                              )}

                              {evaluation && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {getTeacherName(
                                    evaluation.teacher_user_id
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "8px",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            {evaluation && (
                              <span className="talkly-badge talkly-badge-blue">
                                강사 평가
                              </span>
                            )}

                            {aiReport && (
                              <span
                                className="talkly-badge"
                                style={{
                                  background:
                                    "#ecfdf3",
                                  border:
                                    "1px solid #b7e4c7",
                                  color:
                                    "#15803d",
                                }}
                              >
                                AI 분석 완료
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop:
                              "18px",
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(160px, 1fr))",
                            gap:
                              "10px",
                          }}
                        >
                          <InfoBox
                            label="수업 상태"
                            value={getSessionStatusLabel(
                              session.status
                            )}
                          />

                          <InfoBox
                            label="출결"
                            value={getAttendanceLabel(
                              attendance
                                ?.status
                            )}
                          />

                          <InfoBox
                            label="강사 평가"
                            value={
                              evaluation
                                ? "등록 완료"
                                : "미등록"
                            }
                          />

                          <InfoBox
                            label="AI 분석"
                            value={
                              aiReport
                                ? "분석 완료"
                                : "아직 없음"
                            }
                          />
                        </div>
                      </div>

                      {evaluation && (
                        <section
                          style={{
                            padding:
                              "0 24px 26px",
                          }}
                        >
                          <div
                            style={{
                              paddingTop:
                                "24px",
                              borderTop:
                                "1px solid var(--border)",
                            }}
                          >
                            <div className="talkly-section-label">
                              TEACHER
                              EVALUATION
                            </div>

                            <h3
                              style={{
                                margin:
                                  "5px 0 0",
                                color:
                                  "var(--talkly-navy)",
                                fontSize:
                                  "19px",
                              }}
                            >
                              강사 학습평가
                            </h3>
                          </div>

                          <div
                            style={{
                              marginTop:
                                "18px",
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(130px, 1fr))",
                              gap:
                                "10px",
                            }}
                          >
                            <ScoreBox
                              en="Participation"
                              ko="참여도"
                              value={
                                evaluation.participation_score
                              }
                            />

                            <ScoreBox
                              en="Comprehension"
                              ko="이해도"
                              value={
                                evaluation.comprehension_score
                              }
                            />

                            <ScoreBox
                              en="Speaking"
                              ko="말하기"
                              value={
                                evaluation.speaking_score
                              }
                            />

                            <ScoreBox
                              en="Pronunciation"
                              ko="발음"
                              value={
                                evaluation.pronunciation_score
                              }
                            />
                          </div>

                          <TextSection
                            title="Strengths"
                            subtitle="잘한 점"
                            value={
                              evaluation.strengths
                            }
                          />

                          <TextSection
                            title="Areas for Improvement"
                            subtitle="보완할 점"
                            value={
                              evaluation.improvements
                            }
                          />

                          <TextSection
                            title="Homework"
                            subtitle="숙제"
                            value={
                              evaluation.homework
                            }
                          />

                          <TextSection
                            title="Teacher Comment"
                            subtitle="강사 종합 의견"
                            value={
                              evaluation.teacher_comment
                            }
                          />

                          <div
                            style={{
                              marginTop:
                                "12px",
                              color:
                                "var(--text-muted)",
                              fontSize:
                                "12px",
                            }}
                          >
                            평가 등록일:{" "}
                            {formatDate(
                              evaluation.updated_at
                            )}
                          </div>
                        </section>
                      )}

                      <section
                        style={{
                          padding:
                            "26px 24px 28px",
                          background:
                            aiReport
                              ? "linear-gradient(135deg, #f7faff 0%, #edf4ff 100%)"
                              : "#fafafa",
                          borderTop:
                            "1px solid var(--border)",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "flex-start",
                            gap:
                              "16px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div>
                            <div className="talkly-section-label">
                              TALKLY AI
                            </div>

                            <h3
                              style={{
                                margin:
                                  "5px 0 0",
                                color:
                                  "var(--talkly-navy)",
                                fontSize:
                                  "20px",
                              }}
                            >
                              AI 수업 분석
                            </h3>
                          </div>

                          {aiReport && (
                            <span className="talkly-badge talkly-badge-blue">
                              AI 분석 완료
                            </span>
                          )}
                        </div>

                        {!aiReport ? (
                          <div
                            style={{
                              marginTop:
                                "18px",
                              padding:
                                "20px",
                              border:
                                "1px dashed #cdd8e8",
                              borderRadius:
                                "11px",
                              color:
                                "var(--text-muted)",
                              background:
                                "rgba(255,255,255,0.65)",
                            }}
                          >
                            이 회차의 AI 수업
                            분석 리포트는 아직
                            생성되지 않았습니다.
                          </div>
                        ) : (
                          <>
                            <AiReportSection
                              title="이번 수업 요약"
                              value={
                                aiReport.summary
                              }
                              featured
                            />

                            <AiReportSection
                              title="잘한 점"
                              value={
                                aiReport.strengths
                              }
                            />

                            <AiReportSection
                              title="개선이 필요한 점"
                              value={
                                aiReport.improvements
                              }
                            />

                            <AiReportSection
                              title="문법 · 어휘 분석"
                              value={combineLanguageAnalysis(
                                aiReport
                              )}
                            />

                            <AiReportSection
                              title="추천 학습"
                              value={
                                aiReport.recommended_practice
                              }
                            />

                            <AiReportSection
                              title="AI 종합 코멘트"
                              value={
                                aiReport.student_summary
                              }
                              featured
                            />
                          </>
                        )}
                      </section>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="talkly-card talkly-stat-card">
      <div className="talkly-stat-label">
        {label}
      </div>

      <div className="talkly-stat-value">
        {value}
      </div>

      <div
        style={{
          marginTop: "6px",
          color:
            "var(--text-muted)",
          fontSize:
            "13px",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius:
          "10px",
        background:
          "#f8fafc",
        border:
          "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          fontSize:
            "11px",
          color:
            "var(--text-muted)",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "var(--talkly-navy)",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ScoreBox({
  en,
  ko,
  value,
}: {
  en: string;
  ko: string;
  value: number | null;
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius:
          "10px",
        background:
          "var(--talkly-blue-soft)",
        border:
          "1px solid #e5ecf6",
      }}
    >
      <div
        style={{
          color:
            "var(--talkly-blue)",
          fontSize:
            "11px",
          fontWeight:
            900,
        }}
      >
        {en}
      </div>

      <div
        style={{
          marginTop:
            "3px",
          color:
            "var(--text-muted)",
          fontSize:
            "12px",
        }}
      >
        {ko}
      </div>

      <div
        style={{
          marginTop:
            "8px",
          color:
            "var(--talkly-navy)",
          fontSize:
            "22px",
          fontWeight:
            900,
        }}
      >
        {getScoreText(
          value
        )}
      </div>
    </div>
  );
}

function TextSection({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div
      style={{
        marginTop:
          "18px",
      }}
    >
      <div
        style={{
          color:
            "var(--talkly-navy)",
          fontSize:
            "15px",
          fontWeight:
            900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop:
            "2px",
          color:
            "var(--text-muted)",
          fontSize:
            "12px",
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          marginTop:
            "8px",
          padding:
            "16px",
          border:
            "1px solid var(--border)",
          borderRadius:
            "10px",
          background:
            "#ffffff",
          whiteSpace:
            "pre-wrap",
          lineHeight:
            1.7,
          color:
            "var(--text-secondary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AiReportSection({
  title,
  value,
  featured = false,
}: {
  title: string;
  value: string | null;
  featured?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <div
      style={{
        marginTop:
          "18px",
      }}
    >
      <div
        style={{
          color:
            "var(--talkly-navy)",
          fontSize:
            "15px",
          fontWeight:
            900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop:
            "8px",
          padding:
            "17px",
          borderRadius:
            "10px",
          border:
            featured
              ? "1px solid #cbdcf5"
              : "1px solid #dae3ef",
          background:
            featured
              ? "#ffffff"
              : "rgba(255,255,255,0.72)",
          whiteSpace:
            "pre-wrap",
          lineHeight:
            1.8,
          color:
            "var(--text-secondary)",
          fontSize:
            "14px",
        }}
      >
        {value}
      </div>
    </div>
  );
}