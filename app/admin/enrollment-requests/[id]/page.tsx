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

const DAY_LABELS: Record<
  string,
  string
> = {
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
  const values =
    (days ?? []).map(
      (day) =>
        `${
          DAY_LABELS[day] ??
          day
        } ${
          times?.[day] ??
          "-"
        }`
    );

  return values.length > 0
    ? values.join(" · ")
    : "-";
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

function getStatusInfo(
  request: EnrollmentRequestRow
) {
  if (
    request.status ===
      "cancelled" ||
    request.status ===
      "canceled"
  ) {
    return {
      label: "취소",
      color: "#b42318",
      background:
        "#fef3f2",
      border: "#fecdca",
    };
  }

  if (
    request.assigned_teacher_user_id
  ) {
    return {
      label: "배정 완료",
      color: "#067647",
      background:
        "#ecfdf3",
      border: "#abefc6",
    };
  }

  return {
    label: "배정 필요",
    color: "#93370d",
    background:
      "#fffaeb",
    border: "#fedf89",
  };
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
            ascending: true,
            nullsFirst: false,
          }
        ),
    ]);

  if (
    childResult.error
  ) {
    throw new Error(
      `학생 정보를 불러오지 못했습니다: ${childResult.error.message}`
    );
  }

  if (
    courseResult.error
  ) {
    throw new Error(
      `과정 정보를 불러오지 못했습니다: ${courseResult.error.message}`
    );
  }

  if (
    teachersResult.error
  ) {
    throw new Error(
      `강사 정보를 불러오지 못했습니다: ${teachersResult.error.message}`
    );
  }

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
        ) ?? null
      : null;

  const statusInfo =
    getStatusInfo(
      enrollmentRequest
    );

  const hasAssignment =
    Boolean(
      enrollmentRequest.assigned_teacher_user_id
    );

  const studentMeta = [
    child?.school_name,
    child?.grade,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding:
          "34px 20px 80px",
      }}
    >
      {/* ===============================================
          HEADER
      =============================================== */}

      <Link
        href="/admin/enrollment-requests"
        style={{
          display:
            "inline-flex",
          minHeight: "38px",
          padding: "0 13px",
          alignItems:
            "center",
          border:
            "1px solid #d0d5dd",
          borderRadius: "9px",
          background:
            "#ffffff",
          color: "#344054",
          textDecoration:
            "none",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        ← 수강 신청 관리
      </Link>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color:
                "var(--talkly-blue)",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.12em",
            }}
          >
            ENROLLMENT REQUEST #
            {enrollmentRequest.id}
          </div>

          <h1
            style={{
              margin:
                "7px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize: "32px",
              lineHeight: 1.25,
            }}
          >
            수강 신청 상세
          </h1>

          <p
            style={{
              margin:
                "9px 0 0",
              color:
                "var(--text-muted)",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            학부모가 제출한
            수업조건과 배정 상태를
            확인하고 실제 강사와
            수업 일정을 관리합니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            alignItems:
              "flex-end",
            gap: "7px",
          }}
        >
          <span
            style={{
              display:
                "inline-flex",
              minHeight: "34px",
              padding: "0 12px",
              alignItems:
                "center",
              border:
                `1px solid ${statusInfo.border}`,
              borderRadius:
                "999px",
              background:
                statusInfo.background,
              color:
                statusInfo.color,
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {statusInfo.label}
          </span>

          <span
            style={{
              color: "#98a2b3",
              fontSize: "10px",
            }}
          >
            신청{" "}
            {formatDateTime(
              enrollmentRequest.created_at
            )}
          </span>
        </div>
      </div>

      {/* ===============================================
          STUDENT / COURSE SUMMARY
      =============================================== */}

      <section
        style={{
          marginTop: "25px",
          padding: "24px",
          border:
            "1px solid #dbe6ff",
          borderRadius: "16px",
          background:
            "linear-gradient(135deg, #f8faff 0%, #ffffff 70%)",
          boxShadow:
            "0 8px 24px rgba(16,24,40,0.035)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: "20px",
            alignItems:
              "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color:
                  "#175cd3",
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
              }}
            >
              STUDENT & COURSE
            </div>

            <div
              style={{
                marginTop: "7px",
                color:
                  "#101828",
                fontSize: "23px",
                fontWeight: 900,
              }}
            >
              {child?.name ??
                `자녀 ${enrollmentRequest.child_id}`}
              {" · "}
              {course?.name ??
                `과정 ${enrollmentRequest.course_id}`}
            </div>

            {studentMeta && (
              <div
                style={{
                  marginTop:
                    "6px",
                  color:
                    "#667085",
                  fontSize:
                    "11px",
                }}
              >
                {studentMeta}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {enrollmentRequest.final_level_snapshot && (
              <HeaderBadge
                label="최종 레벨"
                value={
                  enrollmentRequest.final_level_snapshot
                }
              />
            )}

            <HeaderBadge
              label="신청번호"
              value={`#${enrollmentRequest.id}`}
            />
          </div>
        </div>
      </section>

      {/* ===============================================
          REQUESTED CONDITIONS
      =============================================== */}

      <section
        className="talkly-card"
        style={{
          marginTop: "18px",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="talkly-section-label">
              REQUESTED CONDITIONS
            </div>

            <h2
              style={{
                margin:
                  "6px 0 0",
                color: "#101828",
                fontSize: "20px",
              }}
            >
              학부모 신청 조건
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#667085",
                fontSize: "11px",
                lineHeight: 1.65,
              }}
            >
              실제 배정 시 참고하는
              학부모의 최초 희망조건입니다.
            </p>
          </div>

          {enrollmentRequest.level_test_id && (
            <Link
              href={`/admin/level-tests/${enrollmentRequest.level_test_id}`}
              style={{
                display:
                  "inline-flex",
                minHeight: "36px",
                padding:
                  "0 12px",
                alignItems:
                  "center",
                border:
                  "1px solid #b2ccff",
                borderRadius:
                  "8px",
                background:
                  "#f5f8ff",
                color: "#175cd3",
                textDecoration:
                  "none",
                fontSize: "10px",
                fontWeight: 900,
              }}
            >
              레벨테스트 #
              {enrollmentRequest.level_test_id} 보기
            </Link>
          )}
        </div>

        <div
          style={{
            marginTop: "19px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "10px",
          }}
        >
          <InfoBox
            label="수업 조건"
            value={`${enrollmentRequest.lesson_duration_minutes ?? "-"}분 · 주 ${enrollmentRequest.lessons_per_week ?? "-"}회`}
          />

          <InfoBox
            label="희망 일정"
            value={scheduleText(
              enrollmentRequest.preferred_days,
              enrollmentRequest.preferred_times
            )}
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
            subValue={
              enrollmentRequest.teacher_preference_type ===
              "specific"
                ? "학부모 지정 강사"
                : "강사 지정 없음"
            }
          />

          <InfoBox
            label="현재 처리상태"
            value={
              hasAssignment
                ? "배정 완료"
                : "배정 필요"
            }
            accent={
              hasAssignment
                ? "success"
                : "warning"
            }
          />
        </div>

        {enrollmentRequest.admin_note && (
          <div
            style={{
              marginTop: "12px",
              padding:
                "13px 15px",
              border:
                "1px solid #eaecf0",
              borderRadius:
                "10px",
              background:
                "#fcfcfd",
            }}
          >
            <div
              style={{
                color:
                  "#667085",
                fontSize: "10px",
                fontWeight: 800,
              }}
            >
              관리자 메모
            </div>

            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#344054",
                fontSize: "11px",
                lineHeight: 1.65,
              }}
            >
              {
                enrollmentRequest.admin_note
              }
            </div>
          </div>
        )}
      </section>

      {/* ===============================================
          ASSIGNMENT
          배정 결과 표시/수정은 AssignmentManager가
          단독으로 담당합니다.
      =============================================== */}

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
        teachers={teachers}
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

      {/* ===============================================
          WORKFLOW NOTE
      =============================================== */}

      <section
        style={{
          marginTop: "18px",
          padding:
            "17px 19px",
          border:
            "1px solid #dbe6ff",
          borderRadius: "13px",
          background:
            "#f8faff",
        }}
      >
        <div
          style={{
            color: "#175cd3",
            fontSize: "10px",
            fontWeight: 900,
          }}
        >
          NEXT STEP
        </div>

        <div
          style={{
            marginTop: "6px",
            color: "#475467",
            fontSize: "11px",
            lineHeight: 1.7,
          }}
        >
          강사와 수업 일정 배정이
          완료되면 학부모가 확정된
          수업조건을 확인하고
          수강기간을 선택합니다.
          이후 결제를 완료하면 실제
          수강 및 수업 운영 단계로
          전환됩니다.
        </div>
      </section>
    </main>
  );
}

function HeaderBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        minWidth: "100px",
        padding:
          "10px 12px",
        border:
          "1px solid #dbe6ff",
        borderRadius: "10px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "9px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "3px",
          color: "#175cd3",
          fontSize: "12px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  accent?:
    | "success"
    | "warning";
}) {
  const valueColor =
    accent === "success"
      ? "#067647"
      : accent === "warning"
      ? "#93370d"
      : "#101828";

  const background =
    accent === "success"
      ? "#f6fef9"
      : accent === "warning"
      ? "#fffdf5"
      : "#fcfcfd";

  return (
    <div
      style={{
        padding:
          "15px 16px",
        border:
          "1px solid #eaecf0",
        borderRadius:
          "11px",
        background,
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: valueColor,
          fontSize: "13px",
          fontWeight: 900,
          lineHeight: 1.55,
        }}
      >
        {value}
      </div>

      {subValue && (
        <div
          style={{
            marginTop: "3px",
            color: "#98a2b3",
            fontSize: "9px",
            lineHeight: 1.5,
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}