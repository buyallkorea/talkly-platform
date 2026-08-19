import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditCourseForm from "./EditCourseForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCoursePage({
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

  const { data: course, error } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      description,
      course_type,
      duration_minutes,
      lessons_per_week,
      total_lessons,
      duration_weeks,
      price,
      is_active
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!course) {
    notFound();
  }

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
        과정 수정
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {course.name} 과정의 기본 정보를 수정합니다.
      </p>

      <EditCourseForm course={course} />
    </main>
  );
}