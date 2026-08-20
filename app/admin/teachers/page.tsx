import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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

type ClassSession = {
  id: number;
  enrollment_id: number;
  scheduled_start: string;
  status: string;
};

function getEnrollmentStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "대기";
    case "active":
      return "수강중";
    case "paused":
      return "일시중지";
    case "completed":
      return "수강완료";
    case "cancelled":
      return "취소";
    default:
      return status;
  }
}

export default async function AdminTeachersPage({
  searchParams,
}: PageProps) {
  const { q = "", status = "all" } =
    await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const [
    teachersResult,
    enrollmentsResult,
  ] = await Promise.all([
    supabase
      .from("teacher_profiles")
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
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        teacher_user_id,
        status
      `)
      .not("teacher_user_id", "is", null),
  ]);

  const firstError =
    teachersResult.error ||
    enrollmentsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const teachers =
    (teachersResult.data ?? []) as TeacherProfile[];

  const enrollments =
    (enrollmentsResult.data ?? []) as Enrollment[];

  const teacherIds = teachers.map(
    (teacher) => teacher.user_id
  );

  let profiles: Profile[] = [];

  if (teacherIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, phone, profile_image_url")
      .in("id", teacherIds);

    if (error) {
      throw new Error(error.message);
    }

    profiles = (data ?? []) as Profile[];
  }

  const enrollmentIds = enrollments.map(
    (enrollment) => enrollment.id
  );

  let sessions: ClassSession[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        scheduled_start,
        status
      `)
      .in("enrollment_id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    sessions =
      (data ?? []) as ClassSession[];
  }

  const profileMap = new Map(
    profiles.map((item) => [item.id, item])
  );

  const enrollmentMap = new Map(
    enrollments.map((item) => [
      item.id,
      item,
    ])
  );

  const seoulDate =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  const todayStart = new Date(
    `${seoulDate}T00:00:00+09:00`
  );

  const tomorrowStart = new Date(
    `${seoulDate}T00:00:00+09:00`
  );

  tomorrowStart.setDate(
    tomorrowStart.getDate() + 1
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
    const teacherEnrollmentIds =
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
        teacherEnrollmentIds.has(
          session.enrollment_id
        )
    );
  }

  function getTodaySessionCount(
    teacherUserId: string
  ) {
    return getTeacherSessions(
      teacherUserId
    ).filter((session) => {
      const start = new Date(
        session.scheduled_start
      );

      return (
        start >= todayStart &&
        start < tomorrowStart
      );
    }).length;
  }

  function getAssignedStudentCount(
    teacherUserId: string
  ) {
    const uniqueStudentKeys =
      new Set<string>();

    for (const enrollment of getTeacherEnrollments(
      teacherUserId
    )) {
      if (enrollment.child_id) {
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

  const normalizedQuery =
    q.trim().toLowerCase();

  const rows = teachers
    .map((teacher) => {
      const teacherProfile =
        profileMap.get(
          teacher.user_id
        );

      const teacherEnrollments =
        getTeacherEnrollments(
          teacher.user_id
        );

      const activeEnrollmentCount =
        teacherEnrollments.filter(
          (enrollment) =>
            enrollment.status === "active"
        ).length;

      const teacherSessions =
        getTeacherSessions(
          teacher.user_id
        );

      return {
        ...teacher,
        realName:
          teacherProfile?.name || "-",
        phone:
          teacherProfile?.phone || "-",
        profileImageUrl:
          teacherProfile?.profile_image_url || null,
        assignedStudentCount:
          getAssignedStudentCount(
            teacher.user_id
          ),
        activeEnrollmentCount,
        todaySessionCount:
          getTodaySessionCount(
            teacher.user_id
          ),
        totalSessionCount:
          teacherSessions.length,
      };
    })
    .filter((teacher) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          teacher.display_name || "",
          teacher.realName,
          teacher.nationality || "",
          teacher.phone,
          ...(teacher.specialties ?? []),
        ].some((value) =>
          value
            .toLowerCase()
            .includes(
              normalizedQuery
            )
        );

      const matchesStatus =
        status === "all" ||
        (status === "active" &&
          teacher.is_active) ||
        (status === "inactive" &&
          !teacher.is_active);

      return (
        matchesSearch &&
        matchesStatus
      );
    });

  const activeTeacherCount =
    teachers.filter(
      (teacher) => teacher.is_active
    ).length;

  const inactiveTeacherCount =
    teachers.length -
    activeTeacherCount;

  const totalAssignedStudents =
    teachers.reduce(
      (sum, teacher) =>
        sum +
        getAssignedStudentCount(
          teacher.user_id
        ),
      0
    );

  const totalTodaySessions =
    teachers.reduce(
      (sum, teacher) =>
        sum +
        getTodaySessionCount(
          teacher.user_id
        ),
      0
    );

  return (
    <div>
      <div
        style={{
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
            강사 관리
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            강사 계정, 담당 학생,
            진행 중 수강 및 수업 현황을
            확인합니다.
          </p>
        </div>

        <Link
          href="/admin/teachers/new"
          style={{
            padding: "11px 16px",
            border:
              "1px solid #d6deea",
            borderRadius: "9px",
            color: "#ffffff",
            background: "#0a1f44",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          + 강사 등록
        </Link>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label: "전체 강사",
            value: teachers.length,
          },
          {
            label: "활성 강사",
            value: activeTeacherCount,
          },
          {
            label: "비활성 강사",
            value:
              inactiveTeacherCount,
          },
          {
            label: "담당 학생",
            value:
              totalAssignedStudents,
          },
          {
            label: "오늘 수업",
            value: totalTodaySessions,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "20px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "12px",
              background:
                "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                opacity: 0.58,
              }}
            >
              {item.label}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "30px",
                fontWeight: 800,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <form
        method="get"
        style={{
          marginTop: "22px",
          padding: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "12px",
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
          defaultValue={q}
          placeholder="강사명, 국적, 연락처, 전문분야 검색"
          style={{
            minWidth: 0,
            padding: "11px 12px",
            border:
              "1px solid #d6deea",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#101828",
          }}
        />

        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "11px 12px",
            border:
              "1px solid #d6deea",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#101828",
          }}
        >
          <option value="all">
            전체 상태
          </option>
          <option value="active">
            활성
          </option>
          <option value="inactive">
            비활성
          </option>
        </select>

        <button
          type="submit"
          style={{
            padding: "11px 18px",
            border:
              "1px solid #d6deea",
            borderRadius: "8px",
            background: "#0a1f44",
            color: "#ffffff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          검색
        </button>
      </form>

      <section
        style={{
          marginTop: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          overflow: "hidden",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(170px, 1.1fr) 110px 120px 120px 100px 110px 90px",
            gap: "12px",
            padding: "14px 18px",
            borderBottom:
              "1px solid #e7ebf0",
            fontSize: "12px",
            fontWeight: 700,
            opacity: 0.55,
          }}
        >
          <div>강사</div>
          <div>국적</div>
          <div>담당 학생</div>
          <div>진행 수강</div>
          <div>오늘 수업</div>
          <div>전체 수업</div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "36px",
              textAlign: "center",
              opacity: 0.62,
            }}
          >
            조건에 맞는 강사가 없습니다.
          </div>
        ) : (
          rows.map((teacher) => (
            <div
              key={teacher.user_id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(170px, 1.1fr) 110px 120px 120px 100px 110px 90px",
                gap: "12px",
                alignItems: "center",
                padding: "16px 18px",
                borderBottom:
                  "1px solid #eef1f5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  minWidth: 0,
                }}
              >
                {teacher.profileImageUrl ? (
                  <img
                    src={teacher.profileImageUrl}
                    alt={`${teacher.display_name || teacher.realName || "강사"} 프로필`}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid #d6deea",
                      background: "#f2f4f7",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#eaf2ff",
                      color: "#0a1f44",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {(teacher.display_name ||
                      teacher.realName ||
                      "T")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#101828",
                    }}
                  >
                    {teacher.display_name ||
                      teacher.realName ||
                      "이름 미등록 강사"}
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#667085",
                    }}
                  >
                    실명: {teacher.realName} ·{" "}
                    <span
                      style={{
                        color: teacher.is_active
                          ? "#14804a"
                          : "#667085",
                        fontWeight: 800,
                      }}
                    >
                      {teacher.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {teacher.nationality ||
                  "-"}
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {
                  teacher.assignedStudentCount
                }
                명
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {
                  teacher.activeEnrollmentCount
                }
                건
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {
                  teacher.todaySessionCount
                }
                건
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {
                  teacher.totalSessionCount
                }
                건
              </div>

              <Link
                href={`/admin/teachers/${teacher.user_id}`}
                style={{
                  textAlign: "center",
                  padding: "9px 10px",
                  background: "#ffffff",
                  border:
                    "1px solid #d6deea",
                  borderRadius: "8px",
                  color: "inherit",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                상세
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}