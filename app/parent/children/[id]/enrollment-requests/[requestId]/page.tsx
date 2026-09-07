import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    id: string;
    requestId: string;
  }>;
};

type EnrollmentRequestRow = {
  id: number;
  applicant_user_id: string;
  child_id: number;
  course_id: number;
  level_test_id: number | null;
  recommended_course_id: number | null;
  final_level_snapshot: string | null;
  request_type: string;
  status: string;
  lesson_duration_minutes: number | null;
  lessons_per_week: number | null;
  preferred_days: string[] | null;
  preferred_times: Record<string, string> | null;
  teacher_preference_type: string | null;
  preferred_teacher_user_id: string | null;
  start_date: string | null;
  assigned_teacher_user_id: string | null;
  assigned_days: string[] | null;
  assigned_times: Record<string, string> | null;
  assigned_lesson_duration_minutes: number | null;
  assigned_lessons_per_week: number | null;
  assigned_at: string | null;
  assignment_confirmed_at: string | null;
  duration_months: number | null;
  monthly_lesson_count: number | null;
  regular_price: number | null;
  discount_rate: number | null;
  discount_amount: number | null;
  final_price: number | null;
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

function scheduleText(
  days: string[] | null,
  times: Record<string, string> | null
) {
  return (days ?? [])
    .map((day) => `${DAY_LABELS[day] ?? day} ${times?.[day] ?? "-"}`)
    .join(" · ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ParentEnrollmentRequestDetailPage({
  params,
}: PageProps) {
  const { id, requestId: requestIdText } = await params;

  const childId = Number(id);
  const requestId = Number(requestIdText);

  if (
    !Number.isInteger(childId) ||
    childId <= 0 ||
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

  const { data: requestData, error: requestError } = await adminClient
    .from("enrollment_requests")
    .select(`
      id,
      applicant_user_id,
      child_id,
      course_id,
      level_test_id,
      recommended_course_id,
      final_level_snapshot,
      request_type,
      status,
      lesson_duration_minutes,
      lessons_per_week,
      preferred_days,
      preferred_times,
      teacher_preference_type,
      preferred_teacher_user_id,
      start_date,
      assigned_teacher_user_id,
      assigned_days,
      assigned_times,
      assigned_lesson_duration_minutes,
      assigned_lessons_per_week,
      assigned_at,
      assignment_confirmed_at,
      duration_months,
      monthly_lesson_count,
      regular_price,
      discount_rate,
      discount_amount,
      final_price,
      created_at
    `)
    .eq("id", requestId)
    .eq("applicant_user_id", user.id)
    .eq("child_id", childId)
    .maybeSingle();

  if (requestError || !requestData) {
    notFound();
  }

  const enrollmentRequest = requestData as EnrollmentRequestRow;

  const [courseResult, teacherResult] = await Promise.all([
    adminClient
      .from("courses")
      .select(`
        id,
        name
      `)
      .eq("id", enrollmentRequest.course_id)
      .maybeSingle(),

    enrollmentRequest.assigned_teacher_user_id
      ? adminClient
          .from("teacher_profiles")
          .select(`
            user_id,
            display_name,
            nationality
          `)
          .eq("user_id", enrollmentRequest.assigned_teacher_user_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  const course = courseResult.data;
  const teacher = teacherResult.data;

  const assigned = Boolean(
    enrollmentRequest.assigned_teacher_user_id &&
      enrollmentRequest.assignment_confirmed_at
  );

  const pricingSelected = Boolean(
    enrollmentRequest.duration_months &&
      enrollmentRequest.final_price !== null
  );

  return (
    <main
      style={{
        maxWidth: "980px",
        margin: "0 auto",
        padding: "40px 20px 80px",
      }}
    >
      <Link
        href={`/parent/children/${child.id}/enrollment-requests`}
        style={{
          color: "var(--talkly-blue)",
          textDecoration: "none",
          fontWeight: 800,
        }}
      >
        ← 수강신청 현황
      </Link>

      <div style={{ marginTop: "18px" }}>
        <div className="talkly-section-label">ENROLLMENT REQUEST</div>

        <h1
          style={{
            margin: "7px 0 0",
            color: "var(--talkly-navy)",
            fontSize: "32px",
          }}
        >
          {child.name} 학생 수강신청 상세
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          신청 조건과 TALKLY의 강사·일정 배정 결과를 확인할 수 있습니다.
        </p>
      </div>

      <section
        className="talkly-card"
        style={{
          marginTop: "24px",
          padding: "26px",
        }}
      >
        <div className="talkly-section-label">REQUEST</div>

        <h2
          style={{
            margin: "7px 0 0",
            color: "#101828",
            fontSize: "24px",
          }}
        >
          {course?.name ?? `과정 ${enrollmentRequest.course_id}`}
        </h2>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <InfoBox label="신청번호" value={`#${enrollmentRequest.id}`} />

          <InfoBox
            label="최종 레벨"
            value={enrollmentRequest.final_level_snapshot ?? "-"}
          />

          <InfoBox
            label="신청 수업"
            value={`${enrollmentRequest.lesson_duration_minutes ?? "-"}분 · 주 ${
              enrollmentRequest.lessons_per_week ?? "-"
            }회`}
          />

          <InfoBox
            label="희망 일정"
            value={
              scheduleText(
                enrollmentRequest.preferred_days,
                enrollmentRequest.preferred_times
              ) || "-"
            }
          />

          <InfoBox
            label="수강 시작 기준일"
            value={enrollmentRequest.start_date ?? "-"}
          />

          <InfoBox
            label="접수일"
            value={formatDate(enrollmentRequest.created_at)}
          />
        </div>
      </section>

      {!assigned ? (
        <section
          style={{
            marginTop: "20px",
            padding: "22px 24px",
            border: "1px solid #fedf89",
            borderRadius: "14px",
            background: "#fffaeb",
          }}
        >
          <div
            style={{
              color: "#93370d",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            ASSIGNMENT PENDING
          </div>

          <div
            style={{
              marginTop: "7px",
              color: "#7a2e0e",
              fontSize: "20px",
              fontWeight: 900,
            }}
          >
            강사와 수업 일정을 확인하고 있습니다.
          </div>

          <p
            style={{
              margin: "8px 0 0",
              color: "#93370d",
              fontSize: "13px",
              lineHeight: 1.8,
            }}
          >
            TALKLY에서 실제 강사 근무시간과 기존 수업 일정을 확인한 뒤
            배정 결과를 안내합니다.
          </p>
        </section>
      ) : (
        <>
          <section
            style={{
              marginTop: "20px",
              padding: "24px",
              border: "1px solid #abefc6",
              borderRadius: "14px",
              background: "#ecfdf3",
            }}
          >
            <div
              style={{
                color: "#067647",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              ASSIGNMENT COMPLETE
            </div>

            <h2
              style={{
                margin: "7px 0 0",
                color: "#065f46",
                fontSize: "24px",
              }}
            >
              강사와 수업 일정이 배정되었습니다.
            </h2>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <InfoBox
                label="배정 강사"
                value={`${teacher?.display_name ?? "Teacher"}${
                  teacher?.nationality ? ` · ${teacher.nationality}` : ""
                }`}
              />

              <InfoBox
                label="확정 일정"
                value={
                  scheduleText(
                    enrollmentRequest.assigned_days,
                    enrollmentRequest.assigned_times
                  ) || "-"
                }
              />

              <InfoBox
                label="수업"
                value={`${
                  enrollmentRequest.assigned_lesson_duration_minutes ?? "-"
                }분 · 주 ${
                  enrollmentRequest.assigned_lessons_per_week ?? "-"
                }회`}
              />

              <InfoBox
                label="배정 확정일"
                value={formatDate(enrollmentRequest.assignment_confirmed_at)}
              />
            </div>
          </section>

          <section
            className="talkly-card"
            style={{
              marginTop: "20px",
              padding: "26px",
            }}
          >
            <div className="talkly-section-label">NEXT STEP</div>

            <h2
              style={{
                margin: "7px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "24px",
              }}
            >
              수강기간 선택
            </h2>

            <p
              style={{
                margin: "9px 0 0",
                color: "#667085",
                lineHeight: 1.75,
              }}
            >
              다음 단계에서 1개월·3개월·6개월·12개월 중 수강기간을
              선택하고, TALKLY의 실제 가격 및 할인정책을 적용한 최종
              수강료를 계산합니다.
            </p>

            {pricingSelected ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "18px",
                  border: "1px solid #dbe7ff",
                  borderRadius: "12px",
                  background: "#f8fbff",
                  color: "#344054",
                  lineHeight: 1.8,
                }}
              >
                이미 선택된 수강기간이 있습니다.
                <br />
                기간:{" "}
                <strong>{enrollmentRequest.duration_months}개월</strong>
                <br />
                최종금액:{" "}
                <strong>
                  {new Intl.NumberFormat("ko-KR").format(
                    Number(enrollmentRequest.final_price ?? 0)
                  )}
                  원
                </strong>
              </div>
            ) : (
              <div
                style={{
                  marginTop: "18px",
                  padding: "18px",
                  border: "1px dashed #b2ccff",
                  borderRadius: "12px",
                  background: "#f8fbff",
                  color: "#475467",
                  fontSize: "13px",
                  lineHeight: 1.8,
                }}
              >
                관리자 배정 결과까지 완료되었습니다. 다음 작업에서 DB의
                수강료·할인정책을 확인하여 기간 선택 기능을 연결합니다.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "15px 16px",
        border: "1px solid #eaecf0",
        borderRadius: "11px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#101828",
          fontSize: "13px",
          fontWeight: 900,
          lineHeight: 1.6,
        }}
      >
        {value}
      </div>
    </div>
  );
}