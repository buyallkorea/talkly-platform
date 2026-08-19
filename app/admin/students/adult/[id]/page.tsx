import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getEnrollmentStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "수강 대기";
    case "active":
      return "수강중";
    case "paused":
      return "일시중지";
    case "completed":
      return "수강 완료";
    case "cancelled":
      return "취소";
    default:
      return status;
  }
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "completed":
      return "완료";
    case "cancelled":
      return "취소";
    case "no_show":
      return "무단결석";
    case "held":
      return "결석 승인";
    default:
      return status;
  }
}

function getAttendanceStatusLabel(status: string) {
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

function getHoldStatusLabel(status: string) {
  switch (status) {
    case "requested":
      return "승인 대기";
    case "approved":
      return "승인";
    case "rejected":
      return "거절";
    case "cancelled":
      return "신청 취소";
    default:
      return status;
  }
}

export default async function AdminAdultStudentDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const {
    data: studentProfile,
    error: studentProfileError,
  } = await supabase
    .from("student_profiles")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle();

  if (studentProfileError) {
    throw new Error(studentProfileError.message);
  }

  if (!studentProfile) {
    notFound();
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      role,
      created_at
    `)
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    notFound();
  }

  const {
    data: enrollments,
    error: enrollmentsError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      course_id,
      teacher_user_id,
      status,
      start_date,
      end_date,
      lessons_per_week,
      total_lessons,
      created_at
    `)
    .eq("student_user_id", profile.id)
    .order("created_at", {
      ascending: false,
    });

  if (enrollmentsError) {
    throw new Error(enrollmentsError.message);
  }

  const enrollmentList = enrollments ?? [];
  const enrollmentIds = enrollmentList.map(
    (item) => item.id
  );

  const courseIds = Array.from(
    new Set(
      enrollmentList.map(
        (item) => item.course_id
      )
    )
  );

  const teacherIds = Array.from(
    new Set(
      enrollmentList
        .map(
          (item) => item.teacher_user_id
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const [
    coursesResult,
    teachersResult,
  ] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    teacherIds.length > 0
      ? supabase
          .from("teacher_profiles")
          .select(
            "user_id, display_name"
          )
          .in("user_id", teacherIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (coursesResult.error) {
    throw new Error(
      coursesResult.error.message
    );
  }

  if (teachersResult.error) {
    throw new Error(
      teachersResult.error.message
    );
  }

  const courseMap = new Map(
    (coursesResult.data ?? []).map(
      (item) => [
        item.id,
        item.name,
      ]
    )
  );

  const teacherMap = new Map(
    (teachersResult.data ?? []).map(
      (item) => [
        item.user_id,
        item.display_name ||
          "이름 미등록 강사",
      ]
    )
  );

  let sessions: {
    id: number;
    enrollment_id: number;
    lesson_number: number;
    scheduled_start: string;
    scheduled_end: string;
    status: string;
  }[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          lesson_number,
          scheduled_start,
          scheduled_end,
          status
        `)
        .in(
          "enrollment_id",
          enrollmentIds
        )
        .order("scheduled_start", {
          ascending: false,
        });

    if (error) {
      throw new Error(error.message);
    }

    sessions = data ?? [];
  }

  const sessionIds = sessions.map(
    (item) => item.id
  );

  let attendance: {
    id: number;
    class_session_id: number;
    status: string;
    attended_at: string | null;
  }[] = [];

  let evaluations: {
    id: number;
    class_session_id: number;
    participation_score:
      | number
      | null;
    comprehension_score:
      | number
      | null;
    speaking_score: number | null;
    pronunciation_score:
      | number
      | null;
    updated_at: string;
  }[] = [];

  let holds: {
    id: number;
    class_session_id: number;
    status: string;
    requested_at: string;
  }[] = [];

  if (sessionIds.length > 0) {
    const [
      attendanceResult,
      evaluationsResult,
      holdsResult,
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select(`
          id,
          class_session_id,
          status,
          attended_at
        `)
        .in(
          "class_session_id",
          sessionIds
        ),

      supabase
        .from("evaluations")
        .select(`
          id,
          class_session_id,
          participation_score,
          comprehension_score,
          speaking_score,
          pronunciation_score,
          updated_at
        `)
        .in(
          "class_session_id",
          sessionIds
        ),

      supabase
        .from("class_holds")
        .select(`
          id,
          class_session_id,
          status,
          requested_at
        `)
        .in(
          "class_session_id",
          sessionIds
        )
        .order("requested_at", {
          ascending: false,
        }),
    ]);

    const firstError =
      attendanceResult.error ||
      evaluationsResult.error ||
      holdsResult.error;

    if (firstError) {
      throw new Error(
        firstError.message
      );
    }

    attendance =
      attendanceResult.data ?? [];

    evaluations =
      evaluationsResult.data ?? [];

    holds =
      holdsResult.data ?? [];
  }

  const activeEnrollment =
    enrollmentList.find(
      (item) =>
        item.status === "active"
    ) ??
    enrollmentList[0] ??
    null;

  const attendanceMap = new Map(
    attendance.map((item) => [
      item.class_session_id,
      item,
    ])
  );

  const evaluationMap = new Map(
    evaluations.map((item) => [
      item.class_session_id,
      item,
    ])
  );

  const holdMap = new Map<
    number,
    (typeof holds)[number]
  >();

  for (const hold of holds) {
    if (
      !holdMap.has(
        hold.class_session_id
      )
    ) {
      holdMap.set(
        hold.class_session_id,
        hold
      );
    }
  }

  const presentCount =
    attendance.filter(
      (item) =>
        item.status === "present"
    ).length;

  const lateCount =
    attendance.filter(
      (item) =>
        item.status === "late"
    ).length;

  const absentCount =
    attendance.filter(
      (item) =>
        item.status === "absent" ||
        item.status === "excused"
    ).length;

  const completedCount =
    sessions.filter(
      (item) =>
        item.status === "completed"
    ).length;

  const pendingHoldCount =
    holds.filter(
      (item) =>
        item.status === "requested"
    ).length;

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentList.find(
        (item) =>
          item.id === enrollmentId
      );

    if (!enrollment) {
      return "-";
    }

    return (
      courseMap.get(
        enrollment.course_id
      ) ||
      `과정 #${enrollment.course_id}`
    );
  }

  function getTeacherName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentList.find(
        (item) =>
          item.id === enrollmentId
      );

    if (
      !enrollment?.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teacherMap.get(
        enrollment.teacher_user_id
      ) || "미배정"
    );
  }

  return (
    <div>
      <Link
        href="/admin/students"
        style={{
          color: "inherit",
          textDecoration: "none",
          fontSize: "14px",
          opacity: 0.72,
        }}
      >
        ← 학생 관리
      </Link>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              letterSpacing:
                "-0.03em",
            }}
          >
            {profile.name ||
              "성인 학생"}
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            성인 학생의 수강, 수업,
            출결 및 평가를 확인합니다.
          </p>
        </div>

        <div
          style={{
            padding: "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          성인 학생
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          [
            "전체 수업",
            sessions.length,
          ],
          [
            "완료 수업",
            completedCount,
          ],
          ["출석", presentCount],
          ["지각", lateCount],
          ["결석", absentCount],
          [
            "등록 평가",
            evaluations.length,
          ],
          [
            "승인 대기 결석",
            pendingHoldCount,
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "20px",
              border:
                "1px solid rgba(255,255,255,0.16)",
              borderRadius: "12px",
              background:
                "rgba(255,255,255,0.03)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                opacity: 0.58,
              }}
            >
              {label}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "29px",
                fontWeight: 800,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: "22px",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(280px, 0.8fr)",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            padding: "24px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "14px",
            background:
              "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            학생 기본정보
          </h2>

          <p>
            <strong>이름:</strong>{" "}
            {profile.name || "-"}
          </p>

          <p>
            <strong>계정 유형:</strong>{" "}
            성인 학생
          </p>

          <p style={{ marginBottom: 0 }}>
            <strong>가입일:</strong>{" "}
            {formatDateTime(
              profile.created_at
            )}
          </p>
        </div>

        <div
          style={{
            padding: "24px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius: "14px",
            background:
              "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            현재 수강
          </h2>

          {activeEnrollment ? (
            <>
              <p>
                <strong>과정:</strong>{" "}
                {courseMap.get(
                  activeEnrollment.course_id
                ) || "-"}
              </p>

              <p>
                <strong>담당 강사:</strong>{" "}
                {activeEnrollment.teacher_user_id
                  ? teacherMap.get(
                      activeEnrollment.teacher_user_id
                    ) || "미배정"
                  : "미배정"}
              </p>

              <p>
                <strong>상태:</strong>{" "}
                {getEnrollmentStatusLabel(
                  activeEnrollment.status
                )}
              </p>

              <p>
                <strong>수강기간:</strong>{" "}
                {activeEnrollment.start_date ||
                  "-"}{" "}
                ~{" "}
                {activeEnrollment.end_date ||
                  "-"}
              </p>

              <p>
                <strong>주당 수업:</strong>{" "}
                {activeEnrollment.lessons_per_week ??
                  "-"}
                회
              </p>

              <p style={{ marginBottom: 0 }}>
                <strong>총 수업:</strong>{" "}
                {activeEnrollment.total_lessons ??
                  "-"}
                회
              </p>

              <Link
                href={`/admin/enrollments/${activeEnrollment.id}`}
                style={{
                  display: "inline-block",
                  marginTop: "18px",
                  padding: "10px 13px",
                  border:
                    "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "8px",
                  color: "inherit",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                수강 상세
              </Link>
            </>
          ) : (
            <p style={{ marginBottom: 0 }}>
              등록된 수강정보가 없습니다.
            </p>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: "18px",
          padding: "24px",
          border:
            "1px solid rgba(255,255,255,0.16)",
          borderRadius: "14px",
          background:
            "rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "18px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              최근 수업
            </h2>

            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                fontSize: "13px",
                opacity: 0.56,
              }}
            >
              최근 수업 10건을
              표시합니다.
            </p>
          </div>

          {activeEnrollment && (
            <Link
              href={`/admin/enrollments/${activeEnrollment.id}`}
              style={{
                color: "inherit",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              전체 수업 보기
            </Link>
          )}
        </div>

        {sessions.length === 0 ? (
          <div
            style={{
              padding: "24px",
              border:
                "1px dashed rgba(255,255,255,0.2)",
              borderRadius: "10px",
              opacity: 0.62,
            }}
          >
            등록된 수업이 없습니다.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "9px",
            }}
          >
            {sessions
              .slice(0, 10)
              .map((session) => {
                const attendanceItem =
                  attendanceMap.get(
                    session.id
                  );

                const evaluationItem =
                  evaluationMap.get(
                    session.id
                  );

                const holdItem =
                  holdMap.get(
                    session.id
                  );

                return (
                  <Link
                    key={session.id}
                    href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "80px minmax(0, 1.4fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr) 90px",
                      gap: "14px",
                      alignItems:
                        "center",
                      padding: "14px",
                      border:
                        "1px solid rgba(255,255,255,0.12)",
                      borderRadius:
                        "10px",
                      color: "inherit",
                      textDecoration:
                        "none",
                    }}
                  >
                    <strong>
                      {
                        session.lesson_number
                      }
                      회차
                    </strong>

                    <div>
                      <div>
                        {formatDateTime(
                          session.scheduled_start
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          fontSize:
                            "12px",
                          opacity: 0.52,
                        }}
                      >
                        {getCourseName(
                          session.enrollment_id
                        )}{" "}
                        ·{" "}
                        {getTeacherName(
                          session.enrollment_id
                        )}
                      </div>
                    </div>

                    <div>
                      {attendanceItem
                        ? getAttendanceStatusLabel(
                            attendanceItem.status
                          )
                        : "출결 미등록"}
                    </div>

                    <div>
                      {evaluationItem
                        ? "평가 완료"
                        : "평가 미작성"}
                    </div>

                    <div
                      style={{
                        textAlign:
                          "right",
                        fontWeight: 700,
                      }}
                    >
                      {holdItem
                        ? getHoldStatusLabel(
                            holdItem.status
                          )
                        : getSessionStatusLabel(
                            session.status
                          )}
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}