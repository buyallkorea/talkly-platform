import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{ id: string }>;
};

type EnrollmentRequestRow = {
  id: number;
  child_id: number;
  course_id: number;
  request_type: string;
  status: string;
  lesson_duration_minutes: number | null;
  lessons_per_week: number | null;
  preferred_days: string[] | null;
  preferred_times: Record<string, string> | null;
  assigned_teacher_user_id: string | null;
  assigned_days: string[] | null;
  assigned_times: Record<string, string> | null;
  assigned_lesson_duration_minutes: number | null;
  assigned_lessons_per_week: number | null;
  assigned_at: string | null;
  assignment_confirmed_at: string | null;
  created_at: string;
};

const DAY_LABELS: Record<string, string> = {
  Sunday: "일",
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
};

function getStatusInfo(request: EnrollmentRequestRow) {
  const assigned = Boolean(
    request.assigned_teacher_user_id &&
      request.assignment_confirmed_at
  );

  if (assigned) {
    return {
      label: "강사 · 일정 배정 완료",
      background: "#ecfdf3",
      color: "#067647",
    };
  }

  if (request.status === "pending") {
    return {
      label: "배정 대기",
      background: "#fffaeb",
      color: "#93370d",
    };
  }

  if (request.status === "cancelled") {
    return {
      label: "취소",
      background: "#f2f4f7",
      color: "#667085",
    };
  }

  return {
    label: request.status,
    background: "#eff8ff",
    color: "#175cd3",
  };
}

function scheduleText(
  days: string[] | null,
  times: Record<string, string> | null
) {
  return (days ?? [])
    .map((day) => `${DAY_LABELS[day] ?? day} ${times?.[day] ?? "-"}`)
    .join(" · ");
}

