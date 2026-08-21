import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import CourseListClient from "./CourseListClient";

export default async function AdminCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const {
    data: courses,
    error,
  } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      description,
      course_type,
      target_group,
      subject_category,
      level,
      class_format,
      duration_minutes,
      lessons_per_week,
      total_lessons,
      duration_weeks,
      price,
      is_active,
      created_at
    `)
    .order("is_active", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const totalCount =
    courses?.length ?? 0;

  const activeCount =
    courses?.filter(
      (course) =>
        course.is_active
    ).length ?? 0;

  const inactiveCount =
    totalCount - activeCount;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
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
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            COURSE MANAGEMENT
          </div>

          <h1
            style={{
              margin: "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
            }}
          >
            과정 관리
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            TALKLY의 교육 과정과 수강 조건을
            등록하고 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/courses/new"
          style={{
            minHeight: "46px",
            padding: "0 18px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "#0A1F44",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          + 새 과정 등록
        </Link>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 과정"
          value={totalCount}
        />

        <SummaryCard
          label="활성 과정"
          value={activeCount}
        />

        <SummaryCard
          label="비활성 과정"
          value={inactiveCount}
        />
      </section>

      <CourseListClient
        courses={courses ?? []}
      />
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        minHeight: "102px",
        padding: "18px 20px",
        border: "1px solid #e4e7ec",
        borderRadius: "13px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#101828",
          fontSize: "29px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}