import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = { sessionId?: number; state?: "joined" | "left" };

/**
 * Browser-only signal emitted AFTER Meeting SDK join resolves.
 * Never interpret this as authoritative Zoom server presence, audio/video health,
 * or Zoom app connectivity. Service role access is server-side only.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "잘못된 요청 출처" }, { status: 403 });
  }
  let body: Payload;
  try { body = await request.json() as Payload; }
  catch { return NextResponse.json({ error: "요청 형식 오류" }, { status: 400 }); }
  const sessionId = Number(body.sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0 || !["joined", "left"].includes(body.state ?? "")) {
    return NextResponse.json({ error: "요청 값 오류" }, { status: 400 });
  }

  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !["admin", "teacher", "student", "parent"].includes(profile.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { data: session, error: sessionError } = await client.from("class_sessions")
    .select("id,enrollment_id,status,ended_at,meeting_provider,teacher_user_id,is_external_teacher")
    .eq("id", sessionId).maybeSingle();
  if (sessionError || !session || session.meeting_provider !== "zoom") {
    return NextResponse.json({ error: "수업을 찾을 수 없습니다." }, { status: 404 });
  }
  // A leave event may arrive after a class ends. New joins are never accepted then.
  if (body.state === "joined" && (session.ended_at || !["scheduled", "in_progress"].includes(session.status))) {
    return NextResponse.json({ error: "종료된 수업입니다." }, { status: 403 });
  }
  const { data: enrollment, error: enrollmentError } = await client.from("enrollments")
    .select("id,child_id,student_user_id,teacher_user_id")
    .eq("id", session.enrollment_id).maybeSingle();
  if (enrollmentError || !enrollment) return NextResponse.json({ error: "수강정보 없음" }, { status: 403 });
  let authorized = profile.role === "admin";
  if (profile.role === "teacher") {
    authorized = !session.is_external_teacher &&
      (session.teacher_user_id ?? enrollment.teacher_user_id) === user.id;
  } else if (profile.role === "student") authorized = enrollment.student_user_id === user.id;
  else if (profile.role === "parent" && enrollment.child_id) {
    const { data: child, error } = await client.from("children").select("id")
      .eq("id", enrollment.child_id).eq("parent_user_id", user.id).maybeSingle();
    authorized = !error && !!child;
  }
  if (!authorized) return NextResponse.json({ error: "이 수업의 참여자가 아닙니다." }, { status: 403 });

  const db = createAdminClient();
  const now = new Date().toISOString();
  if (body.state === "joined") {
    // Refresh the server clock on each heartbeat. No client-controlled timestamp.
    const { error } = await db.from("classroom_live_presence").upsert({
      class_session_id: sessionId, user_id: user.id, role: profile.role,
      connection_state: "joined", last_seen_at: now,
    }, { onConflict: "class_session_id,user_id" });
    if (error) {
      console.error("[classroom live presence] update failed", error.code);
      return NextResponse.json({ error: "접속정보 저장 실패" }, { status: 500 });
    }
  } else {
    const { error } = await db.from("classroom_live_presence")
      .update({ connection_state: "left", last_seen_at: now })
      .eq("class_session_id", sessionId).eq("user_id", user.id);
    if (error) {
      console.error("[classroom live presence] leave failed", error.code);
      return NextResponse.json({ error: "접속정보 갱신 실패" }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
