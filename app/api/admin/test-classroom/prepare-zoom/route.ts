import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";

/**
 * On first test-student entry, reconcile legacy Zoom meetings that were
 * created with waiting_room=true and join_before_host=false.
 * Never expose account credentials or let a caller supply an arbitrary ID.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") {
    return NextResponse.json({ error: "Test classroom disabled" }, { status: 403 });
  }
  try {
    const body = await request.json() as { sessionId?: unknown };
    const sessionId = body.sessionId;
    if (typeof sessionId !== "number" || !Number.isSafeInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || !(await verifyTestStudentMode(sessionId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    const { data: session } = await db.from("class_sessions")
      .select("id,enrollment_id,is_test,meeting_provider,meeting_id,status,ended_at")
      .eq("id", sessionId).maybeSingle();
    if (!session || !session.is_test || session.ended_at ||
        !["scheduled", "in_progress"].includes(session.status) ||
        session.meeting_provider !== "zoom" ||
        !/^\\d{9,14}$/.test(String(session.meeting_id || ""))) {
      return NextResponse.json({ error: "Meeting unavailable" }, { status: 400 });
    }
    const { data: enrollment } = await db.from("enrollments").select("is_test").eq("id",session.enrollment_id).maybeSingle();
    if (!enrollment?.is_test) return NextResponse.json({ error: "Not a test enrollment" }, { status: 403 });

    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    if (!accountId || !clientId || !clientSecret) {
      return NextResponse.json({ error: "Zoom server configuration unavailable" }, { status: 503 });
    }
    const tokenResponse = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` }, cache: "no-store" }
    );
    if (!tokenResponse.ok) return NextResponse.json({ error: "Zoom authentication unavailable" }, { status: 502 });
    const { access_token: token } = await tokenResponse.json() as { access_token?: string };
    if (!token) return NextResponse.json({ error: "Zoom authentication unavailable" }, { status: 502 });

    const meetingUrl = `https://api.zoom.us/v2/meetings/${session.meeting_id}`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const currentResponse = await fetch(meetingUrl, { headers, cache: "no-store" });
    if (!currentResponse.ok) return NextResponse.json({ error: "Zoom meeting not found or cannot be read" }, { status: 502 });
    const current = await currentResponse.json() as { settings?: { join_before_host?: boolean; waiting_room?: boolean; jbh_time?: number } };
    if (current.settings?.join_before_host === true && current.settings?.waiting_room === false &&
        current.settings?.jbh_time === 10) {
      return NextResponse.json({ success: true, updated: false });
    }
    // Do not change an active class: this endpoint only upgrades a scheduled
    // test meeting and never forcibly reconnects already joined participants.
    if (session.status !== "scheduled") {
      return NextResponse.json({ error: "Existing active meeting must not be reconfigured" }, { status: 409 });
    }
    const patch = await fetch(meetingUrl, {
      method: "PATCH", headers, cache: "no-store",
      body: JSON.stringify({ settings: { join_before_host: true, jbh_time: 10, waiting_room: false } }),
    });
    if (!patch.ok) {
      console.error("[TALKLY] Zoom test prejoin update failed", patch.status);
      return NextResponse.json({ error: "Zoom did not accept early-join settings" }, { status: 502 });
    }
    const verify = await fetch(meetingUrl, { headers, cache: "no-store" });
    if (!verify.ok) return NextResponse.json({ error: "Zoom settings could not be verified" }, { status: 502 });
    const updated = await verify.json() as { settings?: { join_before_host?: boolean; waiting_room?: boolean } };
    if (updated.settings?.join_before_host !== true || updated.settings?.waiting_room !== false) {
      return NextResponse.json({ error: "Zoom account settings prevent early join" }, { status: 409 });
    }
    return NextResponse.json({ success: true, updated: true });
  } catch (error) {
    console.error("[TALKLY] Test classroom Zoom preparation failed", error);
    return NextResponse.json({ error: "Zoom preparation unavailable" }, { status: 500 });
  }
}
