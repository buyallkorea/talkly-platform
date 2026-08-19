import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminCoursesPage() {
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

  const { data: courses, error } = await supabase
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
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "8px" }}>
            과정 관리
          </h1>

          <p style={{ margin: 0 }}>
            TALKLY의 수업 과정과 기본 수강조건을 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/courses/new"
          style={{
            padding: "12px 18px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          + 과정 등록
        </Link>
      </div>

      {!courses || courses.length === 0 ? (
        <div
          style={{
            padding: "40px",
            border: "1px solid #ddd",
            borderRadius: "12px",
          }}
        >
          아직 등록된 과정이 없습니다.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "18px",
          }}
        >
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                padding: "24px",
                border: "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "20px",
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0 }}>
                    {course.name}
                  </h2>

                  <p>
                    <strong>유형:</strong>{" "}
                    {course.course_type}
                  </p>

                  <p>
                    <strong>수업시간:</strong>{" "}
                    {course.duration_minutes}분
                  </p>

                  <p>
                    <strong>주당 수업:</strong>{" "}
                    {course.lessons_per_week ?? "-"}회
                  </p>

                  <p>
                    <strong>총 수업:</strong>{" "}
                    {course.total_lessons ?? "-"}회
                  </p>

                  <p>
                    <strong>수강기간:</strong>{" "}
                    {course.duration_weeks ?? "-"}주
                  </p>

                  <p>
                    <strong>수강료:</strong>{" "}
                    {course.price != null
                      ? `${course.price.toLocaleString()}원`
                      : "-"}
                  </p>

                  <p style={{ marginBottom: 0 }}>
                    <strong>상태:</strong>{" "}
                    {course.is_active ? "활성" : "비활성"}
                  </p>
                </div>

                <Link
                  href={`/admin/courses/${course.id}`}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  상세보기
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}