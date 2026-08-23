import Link from "next/link";
import { redirect } from "next/navigation";
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

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

export default async function StudentEvaluationsPage() {
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
        scheduled_start
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", { ascending: false });

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
      .in("class_session_id", sessionIds)
      .order("updated_at", { ascending: false });

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
    new Set(evaluations.map((evaluation) => evaluation.teacher_user_id))
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

  function getSession(sessionId: number) {
    return sessions.find((session) => session.id === sessionId) ?? null;
  }

  function getCourseName(sessionId: number) {
    const session = getSession(sessionId);
    if (!session) return "-";

    const enrollment = enrollments.find(
      (item) => item.id === session.enrollment_id
    );

    if (!enrollment) return "-";

    return (
      courses.find((course) => course.id === enrollment.course_id)?.name ?? "-"
    );
  }

  function getTeacherName(teacherUserId: string) {
    return (
      teachers.find((teacher) => teacher.user_id === teacherUserId)
        ?.display_name ?? "담당 강사"
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

  function getScoreText(score: number | null) {
    return score === null ? "-" : `${score} / 5`;
  }

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

    if (scores.length === 0) return null;

    return (
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    ).toFixed(1);
  }

  const validEvaluations = evaluations.filter((evaluation) =>
    [
      evaluation.participation_score,
      evaluation.comprehension_score,
      evaluation.speaking_score,
      evaluation.pronunciation_score,
    ].every((score) => typeof score === "number")
  );

  const totalScore = validEvaluations.reduce(
    (sum, evaluation) =>
      sum +
      (evaluation.participation_score ?? 0) +
      (evaluation.comprehension_score ?? 0) +
      (evaluation.speaking_score ?? 0) +
      (evaluation.pronunciation_score ?? 0),
    0
  );

  const totalScoreCount = validEvaluations.length * 4;

  const averageScore =
    totalScoreCount > 0
      ? (totalScore / totalScoreCount).toFixed(1)
      : null;

  const participationAverage =
    getSkillAverage("participation_score");
  const comprehensionAverage =
    getSkillAverage("comprehension_score");
  const speakingAverage =
    getSkillAverage("speaking_score");
  const pronunciationAverage =
    getSkillAverage("pronunciation_score");

  const evaluationTrend = evaluations
    .map((evaluation) => {
      const session = getSession(evaluation.class_session_id);

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

      return {
        lessonNumber: session.lesson_number,
        scheduledStart: session.scheduled_start,
        average:
          scores.reduce(
            (sum, score) => sum + (score ?? 0),
            0
          ) / 4,
      };
    })
    .filter(
      (
        item
      ): item is {
        lessonNumber: number;
        scheduledStart: string;
        average: number;
      } => Boolean(item)
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() -
        new Date(b.scheduledStart).getTime()
    )
    .slice(-6);

  const latestScore =
    evaluationTrend.length > 0
      ? evaluationTrend[evaluationTrend.length - 1].average.toFixed(1)
      : null;

  const bestScore =
    evaluationTrend.length > 0
      ? Math.max(
          ...evaluationTrend.map((item) => item.average)
        ).toFixed(1)
      : null;

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
                MY EVALUATIONS
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                학습평가
              </h1>

              <p className="talkly-dashboard-subtitle">
                회차별 학습평가와 강사의 피드백을 확인합니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
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
                  전체 평균
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "var(--talkly-navy)",
                    fontSize: "29px",
                    fontWeight: 900,
                  }}
                >
                  {averageScore ?? "-"}
                  {averageScore && (
                    <span
                      style={{
                        marginLeft: "5px",
                        fontSize: "14px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      / 5
                    </span>
                  )}
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
          className="student-evaluation-stats"
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(140px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            ["등록 평가", `${evaluations.length}건`],
            [
              "참여도",
              participationAverage
                ? `${participationAverage} / 5`
                : "-",
            ],
            [
              "이해도",
              comprehensionAverage
                ? `${comprehensionAverage} / 5`
                : "-",
            ],
            [
              "말하기",
              speakingAverage
                ? `${speakingAverage} / 5`
                : "-",
            ],
            [
              "발음",
              pronunciationAverage
                ? `${pronunciationAverage} / 5`
                : "-",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="talkly-card"
              style={{ padding: "19px" }}
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
                  marginTop: "7px",
                  color: "var(--talkly-navy)",
                  fontSize: "23px",
                  fontWeight: 900,
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
                LEARNING TREND
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "23px",
                }}
              >
                최근 평가 추이
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                최근 6회의 네 영역 평균 점수입니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span className="talkly-badge talkly-badge-blue">
                최근 {latestScore ?? "-"} / 5
              </span>

              <span className="talkly-badge talkly-badge-success">
                최고 {bestScore ?? "-"} / 5
              </span>
            </div>
          </div>

          {evaluationTrend.length === 0 ? (
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
              className="student-evaluation-trend"
              style={{
                marginTop: "24px",
                display: "grid",
                gridTemplateColumns:
                  `repeat(${evaluationTrend.length}, minmax(72px, 1fr))`,
                gap: "12px",
                alignItems: "end",
              }}
            >
              {evaluationTrend.map((item) => {
                const height = Math.max(
                  0,
                  Math.min(100, (item.average / 5) * 100)
                );

                return (
                  <div
                    key={`${item.lessonNumber}-${item.scheduledStart}`}
                  >
                    <div
                      style={{
                        height: "170px",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        padding: "0 8px",
                        borderRadius: "12px",
                        background: "var(--talkly-blue-soft)",
                        border: "1px solid #e5ecf6",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          maxWidth: "54px",
                          height: `${height}%`,
                          minHeight: "8px",
                          borderRadius: "10px 10px 4px 4px",
                          background:
                            "linear-gradient(180deg, var(--talkly-blue), var(--talkly-navy))",
                          display: "flex",
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
                EVALUATION HISTORY
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  color: "var(--talkly-navy)",
                  fontSize: "24px",
                }}
              >
                회차별 평가
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                최근 평가부터 표시됩니다.
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

          {evaluations.length === 0 ? (
            <div
              style={{
                marginTop: "24px",
                padding: "28px",
                border: "1px dashed var(--border)",
                borderRadius: "12px",
                color: "var(--text-muted)",
              }}
            >
              아직 등록된 학습평가가 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {evaluations.map((evaluation) => {
                const session = getSession(
                  evaluation.class_session_id
                );

                if (!session) return null;

                return (
                  <article
                    key={evaluation.id}
                    style={{
                      padding: "24px",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      background: "#ffffff",
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
                        <h3
                          style={{
                            margin: 0,
                            color: "var(--talkly-navy)",
                            fontSize: "21px",
                          }}
                        >
                          {session.lesson_number}회차 평가
                        </h3>

                        <div
                          style={{
                            marginTop: "6px",
                            color: "var(--text-muted)",
                            fontSize: "14px",
                          }}
                        >
                          {formatDateTime(
                            session.scheduled_start
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "var(--text-secondary)",
                            fontSize: "13px",
                          }}
                        >
                          {getCourseName(session.id)} ·{" "}
                          {getTeacherName(
                            evaluation.teacher_user_id
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/classroom/${session.id}`}
                        style={{
                          color: "var(--talkly-blue)",
                          textDecoration: "none",
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        수업 보기 →
                      </Link>
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
                        [
                          "참여도",
                          evaluation.participation_score,
                        ],
                        [
                          "이해도",
                          evaluation.comprehension_score,
                        ],
                        [
                          "말하기",
                          evaluation.speaking_score,
                        ],
                        [
                          "발음",
                          evaluation.pronunciation_score,
                        ],
                      ].map(([label, value]) => (
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
                              marginTop: "5px",
                              color: "var(--talkly-navy)",
                              fontSize: "20px",
                              fontWeight: 900,
                            }}
                          >
                            {getScoreText(
                              value as number | null
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {[
                      ["잘한 점", evaluation.strengths],
                      ["보완할 점", evaluation.improvements],
                      ["숙제", evaluation.homework],
                      [
                        "강사 코멘트",
                        evaluation.teacher_comment,
                      ],
                    ].map(([label, value]) =>
                      value ? (
                        <div
                          key={String(label)}
                          style={{
                            marginTop: "18px",
                          }}
                        >
                          <strong
                            style={{
                              color: "var(--talkly-navy)",
                              fontSize: "13px",
                            }}
                          >
                            {label}
                          </strong>

                          <div
                            style={{
                              marginTop: "8px",
                              padding: "16px",
                              border:
                                "1px solid var(--border-light)",
                              borderRadius: "10px",
                              background: "#f9fbfe",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.7,
                              color: "var(--text-secondary)",
                              fontSize: "14px",
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      ) : null
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 960px) {
          .student-evaluation-stats {
            grid-template-columns:
              repeat(3, minmax(140px, 1fr)) !important;
          }
        }

        @media (max-width: 620px) {
          .talkly-dashboard-main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .student-evaluation-stats {
            grid-template-columns:
              repeat(2, minmax(120px, 1fr)) !important;
          }

          .student-evaluation-trend {
            display: flex !important;
            overflow-x: auto;
            gap: 10px !important;
            padding-bottom: 8px;
          }

          .student-evaluation-trend > div {
            min-width: 88px;
          }
        }
      `}</style>
    </div>
  );
}