import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Enrollment = {
  id: number;
  course_id: number;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
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

  parent_summary: string | null;

  analyzed_at: string | null;
};

type Course = {
  id: number;
  name: string;
};

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 관리자 환경변수가 없습니다."
    );
  }

  return createAdminClient(
    url,
    key,
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
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(value)
  );
}

function combineLanguageAnalysis(
  report: AiReport
) {
  const parts: string[] = [];

  if (
    report.grammar_analysis
  ) {
    parts.push(
      `문법\n${report.grammar_analysis}`
    );
  }

  if (
    report.vocabulary_analysis
  ) {
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

  if (
    report.fluency_analysis
  ) {
    parts.push(
      `말하기 흐름\n${report.fluency_analysis}`
    );
  }

  return parts.length >
    0
    ? parts.join("\n\n")
    : null;
}

export default async function ParentChildAiReportsPage({
  params,
}: PageProps) {
  const { id } =
    await params;

  const childId =
    Number(id);

  if (
    !Number.isInteger(
      childId
    )
  ) {
    notFound();
  }

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
    .select(
      "role, name"
    )
    .eq(
      "id",
      user.id
    )
    .maybeSingle();

  if (
    profileError
  ) {
    throw new Error(
      profileError.message
    );
  }

  if (
    !profile ||
    profile.role !==
      "parent"
  ) {
    redirect("/");
  }

  /*
   * 학부모 본인의 자녀인지 확인
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(
      "id, name, is_active"
    )
    .eq(
      "id",
      childId
    )
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (childError) {
    throw new Error(
      childError.message
    );
  }

  if (!child) {
    notFound();
  }

  const {
    data:
      enrollmentData,
    error:
      enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id
    `)
    .eq(
      "child_id",
      child.id
    );

  if (
    enrollmentError
  ) {
    throw new Error(
      enrollmentError.message
    );
  }

  const enrollments =
    (enrollmentData ??
      []) as Enrollment[];

  const enrollmentIds =
    enrollments.map(
      (item) =>
        item.id
    );

  let sessions:
    ClassSession[] = [];

  if (
    enrollmentIds.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start
      `)
      .in(
        "enrollment_id",
        enrollmentIds
      )
      .order(
        "scheduled_start",
        {
          ascending:
            false,
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

  let reports:
    AiReport[] = [];

  if (
    sessionIds.length >
    0
  ) {
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
        parent_summary,
        analyzed_at
      `)
      .in(
        "class_session_id",
        sessionIds
      )
      .eq(
        "status",
        "completed"
      )
      .order(
        "analyzed_at",
        {
          ascending:
            false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    reports =
      (data ??
        []) as AiReport[];
  }

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

  if (
    courseIds.length >
    0
  ) {
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

    if (!error) {
      courses =
        (data ??
          []) as Course[];
    }
  }

  function getSession(
    sessionId: number
  ) {
    return sessions.find(
      (session) =>
        session.id ===
        sessionId
    );
  }

  function getCourseName(
    session:
      ClassSession
  ) {
    const enrollment =
      enrollments.find(
        (item) =>
          item.id ===
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

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        <Link
          href={`/parent/children/${child.id}`}
          style={{
            color:
              "var(--talkly-blue)",

            textDecoration:
              "none",

            fontSize:
              "14px",

            fontWeight:
              800,
          }}
        >
          ← 자녀 상세
        </Link>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "20px",

            padding:
              "32px",

            background:
              "linear-gradient(135deg, #f7faff 0%, #edf4ff 100%)",

            border:
              "1px solid #dce8fa",
          }}
        >
          <div className="talkly-section-label">
            AI CLASS REPORT
          </div>

          <h1
            className="talkly-dashboard-title"
            style={{
              margin:
                "6px 0 0",
            }}
          >
            {child.name} AI
            수업 분석
          </h1>

          <p
            className="talkly-dashboard-subtitle"
            style={{
              marginBottom:
                0,
            }}
          >
            TALKLY AI가 실제
            수업 내용을
            분석한 회차별
            학습 리포트입니다.
          </p>

          <div
            style={{
              marginTop:
                "20px",

              display:
                "flex",

              gap:
                "12px",

              flexWrap:
                "wrap",
            }}
          >
            <Link
              href={`/parent/children/${child.id}/classes`}
              className="talkly-button talkly-button-secondary"
            >
              수업 일정 →
            </Link>

            <Link
              href={`/parent/children/${child.id}/evaluations`}
              className="talkly-button talkly-button-secondary"
            >
              학습평가 →
            </Link>
          </div>
        </section>

        <section
          style={{
            marginTop:
              "28px",
          }}
        >
          {reports.length ===
          0 ? (
            <div
              className="talkly-card"
              style={{
                padding:
                  "36px",

                textAlign:
                  "center",

                color:
                  "var(--text-muted)",
              }}
            >
              <div
                style={{
                  color:
                    "var(--talkly-navy)",

                  fontSize:
                    "20px",

                  fontWeight:
                    900,
                }}
              >
                아직 AI 분석
                리포트가
                없습니다.
              </div>

              <p
                style={{
                  margin:
                    "10px 0 0",

                  lineHeight:
                    1.7,
                }}
              >
                수업이 종료되고
                AI 분석이
                완료되면 이곳에서
                확인할 수
                있습니다.
              </p>
            </div>
          ) : (
            <div
              style={{
                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  "20px",
              }}
            >
              {reports.map(
                (
                  report
                ) => {
                  const session =
                    getSession(
                      report.class_session_id
                    );

                  if (
                    !session
                  ) {
                    return null;
                  }

                  const languageAnalysis =
                    combineLanguageAnalysis(
                      report
                    );

                  return (
                    <article
                      key={
                        report.id
                      }
                      className="talkly-card"
                      style={{
                        padding:
                          "30px",
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
                          <div className="talkly-section-label">
                            AI REPORT
                          </div>

                          <h2
                            style={{
                              margin:
                                "6px 0 0",

                              color:
                                "var(--talkly-navy)",

                              fontSize:
                                "23px",
                            }}
                          >
                            {
                              session.lesson_number
                            }
                            회차 AI 수업
                            분석
                          </h2>

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
                            {getCourseName(
                              session
                            )}{" "}
                            ·{" "}
                            {formatDateTime(
                              session.scheduled_start
                            )}
                          </div>
                        </div>

                        <span className="talkly-badge talkly-badge-blue">
                          AI 분석 완료
                        </span>
                      </div>

                      <ReportSection
                        title="이번 수업 요약"
                        value={
                          report.summary
                        }
                        featured
                      />

                      <ReportSection
                        title="잘한 점"
                        value={
                          report.strengths
                        }
                      />

                      <ReportSection
                        title="개선이 필요한 점"
                        value={
                          report.improvements
                        }
                      />

                      <ReportSection
                        title="문법 · 어휘 분석"
                        value={
                          languageAnalysis
                        }
                      />

                      <ReportSection
                        title="추천 학습"
                        value={
                          report.recommended_practice
                        }
                      />

                      <ReportSection
                        title="AI 종합 코멘트"
                        value={
                          report.parent_summary
                        }
                        featured
                      />
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

function ReportSection({
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
    <section
      style={{
        marginTop:
          "20px",
      }}
    >
      <h3
        style={{
          margin: 0,

          color:
            "var(--talkly-navy)",

          fontSize:
            "16px",
        }}
      >
        {title}
      </h3>

      <div
        style={{
          marginTop:
            "9px",

          padding:
            "18px",

          borderRadius:
            "11px",

          border:
            featured
              ? "1px solid #cbdcf5"
              : "1px solid var(--border)",

          background:
            featured
              ? "var(--talkly-blue-soft)"
              : "#ffffff",

          color:
            "var(--text-secondary)",

          whiteSpace:
            "pre-wrap",

          lineHeight:
            1.8,

          fontSize:
            "14px",
        }}
      >
        {value}
      </div>
    </section>
  );
}