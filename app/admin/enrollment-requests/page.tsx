import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type RequestRow = {
  id: number;
  child_id: number;
  course_id: number;
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
  assigned_teacher_user_id: string | null;
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

function statusLabel(
  status: string
) {
  if (
    status === "pending"
  ) {
    return "배정 대기";
  }

  if (
    status === "approved"
  ) {
    return "배정 완료";
  }

  if (
    status === "cancelled"
  ) {
    return "취소";
  }

  return status;
}

function formatSchedule(
  row: RequestRow
) {
  const days =
    row.preferred_days ??
    [];

  const times =
    row.preferred_times ??
    {};

  return days
    .map(
      (day) =>
        `${
          DAY_LABELS[day] ??
          day
        } ${
          times[day] ??
          "-"
        }`
    )
    .join(" · ");
}

export default async function AdminEnrollmentRequestsPage() {
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
    data: requestsData,
    error: requestsError,
  } = await adminClient
    .from(
      "enrollment_requests"
    )
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
      teacher_preference_type,
      preferred_teacher_user_id,
      assigned_teacher_user_id,
      created_at
    `)
    .eq(
      "request_type",
      "custom"
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    );

  if (requestsError) {
    throw new Error(
      `수강신청 목록을 불러오지 못했습니다: ${requestsError.message}`
    );
  }

  const requests =
    (requestsData ??
      []) as RequestRow[];

  const childIds =
    Array.from(
      new Set(
        requests.map(
          (row) =>
            row.child_id
        )
      )
    );

  const courseIds =
    Array.from(
      new Set(
        requests.map(
          (row) =>
            row.course_id
        )
      )
    );

  const teacherIds =
    Array.from(
      new Set(
        requests
          .flatMap(
            (row) => [
              row.preferred_teacher_user_id,
              row.assigned_teacher_user_id,
            ]
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    );

  const [
    childrenResult,
    coursesResult,
    teachersResult,
  ] =
    await Promise.all([
      childIds.length > 0
        ? adminClient
            .from(
              "children"
            )
            .select(
              "id, name"
            )
            .in(
              "id",
              childIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      courseIds.length > 0
        ? adminClient
            .from(
              "courses"
            )
            .select(
              "id, name"
            )
            .in(
              "id",
              courseIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),

      teacherIds.length > 0
        ? adminClient
            .from(
              "teacher_profiles"
            )
            .select(
              "user_id, display_name"
            )
            .in(
              "user_id",
              teacherIds
            )
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

  const childMap =
    new Map(
      (
        childrenResult.data ??
        []
      ).map(
        (row: {
          id: number;
          name: string;
        }) => [
          row.id,
          row.name,
        ]
      )
    );

  const courseMap =
    new Map(
      (
        coursesResult.data ??
        []
      ).map(
        (row: {
          id: number;
          name: string;
        }) => [
          row.id,
          row.name,
        ]
      )
    );

  const teacherMap =
    new Map(
      (
        teachersResult.data ??
        []
      ).map(
        (row: {
          user_id: string;
          display_name:
            | string
            | null;
        }) => [
          row.user_id,
          row.display_name ??
            "Teacher",
        ]
      )
    );

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding:
          "36px 20px 70px",
      }}
    >
      <Link
        href="/admin"
        style={{
          color:
            "var(--talkly-blue)",
          textDecoration:
            "none",
          fontWeight: 800,
        }}
      >
        ← 관리자 대시보드
      </Link>

      <div
        style={{
          marginTop: "18px",
        }}
      >
        <div className="talkly-section-label">
          ENROLLMENT
          REQUESTS
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
          맞춤 수강신청 관리
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
          학부모가 신청한
          희망조건을 확인하고 실제
          가용 강사를 재확인한 뒤
          수업 일정을 배정합니다.
        </p>
      </div>

      <section
        className="talkly-card"
        style={{
          marginTop: "24px",
          padding: "24px",
        }}
      >
        {requests.length ===
        0 ? (
          <div
            style={{
              padding:
                "28px 10px",
              color:
                "#667085",
              textAlign:
                "center",
            }}
          >
            맞춤 수강신청이
            없습니다.
          </div>
        ) : (
          <div
            style={{
              display:
                "grid",
              gap: "12px",
            }}
          >
            {requests.map(
              (row) => {
                const assigned =
                  Boolean(
                    row.assigned_teacher_user_id
                  );

                return (
                  <Link
                    key={
                      row.id
                    }
                    href={`/admin/enrollment-requests/${row.id}`}
                    style={{
                      display:
                        "block",
                      padding:
                        "18px",
                      border:
                        "1px solid #e4e7ec",
                      borderRadius:
                        "12px",
                      background:
                        "#ffffff",
                      color:
                        "inherit",
                      textDecoration:
                        "none",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "14px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color:
                              "#101828",
                            fontSize:
                              "17px",
                            fontWeight:
                              900,
                          }}
                        >
                          #
                          {
                            row.id
                          }{" "}
                          {childMap.get(
                            row.child_id
                          ) ??
                            `자녀 ${row.child_id}`}
                          {" · "}
                          {courseMap.get(
                            row.course_id
                          ) ??
                            `과정 ${row.course_id}`}
                        </div>

                        <div
                          style={{
                            marginTop:
                              "7px",
                            color:
                              "#667085",
                            fontSize:
                              "12px",
                            lineHeight:
                              1.7,
                          }}
                        >
                          {
                            row.lesson_duration_minutes
                          }
                          분 · 주{" "}
                          {
                            row.lessons_per_week
                          }
                          회 ·{" "}
                          {
                            formatSchedule(
                              row
                            )
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "5px",
                            color:
                              "#667085",
                            fontSize:
                              "12px",
                          }}
                        >
                          강사선호:{" "}
                          {row.teacher_preference_type ===
                          "specific"
                            ? teacherMap.get(
                                row.preferred_teacher_user_id ??
                                  ""
                              ) ??
                              "특정 강사"
                            : "가능한 강사 중 배정"}
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "flex-start",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            minHeight:
                              "30px",
                            padding:
                              "0 10px",
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            borderRadius:
                              "999px",
                            background:
                              assigned
                                ? "#ecfdf3"
                                : "#fffaeb",
                            color:
                              assigned
                                ? "#067647"
                                : "#93370d",
                            fontSize:
                              "11px",
                            fontWeight:
                              900,
                          }}
                        >
                          {
                            statusLabel(
                              row.status
                            )
                          }
                        </span>
                      </div>
                    </div>

                    {assigned && (
                      <div
                        style={{
                          marginTop:
                            "10px",
                          color:
                            "#175cd3",
                          fontSize:
                            "12px",
                          fontWeight:
                            800,
                        }}
                      >
                        배정강사:{" "}
                        {teacherMap.get(
                          row.assigned_teacher_user_id ??
                            ""
                        ) ??
                          "확인 필요"}
                      </div>
                    )}
                  </Link>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}