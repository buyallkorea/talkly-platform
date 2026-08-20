import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type DashboardCardProps = {
  label: string;
  value: number | string;
  description: string;
  href?: string;
};

type RecentSession = {
  id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  enrollment_id: number;
  meeting_url: string | null;
};

type EnrollmentInfo = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
};

function DashboardCard({
  label,
  value,
  description,
  href,
}: DashboardCardProps) {
  const content = (
    <div
      style={{
        padding: "22px",
        border: "1px solid #e4e7ec",
        borderRadius: "14px",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.05)",
        minHeight: "132px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          opacity: 0.62,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "34px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "9px",
          fontSize: "12px",
          opacity: 0.5,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      style={{
        color: "inherit",
        textDecoration: "none",
      }}
    >
      {content}
    </Link>
  );
}

function formatKoreanDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

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
    case "completed":
      return "완료";
    case "cancelled":
      return "취소";
    case "no_show":
      return "무단결석";
    case "held":
      return "결석 승인";
    default:
      return status;
  }
}

function getSeoulDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export default async function AdminDashboardPage() {
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

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const now = new Date();
  const seoulDate = getSeoulDateKey(now);

  const todayStartDate = new Date(
    `${seoulDate}T00:00:00+09:00`
  );
  const tomorrowStartDate = new Date(todayStartDate);
  tomorrowStartDate.setDate(tomorrowStartDate.getDate() + 1);

  const day = todayStartDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const weekStartDate = new Date(todayStartDate);
  weekStartDate.setDate(weekStartDate.getDate() + mondayOffset);

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const monthStartDate = new Date(
    `${seoulDate.slice(0, 7)}-01T00:00:00+09:00`
  );

  const monthEndDate = new Date(monthStartDate);
  monthEndDate.setMonth(monthEndDate.getMonth() + 1);

  const todayStart = todayStartDate.toISOString();
  const tomorrowStart = tomorrowStartDate.toISOString();
  const weekStart = weekStartDate.toISOString();
  const weekEnd = weekEndDate.toISOString();
  const monthStart = monthStartDate.toISOString();
  const monthEnd = monthEndDate.toISOString();

  const [
    parentsResult,
    studentsResult,
    teachersResult,
    activeEnrollmentsResult,
    unassignedEnrollmentsResult,
    todaySessionsResult,
    completedTodayResult,
    weekSessionsResult,
    monthSessionsResult,
    pendingHoldsResult,
    recentSessionsResult,
    recentEnrollmentsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("role", "parent"),

    supabase
      .from("children")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("is_active", true),

    supabase
      .from("teacher_profiles")
      .select("user_id", {
        count: "exact",
        head: true,
      })
      .eq("is_active", true),

    supabase
      .from("enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active"),

    supabase
      .from("enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active")
      .is("teacher_user_id", null),

    supabase
      .from("class_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("scheduled_start", todayStart)
      .lt("scheduled_start", tomorrowStart),

    supabase
      .from("class_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "completed")
      .gte("scheduled_start", todayStart)
      .lt("scheduled_start", tomorrowStart),

    supabase
      .from("class_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("scheduled_start", weekStart)
      .lt("scheduled_start", weekEnd),

    supabase
      .from("class_sessions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("scheduled_start", monthStart)
      .lt("scheduled_start", monthEnd),

    supabase
      .from("class_holds")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "requested"),

    supabase
      .from("class_sessions")
      .select(`
        id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        enrollment_id,
        meeting_url
      `)
      .gte("scheduled_start", todayStart)
      .order("scheduled_start", {
        ascending: true,
      })
      .limit(10),

    supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(5),
  ]);

  const firstError =
    parentsResult.error ||
    studentsResult.error ||
    teachersResult.error ||
    activeEnrollmentsResult.error ||
    unassignedEnrollmentsResult.error ||
    todaySessionsResult.error ||
    completedTodayResult.error ||
    weekSessionsResult.error ||
    monthSessionsResult.error ||
    pendingHoldsResult.error ||
    recentSessionsResult.error ||
    recentEnrollmentsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const recentSessions =
    (recentSessionsResult.data ?? []) as RecentSession[];

  const recentEnrollments =
    recentEnrollmentsResult.data ?? [];

  const todaySessionIds = recentSessions
    .filter((session) => {
      const start = new Date(session.scheduled_start);

      return (
        start >= todayStartDate &&
        start < tomorrowStartDate
      );
    })
    .map((session) => session.id);

  let attendanceRows: {
    class_session_id: number;
    status: string;
  }[] = [];

  let evaluationRows: {
    class_session_id: number;
  }[] = [];

  if (todaySessionIds.length > 0) {
    const [
      attendanceResult,
      evaluationResult,
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select("class_session_id, status")
        .in("class_session_id", todaySessionIds),

      supabase
        .from("evaluations")
        .select("class_session_id")
        .in("class_session_id", todaySessionIds),
    ]);

    const activityError =
      attendanceResult.error ||
      evaluationResult.error;

    if (activityError) {
      throw new Error(activityError.message);
    }

    attendanceRows = attendanceResult.data ?? [];
    evaluationRows = evaluationResult.data ?? [];
  }

  const attendanceSet = new Set(
    attendanceRows.map((item) => item.class_session_id)
  );

  const evaluationSet = new Set(
    evaluationRows.map((item) => item.class_session_id)
  );

  const completedTodaySessions =
    recentSessions.filter(
      (session) => session.status === "completed"
    );

  const missingAttendanceCount =
    completedTodaySessions.filter(
      (session) => !attendanceSet.has(session.id)
    ).length;

  const missingEvaluationCount =
    completedTodaySessions.filter(
      (session) => !evaluationSet.has(session.id)
    ).length;

  const missingMeetingUrlCount =
    recentSessions.filter(
      (session) =>
        session.status === "scheduled" &&
        !session.meeting_url
    ).length;

  const nowTime = now.getTime();

  const upcomingThirtyMinutesCount =
    recentSessions.filter((session) => {
      if (session.status !== "scheduled") {
        return false;
      }

      const startTime =
        new Date(session.scheduled_start).getTime();

      return (
        startTime >= nowTime &&
        startTime <= nowTime + 30 * 60 * 1000
      );
    }).length;

  const activeNowCount =
    recentSessions.filter((session) => {
      if (session.status !== "scheduled") {
        return false;
      }

      const startTime =
        new Date(session.scheduled_start).getTime();

      const endTime =
        new Date(session.scheduled_end).getTime();

      return (
        nowTime >= startTime &&
        nowTime < endTime
      );
    }).length;

  const combinedEnrollmentIds = Array.from(
    new Set([
      ...recentSessions.map(
        (session) => session.enrollment_id
      ),
      ...recentEnrollments.map(
        (enrollment) => enrollment.id
      ),
    ])
  );

  let enrollmentMap = new Map<
    number,
    EnrollmentInfo
  >();

  if (combinedEnrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id
      `)
      .in("id", combinedEnrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    enrollmentMap = new Map(
      (data ?? []).map((item) => [
        item.id,
        item as EnrollmentInfo,
      ])
    );
  }

  const childIds = Array.from(
    new Set(
      Array.from(enrollmentMap.values())
        .map((item) => item.child_id)
        .filter(
          (value): value is number =>
            value !== null
        )
    )
  );

  const courseIds = Array.from(
    new Set(
      Array.from(enrollmentMap.values()).map(
        (item) => item.course_id
      )
    )
  );

  const teacherIds = Array.from(
    new Set(
      Array.from(enrollmentMap.values())
        .map((item) => item.teacher_user_id)
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const studentIds = Array.from(
    new Set(
      Array.from(enrollmentMap.values())
        .map((item) => item.student_user_id)
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const [
    childNamesResult,
    courseNamesResult,
    teacherNamesResult,
    studentNamesResult,
  ] = await Promise.all([
    childIds.length > 0
      ? supabase
          .from("children")
          .select("id, name")
          .in("id", childIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    teacherIds.length > 0
      ? supabase
          .from("teacher_profiles")
          .select(
            "user_id, display_name"
          )
          .in("user_id", teacherIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const lookupError =
    childNamesResult.error ||
    courseNamesResult.error ||
    teacherNamesResult.error ||
    studentNamesResult.error;

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const childNameMap = new Map(
    (childNamesResult.data ?? []).map(
      (item) => [item.id, item.name]
    )
  );

  const courseNameMap = new Map(
    (courseNamesResult.data ?? []).map(
      (item) => [item.id, item.name]
    )
  );

  const teacherNameMap = new Map(
    (teacherNamesResult.data ?? []).map(
      (item) => [
        item.user_id,
        item.display_name,
      ]
    )
  );

  const studentNameMap = new Map(
    (studentNamesResult.data ?? []).map(
      (item) => [item.id, item.name]
    )
  );

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      return (
        childNameMap.get(
          enrollment.child_id
        ) || "자녀 정보 없음"
      );
    }

    if (enrollment.student_user_id) {
      return (
        studentNameMap.get(
          enrollment.student_user_id
        ) || "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return (
      courseNameMap.get(
        enrollment.course_id
      ) || "-"
    );
  }

  function getTeacherName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (
      !enrollment ||
      !enrollment.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teacherNameMap.get(
        enrollment.teacher_user_id
      ) || "미배정"
    );
  }

  const todayAttendanceRate =
    completedTodaySessions.length > 0
      ? Math.round(
          (completedTodaySessions.filter((session) =>
            attendanceSet.has(session.id)
          ).length /
            completedTodaySessions.length) *
            100
        )
      : 0;

  const todayEvaluationRate =
    completedTodaySessions.length > 0
      ? Math.round(
          (completedTodaySessions.filter((session) =>
            evaluationSet.has(session.id)
          ).length /
            completedTodaySessions.length) *
            100
        )
      : 0;

  const cards = [
    {
      label: "전체 학부모",
      value: parentsResult.count ?? 0,
      description:
        "등록된 학부모 계정 수",
      href: "/admin/parents",
    },
    {
      label: "활성 학생",
      value: studentsResult.count ?? 0,
      description:
        "현재 활성 상태인 자녀 수",
      href: "/admin/students",
    },
    {
      label: "활성 강사",
      value: teachersResult.count ?? 0,
      description:
        "현재 활성 상태인 강사 수",
      href: "/admin/teachers",
    },
    {
      label: "진행 중 수강",
      value:
        activeEnrollmentsResult.count ?? 0,
      description:
        "현재 수강중인 등록 건수",
      href: "/admin/enrollments",
    },
    {
      label: "오늘 수업",
      value: todaySessionsResult.count ?? 0,
      description:
        "오늘 예정된 전체 수업",
      href: "/admin/calendar",
    },
    {
      label: "이번 주 수업",
      value: weekSessionsResult.count ?? 0,
      description:
        "이번 주 전체 수업 일정",
      href: "/admin/calendar/week",
    },
    {
      label: "이번 달 수업",
      value: monthSessionsResult.count ?? 0,
      description:
        "이번 달 전체 수업 일정",
      href: "/admin/calendar/month",
    },
    {
      label: "오늘 출결 처리율",
      value: `${todayAttendanceRate}%`,
      description:
        "완료 수업 중 출결 등록 비율",
      href: "/admin/attendance",
    },
    {
      label: "오늘 평가 작성률",
      value: `${todayEvaluationRate}%`,
      description:
        "완료 수업 중 평가 작성 비율",
      href: "/admin/evaluations",
    },
  ];

  const alerts = [
    {
      label: "결석 승인 대기",
      value: pendingHoldsResult.count ?? 0,
      href: "/admin/holds",
    },
    {
      label: "출결 미처리",
      value: missingAttendanceCount,
      href: "/admin/attendance",
    },
    {
      label: "평가 미작성",
      value: missingEvaluationCount,
      href: "/admin/evaluations",
    },
    {
      label: "강사 미배정 수강",
      value:
        unassignedEnrollmentsResult.count ?? 0,
      href: "/admin/enrollments",
    },
    {
      label: "수업 링크 미등록",
      value: missingMeetingUrlCount,
      href: "/admin/calendar",
    },
    {
      label: "30분 이내 시작",
      value: upcomingThirtyMinutesCount,
      href: "/admin/calendar",
    },
    {
      label: "현재 수업 시간",
      value: activeNowCount,
      href: "/admin/calendar",
    },
  ];

  return (
    <div>
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
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              letterSpacing: "-0.03em",
            }}
          >
            관리자 대시보드
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            TALKLY의 오늘 운영 현황과 확인할 업무를 한눈에 봅니다.
          </p>
        </div>

        <div
          style={{
            padding: "10px 14px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "10px",
            fontSize: "13px",
            opacity: 0.74,
          }}
        >
          기준일: {seoulDate}
        </div>
      </div>

      <section
        style={{
          marginTop: "30px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        {cards.map((card) => (
          <DashboardCard
            key={card.label}
            {...card}
          />
        ))}
      </section>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.55fr) minmax(320px, 0.8fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: "24px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "14px",
            background:
              "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                }}
              >
                오늘 이후 수업
              </h2>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  opacity: 0.5,
                }}
              >
                오늘부터 가까운 일정 10건을 표시합니다.
              </div>
            </div>

            <Link
              href="/admin/calendar"
              style={{
                color: "inherit",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              오늘 캘린더
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div
              style={{
                padding: "22px",
                border:
                  "1px dashed #cfd8e6",
                borderRadius: "10px",
                opacity: 0.6,
              }}
            >
              등록된 예정 수업이 없습니다.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "9px",
              }}
            >
              {recentSessions.map(
                (session) => (
                  <Link
                    key={session.id}
                    href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "78px minmax(0, 1fr) 100px",
                      gap: "14px",
                      alignItems: "center",
                      padding: "14px",
                      border:
                        "1px solid #e7ebf0",
                      borderRadius: "10px",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <strong>
                      {session.lesson_number}
                      회차
                    </strong>

                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          opacity: 0.55,
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}{" "}
                        ·{" "}
                        {getTeacherName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          opacity: 0.5,
                        }}
                      >
                        {formatKoreanDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      {!session.meeting_url && (
                        <div
                          style={{
                            marginTop: "5px",
                            fontSize: "11px",
                            opacity: 0.7,
                          }}
                        >
                          수업 링크 미등록
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {getSessionStatusLabel(
                        session.status
                      )}
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              padding: "24px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "14px",
              background:
                "#ffffff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "20px",
              }}
            >
              확인 필요
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {alerts.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 14px",
                    border:
                      "1px solid #e7ebf0",
                    borderRadius: "9px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}건</strong>
                </Link>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "14px",
              background:
                "#ffffff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "20px",
              }}
            >
              캘린더
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: "9px",
              }}
            >
              {[
                {
                  label: "오늘",
                  href: "/admin/calendar",
                },
                {
                  label: "주간",
                  href: "/admin/calendar/week",
                },
                {
                  label: "월간",
                  href: "/admin/calendar/month",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "12px 10px",
                    border:
                      "1px solid #d9e0ea",
                    borderRadius: "9px",
                    color: "inherit",
                    textDecoration: "none",
                    textAlign: "center",
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "14px",
              background:
                "#ffffff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "20px",
              }}
            >
              빠른 관리
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "9px",
              }}
            >
              {[
                {
                  label: "새 수강 등록",
                  href: "/admin/enrollments/new",
                },
                {
                  label: "수강 관리",
                  href: "/admin/enrollments",
                },
                {
                  label: "수강신청 설정",
                  href: "/admin/enrollment-settings",
                },
                {
                  label: "학생 관리",
                  href: "/admin/students",
                },
                {
                  label: "학부모 관리",
                  href: "/admin/parents",
                },
                {
                  label: "강사 관리",
                  href: "/admin/teachers",
                },
                {
                  label: "결석신청 처리",
                  href: "/admin/holds",
                },
                {
                  label: "출결 관리",
                  href: "/admin/attendance",
                },
                {
                  label: "학습 평가",
                  href: "/admin/evaluations",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "12px 14px",
                    border:
                      "1px solid #d9e0ea",
                    borderRadius: "9px",
                    color: "inherit",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              최근 등록 수강
            </h2>

            <div
              style={{
                marginTop: "5px",
                fontSize: "12px",
                opacity: 0.5,
              }}
            >
              가장 최근에 등록된 수강 5건입니다.
            </div>
          </div>

          <Link
            href="/admin/enrollments"
            style={{
              color: "inherit",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            전체 보기
          </Link>
        </div>

        {recentEnrollments.length === 0 ? (
          <div
            style={{
              padding: "22px",
              border:
                "1px dashed #cfd8e6",
              borderRadius: "10px",
              opacity: 0.6,
            }}
          >
            최근 등록된 수강이 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "10px",
            }}
          >
            {recentEnrollments.map(
              (enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/admin/enrollments/${enrollment.id}`}
                  style={{
                    padding: "14px",
                    border:
                      "1px solid #e7ebf0",
                    borderRadius: "10px",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                    }}
                  >
                    {getStudentName(
                      enrollment.id
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      fontSize: "12px",
                      opacity: 0.56,
                    }}
                  >
                    {getCourseName(
                      enrollment.id
                    )}{" "}
                    ·{" "}
                    {getTeacherName(
                      enrollment.id
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      opacity: 0.5,
                    }}
                  >
                    상태: {enrollment.status}
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}