import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type CreateMeetingBody = {
  topic: string;
  startTime: string;
  durationMinutes: number;
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
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      accountId
    )}`,
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

  if (!response.ok) {
    throw new Error(
      `Zoom access token 발급 실패: ${JSON.stringify(data)}`
    );
  }

  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "로그인이 필요합니다.",
        },
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
        {
          success: false,
          error: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateMeetingBody;

    const topic = body.topic?.trim();
    const startTime = body.startTime;
    const durationMinutes = Number(body.durationMinutes);

    if (!topic) {
      return NextResponse.json(
        {
          success: false,
          error: "회의 제목이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (!startTime || Number.isNaN(new Date(startTime).getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 수업 시작시간이 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 수업시간이 필요합니다.",
        },
        { status: 400 }
      );
    }

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

    const accessToken = await getZoomAccessToken();

    const zoomResponse = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(
        hostEmail
      )}/meetings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          type: 2,
          start_time: startTime,
          duration: durationMinutes,
          timezone: "Asia/Seoul",
          agenda: "TALKLY LMS online English class",
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            waiting_room: true,
            auto_recording: "none",
          },
        }),
        cache: "no-store",
      }
    );

    const meeting = await zoomResponse.json();

    if (!zoomResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: meeting,
        },
        { status: zoomResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: {
        meetingId: String(meeting.id),
        joinUrl: meeting.join_url,
        startTime: meeting.start_time,
        durationMinutes: meeting.duration,
        topic: meeting.topic,
      },
    });
  } catch (error) {
    console.error("ZOOM CREATE MEETING ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom 회의 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}