import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import ResendTeacherRegistrationButton from "./ResendTeacherRegistrationButton";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

type TeacherProfile = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  education: string | null;
  is_active: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  profile_image_url: string | null;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  teacher_user_id: string | null;
  status: string;
};

type TeacherReviewSummary = {
  teacher_user_id: string;
  review_count: number;
  overall_average:
    | number
    | string
    | null;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  scheduled_start: string;
  status: string;
};

type AuthTeacherInfo = {
  email: string | null;
  teacherInvited: boolean;
  accountReady: boolean;
  authExists: boolean;
};

type RegistrationStatus =
  | "pending"
  | "active"
  | "inactive";

function getRegistrationStatus({
  teacher,
  authInfo,
}: {
  teacher: TeacherProfile;
  authInfo:
    | AuthTeacherInfo
    | undefined;
}): RegistrationStatus {
  /*
   * 관리자가 비활성화한 강사가 최우선
   */
  if (
    !teacher.is_active
  ) {
    return "inactive";
  }

  /*
   * Auth 계정이 비정상적으로 없는 경우도
   * 관리자가 확인할 수 있도록 등록 대기로 분류
   */
  if (
    !authInfo ||
    !authInfo.authExists
  ) {
    return "pending";
  }

  /*
   * 새 강사등록 방식:
   * 계정설정 완료 전
   */
  if (
    authInfo.teacherInvited &&
    !authInfo.accountReady
  ) {
    return "pending";
  }

  /*
   * 기존 강사 또는
   * 신규 계정설정 완료 강사
   */
  return "active";
}

function getStatusLabel(
  status:
    RegistrationStatus
) {
  switch (status) {
    case "pending":
      return "등록 대기";

    case "active":
      return "활동중";

    case "inactive":
      return "비활성";
  }
}

function getStatusStyle(
  status:
    RegistrationStatus
) {
  switch (status) {
    case "pending":
      return {
        color:
          "#b54708",
        background:
          "#fffaeb",
        border:
          "1px solid #fedf89",
      };

    case "active":
      return {
        color:
          "#067647",
        background:
          "#ecfdf3",
        border:
          "1px solid #abefc6",
      };

    case "inactive":
      return {
        color:
          "#475467",
        background:
          "#f2f4f7",
        border:
          "1px solid #d0d5dd",
      };
  }
}

