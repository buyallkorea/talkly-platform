import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EnrollmentDetailPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const { data: enrollment, error } = await supabase
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
      created_at,
      updated_at
    `)
    .eq("id", Number(id))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!enrollment) {
    notFound();
  }

  let studentName = "학생 정보 없음";

  if (enrollment.child_id) {
    const { data: child } = await supabase
      .from("children")
      .select("name")
      .eq("id", enrollment.child_id)
      .maybeSingle();

    if (child?.name) {
      studentName = child.name;
    }
  } else if (enrollment.student_user_id) {
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", enrollment.student_user_id)
      .maybeSingle();

    studentName =
      studentProfile?.name || "성인 학생";
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name, duration_minutes")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  let teacherName = "미배정";

  if (enrollment.teacher_user_id) {
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("display_name")
      .eq("user_id", enrollment.teacher_user_id)
      .maybeSingle();

    if (teacher?.display_name) {
      teacherName = teacher.display_name;
    }
  }

  const {
    data: classSessions,
    error: classSessionsError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      lesson_number,
      scheduled_start,
      scheduled_end,
      status,
      meeting_provider,
      meeting_url,
      teacher_notes
    `)
    .eq("enrollment_id", enrollment.id)
    .order("lesson_number", {
      ascending: true,
    });

  if (classSessionsError) {
    throw new Error(classSessionsError.message);
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

  function getSessionStatusLabel(status: string) {
    switch (status) {
      case "scheduled":
        return "예정";
      case "completed":
        return "완료";
      case "absent":
        return "결석";
      case "makeup":
        return "보강";
      case "cancelled":
        return "취소";
      default:
        return status;
    }
  }

  function formatSessionDateTime(value: string) {
    const date = new Date(value);

    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    const startTime =
      new Date(start).getTime();

    const endTime =
      new Date(end).getTime();

    return Math.round(
      (endTime - startTime) / 60000
    );
  }

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin/enrollments"
        style={{
          textDecoration: "none",
        }}
      >
        ← 수강 목록
      </Link>

      <div
        style={{
          marginTop: "32px",
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
              marginTop: 0,
              marginBottom: "8px",
            }}
          >
            {studentName}
          </h1>

          <p style={{ margin: 0 }}>
            TALKLY 수강 상세정보
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/enrollments/${enrollment.id}/edit`}
            style={{
              padding: "12px 18px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            수강정보 수정
          </Link>

          {(!classSessions ||
            classSessions.length === 0) && (
            <Link
              href={`/admin/enrollments/${enrollment.id}/lessons/new`}
              style={{
                padding: "12px 18px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              수업 일정 생성
            </Link>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "32px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          수강 기본정보
        </h2>

        <p>
          <strong>학생:</strong>{" "}
          {studentName}
        </p>

        <p>
          <strong>과정:</strong>{" "}
          {course?.name ||
            `과정 #${enrollment.course_id}`}
        </p>

        <p>
          <strong>1회 수업시간:</strong>{" "}
          {course?.duration_minutes
            ? `${course.duration_minutes}분`
            : "-"}
        </p>

        <p>
          <strong>담당 강사:</strong>{" "}
          {teacherName}
        </p>

        <p>
          <strong>상태:</strong>{" "}
          {getStatusLabel(
            enrollment.status
          )}
        </p>

        <p>
          <strong>수강 시작일:</strong>{" "}
          {enrollment.start_date || "-"}
        </p>

        <p>
          <strong>수강 종료일:</strong>{" "}
          {enrollment.end_date || "-"}
        </p>

        <p>
          <strong>주당 수업 횟수:</strong>{" "}
          {enrollment.lessons_per_week ??
            "-"}
          회
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>총 수업 횟수:</strong>{" "}
          {enrollment.total_lessons ??
            "-"}
          회
        </p>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <div>
          <h2
            style={{
              marginTop: 0,
              marginBottom: "6px",
            }}
          >
            수업 일정
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.7,
            }}
          >
            생성된 수업:{" "}
            {classSessions?.length ?? 0}회
          </p>
        </div>

        {!classSessions ||
        classSessions.length === 0 ? (
          <div
            style={{
              marginTop: "24px",
              padding: "24px",
              border: "1px dashed #ccc",
              borderRadius: "10px",
            }}
          >
            아직 생성된 수업 일정이 없습니다.
          </div>
        ) : (
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {classSessions.map(
              (session) => (
                <Link
                  key={session.id}
                  href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "80px 1fr 100px 80px",
                    gap: "14px",
                    alignItems: "center",
                    padding: "14px 16px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <strong>
                    {session.lesson_number}
                    회차
                  </strong>

                  <span>
                    {formatSessionDateTime(
                      session.scheduled_start
                    )}
                  </span>

                  <span>
                    {getDurationMinutes(
                      session.scheduled_start,
                      session.scheduled_end
                    )}
                    분
                  </span>

                  <strong>
                    {getSessionStatusLabel(
                      session.status
                    )}
                  </strong>
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}