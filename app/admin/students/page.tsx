import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

type ChildStudent = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  parent_user_id: string;
  is_active: boolean;
  created_at: string;
};

type AdultStudentProfile = {
  user_id: string;
};

type Profile = {
  id: string;
  name: string | null;
  role: string;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  created_at: string;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type StudentRow = {
  key: string;
  type: "child" | "adult";
  name: string;
  subInfo: string;
  parentName: string;
  courseName: string;
  teacherName: string;
  enrollmentStatus: string;
  detailHref: string;
};

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

export default async function AdminStudentsPage({
  searchParams,
}: PageProps) {
  const { q = "", status = "all" } = await searchParams;

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

  const [
    childrenResult,
    adultProfilesResult,
    enrollmentsResult,
    coursesResult,
    teachersResult,
  ] = await Promise.all([
    supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        school_name,
        parent_user_id,
        is_active,
        created_at
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("student_profiles")
      .select("user_id"),

    supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status,
        created_at
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("courses")
      .select("id, name"),

    supabase
      .from("teacher_profiles")
      .select("user_id, display_name"),
  ]);

  const firstError =
    childrenResult.error ||
    adultProfilesResult.error ||
    enrollmentsResult.error ||
    coursesResult.error ||
    teachersResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const children =
    (childrenResult.data ?? []) as ChildStudent[];

  const adultStudentProfiles =
    (adultProfilesResult.data ?? []) as AdultStudentProfile[];

  const enrollments =
    (enrollmentsResult.data ?? []) as Enrollment[];

  const courses =
    (coursesResult.data ?? []) as Course[];

  const teachers =
    (teachersResult.data ?? []) as Teacher[];

  const profileIds = Array.from(
    new Set([
      ...children.map((child) => child.parent_user_id),
      ...adultStudentProfiles.map((student) => student.user_id),
    ])
  );

  let profiles: Profile[] = [];

  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", profileIds);

    if (error) {
      throw new Error(error.message);
    }

    profiles = (data ?? []) as Profile[];
  }

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const courseMap = new Map(
    courses.map((course) => [course.id, course.name])
  );

  const teacherMap = new Map(
    teachers.map((teacher) => [
      teacher.user_id,
      teacher.display_name || "이름 미등록 강사",
    ])
  );

  function getLatestEnrollmentForChild(childId: number) {
    return enrollments.find(
      (enrollment) => enrollment.child_id === childId
    );
  }

  function getLatestEnrollmentForAdult(studentUserId: string) {
    return enrollments.find(
      (enrollment) =>
        enrollment.student_user_id === studentUserId
    );
  }

  function buildEnrollmentInfo(
    enrollment: Enrollment | undefined
  ) {
    if (!enrollment) {
      return {
        courseName: "-",
        teacherName: "미배정",
        enrollmentStatus: "수강 정보 없음",
      };
    }

    return {
      courseName:
        courseMap.get(enrollment.course_id) ||
        `과정 #${enrollment.course_id}`,
      teacherName: enrollment.teacher_user_id
        ? teacherMap.get(enrollment.teacher_user_id) || "미배정"
        : "미배정",
      enrollmentStatus:
        getEnrollmentStatusLabel(enrollment.status),
    };
  }

  const childRows: StudentRow[] = children.map((child) => {
    const enrollment =
      getLatestEnrollmentForChild(child.id);

    const enrollmentInfo =
      buildEnrollmentInfo(enrollment);

    return {
      key: `child-${child.id}`,
      type: "child",
      name: child.name,
      subInfo:
        [child.school_name, child.grade]
          .filter(Boolean)
          .join(" · ") || "학교/학년 미등록",
      parentName:
        profileMap.get(child.parent_user_id)?.name ||
        "학부모 이름 미등록",
      ...enrollmentInfo,
      detailHref: `/admin/students/child/${child.id}`,
    };
  });

  const adultRows: StudentRow[] =
    adultStudentProfiles.map((student) => {
      const profile = profileMap.get(student.user_id);
      const enrollment =
        getLatestEnrollmentForAdult(student.user_id);

      const enrollmentInfo =
        buildEnrollmentInfo(enrollment);

      return {
        key: `adult-${student.user_id}`,
        type: "adult",
        name: profile?.name || "성인 학생",
        subInfo: "성인 학생 계정",
        parentName: "-",
        ...enrollmentInfo,
        detailHref: `/admin/students/adult/${student.user_id}`,
      };
    });

  const normalizedQuery = q.trim().toLowerCase();

  const rows = [...childRows, ...adultRows].filter((row) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [
        row.name,
        row.subInfo,
        row.parentName,
        row.courseName,
        row.teacherName,
      ].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );

    const matchesStatus =
      status === "all" ||
      row.enrollmentStatus ===
        getEnrollmentStatusLabel(status);

    return matchesQuery && matchesStatus;
  });

  const activeCount = [...childRows, ...adultRows].filter(
    (row) => row.enrollmentStatus === "수강중"
  ).length;

  const pendingCount = [...childRows, ...adultRows].filter(
    (row) => row.enrollmentStatus === "수강 대기"
  ).length;

  const noEnrollmentCount = [...childRows, ...adultRows].filter(
    (row) => row.enrollmentStatus === "수강 정보 없음"
  ).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
              letterSpacing: "-0.03em",
            }}
          >
            학생 관리
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            학생 정보와 현재 수강·담당 강사를 확인합니다.
          </p>
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label: "전체 학생",
            value: childRows.length + adultRows.length,
          },
          {
            label: "수강중",
            value: activeCount,
          },
          {
            label: "수강 대기",
            value: pendingCount,
          },
          {
            label: "수강 미등록",
            value: noEnrollmentCount,
          },
        ].map((item) => (
          <div
            key={item.label}
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
            "1px solid rgba(255,255,255,0.16)",
          borderRadius: "12px",
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) 180px auto",
          gap: "10px",
          background:
            "rgba(255,255,255,0.03)",
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="학생명, 학부모, 과정, 강사 검색"
          style={{
            minWidth: 0,
            padding: "11px 12px",
            border:
              "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        />

        <select
          name="status"
          defaultValue={status}
          style={{
            padding: "11px 12px",
            border:
              "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
          }}
        >
          <option value="all">전체 상태</option>
          <option value="active">수강중</option>
          <option value="pending">수강 대기</option>
          <option value="paused">일시중지</option>
          <option value="completed">수강 완료</option>
          <option value="cancelled">취소</option>
        </select>

        <button
          type="submit"
          style={{
            padding: "11px 18px",
            border:
              "1px solid rgba(255,255,255,0.22)",
            borderRadius: "8px",
            background: "#f5f5f5",
            color: "#111",
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
            "1px solid rgba(255,255,255,0.16)",
          borderRadius: "14px",
          overflow: "hidden",
          background:
            "rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(160px, 1.1fr) minmax(130px, 0.9fr) minmax(150px, 1fr) minmax(140px, 1fr) 110px 90px",
            gap: "12px",
            padding: "14px 18px",
            borderBottom:
              "1px solid rgba(255,255,255,0.14)",
            fontSize: "12px",
            fontWeight: 700,
            opacity: 0.55,
          }}
        >
          <div>학생</div>
          <div>학부모</div>
          <div>과정</div>
          <div>담당 강사</div>
          <div>상태</div>
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
            조건에 맞는 학생이 없습니다.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(160px, 1.1fr) minmax(130px, 0.9fr) minmax(150px, 1fr) minmax(140px, 1fr) 110px 90px",
                gap: "12px",
                alignItems: "center",
                padding: "16px 18px",
                borderBottom:
                  "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                  }}
                >
                  {row.name}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    opacity: 0.5,
                  }}
                >
                  {row.subInfo}
                </div>
              </div>

              <div>{row.parentName}</div>
              <div>{row.courseName}</div>
              <div>{row.teacherName}</div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {row.enrollmentStatus}
              </div>

              <Link
                href={row.detailHref}
                style={{
                  textAlign: "center",
                  padding: "9px 10px",
                  border:
                    "1px solid rgba(255,255,255,0.18)",
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