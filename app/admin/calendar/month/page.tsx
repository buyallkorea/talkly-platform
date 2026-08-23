import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    month?: string;
    date?: string;
    teacher?: string;
    status?: string;
    q?: string;
  }>;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type Attendance = {
  class_session_id: number;
  status: string;
};

type Evaluation = {
  class_session_id: number;
};

function formatDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatMonthKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(value);
}

function formatMonthTitle(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
  }).format(value);
}

function formatDayNumber(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    day: "numeric",
  }).format(value);
}

function formatDateTitle(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMonths(value: Date, amount: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + amount);
  return date;
}

function getMonthStart(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1
  );
}

function getMonthEnd(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + 1,
    1
  );
}

function getCalendarStart(monthStart: Date) {
  const day = monthStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(monthStart, mondayOffset);
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "completed":
      return "완료";
    case "cancelled":
      return "수업 취소";
    case "held":
      return "수업 연기";
    case "no_show":
      return "결석";
    default:
      return status;
  }
}

function getAttendanceStatusLabel(status: string) {
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
      return status;
  }
}

function getStatusAccent(status: string) {
  switch (status) {
    case "scheduled":
      return "rgba(96,165,250,0.9)";
    case "completed":
      return "rgba(74,222,128,0.9)";
    case "held":
      return "rgba(251,146,60,0.9)";
    case "no_show":
      return "rgba(248,113,113,0.9)";
    case "cancelled":
      return "rgba(156,163,175,0.9)";
    default:
      return "rgba(255,255,255,0.45)";
  }
}

