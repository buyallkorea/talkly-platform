import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminEnrollmentsPage() {
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

  // 수강정보 조회
  const { data: enrollments, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons,
        created_at
      `)
      .order("created_at", { ascending: false });

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  // 자녀 목록
  const { data: children, error: childrenError } =
    await supabase
      .from("children")
      .select("id, name");

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  // 과정 목록
  const { data: courses, error: coursesError } =
    await supabase
      .from("courses")
      .select("id, name");

  if (coursesError) {
    throw new Error(coursesError.message);
  }

  // 강사 목록
  const { data: teachers, error: teachersError } =
    await supabase
      .from("teacher_profiles")
      .select("user_id, display_name");

  if (teachersError) {
    throw new Error(teachersError.message);
  }

  // 성인 학생 계정 이름 조회
  const { data: studentProfiles, error: studentsError } =
    await supabase
      .from("student_profiles")
      .select("user_id");

  if (studentsError) {
    throw new Error(studentsError.message);
  }

  const studentIds =
    studentProfiles?.map((student) => student.user_id) ?? [];

  let adultStudentNames: {
    id: string;
    name: string | null;
  }[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);

    if (error) {
      throw new Error(error.message);
    }

    adultStudentNames = data ?? [];
  }

  function getStudentName(
    childId: number | null,
    studentUserId: string | null
  ) {
    if (childId) {
      const child = children?.find(
        (item) => item.id === childId
      );

      return child?.name || `자녀 #${childId}`;
    }

    if (studentUserId) {
      const student = adultStudentNames.find(
        (item) => item.id === studentUserId
      );

      return student?.name || "성인 학생";
    }

    return "학생 정보 없음";
  }

  function getCourseName(courseId: number) {
    const course = courses?.find(
      (item) => item.id === courseId
    );

    return course?.name || `과정 #${courseId}`;
  }

  function getTeacherName(
    teacherUserId: string | null
  ) {
    if (!teacherUserId) {
      return "미배정";
    }

    const teacher = teachers?.find(
      (item) => item.user_id === teacherUserId
    );

    return (
      teacher?.display_name ||
      "이름 미등록 강사"
    );
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "pending":
        return "대기";
      case "active":
        return "수강중";
      case "completed":
        return "수강완료";
      case "cancelled":
        return "취소";
      case "paused":
        return "일시중지";
      default:
        return status;
    }
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "8px" }}>
            수강 관리
          </h1>

          <p style={{ margin: 0 }}>
            학생과 자녀의 수강등록 및 강사 배정을 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments/new"
          style={{
            padding: "12px 18px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          + 수강 등록
        </Link>
      </div>

      {!enrollments || enrollments.length === 0 ? (
        <div
          style={{
            padding: "40px",
            border: "1px solid #ddd",
            borderRadius: "12px",
          }}
        >
          아직 등록된 수강정보가 없습니다.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              style={{
                padding: "26px",
                border: "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "20px",
                }}
              >
                <div>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: "20px",
                    }}
                  >
                    {getStudentName(
                      enrollment.child_id,
                      enrollment.student_user_id
                    )}
                  </h2>

                  <p>
                    <strong>과정:</strong>{" "}
                    {getCourseName(
                      enrollment.course_id
                    )}
                  </p>

                  <p>
                    <strong>담당 강사:</strong>{" "}
                    {getTeacherName(
                      enrollment.teacher_user_id
                    )}
                  </p>

                  <p>
                    <strong>상태:</strong>{" "}
                    {getStatusLabel(
                      enrollment.status
                    )}
                  </p>

                  <p>
                    <strong>수강기간:</strong>{" "}
                    {enrollment.start_date || "-"} ~{" "}
                    {enrollment.end_date || "-"}
                  </p>

                  <p>
                    <strong>주당 수업:</strong>{" "}
                    {enrollment.lessons_per_week ??
                      "-"}
                    회
                  </p>

                  <p style={{ marginBottom: 0 }}>
                    <strong>총 수업:</strong>{" "}
                    {enrollment.total_lessons ??
                      "-"}
                    회
                  </p>
                </div>

                <Link
                  href={`/admin/enrollments/${enrollment.id}`}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  상세보기
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}