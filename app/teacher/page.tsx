import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type EnrollmentRow = {
  id: number;
  student_user_id: string | null;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  total_lessons: number | null;
};

type SessionRow = {
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
};

type LevelTestInterviewRow = {
  id: number;
  level_test_id: number;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
};

type LevelTestRow = {
  id: number;
  student_name: string | null;
  grade: string | null;
  target_group: string | null;
};

const SEOUL_TIME_ZONE = "Asia/Seoul";

function getSeoulDateKey(value: Date | string) {
  const date =
    value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getSeoulWeekdayIndex(value: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    weekday: "short",
  }).format(value);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday] ?? 0;
}

function addDaysToDateKey(
  dateKey: string,
  days: number
) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day + days)
  );

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatEnglishDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatEnglishTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getDurationMinutes(
  start: string,
  end: string
) {
  return Math.max(
    0,
    Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    )
  );
}

function getSessionStatus(status: string) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        background: "#eef4ff",
        color: "#175cd3",
      };

    case "in_progress":
      return {
        label: "In Progress",
        background: "#ecfdf3",
        color: "#027a48",
      };

    case "completed":
      return {
        label: "Completed",
        background: "#f2f4f7",
        color: "#475467",
      };

    case "cancelled":
      return {
        label: "Cancelled",
        background: "#fef3f2",
        color: "#b42318",
      };

    case "no_show":
      return {
        label: "Absent",
        background: "#fff6ed",
        color: "#b54708",
      };

    case "held":
      return {
        label: "Rescheduled",
        background: "#f4f3ff",
        color: "#5925dc",
      };

    case "not_held":
      return {
        label: "Not Held",
        background: "#f2f4f7",
        color: "#667085",
      };

    default:
      return {
        label: status,
        background: "#f2f4f7",
        color: "#475467",
      };
  }
}