export default async function ParentEnrollmentRequestsPage({
  params,
}: PageProps) {
  const { id } = await params;
  const childId = Number(id);

  if (!Number.isInteger(childId) || childId <= 0) {
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
    .maybeSingle();

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  const { data: child, error: childError } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name
    `)
    .eq("id", childId)
    .eq("parent_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (childError || !child) {
    notFound();
  }

  const adminClient = createAdminClient();

  const { data: requestsData, error: requestsError } = await adminClient
    .from("enrollment_requests")
    .select(`
      id,
      child_id,
      course_id,
      request_type,
      status,
      lesson_duration_minutes,
      lessons_per_week,
      preferred_days,
      preferred_times,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assigned_at,
      assignment_confirmed_at,
      created_at
    `)
    .eq("applicant_user_id", user.id)
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw new Error(
      `수강신청 현황을 불러오지 못했습니다: ${requestsError.message}`
    );
  }

  const requests = (requestsData ?? []) as EnrollmentRequestRow[];

  const courseIds = Array.from(
    new Set(requests.map((request) => request.course_id))
  );

  const teacherIds = Array.from(
    new Set(
      requests
        .map((request) => request.assigned_teacher_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const [coursesResult, teachersResult] = await Promise.all([
    courseIds.length > 0
      ? adminClient
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),

    teacherIds.length > 0
      ? adminClient
          .from("teacher_profiles")
          .select("user_id, display_name, nationality")
          .in("user_id", teacherIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const courseMap = new Map(
    (coursesResult.data ?? []).map(
      (course: { id: number; name: string }) => [course.id, course.name]
    )
  );

  const teacherMap = new Map(
    (teachersResult.data ?? []).map(
      (teacher: {
        user_id: string;
        display_name: string | null;
        nationality: string | null;
      }) => [
        teacher.user_id,
        {
          name: teacher.display_name ?? "Teacher",
          nationality: teacher.nationality,
        },
      ]
    )
  );

  return (
    <main
      style={{
        maxWidth: "1060px",
        margin: "0 auto",
        padding: "40px 20px 80px",
      }}
    >
      <Link
        href={`/parent/children/${child.id}`}
        style={{
          color: "var(--talkly-blue)",
          textDecoration: "none",
          fontWeight: 800,
        }}
      >
        ← 자녀 상세
      </Link>

      <div style={{ marginTop: "18px" }}>
        <div className="talkly-section-label">ENROLLMENT REQUESTS</div>

        <h1
          style={{
            margin: "7px 0 0",
            color: "var(--talkly-navy)",
            fontSize: "32px",
          }}
        >
          {child.name} 학생 수강신청 현황
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          신청한 수업의 처리 상태와 관리자 배정 결과를 확인할 수 있습니다.
        </p>
      </div>

      <section
        className="talkly-card"
        style={{
          marginTop: "24px",
          padding: "24px",
        }}
      >
        {requests.length === 0 ? (
          <div
            style={{
              padding: "34px 10px",
              color: "#667085",
              textAlign: "center",
              lineHeight: 1.8,
            }}
          >
            아직 접수된 수강신청이 없습니다.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {requests.map((request) => {
              const status = getStatusInfo(request);

              const assignedTeacher = request.assigned_teacher_user_id
                ? teacherMap.get(request.assigned_teacher_user_id)
                : null;

              const assigned = Boolean(
                request.assigned_teacher_user_id &&
                  request.assignment_confirmed_at
              );

              return (
                <Link
                  key={request.id}
                  href={`/parent/children/${child.id}/enrollment-requests/${request.id}`}
                  style={{
                    display: "block",
                    padding: "20px",
                    border: "1px solid #e4e7ec",
                    borderRadius: "13px",
                    background: "#ffffff",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#101828",
                          fontSize: "18px",
                          fontWeight: 900,
                        }}
                      >
                        {courseMap.get(request.course_id) ??
                          `과정 ${request.course_id}`}
                      </div>

                      <div
                        style={{
                          marginTop: "7px",
                          color: "#667085",
                          fontSize: "12px",
                          lineHeight: 1.8,
                        }}
                      >
                        신청 #{request.id} · {request.lesson_duration_minutes}분 ·
                        주 {request.lessons_per_week}회
                      </div>
                    </div>

                    <span
                      style={{
                        minHeight: "30px",
                        padding: "0 11px",
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "999px",
                        background: status.background,
                        color: status.color,
                        fontSize: "11px",
                        fontWeight: 900,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px 15px",
                      borderRadius: "10px",
                      background: assigned ? "#f8fbff" : "#fcfcfd",
                      color: "#475467",
                      fontSize: "12px",
                      lineHeight: 1.8,
                    }}
                  >
                    {assigned ? (
                      <>
                        <strong>배정 결과</strong>
                        <br />
                        강사: {assignedTeacher?.name ?? "배정 강사"}
                        {assignedTeacher?.nationality
                          ? ` · ${assignedTeacher.nationality}`
                          : ""}
                        <br />
                        일정:{" "}
                        {scheduleText(
                          request.assigned_days,
                          request.assigned_times
                        ) || "-"}
                        <br />
                        수업: {request.assigned_lesson_duration_minutes}분 · 주{" "}
                        {request.assigned_lessons_per_week}회
                      </>
                    ) : (
                      <>
                        <strong>신청 조건</strong>
                        <br />
                        일정:{" "}
                        {scheduleText(
                          request.preferred_days,
                          request.preferred_times
                        ) || "-"}
                        <br />
                        TALKLY에서 실제 강사와 일정을 확인 중입니다.
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      color: "#175cd3",
                      fontSize: "12px",
                      fontWeight: 900,
                    }}
                  >
                    상세보기 →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ marginTop: "20px" }}>
        <Link
          href={`/parent/children/${child.id}/enrollment`}
          style={{
            display: "inline-flex",
            minHeight: "44px",
            padding: "0 16px",
            alignItems: "center",
            border: "1px solid #b2ccff",
            borderRadius: "10px",
            background: "#eff8ff",
            color: "#175cd3",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          새 수강신청
        </Link>
      </div>
    </main>
  );
}