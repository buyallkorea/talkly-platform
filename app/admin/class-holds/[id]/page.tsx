import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ClassHoldReviewForm from "./ClassHoldReviewForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClassHoldDetailPage({
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

  // 결석신청 조회
  const { data: hold, error: holdError } =
    await supabase
      .from("class_holds")
      .select(`
        id,
        class_session_id,
        requested_by,
        reason,
        requested_at,
        status,
        reviewed_by,
        reviewed_at,
        admin_note,
        created_at,
        updated_at
      `)
      .eq("id", Number(id))
      .maybeSingle();

  if (holdError) {
    throw new Error(holdError.message);
  }

  if (!hold) {
    notFound();
  }

  // 대상 수업 조회
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
        meeting_url
      `)
      .eq("id", hold.class_session_id)
      .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    notFound();
  }

  // 수강정보 조회
  const { data: enrollment, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
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

  // 학생 이름
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

    studentName =
      student?.name || "성인 학생";
  }

  // 신청자 정보
  const { data: requester } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", hold.requested_by)
    .maybeSingle();

  // 검토 관리자
  let reviewerName = "-";

  if (hold.reviewed_by) {
    const { data: reviewer } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", hold.reviewed_by)
      .maybeSingle();

    if (reviewer?.name) {
      reviewerName = reviewer.name;
    }
  }

  // 과정 정보
  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", enrollment.course_id)
    .maybeSingle();

  // 담당 강사
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

  function getHoldStatusLabel(status: string) {
    switch (status) {
      case "requested":
        return "확인 대기중";

      case "approved":
        return "승인 완료";

      case "rejected":
        return "거절";

      case "cancelled":
        return "신청 취소";

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

  function formatDateTime(value: string | null) {
    if (!value) {
      return "-";
    }

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

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin/class-holds"
        style={{
          textDecoration: "none",
        }}
      >
        ← 결석신청 목록
      </Link>

      <div
        style={{
          marginTop: "32px",
        }}
      >
        <h1
          style={{
            marginBottom: "8px",
          }}
        >
          결석신청 상세
        </h1>

        <p
          style={{
            margin: 0,
          }}
        >
          {studentName} 학생의 Class Hold 신청입니다.
        </p>
      </div>

      <section
        style={{
          marginTop: "32px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          신청정보
        </h2>

        <p>
          <strong>상태:</strong>{" "}
          {getHoldStatusLabel(hold.status)}
        </p>

        <p>
          <strong>신청자:</strong>{" "}
          {requester?.name || "이름 미등록"}
        </p>

        <p>
          <strong>신청일:</strong>{" "}
          {formatDateTime(hold.requested_at)}
        </p>

        <p>
          <strong>신청사유:</strong>
        </p>

        <div
          style={{
            padding: "16px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
          }}
        >
          {hold.reason ||
            "사유가 입력되지 않았습니다."}
        </div>
      </section>

      <section
        style={{
          marginTop: "24px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          대상 수업
        </h2>

        <p>
          <strong>학생:</strong>{" "}
          {studentName}
        </p>

        <p>
          <strong>과정:</strong>{" "}
          {course?.name || "-"}
        </p>

        <p>
          <strong>담당 강사:</strong>{" "}
          {teacherName}
        </p>

        <p>
          <strong>회차:</strong>{" "}
          {session.lesson_number}회차
        </p>

        <p>
          <strong>수업 시작:</strong>{" "}
          {formatDateTime(
            session.scheduled_start
          )}
        </p>

        <p>
          <strong>수업시간:</strong>{" "}
          {getDurationMinutes(
            session.scheduled_start,
            session.scheduled_end
          )}
          분
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>현재 수업상태:</strong>{" "}
          {getSessionStatusLabel(
            session.status
          )}
        </p>

        <div
          style={{
            marginTop: "20px",
          }}
        >
          <Link
            href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}`}
            style={{
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            해당 수업 상세보기 →
          </Link>
        </div>
      </section>

      <section
        style={{
          marginTop: "24px",
          padding: "28px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          관리자 검토
        </h2>

        {hold.status === "requested" ? (
          <>
            <p>
              현재 신청은 아직 검토되지 않았습니다.
            </p>

            <ClassHoldReviewForm
              holdId={hold.id}
              sessionId={session.id}
            />
          </>
        ) : (
          <>
            <p>
              <strong>처리 결과:</strong>{" "}
              {getHoldStatusLabel(hold.status)}
            </p>

            <p>
              <strong>검토 관리자:</strong>{" "}
              {reviewerName}
            </p>

            <p>
              <strong>검토일:</strong>{" "}
              {formatDateTime(hold.reviewed_at)}
            </p>

            <p>
              <strong>관리자 메모:</strong>
            </p>

            <div
              style={{
                padding: "16px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                whiteSpace: "pre-wrap",
              }}
            >
              {hold.admin_note ||
                "등록된 관리자 메모가 없습니다."}
            </div>
          </>
        )}
      </section>
    </main>
  );
}