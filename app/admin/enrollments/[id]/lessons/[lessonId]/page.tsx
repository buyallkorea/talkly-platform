import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ZoomConnectButton from "./ZoomConnectButton";

type PageProps = {
  params: Promise<{
    id: string;
    lessonId: string;
  }>;
};

export default async function LessonDetailPage({
  params,
}: PageProps) {
  const { id, lessonId } = await params;

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

  const { data: session, error: sessionError } =
    await supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status,
        meeting_provider,
        meeting_id,
        meeting_url,
        teacher_notes,
        created_at,
        updated_at
      `)
      .eq("id", Number(lessonId))
      .eq("enrollment_id", Number(id))
      .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    notFound();
  }

  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        student_user_id,
        child_id,
        course_id,
        teacher_user_id
      `)
      .eq("id", session.enrollment_id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
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
    const { data: student } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", enrollment.student_user_id)
      .maybeSingle();

    studentName = student?.name || "성인 학생";
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name")
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

  function getStatusLabel(status: string) {
    switch (status) {
      case "scheduled":
        return "예정";
      case "completed":
        return "수업 완료";
      case "cancelled":
        return "수업 취소";
      case "no_show":
        return "무단결석";
      case "held":
        return "결석 승인";
      default:
        return status;
    }
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    );
  }

  const hasZoomMeeting = Boolean(
    session.meeting_id || session.meeting_url
  );

  const canConnectZoom =
    session.status === "scheduled" &&
    !hasZoomMeeting &&
    Boolean(enrollment.teacher_user_id);

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <Link
        href={`/admin/enrollments/${enrollment.id}`}
        style={{ textDecoration: "none" }}
      >
        ← 수강 상세
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
            {session.lesson_number}회차 수업
          </h1>

          <p style={{ margin: 0 }}>
            {studentName} 학생의 개별 수업정보입니다.
          </p>
        </div>

        <Link
          href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}/edit`}
          style={{
            padding: "12px 18px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          수업정보 수정
        </Link>
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
          수업 기본정보
        </h2>

        <p><strong>학생:</strong> {studentName}</p>
        <p><strong>과정:</strong> {course?.name || "-"}</p>
        <p><strong>담당 강사:</strong> {teacherName}</p>
        <p><strong>회차:</strong> {session.lesson_number}회차</p>
        <p><strong>수업 시작:</strong> {formatDateTime(session.scheduled_start)}</p>
        <p><strong>수업 종료:</strong> {formatDateTime(session.scheduled_end)}</p>
        <p>
          <strong>수업시간:</strong>{" "}
          {getDurationMinutes(
            session.scheduled_start,
            session.scheduled_end
          )}
          분
        </p>
        <p><strong>수업 상태:</strong> {getStatusLabel(session.status)}</p>
        <p><strong>수업 플랫폼:</strong> {session.meeting_provider || "-"}</p>
        <p>
          <strong>Zoom Meeting ID:</strong>{" "}
          {session.meeting_id || "아직 등록되지 않음"}
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>화상수업 링크:</strong>{" "}
          {session.meeting_id ? (
            <Link
              href={`/classroom/${session.id}`}
              style={{
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              TALKLY 수업 입장
            </Link>
          ) : (
            "아직 등록되지 않음"
          )}
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
        <h2 style={{ marginTop: 0 }}>
          Zoom 연결
        </h2>

        {hasZoomMeeting ? (
          <div>
            <strong>
              Zoom 회의가 이미 연결되어 있습니다.
            </strong>
            <p
              style={{
                marginBottom: 0,
                marginTop: "8px",
              }}
            >
              이 수업에는 새 Zoom 회의를 중복 생성하지 않습니다.
            </p>
          </div>
        ) : (
          <>
            <p>
              이 버튼은 현재 수업 1건에만 Zoom 회의를 생성합니다.
              다른 회차에는 영향을 주지 않습니다.
            </p>

            {!enrollment.teacher_user_id && (
              <p>
                담당 강사가 배정되지 않아 Zoom을 연결할 수 없습니다.
              </p>
            )}

            {session.status !== "scheduled" && (
              <p>
                예정 상태의 수업에만 Zoom을 연결할 수 있습니다.
              </p>
            )}

            <ZoomConnectButton
              sessionId={session.id}
              disabled={!canConnectZoom}
            />
          </>
        )}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          강사 / 관리자 메모
        </h2>

        <p
          style={{
            whiteSpace: "pre-wrap",
            marginBottom: 0,
          }}
        >
          {session.teacher_notes ||
            "등록된 메모가 없습니다."}
        </p>
      </div>
    </main>
  );
}