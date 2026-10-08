import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    if (profileError || !profile || !["teacher", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: session } = await admin.from("class_sessions")
      .select("id, enrollment_id").eq("id", sessionId).maybeSingle();
    if (!session || session.enrollment_id !== enrollmentId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const { data: enrollment } = await admin.from("enrollments")
      .select("id, teacher_user_id").eq("id", enrollmentId).maybeSingle();
    if (!enrollment || (profile.role !== "admin" && enrollment.teacher_user_id !== auth.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: page } = await admin.from("textbook_pages")
      .select("id, page_number").eq("id", pageId).eq("textbook_id", textbookId).maybeSingle();
    if (!page || page.page_number !== pageNumber) {
      return NextResponse.json({ error: "Page mismatch" }, { status: 400 });
    }

    const { data: assignment } = await admin.from("enrollment_textbooks")
      .select("id").eq("enrollment_id", enrollmentId)
      .eq("textbook_id", textbookId).is("ended_at", null).limit(1).maybeSingle();
    if (!assignment) return NextResponse.json({ error: "Textbook not assigned" }, { status: 404 });

    const { error } = await admin.from("enrollment_textbooks").update({
      last_page_id: pageId,
      last_page_number: pageNumber,
      progress_updated_at: new Date().toISOString(),
    }).eq("id", assignment.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TALKLY TEXTBOOK] progress API error", error);
    return NextResponse.json({ error: "Could not save progress" }, { status: 500 });
  }
}
