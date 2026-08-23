import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    date?: string;
  }>;
};

type SessionRow = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type EnrollmentRow = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
};

type AttendanceRow = {
  id: number;
  class_session_id: number;
  status: string;
  attended_at: string | null;
  note: string | null;
};

function getSeoulDateKey(
  value: Date
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(value);
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      month:
        "2-digit",

      day:
        "2-digit",

      weekday:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    new Date(value)
  );
}

function getAttendanceLabel(
  status: string | null
) {
  switch (status) {
    case "present":
      return "출석";

    case "late":
      return "지각";

    case "absent":
      return "결석";

    case "excused":
      return "인정결석";

    case "teacher_absent":
      return "강사결석";

    default:
      return "미처리";
  }
}

function getAttendanceStyle(
  status: string | null
) {
  switch (status) {
    case "present":
      return {
        color: "#067647",
        background:
          "#ecfdf3",
        border:
          "#abefc6",
      };

    case "late":
      return {
        color: "#b54708",
        background:
          "#fffaeb",
        border:
          "#fedf89",
      };

    case "absent":
      return {
        color: "#b42318",
        background:
          "#fef3f2",
        border:
          "#fecdca",
      };

    case "excused":
      return {
        color: "#175cd3",
        background:
          "#eff8ff",
        border:
          "#b2ddff",
      };

    case "teacher_absent":
      return {
        color: "#7a271a",
        background:
          "#fff4ed",
        border:
          "#ffd6ae",
      };

    default:
      return {
        color: "#667085",
        background:
          "#f2f4f7",
        border:
          "#e4e7ec",
      };
  }
}

function getSessionStatusLabel(
  status: string
) {
  switch (status) {
    case "scheduled":
      return "예정";

    case "in_progress":
      return "수업 중";

    case "completed":
      return "완료";

    case "no_show":
      return "결석";

    case "held":
      return "인정결석";

    case "cancelled":
      return "취소";

    default:
      return status;
  }
}

