import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    teacher?: string;
    status?: string;
  }>;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  meeting_provider: string | null;
  meeting_url: string | null;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
};

type Attendance = {
  class_session_id: number;
  status: string;
};

type Evaluation = {
  class_session_id: number;
};

type Child = {
  id: number;
  name: string;
};

type Profile = {
  id: string;
  name: string | null;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

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

    case "cancelled":
      return "수업 취소";

    case "no_show":
      return "결석";

    case "held":
      return "인정결석";

    default:
      return status;
  }
}

function getAttendanceStatusLabel(
  status: string
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
      return status;
  }
}

function formatTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(value)
  );
}

function formatDateLabel(
  value: Date
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }
  ).format(value);
}

export default async function AdminCalendarPage({
  searchParams,
}: PageProps) {
  const {
    q = "",
    teacher = "all",
    status = "all",
  } = await searchParams;

  const supabase =
    await createClient();

  /*
   * ==========================================
   * 관리자 인증
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
    adminProfile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 오늘 날짜
   * ==========================================
   */

  const now =
    new Date();

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
    ).format(now);

  const todayStart =
    new Date(
      `${seoulDate}T00:00:00+09:00`
    ).toISOString();

  const tomorrow =
    new Date(
      `${seoulDate}T00:00:00+09:00`
    );

  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  const tomorrowStart =
    tomorrow.toISOString();

  /*
   * ==========================================
   * 오늘 수업 / 강사
   * ==========================================
   */

  const [
    sessionsResult,
    teachersResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "class_sessions"
        )
        .select(`
          id,
          enrollment_id,
          lesson_number,
          scheduled_start,
          scheduled_end,
          status,
          meeting_provider,
          meeting_url
        `)
        .gte(
          "scheduled_start",
          todayStart
        )
        .lt(
          "scheduled_start",
          tomorrowStart
        )
        .order(
          "scheduled_start",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "teacher_profiles"
        )
        .select(
          "user_id, display_name"
        )
        .order(
          "display_name",
          {
            ascending:
              true,
          }
        ),
    ]);

  if (
    sessionsResult.error
  ) {
    throw new Error(
      sessionsResult.error.message
    );
  }

  if (
    teachersResult.error
  ) {
    throw new Error(
      teachersResult.error.message
    );
  }

  const sessions =
    (sessionsResult.data ??
      []) as ClassSession[];

  const teachers =
    (teachersResult.data ??
      []) as Teacher[];

  /*
   * ==========================================
   * 수강 정보
   * ==========================================
   */

  const enrollmentIds =
    Array.from(
      new Set(
        sessions.map(
          (session) =>
            session.enrollment_id
        )
      )
    );

  let enrollments: Enrollment[] =
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
        []) as Enrollment[];
  }

  /*
   * ==========================================
   * 관련 ID
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

  const studentIds =
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

  const sessionIds =
    sessions.map(
      (session) =>
        session.id
    );

  /*
   * ==========================================
   * 학생 / 과정 / 출결 / 평가
   * ==========================================
   */

  const [
    childrenResult,
    studentsResult,
    coursesResult,
    attendanceResult,
    evaluationsResult,
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

      studentIds.length >
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
              studentIds
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

      sessionIds.length >
      0
        ? supabase
            .from(
              "attendance"
            )
            .select(
              "class_session_id, status"
            )
            .in(
              "class_session_id",
              sessionIds
            )
        : Promise.resolve(
            {
              data: [],
              error:
                null,
            }
          ),

      sessionIds.length >
      0
        ? supabase
            .from(
              "evaluations"
            )
            .select(
              "class_session_id"
            )
            .in(
              "class_session_id",
              sessionIds
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
    attendanceResult.error ||
    evaluationsResult.error;

  if (
    lookupError
  ) {
    throw new Error(
      lookupError.message
    );
  }

  /*
   * ==========================================
   * MAP
   * ==========================================
   */

  const enrollmentMap =
    new Map(
      enrollments.map(
        (item) => [
          item.id,
          item,
        ]
      )
    );

  const childMap =
    new Map(
      (
        (
          childrenResult.data ??
          []
        ) as Child[]
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
        (
          studentsResult.data ??
          []
        ) as Profile[]
      ).map(
        (item) => [
          item.id,
          item.name ||
            "성인 학생",
        ]
      )
    );

  const courseMap =
    new Map(
      (
        (
          coursesResult.data ??
          []
        ) as Course[]
      ).map(
        (item) => [
          item.id,
          item.name,
        ]
      )
    );

  const teacherMap =
    new Map(
      teachers.map(
        (item) => [
          item.user_id,
          item.display_name ||
            "이름 미등록 강사",
        ]
      )
    );

  const attendanceMap =
    new Map(
      (
        (
          attendanceResult.data ??
          []
        ) as Attendance[]
      ).map(
        (item) => [
          item.class_session_id,
          item,
        ]
      )
    );

  const evaluationSet =
    new Set(
      (
        (
          evaluationsResult.data ??
          []
        ) as Evaluation[]
      ).map(
        (item) =>
          item.class_session_id
      )
    );

  /*
   * ==========================================
   * 표시용 함수
   * ==========================================
   */

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
        "성인 학생"
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
      !enrollment?.teacher_user_id
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
   * 검색 필터
   * ==========================================
   */

  const normalizedQuery =
    q
      .trim()
      .toLowerCase();

  const filteredSessions =
    sessions.filter(
      (session) => {
        const enrollment =
          enrollmentMap.get(
            session.enrollment_id
          );

        const studentName =
          getStudentName(
            session.enrollment_id
          );

        const courseName =
          getCourseName(
            session.enrollment_id
          );

        const teacherName =
          getTeacherName(
            session.enrollment_id
          );

        const matchesQuery =
          !normalizedQuery ||
          [
            studentName,
            courseName,
            teacherName,
          ].some(
            (value) =>
              value
                .toLowerCase()
                .includes(
                  normalizedQuery
                )
          );

        const matchesTeacher =
          teacher ===
            "all" ||
          enrollment
            ?.teacher_user_id ===
            teacher;

        const matchesStatus =
          status ===
            "all" ||
          session.status ===
            status;

        return (
          matchesQuery &&
          matchesTeacher &&
          matchesStatus
        );
      }
    );

  /*
   * ==========================================
   * 오늘 수업 통계
   * ==========================================
   */

  const scheduledCount =
    sessions.filter(
      (session) =>
        session.status ===
        "scheduled"
    ).length;

  const completedCount =
    sessions.filter(
      (session) =>
        session.status ===
        "completed"
    ).length;

  /*
   * 학생이 실제 수업에 참여하지 않아
   * 출석 확인 후 결석으로 확정된 수업
   */
  const absentCount =
    sessions.filter(
      (session) =>
        session.status ===
        "no_show"
    ).length;

  /*
   * 학생/학부모가 미리 결석을 신청하고
   * 승인되어 진행하지 않은 수업
   */
  const excusedCount =
    sessions.filter(
      (session) =>
        session.status ===
        "held"
    ).length;

  /*
   * 강사 사정 또는 운영상의 사유로
   * 수업 자체가 취소된 경우
   */
  const cancelledCount =
    sessions.filter(
      (session) =>
        session.status ===
        "cancelled"
    ).length;

  /*
   * 정상적으로 수업이 완료되었는데
   * 출결 데이터가 아직 없는 수업
   */
  const missingAttendanceCount =
    sessions.filter(
      (session) =>
        session.status ===
          "completed" &&
        !attendanceMap.has(
          session.id
        )
    ).length;

  /*
   * 정상적으로 수업이 완료되었는데
   * 강사 평가가 아직 없는 수업
   */
  const missingEvaluationCount =
    sessions.filter(
      (session) =>
        session.status ===
          "completed" &&
        !evaluationSet.has(
          session.id
        )
    ).length;

  return (
    <main
      style={{
        width:
          "100%",
        maxWidth:
          "1280px",
        margin:
          "0 auto",
        padding:
          "8px 0 60px",
      }}
    >
      {/* ======================================
          HEADER
      ====================================== */}

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
          <div
            style={{
              color:
                "#2f6fed",
              fontSize:
                "12px",
              fontWeight:
                900,
              letterSpacing:
                "0.08em",
            }}
          >
            TODAY&apos;S CLASSES
          </div>

          <h1
            style={{
              margin:
                "9px 0 0",
              color:
                "#101828",
              fontSize:
                "34px",
              letterSpacing:
                "-0.04em",
            }}
          >
            오늘 수업
          </h1>

          <p
            style={{
              margin:
                "10px 0 0",
              color:
                "#667085",
              lineHeight:
                1.7,
            }}
          >
            오늘 진행되는 전체
            수업과 출결·평가 처리
            상태를 시간순으로
            확인합니다.
          </p>
        </div>

        <div
          style={{
            padding:
              "11px 15px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "10px",
            background:
              "#fff",
            color:
              "#344054",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          {formatDateLabel(
            now
          )}
        </div>
      </div>

      {/* ======================================
          SUMMARY
      ====================================== */}

      <section
        style={{
          marginTop:
            "26px",
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(135px, 1fr))",
          gap:
            "12px",
        }}
      >
        <SummaryCard
          label="오늘 수업"
          value={
            sessions.length
          }
        />

        <SummaryCard
          label="예정"
          value={
            scheduledCount
          }
          tone="blue"
        />

        <SummaryCard
          label="완료"
          value={
            completedCount
          }
          tone="green"
        />

        <SummaryCard
          label="결석"
          value={
            absentCount
          }
          tone="red"
        />

        <SummaryCard
          label="인정결석"
          value={
            excusedCount
          }
          tone="orange"
        />

        <SummaryCard
          label="수업 취소"
          value={
            cancelledCount
          }
          tone="gray"
        />

        <SummaryCard
          label="출결 미처리"
          value={
            missingAttendanceCount
          }
          tone={
            missingAttendanceCount >
            0
              ? "red"
              : "gray"
          }
        />

        <SummaryCard
          label="평가 미작성"
          value={
            missingEvaluationCount
          }
          tone={
            missingEvaluationCount >
            0
              ? "red"
              : "gray"
          }
        />
      </section>

      {/* ======================================
          상태 설명
      ====================================== */}

      <section
        style={{
          marginTop:
            "18px",
          padding:
            "18px 20px",
          border:
            "1px solid #dbe7ff",
          borderRadius:
            "14px",
          background:
            "#f7faff",
        }}
      >
        <div
          style={{
            color:
              "#2f6fed",
            fontSize:
              "13px",
            fontWeight:
              900,
          }}
        >
          수업 상태 안내
        </div>

        <div
          style={{
            marginTop:
              "12px",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap:
              "9px 22px",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.65,
          }}
        >
          <StatusDescription
            title="예정"
            text="아직 시작하지 않은 수업입니다."
          />

          <StatusDescription
            title="완료"
            text="학생이 정상적으로 참여하고 수업이 종료된 경우입니다."
          />

          <StatusDescription
            title="결석"
            text="수업은 진행되었으나 학생이 참여하지 않아 결석으로 확정된 경우입니다."
          />

          <StatusDescription
            title="인정결석"
            text="학생 또는 학부모가 미리 결석을 신청하고 승인되어 수업을 진행하지 않은 경우입니다."
          />

          <StatusDescription
            title="수업 취소"
            text="강사 사정 또는 운영상의 사유로 수업 자체가 진행되지 않은 경우입니다."
          />

          <StatusDescription
            title="출결 미처리"
            text="수업은 종료되었지만 강사가 아직 학생의 출석 또는 결석을 확정하지 않은 경우입니다."
          />

          <StatusDescription
            title="평가 미작성"
            text="수업은 완료되었지만 강사의 수업 평가가 아직 작성되지 않은 경우입니다."
          />
        </div>
      </section>

      {/* ======================================
          CALENDAR TABS
      ====================================== */}

      <nav
        style={{
          marginTop:
            "22px",
          display:
            "flex",
          gap:
            "8px",
          flexWrap:
            "wrap",
        }}
      >
        <CalendarTab
          href="/admin/calendar"
          label="오늘"
          active
        />

        <CalendarTab
          href="/admin/calendar/week"
          label="주간"
        />

        <CalendarTab
          href="/admin/calendar/month"
          label="월간"
        />
      </nav>

      {/* ======================================
          FILTER
      ====================================== */}

      <form
        method="get"
        style={{
          marginTop:
            "18px",
          padding:
            "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          display:
            "grid",
          gridTemplateColumns:
            "minmax(240px, 1fr) 190px 170px auto auto",
          gap:
            "10px",
          background:
            "#fff",
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={
            q
          }
          placeholder="학생명, 강사명, 과정 검색"
          style={
            fieldStyle
          }
        />

        <select
          name="teacher"
          defaultValue={
            teacher
          }
          style={
            fieldStyle
          }
        >
          <option value="all">
            전체 강사
          </option>

          {teachers.map(
            (item) => (
              <option
                key={
                  item.user_id
                }
                value={
                  item.user_id
                }
              >
                {item.display_name ||
                  "이름 미등록 강사"}
              </option>
            )
          )}
        </select>

        <select
          name="status"
          defaultValue={
            status
          }
          style={
            fieldStyle
          }
        >
          <option value="all">
            전체 상태
          </option>

          <option value="scheduled">
            예정
          </option>

          <option value="in_progress">
            수업 중
          </option>

          <option value="completed">
            완료
          </option>

          <option value="no_show">
            결석
          </option>

          <option value="held">
            인정결석
          </option>

          <option value="cancelled">
            수업 취소
          </option>
        </select>

        <button
          type="submit"
          style={{
            minHeight:
              "44px",
            padding:
              "0 18px",
            border:
              0,
            borderRadius:
              "9px",
            background:
              "#0A1F44",
            color:
              "#fff",
            fontWeight:
              900,
            cursor:
              "pointer",
          }}
        >
          검색
        </button>

        <Link
          href="/admin/calendar"
          style={{
            minHeight:
              "44px",
            padding:
              "0 15px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "9px",
            background:
              "#fff",
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
          초기화
        </Link>
      </form>

      {/* ======================================
          업무 확인 알림
      ====================================== */}

      {(missingAttendanceCount >
        0 ||
        missingEvaluationCount >
          0) && (
        <section
          style={{
            marginTop:
              "16px",
            padding:
              "15px 18px",
            border:
              "1px solid #fed7aa",
            borderRadius:
              "12px",
            background:
              "#fffaf5",
            color:
              "#9a3412",
            fontSize:
              "13px",
            lineHeight:
              1.7,
          }}
        >
          <strong>
            오늘 처리 확인이
            필요합니다.
          </strong>{" "}

          {missingAttendanceCount >
            0 &&
            `출결 미처리 ${missingAttendanceCount}건`}

          {missingAttendanceCount >
            0 &&
            missingEvaluationCount >
              0 &&
            " · "}

          {missingEvaluationCount >
            0 &&
            `평가 미작성 ${missingEvaluationCount}건`}
        </section>
      )}

      {/* ======================================
          TABLE
      ====================================== */}

      <section
        style={{
          marginTop:
            "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          overflowX:
            "auto",
          background:
            "#fff",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.03)",
        }}
      >
        <div
          style={{
            minWidth:
              "1040px",
          }}
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "90px 80px minmax(150px,1fr) minmax(130px,1fr) minmax(150px,1fr) 110px 110px 110px",
              gap:
                "12px",
              padding:
                "14px 18px",
              borderBottom:
                "1px solid #eaecf0",
              background:
                "#f9fafb",
              color:
                "#667085",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            <div>시간</div>
            <div>회차</div>
            <div>학생</div>
            <div>강사</div>
            <div>과정</div>
            <div>출결</div>
            <div>평가</div>
            <div>수업 상태</div>
          </div>

          {filteredSessions.length ===
          0 ? (
            <div
              style={{
                padding:
                  "58px 24px",
                textAlign:
                  "center",
                color:
                  "#667085",
              }}
            >
              <div
                style={{
                  fontWeight:
                    800,
                  color:
                    "#344054",
                }}
              >
                조건에 맞는 오늘
                수업이 없습니다.
              </div>

              <div
                style={{
                  marginTop:
                    "7px",
                  fontSize:
                    "13px",
                }}
              >
                검색 조건을
                변경하거나
                초기화해주세요.
              </div>
            </div>
          ) : (
            filteredSessions.map(
              (
                session,
                index
              ) => {
                const attendanceItem =
                  attendanceMap.get(
                    session.id
                  );

                const attendanceLabel =
                  attendanceItem
                    ? getAttendanceStatusLabel(
                        attendanceItem.status
                      )
                    : "미등록";

                const evaluationDone =
                  evaluationSet.has(
                    session.id
                  );

                const attendanceWarning =
                  session.status ===
                    "completed" &&
                  !attendanceItem;

                return (
                  <Link
                    key={
                      session.id
                    }
                    href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "90px 80px minmax(150px,1fr) minmax(130px,1fr) minmax(150px,1fr) 110px 110px 110px",
                      gap:
                        "12px",
                      alignItems:
                        "center",
                      padding:
                        "17px 18px",
                      borderBottom:
                        index ===
                        filteredSessions.length -
                          1
                          ? "none"
                          : "1px solid #eef1f5",
                      color:
                        "#344054",
                      textDecoration:
                        "none",
                      fontSize:
                        "13px",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color:
                            "#101828",
                          fontSize:
                            "14px",
                        }}
                      >
                        {formatTime(
                          session.scheduled_start
                        )}
                      </strong>

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
                        ~{" "}
                        {formatTime(
                          session.scheduled_end
                        )}
                      </div>
                    </div>

                    <div>
                      {
                        session.lesson_number
                      }
                      회차
                    </div>

                    <div
                      style={{
                        color:
                          "#101828",
                        fontWeight:
                          900,
                      }}
                    >
                      {getStudentName(
                        session.enrollment_id
                      )}
                    </div>

                    <div>
                      {getTeacherName(
                        session.enrollment_id
                      )}
                    </div>

                    <div>
                      {getCourseName(
                        session.enrollment_id
                      )}
                    </div>

                    <SmallBadge
                      label={
                        attendanceLabel
                      }
                      warning={
                        attendanceWarning
                      }
                      positive={
                        attendanceItem?.status ===
                          "present" ||
                        attendanceItem?.status ===
                          "late"
                      }
                    />

                    <SmallBadge
                      label={
                        evaluationDone
                          ? "작성 완료"
                          : "미작성"
                      }
                      warning={
                        !evaluationDone &&
                        session.status ===
                          "completed"
                      }
                      positive={
                        evaluationDone
                      }
                    />

                    <SessionStatusBadge
                      status={
                        session.status
                      }
                      label={getSessionStatusLabel(
                        session.status
                      )}
                    />
                  </Link>
                );
              }
            )
          )}
        </div>
      </section>

      <div
        style={{
          marginTop:
            "14px",
          color:
            "#98a2b3",
          fontSize:
            "12px",
          textAlign:
            "right",
        }}
      >
        검색 결과{" "}
        {
          filteredSessions.length
        }
        건 / 오늘 전체{" "}
        {sessions.length}건
      </div>
    </main>
  );
}

/*
 * ==========================================
 * FIELD STYLE
 * ==========================================
 */

const fieldStyle = {
  width: "100%",
  minHeight: "44px",
  boxSizing:
    "border-box" as const,
  padding: "0 12px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "13px",
};

/*
 * ==========================================
 * SUMMARY CARD
 * ==========================================
 */

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?:
    | "default"
    | "blue"
    | "green"
    | "orange"
    | "red"
    | "gray";
}) {
  const tones = {
    default: {
      background:
        "#ffffff",
      border:
        "#e4e7ec",
      color:
        "#101828",
    },

    blue: {
      background:
        "#f5f8ff",
      border:
        "#d6e4ff",
      color:
        "#2f6fed",
    },

    green: {
      background:
        "#f6fef9",
      border:
        "#abefc6",
      color:
        "#027a48",
    },

    orange: {
      background:
        "#fffaf5",
      border:
        "#fed7aa",
      color:
        "#b54708",
    },

    red: {
      background:
        "#fef3f2",
      border:
        "#fecdca",
      color:
        "#b42318",
    },

    gray: {
      background:
        "#f9fafb",
      border:
        "#e4e7ec",
      color:
        "#475467",
    },
  };

  const style =
    tones[tone];

  return (
    <div
      style={{
        minHeight:
          "104px",
        padding:
          "18px",
        border:
          `1px solid ${style.border}`,
        borderRadius:
          "13px",
        background:
          style.background,
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "12px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "11px",
          color:
            style.color,
          fontSize:
            "29px",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/*
 * ==========================================
 * STATUS DESCRIPTION
 * ==========================================
 */

function StatusDescription({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",
        alignItems:
          "flex-start",
        gap:
          "7px",
      }}
    >
      <strong
        style={{
          flex:
            "0 0 auto",
          color:
            "#344054",
          fontWeight:
            900,
        }}
      >
        {title}
      </strong>

      <span
        style={{
          color:
            "#667085",
        }}
      >
        · {text}
      </span>
    </div>
  );
}

/*
 * ==========================================
 * CALENDAR TAB
 * ==========================================
 */

function CalendarTab({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        minHeight:
          "40px",
        padding:
          "0 16px",
        display:
          "inline-flex",
        alignItems:
          "center",
        justifyContent:
          "center",
        border:
          active
            ? "1px solid #0A1F44"
            : "1px solid #d0d5dd",
        borderRadius:
          "9px",
        background:
          active
            ? "#0A1F44"
            : "#fff",
        color:
          active
            ? "#fff"
            : "#475467",
        textDecoration:
          "none",
        fontSize:
          "13px",
        fontWeight:
          900,
      }}
    >
      {label}
    </Link>
  );
}

/*
 * ==========================================
 * SMALL BADGE
 * ==========================================
 */

function SmallBadge({
  label,
  warning = false,
  positive = false,
}: {
  label: string;
  warning?: boolean;
  positive?: boolean;
}) {
  const background =
    warning
      ? "#fff7ed"
      : positive
        ? "#ecfdf3"
        : "#f2f4f7";

  const color =
    warning
      ? "#b54708"
      : positive
        ? "#027a48"
        : "#475467";

  return (
    <div>
      <span
        style={{
          display:
            "inline-flex",
          minHeight:
            "27px",
          padding:
            "0 9px",
          alignItems:
            "center",
          borderRadius:
            "999px",
          background,
          color,
          fontSize:
            "11px",
          fontWeight:
            900,
          whiteSpace:
            "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/*
 * ==========================================
 * SESSION STATUS BADGE
 * ==========================================
 */

function SessionStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  let background =
    "#f2f4f7";

  let color =
    "#475467";

  if (
    status ===
    "scheduled"
  ) {
    background =
      "#eef4ff";
    color =
      "#2f6fed";
  }

  if (
    status ===
    "in_progress"
  ) {
    background =
      "#eef4ff";
    color =
      "#175cd3";
  }

  if (
    status ===
    "completed"
  ) {
    background =
      "#ecfdf3";
    color =
      "#027a48";
  }

  if (
    status ===
    "held"
  ) {
    background =
      "#fff7ed";
    color =
      "#b54708";
  }

  if (
    status ===
      "cancelled" ||
    status ===
      "no_show"
  ) {
    background =
      "#fef3f2";
    color =
      "#b42318";
  }

  return (
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
          borderRadius:
            "999px",
          background,
          color,
          fontSize:
            "11px",
          fontWeight:
            900,
          whiteSpace:
            "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}