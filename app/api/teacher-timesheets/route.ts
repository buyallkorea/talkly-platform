import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateManualTimesheet, validMonth } from "@/lib/timesheets/manual";

export async function PUT(request: Request) {
  try {
    if (process.env.VERCEL_ENV === "preview") {
      return Response.json({ error: "Saving is disabled on Preview to protect operating records." }, { status: 503 });
    }
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (!origin || new URL(origin).host !== host || !["https:", "http:"].includes(new URL(origin).protocol)) {
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const userClient = await createClient();
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const { data: profile, error: roleError } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (roleError) return Response.json({ error: "Unable to verify your account." }, { status: 503 });
    if (profile?.role !== "teacher") return Response.json({ error: "Teacher access only." }, { status: 403 });
    const admin = createAdminClient();
    const { data: teacher, error: teacherError } = await admin.from("teacher_profiles").select("is_active").eq("user_id", user.id).maybeSingle();
    if (teacherError) return Response.json({ error: "Unable to verify teacher status." }, { status: 503 });
    if (!teacher?.is_active) return Response.json({ error: "This teacher account is inactive." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 160000) return Response.json({ error: "Timesheet is too large." }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "Invalid timesheet." }, { status: 400 });
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some(key => !["month","revision","status","entries","rosterNotes","teacherNote","timeZone"].includes(key))) {
      return Response.json({ error: "Unexpected field." }, { status: 400 });
    }
    if (!validMonth(body.month) || typeof body.revision !== "number" || !Number.isSafeInteger(body.revision) || body.revision < 0) {
      return Response.json({ error: "Invalid month or revision." }, { status: 400 });
    }
    let values: ReturnType<typeof validateManualTimesheet>;
    try {
      values = validateManualTimesheet(body.month, { entries: body.entries, rosterNotes: body.rosterNotes, teacherNote: body.teacherNote, timeZone: body.timeZone, status: body.status });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid time blocks." }, { status: 400 });
    }
    const { data, error } = await admin.rpc("save_teacher_manual_timesheet", {
      p_actor: user.id, p_month: body.month, p_revision: body.revision,
      p_status: values.status, p_entries: values.entries, p_roster_notes: values.rosterNotes,
      p_teacher_note: values.teacherNote, p_time_zone: values.timeZone,
    });
    if (error) {
      if (error.message?.includes("TIMESHEET_CONFLICT") || error.code === "23505") {
        return Response.json({ error: "Another version was saved. Copy your changes before reloading." }, { status: 409 });
      }
      if (error.message?.includes("TIMESHEET_FORBIDDEN")) return Response.json({ error: "Teacher permission was denied." }, { status: 403 });
      return Response.json({ error: "Unable to save timesheet. Please retry." }, { status: 503 });
    }
    if (!data || !Number.isSafeInteger(data.revision) || data.revision !== Number(body.revision) + 1 || data.status !== values.status) {
      return Response.json({ error: "Save result could not be confirmed. Keep this page open." }, { status: 503 });
    }
    return Response.json({ success: true, revision: data.revision, status: data.status, updatedAt: data.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to process timesheet. Please retry." }, { status: 503 });
  }
}
