import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditEnrollmentForm from "./EditEnrollmentForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditEnrollmentPage({
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

  // 수강정보 조회
  const { data: enrollment, error } = await supabase
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

  if (error) {
    throw new Error(error.message);
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

    studentName = student?.name || "성인 학생";
  }

  // 과정
  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  // 활성 강사 목록
  const { data: teachers, error: teacherError } =
    await supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .eq("is_active", true)
      .order("display_name");

  if (teacherError) {
    throw new Error(teacherError.message);
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
        수강정보 수정
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {studentName} 학생의 수강정보와 담당 강사를
        관리합니다.
      </p>

      <EditEnrollmentForm
        enrollment={enrollment}
        studentName={studentName}
        courseName={
          course?.name ||
          `과정 #${enrollment.course_id}`
        }
        teachers={teachers ?? []}
      />
    </main>
  );
}