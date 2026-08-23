import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
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
  meeting_provider: string | null;
  meeting_url: string | null;
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

type Child = {
  id: number;
  name: string;
};

type Profile = {
  id: string;
  name: string | null;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "completed":
      return "완료";
    case "cancelled":
      return "수업 취소";
    case "no_show":
      return "결석";
    case "held":
      return "수업 연기";
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(value);
}

export default async function AdminCalendarPage({
  searchParams,
}: PageProps) {
  const {
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

  const now = new Date();

  const seoulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const todayStart = new Date(
    `${seoulDate}T00:00:00+09:00`
  ).toISOString();

  const tomorrow = new Date(
    `${seoulDate}T00:00:00+09:00`
  );
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowStart = tomorrow.toISOString();

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
        status,
        meeting_provider,
        meeting_url
      `)
      .gte("scheduled_start", todayStart)
      .lt("scheduled_start", tomorrowStart)
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
    new Set(sessions.map((session) => session.enrollment_id))
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

  const sessionIds = sessions.map((session) => session.id);

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

  const lookupError =
    childrenResult.error ||
    studentsResult.error ||
    coursesResult.error ||
    attendanceResult.error ||
    evaluationsResult.error;

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const enrollmentMap = new Map(
    enrollments.map((item) => [item.id, item])
  );

  const childMap = new Map(
    ((childrenResult.data ?? []) as Child[]).map((item) => [
      item.id,
      item.name,
    ])
  );

  const studentMap = new Map(
    ((studentsResult.data ?? []) as Profile[]).map((item) => [
      item.id,
      item.name || "성인 학생",
    ])
  );

  const courseMap = new Map(
    ((coursesResult.data ?? []) as Course[]).map((item) => [
      item.id,
      item.name,
    ])
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
      item,
    ])
  );

  const evaluationSet = new Set(
    ((evaluationsResult.data ?? []) as Evaluation[]).map(
      (item) => item.class_session_id
    )
  );

  function getStudentName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      return childMap.get(enrollment.child_id) || "자녀 정보 없음";
    }

    if (enrollment.student_user_id) {
      return (
        studentMap.get(enrollment.student_user_id) || "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return courseMap.get(enrollment.course_id) || "-";
  }

  function getTeacherName(enrollmentId: number) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment?.teacher_user_id) {
      return "미배정";
    }

    return (
      teacherMap.get(enrollment.teacher_user_id) || "미배정"
    );
  }

  const normalizedQuery = q.trim().toLowerCase();

  const filteredSessions = sessions.filter((session) => {
    const enrollment = enrollmentMap.get(session.enrollment_id);

    const studentName = getStudentName(session.enrollment_id);
    const courseName = getCourseName(session.enrollment_id);
    const teacherName = getTeacherName(session.enrollment_id);

    const matchesQuery =
      !normalizedQuery ||
      [studentName, courseName, teacherName].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );

    const matchesTeacher =
      teacher === "all" ||
      enrollment?.teacher_user_id === teacher;

    const matchesStatus =
      status === "all" || session.status === status;

    return matchesQuery && matchesTeacher && matchesStatus;
  });

  const scheduledCount = sessions.filter(
    (session) => session.status === "scheduled"
  ).length;

  const completedCount = sessions.filter(
    (session) => session.status === "completed"
  ).length;

  const heldCount = sessions.filter(
    (session) => session.status === "held"
  ).length;

  const cancelledCount = sessions.filter(
    (session) => session.status === "cancelled"
  ).length;

  const missingAttendanceCount = sessions.filter(
    (session) =>
      session.status === "completed" &&
      !attendanceMap.has(session.id)
  ).length;

  const missingEvaluationCount = sessions.filter(
    (session) =>
      session.status === "completed" &&
      !evaluationSet.has(session.id)
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
            수업 캘린더
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            오늘의 전체 수업과 처리 상태를 시간순으로 확인합니다.
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
          {formatDateLabel(now)}
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          ["오늘 수업", sessions.length],
          ["예정", scheduledCount],
          ["완료", completedCount],
          ["수업 연기", heldCount],
          ["수업 취소", cancelledCount],
          ["출결 미처리", missingAttendanceCount],
          ["평가 미작성", missingEvaluationCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "20px",
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
                fontSize: "29px",
                fontWeight: 800,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/calendar"
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "9px",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          오늘 수업
        </Link>

        <span
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "9px",
            opacity: 0.45,
          }}
        >
          주간 일정 준비 중
        </span>

        <span
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "9px",
            opacity: 0.45,
          }}
        >
          월간 캘린더 준비 중
        </span>
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
          <option value="held">수업 연기</option>
          <option value="cancelled">수업 취소</option>
          <option value="no_show">결석</option>
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
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "14px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "90px 90px minmax(150px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr) 110px 110px 90px",
            gap: "12px",
            padding: "14px 18px",
            borderBottom:
              "1px solid rgba(255,255,255,0.14)",
            fontSize: "12px",
            fontWeight: 700,
            opacity: 0.55,
          }}
        >
          <div>시간</div>
          <div>회차</div>
          <div>학생</div>
          <div>강사</div>
          <div>과정</div>
          <div>출결</div>
          <div>평가</div>
          <div>상태</div>
        </div>

        {filteredSessions.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              opacity: 0.62,
            }}
          >
            조건에 맞는 오늘 수업이 없습니다.
          </div>
        ) : (
          filteredSessions.map((session) => {
            const attendanceItem =
              attendanceMap.get(session.id);

            return (
              <Link
                key={session.id}
                href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "90px 90px minmax(150px, 1fr) minmax(140px, 1fr) minmax(140px, 1fr) 110px 110px 90px",
                  gap: "12px",
                  alignItems: "center",
                  padding: "16px 18px",
                  borderBottom:
                    "1px solid rgba(255,255,255,0.1)",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <div>
                  <strong>
                    {formatTime(session.scheduled_start)}
                  </strong>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "11px",
                      opacity: 0.5,
                    }}
                  >
                    {formatTime(session.scheduled_end)}
                  </div>
                </div>

                <div>
                  {session.lesson_number}회차
                </div>

                <div style={{ fontWeight: 800 }}>
                  {getStudentName(session.enrollment_id)}
                </div>

                <div>
                  {getTeacherName(session.enrollment_id)}
                </div>

                <div>
                  {getCourseName(session.enrollment_id)}
                </div>

                <div>
                  {attendanceItem
                    ? getAttendanceStatusLabel(
                        attendanceItem.status
                      )
                    : "미등록"}
                </div>

                <div>
                  {evaluationSet.has(session.id)
                    ? "작성 완료"
                    : "미작성"}
                </div>

                <div style={{ fontWeight: 700 }}>
                  {getSessionStatusLabel(session.status)}
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}