export default async function AdminMonthCalendarPage({
  searchParams,
}: PageProps) {
  const {
    month,
    date,
    teacher = "all",
    status = "all",
    q = "",
  } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const now = new Date();

  const selectedMonth = month
    ? new Date(`${month}-01T00:00:00+09:00`)
    : getMonthStart(now);

  const monthStart = getMonthStart(selectedMonth);
  const monthEnd = getMonthEnd(selectedMonth);

  const calendarStart = getCalendarStart(monthStart);
  const calendarEnd = addDays(calendarStart, 42);

  const selectedDateKey =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : formatDateKey(now);

  const [
    sessionsResult,
    teachersResult,
  ] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .gte("scheduled_start", calendarStart.toISOString())
      .lt("scheduled_start", calendarEnd.toISOString())
      .order("scheduled_start", { ascending: true }),

    supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .order("display_name", { ascending: true }),
  ]);

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }

  if (teachersResult.error) {
    throw new Error(teachersResult.error.message);
  }

  const sessions =
    (sessionsResult.data ?? []) as ClassSession[];

  const teachers =
    (teachersResult.data ?? []) as Teacher[];

  const enrollmentIds = Array.from(
    new Set(
      sessions.map(
        (session) => session.enrollment_id
      )
    )
  );

  let enrollments: Enrollment[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id
      `)
      .in("id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    enrollments = (data ?? []) as Enrollment[];
  }

  const childIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.child_id)
        .filter(
          (value): value is number =>
            value !== null
        )
    )
  );

  const studentIds = Array.from(
    new Set(
      enrollments
        .map(
          (item) =>
            item.student_user_id
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (item) => item.course_id
      )
    )
  );

  const sessionIds = sessions.map(
    (session) => session.id
  );

  const [
    childrenResult,
    studentsResult,
    coursesResult,
    attendanceResult,
    evaluationsResult,
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

    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds)
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

    sessionIds.length > 0
      ? supabase
          .from("attendance")
          .select(`
            class_session_id,
            status
          `)
          .in(
            "class_session_id",
            sessionIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    sessionIds.length > 0
      ? supabase
          .from("evaluations")
          .select("class_session_id")
          .in(
            "class_session_id",
            sessionIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const lookupError =
    childrenResult.error ||
    studentsResult.error ||
    coursesResult.error ||
    attendanceResult.error ||
    evaluationsResult.error;

  if (lookupError) {
    throw new Error(
      lookupError.message
    );
  }

  const enrollmentMap = new Map(
    enrollments.map((item) => [
      item.id,
      item,
    ])
  );

  const childMap = new Map(
    (childrenResult.data ?? []).map(
      (item) => [
        item.id,
        item.name,
      ]
    )
  );

  const studentMap = new Map(
    (studentsResult.data ?? []).map(
      (item) => [
        item.id,
        item.name || "성인 학생",
      ]
    )
  );

  const courseMap = new Map(
    (coursesResult.data ?? []).map(
      (item) => [
        item.id,
        item.name,
      ]
    )
  );

  const teacherMap = new Map(
    teachers.map((item) => [
      item.user_id,
      item.display_name ||
        "이름 미등록 강사",
    ])
  );

  const attendanceMap = new Map(
    (
      (attendanceResult.data ??
        []) as Attendance[]
    ).map((item) => [
      item.class_session_id,
      item.status,
    ])
  );

  const evaluationSet = new Set(
    (
      (evaluationsResult.data ??
        []) as Evaluation[]
    ).map(
      (item) =>
        item.class_session_id
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
        childMap.get(
          enrollment.child_id
        ) || "자녀 정보 없음"
      );
    }

    if (enrollment.student_user_id) {
      return (
        studentMap.get(
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
      courseMap.get(
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
      !enrollment?.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teacherMap.get(
        enrollment.teacher_user_id
      ) || "미배정"
    );
  }

  const normalizedQuery =
    q.trim().toLowerCase();

  const filteredSessions =
    sessions.filter((session) => {
      const enrollment =
        enrollmentMap.get(
          session.enrollment_id
        );

      const matchesSearch =
        !normalizedQuery ||
        [
          getStudentName(
            session.enrollment_id
          ),
          getTeacherName(
            session.enrollment_id
          ),
          getCourseName(
            session.enrollment_id
          ),
        ].some((value) =>
          value
            .toLowerCase()
            .includes(
              normalizedQuery
            )
        );

      const matchesTeacher =
        teacher === "all" ||
        enrollment?.teacher_user_id ===
          teacher;

      const matchesStatus =
        status === "all" ||
        session.status === status;

      return (
        matchesSearch &&
        matchesTeacher &&
        matchesStatus
      );
    });

  const monthSessions =
    filteredSessions.filter(
      (session) => {
        const start = new Date(
          session.scheduled_start
        );

        return (
          start >= monthStart &&
          start < monthEnd
        );
      }
    );

  const sessionsByDate = new Map<
    string,
    ClassSession[]
  >();

  for (
    let index = 0;
    index < 42;
    index += 1
  ) {
    const day = addDays(
      calendarStart,
      index
    );

    sessionsByDate.set(
      formatDateKey(day),
      []
    );
  }

  for (const session of filteredSessions) {
    const key = formatDateKey(
      new Date(
        session.scheduled_start
      )
    );

    const list =
      sessionsByDate.get(key) ?? [];

    list.push(session);

    sessionsByDate.set(key, list);
  }

  const calendarDays =
    Array.from(
      { length: 42 },
      (_, index) =>
        addDays(
          calendarStart,
          index
        )
    );

  const selectedDate =
    new Date(
      `${selectedDateKey}T00:00:00+09:00`
    );

  const selectedDateSessions =
    (
      sessionsByDate.get(
        selectedDateKey
      ) ?? []
    ).sort(
      (a, b) =>
        new Date(
          a.scheduled_start
        ).getTime() -
        new Date(
          b.scheduled_start
        ).getTime()
    );

  const previousMonth =
    formatMonthKey(
      addMonths(monthStart, -1)
    );

  const nextMonth =
    formatMonthKey(
      addMonths(monthStart, 1)
    );

  const currentMonth =
    formatMonthKey(now);

  const scheduledCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "scheduled"
    ).length;

  const completedCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "completed"
    ).length;

  const heldCount =
    monthSessions.filter(
      (session) =>
        session.status === "held"
    ).length;

  const absentCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "no_show"
    ).length;

  const cancelledCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "cancelled"
    ).length;

  function buildMonthUrl(
    targetMonth: string,
    targetDate?: string
  ) {
    const params = new URLSearchParams();

    params.set("month", targetMonth);

    if (targetDate) {
      params.set("date", targetDate);
    }

    if (q) {
      params.set("q", q);
    }

    if (teacher !== "all") {
      params.set(
        "teacher",
        teacher
      );
    }

    if (status !== "all") {
      params.set(
        "status",
        status
      );
    }

    return `/admin/calendar/month?${params.toString()}`;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
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
              letterSpacing:
                "-0.03em",
            }}
          >
            월간 수업 캘린더
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            월 전체 수업 일정과 날짜별
            운영 현황을 확인합니다.
          </p>
        </div>

        <div
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          {formatMonthTitle(
            monthStart
          )}
        </div>
      </div>

      <section
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/calendar"
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            opacity: 0.72,
          }}
        >
          오늘 수업
        </Link>

        <Link
          href="/admin/calendar/week"
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            opacity: 0.72,
          }}
        >
          주간 일정
        </Link>

        <Link
          href={buildMonthUrl(
            previousMonth
          )}
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          ← 이전 달
        </Link>

        <Link
          href={buildMonthUrl(
            currentMonth,
            formatDateKey(now)
          )}
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          이번 달
        </Link>

        <Link
          href={buildMonthUrl(
            nextMonth
          )}
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          다음 달 →
        </Link>
      </section>

      <section
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          [
            "이번 달 전체",
            monthSessions.length,
          ],
          ["예정", scheduledCount],
          ["완료", completedCount],
          ["수업 연기", heldCount],
          ["결석", absentCount],
          ["수업 취소", cancelledCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "18px",
              border:
                "1px solid rgba(255,255,255,0.16)",
              borderRadius: "12px",
              background:
                "rgba(255,255,255,0.03)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                opacity: 0.58,
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </section>

      <form
        method="get"
        style={{
          marginTop: "18px",
          padding: "18px",
          border:
            "1px solid rgba(255,255,255,0.16)",
          borderRadius: "12px",
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) 190px 170px auto",
          gap: "10px",
          background:
            "rgba(255,255,255,0.03)",
        }}
      >
        <input
          type="hidden"
          name="month"
          value={formatMonthKey(
            monthStart
          )}
        />

        <input
          type="hidden"
          name="date"
          value={selectedDateKey}
        />

        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="학생명, 강사명, 과정 검색"
          style={{
            minWidth: 0,
            padding: "11px 12px",
            border:
              "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        />

        <select
          name="teacher"
          defaultValue={teacher}
          style={{
            padding: "11px 12px",
            border:
              "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        >
          <option value="all">
            전체 강사
          </option>

          {teachers.map((item) => (
            <option
              key={item.user_id}
              value={item.user_id}
            >
              {item.display_name ||
                "이름 미등록 강사"}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "11px 12px",
            border:
              "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        >
          <option value="all">
            전체 상태
          </option>
          <option value="scheduled">
            예정
          </option>
          <option value="completed">
            완료
          </option>
          <option value="held">
            수업 연기
          </option>
          <option value="no_show">
            결석
          </option>
          <option value="cancelled">
            수업 취소
          </option>
        </select>

        <button
          type="submit"
          style={{
            padding: "11px 18px",
            border:
              "1px solid rgba(255,255,255,0.22)",
            borderRadius: "8px",
            background: "#f5f5f5",
            color: "#111",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          검색
        </button>
      </form>

      <section
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.8fr) minmax(300px, 0.8fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "14px",
            overflow: "hidden",
            background:
              "rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(7, minmax(130px, 1fr))",
              borderBottom:
                "1px solid rgba(255,255,255,0.14)",
              fontSize: "12px",
              fontWeight: 800,
              opacity: 0.62,
            }}
          >
            {[
              "월",
              "화",
              "수",
              "목",
              "금",
              "토",
              "일",
            ].map((label) => (
              <div
                key={label}
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderRight:
                    "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(7, minmax(130px, 1fr))",
            }}
          >
            {calendarDays.map((dayItem) => {
              const key =
                formatDateKey(dayItem);

              const daySessions =
                sessionsByDate.get(key) ??
                [];

              const inCurrentMonth =
                dayItem.getMonth() ===
                monthStart.getMonth();

              const isToday =
                key === formatDateKey(now);

              const isSelected =
                key === selectedDateKey;

              return (
                <Link
                  key={key}
                  href={buildMonthUrl(
                    formatMonthKey(
                      monthStart
                    ),
                    key
                  )}
                  style={{
                    minHeight: "145px",
                    padding: "10px",
                    borderRight:
                      "1px solid rgba(255,255,255,0.08)",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                    color: "inherit",
                    textDecoration: "none",
                    background: isSelected
                      ? "rgba(255,255,255,0.08)"
                      : isToday
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                    opacity:
                      inCurrentMonth
                        ? 1
                        : 0.38,
                    boxSizing:
                      "border-box",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: "8px",
                    }}
                  >
                    <strong>
                      {formatDayNumber(
                        dayItem
                      )}
                    </strong>

                    {daySessions.length >
                      0 && (
                      <span
                        style={{
                          fontSize:
                            "11px",
                          opacity: 0.58,
                        }}
                      >
                        {
                          daySessions.length
                        }
                        건
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "9px",
                      display: "flex",
                      flexDirection:
                        "column",
                      gap: "5px",
                    }}
                  >
                    {daySessions
                      .slice(0, 3)
                      .map((session) => (
                        <div
                          key={session.id}
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "5px minmax(0,1fr)",
                            gap: "7px",
                            alignItems:
                              "start",
                            fontSize:
                              "11px",
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height:
                                "100%",
                              minHeight:
                                "28px",
                              borderRadius:
                                "999px",
                              background:
                                getStatusAccent(
                                  session.status
                                ),
                            }}
                          />

                          <div
                            style={{
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  800,
                                whiteSpace:
                                  "nowrap",
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                              }}
                            >
                              {formatTime(
                                session.scheduled_start
                              )}{" "}
                              {getStudentName(
                                session.enrollment_id
                              )}
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "2px",
                                opacity:
                                  0.5,
                                whiteSpace:
                                  "nowrap",
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                              }}
                            >
                              {getTeacherName(
                                session.enrollment_id
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                    {daySessions.length >
                      3 && (
                      <div
                        style={{
                          fontSize:
                            "11px",
                          opacity: 0.58,
                        }}
                      >
                        +
                        {daySessions.length -
                          3}
                        건 더 보기
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside
          style={{
            padding: "22px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "14px",
            background:
              "rgba(255,255,255,0.03)",
            position: "sticky",
            top: "96px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            {formatDateTitle(
              selectedDate
            )}
          </h2>

          <p
            style={{
              marginTop: 0,
              fontSize: "13px",
              opacity: 0.56,
            }}
          >
            선택한 날짜의 수업 목록입니다.
          </p>

          {selectedDateSessions.length ===
          0 ? (
            <div
              style={{
                marginTop: "18px",
                padding: "22px",
                border:
                  "1px dashed rgba(255,255,255,0.2)",
                borderRadius:
                  "10px",
                opacity: 0.62,
              }}
            >
              등록된 수업이 없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "18px",
                display: "flex",
                flexDirection:
                  "column",
                gap: "10px",
              }}
            >
              {selectedDateSessions.map(
                (session) => {
                  const attendanceStatus =
                    attendanceMap.get(
                      session.id
                    );

                  return (
                    <Link
                      key={session.id}
                      href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                      style={{
                        display: "block",
                        padding: "14px",
                        border:
                          "1px solid rgba(255,255,255,0.12)",
                        borderRadius:
                          "10px",
                        color: "inherit",
                        textDecoration:
                          "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                          fontSize:
                            "12px",
                        }}
                      >
                        <strong>
                          {formatTime(
                            session.scheduled_start
                          )}
                        </strong>

                        <span
                          style={{
                            opacity:
                              0.62,
                          }}
                        >
                          {getSessionStatusLabel(
                            session.status
                          )}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop:
                            "8px",
                          fontWeight:
                            800,
                        }}
                      >
                        {getStudentName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "12px",
                          opacity: 0.56,
                        }}
                      >
                        {getTeacherName(
                          session.enrollment_id
                        )}
                        {" · "}
                        {getCourseName(
                          session.enrollment_id
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "10px",
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                          fontSize:
                            "11px",
                          opacity: 0.64,
                        }}
                      >
                        <span>
                          {attendanceStatus
                            ? getAttendanceStatusLabel(
                                attendanceStatus
                              )
                            : "출결 미등록"}
                        </span>

                        <span>
                          {evaluationSet.has(
                            session.id
                          )
                            ? "평가 완료"
                            : "평가 미작성"}
                        </span>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}