export default async function AdminAttendancePage({
  searchParams,
}: PageProps) {
  const {
    date,
  } = await searchParams;

  const supabase =
    await createClient();

  /*
   * ==========================================
   * 관리자 권한 확인
   * ==========================================
   */

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data:
      adminProfile,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq(
        "id",
        user.id
      )
      .single();

  if (
    !adminProfile ||
    adminProfile.role !==
      "admin"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 조회 날짜
   * ==========================================
   */

  const today =
    getSeoulDateKey(
      new Date()
    );

  const selectedDate =
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      date
    )
      ? date
      : today;

  const startDate =
    new Date(
      `${selectedDate}T00:00:00+09:00`
    );

  const endDate =
    new Date(startDate);

  endDate.setDate(
    endDate.getDate() + 1
  );

  const startIso =
    startDate.toISOString();

  const endIso =
    endDate.toISOString();

  /*
   * ==========================================
   * 수업 조회
   * ==========================================
   */

  const {
    data:
      sessionData,
    error:
      sessionError,
  } =
    await supabase
      .from(
        "class_sessions"
      )
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .gte(
        "scheduled_start",
        startIso
      )
      .lt(
        "scheduled_start",
        endIso
      )
      .order(
        "scheduled_start",
        {
          ascending:
            true,
        }
      );

  if (
    sessionError
  ) {
    throw new Error(
      sessionError.message
    );
  }

  const sessions =
    (sessionData ??
      []) as SessionRow[];

  const sessionIds =
    sessions.map(
      (session) =>
        session.id
    );

  const enrollmentIds =
    Array.from(
      new Set(
        sessions.map(
          (session) =>
            session.enrollment_id
        )
      )
    );

  /*
   * ==========================================
   * 출결
   * ==========================================
   */

  let attendanceRows: AttendanceRow[] =
    [];

  if (
    sessionIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "attendance"
        )
        .select(`
          id,
          class_session_id,
          status,
          attended_at,
          note
        `)
        .in(
          "class_session_id",
          sessionIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    attendanceRows =
      (data ??
        []) as AttendanceRow[];
  }

  const attendanceMap =
    new Map(
      attendanceRows.map(
        (attendance) => [
          attendance.class_session_id,
          attendance,
        ]
      )
    );

  /*
   * ==========================================
   * 수강 정보
   * ==========================================
   */

  let enrollments: EnrollmentRow[] =
    [];

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
          "enrollments"
        )
        .select(`
          id,
          child_id,
          student_user_id,
          course_id,
          teacher_user_id
        `)
        .in(
          "id",
          enrollmentIds
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    enrollments =
      (data ??
        []) as EnrollmentRow[];
  }

  const enrollmentMap =
    new Map(
      enrollments.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  /*
   * ==========================================
   * 학생 / 강사 / 과정
   * ==========================================
   */

  const childIds =
    Array.from(
      new Set(
        enrollments
          .map(
            (item) =>
              item.child_id
          )
          .filter(
            (
              value
            ): value is number =>
              value !==
              null
          )
      )
    );

  const studentUserIds =
    Array.from(
      new Set(
        enrollments
          .map(
            (item) =>
              item.student_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      )
    );

  const courseIds =
    Array.from(
      new Set(
        enrollments.map(
          (item) =>
            item.course_id
        )
      )
    );

  const teacherIds =
    Array.from(
      new Set(
        enrollments
          .map(
            (item) =>
              item.teacher_user_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      )
    );

  const [
    childrenResult,
    studentsResult,
    coursesResult,
    teachersResult,
  ] =
    await Promise.all([
      childIds.length >
      0
        ? supabase
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
        : Promise.resolve(
            {
              data: [],
              error:
                null,
            }
          ),

      studentUserIds.length >
      0
        ? supabase
            .from(
              "profiles"
            )
            .select(
              "id, name"
            )
            .in(
              "id",
              studentUserIds
            )
        : Promise.resolve(
            {
              data: [],
              error:
                null,
            }
          ),

      courseIds.length >
      0
        ? supabase
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
        : Promise.resolve(
            {
              data: [],
              error:
                null,
            }
          ),

      teacherIds.length >
      0
        ? supabase
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
        : Promise.resolve(
            {
              data: [],
              error:
                null,
            }
          ),
    ]);

  const lookupError =
    childrenResult.error ||
    studentsResult.error ||
    coursesResult.error ||
    teachersResult.error;

  if (
    lookupError
  ) {
    throw new Error(
      lookupError.message
    );
  }

  const childMap =
    new Map(
      (
        childrenResult.data ??
        []
      ).map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  const studentMap =
    new Map(
      (
        studentsResult.data ??
        []
      ).map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  const courseMap =
    new Map(
      (
        coursesResult.data ??
        []
      ).map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  const teacherMap =
    new Map(
      (
        teachersResult.data ??
        []
      ).map(
        (item) => [
          item.user_id,
          item.display_name,
        ]
      )
    );

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(
        enrollmentId
      );

    if (
      !enrollment
    ) {
      return "학생 정보 없음";
    }

    if (
      enrollment.child_id
    ) {
      return (
        childMap.get(
          enrollment.child_id
        ) ||
        "자녀 정보 없음"
      );
    }

    if (
      enrollment.student_user_id
    ) {
      return (
        studentMap.get(
          enrollment.student_user_id
        ) ||
        "학생 정보 없음"
      );
    }

    return "학생 정보 없음";
  }

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(
        enrollmentId
      );

    if (
      !enrollment
    ) {
      return "-";
    }

    return (
      courseMap.get(
        enrollment.course_id
      ) ||
      "-"
    );
  }

  function getTeacherName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(
        enrollmentId
      );

    if (
      !enrollment ||
      !enrollment.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teacherMap.get(
        enrollment.teacher_user_id
      ) ||
      "미배정"
    );
  }

  /*
   * ==========================================
   * 통계
   * ==========================================
   */

  const presentCount =
    attendanceRows.filter(
      (item) =>
        item.status ===
        "present"
    ).length;

  const lateCount =
    attendanceRows.filter(
      (item) =>
        item.status ===
        "late"
    ).length;

  const absentCount =
    attendanceRows.filter(
      (item) =>
        item.status ===
        "absent"
    ).length;

  const excusedCount =
    attendanceRows.filter(
      (item) =>
        item.status ===
        "excused"
    ).length;

  const teacherAbsentCount =
    attendanceRows.filter(
      (item) =>
        item.status ===
        "teacher_absent"
    ).length;

  const attendanceBase =
    presentCount +
    lateCount +
    absentCount;

  const attendanceRate =
    attendanceBase > 0
      ? Math.round(
          ((presentCount +
            lateCount) /
            attendanceBase) *
            100
        )
      : 0;

  const nowTime =
    new Date().getTime();

  const unprocessedCount =
    sessions.filter(
      (session) => {
        const attendance =
          attendanceMap.get(
            session.id
          );

        if (
          attendance
        ) {
          return false;
        }

        if (
          session.status ===
            "cancelled" ||
          session.status ===
            "held"
        ) {
          return false;
        }

        return (
          new Date(
            session.scheduled_end
          ).getTime() <
          nowTime
        );
      }
    ).length;

  return (
    <div>
      {/* HEADER */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "20px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin:
                0,

              fontSize:
                "32px",

              letterSpacing:
                "-0.03em",
            }}
          >
            출결 관리
          </h1>

          <p
            style={{
              marginTop:
                "9px",

              marginBottom:
                0,

              color:
                "#667085",

              fontSize:
                "14px",
            }}
          >
            날짜별 수업의 출석,
            지각, 결석 및 미처리
            현황을 확인합니다.
          </p>
        </div>

        <Link
          href="/admin"
          style={{
            minHeight:
              "42px",

            padding:
              "0 16px",

            display:
              "inline-flex",

            alignItems:
              "center",

            border:
              "1px solid #d0d5dd",

            borderRadius:
              "9px",

            color:
              "#344054",

            textDecoration:
              "none",

            fontSize:
              "13px",

            fontWeight:
              800,

            background:
              "#ffffff",
          }}
        >
          ← 관리자 대시보드
        </Link>
      </div>

      {/* 날짜 검색 */}

      <form
        method="get"
        style={{
          marginTop:
            "24px",

          padding:
            "18px",

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "10px",

          flexWrap:
            "wrap",

          border:
            "1px solid #e4e7ec",

          borderRadius:
            "12px",

          background:
            "#ffffff",
        }}
      >
        <strong
          style={{
            fontSize:
              "13px",

            color:
              "#344054",
          }}
        >
          조회일
        </strong>

        <input
          type="date"
          name="date"
          defaultValue={
            selectedDate
          }
          style={{
            minHeight:
              "40px",

            padding:
              "0 12px",

            border:
              "1px solid #d0d5dd",

            borderRadius:
              "8px",

            background:
              "#ffffff",

            color:
              "#344054",
          }}
        />

        <button
          type="submit"
          style={{
            minHeight:
              "40px",

            padding:
              "0 16px",

            border:
              "none",

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
          조회
        </button>

        {selectedDate !==
          today && (
          <Link
            href="/admin/attendance"
            style={{
              color:
                "#2f6fed",

              textDecoration:
                "none",

              fontSize:
                "13px",

              fontWeight:
                800,
            }}
          >
            오늘 보기
          </Link>
        )}
      </form>

      {/* 통계 */}

      <section
        style={{
          marginTop:
            "18px",

          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(150px, 1fr))",

          gap:
            "10px",
        }}
      >
        {[
          {
            label:
              "전체 수업",
            value:
              sessions.length,
          },

          {
            label:
              "출석",
            value:
              presentCount,
          },

          {
            label:
              "지각",
            value:
              lateCount,
          },

          {
            label:
              "결석",
            value:
              absentCount,
          },

          {
            label:
              "인정결석",
            value:
              excusedCount,
          },

          {
            label:
              "강사결석",
            value:
              teacherAbsentCount,
          },

          {
            label:
              "출결 미처리",
            value:
              unprocessedCount,
          },

          {
            label:
              "출석률",
            value:
              `${attendanceRate}%`,
          },
        ].map(
          (item) => (
            <div
              key={
                item.label
              }
              style={{
                padding:
                  "18px",

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
                  color:
                    "#667085",

                  fontSize:
                    "12px",

                  fontWeight:
                    700,
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

                  color:
                    "#101828",

                  fontSize:
                    "27px",

                  fontWeight:
                    900,
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

      {/* 안내 */}

      <div
        style={{
          marginTop:
            "18px",

          padding:
            "15px 18px",

          border:
            "1px solid #dbe7ff",

          borderRadius:
            "11px",

          background:
            "#f5f8ff",

          color:
            "#475467",

          fontSize:
            "12px",

          lineHeight:
            1.7,
        }}
      >
        출석률은 출석과 지각을
        출석으로 인정하여 계산합니다.
        인정결석과 강사결석은 학생의
        출석률 계산에서 제외합니다.
      </div>

      {/* LIST */}

      <section
        style={{
          marginTop:
            "18px",

          overflow:
            "hidden",

          border:
            "1px solid #e4e7ec",

          borderRadius:
            "14px",

          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "90px minmax(150px,1fr) minmax(140px,1fr) minmax(130px,.9fr) 130px 110px 90px",

            gap:
              "12px",

            padding:
              "14px 18px",

            borderBottom:
              "1px solid #e4e7ec",

            background:
              "#f8fafc",

            color:
              "#667085",

            fontSize:
              "12px",

            fontWeight:
              800,
          }}
        >
          <div>시간</div>
          <div>학생</div>
          <div>과정</div>
          <div>강사</div>
          <div>수업 상태</div>
          <div>출결</div>
          <div />
        </div>

        {sessions.length ===
        0 ? (
          <div
            style={{
              padding:
                "42px",

              textAlign:
                "center",

              color:
                "#98a2b3",
            }}
          >
            해당 날짜에 등록된
            수업이 없습니다.
          </div>
        ) : (
          sessions.map(
            (session) => {
              const attendance =
                attendanceMap.get(
                  session.id
                );

              const attendanceStatus =
                attendance?.status ??
                null;

              const badge =
                getAttendanceStyle(
                  attendanceStatus
                );

              return (
                <div
                  key={
                    session.id
                  }
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "90px minmax(150px,1fr) minmax(140px,1fr) minmax(130px,.9fr) 130px 110px 90px",

                    gap:
                      "12px",

                    alignItems:
                      "center",

                    padding:
                      "15px 18px",

                    borderBottom:
                      "1px solid #eef1f5",

                    fontSize:
                      "13px",
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        700,
                    }}
                  >
                    {formatDateTime(
                      session.scheduled_start
                    )
                      .split(
                        " "
                      )
                      .slice(
                        -1
                      )
                      .join(
                        " "
                      )}
                  </div>

                  <div>
                    <div
                      style={{
                        color:
                          "#101828",

                        fontWeight:
                          800,
                      }}
                    >
                      {getStudentName(
                        session.enrollment_id
                      )}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "3px",

                        color:
                          "#98a2b3",

                        fontSize:
                          "11px",
                      }}
                    >
                      {
                        session.lesson_number
                      }
                      회차
                    </div>
                  </div>

                  <div
                    style={{
                      color:
                        "#475467",
                    }}
                  >
                    {getCourseName(
                      session.enrollment_id
                    )}
                  </div>

                  <div
                    style={{
                      color:
                        "#475467",
                    }}
                  >
                    {getTeacherName(
                      session.enrollment_id
                    )}
                  </div>

                  <div>
                    {getSessionStatusLabel(
                      session.status
                    )}
                  </div>

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

                        border:
                          `1px solid ${badge.border}`,

                        borderRadius:
                          "999px",

                        color:
                          badge.color,

                        background:
                          badge.background,

                        fontSize:
                          "11px",

                        fontWeight:
                          900,
                      }}
                    >
                      {getAttendanceLabel(
                        attendanceStatus
                      )}
                    </span>
                  </div>

                  <Link
                    href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                    style={{
                      color:
                        "#2f6fed",

                      textDecoration:
                        "none",

                      fontSize:
                        "12px",

                      fontWeight:
                        900,

                      textAlign:
                        "right",
                    }}
                  >
                    상세 →
                  </Link>
                </div>
              );
            }
          )
        )}
      </section>
    </div>
  );
}