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
      return "취소";
    case "held":
      return "결석 승인";
    case "no_show":
      return "무단결석";
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
            주간 수업 캘린더
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            월요일부터 일요일까지의 수업 일정을 한눈에 확인합니다.
          </p>
        </div>

        <div
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {formatDayLabel(weekStart)} ~{" "}
          {formatDayLabel(addDays(weekEnd, -1))}
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
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            opacity: 0.72,
          }}
        >
          오늘 수업
        </Link>

        <Link
          href={`/admin/calendar/week?week=${previousWeek}`}
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          ← 이전 주
        </Link>

        <Link
          href={`/admin/calendar/week?week=${currentWeek}`}
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          이번 주
        </Link>

        <Link
          href={`/admin/calendar/week?week=${nextWeek}`}
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          다음 주 →
        </Link>
      </section>

      <section
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          ["이번 주 전체", sessions.length],
          ["예정", totalScheduled],
          ["완료", totalCompleted],
          ["출결 등록", attendanceMap.size],
          ["평가 작성", evaluationSet.size],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "18px",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.03)",
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
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "12px",
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) 190px 170px auto",
          gap: "10px",
          background: "rgba(255,255,255,0.03)",
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
          style={{
            minWidth: 0,
            padding: "11px 12px",
            border: "1px solid rgba(255,255,255,0.2)",
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
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        >
          <option value="all">전체 강사</option>
          {teachers.map((item) => (
            <option
              key={item.user_id}
              value={item.user_id}
            >
              {item.display_name || "이름 미등록 강사"}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "11px 12px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        >
          <option value="all">전체 상태</option>
          <option value="scheduled">예정</option>
          <option value="completed">완료</option>
          <option value="held">결석 승인</option>
          <option value="cancelled">취소</option>
          <option value="no_show">무단결석</option>
        </select>

        <button
          type="submit"
          style={{
            padding: "11px 18px",
            border: "1px solid rgba(255,255,255,0.22)",
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
            "repeat(7, minmax(180px, 1fr))",
          gap: "12px",
          overflowX: "auto",
          paddingBottom: "8px",
        }}
      >
        {weekDays.map((dayItem) => {
          const dayKey = formatDateKey(dayItem);
          const daySessions = sessionsByDate.get(dayKey) ?? [];

          return (
            <div
              key={dayKey}
              style={{
                minWidth: "180px",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.03)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom:
                    "1px solid rgba(255,255,255,0.12)",
                  fontWeight: 800,
                }}
              >
                {formatDayLabel(dayItem)}
              </div>

              <div
                style={{
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {daySessions.length === 0 ? (
                  <div
                    style={{
                      padding: "18px 8px",
                      textAlign: "center",
                      opacity: 0.42,
                      fontSize: "13px",
                    }}
                  >
                    수업 없음
                  </div>
                ) : (
                  daySessions.map((session) => {
                    const attendanceStatus =
                      attendanceMap.get(session.id);

                    return (
                      <Link
                        key={session.id}
                        href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                        style={{
                          display: "block",
                          padding: "12px",
                          border:
                            "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "10px",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                            fontSize: "12px",
                            opacity: 0.62,
                          }}
                        >
                          <span>
                            {formatTime(session.scheduled_start)}
                          </span>
                          <span>
                            {getSessionStatusLabel(session.status)}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: "8px",
                            fontWeight: 800,
                          }}
                        >
                          {getStudentName(session.enrollment_id)}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "12px",
                            opacity: 0.58,
                          }}
                        >
                          {getTeacherName(session.enrollment_id)}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "12px",
                            opacity: 0.48,
                          }}
                        >
                          {getCourseName(session.enrollment_id)}
                        </div>

                        <div
                          style={{
                            marginTop: "9px",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                            fontSize: "11px",
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
                            {evaluationSet.has(session.id)
                              ? "평가 완료"
                              : "평가 미작성"}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}