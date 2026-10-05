
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  getTeacherEvaluationRequirements,
  getTeacherEvaluationLabel,
  type TeacherEvaluationSession,
  type ExistingTeacherEvaluation,
} from "@/lib/teacher-evaluations";

type EnrollmentRow = {
  id: number;
  student_user_id: string | null;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  total_lessons: number | null;
  start_date: string | null;
};

type EvaluationRow = ExistingTeacherEvaluation & {
  id: number;
  created_at: string;
};

type ReviewItem = {
  key: string;
  sessionId: number;
  studentName: string;
  courseName: string;
  label: string;
  lessonNumber: number;
  scheduledStart: string;
  completedAt?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

const cardStyle = {
  padding: "20px",
  border: "1px solid #e4e7ec",
  borderRadius: "14px",
  background: "#ffffff",
} as const;

export default async function TeacherReviewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  if (profile?.role !== "teacher") redirect("/");

  const { data: enrollmentData, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(
        "id, student_user_id, child_id, course_id, teacher_user_id, status, total_lessons, start_date"
      )
      .eq("teacher_user_id", user.id)
      .in("status", ["active", "pending", "completed"]);

  if (enrollmentError) throw new Error(enrollmentError.message);

  const enrollments = (enrollmentData ?? []) as EnrollmentRow[];
  const enrollmentIds = enrollments.map((item) => item.id);

  let sessions: TeacherEvaluationSession[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select("id, enrollment_id, lesson_number, scheduled_start, status")
      .in("enrollment_id", enrollmentIds)
      .order("scheduled_start", { ascending: true });

    if (error) throw new Error(error.message);

    sessions = (data ?? []) as TeacherEvaluationSession[];
  }

  const sessionIds = sessions.map((item) => item.id);
  let evaluations: EvaluationRow[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("evaluations")
      .select(
        "id, class_session_id, evaluation_type, period_number, created_at"
      )
      .in("class_session_id", sessionIds);

    if (error) throw new Error(error.message);

    evaluations = (data ?? []) as EvaluationRow[];
  }

  const childIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.child_id)
        .filter((id): id is number => id !== null)
    )
  );

  const studentIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.student_user_id)
        .filter((id): id is string => id !== null)
    )
  );

  const courseIds = Array.from(
    new Set(enrollments.map((item) => item.course_id))
  );

  let children: { id: number; name: string }[] = [];
  let students: { id: string; name: string | null }[] = [];
  let courses: { id: number; name: string }[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select("id, name")
      .in("id", childIds);

    if (error) throw new Error(error.message);
    children = data ?? [];
  }

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);

    if (error) throw new Error(error.message);
    students = data ?? [];
  }

  if (courseIds.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name")
      .in("id", courseIds);

    if (error) throw new Error(error.message);
    courses = data ?? [];
  }

  const submittedSessionIds = new Set(
    evaluations.map((item) => item.class_session_id)
  );

  const pending: ReviewItem[] = [];
  const completed: ReviewItem[] = [];

  for (const enrollment of enrollments) {
    const enrollmentSessions = sessions.filter(
      (session) => session.enrollment_id === enrollment.id
    );

    const enrollmentSessionIds = new Set(
      enrollmentSessions.map((session) => session.id)
    );

    const existing = evaluations.filter((item) =>
      enrollmentSessionIds.has(item.class_session_id)
    );

    const studentName = enrollment.child_id
      ? children.find((item) => item.id === enrollment.child_id)?.name ||
        "Student"
      : enrollment.student_user_id
        ? students.find(
            (item) => item.id === enrollment.student_user_id
          )?.name || "Adult Student"
        : "Student";

    const courseName =
      courses.find((item) => item.id === enrollment.course_id)?.name ||
      "-";

    const requirements = getTeacherEvaluationRequirements({
      enrollmentId: enrollment.id,
      startDate: enrollment.start_date,
      totalLessons: enrollment.total_lessons,
      sessions: enrollmentSessions,
      existingEvaluations: existing,
    });

    for (const requirement of requirements) {
      const session = enrollmentSessions.find(
        (item) => item.id === requirement.sessionId
      );

      if (!session) continue;

      const saved = existing.find(
        (item) => item.class_session_id === requirement.sessionId
      );

      const item: ReviewItem = {
        key: `${enrollment.id}-${requirement.sessionId}`,
        sessionId: requirement.sessionId,
        studentName,
        courseName,
        label: getTeacherEvaluationLabel(requirement).en,
        lessonNumber: requirement.lessonNumber,
        scheduledStart: session.scheduled_start,
        completedAt: saved?.created_at,
      };

      if (submittedSessionIds.has(requirement.sessionId)) {
        completed.push(item);
      } else {
        pending.push(item);
      }
    }
  }

  pending.sort(
    (a, b) =>
      new Date(a.scheduledStart).getTime() -
      new Date(b.scheduledStart).getTime()
  );

  completed.sort(
    (a, b) =>
      new Date(b.completedAt ?? b.scheduledStart).getTime() -
      new Date(a.completedAt ?? a.scheduledStart).getTime()
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "36px 24px 70px",
        background: "#f7f9fc",
        color: "#101828",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            padding: "28px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #0a1f44, #17386f)",
            color: "#ffffff",
          }}
        >
          <div style={{ fontSize: "11px", letterSpacing: "0.12em" }}>
            TALKLY TEACHER PORTAL
          </div>
          <h1 style={{ margin: "8px 0", fontSize: "30px" }}>
            My Reviews
          </h1>
          <p style={{ margin: 0, color: "#dbe7ff", fontSize: "14px" }}>
            Manage your monthly and final student evaluations.
          </p>
        </div>

        <section style={{ marginTop: "28px" }}>
          <h2 style={{ fontSize: "22px", marginBottom: "16px" }}>
            Pending Evaluations ({pending.length})
          </h2>

          {pending.length === 0 ? (
            <div style={{ ...cardStyle, color: "#667085" }}>
              <strong>No evaluations pending</strong>
              <p style={{ marginBottom: 0, fontSize: "13px" }}>
                You have no student evaluations to complete right now.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {pending.map((item) => (
                <div
                  key={item.key}
                  style={{
                    ...cardStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "17px" }}>
                      {item.studentName}
                    </strong>
                    <div style={{ marginTop: "5px", color: "#667085" }}>
                      {item.courseName} · {item.label}
                    </div>
                    <div style={{ fontSize: "12px", color: "#98a2b3" }}>
                      Lesson {item.lessonNumber} ·{" "}
                      {formatDate(item.scheduledStart)}
                    </div>
                  </div>
                  <Link
                    href={`/teacher/classes/${item.sessionId}`}
                    style={{
                      padding: "10px 17px",
                      borderRadius: "9px",
                      background: "#0a1f44",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontWeight: 800,
                      fontSize: "13px",
                    }}
                  >
                    Evaluate →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "22px", marginBottom: "16px" }}>
            Completed Evaluations ({completed.length})
          </h2>

          {completed.length === 0 ? (
            <div style={{ ...cardStyle, color: "#667085" }}>
              <strong>No completed evaluations yet.</strong>
              <p style={{ marginBottom: 0, fontSize: "13px" }}>
                Your completed monthly and final evaluations will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {completed.map((item) => (
                <div
                  key={item.key}
                  style={{
                    ...cardStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "17px" }}>
                      {item.studentName}
                    </strong>
                    <div style={{ marginTop: "5px", color: "#667085" }}>
                      {item.courseName} · {item.label}
                    </div>
                    <div style={{ fontSize: "12px", color: "#98a2b3" }}>
                      Completed{" "}
                      {formatDate(item.completedAt ?? item.scheduledStart)}
                    </div>
                  </div>
                  <Link
                    href={`/teacher/classes/${item.sessionId}`}
                    style={{
                      padding: "10px 17px",
                      border: "1px solid #d0d5dd",
                      borderRadius: "9px",
                      color: "#0a1f44",
                      textDecoration: "none",
                      fontWeight: 800,
                      fontSize: "13px",
                    }}
                  >
                    View →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
