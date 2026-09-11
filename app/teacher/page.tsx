import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export default async function TeacherPage() {
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

  /*
   * =====================================================
   * 1. My Classes
   * =====================================================
   */

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
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

  const enrollmentIds =
    enrollments?.map((item) => item.id) ?? [];

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    meeting_provider: string | null;
    meeting_url: string | null;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        started_at,
        ended_at,
        meeting_provider,
        meeting_url
      `)
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    sessions = data ?? [];

    /*
     * 예정 종료시간이 지났지만
     * 한 번도 시작되지 않은 수업을 not_held 처리
     */
    const nowIso = new Date().toISOString();

    const expiredSessionIds = sessions
      .filter(
        (session) =>
          session.status === "scheduled" &&
          !session.started_at &&
          !session.ended_at &&
          new Date(session.scheduled_end).getTime() <=
            Date.now()
      )
      .map((session) => session.id);

    if (expiredSessionIds.length > 0) {
      const { error: closeExpiredError } =
        await supabase
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
        throw new Error(
          closeExpiredError.message
        );
      }

      const expiredSet = new Set(
        expiredSessionIds
      );

      sessions = sessions.map((session) =>
        expiredSet.has(session.id)
          ? {
              ...session,
              status: "not_held",
            }
          : session
      );
    }
  }

  /*
   * =====================================================
   * 2. Student / Child / Course
   * =====================================================
   */

  const childIds =
    enrollments
      ?.map((item) => item.child_id)
      .filter(
        (id): id is number => id !== null
      ) ?? [];

  let children: {
    id: number;
    name: string;
  }[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(childIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    children = data ?? [];
  }

  const studentIds =
    enrollments
      ?.map((item) => item.student_user_id)
      .filter(
        (id): id is string => id !== null
      ) ?? [];

  let students: {
    id: string;
    name: string | null;
  }[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(studentIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    students = data ?? [];
  }

  const courseIds =
    enrollments?.map(
      (item) => item.course_id
    ) ?? [];

  let courses: {
    id: number;
    name: string;
  }[] = [];

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .in(
        "id",
        Array.from(new Set(courseIds))
      );

    if (error) {
      throw new Error(error.message);
    }

    courses = data ?? [];
  }

  /*
   * =====================================================
   * 3. Level Tests
   *
   * 서비스키는 서버에서만 사용합니다.
   * teacher role 검증 후 tester_user_id를
   * 로그인 강사의 user.id로 고정합니다.
   * =====================================================
   */

  const admin = createAdminClient();

  const {
    data: levelTestInterviews,
    error: levelTestInterviewError,
  } = await admin
    .from("level_test_interviews")
    .select(`
      id,
      level_test_id,
      status,
      scheduled_at,
      duration_minutes
    `)
    .eq("tester_user_id", user.id)
    .order("scheduled_at", {
      ascending: true,
    });

  if (levelTestInterviewError) {
    throw new Error(
      levelTestInterviewError.message
    );
  }

  const activeInterviewStatuses = new Set([
    "scheduling",
    "scheduled",
    "in_progress",
  ]);

  const upcomingLevelTests =
    (levelTestInterviews ?? []).filter(
      (item) =>
        item.scheduled_at &&
        activeInterviewStatuses.has(
          item.status
        ) &&
        new Date(
          item.scheduled_at
        ).getTime() >= Date.now()
    );

  const upcomingClasses = sessions.filter(
    (session) =>
      ["scheduled", "in_progress"].includes(
        session.status
      ) &&
      new Date(
        session.scheduled_end
      ).getTime() > Date.now()
  );

  /*
   * =====================================================
   * Helpers
   * =====================================================
   */

  function getEnrollment(
    enrollmentId: number
  ) {
    return enrollments?.find(
      (item) => item.id === enrollmentId
    );
  }

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      getEnrollment(enrollmentId);

    if (!enrollment) {
      return "Student";
    }

    if (enrollment.child_id) {
      const child = children.find(
        (item) =>
          item.id === enrollment.child_id
      );

      return child?.name || "Student";
    }

    if (enrollment.student_user_id) {
      const student = students.find(
        (item) =>
          item.id ===
          enrollment.student_user_id
      );

      return (
        student?.name || "Adult Student"
      );
    }

    return "Student";
  }

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    const course = courses.find(
      (item) =>
        item.id === enrollment.course_id
    );

    return course?.name || "-";
  }

  function getSessionStatus(
    status: string
  ) {
    switch (status) {
      case "scheduled":
        return {
          en: "Scheduled",
          ko: "예정",
        };

      case "in_progress":
        return {
          en: "In Progress",
          ko: "수업 진행 중",
        };

      case "completed":
        return {
          en: "Completed",
          ko: "수업 완료",
        };

      case "cancelled":
        return {
          en: "Cancelled",
          ko: "수업 취소",
        };

      case "no_show":
        return {
          en: "Absent",
          ko: "결석",
        };

      case "held":
        return {
          en: "Class Reschedule",
          ko: "수업 연기",
        };

      case "not_held":
        return {
          en: "Not Held",
          ko: "미진행",
        };

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function formatEnglishDateTime(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    ).format(new Date(value));
  }

  function formatKoreanDateTime(
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

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f9ff 0%, #ffffff 320px)",
        color: "#101828",
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "36px 24px 64px",
        }}
      >
        {/* HERO */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "34px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #0A1F44 0%, #163d7a 100%)",
            color: "#ffffff",
            boxShadow:
              "0 18px 45px rgba(10,31,68,0.14)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.15em",
                color: "#a9c7ff",
              }}
            >
              TALKLY TEACHER PORTAL
            </div>

            <h1
              style={{
                margin: "9px 0 0",
                fontSize: "34px",
                lineHeight: 1.15,
              }}
            >
              Welcome
              {profile.name
                ? `, ${profile.name}`
                : ""}
              .
            </h1>

            <div
              style={{
                marginTop: "7px",
                fontSize: "13px",
                color:
                  "rgba(255,255,255,0.72)",
              }}
            >
              안녕하세요. TALKLY 강사 전용
              페이지입니다.
            </div>

            <p
              style={{
                maxWidth: "620px",
                margin: "19px 0 0",
                fontSize: "15px",
                lineHeight: 1.75,
                color:
                  "rgba(255,255,255,0.88)",
              }}
            >
              Manage your classes, level
              tests and student evaluations in
              one place.
            </p>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color:
                  "rgba(255,255,255,0.62)",
              }}
            >
              수업 일정, 레벨테스트 및 학생
              학습평가를 한 곳에서 관리할 수
              있습니다.
            </div>
          </div>
        </section>

        {/* QUICK ACCESS */}
        <section
          style={{
            marginTop: "22px",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#2f6fed",
                letterSpacing: "0.1em",
              }}
            >
              QUICK ACCESS
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                fontSize: "22px",
              }}
            >
              Your Workspace
            </h2>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#667085",
              }}
            >
              자주 사용하는 강사 업무
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "14px",
            }}
          >
            <Link
              href="/teacher/level-tests"
              style={{
                padding: "22px",
                border:
                  "1px solid #c9dafb",
                borderRadius: "16px",
                background: "#ffffff",
                textDecoration: "none",
                color: "inherit",
                boxShadow:
                  "0 7px 24px rgba(47,111,237,0.07)",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "12px",
                  background: "#eef4ff",
                  color: "#175cd3",
                  fontSize: "19px",
                  fontWeight: 900,
                }}
              >
                LT
              </div>

              <div
                style={{
                  marginTop: "16px",
                  fontSize: "11px",
                  fontWeight: 900,
                  color: "#2f6fed",
                  letterSpacing: "0.08em",
                }}
              >
                LEVEL TESTS
              </div>

              <h3
                style={{
                  margin: "5px 0 0",
                  fontSize: "20px",
                }}
              >
                Level Tests
              </h3>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                레벨테스트
              </div>

              <div
                style={{
                  marginTop: "18px",
                  fontSize: "28px",
                  fontWeight: 900,
                  color: "#0A1F44",
                }}
              >
                {upcomingLevelTests.length}
              </div>

              <div
                style={{
                  marginTop: "2px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                Upcoming · 예정된 테스트
              </div>

              <div
                style={{
                  marginTop: "17px",
                  color: "#175cd3",
                  fontSize: "13px",
                  fontWeight: 900,
                }}
              >
                View Level Tests →
              </div>
            </Link>

            <a
              href="#my-classes"
              style={{
                padding: "22px",
                border:
                  "1px solid #e4e7ec",
                borderRadius: "16px",
                background: "#ffffff",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "12px",
                  background: "#f2f4f7",
                  color: "#344054",
                  fontSize: "18px",
                  fontWeight: 900,
                }}
              >
                CL
              </div>

              <div
                style={{
                  marginTop: "16px",
                  fontSize: "11px",
                  fontWeight: 900,
                  color: "#667085",
                  letterSpacing: "0.08em",
                }}
              >
                MY CLASSES
              </div>

              <h3
                style={{
                  margin: "5px 0 0",
                  fontSize: "20px",
                }}
              >
                My Classes
              </h3>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                내 수업
              </div>

              <div
                style={{
                  marginTop: "18px",
                  fontSize: "28px",
                  fontWeight: 900,
                }}
              >
                {upcomingClasses.length}
              </div>

              <div
                style={{
                  marginTop: "2px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                Upcoming · 예정 수업
              </div>

              <div
                style={{
                  marginTop: "17px",
                  color: "#344054",
                  fontSize: "13px",
                  fontWeight: 900,
                }}
              >
                View Classes ↓
              </div>
            </a>

          </div>
        </section>

        {/* CLASSES */}
        <section
          id="my-classes"
          style={{
            marginTop: "28px",
            padding: "28px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#2f6fed",
                letterSpacing: "0.08em",
              }}
            >
              MY CLASSES
            </div>

            <h2
              style={{
                margin: "6px 0 0",
                fontSize: "26px",
              }}
            >
              My Classes
            </h2>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#667085",
              }}
            >
              내 수업
            </div>

            <div
              style={{
                marginTop: "13px",
                fontSize: "16px",
                fontWeight: 800,
              }}
            >
              {sessions.length} Classes
            </div>

            <div
              style={{
                marginTop: "2px",
                fontSize: "11px",
                color: "#98a2b3",
              }}
            >
              총 {sessions.length}회 수업
            </div>
          </div>

          {sessions.length === 0 ? (
            <div
              style={{
                padding: "30px",
                border:
                  "1px dashed #d0d5dd",
                borderRadius: "12px",
                textAlign: "center",
                background: "#f9fafb",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                }}
              >
                No classes assigned.
              </div>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  color: "#667085",
                }}
              >
                현재 배정된 수업이 없습니다.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {sessions.map((session) => {
                const status =
                  getSessionStatus(
                    session.status
                  );

                return (
                  <Link
                    key={session.id}
                    href={`/teacher/classes/${session.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "100px minmax(130px, 1.1fr) minmax(220px, 1.5fr) 80px 110px",
                      gap: "18px",
                      alignItems:
                        "center",
                      padding: "18px",
                      border:
                        "1px solid #e4e7ec",
                      borderRadius:
                        "12px",
                      textDecoration:
                        "none",
                      color: "inherit",
                      background:
                        "#ffffff",
                    }}
                  >
                    <div>
                      <strong>
                        Lesson{" "}
                        {
                          session.lesson_number
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "3px",
                          fontSize:
                            "11px",
                          color:
                            "#98a2b3",
                        }}
                      >
                        {
                          session.lesson_number
                        }
                        회차
                      </div>
                    </div>

                    <div>
                      <strong>
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          fontSize:
                            "12px",
                          color:
                            "#667085",
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize:
                            "14px",
                          fontWeight:
                            700,
                        }}
                      >
                        {formatEnglishDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "11px",
                          color:
                            "#98a2b3",
                        }}
                      >
                        {formatKoreanDateTime(
                          session.scheduled_start
                        )}
                      </div>
                    </div>

                    <div>
                      <strong>
                        {getDurationMinutes(
                          session.scheduled_start,
                          session.scheduled_end
                        )}{" "}
                        min
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "3px",
                          fontSize:
                            "11px",
                          color:
                            "#98a2b3",
                        }}
                      >
                        수업시간
                      </div>
                    </div>

                    <div>
                      <strong>
                        {status.en}
                      </strong>

                      {status.ko && (
                        <div
                          style={{
                            marginTop:
                              "3px",
                            fontSize:
                              "11px",
                            color:
                              "#98a2b3",
                          }}
                        >
                          {status.ko}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}