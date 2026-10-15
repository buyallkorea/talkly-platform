import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";

export async function POST(request: Request) {
  try {
    if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") {
      return NextResponse.json({ error: "Test classroom is disabled." }, { status: 403 });
    }

    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    let body: { sessionId?: unknown; message?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const sessionId = body?.sessionId;
    if (typeof sessionId !== "number" || !Number.isSafeInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }
    if (typeof body?.message !== "string") {
      return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    }
    const message = body.message.trim();
    if (!message || message.length > 1000) {
      return NextResponse.json({ error: "Message must be 1–1000 characters." }, { status: 400 });
    }

    if (!(await verifyTestStudentMode(sessionId))) {
      return NextResponse.json({ error: "Test student authorization required." }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration unavailable." }, { status: 503 });
    }
    const admin = createSupabaseAdmin(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Recheck session status immediately before the privileged write.
    const { data: session, error: sessionError } = await admin
      .from("class_sessions")
      .select("enrollment_id,is_test,status,ended_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError || session?.is_test !== true ||
        session.status !== "in_progress" || session.ended_at) {
      return NextResponse.json({ error: "Test class is not in progress." }, { status: 403 });
    }
    const { data: enrollment, error: enrollmentError } = await admin
      .from("enrollments")
      .select("is_test")
      .eq("id", session.enrollment_id)
      .maybeSingle();
    if (enrollmentError || enrollment?.is_test !== true) {
      return NextResponse.json({ error: "Not a test enrollment." }, { status: 403 });
    }

    const { error: insertError } = await admin.from("classroom_messages").insert({
      class_session_id: sessionId,
      sender_user_id: user.id,
      sender_role: "student",
      sender_name: "Admin (Test Student)",
      message,
    });
    if (insertError) {
      console.error("[TEST CLASSROOM CHAT INSERT FAILED]", insertError);
      return NextResponse.json({ error: "Message could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEST CLASSROOM CHAT FAILED]", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
