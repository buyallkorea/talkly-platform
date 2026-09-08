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

type SearchParams = Promise<{
  status?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
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

function getStatusInfo(
  row: RequestRow
) {
  if (
    row.status === "cancelled" ||
    row.status === "canceled"
  ) {
    return {
      label: "취소",
      shortLabel: "취소",
      color: "#b42318",
      background: "#fef3f2",
      border: "#fecdca",
    };
  }

  if (
    row.status === "approved" &&
    row.assigned_teacher_user_id
  ) {
    return {
      label: "배정 완료",
      shortLabel: "배정 완료",
      color: "#067647",
      background: "#ecfdf3",
      border: "#abefc6",
    };
  }

  if (
    row.status === "approved"
  ) {
    return {
      label: "승인 · 배정 확인 필요",
      shortLabel: "확인 필요",
      color: "#175cd3",
      background: "#eff4ff",
      border: "#b2ccff",
    };
  }

  if (
    row.status === "pending"
  ) {
    return {
      label: "배정 필요",
      shortLabel: "배정 필요",
      color: "#93370d",
      background: "#fffaeb",
      border: "#fedf89",
    };
  }

  return {
    label: row.status,
    shortLabel: row.status,
    color: "#344054",
    background: "#f2f4f7",
    border: "#d0d5dd",
  };
}

function formatSchedule(
  row: RequestRow
) {
  const days =
    row.preferred_days ?? [];

  const times =
    row.preferred_times ?? {};

  if (days.length === 0) {
    return "희망 일정 없음";
  }

  return days
    .map((day) => {
      const dayLabel =
        DAY_LABELS[day] ?? day;

      const time =
        times[day] ?? "-";

      return `${dayLabel} ${time}`;
    })
    .join(" · ");
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

function isTodaySeoul(
  value: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  return (
    formatter.format(
      new Date(value)
    ) ===
    formatter.format(
      new Date()
    )
  );
}

function getTeacherPreferenceLabel(
  row: RequestRow,
  teacherMap: Map<
    string,
    string
  >
) {
  if (
    row.teacher_preference_type ===
    "specific"
  ) {
    return (
      teacherMap.get(
        row.preferred_teacher_user_id ??
          ""
      ) ?? "특정 강사"
    );
  }

  return "가능한 강사";
}

export default async function AdminEnrollmentRequestsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const activeFilter =
    params.status ?? "all";

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

  /*
   * 현재 TALKLY의 기본 수강신청은
   * custom 방식입니다.
   *
   * 기존 enrollment_options 기반의
   * standard 방식은 이 관리자 화면에서
   * 운영하지 않습니다.
   */
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
        ascending: false,
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
            .from("children")
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
            .from("courses")
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

  if (
    childrenResult.error
  ) {
    throw new Error(
      `자녀 정보를 불러오지 못했습니다: ${childrenResult.error.message}`
    );
  }

  if (
    coursesResult.error
  ) {
    throw new Error(
      `과정 정보를 불러오지 못했습니다: ${coursesResult.error.message}`
    );
  }

  if (
    teachersResult.error
  ) {
    throw new Error(
      `강사 정보를 불러오지 못했습니다: ${teachersResult.error.message}`
    );
  }

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

  /*
   * -----------------------------------------------------
   * 운영 현황
   * -----------------------------------------------------
   */

  const pendingRequests =
    requests.filter(
      (row) =>
        row.status ===
          "pending" &&
        !row.assigned_teacher_user_id
    );

  const assignedRequests =
    requests.filter(
      (row) =>
        row.status ===
          "approved" &&
        Boolean(
          row.assigned_teacher_user_id
        )
    );

  const todayRequests =
    requests.filter(
      (row) =>
        isTodaySeoul(
          row.created_at
        )
    );

  const cancelledRequests =
    requests.filter(
      (row) =>
        row.status ===
          "cancelled" ||
        row.status ===
          "canceled"
    );

  /*
   * -----------------------------------------------------
   * 빠른 필터
   * -----------------------------------------------------
   */

  const filteredRequests =
    requests.filter(
      (row) => {
        if (
          activeFilter ===
          "pending"
        ) {
          return (
            row.status ===
              "pending" &&
            !row.assigned_teacher_user_id
          );
        }

        if (
          activeFilter ===
          "assigned"
        ) {
          return (
            row.status ===
              "approved" &&
            Boolean(
              row.assigned_teacher_user_id
            )
          );
        }

        if (
          activeFilter ===
          "today"
        ) {
          return isTodaySeoul(
            row.created_at
          );
        }

        if (
          activeFilter ===
          "cancelled"
        ) {
          return (
            row.status ===
              "cancelled" ||
            row.status ===
              "canceled"
          );
        }

        return true;
      }
    );

  return (
    <main
      style={{
        maxWidth: "1440px",
        margin: "0 auto",
        padding:
          "34px 22px 80px",
      }}
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/admin"
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              minHeight:
                "38px",
              padding:
                "0 13px",
              border:
                "1px solid #d0d5dd",
              borderRadius:
                "9px",
              background:
                "#ffffff",
              color:
                "#344054",
              textDecoration:
                "none",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            ← 관리자 대시보드
          </Link>

          <div
            style={{
              marginTop:
                "20px",
              color:
                "var(--talkly-blue)",
              fontSize:
                "11px",
              fontWeight:
                900,
              letterSpacing:
                "0.12em",
            }}
          >
            ENROLLMENT REQUESTS
          </div>

          <h1
            style={{
              margin:
                "6px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize:
                "32px",
              lineHeight:
                1.25,
            }}
          >
            수강 신청 관리
          </h1>

          <p
            style={{
              margin:
                "9px 0 0",
              maxWidth:
                "720px",
              color:
                "var(--text-muted)",
              fontSize:
                "13px",
              lineHeight:
                1.7,
            }}
          >
            학부모가 신청한
            희망 수업조건을 확인하고,
            실제 강사 가용시간을
            검토하여 담당 강사와
            수업 일정을 배정합니다.
          </p>
        </div>

        <div
          style={{
            padding:
              "13px 16px",
            border:
              "1px solid #dbe6ff",
            borderRadius:
              "12px",
            background:
              "#f5f8ff",
            color:
              "#344054",
            fontSize:
              "11px",
            lineHeight:
              1.65,
          }}
        >
          <strong
            style={{
              color:
                "#175cd3",
            }}
          >
            관리자 업무 흐름
          </strong>
          <br />
          신청 확인 → 강사/시간
          배정 → 학부모 확인 →
          기간 선택 및 결제
        </div>
      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <section
        style={{
          marginTop:
            "26px",
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 신청"
          value={
            requests.length
          }
          description="전체 맞춤 수강신청"
          href="/admin/enrollment-requests"
          active={
            activeFilter ===
            "all"
          }
          tone="navy"
        />

        <SummaryCard
          label="배정 필요"
          value={
            pendingRequests.length
          }
          description="관리자 처리가 필요한 신청"
          href="/admin/enrollment-requests?status=pending"
          active={
            activeFilter ===
            "pending"
          }
          tone="warning"
        />

        <SummaryCard
          label="배정 완료"
          value={
            assignedRequests.length
          }
          description="강사와 일정이 배정된 신청"
          href="/admin/enrollment-requests?status=assigned"
          active={
            activeFilter ===
            "assigned"
          }
          tone="success"
        />

        <SummaryCard
          label="오늘 신청"
          value={
            todayRequests.length
          }
          description="오늘 새로 접수된 신청"
          href="/admin/enrollment-requests?status=today"
          active={
            activeFilter ===
            "today"
          }
          tone="blue"
        />
      </section>

      {/* =================================================
          FILTER / LIST HEADER
      ================================================= */}

      <section
        style={{
          marginTop:
            "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          background:
            "#ffffff",
          overflow:
            "hidden",
          boxShadow:
            "0 8px 26px rgba(16,24,40,0.04)",
        }}
      >
        <div
          style={{
            padding:
              "18px 20px",
            borderBottom:
              "1px solid #eaecf0",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#101828",
                fontSize:
                  "18px",
              }}
            >
              신청 목록
            </h2>

            <div
              style={{
                marginTop:
                  "4px",
                color:
                  "#667085",
                fontSize:
                  "11px",
              }}
            >
              현재 조건{" "}
              <strong
                style={{
                  color:
                    "#344054",
                }}
              >
                {
                  filteredRequests.length
                }
              </strong>
              건
            </div>
          </div>

          <div
            style={{
              display:
                "flex",
              gap: "7px",
              flexWrap:
                "wrap",
            }}
          >
            <FilterButton
              href="/admin/enrollment-requests"
              active={
                activeFilter ===
                "all"
              }
            >
              전체
            </FilterButton>

            <FilterButton
              href="/admin/enrollment-requests?status=pending"
              active={
                activeFilter ===
                "pending"
              }
            >
              배정 필요
            </FilterButton>

            <FilterButton
              href="/admin/enrollment-requests?status=assigned"
              active={
                activeFilter ===
                "assigned"
              }
            >
              배정 완료
            </FilterButton>

            <FilterButton
              href="/admin/enrollment-requests?status=today"
              active={
                activeFilter ===
                "today"
              }
            >
              오늘 신청
            </FilterButton>

            {cancelledRequests.length >
              0 && (
              <FilterButton
                href="/admin/enrollment-requests?status=cancelled"
                active={
                  activeFilter ===
                  "cancelled"
                }
              >
                취소
              </FilterButton>
            )}
          </div>
        </div>

        {/* ===============================================
            DESKTOP TABLE
        =============================================== */}

        {filteredRequests.length ===
        0 ? (
          <div
            style={{
              padding:
                "60px 20px",
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                margin:
                  "0 auto",
                borderRadius:
                  "14px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                background:
                  "#f2f4f7",
                color:
                  "#667085",
                fontSize:
                  "20px",
                fontWeight:
                  900,
              }}
            >
              0
            </div>

            <div
              style={{
                marginTop:
                  "13px",
                color:
                  "#344054",
                fontSize:
                  "14px",
                fontWeight:
                  800,
              }}
            >
              해당하는 수강신청이
              없습니다.
            </div>

            <div
              style={{
                marginTop:
                  "4px",
                color:
                  "#98a2b3",
                fontSize:
                  "11px",
              }}
            >
              다른 상태를 선택하여
              확인해주세요.
            </div>
          </div>
        ) : (
          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <div
              style={{
                minWidth:
                  "1120px",
              }}
            >
              {/* Table header */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "82px 150px 150px 270px 150px 150px 105px 110px",
                  minHeight:
                    "46px",
                  alignItems:
                    "center",
                  padding:
                    "0 18px",
                  background:
                    "#f9fafb",
                  borderBottom:
                    "1px solid #eaecf0",
                  color:
                    "#667085",
                  fontSize:
                    "10px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.02em",
                }}
              >
                <div>번호</div>
                <div>학생</div>
                <div>과정</div>
                <div>희망 수업조건</div>
                <div>강사 선호</div>
                <div>배정 강사</div>
                <div>상태</div>
                <div>관리</div>
              </div>

              {filteredRequests.map(
                (row) => {
                  const status =
                    getStatusInfo(
                      row
                    );

                  const childName =
                    childMap.get(
                      row.child_id
                    ) ??
                    `자녀 ${row.child_id}`;

                  const courseName =
                    courseMap.get(
                      row.course_id
                    ) ??
                    `과정 ${row.course_id}`;

                  const assignedTeacher =
                    row.assigned_teacher_user_id
                      ? teacherMap.get(
                          row.assigned_teacher_user_id
                        ) ??
                        "확인 필요"
                      : null;

                  const preference =
                    getTeacherPreferenceLabel(
                      row,
                      teacherMap
                    );

                  return (
                    <div
                      key={
                        row.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "82px 150px 150px 270px 150px 150px 105px 110px",
                        minHeight:
                          "86px",
                        alignItems:
                          "center",
                        padding:
                          "0 18px",
                        borderBottom:
                          "1px solid #f0f2f5",
                        background:
                          "#ffffff",
                      }}
                    >
                      {/* ID */}

                      <div>
                        <div
                          style={{
                            color:
                              "#344054",
                            fontSize:
                              "12px",
                            fontWeight:
                              900,
                          }}
                        >
                          #{row.id}
                        </div>

                        <div
                          style={{
                            marginTop:
                              "4px",
                            color:
                              "#98a2b3",
                            fontSize:
                              "9px",
                            lineHeight:
                              1.4,
                          }}
                        >
                          {formatDateTime(
                            row.created_at
                          )}
                        </div>
                      </div>

                      {/* Student */}

                      <div
                        style={{
                          paddingRight:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#101828",
                            fontSize:
                              "13px",
                            fontWeight:
                              900,
                          }}
                        >
                          {
                            childName
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "3px",
                            color:
                              "#98a2b3",
                            fontSize:
                              "9px",
                          }}
                        >
                          child #
                          {
                            row.child_id
                          }
                        </div>
                      </div>

                      {/* Course */}

                      <div
                        style={{
                          paddingRight:
                            "12px",
                          color:
                            "#344054",
                          fontSize:
                            "12px",
                          fontWeight:
                            700,
                          lineHeight:
                            1.5,
                        }}
                      >
                        {
                          courseName
                        }
                      </div>

                      {/* Conditions */}

                      <div
                        style={{
                          paddingRight:
                            "14px",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            gap: "5px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <MiniBadge>
                            {row.lesson_duration_minutes ??
                              "-"}
                            분
                          </MiniBadge>

                          <MiniBadge>
                            주{" "}
                            {row.lessons_per_week ??
                              "-"}
                            회
                          </MiniBadge>
                        </div>

                        <div
                          style={{
                            marginTop:
                              "7px",
                            color:
                              "#475467",
                            fontSize:
                              "11px",
                            lineHeight:
                              1.55,
                          }}
                        >
                          {formatSchedule(
                            row
                          )}
                        </div>
                      </div>

                      {/* Preference */}

                      <div
                        style={{
                          paddingRight:
                            "10px",
                          color:
                            row.teacher_preference_type ===
                            "specific"
                              ? "#175cd3"
                              : "#475467",
                          fontSize:
                            "11px",
                          fontWeight:
                            row.teacher_preference_type ===
                            "specific"
                              ? 800
                              : 600,
                          lineHeight:
                            1.5,
                        }}
                      >
                        {preference}

                        <div
                          style={{
                            marginTop:
                              "3px",
                            color:
                              "#98a2b3",
                            fontSize:
                              "9px",
                            fontWeight:
                              500,
                          }}
                        >
                          {row.teacher_preference_type ===
                          "specific"
                            ? "특정 강사 희망"
                            : "강사 지정 없음"}
                        </div>
                      </div>

                      {/* Assigned */}

                      <div>
                        {assignedTeacher ? (
                          <>
                            <div
                              style={{
                                color:
                                  "#067647",
                                fontSize:
                                  "12px",
                                fontWeight:
                                  900,
                              }}
                            >
                              {
                                assignedTeacher
                              }
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "3px",
                                color:
                                  "#98a2b3",
                                fontSize:
                                  "9px",
                              }}
                            >
                              배정 완료
                            </div>
                          </>
                        ) : (
                          <span
                            style={{
                              color:
                                "#98a2b3",
                              fontSize:
                                "11px",
                            }}
                          >
                            미배정
                          </span>
                        )}
                      </div>

                      {/* Status */}

                      <div>
                        <span
                          style={{
                            display:
                              "inline-flex",
                            minHeight:
                              "28px",
                            padding:
                              "0 9px",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            border:
                              `1px solid ${status.border}`,
                            borderRadius:
                              "999px",
                            background:
                              status.background,
                            color:
                              status.color,
                            fontSize:
                              "10px",
                            fontWeight:
                              900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            status.shortLabel
                          }
                        </span>
                      </div>

                      {/* Action */}

                      <div>
                        <Link
                          href={`/admin/enrollment-requests/${row.id}`}
                          style={{
                            display:
                              "inline-flex",
                            minHeight:
                              "36px",
                            padding:
                              "0 13px",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            border:
                              row.status ===
                                "pending"
                                ? "1px solid #175cd3"
                                : "1px solid #d0d5dd",
                            borderRadius:
                              "8px",
                            background:
                              row.status ===
                                "pending"
                                ? "#175cd3"
                                : "#ffffff",
                            color:
                              row.status ===
                                "pending"
                                ? "#ffffff"
                                : "#344054",
                            textDecoration:
                              "none",
                            fontSize:
                              "10px",
                            fontWeight:
                              900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {row.status ===
                          "pending"
                            ? "배정하기"
                            : "상세보기"}
                        </Link>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Footer */}

        {filteredRequests.length >
          0 && (
          <div
            style={{
              padding:
                "13px 18px",
              borderTop:
                "1px solid #eaecf0",
              background:
                "#fcfcfd",
              color:
                "#667085",
              fontSize:
                "10px",
              lineHeight:
                1.6,
            }}
          >
            신청일은 한국시간(KST)
            기준입니다. 상세 화면에서
            실제 강사 가용시간을 다시
            확인한 뒤 배정해주세요.
          </div>
        )}
      </section>

      {/* =================================================
          OPERATION NOTE
      ================================================= */}

      <section
        style={{
          marginTop:
            "18px",
          padding:
            "18px 20px",
          border:
            "1px solid #dbe6ff",
          borderRadius:
            "14px",
          background:
            "#f8faff",
        }}
      >
        <div
          style={{
            color:
              "#175cd3",
            fontSize:
              "11px",
            fontWeight:
              900,
          }}
        >
          TALKLY 수강신청 운영 기준
        </div>

        <div
          style={{
            marginTop:
              "7px",
            color:
              "#475467",
            fontSize:
              "11px",
            lineHeight:
              1.7,
          }}
        >
          이 화면에서는 학부모가
          제출한 맞춤 수강신청을
          관리합니다. 관리자가 강사와
          실제 수업일정을 배정한 뒤
          학부모가 수강기간을 선택하고
          결제를 진행하는 구조입니다.
          결제 완료 후 실제 수강은
          전체 수강 관리에서 운영합니다.
        </div>
      </section>
    </main>
  );
}

/*
 * =====================================================
 * SUMMARY CARD
 * =====================================================
 */

function SummaryCard({
  label,
  value,
  description,
  href,
  active,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  href: string;
  active: boolean;
  tone:
    | "navy"
    | "warning"
    | "success"
    | "blue";
}) {
  const palette =
    tone === "warning"
      ? {
          accent:
            "#b54708",
          soft:
            "#fffaeb",
          border:
            "#fedf89",
        }
      : tone ===
        "success"
      ? {
          accent:
            "#067647",
          soft:
            "#ecfdf3",
          border:
            "#abefc6",
        }
      : tone ===
        "blue"
      ? {
          accent:
            "#175cd3",
          soft:
            "#eff4ff",
          border:
            "#b2ccff",
        }
      : {
          accent:
            "#0A1F44",
          soft:
            "#f5f8ff",
          border:
            "#c7d7fe",
        };

  return (
    <Link
      href={href}
      style={{
        display:
          "block",
        padding:
          "18px",
        border:
          `1px solid ${
            active
              ? palette.accent
              : palette.border
          }`,
        borderRadius:
          "14px",
        background:
          active
            ? palette.soft
            : "#ffffff",
        color:
          "inherit",
        textDecoration:
          "none",
        boxShadow:
          active
            ? "0 8px 22px rgba(16,24,40,0.05)"
            : "none",
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "10px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "7px",
          color:
            palette.accent,
          fontSize:
            "28px",
          lineHeight: 1,
          fontWeight:
            900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop:
            "8px",
          color:
            "#98a2b3",
          fontSize:
            "9px",
          lineHeight:
            1.5,
        }}
      >
        {description}
      </div>
    </Link>
  );
}

/*
 * =====================================================
 * FILTER BUTTON
 * =====================================================
 */

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display:
          "inline-flex",
        minHeight:
          "34px",
        padding:
          "0 12px",
        alignItems:
          "center",
        justifyContent:
          "center",
        border:
          active
            ? "1px solid #175cd3"
            : "1px solid #d0d5dd",
        borderRadius:
          "8px",
        background:
          active
            ? "#175cd3"
            : "#ffffff",
        color:
          active
            ? "#ffffff"
            : "#475467",
        textDecoration:
          "none",
        fontSize:
          "10px",
        fontWeight:
          800,
        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

/*
 * =====================================================
 * MINI BADGE
 * =====================================================
 */

function MiniBadge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      style={{
        display:
          "inline-flex",
        minHeight:
          "23px",
        padding:
          "0 7px",
        alignItems:
          "center",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "6px",
        background:
          "#f9fafb",
        color:
          "#475467",
        fontSize:
          "9px",
        fontWeight:
          800,
        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </span>
  );
}