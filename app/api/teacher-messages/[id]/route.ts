import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { messageActor, sameOrigin, UUID, validMessage } from "@/lib/teacher-messages";

type Context = { params: Promise<{ id: string }> };
async function access(context: Context) {
  const { id } = await context.params;
  const actor = await messageActor();
  if (!actor || !UUID.test(id)) return null;
  // RLS returns only the assigned teacher's conversation or an admin's view.
  const { data: thread, error } = await actor.db.from("teacher_message_threads").select("id,subject,teacher_user_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return thread ? { actor, thread, id } : null;
}
export async function GET(request: Request, context: Context) {
  try {
    const result = await access(context);
    if (!result) return NextResponse.json({ error: "메시지를 찾을 수 없습니다. / Message not found." }, { status: 404 });
    const before = new URL(request.url).searchParams.get("before");
    let query = result.actor.db.from("teacher_direct_messages").select("id,sender_role,body,created_at,read_at").eq("thread_id", result.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    // Pagination uses a message ID resolved within this same authorized thread.
    if (before && UUID.test(before)) {
      const { data: cursor } = await result.actor.db.from("teacher_direct_messages").select("created_at,id").eq("id", before).eq("thread_id", result.id).maybeSingle();
      if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }
    const { data: messages, error } = await query;
    if (error) throw error;
    return NextResponse.json({ thread: result.thread, messages: (messages ?? []).reverse(), hasMore: messages?.length === 100 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[TEACHER MESSAGE READ]", error);
    return NextResponse.json({ error: "메시지 조회 실패 / Could not load conversation." }, { status: 500 });
  }
}
export async function POST(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const result = await access(context);
    if (!result) return NextResponse.json({ error: "메시지를 찾을 수 없습니다. / Message not found." }, { status: 404 });
    const body = await request.json().catch(() => null);
    const admin = createAdminClient();
    if (body?.action === "read") {
      if (!Array.isArray(body.ids) || body.ids.length > 100 || !body.ids.every((id: unknown) => typeof id === "string" && UUID.test(id))) return NextResponse.json({ error: "Invalid message IDs" }, { status: 400 });
      if (body.ids.length) {
        const { error } = await admin.from("teacher_direct_messages").update({ read_at: new Date().toISOString() }).eq("thread_id", result.id).in("id", body.ids).neq("sender_role", result.actor.role).is("read_at", null);
        if (error) throw error;
      }
    } else {
      if (!validMessage(body?.body)) return NextResponse.json({ error: "내용은 1–5000자입니다. / Use 1–5000 characters." }, { status: 400 });
      const { error } = await admin.rpc("send_teacher_direct_message", { p_actor: result.actor.userId, p_thread: result.id, p_teacher: null, p_subject: null, p_body: body.body.trim() });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEACHER MESSAGE REPLY]", error);
    return NextResponse.json({ error: "저장하지 못했습니다. / Could not save message." }, { status: 500 });
  }
}
