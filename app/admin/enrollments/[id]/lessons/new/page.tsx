import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LessonScheduleForm from "./LessonScheduleForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NewLessonSchedulePage({
  params,
}: PageProps) {
  const { id } = await params;

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

  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons
      `)
      .eq("id", Number(id))
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

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

    studentName = student?.name || "성인 학생";
  }

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select(`
        id,
        name,
        duration_minutes
      `)
      .eq("id", enrollment.course_id)
      .maybeSingle();

  if (courseError) {
    throw new Error(courseError.message);
  }

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

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: "8px" }}>
        수업 일정 생성
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {studentName} 학생의 정규 수업 일정을 생성합니다.
      </p>

      <div
        style={{
          marginBottom: "32px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <p>
          <strong>학생:</strong> {studentName}
        </p>

        <p>
          <strong>과정:</strong>{" "}
          {course?.name || `과정 #${enrollment.course_id}`}
        </p>

        <p>
          <strong>담당 강사:</strong> {teacherName}
        </p>

        <p>
          <strong>1회 수업시간:</strong>{" "}
          {course?.duration_minutes ?? 25}분
        </p>

        <p>
          <strong>주당 수업 횟수:</strong>{" "}
          {enrollment.lessons_per_week ?? "-"}회
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>총 수업 횟수:</strong>{" "}
          {enrollment.total_lessons ?? "-"}회
        </p>
      </div>

      <LessonScheduleForm
        enrollmentId={enrollment.id}
        teacherUserId={enrollment.teacher_user_id}
        startDate={enrollment.start_date}
        lessonsPerWeek={
          enrollment.lessons_per_week ?? 2
        }
        totalLessons={
          enrollment.total_lessons ?? 0
        }
        durationMinutes={
          course?.duration_minutes ?? 25
        }
      />
    </main>
  );
}