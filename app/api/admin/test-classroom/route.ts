import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const TEST_COURSE_ID = 1;
const DEFAULT_TEACHER_ID = "3c269c0a-fb3e-4e8f-98d5-fc1ac29cc090";

type RequestBody = {
  teacherUserId?: string;
  scheduledStart?: string;
  durationMinutes?: 25 | 50;
};

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function zoomToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("Zoom API 환경변수가 설정되지 않았습니다.");
  }
  const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store" }
  );
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Zoom 토큰 발급 실패 (${response.status})`);
  return data.access_token as string;
}

async function createZoomMeeting(token: string, start: Date, duration: number) {
  const host = process.env.ZOOM_HOST_EMAIL;
  if (!host) throw new Error("ZOOM_HOST_EMAIL 환경변수가 없습니다.");
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(host)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: "TALKLY Jennifer - 관리자 테스트 수업",
      type: 2,
      start_time: start.toISOString(),
      duration,
      timezone: "Asia/Seoul",
      agenda: "TALKLY temporary prelaunch test classroom",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: false,
        auto_recording: "none",
      },
    }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.id || !data.join_url) {
    throw new Error(`Zoom 테스트 회의 생성 실패 (${response.status})`);
  }
  return { id: String(data.id), url: String(data.join_url) };
}

async function deleteZoomMeeting(token: string, meetingId: string) {
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Zoom 회의 롤백 실패 (${response.status})`);
  }
}

export async function POST(request: Request) {
  let enrollmentId: number | null = null;
  let meetingId: string | null = null;
  let token: string | null = null;
  const admin = createAdminClient();
  try {
    // Explicit opt-in: prevents accidental use of the temporary test API in production.
    if (process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true") {
      return NextResponse.json({ error: "테스트 수업 생성 기능이 비활성화되어 있습니다." }, { status: 403 });
    }
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    let body: RequestBody;
    try { body = (await request.json()) as RequestBody; }
    catch { return NextResponse.json({ error: "요청 JSON을 확인해주세요." }, { status: 400 }); }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "요청 데이터를 확인해주세요." }, { status: 400 });
    const teacherUserId = body.teacherUserId || DEFAULT_TEACHER_ID;
    const duration = body.durationMinutes ?? 25;
    if (duration !== 25 && duration !== 50) {
      return NextResponse.json({ error: "수업시간은 25분 또는 50분이어야 합니다." }, { status: 400 });
    }
    if (typeof body.scheduledStart !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(body.scheduledStart)) {
      return NextResponse.json({ error: "시작시간에는 시간대(+09:00 등)를 포함해주세요." }, { status: 400 });
    }
    const start = new Date(body.scheduledStart);
    if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
      return NextResponse.json({ error: "미래의 올바른 수업 시작시간을 입력해주세요." }, { status: 400 });
    }
    const end = new Date(start.getTime() + duration * 60000);
    const { data: teacher, error: teacherError } = await admin.from("teacher_profiles").select("user_id").eq("user_id", teacherUserId).maybeSingle();
    if (teacherError || !teacher) return NextResponse.json({ error: "등록된 강사 계정을 찾을 수 없습니다." }, { status: 400 });
    const { data: course, error: courseError } = await admin.from("courses").select("id").eq("id", TEST_COURSE_ID).maybeSingle();
    if (courseError || !course) return NextResponse.json({ error: "테스트 교육과정(ID 1)을 찾을 수 없습니다." }, { status: 400 });

    // Prevent overlapping lessons for the assigned teacher, including normal classes.
    const { data: conflicts, error: conflictError } = await admin.from("class_sessions")
      .select("id").eq("teacher_user_id", teacherUserId)
      .lt("scheduled_start", end.toISOString()).gt("scheduled_end", start.toISOString())
      .in("status", ["scheduled", "in_progress"]).limit(1);
    if (conflictError) throw new Error(`강사 일정 중복 확인 실패: ${conflictError.message}`);
    if (conflicts?.length) return NextResponse.json({ error: "해당 시간에 강사의 다른 수업이 있습니다." }, { status: 409 });

    // Create one isolated test enrollment, never a real student or payment record.
    const { data: enrollment, error: enrollmentError } = await admin.from("enrollments")
      .insert({ course_id: TEST_COURSE_ID, teacher_user_id: teacherUserId,
        student_user_id: null, child_id: null, status: "active", is_test: true,
        start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10),
        lessons_per_week: 1, total_lessons: 1 })
      .select("id").single();
    if (enrollmentError || !enrollment) throw new Error(`테스트 수강 생성 실패: ${enrollmentError?.message || "ID 없음"}`);
    enrollmentId = enrollment.id;

    const { data: session, error: sessionError } = await admin.from("class_sessions")
      .insert({ enrollment_id: enrollmentId, teacher_user_id: teacherUserId,
        lesson_number: 1, scheduled_start: start.toISOString(), scheduled_end: end.toISOString(),
        status: "scheduled", meeting_provider: "zoom", is_test: true })
      .select("id").single();
    if (sessionError || !session) throw new Error(`테스트 수업 생성 실패: ${sessionError?.message || "ID 없음"}`);

    token = await zoomToken();
    const meeting = await createZoomMeeting(token, start, duration);
    meetingId = meeting.id;
    const { data: linked, error: linkError } = await admin.from("class_sessions")
      .update({ meeting_id: meeting.id, meeting_url: meeting.url, updated_at: new Date().toISOString() })
      .eq("id", session.id).eq("is_test", true).select("id").single();
    if (linkError || !linked) throw new Error(`Zoom 연결 저장 실패: ${linkError?.message || "수정된 행 없음"}`);

    return NextResponse.json({ success: true, enrollmentId, sessionId: session.id,
      teacherUserId, isTest: true, scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(), classroomUrl: `/classroom/${session.id}` });
  } catch (error) {
    console.error("[TEST CLASSROOM CREATE]", error);
    if (token && meetingId) {
      try { await deleteZoomMeeting(token, meetingId); }
      catch (rollbackError) { console.error("[TEST CLASSROOM ZOOM ROLLBACK FAILED]", rollbackError); }
    }
    if (enrollmentId !== null) {
      // FK cascade deletes the newly-created class session as well.
      const { error: rollbackError } = await admin.from("enrollments").delete()
        .eq("id", enrollmentId).eq("is_test", true);
      if (rollbackError) console.error("[TEST CLASSROOM DB ROLLBACK FAILED]", rollbackError);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "테스트 수업 생성 실패" }, { status: 500 });
  }
}
