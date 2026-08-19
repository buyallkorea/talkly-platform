import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditLessonForm from "./EditLessonForm";

type PageProps = {
  params: Promise<{
    id: string;
    lessonId: string;
  }>;
};

export default async function EditLessonPage({
  params,
}: PageProps) {
  const { id, lessonId } = await params;

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

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  // class_sessions 기준으로 개별 수업 조회
  const { data: session, error: sessionError } =
    await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        meeting_provider,
        meeting_url,
        teacher_notes
      `)
      .eq("id", Number(lessonId))
      .eq("enrollment_id", Number(id))
      .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    notFound();
  }

  // 수강정보
  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id,
        course_id,
        teacher_user_id
      `)
      .eq("id", session.enrollment_id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  // 학생 이름
  let studentName = "학생 정보 없음";

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

    studentName =
      student?.name || "성인 학생";
  }

  // 과정
  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  // 강사
  let teacherName = "미배정";

  if (enrollment.teacher_user_id) {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("display_name")
      .eq(
        "user_id",
        enrollment.teacher_user_id
      )
      .maybeSingle();

    if (teacher?.display_name) {
      teacherName = teacher.display_name;
    }
  }

  // 한국시간 기준 날짜/시간으로 변환
  const startDate = new Date(
    session.scheduled_start
  );

  const endDate = new Date(
    session.scheduled_end
  );

  const dateFormatter =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const timeFormatter =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const lessonDate =
    dateFormatter.format(startDate);

  const startTime =
    timeFormatter.format(startDate);

  const durationMinutes = Math.round(
    (endDate.getTime() -
      startDate.getTime()) /
      60000
  );

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          marginBottom: "8px",
        }}
      >
        {session.lesson_number}회차 수업정보 수정
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {studentName} 학생 ·{" "}
        {course?.name || "과정 정보 없음"} ·{" "}
        {teacherName}
      </p>

      <EditLessonForm
        enrollmentId={enrollment.id}
        session={{
          id: session.id,
          lessonNumber:
            session.lesson_number,
          lessonDate,
          startTime,
          durationMinutes,
          status: session.status,
          meetingProvider:
            session.meeting_provider,
          meetingUrl:
            session.meeting_url,
          teacherNotes:
            session.teacher_notes,
        }}
      />
    </main>
  );
}