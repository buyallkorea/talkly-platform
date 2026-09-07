import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

function scheduleText(
  days: string[] | null,
  times: Record<string, string> | null
) {
  return (days ?? [])
    .map(
      (day) =>
        `${DAY_LABELS[day] ?? day} ${times?.[day] ?? "-"}`
    )
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

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

export default async function ParentEnrollmentRequestsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const childId = Number(id);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
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
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name
    `)
    .eq("id", childId)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq("is_active", true)
    .maybeSingle();

  if (
    childError ||
    !child
  ) {
    notFound();
  }

  const adminClient =
    createAdminClient();

  const {
    data: requestsData,
    error: requestsError,
  } = await adminClient
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
    .eq(
      "applicant_user_id",
      user.id
    )
    .eq(
      "child_id",
      childId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (requestsError) {
    throw new Error(
      `수강신청 현황을 불러오지 못했습니다: ${requestsError.message}`
    );
  }

  const allRequests =
    (requestsData ??
      []) as EnrollmentRequestRow[];

  /*
   * 현재 TALKLY의 실제 수강 흐름은 custom 신청입니다.
   * 과거 standard 테스트 신청은 이 화면에서 제외합니다.
   */
  const customRequests =
    allRequests.filter(
      (request) =>
        request.request_type ===
        "custom"
    );

  /*
   * 현재 진행 중인 가장 최근 신청 1건만 보여줍니다.
   * 결제 직전 단계에서 과거 신청들이 섞여 보이지 않도록 합니다.
   */
  const currentRequest =
    customRequests[0] ??
    null;

  let courseName = "-";
  let teacher:
    | {
        display_name:
          | string
          | null;
        nationality:
          | string
          | null;
      }
    | null = null;

  if (currentRequest) {
    const [
      courseResult,
      teacherResult,
    ] =
      await Promise.all([
        adminClient
          .from("courses")
          .select(
            "id, name"
          )
          .eq(
            "id",
            currentRequest.course_id
          )
          .maybeSingle(),

        currentRequest.assigned_teacher_user_id
          ? adminClient
              .from(
                "teacher_profiles"
              )
              .select(`
                user_id,
                display_name,
                nationality
              `)
              .eq(
                "user_id",
                currentRequest.assigned_teacher_user_id
              )
              .maybeSingle()
          : Promise.resolve({
              data: null,
              error: null,
            }),
      ]);

    courseName =
      courseResult.data?.name ??
      `과정 ${currentRequest.course_id}`;

    teacher =
      teacherResult.data;
  }

  const assigned =
    Boolean(
      currentRequest
        ?.assigned_teacher_user_id &&
        currentRequest
          ?.assignment_confirmed_at
    );

  const assignedSchedule =
    currentRequest
      ? scheduleText(
          currentRequest.assigned_days,
          currentRequest.assigned_times
        )
      : "";

  const preferredSchedule =
    currentRequest
      ? scheduleText(
          currentRequest.preferred_days,
          currentRequest.preferred_times
        )
      : "";

  const durationMinutes =
    assigned
      ? currentRequest
          ?.assigned_lesson_duration_minutes
      : currentRequest
          ?.lesson_duration_minutes;

  const lessonsPerWeek =
    assigned
      ? currentRequest
          ?.assigned_lessons_per_week
      : currentRequest
          ?.lessons_per_week;

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "linear-gradient(180deg, #f6f9ff 0%, #ffffff 42%, #f8fbff 100%)",
      }}
    >
      <div
        style={{
          maxWidth:
            "1120px",
          margin:
            "0 auto",
          padding:
            "34px 20px 90px",
        }}
      >
        <Link
          href={`/parent/children/${child.id}`}
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            gap: "7px",
            color:
              "#475467",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          ← 자녀 상세
        </Link>

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            marginTop:
              "18px",
            padding:
              "34px 36px",
            borderRadius:
              "24px",
            background:
              "linear-gradient(135deg, #0A1F44 0%, #164c96 58%, #3978ef 100%)",
            boxShadow:
              "0 18px 45px rgba(10,31,68,0.16)",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              top: "-70px",
              right:
                "-40px",
              width:
                "220px",
              height:
                "220px",
              borderRadius:
                "999px",
              background:
                "rgba(255,255,255,0.08)",
            }}
          />

          <div
            style={{
              position:
                "absolute",
              right:
                "150px",
              bottom:
                "-95px",
              width:
                "190px",
              height:
                "190px",
              borderRadius:
                "999px",
              background:
                "rgba(255,255,255,0.06)",
            }}
          />

          <div
            style={{
              position:
                "relative",
              zIndex: 1,
              maxWidth:
                "700px",
            }}
          >
            <div
              style={{
                color:
                  "#a9c7ff",
                fontSize:
                  "12px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.13em",
              }}
            >
              TALKLY CLASS READY
            </div>

            <h1
              style={{
                margin:
                  "10px 0 0",
                color:
                  "#ffffff",
                fontSize:
                  "clamp(30px, 5vw, 46px)",
                lineHeight:
                  1.15,
                letterSpacing:
                  "-0.04em",
              }}
            >
              {child.name} 학생의
              <br />
              수강 준비 현황
            </h1>

            <p
              style={{
                margin:
                  "16px 0 0",
                maxWidth:
                  "600px",
                color:
                  "rgba(255,255,255,0.82)",
                fontSize:
                  "15px",
                lineHeight:
                  1.75,
              }}
            >
              강사와 수업 일정이
              확정되면 바로 수강기간과
              결제금액을 확인할 수
              있습니다.
            </p>
          </div>
        </section>

        {!currentRequest ? (
          <section
            style={{
              marginTop:
                "24px",
              padding:
                "34px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "18px",
              background:
                "#ffffff",
              textAlign:
                "center",
              boxShadow:
                "0 10px 30px rgba(16,24,40,0.05)",
            }}
          >
            <div
              style={{
                fontSize:
                  "42px",
              }}
            >
              📘
            </div>

            <h2
              style={{
                margin:
                  "12px 0 0",
                color:
                  "#101828",
              }}
            >
              진행 중인 수강신청이
              없습니다.
            </h2>

            <p
              style={{
                margin:
                  "8px 0 0",
                color:
                  "#667085",
                lineHeight:
                  1.7,
              }}
            >
              레벨테스트 결과 또는
              자녀 상세 화면에서
              수강신청을 진행해 주세요.
            </p>

            <Link
              href={`/parent/children/${child.id}`}
              style={{
                display:
                  "inline-flex",
                marginTop:
                  "20px",
                minHeight:
                  "46px",
                padding:
                  "0 18px",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "11px",
                background:
                  "#0A1F44",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              돌아가기
            </Link>
          </section>
        ) : (
          <>
            <section
              style={{
                marginTop:
                  "24px",
                padding:
                  "28px",
                border:
                  assigned
                    ? "1px solid #c7eed8"
                    : "1px solid #fedf89",
                borderRadius:
                  "20px",
                background:
                  "#ffffff",
                boxShadow:
                  "0 12px 35px rgba(16,24,40,0.06)",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "flex-start",
                  justifyContent:
                    "space-between",
                  gap: "18px",
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      display:
                        "inline-flex",
                      minHeight:
                        "29px",
                      padding:
                        "0 11px",
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
                    {assigned
                      ? "강사 · 일정 배정 완료"
                      : "강사 · 일정 확인 중"}
                  </div>

                  <h2
                    style={{
                      margin:
                        "12px 0 0",
                      color:
                        "#101828",
                      fontSize:
                        "28px",
                      letterSpacing:
                        "-0.03em",
                    }}
                  >
                    {courseName}
                  </h2>

                  <div
                    style={{
                      marginTop:
                        "7px",
                      color:
                        "#667085",
                      fontSize:
                        "13px",
                    }}
                  >
                    신청 #
                    {
                      currentRequest.id
                    }
                    {" · "}
                    접수{" "}
                    {formatDate(
                      currentRequest.created_at
                    )}
                  </div>
                </div>

                <div
                  style={{
                    width:
                      "54px",
                    height:
                      "54px",
                    borderRadius:
                      "16px",
                    display:
                      "grid",
                    placeItems:
                      "center",
                    background:
                      assigned
                        ? "#effaf4"
                        : "#fff7e8",
                    fontSize:
                      "27px",
                  }}
                >
                  {assigned
                    ? "✓"
                    : "⏳"}
                </div>
              </div>

              <div
                style={{
                  marginTop:
                    "26px",
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <InfoCard
                  icon="👩‍🏫"
                  label="담당 강사"
                  value={
                    assigned
                      ? `${teacher?.display_name ?? "Teacher"}${
                          teacher?.nationality
                            ? ` · ${teacher.nationality}`
                            : ""
                        }`
                      : "배정 확인 중"
                  }
                />

                <InfoCard
                  icon="🗓️"
                  label="수업 일정"
                  value={
                    assigned
                      ? assignedSchedule ||
                        "-"
                      : preferredSchedule ||
                        "-"
                  }
                />

                <InfoCard
                  icon="⏱️"
                  label="수업시간"
                  value={`${
                    durationMinutes ??
                    "-"
                  }분`}
                />

                <InfoCard
                  icon="📚"
                  label="수업 횟수"
                  value={`주 ${
                    lessonsPerWeek ??
                    "-"
                  }회`}
                />
              </div>

              {assigned ? (
                <div
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "16px 18px",
                    borderRadius:
                      "13px",
                    background:
                      "#f4fbf7",
                    border:
                      "1px solid #d1fadf",
                    color:
                      "#067647",
                    fontSize:
                      "13px",
                    lineHeight:
                      1.7,
                    fontWeight:
                      700,
                  }}
                >
                  수업 배정이
                  완료되었습니다. 이제
                  수강기간과 결제금액을
                  확인하고 결제를 진행할
                  수 있습니다.
                </div>
              ) : (
                <div
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "16px 18px",
                    borderRadius:
                      "13px",
                    background:
                      "#fffaeb",
                    border:
                      "1px solid #fedf89",
                    color:
                      "#93370d",
                    fontSize:
                      "13px",
                    lineHeight:
                      1.7,
                    fontWeight:
                      700,
                  }}
                >
                  TALKLY에서 실제 강사
                  근무시간과 기존 수업
                  일정을 확인하고
                  있습니다.
                </div>
              )}
            </section>

            <section
              style={{
                marginTop:
                  "18px",
                padding:
                  "20px 22px",
                borderRadius:
                  "16px",
                background:
                  "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
                border:
                  "1px solid #dbe7ff",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  gap: "13px",
                  alignItems:
                    "flex-start",
                }}
              >
                <div
                  style={{
                    width:
                      "38px",
                    height:
                      "38px",
                    flex:
                      "0 0 auto",
                    borderRadius:
                      "12px",
                    display:
                      "grid",
                    placeItems:
                      "center",
                    background:
                      "#ffffff",
                    boxShadow:
                      "0 5px 14px rgba(57,120,239,0.1)",
                  }}
                >
                  💡
                </div>

                <div>
                  <div
                    style={{
                      color:
                        "#0A1F44",
                      fontSize:
                        "14px",
                      fontWeight:
                        900,
                    }}
                  >
                    결제 전 최종 확인
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#667085",
                      fontSize:
                        "12px",
                      lineHeight:
                        1.75,
                    }}
                  >
                    결제 화면에서
                    1·3·6·12개월 중
                    수강기간을 선택하고,
                    적용 할인과 최종
                    결제금액을 확인하게
                    됩니다.
                  </div>
                </div>
              </div>
            </section>

            <div
              style={{
                marginTop:
                  "22px",
                display:
                  "flex",
                gap: "12px",
                justifyContent:
                  "flex-end",
                flexWrap:
                  "wrap",
              }}
            >
              <Link
                href={`/parent/children/${child.id}`}
                style={{
                  minHeight:
                    "50px",
                  padding:
                    "0 22px",
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "12px",
                  background:
                    "#ffffff",
                  color:
                    "#344054",
                  textDecoration:
                    "none",
                  fontSize:
                    "14px",
                  fontWeight:
                    900,
                }}
              >
                돌아가기
              </Link>

              {assigned ? (
                <Link
                  href={`/parent/children/${child.id}/enrollment-requests/${currentRequest.id}`}
                  style={{
                    minHeight:
                      "50px",
                    padding:
                      "0 28px",
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    borderRadius:
                      "12px",
                    background:
                      "linear-gradient(135deg, #3978ef 0%, #175cd3 100%)",
                    color:
                      "#ffffff",
                    textDecoration:
                      "none",
                    fontSize:
                      "14px",
                    fontWeight:
                      900,
                    boxShadow:
                      "0 10px 24px rgba(57,120,239,0.25)",
                  }}
                >
                  결제하기 →
                </Link>
              ) : (
                <span
                  style={{
                    minHeight:
                      "50px",
                    padding:
                      "0 28px",
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    borderRadius:
                      "12px",
                    background:
                      "#eaecf0",
                    color:
                      "#98a2b3",
                    fontSize:
                      "14px",
                    fontWeight:
                      900,
                    cursor:
                      "not-allowed",
                  }}
                >
                  배정 완료 후 결제 가능
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "17px 18px",
        border:
          "1px solid #eaecf0",
        borderRadius:
          "14px",
        background:
          "#fcfdff",
      }}
    >
      <div
        style={{
          fontSize:
            "21px",
        }}
      >
        {icon}
      </div>

      <div
        style={{
          marginTop:
            "9px",
          color:
            "#667085",
          fontSize:
            "11px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "#101828",
          fontSize:
            "14px",
          fontWeight:
            900,
          lineHeight:
            1.55,
        }}
      >
        {value}
      </div>
    </div>
  );
}