import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CourseRelation =
  | {
      id: number;
      name: string;
    }
  | {
      id: number;
      name: string;
    }[]
  | null;

type OptionRelation =
  | {
      id: number;
      title: string;
    }
  | {
      id: number;
      title: string;
    }[]
  | null;

type TeacherRow = {
  user_id: string;
  display_name: string | null;
};

const STATUS_INFO: Record<
  string,
  {
    label: string;
    background: string;
    color: string;
    border: string;
  }
> = {
  pending: {
    label: "승인대기",
    background: "#fff8e8",
    color: "#9a6700",
    border: "#f1d48b",
  },

  approved: {
    label: "승인완료",
    background: "#eef9f2",
    color: "#197044",
    border: "#a9ddbd",
  },

  rejected: {
    label: "반려",
    background: "#fff2f1",
    color: "#b42318",
    border: "#efb3ad",
  },
};

function getStatusInfo(status: string) {
  return (
    STATUS_INFO[status] ?? {
      label: status,
      background: "#f4f6f8",
      color: "#667085",
      border: "#d8dee7",
    }
  );
}

function getCourseName(
  course: CourseRelation
) {
  if (!course) {
    return "-";
  }

  if (Array.isArray(course)) {
    return course[0]?.name ?? "-";
  }

  return course.name;
}

function getOptionTitle(
  option: OptionRelation
) {
  if (!option) {
    return "-";
  }

  if (Array.isArray(option)) {
    return option[0]?.title ?? "-";
  }

  return option.title;
}

