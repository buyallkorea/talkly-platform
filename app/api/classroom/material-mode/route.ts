import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function handle(request: Request, writing: boolean) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply({ error: "로그인이 필요합니다." }, 401);
    let body: { sessionId?: unknown; mode?: unknown; textbookId?: unknown };
    try { body = writing ? await request.json() : { sessionId: Number(new URL(request.url).searchParams.get("sessionId")) }; }
    catch { return reply({ error: "요청을 확인해주세요." }, 400); }
    const id = body?.sessionId;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 ||
      (writing && body.mode !== "textbook" && body.mode !== "screen")) return reply({ error: "교재 방식 또는 수업 ID가 올바르지 않습니다." }, 400);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["admin", "teacher", "parent", "student"].includes(profile.role)) return reply({ error: "접근 권한이 없습니다." }, 403);
    const { data: session, error: sessionError } = await admin.from("class_sessions")
      .select("id, enrollment_id, teacher_user_id, is_external_teacher, status, ended_at, scheduled_end, material_mode, selected_textbook_id")
      .eq("id", id).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return reply({ error: "수업을 찾을 수 없습니다." }, 404);
    const { data: enrollment, error: enrollmentError } = await admin.from("enrollments")
      .select("id, teacher_user_id, student_user_id, child_id").eq("id", session.enrollment_id).maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) return reply({ error: "수업을 찾을 수 없습니다." }, 404);
    const assignedTeacher = profile.role === "teacher" && session.is_external_teacher !== true &&
      (session.teacher_user_id ?? enrollment.teacher_user_id) === user.id;
    let allowed = assignedTeacher || profile.role === "admin" ||
      (profile.role === "student" && enrollment.student_user_id === user.id);
    if (profile.role === "parent" && enrollment.child_id) {
      const { data: child, error } = await admin.from("children").select("id").eq("id", enrollment.child_id)
        .eq("parent_user_id", user.id).eq("is_active", true).maybeSingle();
      if (error) throw error;
      allowed = Boolean(child);
    }
    if (!allowed || (writing && !assignedTeacher)) return reply({ error: "담당 강사만 교재 방식을 변경할 수 있습니다." }, 403);
    if (!writing) return reply({ success: true, mode: session.material_mode, textbookId: session.selected_textbook_id });
    if (session.ended_at || !["scheduled", "in_progress"].includes(session.status) || new Date(session.scheduled_end).getTime() <= Date.now()) {
      return reply({ error: "종료되었거나 입장할 수 없는 수업입니다." }, 409);
    }
    let textbookId: number | undefined;
    if (body.mode === "textbook" && body.textbookId != null) {
      if (typeof body.textbookId !== "number" || !Number.isSafeInteger(body.textbookId) || body.textbookId <= 0) return reply({ error: "교재 ID를 확인해주세요." }, 400);
      textbookId = body.textbookId;
      const { data: assignment, error } = await admin.from("enrollment_textbooks").select("id")
        .eq("enrollment_id", enrollment.id).eq("textbook_id", textbookId).in("status", ["assigned", "in_use"])
        .is("ended_at", null).limit(1).maybeSingle();
      if (error) throw error;
      if (!assignment) return reply({ error: "해당 수업에 배정된 교재를 선택해주세요." }, 403);
    }
    // RLS rechecks the current teacher assignment at write time. Never grant a host role here.
    const { data: updated, error } = await supabase.from("class_sessions").update({
      material_mode: body.mode, ...(textbookId !== undefined ? { selected_textbook_id: textbookId } : {}), updated_at: new Date().toISOString(),
    }).eq("id", id).in("status", ["scheduled", "in_progress"]).is("ended_at", null)
      .gt("scheduled_end", new Date().toISOString()).select("material_mode, selected_textbook_id").maybeSingle();
    if (error) throw error;
    if (!updated) return reply({ error: "수업 상태나 담당 강사가 변경되었습니다. 다시 확인해주세요." }, 409);
    return reply({ success: true, mode: updated.material_mode, textbookId: updated.selected_textbook_id });
  } catch (error) {
    console.error("[TALKLY material mode]", error);
    return reply({ error: "교재 방식을 확인하거나 저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, 500);
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
