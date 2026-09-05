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

type Evaluation = {
  id: number;
  class_session_id: number;
};

type TeacherReview = {
  id: number;
  enrollment_id: number;
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
      .order("scheduled_start", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    sessions = (data ?? []) as ClassSession[];

    /*
     * 종료시간이 지났는데 한 번도 시작되지 않은 scheduled 수업은
     * 학생의 내 수업 페이지에서도 미진행(not_held)으로 정리합니다.
     *
     * 이미 시작된 수업은 예정 종료시간이 지나도 자동마감하지 않습니다.
     */
    const nowIso = new Date().toISOString();

    const expiredSessionIds = sessions
      .filter(
        (session) =>
          session.status === "scheduled" &&
          !session.started_at &&
          !session.ended_at &&
          new Date(session.scheduled_end).getTime() <= Date.now()
      )
      .map((session) => session.id);

    if (expiredSessionIds.length > 0) {
      const { error: closeExpiredError } = await supabase
        .from("class_sessions")
        .update({
          status: "not_held",
          updated_at: nowIso,
        })
        .in("id", expiredSessionIds)
        .eq("status", "scheduled")
        .is("started_at", null)
        .lte("scheduled_end", nowIso);

      if (closeExpiredError) {
        throw new Error(closeExpiredError.message);
      }

      const expiredIdSet = new Set(expiredSessionIds);

      sessions = sessions.map((session) =>
        expiredIdSet.has(session.id)
          ? {
              ...session,
              status: "not_held",
            }
          : session
      );
    }
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

  let teacherReviews: TeacherReview[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("teacher_reviews")
      .select("id, enrollment_id")
      .in("enrollment_id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    teacherReviews = (data ?? []) as TeacherReview[];
  }

  const reviewedEnrollmentIds = new Set(
    teacherReviews.map((review) => review.enrollment_id)
  );

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
    if (
      ["held", "cancelled", "no_show", "not_held"].includes(
        session.status
      )
    ) {
      return session.status;
    }

    if (session.ended_at || session.status === "completed") {
      return "completed";
    }

    if (session.started_at || session.status === "in_progress") {
      return "in_progress";
    }

    return "scheduled";
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
        return "결석";
      case "held":
        return "수업 연기";
      case "not_held":
        return "미진행";
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
    if (
      status === "cancelled" ||
      status === "held" ||
      status === "no_show" ||
      status === "not_held"
    ) {
      return false;
    }

    return new Date(session.scheduled_end).getTime() >= now.getTime();
  }).length;

  const completedCount = sessions.filter(
    (session) => getEffectiveStatus(session) === "completed"
  ).length;

  const nextSession =
    sessions
      .filter((session) => {
        const status = getEffectiveStatus(session);

        if (status === "completed") return false;
        if (
          status === "cancelled" ||
          status === "held" ||
          status === "no_show" ||
          status === "not_held"
        ) {
          return false;
        }

        return new Date(session.scheduled_end).getTime() >= now.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime()
      )[0] ?? null;

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
                MY CLASSES
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                내 수업
              </h1>

              <p className="talkly-dashboard-subtitle">
                예정된 수업, 지난 수업과 수강 완료 후 강사평가 상태를 한 곳에서 확인합니다.
              </p>
            </div>

            <Link
              href="/student"
              className="talkly-button talkly-button-secondary"
            >
              ← 대시보드
            </Link>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "220px",
              height: "220px",
              right: "-70px",
              bottom: "-115px",
              borderRadius: "50%",
              background: "rgba(63,117,220,0.08)",
            }}
          />
        </section>

        {pendingReviewEnrollments.length > 0 && (
          <section
            className="talkly-card"
            style={{
              marginTop: "24px",
              padding: "24px",
              border: "1px solid #dbe7ff",
              background: "#f7faff",
            }}
          >
            <div className="talkly-section-label">TEACHER REVIEW</div>
            <h2
              style={{
                margin: "6px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "22px",
              }}
            >
              평가가 필요한 완료 수강 {pendingReviewEnrollments.length}건
            </h2>

            <div
              style={{
                marginTop: "16px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "10px",
              }}
            >
              {pendingReviewEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/student/teacher-reviews/${enrollment.id}`}
                  style={{
                    display: "block",
                    padding: "16px",
                    border: "1px solid #dbe7ff",
                    borderRadius: "11px",
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
                      marginTop: "12px",
                      color: "var(--talkly-blue)",
                      fontSize: "12px",
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
          className="student-next-class-grid"
          style={{
            marginTop: "28px",
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
            gap: "18px",
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
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="talkly-section-label">
                  NEXT CLASS
                </div>

                <h2
                  style={{
                    margin: "5px 0 0",
                    color: "var(--talkly-navy)",
                    fontSize: "23px",
                  }}
                >
                  다음 수업
                </h2>
              </div>

              {nextSession && (
                <span
                  className={getBadgeClass(
                    getEffectiveStatus(nextSession)
                  )}
                >
                  {getStatusLabel(
                    getEffectiveStatus(nextSession)
                  )}
                </span>
              )}
            </div>

            {nextSession ? (
              <div style={{ marginTop: "22px" }}>
                <div
                  style={{
                    color: "var(--talkly-navy)",
                    fontSize: "20px",
                    fontWeight: 900,
                  }}
                >
                  {getCourseName(nextSession)} ·{" "}
                  {nextSession.lesson_number}회차
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  {getTeacherName(nextSession)}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "var(--text-muted)",
                    fontSize: "14px",
                  }}
                >
                  {formatDateTime(nextSession.scheduled_start)}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                  }}
                >
                  {getDurationMinutes(
                    nextSession.scheduled_start,
                    nextSession.scheduled_end
                  )}
                  분 수업
                </div>

                <Link
                  href={`/classroom/${nextSession.id}`}
                  className="talkly-button talkly-button-primary"
                  style={{
                    marginTop: "20px",
                  }}
                >
                  TALKLY Classroom 입장 →
                </Link>
              </div>
            ) : (
              <div
                style={{
                  marginTop: "20px",
                  padding: "22px",
                  border: "1px dashed var(--border)",
                  borderRadius: "10px",
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
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.08em",
                opacity: 0.7,
              }}
            >
              STUDY FLOW
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "22px",
                lineHeight: 1.4,
              }}
            >
              수업 전에는 일정 확인,
              <br />
              수업 후에는 평가 확인.
            </h2>

            <p
              style={{
                margin: "13px 0 0",
                color: "rgba(255,255,255,0.72)",
                fontSize: "13px",
                lineHeight: 1.75,
              }}
            >
              모든 수업 기록은 이 페이지에 계속 쌓입니다.
              완료된 수업은 평가 등록 여부도 함께 확인할 수 있습니다.
            </p>

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/student/attendance"
                style={{
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                출결 보기 →
              </Link>

              <Link
                href="/student/evaluations"
                style={{
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                학습평가 →
              </Link>
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
                    className="talkly-card-hover student-class-row"
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

      <style>{`
        @media (max-width: 940px) {
          .student-next-class-grid {
            grid-template-columns: 1fr !important;
          }

          .student-class-row {
            grid-template-columns:
              80px minmax(180px, 1fr) 130px 110px !important;
          }

          .student-class-row > :nth-child(4) {
            display: none;
          }

          .student-class-row > :nth-child(6) {
            grid-column: 4;
          }
        }

        @media (max-width: 700px) {
          .student-class-row {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .student-class-row > :nth-child(2) {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .student-class-row > :nth-child(3) {
            grid-column: 1 / -1;
            grid-row: 3;
          }

          .student-class-row > :nth-child(5) {
            justify-self: start;
          }

          .student-class-row > :nth-child(6) {
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

          .student-class-row {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start !important;
          }

          .student-class-row > :nth-child(6) {
            align-self: stretch;
            width: 100%;
          }

          .student-class-row > :nth-child(6) a {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}