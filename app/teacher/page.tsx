import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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
    enrollments?.map((enrollment) => enrollment.id) ?? [];

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
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
  }

  const childIds =
    enrollments
      ?.map((enrollment) => enrollment.child_id)
      .filter((id): id is number => id !== null) ?? [];

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
      ?.map((enrollment) => enrollment.student_user_id)
      .filter((id): id is string => id !== null) ?? [];

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
      (enrollment) => enrollment.course_id
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

  function getEnrollment(enrollmentId: number) {
    return enrollments?.find(
      (item) => item.id === enrollmentId
    );
  }

  function getStudentName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "Student";
    }

    if (enrollment.child_id) {
      const child = children.find(
        (item) => item.id === enrollment.child_id
      );

      return child?.name || "Student";
    }

    if (enrollment.student_user_id) {
      const student = students.find(
        (item) =>
          item.id === enrollment.student_user_id
      );

      return student?.name || "Adult Student";
    }

    return "Student";
  }

  function getCourseName(enrollmentId: number) {
    const enrollment = getEnrollment(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    const course = courses.find(
      (item) => item.id === enrollment.course_id
    );

    return course?.name || "-";
  }

  function getSessionStatus(status: string) {
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

      default:
        return {
          en: status,
          ko: "",
        };
    }
  }

  function formatEnglishDateTime(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function formatKoreanDateTime(value: string) {
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
        padding: "40px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: "36px",
        }}
      >
        <h1
          style={{
            marginBottom: "6px",
            fontSize: "34px",
          }}
        >
          TALKLY Teacher
        </h1>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.65,
            marginBottom: "14px",
          }}
        >
          TALKLY 강사
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {profile.name
            ? `Welcome, ${profile.name}.`
            : "Welcome to your teacher dashboard."}
        </p>

        <div
          style={{
            marginTop: "5px",
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          배정된 수업 일정을 확인하고 관리할 수 있습니다.
        </div>
      </div>

      <section
        style={{
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "14px",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "4px",
              fontSize: "26px",
            }}
          >
            My Classes
          </h2>

          <div
            style={{
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            내 수업
          </div>

          <div
            style={{
              marginTop: "14px",
              fontSize: "17px",
            }}
          >
            {sessions.length} Classes
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "12px",
              opacity: 0.55,
            }}
          >
            총 {sessions.length}회 수업
          </div>
        </div>

        {sessions.length === 0 ? (
          <div
            style={{
              padding: "28px",
              border: "1px dashed #ccc",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              No classes assigned.
            </div>

            <div
              style={{
                marginTop: "5px",
                fontSize: "13px",
                opacity: 0.6,
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
              gap: "14px",
            }}
          >
            {sessions.map((session) => {
              const status =
                getSessionStatus(session.status);

              return (
                <Link
                  key={session.id}
                  href={`/teacher/classes/${session.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "100px 1.2fr 1.3fr 90px 110px",
                    gap: "18px",
                    alignItems: "center",
                    padding: "18px",
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: "17px",
                      }}
                    >
                      Lesson {session.lesson_number}
                    </strong>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      {session.lesson_number}회차
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
                        fontSize: "13px",
                        opacity: 0.65,
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
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      {formatEnglishDateTime(
                        session.scheduled_start
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      {formatKoreanDateTime(
                        session.scheduled_start
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                      }}
                    >
                      {getDurationMinutes(
                        session.scheduled_start,
                        session.scheduled_end
                      )}{" "}
                      min
                    </div>

                    <div
                      style={{
                        marginTop: "3px",
                        fontSize: "12px",
                        opacity: 0.55,
                      }}
                    >
                      수업시간
                    </div>
                  </div>

                  <div>
                    <strong
                      style={{
                        fontSize: "16px",
                      }}
                    >
                      {status.en}
                    </strong>

                    {status.ko && (
                      <div
                        style={{
                          marginTop: "3px",
                          fontSize: "12px",
                          opacity: 0.55,
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
    </main>
  );
}