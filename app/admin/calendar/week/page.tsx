import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    week?: string;
    q?: string;
    teacher?: string;
    status?: string;
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

type Attendance = {
  class_session_id: number;
  status: string;
};

type Evaluation = {
  class_session_id: number;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

function formatDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
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

function getMonday(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
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

export default async function AdminWeekCalendarPage({
  searchParams,
}: PageProps) {
  const {
    week,
    q = "",
    teacher = "all",
    status = "all",
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

  const baseDate = week
    ? new Date(`${week}T00:00:00+09:00`)
    : new Date();

  const weekStart = getMonday(baseDate);
  const weekEnd = addDays(weekStart, 7);

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
      .gte("scheduled_start", weekStart.toISOString())
      .lt("scheduled_start", weekEnd.toISOString())
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
    new Set(sessions.map((item) => item.enrollment_id))
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
        .filter((value): value is number => value !== null)
    )
  );

  const studentIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.student_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const courseIds = Array.from(
    new Set(enrollments.map((item) => item.course_id))
  );

  const sessionIds = sessions.map((item) => item.id);

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
      : Promise.resolve({ data: [], error: null }),

    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),

    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),

    sessionIds.length > 0
      ? supabase
          .from("attendance")
          .select("class_session_id, status")
          .in("class_session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),

    sessionIds.length > 0
      ? supabase
          .from("evaluations")
          .select("class_session_id")
          .in("class_session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError =
    childrenResult.error ||
    studentsResult.error ||
    coursesResult.error ||
    attendanceResult.error ||
    evaluationsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const enrollmentMap = new Map(
    enrollments.map((item) => [item.id, item])
  );

  const childMap = new Map(
    (childrenResult.data ?? []).map((item) => [item.id, item.name])
  );

  const studentMap = new Map(
    (studentsResult.data ?? []).map((item) => [
      item.id,
      item.name || "성인 학생",
    ])
  );

  const courseMap = new Map(
    (coursesResult.data ?? []).map((item) => [item.id, item.name])
  );

  const teacherMap = new Map(
    teachers.map((item) => [
      item.user_id,
      item.display_name || "이름 미등록 강사",
    ])
  );

  const attendanceMap = new Map(
    ((attendanceResult.data ?? []) as Attendance[]).map((item) => [
      item.class_session_id,
      item.status,
    ])
  );

  const evaluationSet = new Set(
    ((evaluationsResult.data ?? []) as Evaluation[]).map(
      (item) => item.class_session_id
    )
  );

  function getStudentName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment) return "학생 정보 없음";

    if (enrollment.child_id) {
      return childMap.get(enrollment.child_id) || "자녀 정보 없음";
    }

    if (enrollment.student_user_id) {
      return studentMap.get(enrollment.student_user_id) || "성인 학생";
    }

    return "학생 정보 없음";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);
    return enrollment
      ? courseMap.get(enrollment.course_id) || "-"
      : "-";
  }

  function getTeacherName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment?.teacher_user_id) {
      return "미배정";
    }

    return (
      teacherMap.get(enrollment.teacher_user_id) ||
      "이름 미등록 강사"
    );
  }

  const normalizedQuery = q.trim().toLowerCase();

  const filteredSessions = sessions.filter((session) => {
    const enrollment = enrollmentMap.get(session.enrollment_id);

    const matchesQuery =
      !normalizedQuery ||
      [
        getStudentName(session.enrollment_id),
        getTeacherName(session.enrollment_id),
        getCourseName(session.enrollment_id),
      ].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );

    const matchesTeacher =
      teacher === "all" ||
      enrollment?.teacher_user_id === teacher;

    const matchesStatus =
      status === "all" ||
      session.status === status;

    return matchesQuery && matchesTeacher && matchesStatus;
  });

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  );

  const sessionsByDate = new Map<string, ClassSession[]>();

  for (const dayItem of weekDays) {
    sessionsByDate.set(formatDateKey(dayItem), []);
  }

  for (const session of filteredSessions) {
    const key = formatDateKey(new Date(session.scheduled_start));
    const list = sessionsByDate.get(key) ?? [];
    list.push(session);
    sessionsByDate.set(key, list);
  }

  const previousWeek = formatDateKey(addDays(weekStart, -7));
  const nextWeek = formatDateKey(addDays(weekStart, 7));
  const currentWeek = formatDateKey(getMonday(new Date()));

  const totalCompleted = sessions.filter(
    (item) => item.status === "completed"
  ).length;

  const totalScheduled = sessions.filter(
    (item) => item.status === "scheduled"
  ).length;

  const totalHeld = sessions.filter(
    (item) => item.status === "held"
  ).length;

  const totalCancelled = sessions.filter(
    (item) => item.status === "cancelled"
  ).length;

  const totalNoShow = sessions.filter(
    (item) => item.status === "no_show"
  ).length;

  const missingAttendanceCount = sessions.filter(
    (item) =>
      item.status === "completed" &&
      !attendanceMap.has(item.id)
  ).length;

  const missingEvaluationCount = sessions.filter(
    (item) =>
      item.status === "completed" &&
      !evaluationSet.has(item.id)
  ).length;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1500px",
        margin: "0 auto",
        padding: "52px 40px 90px",
      }}
    >
      <section
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
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            WEEKLY CLASS OPERATION
          </div>

          <h1
            style={{
              margin: "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
            }}
          >
            주간 수업
          </h1>

          <p
            style={{
              margin: "13px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.7,
            }}
          >
            월요일부터 일요일까지 수업 일정과 출결·평가 처리 상태를 한눈에 확인합니다.
          </p>
        </div>

        <div
          style={{
            minHeight: "44px",
            padding: "0 16px",
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #d0d5dd",
            borderRadius: "10px",
            background: "#ffffff",
            color: "#344054",
            fontSize: "13px",
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          {formatDayLabel(weekStart)} ~ {formatDayLabel(addDays(weekEnd, -1))}
        </div>
      </section>

      <section
        style={{
          marginTop: "26px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Link href="/admin/calendar" style={tabStyle}>
            오늘
          </Link>

          <Link
            href={`/admin/calendar/week?week=${formatDateKey(weekStart)}`}
            style={{
              ...tabStyle,
              background: "#0A1F44",
              color: "#ffffff",
              borderColor: "#0A1F44",
            }}
          >
            주간
          </Link>

          <Link href="/admin/calendar/month" style={tabStyle}>
            월간
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/calendar/week?week=${previousWeek}`}
            style={secondaryButtonStyle}
          >
            ← 이전 주
          </Link>

          <Link
            href={`/admin/calendar/week?week=${currentWeek}`}
            style={secondaryButtonStyle}
          >
            이번 주
          </Link>

          <Link
            href={`/admin/calendar/week?week=${nextWeek}`}
            style={secondaryButtonStyle}
          >
            다음 주 →
          </Link>
        </div>
      </section>

      <section
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="이번 주 전체"
          value={sessions.length}
          description="조회 주간의 전체 수업"
        />
        <SummaryCard
          label="예정"
          value={totalScheduled}
          description="진행 예정 수업"
        />
        <SummaryCard
          label="완료"
          value={totalCompleted}
          description="완료 처리된 수업"
        />
        <SummaryCard
          label="수업 연기"
          value={totalHeld}
          description="사전 신청 후 자동 승인된 수업"
        />
        <SummaryCard
          label="수업 취소·결석"
          value={totalCancelled + totalNoShow}
          description={`수업 취소 ${totalCancelled} · 결석 ${totalNoShow}`}
        />
      </section>

      <section
        style={{
          marginTop: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <AlertCard
          label="출결 미처리"
          value={missingAttendanceCount}
          description="완료된 수업 중 출결이 등록되지 않은 건"
          warning={missingAttendanceCount > 0}
        />
        <AlertCard
          label="평가 미작성"
          value={missingEvaluationCount}
          description="완료된 수업 중 평가가 작성되지 않은 건"
          warning={missingEvaluationCount > 0}
        />
      </section>

      <form
        method="get"
        style={{
          marginTop: "22px",
          padding: "18px",
          display: "grid",
          gridTemplateColumns: "minmax(240px, 1fr) 200px 180px auto auto",
          gap: "10px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <input
          type="hidden"
          name="week"
          value={formatDateKey(weekStart)}
        />

        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="학생명, 강사명, 과정 검색"
          style={fieldStyle}
        />

        <select
          name="teacher"
          defaultValue={teacher}
          style={fieldStyle}
        >
          <option value="all">전체 강사</option>
          {teachers.map((item) => (
            <option key={item.user_id} value={item.user_id}>
              {item.display_name || "이름 미등록 강사"}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status}
          style={fieldStyle}
        >
          <option value="all">전체 상태</option>
          <option value="scheduled">예정</option>
          <option value="completed">완료</option>
          <option value="held">수업 연기</option>
          <option value="cancelled">수업 취소</option>
          <option value="no_show">결석</option>
        </select>

        <button
          type="submit"
          style={{
            minHeight: "44px",
            padding: "0 18px",
            border: "none",
            borderRadius: "9px",
            background: "#0A1F44",
            color: "#ffffff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          검색
        </button>

        <Link
          href={`/admin/calendar/week?week=${formatDateKey(weekStart)}`}
          style={{
            ...secondaryButtonStyle,
            minHeight: "44px",
          }}
        >
          초기화
        </Link>
      </form>

      <section
        style={{
          marginTop: "20px",
          overflowX: "auto",
          paddingBottom: "8px",
        }}
      >
        <div
          style={{
            minWidth: "1260px",
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(170px, 1fr))",
            gap: "12px",
          }}
        >
          {weekDays.map((dayItem) => {
            const dayKey = formatDateKey(dayItem);
            const daySessions = sessionsByDate.get(dayKey) ?? [];
            const isToday = dayKey === formatDateKey(new Date());

            return (
              <section
                key={dayKey}
                style={{
                  minWidth: "170px",
                  border: isToday
                    ? "1px solid #9db8ff"
                    : "1px solid #e4e7ec",
                  borderRadius: "15px",
                  background: "#ffffff",
                  overflow: "hidden",
                  boxShadow: isToday
                    ? "0 8px 24px rgba(47,111,237,.08)"
                    : "0 1px 2px rgba(16,24,40,.02)",
                }}
              >
                <div
                  style={{
                    padding: "15px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    borderBottom: "1px solid #eaecf0",
                    background: isToday ? "#f5f8ff" : "#f9fafb",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: isToday ? "#2f6fed" : "#344054",
                        fontSize: "13px",
                        fontWeight: 900,
                      }}
                    >
                      {formatDayLabel(dayItem)}
                    </div>
                    {isToday && (
                      <div
                        style={{
                          marginTop: "3px",
                          color: "#2f6fed",
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        TODAY
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      minWidth: "28px",
                      height: "28px",
                      padding: "0 7px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "999px",
                      background: daySessions.length > 0 ? "#eef4ff" : "#f2f4f7",
                      color: daySessions.length > 0 ? "#2f6fed" : "#98a2b3",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    {daySessions.length}
                  </span>
                </div>

                <div
                  style={{
                    minHeight: "250px",
                    padding: "11px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  {daySessions.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        minHeight: "210px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#b0b8c4",
                        fontSize: "12px",
                      }}
                    >
                      수업 없음
                    </div>
                  ) : (
                    daySessions.map((session) => {
                      const attendanceStatus = attendanceMap.get(session.id);
                      const hasEvaluation = evaluationSet.has(session.id);

                      return (
                        <Link
                          key={session.id}
                          href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                          style={{
                            display: "block",
                            padding: "12px",
                            border: "1px solid #e4e7ec",
                            borderRadius: "11px",
                            background:
                              session.status === "scheduled"
                                ? "#ffffff"
                                : "#fbfcfe",
                            color: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <strong
                              style={{
                                color: "#101828",
                                fontSize: "13px",
                              }}
                            >
                              {formatTime(session.scheduled_start)}
                            </strong>

                            <SessionStatusBadge status={session.status} />
                          </div>

                          <div
                            style={{
                              marginTop: "9px",
                              color: "#101828",
                              fontSize: "13px",
                              fontWeight: 900,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getStudentName(session.enrollment_id)}
                          </div>

                          <div
                            style={{
                              marginTop: "4px",
                              color: "#667085",
                              fontSize: "12px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getTeacherName(session.enrollment_id)}
                          </div>

                          <div
                            style={{
                              marginTop: "3px",
                              color: "#98a2b3",
                              fontSize: "11px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getCourseName(session.enrollment_id)}
                          </div>

                          <div
                            style={{
                              marginTop: "10px",
                              paddingTop: "9px",
                              borderTop: "1px solid #eef1f5",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <SmallState
                              label={
                                attendanceStatus
                                  ? getAttendanceStatusLabel(attendanceStatus)
                                  : "출결 미등록"
                              }
                              warning={
                                session.status === "completed" &&
                                !attendanceStatus
                              }
                            />
                            <SmallState
                              label={hasEvaluation ? "평가 완료" : "평가 미작성"}
                              warning={
                                session.status === "completed" &&
                                !hasEvaluation
                              }
                            />
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <div
        style={{
          marginTop: "16px",
          padding: "15px 17px",
          border: "1px solid #eef1f5",
          borderRadius: "12px",
          background: "#f9fafb",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        각 수업 카드를 클릭하면 수업 상세 화면으로 이동합니다. 완료 수업의 출결 미등록 및 평가 미작성 여부도 함께 확인할 수 있습니다.
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div
      style={{
        minHeight: "116px",
        padding: "19px",
        border: "1px solid #e4e7ec",
        borderRadius: "14px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "11px",
          color: "#101828",
          fontSize: "30px",
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: "11px",
          color: "#98a2b3",
          fontSize: "11px",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function AlertCard({
  label,
  value,
  description,
  warning,
}: {
  label: string;
  value: number;
  description: string;
  warning: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        border: warning ? "1px solid #fed7aa" : "1px solid #e4e7ec",
        borderRadius: "13px",
        background: warning ? "#fffaf5" : "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            color: warning ? "#b54708" : "#667085",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: "5px",
            color: "#98a2b3",
            fontSize: "11px",
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          color: warning ? "#b54708" : "#101828",
          fontSize: "28px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SessionStatusBadge({
  status,
}: {
  status: string;
}) {
  let background = "#f2f4f7";
  let color = "#475467";

  if (status === "scheduled") {
    background = "#eef4ff";
    color = "#2f6fed";
  } else if (status === "completed") {
    background = "#ecfdf3";
    color = "#027a48";
  } else if (status === "held") {
    background = "#fff7ed";
    color = "#b54708";
  } else if (status === "cancelled" || status === "no_show") {
    background = "#fef3f2";
    color = "#b42318";
  }

  return (
    <span
      style={{
        minHeight: "24px",
        padding: "0 7px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background,
        color,
        fontSize: "10px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {getSessionStatusLabel(status)}
    </span>
  );
}

function SmallState({
  label,
  warning,
}: {
  label: string;
  warning: boolean;
}) {
  return (
    <span
      style={{
        color: warning ? "#b54708" : "#667085",
        fontSize: "10px",
        fontWeight: warning ? 900 : 700,
      }}
    >
      {label}
    </span>
  );
}

const fieldStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box" as const,
  minHeight: "44px",
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
};

const tabStyle = {
  minHeight: "42px",
  padding: "0 15px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 900,
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 800,
};