import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ParentChildClassesPage({
  params,
}: PageProps) {
  const { id } = await params;

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
  } =
    await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: child,
    error: childError,
  } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        is_active
      `)
      .eq(
        "id",
        Number(id)
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
    data: enrollments,
    error: enrollmentError,
  } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons,
        created_at
      `)
      .eq(
        "child_id",
        child.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (enrollmentError) {
    throw new Error(
      enrollmentError.message
    );
  }

  const activeEnrollment =
    enrollments?.find(
      (enrollment) =>
        enrollment.status ===
        "active"
    ) ??
    enrollments?.[0] ??
    null;

  if (!activeEnrollment) {
    return (
      <div className="talkly-dashboard">
        <TalklyUserHeader
          role="parent"
          userName={
            profile.name
          }
        />

        <main className="talkly-dashboard-main">
          <div
            style={{
              marginBottom:
                "20px",
            }}
          >
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
          </div>

          <section
            className="talkly-card"
            style={{
              padding:
                "34px",
            }}
          >
            <div className="talkly-section-label">
              CLASSES
            </div>

            <h1
              className="talkly-dashboard-title"
              style={{
                marginTop:
                  "6px",
              }}
            >
              {child.name} 수업
            </h1>

            <p
              style={{
                margin:
                  "10px 0 0",
                color:
                  "var(--text-muted)",
              }}
            >
              현재 등록된
              수강정보가 없습니다.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const {
    data: course,
  } =
    await supabase
      .from("courses")
      .select(`
        id,
        name,
        duration_minutes
      `)
      .eq(
        "id",
        activeEnrollment.course_id
      )
      .maybeSingle();

  let teacherName =
    "미배정";

  if (
    activeEnrollment.teacher_user_id
  ) {
    const {
      data: teacher,
    } =
      await supabase
        .from(
          "teacher_profiles"
        )
        .select(
          "display_name"
        )
        .eq(
          "user_id",
          activeEnrollment.teacher_user_id
        )
        .maybeSingle();

    if (
      teacher?.display_name
    ) {
      teacherName =
        teacher.display_name;
    }
  }

  const {
    data: loadedClassSessions,
    error: sessionsError,
  } =
    await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        started_at,
        ended_at,
        status,
        meeting_provider,
        meeting_url
      `)
      .eq(
        "enrollment_id",
        activeEnrollment.id
      )
      .order(
        "lesson_number",
        {
          ascending: true,
        }
      );

  if (sessionsError) {
    throw new Error(
      sessionsError.message
    );
  }

  let classSessions =
    loadedClassSessions ?? [];

  /*
   * 종료시간이 지났는데 한 번도 시작되지 않은 scheduled 수업은
   * 학부모 수업 일정에서도 미진행(not_held)으로 정리합니다.
   *
   * 이미 시작된 수업은 예정 종료시간이 지나도 자동마감하지 않습니다.
   */
  const nowIso = new Date().toISOString();

  const expiredSessionIds =
    classSessions
      .filter(
        (session) =>
          session.status === "scheduled" &&
          !session.started_at &&
          !session.ended_at &&
          new Date(
            session.scheduled_end
          ).getTime() <= Date.now()
      )
      .map(
        (session) => session.id
      );

  if (
    expiredSessionIds.length > 0
  ) {
    const {
      error: closeExpiredError,
    } =
      await supabase
        .from("class_sessions")
        .update({
          status: "not_held",
          updated_at: nowIso,
        })
        .in(
          "id",
          expiredSessionIds
        )
        .eq(
          "status",
          "scheduled"
        )
        .is(
          "started_at",
          null
        )
        .lte(
          "scheduled_end",
          nowIso
        );

    if (closeExpiredError) {
      throw new Error(
        closeExpiredError.message
      );
    }

    const expiredIdSet =
      new Set(
        expiredSessionIds
      );

    classSessions =
      classSessions.map(
        (session) =>
          expiredIdSet.has(
            session.id
          )
            ? {
                ...session,
                status:
                  "not_held",
              }
            : session
      );
  }

  function getEnrollmentStatusLabel(
    status: string
  ) {
    switch (status) {
      case "pending":
        return "수강 대기";

      case "active":
        return "수강중";

      case "paused":
        return "일시중지";

      case "completed":
        return "수강완료";

      case "cancelled":
        return "취소";

      default:
        return status;
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

  function getSessionBadgeClass(
    status: string
  ) {
    if (
      status === "completed"
    ) {
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

  function formatDateTime(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone:
          "Asia/Seoul",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        weekday:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false,
      }
    ).format(
      new Date(value)
    );
  }

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(
        end
      ).getTime() -
        new Date(
          start
        ).getTime()) /
        60000
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
        <div
          style={{
            marginBottom:
              "20px",
          }}
        >
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
        </div>

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            padding:
              "32px",
            borderRadius:
              "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border:
              "1px solid #e1e9f5",
            boxShadow:
              "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position:
                "relative",
              zIndex:
                1,
            }}
          >
            <div className="talkly-section-label">
              CLASSES
            </div>

            <h1
              className="talkly-dashboard-title"
              style={{
                marginTop:
                  "6px",
              }}
            >
              {child.name} 수업
            </h1>

            <p
              style={{
                margin:
                  "8px 0 0",
                color:
                  "var(--text-secondary)",
                fontSize:
                  "15px",
              }}
            >
              현재 수강정보와
              전체 수업 일정을
              확인합니다.
            </p>
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "24px",
            padding:
              "28px",
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
                CURRENT ENROLLMENT
              </div>

              <h2
                style={{
                  margin:
                    "5px 0 0",
                  color:
                    "var(--talkly-navy)",
                  fontSize:
                    "23px",
                }}
              >
                현재 수강정보
              </h2>
            </div>

            <span className="talkly-badge talkly-badge-blue">
              {getEnrollmentStatusLabel(
                activeEnrollment.status
              )}
            </span>
          </div>

          <div
            style={{
              marginTop:
                "22px",
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap:
                "12px",
            }}
          >
            {[
              [
                "과정",
                course?.name ||
                  "-",
              ],
              [
                "담당 강사",
                teacherName,
              ],
              [
                "수강 시작일",
                activeEnrollment.start_date ||
                  "-",
              ],
              [
                "수강 종료일",
                activeEnrollment.end_date ||
                  "-",
              ],
              [
                "주당 수업",
                activeEnrollment.lessons_per_week !=
                null
                  ? `${activeEnrollment.lessons_per_week}회`
                  : "-",
              ],
              [
                "총 수업",
                activeEnrollment.total_lessons !=
                null
                  ? `${activeEnrollment.total_lessons}회`
                  : "-",
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    label
                  }
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "11px",
                    background:
                      "var(--talkly-blue-soft)",
                    border:
                      "1px solid #e5ecf6",
                  }}
                >
                  <div
                    style={{
                      color:
                        "var(--text-muted)",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                    }}
                  >
                    {
                      label
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "6px",
                      color:
                        "var(--talkly-navy)",
                      fontSize:
                        "15px",
                      fontWeight:
                        800,
                    }}
                  >
                    {
                      value
                    }
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "24px",
            padding:
              "28px",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-end",
              gap:
                "16px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                CLASS SCHEDULE
              </div>

              <h2
                style={{
                  margin:
                    "5px 0 0",
                  color:
                    "var(--talkly-navy)",
                  fontSize:
                    "23px",
                }}
              >
                수업 일정
              </h2>
            </div>

            <div
              style={{
                color:
                  "var(--text-muted)",
                fontSize:
                  "14px",
                fontWeight:
                  700,
              }}
            >
              전체{" "}
              {classSessions?.length ??
                0}
              회
            </div>
          </div>

          {!classSessions ||
          classSessions.length ===
            0 ? (
            <div
              style={{
                marginTop:
                  "24px",
                padding:
                  "24px",
                border:
                  "1px dashed var(--border)",
                borderRadius:
                  "10px",
                color:
                  "var(--text-muted)",
              }}
            >
              아직 등록된 수업
              일정이 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop:
                  "22px",
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "10px",
              }}
            >
              {classSessions.map(
                (
                  session
                ) => (
                  <Link
                    key={
                      session.id
                    }
                    href={`/parent/children/${child.id}/classes/${session.id}`}
                    className="talkly-card-hover"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "90px minmax(220px, 1fr) 90px 120px 24px",
                      gap:
                        "14px",
                      alignItems:
                        "center",
                      padding:
                        "16px 18px",
                      border:
                        "1px solid var(--border)",
                      borderRadius:
                        "11px",
                      textDecoration:
                        "none",
                      color:
                        "inherit",
                      background:
                        "#ffffff",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          "var(--talkly-navy)",
                        fontSize:
                          "15px",
                      }}
                    >
                      {
                        session.lesson_number
                      }
                      회차
                    </strong>

                    <span
                      style={{
                        color:
                          "var(--text-secondary)",
                        fontSize:
                          "14px",
                      }}
                    >
                      {formatDateTime(
                        session.scheduled_start
                      )}
                    </span>

                    <span
                      style={{
                        color:
                          "var(--text-muted)",
                        fontSize:
                          "13px",
                      }}
                    >
                      {getDurationMinutes(
                        session.scheduled_start,
                        session.scheduled_end
                      )}
                      분
                    </span>

                    <span
                      className={getSessionBadgeClass(
                        session.status
                      )}
                    >
                      {getSessionStatusLabel(
                        session.status
                      )}
                    </span>

                    <span
                      style={{
                        color:
                          "var(--talkly-blue)",
                        fontWeight:
                          900,
                        textAlign:
                          "right",
                      }}
                    >
                      →
                    </span>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}