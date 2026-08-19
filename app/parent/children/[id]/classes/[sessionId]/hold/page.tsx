import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import HoldRequestForm from "./HoldRequestForm";

type PageProps = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

export default async function HoldRequestPage({
  params,
}: PageProps) {
  const { id, sessionId } = await params;

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

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  const { data: child, error: childError } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        parent_user_id,
        is_active
      `)
      .eq("id", Number(id))
      .eq("parent_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (childError) {
    throw new Error(childError.message);
  }

  if (!child) {
    notFound();
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
        status
      `)
      .eq("id", Number(sessionId))
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
        child_id,
        course_id,
        teacher_user_id
      `)
      .eq("id", session.enrollment_id)
      .eq("child_id", child.id)
      .maybeSingle();

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  if (!enrollment) {
    notFound();
  }

  if (session.status !== "scheduled") {
    redirect(
      `/parent/children/${child.id}/classes/${session.id}`
    );
  }

  const { data: existingHold } = await supabase
    .from("class_holds")
    .select("id")
    .eq("class_session_id", session.id)
    .eq("requested_by", user.id)
    .limit(1)
    .maybeSingle();

  if (existingHold) {
    redirect(
      `/parent/children/${child.id}/classes/${session.id}`
    );
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

  function formatDateTime(value: string) {
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

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: "8px" }}>
        결석신청
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "32px",
        }}
      >
        {child.name} 학생의 {session.lesson_number}회차
        수업에 대한 결석신청입니다.
      </p>

      <section
        style={{
          marginBottom: "24px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          대상 수업
        </h2>

        <p>
          <strong>학생:</strong> {child.name}
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

        <p style={{ marginBottom: 0 }}>
          <strong>수업일시:</strong>{" "}
          {formatDateTime(
            session.scheduled_start
          )}
        </p>
      </section>

      <HoldRequestForm
        childId={child.id}
        sessionId={session.id}
      />
    </main>
  );
}