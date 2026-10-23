import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { messageActor, sameOrigin, UUID, validMessage } from "@/lib/teacher-messages";

export async function GET(request: Request) {
  try {
    const actor = await messageActor();
    if (!actor) return NextResponse.json({ error: "접근 권한이 없습니다. / Access denied." }, { status: 403 });
    const admin = createAdminClient();
    // Count the entire inbox, independently of the paginated list.
    const unread = await actor.db.from("teacher_direct_messages").select("id", { count: "exact", head: true }).neq("sender_role", actor.role).is("read_at", null);
    if (unread.error) throw unread.error;
    if (new URL(request.url).searchParams.get("count") === "1") return NextResponse.json({ unread: unread.count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
    const page = Math.max(0, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 0));
    const { data: threads, error } = await actor.db.from("teacher_message_threads").select("id, subject, teacher_user_id, updated_at").order("updated_at", { ascending: false }).order("id").range(page * 30, page * 30 + 29);
    if (error) throw error;
    const ids = (threads ?? []).map(t => t.id);
    const { data: unseen, error: unseenError } = ids.length ? await actor.db.from("teacher_direct_messages").select("thread_id").in("thread_id", ids).neq("sender_role", actor.role).is("read_at", null) : { data: [], error: null };
    if (unseenError) throw unseenError;
    const { data: teachers, error: teacherError } = actor.role === "admin" ? await admin.from("teacher_profiles").select("user_id, display_name, is_active").order("display_name") : { data: [], error: null };
    if (teacherError) throw teacherError;
    return NextResponse.json({ threads: (threads ?? []).map(t => ({ ...t, unread: (unseen ?? []).filter(m => m.thread_id === t.id).length })), teachers, unread: unread.count ?? 0, hasMore: threads?.length === 30 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[TEACHER MESSAGES LIST]", error);
    return NextResponse.json({ error: "메시지를 불러오지 못했습니다. / Could not load messages." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const actor = await messageActor();
    if (actor?.role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (!body || !UUID.test(body.teacherId ?? "") || typeof body.subject !== "string" || !body.subject.trim() || body.subject.trim().length > 120 || !validMessage(body.body)) return NextResponse.json({ error: "강사·제목(120자)·내용(5000자)을 확인해주세요." }, { status: 400 });
    const admin = createAdminClient();
    const { data: teacher } = await admin.from("teacher_profiles").select("is_active").eq("user_id", body.teacherId).maybeSingle();
    if (!teacher?.is_active) return NextResponse.json({ error: "활성 강사를 선택해주세요." }, { status: 400 });
    const { data: id, error } = await admin.rpc("send_teacher_direct_message", { p_actor: actor.userId, p_thread: null, p_teacher: body.teacherId, p_subject: body.subject.trim(), p_body: body.body.trim() });
    if (error) throw error;
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[TEACHER MESSAGE SEND]", error);
    return NextResponse.json({ error: "전달사항을 저장하지 못했습니다." }, { status: 500 });
  }
}
