import { NextResponse } from "next/server";

async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET 환경변수를 확인해주세요."
    );
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

export async function POST() {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        {
          success: false,
          error: "This test endpoint is available only in development.",
        },
        { status: 403 }
      );
    }

    const hostEmail = process.env.ZOOM_HOST_EMAIL;

    if (!hostEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ZOOM_HOST_EMAIL 환경변수가 없습니다. Zoom 회의를 생성할 호스트 이메일을 .env.local에 추가해주세요.",
        },
        { status: 500 }
      );
    }

    const accessToken = await getZoomAccessToken();

    const startTime = new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString();

    const meetingResponse = await fetch(
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
          topic: "TALKLY Zoom API Test Class",
          type: 2,
          start_time: startTime,
          duration: 25,
          timezone: "Asia/Seoul",
          agenda:
            "TALKLY LMS Zoom Server-to-Server OAuth integration test.",
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

    const meeting = await meetingResponse.json();

    if (!meetingResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          status: meetingResponse.status,
          error: meeting,
        },
        { status: meetingResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Zoom test meeting created successfully.",
      meeting: {
        id: meeting.id,
        uuid: meeting.uuid,
        topic: meeting.topic,
        host_email: meeting.host_email,
        start_time: meeting.start_time,
        duration: meeting.duration,
        timezone: meeting.timezone,
        password: meeting.password ?? null,
        join_url: meeting.join_url,
        start_url: meeting.start_url,
      },
    });
  } catch (error) {
    console.error("ZOOM CREATE TEST MEETING ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom 테스트 회의 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}