export default async function AdminTeachersPage({
  searchParams,
}: PageProps) {
  const {
    q = "",
    status = "all",
  } =
    await searchParams;

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
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    !profile ||
    profile.role !==
      "admin"
  ) {
    redirect("/");
  }

  /*
   * =======================================================
   * 기본 데이터
   * =======================================================
   */
  const [
    teachersResult,
    enrollmentsResult,
    reviewSummaryResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "teacher_profiles"
        )
        .select(`
          user_id,
          display_name,
          nationality,
          specialties,
          years_experience,
          education,
          is_active,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from("enrollments")
        .select(`
          id,
          child_id,
          student_user_id,
          teacher_user_id,
          status
        `)
        .not(
          "teacher_user_id",
          "is",
          null
        ),

      supabase
        .from(
          "teacher_review_summary"
        )
        .select(`
          teacher_user_id,
          review_count,
          overall_average
        `),
    ]);

  const firstError =
    teachersResult.error ||
    enrollmentsResult.error ||
    reviewSummaryResult.error;

  if (firstError) {
    throw new Error(
      firstError.message
    );
  }

  const teachers =
    (teachersResult.data ??
      []) as TeacherProfile[];

  const enrollments =
    (enrollmentsResult.data ??
      []) as Enrollment[];

  const reviewSummaries =
    (reviewSummaryResult.data ??
      []) as TeacherReviewSummary[];

  const reviewSummaryMap =
    new Map(
      reviewSummaries.map(
        (item) => [
          item.teacher_user_id,
          item,
        ]
      )
    );

  /*
   * =======================================================
   * 공통 profiles
   * =======================================================
   */
  const teacherIds =
    teachers.map(
      (teacher) =>
        teacher.user_id
    );

  let profiles:
    Profile[] = [];

  if (
    teacherIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from("profiles")
        .select(`
          id,
          name,
          phone,
          profile_image_url
        `)
        .in(
          "id",
          teacherIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    profiles =
      (data ??
        []) as Profile[];
  }

  const profileMap =
    new Map(
      profiles.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  /*
   * =======================================================
   * Auth 계정 상태
   *
   * 관리자 서버페이지에서만 Service Role을 사용해
   * 강사의 계정설정 완료 여부를 확인합니다.
   * =======================================================
   */
  const adminClient =
    createAdminClient();

  const authEntries =
    await Promise.all(
      teacherIds.map(
        async (
          teacherUserId
        ) => {
          const {
            data,
            error,
          } =
            await adminClient.auth.admin
              .getUserById(
                teacherUserId
              );

          if (
            error ||
            !data.user
          ) {
            return [
              teacherUserId,
              {
                email:
                  null,

                teacherInvited:
                  false,

                accountReady:
                  false,

                authExists:
                  false,
              } satisfies AuthTeacherInfo,
            ] as const;
          }

          return [
            teacherUserId,
            {
              email:
                data.user
                  .email ??
                null,

              teacherInvited:
                data.user
                  .user_metadata
                  ?.teacher_invited ===
                true,

              accountReady:
                data.user
                  .user_metadata
                  ?.teacher_account_ready ===
                true,

              authExists:
                true,
            } satisfies AuthTeacherInfo,
          ] as const;
        }
      )
    );

  const authInfoMap =
    new Map<
      string,
      AuthTeacherInfo
    >(
      authEntries
    );

  /*
   * =======================================================
   * 수업 데이터
   * =======================================================
   */
  const enrollmentIds =
    enrollments.map(
      (enrollment) =>
        enrollment.id
    );

  let sessions:
    ClassSession[] = [];

  if (
    enrollmentIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "class_sessions"
        )
        .select(`
          id,
          enrollment_id,
          scheduled_start,
          status
        `)
        .in(
          "enrollment_id",
          enrollmentIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    sessions =
      (data ??
        []) as ClassSession[];
  }

  /*
   * =======================================================
   * 오늘 날짜
   * =======================================================
   */
  const seoulDate =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).format(
      new Date()
    );

  const todayStart =
    new Date(
      `${seoulDate}T00:00:00+09:00`
    );

  const tomorrowStart =
    new Date(
      `${seoulDate}T00:00:00+09:00`
    );

  tomorrowStart.setDate(
    tomorrowStart.getDate() +
      1
  );

  function getTeacherEnrollments(
    teacherUserId: string
  ) {
    return enrollments.filter(
      (enrollment) =>
        enrollment.teacher_user_id ===
        teacherUserId
    );
  }

  function getTeacherSessions(
    teacherUserId: string
  ) {
    const ids =
      new Set(
        getTeacherEnrollments(
          teacherUserId
        ).map(
          (enrollment) =>
            enrollment.id
        )
      );

    return sessions.filter(
      (session) =>
        ids.has(
          session.enrollment_id
        )
    );
  }

  function getTodaySessionCount(
    teacherUserId: string
  ) {
    return getTeacherSessions(
      teacherUserId
    ).filter(
      (session) => {
        const start =
          new Date(
            session.scheduled_start
          );

        return (
          start >=
            todayStart &&
          start <
            tomorrowStart
        );
      }
    ).length;
  }

  function getAssignedStudentCount(
    teacherUserId: string
  ) {
    const uniqueStudentKeys =
      new Set<string>();

    for (
      const enrollment of
      getTeacherEnrollments(
        teacherUserId
      )
    ) {
      if (
        enrollment.child_id
      ) {
        uniqueStudentKeys.add(
          `child-${enrollment.child_id}`
        );
      } else if (
        enrollment.student_user_id
      ) {
        uniqueStudentKeys.add(
          `adult-${enrollment.student_user_id}`
        );
      }
    }

    return uniqueStudentKeys.size;
  }

  /*
   * =======================================================
   * 화면 행 구성
   * =======================================================
   */
  const normalizedQuery =
    q
      .trim()
      .toLowerCase();

  const allRows =
    teachers.map(
      (teacher) => {
        const commonProfile =
          profileMap.get(
            teacher.user_id
          );

        const authInfo =
          authInfoMap.get(
            teacher.user_id
          );

        const teacherEnrollments =
          getTeacherEnrollments(
            teacher.user_id
          );

        const activeEnrollmentCount =
          teacherEnrollments.filter(
            (enrollment) =>
              enrollment.status ===
              "active"
          ).length;

        const registrationStatus =
          getRegistrationStatus({
            teacher,
            authInfo,
          });

        return {
          ...teacher,

          realName:
            commonProfile
              ?.name ||
            "-",

          phone:
            commonProfile
              ?.phone ||
            "-",

          profileImageUrl:
            commonProfile
              ?.profile_image_url ||
            null,

          email:
            authInfo
              ?.email ||
            null,

          registrationStatus,

          assignedStudentCount:
            getAssignedStudentCount(
              teacher.user_id
            ),

          activeEnrollmentCount,

          todaySessionCount:
            getTodaySessionCount(
              teacher.user_id
            ),

          reviewCount:
            reviewSummaryMap.get(
              teacher.user_id
            )
              ?.review_count ??
            0,

          reviewAverage:
            reviewSummaryMap.get(
              teacher.user_id
            )
              ?.overall_average ??
            null,
        };
      }
    );

  const rows =
    allRows.filter(
      (teacher) => {
        const matchesSearch =
          !normalizedQuery ||
          [
            teacher.display_name ||
              "",

            teacher.realName,

            teacher.email ||
              "",

            teacher.nationality ||
              "",

            teacher.phone,

            ...(
              teacher.specialties ??
              []
            ),
          ].some(
            (value) =>
              value
                .toLowerCase()
                .includes(
                  normalizedQuery
                )
          );

        const matchesStatus =
          status ===
            "all" ||
          teacher.registrationStatus ===
            status;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  /*
   * =======================================================
   * 상단 통계
   * =======================================================
   */
  const pendingTeacherCount =
    allRows.filter(
      (teacher) =>
        teacher.registrationStatus ===
        "pending"
    ).length;

  const activeTeacherCount =
    allRows.filter(
      (teacher) =>
        teacher.registrationStatus ===
        "active"
    ).length;

  const inactiveTeacherCount =
    allRows.filter(
      (teacher) =>
        teacher.registrationStatus ===
        "inactive"
    ).length;

  const totalAssignedStudents =
    teachers.reduce(
      (
        sum,
        teacher
      ) =>
        sum +
        getAssignedStudentCount(
          teacher.user_id
        ),
      0
    );

  const totalTodaySessions =
    teachers.reduce(
      (
        sum,
        teacher
      ) =>
        sum +
        getTodaySessionCount(
          teacher.user_id
        ),
      0
    );

  const totalTeacherReviewCount =
    reviewSummaries.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.review_count ||
            0
        ),
      0
    );

  const weightedReviewTotal =
    reviewSummaries.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.overall_average ||
            0
        ) *
          Number(
            item.review_count ||
              0
          ),
      0
    );

  const overallTeacherReviewAverage =
    totalTeacherReviewCount >
    0
      ? (
          weightedReviewTotal /
          totalTeacherReviewCount
        ).toFixed(2)
      : null;

  return (
    <div>
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap:
            "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize:
                "32px",
              letterSpacing:
                "-0.03em",
            }}
          >
            강사 관리
          </h1>

          <p
            style={{
              marginTop:
                "9px",
              marginBottom:
                0,
              opacity: 0.6,
            }}
          >
            강사등록 상태와 담당 학생,
            진행 중 수강, 수업 및 강사평가
            현황을 확인합니다.
          </p>
        </div>

        <Link
          href="/admin/teachers/new"
          style={{
            padding:
              "11px 16px",
            border:
              "1px solid #d6deea",
            borderRadius:
              "9px",
            color:
              "#ffffff",
            background:
              "#0a1f44",
            textDecoration:
              "none",
            fontWeight:
              800,
          }}
        >
          + 강사등록
        </Link>
      </div>

      {/* ================================================= */}
      {/* STAT */}
      {/* ================================================= */}

      <section
        style={{
          marginTop:
            "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label:
              "전체 강사",

            value:
              teachers.length,
          },

          {
            label:
              "등록 대기",

            value:
              pendingTeacherCount,
          },

          {
            label:
              "활동중",

            value:
              activeTeacherCount,
          },

          {
            label:
              "비활성",

            value:
              inactiveTeacherCount,
          },

          {
            label:
              "담당 학생",

            value:
              totalAssignedStudents,
          },

          {
            label:
              "오늘 수업",

            value:
              totalTodaySessions,
          },

          {
            label:
              "강사 평가",

            value:
              totalTeacherReviewCount,
          },

          {
            label:
              "평균 평점",

            value:
              overallTeacherReviewAverage ??
              "-",
          },
        ].map(
          (item) => (
            <div
              key={
                item.label
              }
              style={{
                padding:
                  "20px",
                border:
                  "1px solid #e4e7ec",
                borderRadius:
                  "12px",
                background:
                  "#ffffff",
              }}
            >
              <div
                style={{
                  fontSize:
                    "13px",
                  opacity:
                    0.58,
                }}
              >
                {
                  item.label
                }
              </div>

              <div
                style={{
                  marginTop:
                    "8px",
                  fontSize:
                    "29px",
                  fontWeight:
                    800,
                }}
              >
                {
                  item.value
                }
              </div>
            </div>
          )
        )}
      </section>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <form
        method="get"
        style={{
          marginTop:
            "22px",
          padding:
            "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "12px",
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) 170px auto",
          gap: "10px",
          background:
            "#ffffff",
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={
            q
          }
          placeholder="강사명, 이메일, 국적, 연락처, 전문분야 검색"
          style={{
            minWidth: 0,
            padding:
              "11px 12px",
            border:
              "1px solid #d6deea",
            borderRadius:
              "8px",
            background:
              "#ffffff",
            color:
              "#101828",
          }}
        />

        <select
          name="status"
          defaultValue={
            status
          }
          style={{
            padding:
              "11px 12px",
            border:
              "1px solid #d6deea",
            borderRadius:
              "8px",
            background:
              "#ffffff",
            color:
              "#101828",
          }}
        >
          <option value="all">
            전체 상태
          </option>

          <option value="pending">
            등록 대기
          </option>

          <option value="active">
            활동중
          </option>

          <option value="inactive">
            비활성
          </option>
        </select>

        <button
          type="submit"
          style={{
            padding:
              "11px 18px",
            border:
              "1px solid #d6deea",
            borderRadius:
              "8px",
            background:
              "#0a1f44",
            color:
              "#ffffff",
            fontWeight:
              800,
            cursor:
              "pointer",
          }}
        >
          검색
        </button>
      </form>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <section
        style={{
          marginTop:
            "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          overflow:
            "hidden",
          background:
            "#ffffff",
        }}
      >
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
            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(220px, 1.3fr) 105px 80px 90px 90px 80px 80px 80px minmax(175px, auto)",

                gap: "12px",

                padding:
                  "14px 18px",

                borderBottom:
                  "1px solid #e7ebf0",

                fontSize:
                  "12px",

                fontWeight:
                  700,

                opacity:
                  0.55,
              }}
            >
              <div>
                강사
              </div>

              <div>
                상태
              </div>

              <div>
                국적
              </div>

              <div>
                담당 학생
              </div>

              <div>
                진행 수강
              </div>

              <div>
                오늘 수업
              </div>

              <div>
                평가수
              </div>

              <div>
                평균
              </div>

              <div>
                관리
              </div>
            </div>

            {rows.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "36px",

                  textAlign:
                    "center",

                  opacity:
                    0.62,
                }}
              >
                조건에 맞는 강사가 없습니다.
              </div>
            ) : (
              rows.map(
                (teacher) => {
                  const statusStyle =
                    getStatusStyle(
                      teacher.registrationStatus
                    );

                  return (
                    <div
                      key={
                        teacher.user_id
                      }
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "minmax(220px, 1.3fr) 105px 80px 90px 90px 80px 80px 80px minmax(175px, auto)",

                        gap:
                          "12px",

                        alignItems:
                          "center",

                        padding:
                          "16px 18px",

                        borderBottom:
                          "1px solid #eef1f5",
                      }}
                    >
                      {/* 강사 */}
                      <div
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            "12px",

                          minWidth:
                            0,
                        }}
                      >
                        {teacher.profileImageUrl ? (
                          <img
                            src={
                              teacher.profileImageUrl
                            }
                            alt={`${teacher.display_name ||
                              teacher.realName ||
                              "강사"} 프로필`}
                            style={{
                              width:
                                "48px",

                              height:
                                "48px",

                              borderRadius:
                                "50%",

                              objectFit:
                                "cover",

                              border:
                                "1px solid #d6deea",

                              background:
                                "#f2f4f7",

                              flexShrink:
                                0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width:
                                "48px",

                              height:
                                "48px",

                              borderRadius:
                                "50%",

                              display:
                                "flex",

                              alignItems:
                                "center",

                              justifyContent:
                                "center",

                              background:
                                "#eaf2ff",

                              color:
                                "#0a1f44",

                              fontWeight:
                                900,

                              flexShrink:
                                0,
                            }}
                          >
                            {(teacher.display_name ||
                              teacher.realName ||
                              "T")
                              .trim()
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>
                        )}

                        <div
                          style={{
                            minWidth:
                              0,
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                800,

                              color:
                                "#101828",
                            }}
                          >
                            {teacher.display_name ||
                              teacher.realName ||
                              "이름 미등록 강사"}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "3px",

                              color:
                                "#667085",

                              fontSize:
                                "11px",

                              overflow:
                                "hidden",

                              textOverflow:
                                "ellipsis",

                              whiteSpace:
                                "nowrap",
                            }}
                            title={
                              teacher.email ||
                              ""
                            }
                          >
                            {teacher.email ||
                              "이메일 확인 필요"}
                          </div>
                        </div>
                      </div>

                      {/* 상태 */}
                      <div>
                        <span
                          style={{
                            display:
                              "inline-flex",

                            alignItems:
                              "center",

                            minHeight:
                              "28px",

                            padding:
                              "4px 9px",

                            borderRadius:
                              "999px",

                            fontSize:
                              "11px",

                            fontWeight:
                              800,

                            whiteSpace:
                              "nowrap",

                            ...statusStyle,
                          }}
                        >
                          {getStatusLabel(
                            teacher.registrationStatus
                          )}
                        </span>
                      </div>

                      <div>
                        {teacher.nationality ||
                          "-"}
                      </div>

                      <div
                        style={{
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          teacher.assignedStudentCount
                        }
                        명
                      </div>

                      <div
                        style={{
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          teacher.activeEnrollmentCount
                        }
                        건
                      </div>

                      <div
                        style={{
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          teacher.todaySessionCount
                        }
                        건
                      </div>

                      <div
                        style={{
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          teacher.reviewCount
                        }
                        건
                      </div>

                      <div
                        style={{
                          fontWeight:
                            800,

                          color:
                            teacher.reviewAverage
                              ? "#175cd3"
                              : "#667085",
                        }}
                      >
                        {teacher.reviewAverage
                          ? Number(
                              teacher.reviewAverage
                            ).toFixed(
                              2
                            )
                          : "-"}
                      </div>

                      {/* 관리 */}
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "flex-end",

                          alignItems:
                            "center",

                          gap:
                            "7px",
                        }}
                      >
                        {teacher.registrationStatus ===
                          "pending" &&
                          teacher.email && (
                            <ResendTeacherRegistrationButton
                              teacherUserId={
                                teacher.user_id
                              }
                            />
                          )}

                        <Link
                          href={`/admin/teachers/${teacher.user_id}`}
                          style={{
                            minHeight:
                              "36px",

                            display:
                              "inline-flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "center",

                            padding:
                              "7px 11px",

                            background:
                              "#ffffff",

                            border:
                              "1px solid #d6deea",

                            borderRadius:
                              "8px",

                            color:
                              "inherit",

                            textDecoration:
                              "none",

                            fontSize:
                              "12px",

                            fontWeight:
                              700,

                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          상세
                        </Link>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      </section>

      <div
        style={{
          marginTop:
            "14px",

          padding:
            "14px 16px",

          border:
            "1px solid #e4e7ec",

          borderRadius:
            "10px",

          background:
            "#f8fafc",

          color:
            "#667085",

          fontSize:
            "12px",

          lineHeight:
            1.7,
        }}
      >
        <strong
          style={{
            color:
              "#344054",
          }}
        >
          상태 기준
        </strong>
        <br />
        등록 대기: 강사등록은 완료되었으나
        강사가 아직 이메일에서 비밀번호
        설정을 완료하지 않은 상태입니다.
        <br />
        활동중: 계정 설정이 완료되어 TALKLY
        강사페이지를 사용할 수 있는 상태입니다.
        <br />
        비활성: 관리자가 강사 활동을 중지한
        상태이며 모든 강사페이지 접근이
        차단됩니다.
      </div>
    </div>
  );
}