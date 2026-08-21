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

  if (
    !Number.isInteger(requestId) ||
    requestId <= 0
  ) {
    notFound();
  }

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
      .maybeSingle(),

    supabase
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name
      `)
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

  /*
   * 승인된 신청이라면 이 신청으로 생성된
   * 실제 수강정보를 찾습니다.
   */
  let enrollmentId: number | null = null;

  if (
    requestData.status === "approved" &&
    requestData.child_id &&
    requestData.course_id &&
    requestData.start_date &&
    requestData.end_date
  ) {
    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id")
      .eq(
        "child_id",
        requestData.child_id
      )
      .eq(
        "course_id",
        requestData.course_id
      )
      .eq(
        "start_date",
        requestData.start_date
      )
      .eq(
        "end_date",
        requestData.end_date
      )
      .in("status", [
        "active",
        "pending",
        "completed",
        "paused",
      ])
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (!enrollmentError && enrollment) {
      enrollmentId = enrollment.id;
    }
  }

  const statusLabel =
    requestData.status === "approved"
      ? "승인 완료"
      : requestData.status === "rejected"
        ? "반려"
        : "승인 대기";

  const statusColor =
    requestData.status === "approved"
      ? "#138a4b"
      : requestData.status === "rejected"
        ? "#c0392b"
        : "#2f6fed";

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <Link
        href="/admin/enrollment-requests"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.65,
        }}
      >
        ← 수강신청 관리
      </Link>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              letterSpacing: "-0.03em",
            }}
          >
            수강신청 상세
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.6,
              lineHeight: 1.7,
            }}
          >
            신청 내용과 승인 처리 결과를
            확인합니다.
          </p>
        </div>

        <div
          style={{
            padding: "9px 14px",
            borderRadius: "999px",
            background: `${statusColor}18`,
            color: statusColor,
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          {statusLabel}
        </div>
      </div>

      <section
        style={{
          marginTop: "30px",
          padding: "28px",
          background: "#ffffff",
          border:
            "1px solid rgba(15,35,65,.10)",
          borderRadius: "16px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
          }}
        >
          {child?.name ?? "학생"}
        </h2>

        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: "24px",
          }}
        >
          <Info
            label="학년"
            value={child?.grade ?? "-"}
          />

          <Info
            label="학교"
            value={
              child?.school_name ?? "-"
            }
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
            value={`${requestData.start_date} ~ ${
              requestData.end_date ?? "-"
            }`}
          />

          <Info
            label="총 회차"
            value={`${requestData.total_lessons}회`}
          />

          <Info
            label="예상 수강료"
            value={`${Number(
              requestData.estimated_price ?? 0
            ).toLocaleString(
              "ko-KR"
            )}원`}
          />
        </div>
      </section>

      <EnrollmentRequestActions
        requestId={requestData.id}
        status={requestData.status}
        teachers={
          teachersResult.data ?? []
        }
        initialTeacherUserId={
          requestData.assigned_teacher_user_id ??
          ""
        }
        initialCurriculum={
          requestData.assigned_curriculum ??
          ""
        }
        initialAdminNote={
          requestData.admin_note ?? ""
        }
        enrollmentId={enrollmentId}
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
          fontSize: "12px",
          color: "#7b8493",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "16px",
          fontWeight: 800,
          color: "#101828",
        }}
      >
        {value}
      </div>
    </div>
  );
}