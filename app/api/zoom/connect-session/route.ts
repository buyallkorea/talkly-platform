import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  sessionId: number;
};

async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom API 환경변수가 설정되지 않았습니다.");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Zoom access token 발급 실패: ${JSON.stringify(data)}`
    );
  }

  return data.access_token as string;
}

async function deleteZoomMeeting(
  accessToken: string,
  meetingId: string
) {
  await fetch(
    `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
}

export async function POST(request: Request) {
  let createdMeetingId: string | null = null;
  let accessToken: string | null = null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const sessionId = Number(body.sessionId);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json(
        { success: false, error: "올바른 수업 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          lesson_number,
          scheduled_start,
          scheduled_end,
          status,
          meeting_provider,
          meeting_id,
          meeting_url
        `)
        .eq("id", sessionId)
        .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        {
          success: false,
          error: `수업 조회 실패: ${sessionError.message}`,
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: "수업을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (session.status !== "scheduled") {
      return NextResponse.json(
        {
          success: false,
          error: "예정 상태의 수업에만 Zoom을 연결할 수 있습니다.",
        },
        { status: 409 }
      );
    }

    if (session.meeting_id || session.meeting_url) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 Zoom 회의가 연결된 수업입니다.",
        },
        { status: 409 }
      );
    }

    const { data: enrollment, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select(`
          id,
          student_user_id,
          child_id,
          course_id,
          teacher_user_id
        `)
        .eq("id", session.enrollment_id)
        .maybeSingle();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        {
          success: false,
          error:
            enrollmentError?.message ||
            "수강정보를 찾을 수 없습니다.",
        },
        { status: 500 }
      );
    }

    if (!enrollment.teacher_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "담당 강사가 배정되지 않은 수업입니다.",
        },
        { status: 409 }
      );
    }

    let studentName = "Student";

    if (enrollment.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("name")
        .eq("id", enrollment.child_id)
        .maybeSingle();

      if (child?.name) {
        studentName = child.name;
      }
    } else if (enrollment.student_user_id) {
      const { data: student } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", enrollment.student_user_id)
        .maybeSingle();

      if (student?.name) {
        studentName = student.name;
      }
    }

    const { data: course } = await supabase
      .from("courses")
      .select("name")
      .eq("id", enrollment.course_id)
      .maybeSingle();

    const start = new Date(session.scheduled_start);
    const end = new Date(session.scheduled_end);
    const durationMinutes = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60000)
    );

    const hostEmail = process.env.ZOOM_HOST_EMAIL;

    if (!hostEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ZOOM_HOST_EMAIL 환경변수가 없습니다.",
        },
        { status: 500 }
      );
    }

    accessToken = await getZoomAccessToken();

    const zoomResponse = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(hostEmail)}/meetings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: `TALKLY ${studentName} - ${session.lesson_number}회차${
            course?.name ? ` - ${course.name}` : ""
          }`,
          type: 2,
          start_time: session.scheduled_start,
          duration: durationMinutes,
          timezone: "Asia/Seoul",
          agenda: "TALKLY online English class",
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
      }
    );

    const meeting = await zoomResponse.json();

    if (!zoomResponse.ok || !meeting.id || !meeting.join_url) {
      return NextResponse.json(
        { success: false, error: meeting },
        { status: zoomResponse.status }
      );
    }

    createdMeetingId = String(meeting.id);

    const { data: updated, error: updateError } =
      await supabase
        .from("class_sessions")
        .update({
          meeting_provider: "zoom",
          meeting_id: createdMeetingId,
          meeting_url: meeting.join_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .is("meeting_id", null)
        .is("meeting_url", null)
        .select("id, meeting_id, meeting_url")
        .maybeSingle();

    if (updateError || !updated) {
      await deleteZoomMeeting(
        accessToken,
        createdMeetingId
      );

      return NextResponse.json(
        {
          success: false,
          error:
            updateError?.message ||
            "수업 DB 업데이트에 실패했습니다. 생성된 Zoom 회의는 자동 삭제했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Zoom 회의가 수업에 연결되었습니다.",
      session: {
        id: session.id,
        meetingId: updated.meeting_id,
        meetingUrl: updated.meeting_url,
      },
    });
  } catch (error) {
    if (createdMeetingId && accessToken) {
      try {
        await deleteZoomMeeting(
          accessToken,
          createdMeetingId
        );
      } catch {}
    }

    console.error("ZOOM CONNECT SESSION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom 연결 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}