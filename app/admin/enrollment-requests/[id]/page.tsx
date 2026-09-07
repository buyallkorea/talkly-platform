import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

import AssignmentManager from "./AssignmentManager";

type PageProps = {
  params: Promise<{
    id: string;
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
  preferred_times:
    | Record<string, string>
    | null;
  teacher_preference_type: string | null;
  preferred_teacher_user_id: string | null;
  start_date: string | null;
  assigned_teacher_user_id: string | null;
  assigned_days: string[] | null;
  assigned_times:
    | Record<string, string>
    | null;
  assigned_lesson_duration_minutes: number | null;
  assigned_lessons_per_week: number | null;
  assigned_at: string | null;
  assignment_confirmed_at: string | null;
  admin_note: string | null;
  created_at: string;
};

type TeacherSummary = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
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
  times:
    | Record<string, string>
    | null
) {
  return (
    days ??
    []
  )
    .map(
      (day) =>
        `${
          DAY_LABELS[day] ??
          day
        } ${
          times?.[day] ??
          "-"
        }`
    )
    .join(" · ");
}

export default async function AdminEnrollmentRequestDetailPage({
  params,
}: PageProps) {
  const { id } =
    await params;

  const requestId =
    Number(id);

  if (
    !Number.isInteger(
      requestId
    ) ||
    requestId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const adminClient =
    createAdminClient();

  const {
    data: requestData,
    error: requestError,
  } = await adminClient
    .from(
      "enrollment_requests"
    )
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
      admin_note,
      created_at
    `)
    .eq(
      "id",
      requestId
    )
    .maybeSingle();

  if (
    requestError ||
    !requestData
  ) {
    notFound();
  }

  const enrollmentRequest =
    requestData as EnrollmentRequestRow;

  if (
    enrollmentRequest.request_type !==
    "custom"
  ) {
    notFound();
  }

  const [
    childResult,
    courseResult,
    teachersResult,
  ] =
    await Promise.all([
      adminClient
        .from("children")
        .select(`
          id,
          name,
          grade,
          school_name
        `)
        .eq(
          "id",
          enrollmentRequest.child_id
        )
        .maybeSingle(),

      adminClient
        .from("courses")
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          enrollmentRequest.course_id
        )
        .maybeSingle(),

      adminClient
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          display_name,
          nationality
        `)
        .eq(
          "is_active",
          true
        )
        .order(
          "display_name",
          {
            ascending:
              true,
            nullsFirst:
              false,
          }
        ),
    ]);

  const child =
    childResult.data;

  const course =
    courseResult.data;

  const teachers =
    (
      teachersResult.data ??
      []
    ) as TeacherSummary[];

  const preferredTeacher =
    enrollmentRequest.preferred_teacher_user_id
      ? teachers.find(
          (teacher) =>
            teacher.user_id ===
            enrollmentRequest.preferred_teacher_user_id
        ) ??
        null
      : null;

  const assignedTeacher =
    enrollmentRequest.assigned_teacher_user_id
      ? teachers.find(
          (teacher) =>
            teacher.user_id ===
            enrollmentRequest.assigned_teacher_user_id
        ) ??
        null
      : null;

  return (
    <main
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding:
          "36px 20px 70px",
      }}
    >
      <Link
        href="/admin/enrollment-requests"
        style={{
          color:
            "var(--talkly-blue)",
          textDecoration:
            "none",
          fontWeight: 800,
        }}
      >
        ← 맞춤 수강신청 목록
      </Link>

      <div
        style={{
          marginTop: "18px",
        }}
      >
        <div className="talkly-section-label">
          REQUEST #
          {enrollmentRequest.id}
        </div>

        <h1
          style={{
            margin:
              "7px 0 0",
            color:
              "var(--talkly-navy)",
            fontSize: "32px",
          }}
        >
          수강신청 배정
        </h1>

        <p
          style={{
            margin:
              "10px 0 0",
            color:
              "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          학부모 희망조건과 현재
          강사 가용성을 다시
          확인한 뒤 실제 수업
          강사를 확정합니다.
        </p>
      </div>

      <section
        className="talkly-card"
        style={{
          marginTop: "24px",
          padding: "26px",
        }}
      >
        <div className="talkly-section-label">
          REQUESTED
          CONDITIONS
        </div>

        <h2
          style={{
            margin:
              "7px 0 0",
            color: "#101828",
            fontSize: "23px",
          }}
        >
          {child?.name ??
            `자녀 ${enrollmentRequest.child_id}`}
          {" · "}
          {course?.name ??
            `과정 ${enrollmentRequest.course_id}`}
        </h2>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <InfoBox
            label="최종 레벨"
            value={
              enrollmentRequest.final_level_snapshot ??
              "-"
            }
          />

          <InfoBox
            label="수업"
            value={`${enrollmentRequest.lesson_duration_minutes ?? "-"}분 · 주 ${enrollmentRequest.lessons_per_week ?? "-"}회`}
          />

          <InfoBox
            label="희망일정"
            value={
              scheduleText(
                enrollmentRequest.preferred_days,
                enrollmentRequest.preferred_times
              ) ||
              "-"
            }
          />

          <InfoBox
            label="시작 기준일"
            value={
              enrollmentRequest.start_date ??
              "-"
            }
          />

          <InfoBox
            label="강사 선호"
            value={
              enrollmentRequest.teacher_preference_type ===
              "specific"
                ? preferredTeacher?.display_name ??
                  "특정 강사"
                : "가능한 강사 중 배정"
            }
          />

          <InfoBox
            label="현재 상태"
            value={
              enrollmentRequest.assigned_teacher_user_id
                ? "배정 완료"
                : "배정 대기"
            }
          />
        </div>
      </section>

      {assignedTeacher && (
        <section
          style={{
            marginTop: "20px",
            padding: "20px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "14px",
            background:
              "#ecfdf3",
          }}
        >
          <div
            style={{
              color: "#067647",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            CURRENT
            ASSIGNMENT
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#065f46",
              fontSize: "18px",
              fontWeight: 900,
            }}
          >
            {
              assignedTeacher.display_name
            }
            {assignedTeacher.nationality
              ? ` · ${assignedTeacher.nationality}`
              : ""}
          </div>

          <div
            style={{
              marginTop: "7px",
              color: "#047857",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            {scheduleText(
              enrollmentRequest.assigned_days,
              enrollmentRequest.assigned_times
            )}{" "}
            ·{" "}
            {
              enrollmentRequest.assigned_lesson_duration_minutes
            }
            분 · 주{" "}
            {
              enrollmentRequest.assigned_lessons_per_week
            }
            회
          </div>
        </section>
      )}

      <AssignmentManager
        requestId={
          enrollmentRequest.id
        }
        preferredDays={
          enrollmentRequest.preferred_days ??
          []
        }
        preferredTimes={
          enrollmentRequest.preferred_times ??
          {}
        }
        startDate={
          enrollmentRequest.start_date
        }
        lessonDurationMinutes={
          enrollmentRequest.lesson_duration_minutes ??
          25
        }
        lessonsPerWeek={
          enrollmentRequest.lessons_per_week ??
          1
        }
        teacherPreferenceType={
          enrollmentRequest.teacher_preference_type ??
          "any"
        }
        preferredTeacherUserId={
          enrollmentRequest.preferred_teacher_user_id
        }
        teachers={
          teachers
        }
        currentAssignedTeacherUserId={
          enrollmentRequest.assigned_teacher_user_id
        }
        currentAssignedDays={
          enrollmentRequest.assigned_days
        }
        currentAssignedTimes={
          enrollmentRequest.assigned_times
        }
      />
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
        padding:
          "15px 16px",
        border:
          "1px solid #eaecf0",
        borderRadius:
          "11px",
        background:
          "#fcfcfd",
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