import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EnrollmentRequestActions from "./EnrollmentRequestActions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EnrollmentRequestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const requestId = Number(id);

  if (!Number.isInteger(requestId)) {
    notFound();
  }

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

  const [
    requestResult,
    teachersResult,
  ] = await Promise.all([
    supabase
      .from("enrollment_requests")
      .select(`
        id,
        status,
        child_id,
        course_id,
        lesson_duration_minutes,
        lessons_per_week,
        preferred_days,
        preferred_times,
        start_date,
        end_date,
        total_lessons,
        estimated_price,
        assigned_teacher_user_id,
        assigned_curriculum,
        admin_note,
        children (
          id,
          name,
          grade,
          school_name
        ),
        courses (
          id,
          name
        ),
        enrollment_options (
          id,
          title
        )
      `)
      .eq("id", requestId)
      .single(),

    supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  if (
    requestResult.error ||
    !requestResult.data
  ) {
    notFound();
  }

  if (teachersResult.error) {
    throw new Error(
      teachersResult.error.message
    );
  }

  const requestData =
    requestResult.data;

  const child = Array.isArray(
    requestData.children
  )
    ? requestData.children[0]
    : requestData.children;

  const course = Array.isArray(
    requestData.courses
  )
    ? requestData.courses[0]
    : requestData.courses;

  const option = Array.isArray(
    requestData.enrollment_options
  )
    ? requestData.enrollment_options[0]
    : requestData.enrollment_options;

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <Link
        href="/admin/enrollment-requests"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "13px",
          opacity: 0.65,
        }}
      >
        ← 수강신청 관리
      </Link>

      <h1
        style={{
          margin: "14px 0 0",
          fontSize: "32px",
        }}
      >
        수강신청 상세
      </h1>

      <section
        style={{
          marginTop: "26px",
          padding: "24px",
          border:
            "1px solid rgba(255,255,255,0.15)",
          borderRadius: "14px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {child?.name ?? "학생"}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: "16px",
          }}
        >
          <Info
            label="학년"
            value={child?.grade ?? "-"}
          />

          <Info
            label="학교"
            value={child?.school_name ?? "-"}
          />

          <Info
            label="신청 일정"
            value={option?.title ?? "-"}
          />

          <Info
            label="과정"
            value={course?.name ?? "-"}
          />

          <Info
            label="수업"
            value={`${requestData.lesson_duration_minutes}분 · 주 ${requestData.lessons_per_week}회`}
          />

          <Info
            label="기간"
            value={`${requestData.start_date} ~ ${requestData.end_date ?? "-"}`}
          />

          <Info
            label="총 회차"
            value={`${requestData.total_lessons}회`}
          />

          <Info
            label="예상 수강료"
            value={`${Number(
              requestData.estimated_price ?? 0
            ).toLocaleString("ko-KR")}원`}
          />
        </div>
      </section>

      <EnrollmentRequestActions
        requestId={requestData.id}
        status={requestData.status}
        teachers={teachersResult.data ?? []}
        initialTeacherUserId={
          requestData.assigned_teacher_user_id ??
          ""
        }
        initialCurriculum={
          requestData.assigned_curriculum ??
          ""
        }
        initialAdminNote={
          requestData.admin_note ??
          ""
        }
      />
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          opacity: 0.45,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}