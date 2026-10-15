import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { sessionId, enrollmentId, textbookId, pageId, pageNumber } = body ?? {};
    if (![sessionId, enrollmentId, textbookId, pageId, pageNumber].every(
      (value) => Number.isSafeInteger(value) && value > 0
    )) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    const admin = createAdminClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (profileError || !profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: session, error: sessionError } = await admin.from("class_sessions")
      .select("id, enrollment_id, teacher_user_id, is_external_teacher, status, ended_at").eq("id", sessionId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.enrollment_id !== enrollmentId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const { data: enrollment, error: enrollmentError } = await admin.from("enrollments")
      .select("id, teacher_user_id").eq("id", enrollmentId).maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (
      !enrollment ||
      session.is_external_teacher === true ||
      (session.teacher_user_id ?? enrollment.teacher_user_id) !== auth.user.id ||
      !["scheduled", "in_progress"].includes(session.status) ||
      session.ended_at !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: page, error: pageError } = await admin.from("textbook_pages")
      .select("id, page_number").eq("id", pageId).eq("textbook_id", textbookId).maybeSingle();
    if (pageError) throw pageError;
    if (!page || page.page_number !== pageNumber) {
      return NextResponse.json({ error: "Page mismatch" }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await admin.from("enrollment_textbooks")
      .select("id").eq("enrollment_id", enrollmentId).eq("textbook_id", textbookId)
      .in("status", ["assigned", "in_use"]).is("ended_at", null)
      .order("assigned_at", { ascending: false }).limit(1).maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return NextResponse.json({ error: "Textbook not assigned" }, { status: 404 });

    const { data: updated, error: updateError } = await admin.from("enrollment_textbooks").update({
      last_page_id: pageId,
      last_page_number: pageNumber,
      progress_updated_at: new Date().toISOString(),
    }).eq("id", assignment.id).in("status", ["assigned", "in_use"]).is("ended_at", null)
      .select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return NextResponse.json({ error: "Assignment changed" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TALKLY TEXTBOOK] progress API error", error);
    return NextResponse.json({ error: "Could not save progress" }, { status: 500 });
  }
}