function formatMoney(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return `${new Intl.NumberFormat(
    "ko-KR"
  ).format(value)}원`;
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(value));
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

  /*
   * 로그인 사용자 확인
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * 학부모 프로필 확인
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message
    );
  }

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  /*
   * 자신의 자녀인지 확인
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name,
      is_active
    `)
    .eq("id", childId)
    .eq(
      "parent_user_id",
      user.id
    )
    .maybeSingle();

  if (childError) {
    throw new Error(
      childError.message
    );
  }

  if (
    !child ||
    !child.is_active
  ) {
    notFound();
  }

  /*
   * 수강신청 조회
   *
   * 중요:
   * teacher_profiles는 여기에서
   * JOIN하지 않습니다.
   *
   * enrollment_requests와
   * teacher_profiles 사이에
   * 직접 FK가 없기 때문입니다.
   */
  const {
    data: requests,
    error: requestsError,
  } = await supabase
    .from("enrollment_requests")
    .select(`
      id,
      applicant_user_id,
      child_id,
      enrollment_option_id,
      course_id,

      lesson_duration_minutes,
      lessons_per_week,

      preferred_days,
      preferred_times,

      start_date,
      end_date,
      total_lessons,

      estimated_price,

      status,

      assigned_teacher_user_id,
      assigned_curriculum,
      admin_note,

      created_at,
      updated_at,

      courses (
        id,
        name
      ),

      enrollment_options (
        id,
        title
      )
    `)
    .eq(
      "child_id",
      childId
    )
    .eq(
      "applicant_user_id",
      user.id
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (requestsError) {
    throw new Error(
      `수강신청 현황 조회 실패: ${requestsError.message}`
    );
  }

  /*
   * 승인된 신청에 배정된
   * 강사 UUID 수집
   */
  const teacherUserIds = Array.from(
    new Set(
      (requests ?? [])
        .map(
          (request) =>
            request.assigned_teacher_user_id
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  );

  /*
   * teacher_profiles 별도 조회
   */
  let teachers: TeacherRow[] = [];

  if (
    teacherUserIds.length > 0
  ) {
    const {
      data: teacherRows,
      error: teacherError,
    } = await supabase
      .from("teacher_profiles")
      .select(`
        user_id,
        display_name
      `)
      .in(
        "user_id",
        teacherUserIds
      );

    if (teacherError) {
      console.error(
        "강사 정보 조회 실패:",
        teacherError.message
      );
    } else {
      teachers =
        (teacherRows ??
          []) as TeacherRow[];
    }
  }

  /*
   * 강사 UUID → 이름 Map
   */
  const teacherNameMap =
    new Map<string, string>();

  teachers.forEach(
    (teacher) => {
      teacherNameMap.set(
        teacher.user_id,
        teacher.display_name ??
          "담당 강사"
      );
    }
  );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        <Link
          href={`/parent/children/${child.id}`}
          style={backLinkStyle}
        >
          ← 자녀 상세
        </Link>

        {/* 상단 소개 */}

        <section
          style={{
            marginTop: "22px",
            padding: "30px",
            borderRadius: "22px",

            background:
              "linear-gradient(135deg, #ffffff 0%, #edf4ff 100%)",

            border:
              "1px solid #dce7f5",

            boxShadow:
              "0 12px 34px rgba(10,31,68,0.07)",
          }}
        >
          <div className="talkly-section-label">
            ENROLLMENT STATUS
          </div>

          <h1
            style={{
              margin: "8px 0 0",

              color:
                "var(--talkly-navy)",

              fontSize: "34px",

              letterSpacing:
                "-0.04em",
            }}
          >
            {child.name} 수강신청 현황
          </h1>

          <p
            style={{
              margin: "12px 0 0",

              color:
                "var(--text-muted)",

              lineHeight: 1.75,
            }}
          >
            신청한 수업의 승인 상태와
            담당 강사, 커리큘럼을 확인할
            수 있습니다.
          </p>

          <div
            style={{
              marginTop: "22px",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {child.grade && (
              <InfoChip
                label="학년"
                value={child.grade}
              />
            )}

            {child.school_name && (
              <InfoChip
                label="학교"
                value={
                  child.school_name
                }
              />
            )}
          </div>
        </section>

        {/* 신청내역 */}

        <section
          className="talkly-card"
          style={{
            marginTop: "26px",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap: "12px",

              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="talkly-section-label">
                APPLICATIONS
              </div>

              <h2
                style={{
                  margin:
                    "7px 0 0",

                  color:
                    "var(--talkly-navy)",
                }}
              >
                신청 내역
              </h2>
            </div>

            <Link
              href={`/parent/children/${child.id}/enrollment`}
              style={primaryButtonStyle}
            >
              새 수강신청 →
            </Link>
          </div>

          {!requests ||
          requests.length === 0 ? (
            <div
              style={{
                marginTop: "22px",

                padding:
                  "46px 20px",

                border:
                  "1px dashed #d7e0ec",

                borderRadius:
                  "12px",

                textAlign:
                  "center",

                color:
                  "#7b8798",

                lineHeight: 1.8,
              }}
            >
              아직 수강신청 내역이
              없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "22px",

                display: "grid",

                gap: "16px",
              }}
            >
              {requests.map(
                (request) => {
                  const status =
                    getStatusInfo(
                      request.status
                    );

                  const courseName =
                    getCourseName(
                      request.courses
                    );

                  const optionTitle =
                    getOptionTitle(
                      request.enrollment_options
                    );

                  const teacherName =
                    request.assigned_teacher_user_id
                      ? teacherNameMap.get(
                          request.assigned_teacher_user_id
                        ) ??
                        "담당 강사"
                      : "-";

                  return (
                    <article
                      key={
                        request.id
                      }
                      style={{
                        padding:
                          "22px",

                        border:
                          "1px solid #dce4ee",

                        borderRadius:
                          "14px",

                        background:
                          "#ffffff",

                        boxShadow:
                          "0 8px 22px rgba(10,31,68,0.04)",
                      }}
                    >
                      {/* 카드 상단 */}

                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          alignItems:
                            "flex-start",

                          gap: "14px",

                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color:
                                "var(--talkly-blue)",

                              fontSize:
                                "12px",

                              fontWeight:
                                900,
                            }}
                          >
                            {courseName}
                          </div>

                          <h3
                            style={{
                              margin:
                                "6px 0 0",

                              color:
                                "var(--talkly-navy)",

                              fontSize:
                                "20px",
                            }}
                          >
                            {optionTitle}
                          </h3>
                        </div>

                        <span
                          style={{
                            padding:
                              "7px 11px",

                            borderRadius:
                              "999px",

                            border:
                              `1px solid ${status.border}`,

                            background:
                              status.background,

                            color:
                              status.color,

                            fontSize:
                              "12px",

                            fontWeight:
                              900,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      {/* 신청 기본정보 */}

                      <div className="request-info-grid">
                        <RequestInfo
                          label="수업"
                          value={`${request.lesson_duration_minutes}분 · 주 ${request.lessons_per_week}회`}
                        />

                        <RequestInfo
                          label="수강기간"
                          value={`${request.start_date} ~ ${request.end_date ?? "-"}`}
                        />

                        <RequestInfo
                          label="총 수업"
                          value={`${request.total_lessons}회`}
                        />

                        <RequestInfo
                          label="수강료"
                          value={formatMoney(
                            request.estimated_price
                          )}
                        />

                        <RequestInfo
                          label="신청일"
                          value={formatDateTime(
                            request.created_at
                          )}
                        />
                      </div>

                      {/* 승인완료 */}

                      {request.status ===
                        "approved" && (
                        <div
                          style={{
                            marginTop:
                              "18px",

                            padding:
                              "18px",

                            borderRadius:
                              "12px",

                            background:
                              "#f6f9fe",

                            border:
                              "1px solid #dce7f5",
                          }}
                        >
                          <div
                            style={{
                              color:
                                "var(--talkly-navy)",

                              fontSize:
                                "13px",

                              fontWeight:
                                900,
                            }}
                          >
                            승인된 수강정보
                          </div>

                          <div className="approved-info-grid">
                            <RequestInfo
                              label="담당 강사"
                              value={
                                teacherName
                              }
                            />

                            <RequestInfo
                              label="커리큘럼 / 교재"
                              value={
                                request.assigned_curriculum ||
                                "-"
                              }
                            />
                          </div>

                          <div
                            style={{
                              marginTop:
                                "16px",

                              display:
                                "flex",

                              gap:
                                "10px",

                              flexWrap:
                                "wrap",
                            }}
                          >
                            <Link
                              href={`/parent/children/${child.id}/classes`}
                              style={secondaryButtonStyle}
                            >
                              수업 일정 보기 →
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* 승인 대기 */}

                      {request.status ===
                        "pending" && (
                        <div
                          style={{
                            marginTop:
                              "18px",

                            padding:
                              "15px 17px",

                            borderRadius:
                              "10px",

                            background:
                              "#fffaf0",

                            border:
                              "1px solid #f1dca9",

                            color:
                              "#8a6400",

                            fontSize:
                              "13px",

                            lineHeight:
                              1.7,
                          }}
                        >
                          관리자가 수강신청을
                          확인하고 있습니다.
                          승인 후 담당 강사와
                          수업 일정이
                          확정됩니다.
                        </div>
                      )}

                      {/* 반려 */}

                      {request.status ===
                        "rejected" && (
                        <div
                          style={{
                            marginTop:
                              "18px",

                            padding:
                              "15px 17px",

                            border:
                              "1px solid #efc4bf",

                            borderRadius:
                              "10px",

                            background:
                              "#fff7f6",

                            color:
                              "#9f2f26",

                            fontSize:
                              "13px",

                            lineHeight:
                              1.7,
                          }}
                        >
                          <strong>
                            수강신청이
                            반려되었습니다.
                          </strong>

                          {request.admin_note && (
                            <div
                              style={{
                                marginTop:
                                  "6px",
                              }}
                            >
                              {
                                request.admin_note
                              }
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </main>

      <style>{`
        .request-info-grid {
          margin-top: 20px;

          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(150px, 1fr)
            );

          gap: 16px;
        }

        .approved-info-grid {
          margin-top: 14px;

          display: grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );

          gap: 16px;
        }

        @media (
          max-width: 720px
        ) {
          .request-info-grid,
          .approved-info-grid {
            grid-template-columns:
              1fr 1fr;
          }
        }

        @media (
          max-width: 520px
        ) {
          .request-info-grid,
          .approved-info-grid {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </div>
  );
}

function RequestInfo({
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
          color: "#8a96a8",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",

          color:
            "var(--talkly-navy)",

          fontSize: "13px",

          fontWeight: 800,

          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",

        borderRadius: "10px",

        background:
          "rgba(255,255,255,0.82)",

        border:
          "1px solid #dce7f5",
      }}
    >
      <span
        style={{
          color:
            "var(--text-muted)",

          fontSize: "11px",

          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          marginLeft: "8px",

          color:
            "var(--talkly-navy)",

          fontSize: "13px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const backLinkStyle = {
  color: "var(--talkly-blue)",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "14px",
};

const primaryButtonStyle = {
  minHeight: "42px",
  padding: "0 16px",

  display: "inline-flex",
  alignItems: "center",

  borderRadius: "10px",

  background:
    "var(--talkly-blue)",

  color: "#ffffff",

  textDecoration: "none",

  fontSize: "13px",

  fontWeight: 900,
};

const secondaryButtonStyle = {
  minHeight: "42px",
  padding: "0 15px",

  display: "inline-flex",
  alignItems: "center",

  borderRadius: "9px",

  border:
    "1px solid #cddcf0",

  background: "#ffffff",

  color:
    "var(--talkly-blue)",

  textDecoration: "none",

  fontSize: "13px",

  fontWeight: 900,
};