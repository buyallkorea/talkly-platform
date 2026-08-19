import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AttendanceForm from "./AttendanceForm";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function TeacherAttendancePage({
  params,
}: PageProps) {
  const { sessionId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect("/");
  }

  const { data: session, error: sessionError } =
    await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .eq("id", Number(sessionId))
      .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    notFound();
  }

  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        teacher_user_id,
        course_id
      `)
      .eq("id", session.enrollment_id)
      .eq("teacher_user_id", user.id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  let studentName = "Student";

  if (enrollment.child_id) {
    const { data: child } = await supabase
      .from("children")
      .select("name")
      .eq("id", enrollment.child_id)
      .maybeSingle();

    if (child?.name) {
      studentName = child.name;
    }
  } else if (enrollment.student_user_id) {
    const { data: student } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", enrollment.student_user_id)
      .maybeSingle();

    if (student?.name) {
      studentName = student.name;
    }
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  const { data: attendance, error: attendanceError } =
    await supabase
      .from("attendance")
      .select(`
        id,
        status,
        attended_at,
        note
      `)
      .eq("class_session_id", session.id)
      .maybeSingle();

  if (attendanceError) {
    throw new Error(attendanceError.message);
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

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "850px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          marginBottom: "4px",
        }}
      >
        Attendance
      </h1>

      <div
        style={{
          fontSize: "13px",
          opacity: 0.6,
          marginBottom: "28px",
        }}
      >
        출석 관리
      </div>

      <section
        style={{
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          marginBottom: "24px",
        }}
      >
        <p>
          <strong>Student:</strong> {studentName}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "14px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          학생
        </div>

        <p>
          <strong>Course:</strong>{" "}
          {course?.name || "-"}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "14px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          과정
        </div>

        <p>
          <strong>Lesson:</strong>{" "}
          {session.lesson_number}
        </p>

        <div
          style={{
            marginTop: "-8px",
            marginBottom: "14px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          {session.lesson_number}회차
        </div>

        <p>
          <strong>Schedule:</strong>{" "}
          {formatEnglishDateTime(
            session.scheduled_start
          )}
        </p>

        <div
          style={{
            marginTop: "-8px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          {formatKoreanDateTime(
            session.scheduled_start
          )}
        </div>
      </section>

      <AttendanceForm
        sessionId={session.id}
        existingAttendance={
          attendance
            ? {
                id: attendance.id,
                status: attendance.status,
                note: attendance.note,
              }
            : null
        }
      />
    </main>
  );
}