export default async function TeacherPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const requestedView =
    query.view === "week"
      ? "week"
      : query.view === "month"
        ? "month"
        : "today";

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

  if (
    !profile ||
    profile.role !== "teacher"
  ) {
    redirect("/");
  }

  const admin = createAdminClient();

  const {
    data: teacherProfile,
    error: teacherProfileError,
  } = await admin
    .from("teacher_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherProfileError) {
    throw new Error(
      teacherProfileError.message
    );
  }

  const teacherName =
    teacherProfile?.display_name ||
    profile.name ||
    "Teacher";

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      child_id,
      course_id,
      teacher_user_id,
      status,
      total_lessons
    `)
    .eq("teacher_user_id", user.id)
    .in("status", [
      "active",
      "pending",
      "completed",
    ]);

  if (enrollmentError) {
    throw new Error(
      enrollmentError.message
    );
  }

  const enrollments =
    (enrollmentData ?? []) as EnrollmentRow[];

  const enrollmentIds =
    enrollments.map((item) => item.id);

  let sessions: SessionRow[] = [];

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

    sessions =
      (data ?? []) as SessionRow[];

    const nowIso = new Date().toISOString();

    const expiredSessionIds = sessions
      .filter(
        (session) =>
          session.status === "scheduled" &&
          !session.started_at &&
          !session.ended_at &&
          new Date(
            session.scheduled_end
          ).getTime() <= Date.now()
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

  const childIds = enrollments
    .map((item) => item.child_id)
    .filter(
      (id): id is number =>
        id !== null
    );

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

  const studentIds = enrollments
    .map(
      (item) => item.student_user_id
    )
    .filter(
      (id): id is string =>
        id !== null
    );

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

  const courseIds = enrollments.map(
    (item) => item.course_id
  );

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

  const {
    data: levelTestInterviewData,
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

  const levelTestInterviews =
    (levelTestInterviewData ??
      []) as LevelTestInterviewRow[];

  const levelTestIds = Array.from(
    new Set(
      levelTestInterviews.map(
        (item) => item.level_test_id
      )
    )
  );

  let levelTests: LevelTestRow[] = [];

  if (levelTestIds.length > 0) {
    const { data, error } = await admin
      .from("level_tests")
      .select(`
        id,
        student_name,
        grade,
        target_group
      `)
      .in("id", levelTestIds);

    if (error) {
      throw new Error(error.message);
    }

    levelTests =
      (data ?? []) as LevelTestRow[];
  }

  function getEnrollment(
    enrollmentId: number
  ) {
    return enrollments.find(
      (item) =>
        item.id === enrollmentId
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
      return (
        children.find(
          (item) =>
            item.id ===
            enrollment.child_id
        )?.name || "Student"
      );
    }

    if (enrollment.student_user_id) {
      return (
        students.find(
          (item) =>
            item.id ===
            enrollment.student_user_id
        )?.name || "Adult Student"
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

    return (
      courses.find(
        (item) =>
          item.id === enrollment.course_id
      )?.name || "-"
    );
  }

  function getLevelTest(
    levelTestId: number
  ) {
    return levelTests.find(
      (item) => item.id === levelTestId
    );
  }

  const now = new Date();
  const todayKey =
    getSeoulDateKey(now);

  const weekday =
    getSeoulWeekdayIndex(now);

  const daysFromMonday =
    weekday === 0 ? 6 : weekday - 1;

  const weekStartKey =
    addDaysToDateKey(
      todayKey,
      -daysFromMonday
    );

  const weekEndKey =
    addDaysToDateKey(
      weekStartKey,
      6
    );

  const monthPrefix =
    todayKey.slice(0, 7);

  const isSessionToday = (
    session: SessionRow
  ) =>
    getSeoulDateKey(
      session.scheduled_start
    ) === todayKey;

  const isSessionThisWeek = (
    session: SessionRow
  ) => {
    const key = getSeoulDateKey(
      session.scheduled_start
    );

    return (
      key >= weekStartKey &&
      key <= weekEndKey
    );
  };

  const isSessionThisMonth = (
    session: SessionRow
  ) =>
    getSeoulDateKey(
      session.scheduled_start
    ).startsWith(monthPrefix);

  const todaySessions = sessions.filter(
    isSessionToday
  );

  const weekSessions = sessions.filter(
    isSessionThisWeek
  );

  const monthSessions = sessions.filter(
    isSessionThisMonth
  );

  const activeInterviewStatuses =
    new Set([
      "scheduling",
      "scheduled",
      "in_progress",
    ]);

  const relevantLevelTests =
    levelTestInterviews.filter(
      (item) =>
        item.scheduled_at &&
        activeInterviewStatuses.has(
          item.status
        )
    );

  const todayLevelTests =
    relevantLevelTests.filter(
      (item) =>
        item.scheduled_at &&
        getSeoulDateKey(
          item.scheduled_at
        ) === todayKey
    );

  const weekLevelTests =
    relevantLevelTests.filter(
      (item) => {
        if (!item.scheduled_at) {
          return false;
        }

        const key = getSeoulDateKey(
          item.scheduled_at
        );

        return (
          key >= weekStartKey &&
          key <= weekEndKey
        );
      }
    );

  const monthLevelTests =
    relevantLevelTests.filter(
      (item) =>
        item.scheduled_at &&
        getSeoulDateKey(
          item.scheduled_at
        ).startsWith(monthPrefix)
    );

  const finalCompletedSessions =
    sessions.filter((session) => {
      if (
        session.status !== "completed"
      ) {
        return false;
      }

      const enrollment =
        getEnrollment(
          session.enrollment_id
        );

      if (!enrollment) {
        return false;
      }

      const enrollmentSessions =
        sessions.filter(
          (item) =>
            item.enrollment_id ===
            enrollment.id
        );

      const finalLessonNumber =
        typeof enrollment.total_lessons ===
          "number" &&
        enrollment.total_lessons > 0
          ? enrollment.total_lessons
          : Math.max(
              ...enrollmentSessions.map(
                (item) =>
                  item.lesson_number
              )
            );

      return (
        session.lesson_number ===
        finalLessonNumber
      );
    });

  let evaluatedFinalSessionIds =
    new Set<number>();

  if (
    finalCompletedSessions.length > 0
  ) {
    const {
      data: evaluationData,
      error: evaluationError,
    } = await admin
      .from("evaluations")
      .select("class_session_id")
      .in(
        "class_session_id",
        finalCompletedSessions.map(
          (item) => item.id
        )
      );

    if (evaluationError) {
      throw new Error(
        evaluationError.message
      );
    }

    evaluatedFinalSessionIds =
      new Set(
        (evaluationData ?? []).map(
          (item) =>
            item.class_session_id
        )
      );
  }

  const pendingFinalEvaluations =
    finalCompletedSessions.filter(
      (session) =>
        !evaluatedFinalSessionIds.has(
          session.id
        )
    );

  const visibleSessions =
    requestedView === "week"
      ? weekSessions
      : requestedView === "month"
        ? monthSessions
        : todaySessions;

  const visibleLevelTests =
    requestedView === "week"
      ? weekLevelTests
      : requestedView === "month"
        ? monthLevelTests
        : todayLevelTests;

  const sortedVisibleSessions =
    [...visibleSessions].sort(
      (a, b) =>
        new Date(
          a.scheduled_start
        ).getTime() -
        new Date(
          b.scheduled_start
        ).getTime()
    );

  const sortedVisibleLevelTests =
    [...visibleLevelTests].sort(
      (a, b) =>
        new Date(
          a.scheduled_at ?? 0
        ).getTime() -
        new Date(
          b.scheduled_at ?? 0
        ).getTime()
    );

  const viewInfo =
    requestedView === "week"
      ? {
          eyebrow: "THIS WEEK",
          title: "This Week's Schedule",
          description:
            "Your full teaching schedule for this week.",
        }
      : requestedView === "month"
        ? {
            eyebrow: "THIS MONTH",
            title: "This Month's Schedule",
            description:
              "Your teaching schedule for the current month.",
          }
        : {
            eyebrow: "TODAY",
            title: "Today's Schedule",
            description:
              "Start here. These are the classes and level tests you need to handle today.",
          };

  const actionRequiredCount =
    pendingFinalEvaluations.length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f9ff 0%, #ffffff 360px)",
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
        <section
          style={{
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
              fontSize: "36px",
              lineHeight: 1.15,
            }}
          >
            Welcome, {teacherName}.
          </h1>

          <p
            style={{
              maxWidth: "700px",
              margin: "18px 0 0",
              fontSize: "16px",
              lineHeight: 1.75,
              color:
                "rgba(255,255,255,0.9)",
            }}
          >
            Check today&apos;s teaching tasks first.
            Your regular classes, assigned level tests,
            and any final student evaluations that still
            need your attention are collected here.
          </p>

          <div
            style={{
              marginTop: "7px",
              fontSize: "11px",
              lineHeight: 1.6,
              color:
                "rgba(255,255,255,0.58)",
            }}
          >
            오늘 해야 할 수업·레벨테스트·최종 학생평가를 우선 확인합니다.
          </div>
        </section>

        <section
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            [
              "Today's Classes",
              todaySessions.length,
              "Regular classes today",
            ],
            [
              "Level Tests",
              todayLevelTests.length,
              "Assigned for today",
            ],
            [
              "Action Required",
              actionRequiredCount,
              "Final evaluations pending",
            ],
            [
              "This Week",
              weekSessions.length,
              "Classes this week",
            ],
          ].map(
            ([label, value, caption]) => (
              <div
                key={String(label)}
                style={{
                  padding: "20px",
                  border:
                    "1px solid #e4e7ec",
                  borderRadius: "14px",
                  background: "#ffffff",
                  boxShadow:
                    "0 5px 18px rgba(16,24,40,0.04)",
                }}
              >
                <div
                  style={{
                    color: "#667085",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "30px",
                    fontWeight: 900,
                    color: "#0A1F44",
                  }}
                >
                  {value}
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    color: "#98a2b3",
                    fontSize: "11px",
                  }}
                >
                  {caption}
                </div>
              </div>
            )
          )}
        </section>

        {pendingFinalEvaluations.length >
          0 && (
          <section
            style={{
              marginTop: "24px",
              padding: "26px",
              border:
                "1px solid #f9d7a7",
              borderRadius: "16px",
              background: "#fffaf3",
            }}
          >
            <div
              style={{
                color: "#b54708",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.09em",
              }}
            >
              ACTION REQUIRED
            </div>

            <h2
              style={{
                margin: "6px 0 0",
                fontSize: "24px",
              }}
            >
              Final Teacher Evaluation
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#667085",
                lineHeight: 1.7,
                fontSize: "13px",
              }}
            >
              These students have completed their final
              class. Please submit one overall evaluation
              for the full course. You do not need to
              write a teacher evaluation after every
              lesson.
            </p>

            <div
              style={{
                marginTop: "17px",
                display: "grid",
                gap: "10px",
              }}
            >
              {pendingFinalEvaluations.map(
                (session) => (
                  <Link
                    key={session.id}
                    href={`/teacher/classes/${session.id}`}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                      padding: "16px",
                      border:
                        "1px solid #f1c98f",
                      borderRadius: "11px",
                      background: "#ffffff",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: "16px",
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </strong>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#667085",
                          fontSize: "12px",
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}{" "}
                        · Final Lesson{" "}
                        {session.lesson_number}
                      </div>
                    </div>

                    <strong
                      style={{
                        color: "#b54708",
                        fontSize: "13px",
                      }}
                    >
                      Complete Evaluation →
                    </strong>
                  </Link>
                )
              )}
            </div>
          </section>
        )}

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-end",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#2f6fed",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                }}
              >
                {viewInfo.eyebrow}
              </div>

              <h2
                style={{
                  margin: "5px 0 0",
                  fontSize: "27px",
                }}
              >
                {viewInfo.title}
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#667085",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                {viewInfo.description}
              </p>
            </div>

            <nav
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {[
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
              ].map(([value, label]) => {
                const active =
                  requestedView === value;

                return (
                  <Link
                    key={value}
                    href={
                      value === "today"
                        ? "/teacher"
                        : `/teacher?view=${value}`
                    }
                    style={{
                      padding:
                        "9px 13px",
                      border: active
                        ? "1px solid #2f6fed"
                        : "1px solid #d0d5dd",
                      borderRadius: "9px",
                      background: active
                        ? "#eef4ff"
                        : "#ffffff",
                      color: active
                        ? "#175cd3"
                        : "#475467",
                      textDecoration:
                        "none",
                      fontSize: "12px",
                      fontWeight: 900,
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "grid",
              gap: "14px",
            }}
          >
            {sortedVisibleLevelTests.map(
              (interview) => {
                const test =
                  getLevelTest(
                    interview.level_test_id
                  );

                return (
                  <Link
                    key={`level-${interview.id}`}
                    href={`/teacher/level-tests/${interview.level_test_id}`}
                    style={{
                      padding: "20px",
                      border:
                        "1px solid #c9dafb",
                      borderRadius: "14px",
                      background: "#f8fbff",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#2f6fed",
                            fontSize: "10px",
                            fontWeight: 900,
                            letterSpacing:
                              "0.08em",
                          }}
                        >
                          LEVEL TEST
                        </div>

                        <strong
                          style={{
                            display: "block",
                            marginTop: "5px",
                            fontSize: "18px",
                          }}
                        >
                          {test?.student_name ||
                            "Student"}
                        </strong>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#667085",
                            fontSize: "12px",
                          }}
                        >
                          {test?.grade || ""}
                          {test?.grade &&
                          test?.target_group
                            ? " · "
                            : ""}
                          {test?.target_group ||
                            ""}
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign: "right",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "14px",
                          }}
                        >
                          {interview.scheduled_at
                            ? formatEnglishDateTime(
                                interview.scheduled_at
                              )
                            : "Schedule pending"}
                        </strong>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#667085",
                            fontSize: "11px",
                          }}
                        >
                          {interview.duration_minutes
                            ? `${interview.duration_minutes} min`
                            : "Video interview"}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }
            )}

            {sortedVisibleSessions.map(
              (session) => {
                const status =
                  getSessionStatus(
                    session.status
                  );

                return (
                  <Link
                    key={`class-${session.id}`}
                    href={`/teacher/classes/${session.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(90px, 0.7fr) minmax(150px, 1.2fr) minmax(220px, 1.5fr) auto",
                      gap: "18px",
                      alignItems: "center",
                      padding: "20px",
                      border:
                        "1px solid #e4e7ec",
                      borderRadius: "14px",
                      background: "#ffffff",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#667085",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        LESSON{" "}
                        {session.lesson_number}
                      </div>

                      <strong
                        style={{
                          display: "block",
                          marginTop: "5px",
                          fontSize: "20px",
                          color: "#0A1F44",
                        }}
                      >
                        {formatEnglishTime(
                          session.scheduled_start
                        )}
                      </strong>

                      <div
                        style={{
                          marginTop: "3px",
                          color: "#98a2b3",
                          fontSize: "10px",
                        }}
                      >
                        {getDurationMinutes(
                          session.scheduled_start,
                          session.scheduled_end
                        )}{" "}
                        min
                      </div>
                    </div>

                    <div>
                      <strong
                        style={{
                          fontSize: "17px",
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </strong>

                      <div
                        style={{
                          marginTop: "5px",
                          color: "#667085",
                          fontSize: "12px",
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}
                      </div>
                    </div>

                    <div>
                      <strong
                        style={{
                          fontSize: "14px",
                        }}
                      >
                        {formatEnglishDateTime(
                          session.scheduled_start
                        )}
                      </strong>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#98a2b3",
                          fontSize: "10px",
                        }}
                      >
                        {formatKoreanDateTime(
                          session.scheduled_start
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        justifySelf: "end",
                      }}
                    >
                      <span
                        style={{
                          display:
                            "inline-flex",
                          padding: "7px 10px",
                          borderRadius:
                            "999px",
                          background:
                            status.background,
                          color: status.color,
                          fontSize: "11px",
                          fontWeight: 900,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </Link>
                );
              }
            )}

            {sortedVisibleSessions.length ===
              0 &&
              sortedVisibleLevelTests.length ===
                0 && (
                <div
                  style={{
                    padding: "34px",
                    border:
                      "1px dashed #d0d5dd",
                    borderRadius: "14px",
                    background: "#f9fafb",
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "18px",
                    }}
                  >
                    {requestedView ===
                    "today"
                      ? "No teaching tasks scheduled for today."
                      : "No scheduled teaching tasks in this period."}
                  </strong>

                  <p
                    style={{
                      margin:
                        "8px 0 0",
                      color: "#667085",
                      fontSize: "13px",
                    }}
                  >
                    Check another schedule view or review any action items above.
                  </p>
                </div>
              )}
          </div>
        </section>

        <section
          style={{
            marginTop: "28px",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
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
            Teacher Workspace
          </h2>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "14px",
            }}
          >
            {[
              {
                href:
                  "/teacher/level-tests",
                code: "LT",
                title: "Level Tests",
                description:
                  "View all assigned level-test interviews.",
              },
              {
                href:
                  "/teacher/students",
                code: "ST",
                title: "My Students",
                description:
                  "Open student learning and class information.",
              },
              {
                href:
                  "/teacher?view=week",
                code: "WK",
                title: "Weekly Schedule",
                description:
                  "View your full schedule for this week.",
              },
              {
                href:
                  "/teacher?view=month",
                code: "MO",
                title: "Monthly Schedule",
                description:
                  "View your schedule for the current month.",
              },
            ].map((item) => (
              <Link
                key={item.href + item.code}
                href={item.href}
                style={{
                  padding: "22px",
                  border:
                    "1px solid #e4e7ec",
                  borderRadius: "16px",
                  background: "#ffffff",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    borderRadius: "12px",
                    background: "#eef4ff",
                    color: "#175cd3",
                    fontSize: "14px",
                    fontWeight: 900,
                  }}
                >
                  {item.code}
                </div>

                <h3
                  style={{
                    margin: "15px 0 0",
                    fontSize: "19px",
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    margin: "7px 0 0",
                    color: "#667085",
                    fontSize: "12px",
                    lineHeight: 1.65,
                  }}
                >
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}