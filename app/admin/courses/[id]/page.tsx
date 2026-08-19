import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminCourseDetailPage({
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
      is_active,
      created_at,
      updated_at
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
      <Link
        href="/admin/courses"
        style={{
          textDecoration: "none",
        }}
      >
        ← 과정 목록
      </Link>

      <div
        style={{
          marginTop: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
        }}
      >
        <div>
          <h1
            style={{
              marginTop: 0,
              marginBottom: "8px",
            }}
          >
            {course.name}
          </h1>

          <p style={{ margin: 0 }}>
            TALKLY 수업 과정 상세정보
          </p>
        </div>

        <Link
          href={`/admin/courses/${course.id}/edit`}
          style={{
            padding: "12px 18px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          과정 수정
        </Link>
      </div>

      <div
        style={{
          marginTop: "32px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          과정 기본정보
        </h2>

        <p>
          <strong>과정명:</strong> {course.name}
        </p>

        <p>
          <strong>과정 유형:</strong>{" "}
          {course.course_type}
        </p>

        <p>
          <strong>1회 수업시간:</strong>{" "}
          {course.duration_minutes}분
        </p>

        <p>
          <strong>주당 수업 횟수:</strong>{" "}
          {course.lessons_per_week ?? "-"}회
        </p>

        <p>
          <strong>기본 수강기간:</strong>{" "}
          {course.duration_weeks ?? "-"}주
        </p>

        <p>
          <strong>총 수업 횟수:</strong>{" "}
          {course.total_lessons ?? "-"}회
        </p>

        <p>
          <strong>기본 수강료:</strong>{" "}
          {course.price != null
            ? `${course.price.toLocaleString()}원`
            : "-"}
        </p>

        <p>
          <strong>운영상태:</strong>{" "}
          {course.is_active ? "활성" : "비활성"}
        </p>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          과정 설명
        </h2>

        <p
          style={{
            whiteSpace: "pre-wrap",
            marginBottom: 0,
          }}
        >
          {course.description || "등록된 과정 설명이 없습니다."}
        </p>
      </div>
    </main>
  );
}