import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";

type RequestBody = {
  sessionId: number;
};

function base64UrlEncode(input: Buffer | string) {
  const value =
    typeof input === "string" ? Buffer.from(input) : input;

  return value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createMeetingSdkSignature(
  sdkKey: string,
  sdkSecret: string,
  meetingNumber: string,
  role: 0 | 1
) {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sdkKey,
    mn: meetingNumber,
    role,
    iat,
    exp,
    appKey: sdkKey,
    tokenExp: exp,
  };

  const unsignedToken = `${base64UrlEncode(
    JSON.stringify(header)
  )}.${base64UrlEncode(JSON.stringify(payload))}`;

  const signature = crypto
    .createHmac("sha256", sdkSecret)
    .update(unsignedToken)
    .digest();

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom Server-to-Server OAuth 환경변수가 설정되지 않았습니다."
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

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Zoom Access Token 발급 실패: ${
        typeof data?.message === "string"
          ? data.message
          : JSON.stringify(data)
      }`
    );
  }

  return data.access_token as string;
}

async function getHostZak(
  accessToken: string,
  hostEmail: string
) {
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(
      hostEmail
    )}/token?type=zak&ttl=7200`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.token) {
    throw new Error(
      `Zoom ZAK 발급 실패: ${
        typeof data?.message === "string"
          ? data.message
          : JSON.stringify(data)
      }`
    );
  }

  return data.token as string;
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
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      (profile.role !== "teacher" &&
        profile.role !== "admin")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "강사 또는 관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const sessionId = Number(body.sessionId);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 수업 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          status,
          meeting_provider,
          meeting_id
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

    if (
      !session ||
      session.meeting_provider !== "zoom" ||
      !session.meeting_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Zoom이 연결된 수업을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const { data: enrollment, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("teacher_user_id")
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

    if (
      profile.role === "teacher" &&
      enrollment.teacher_user_id !== user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "이 수업의 담당 강사가 아닙니다.",
        },
        { status: 403 }
      );
    }

    const sdkKey =
      process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_CLIENT_ID;
    const sdkSecret =
      process.env.ZOOM_MEETING_SDK_CLIENT_SECRET;
    const hostEmail =
      process.env.ZOOM_HOST_EMAIL;

    if (!sdkKey || !sdkSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Meeting SDK 환경변수가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    if (!hostEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ZOOM_HOST_EMAIL 환경변수가 없습니다.",
        },
        { status: 500 }
      );
    }

    const meetingNumber = String(session.meeting_id);

    const signature = createMeetingSdkSignature(
      sdkKey,
      sdkSecret,
      meetingNumber,
      1
    );

    const accessToken =
      await getZoomAccessToken();

    const zak = await getHostZak(
      accessToken,
      hostEmail
    );

    return NextResponse.json({
      success: true,
      signature,
      sdkKey,
      zak,
      meetingNumber,
    });
  } catch (error) {
    console.error("ZOOM HOST AUTH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom 호스트 인증 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}