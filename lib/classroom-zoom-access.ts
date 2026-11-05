import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/server-user";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";
import { notFound, redirect } from "next/navigation";

// The frame is a separate entry point: never trust parent props or URL role/name claims.
export async function getClassroomZoomAccess(sessionId: number, studentRequested: boolean) {
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) notFound();
  const db = await createClient();
  const { data: { user } } = await getCurrentUser();
  if (!user) redirect("/login");
  const { data: profile, error: profileError } = await db.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profileError || !profile) notFound();
  const { data: session, error: sessionError } = await db.from("class_sessions")
    .select("id,enrollment_id,meeting_provider,meeting_id,teacher_user_id,is_external_teacher,is_test,status,ended_at")
    .eq("id", sessionId).maybeSingle();
  if (sessionError || !session || session.meeting_provider !== "zoom" || !session.meeting_id || session.ended_at || !["scheduled", "in_progress"].includes(session.status)) notFound();
  const { data: enrollment, error: enrollmentError } = await db.from("enrollments")
    .select("teacher_user_id,student_user_id,child_id,is_test").eq("id", session.enrollment_id).maybeSingle();
  if (enrollmentError || !enrollment) notFound();
  const hostMode = profile.role === "teacher" && session.is_external_teacher !== true && (session.teacher_user_id ?? enrollment.teacher_user_id) === user.id;
  let allowed = hostMode || profile.role === "admin" || (profile.role === "student" && enrollment.student_user_id === user.id);
  if (profile.role === "parent" && enrollment.child_id) {
    const { data: child, error } = await db.from("children").select("id").eq("id", enrollment.child_id).eq("parent_user_id", user.id).maybeSingle();
    allowed = !error && Boolean(child);
  }
  if (!allowed) notFound();
  const testStudentMode = studentRequested && profile.role === "admin" && session.is_test === true && enrollment.is_test === true && await verifyTestStudentMode(sessionId);
  let userName = testStudentMode ? "Admin (Test Student)" : profile.name || "TALKLY Participant";
  if (hostMode) {
    const { data: teacher } = await db.from("teacher_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    userName = teacher?.display_name || profile.name || "Teacher";
  }
  return { sessionId, meetingNumber: String(session.meeting_id), hostMode, userName };
}
